import { chromium, type Browser, type BrowserContext } from "playwright";
import { logger } from "../utils/logger.js";

const log = logger.child({ module: "Browser-Pool" });

const CHROME_LOW_RESOURCE_ARGS = [
  "--disable-blink-features=AutomationControlled",
  "--disable-dev-shm-usage",
  "--disable-extensions",
  "--disable-background-networking",
  "--disable-default-apps",
  "--disable-sync",
  "--disable-translate",
  "--mute-audio",
  "--no-first-run",
  "--disable-renderer-backgrounding",
  "--disable-features=TranslateUI,BackForwardCache",
] as const;

const PROTECTED_RESOURCE_URL = /recaptcha|gstatic|googleapis|google\.com|justiciasantafe/i;
const BLOCKED_THIRD_PARTY_RESOURCE_TYPES = new Set(["image", "media", "font"]);
const MAX_CONTEXTS_PER_BROWSER = Number(process.env.SISFE_BROWSER_MAX_CONTEXTS ?? 25);
const IDLE_TTL_MS = Number(process.env.SISFE_BROWSER_IDLE_TTL_MS ?? 10 * 60 * 1000);

let sharedBrowser: Browser | null = null;
let launchingBrowser: Promise<Browser> | null = null;
let contextsSinceLaunch = 0;
let activeContexts = 0;
let idleCloseTimer: NodeJS.Timeout | null = null;

function clearIdleCloseTimer(): void {
  if (idleCloseTimer) {
    clearTimeout(idleCloseTimer);
    idleCloseTimer = null;
  }
}

function scheduleIdleClose(): void {
  clearIdleCloseTimer();
  if (!sharedBrowser?.isConnected() || activeContexts > 0 || IDLE_TTL_MS <= 0) return;

  idleCloseTimer = setTimeout(() => {
    if (activeContexts === 0) {
      closeBrowserPool().catch((error) => {
        log.warn({ err: error }, "No se pudo rotar el browser compartido por inactividad");
      });
    }
  }, IDLE_TTL_MS);
  idleCloseTimer.unref();
}

async function getBrowser(): Promise<Browser> {
  if (sharedBrowser?.isConnected()) {
    return sharedBrowser;
  }

  if (!launchingBrowser) {
    launchingBrowser = chromium.launch({
      headless: process.env.SISFE_HEADLESS === "true",
      channel: "chrome",
      ignoreDefaultArgs: ["--enable-automation"],
      args: [...CHROME_LOW_RESOURCE_ARGS],
    }).then((browser) => {
      sharedBrowser = browser;
      contextsSinceLaunch = 0;
      browser.on("disconnected", () => {
        if (sharedBrowser === browser) {
          sharedBrowser = null;
          contextsSinceLaunch = 0;
        }
      });
      return browser;
    }).finally(() => {
      launchingBrowser = null;
    });
  }

  return launchingBrowser;
}

async function rotateBrowserIfNeeded(): Promise<void> {
  if (!sharedBrowser?.isConnected() || activeContexts > 0 || contextsSinceLaunch < MAX_CONTEXTS_PER_BROWSER) {
    return;
  }

  log.info({ contextsSinceLaunch }, "Rotando browser compartido por cantidad de contextos");
  await closeBrowserPool();
}

async function installResourceBlocking(context: BrowserContext): Promise<void> {
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = request.url();

    if (PROTECTED_RESOURCE_URL.test(url)) {
      await route.continue();
      return;
    }

    if (BLOCKED_THIRD_PARTY_RESOURCE_TYPES.has(request.resourceType())) {
      await route.abort();
      return;
    }

    await route.continue();
  });
}

export async function crearContextoAutenticadoDesdeBrowser(
  browser: Browser,
  cookieName: string,
  cookieValue: string,
): Promise<BrowserContext> {
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1366, height: 768 },
    locale: "es-AR",
    timezoneId: "America/Argentina/Buenos_Aires",
  });
  // tsx/esbuild (keepNames) inyecta un helper `__name(fn, "name")` en las funciones.
  // Al serializar callbacks para page.evaluate/$$eval, el navegador no conoce `__name`
  // y lanza "ReferenceError: __name is not defined". Lo definimos como no-op en el
  // navegador para que cualquier evaluate funcione sin depender de cómo se transpile.
  await context.addInitScript(() => {
    const w = globalThis as unknown as { __name?: (fn: unknown) => unknown };
    if (typeof w.__name === "undefined") {
      w.__name = (fn: unknown) => fn;
    }
  });
  await installResourceBlocking(context);

  try {
    const parsed = JSON.parse(cookieValue);

    if (parsed.cookies && Array.isArray(parsed.cookies)) {
      await context.addCookies(parsed.cookies);
    }

    if (parsed.currentUser) {
      await context.addInitScript((val) => {
        try {
          if (window.sessionStorage.getItem("iuris_injected")) {
            if (!window.localStorage.getItem("currentUser")) {
              return;
            }
          } else {
            window.sessionStorage.setItem("iuris_injected", "true");
          }
          const data = JSON.parse(val);
          if (data && data.currentUser) {
            window.localStorage.setItem("currentUser", data.currentUser);
            if (data._grecaptcha) {
              window.localStorage.setItem("_grecaptcha", data._grecaptcha);
            }
          }
        } catch {}
      }, JSON.stringify({ currentUser: parsed.currentUser, _grecaptcha: parsed._grecaptcha }));
    }
  } catch {
    if (cookieName === "currentUser") {
      await context.addInitScript((val) => {
        if (window.sessionStorage.getItem("iuris_injected")) {
          if (!window.localStorage.getItem("currentUser")) {
            return;
          }
        } else {
          window.sessionStorage.setItem("iuris_injected", "true");
        }
        window.localStorage.setItem("currentUser", val);
      }, cookieValue);
    } else {
      await context.addCookies([{
        name: cookieName,
        value: cookieValue,
        domain: "sisfe.justiciasantafe.gov.ar",
        path: "/",
      }]);
    }
  }

  return context;
}

export async function withContext<T>(
  cookieName: string,
  cookieValue: string,
  fn: (context: BrowserContext) => Promise<T>,
): Promise<T> {
  clearIdleCloseTimer();
  await rotateBrowserIfNeeded();
  const browser = await getBrowser();
  activeContexts++;
  contextsSinceLaunch++;
  const context = await crearContextoAutenticadoDesdeBrowser(browser, cookieName, cookieValue);

  try {
    return await fn(context);
  } finally {
    await context.close().catch((error) => {
      log.warn({ err: error }, "No se pudo cerrar el contexto Playwright");
    });
    activeContexts = Math.max(0, activeContexts - 1);
    if (contextsSinceLaunch >= MAX_CONTEXTS_PER_BROWSER) {
      await rotateBrowserIfNeeded();
    }
    scheduleIdleClose();
  }
}

export async function closeBrowserPool(): Promise<void> {
  clearIdleCloseTimer();
  const browser = sharedBrowser;
  sharedBrowser = null;
  contextsSinceLaunch = 0;
  await browser?.close().catch((error) => {
    log.warn({ err: error }, "No se pudo cerrar el browser compartido");
  });
}
