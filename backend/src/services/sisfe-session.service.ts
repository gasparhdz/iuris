import { and, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { sisfeSessions } from "../db/schema.js";
import { decrypt, encrypt } from "./sisfe-crypto.service.js";
import { withContext } from "./browser-pool.js";
import { sesionExpirada } from "./sisfe-scraper.service.js";
import { chromium } from "playwright";
import { logger } from "../utils/logger.js";

const log = logger.child({ module: "SISFE-Session" });

export type SisfeSyncStatus = "idle" | "running" | "done" | "error";
export type SisfeSyncStats = {
  actualizados: number;
  movimientosNuevos: number;
  noEncontradosEnSisfe: number;
  pdfsNoDescargados: number;
};

export async function saveSession(
  usuarioId: number,
  estudioId: number,
  cookieName: string,
  cookieValue: string,
  sisfeMatricula?: string | null,
) {
  const encrypted = encrypt(cookieValue, { usuarioId, estudioId });
  const now = new Date();
  // Solo sobrescribimos la matrícula si esta corrida logró leerla; si vino vacía,
  // conservamos la previa para no perder el filtro de novedades.
  const matriculaSet = sisfeMatricula ? { sisfeMatricula } : {};
  const [row] = await db
    .insert(sisfeSessions)
    .values({
      usuarioId,
      estudioId,
      cookieName,
      sessionCookieEncriptada: encrypted,
      sisfeMatricula: sisfeMatricula ?? null,
      lastVerifiedAt: now,
      syncStatus: "idle",
      syncProgress: 0,
      syncMessage: null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: sisfeSessions.usuarioId,
      set: {
        estudioId,
        cookieName,
        sessionCookieEncriptada: encrypted,
        ...matriculaSet,
        lastVerifiedAt: now,
        syncStatus: "idle",
        syncProgress: 0,
        syncMessage: null,
        updatedAt: now,
      },
    })
    .returning();

  return row;
}

export async function getSession(usuarioId: number, estudioId?: number) {
  const conditions = estudioId !== undefined
    ? and(eq(sisfeSessions.usuarioId, usuarioId), eq(sisfeSessions.estudioId, estudioId))
    : eq(sisfeSessions.usuarioId, usuarioId);
  const [row] = await db.select().from(sisfeSessions).where(conditions).limit(1);
  if (!row) return null;

  const decrypted = decrypt(row.sessionCookieEncriptada, {
    usuarioId: row.usuarioId,
    estudioId: row.estudioId,
  });

  if (decrypted.needsReencrypt) {
    await db
      .update(sisfeSessions)
      .set({
        sessionCookieEncriptada: encrypt(decrypted.plaintext, {
          usuarioId: row.usuarioId,
          estudioId: row.estudioId,
        }),
        updatedAt: new Date(),
      })
      .where(eq(sisfeSessions.id, row.id));
  }

  return {
    ...row,
    cookieValue: decrypted.plaintext,
  };
}

export async function deleteSession(usuarioId: number) {
  await db.delete(sisfeSessions).where(eq(sisfeSessions.usuarioId, usuarioId));
}

export function extractJwtFromSession(cookieValue: string): string | null {
  try {
    const parsed = JSON.parse(cookieValue) as { currentUser?: string };
    if (!parsed.currentUser) return null;
    const currentUser = JSON.parse(parsed.currentUser) as { token?: string };
    return currentUser.token?.trim() || null;
  } catch {
    return null;
  }
}

export async function updateSyncStatus(
  usuarioId: number,
  status: SisfeSyncStatus,
  progress: number,
  message?: string,
  stats?: SisfeSyncStats,
) {
  await db
    .update(sisfeSessions)
    .set({
      syncStatus: status,
      syncProgress: progress,
      syncMessage: message ?? null,
      syncStats: stats ?? null,
      updatedAt: new Date(),
    })
    .where(eq(sisfeSessions.usuarioId, usuarioId));
}

export async function saveSessionLastSync(usuarioId: number) {
  await db
    .update(sisfeSessions)
    .set({ lastSyncAt: new Date(), updatedAt: new Date() })
    .where(eq(sisfeSessions.usuarioId, usuarioId));
}

export async function getStatus(usuarioId: number) {
  const [row] = await db.select().from(sisfeSessions).where(eq(sisfeSessions.usuarioId, usuarioId)).limit(1);
  if (!row) {
    return {
      conectado: false,
      lastSyncAt: null,
      syncStatus: "idle",
      syncProgress: 0,
      syncMessage: null,
      syncStats: null,
    };
  }

  return {
    conectado: true,
    lastSyncAt: row.lastSyncAt,
    syncStatus: row.syncStatus,
    syncProgress: row.syncProgress,
    syncMessage: row.syncMessage,
    syncStats: row.syncStats,
  };
}

export async function isSyncRunning(usuarioId: number) {
  const [row] = await db
    .select({ id: sisfeSessions.id })
    .from(sisfeSessions)
    .where(and(eq(sisfeSessions.usuarioId, usuarioId), eq(sisfeSessions.syncStatus, "running")))
    .limit(1);

  return Boolean(row);
}

export async function verifySesionActiva(cookieName: string, cookieValue: string): Promise<boolean> {
  return withContext(cookieName, cookieValue, async (context) => {
    const page = await context.newPage();
    await page.goto("https://sisfe.justiciasantafe.gov.ar/buscar-expediente", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(1500);
    return !sesionExpirada(page.url());
  });
}

export async function iniciarLoginInteractivo(usuarioId: number, estudioId: number): Promise<void> {
  const browser = await chromium.launch({
    headless: false,
    args: ["--start-maximized"],
  });

  const context = await browser.newContext({
    viewport: null, // permite maximizar correctamente
  });

  const page = await context.newPage();

  try {
    await page.goto("https://sisfe.justiciasantafe.gov.ar/login-matriculado");

    // Esperar a que la URL cambie a buscar-expediente (login exitoso) o que cierren el navegador
    await Promise.race([
      page.waitForURL("**/buscar-expediente", { timeout: 180000 }), // 3 minutos
      new Promise((_, reject) => {
        browser.on("disconnected", () => reject(new Error("BROWSER_CLOSED")));
      })
    ]);

    // Esperar un momento para asegurar que las cookies estén completamente escritas en el contexto
    await page.waitForTimeout(2000);

    // Leer la matrícula del usuario de la barra superior ("LIII043 - MEOTTO, NADIR").
    // Tomamos solo el código anterior al " - ". Si no se puede leer, queda null (no rompe el login).
    const matricula = await page
      .locator("label.text-matriculado")
      .first()
      .textContent({ timeout: 5000 })
      .then((texto) => {
        const codigo = (texto ?? "").trim().split(/\s*-\s*/)[0]?.trim();
        return codigo || null;
      })
      .catch(() => null);
    if (matricula) {
      log.info({ matricula }, "[SISFE Login] Matricula del usuario capturada");
    } else {
      log.warn("[SISFE Login] No se pudo leer la matricula de la barra superior");
    }

    // Extraer las cookies del contexto autenticado
    const cookies = await context.cookies();

    // Extraer localStorage
    const localStorageData = (await page.evaluate(() => {
      const data: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) data[key] = localStorage.getItem(key) || "";
      }
      return data;
    }).catch(() => ({}))) as Record<string, string>;

    // Extraer solo nombres de claves de sessionStorage para trazabilidad sin valores sensibles
    const sessionStorageKeys = (await page.evaluate(() => {
      const keys: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key) keys.push(key);
      }
      return keys;
    }).catch(() => [])) as string[];

    log.info({
      cookiesCount: cookies.length,
      cookieNames: cookies.map((cookie) => cookie.name),
      cookieDomains: [...new Set(cookies.map((cookie) => cookie.domain))],
      localStorageKeys: Object.keys(localStorageData),
      sessionStorageKeys,
      currentUserFound: Boolean(localStorageData.currentUser),
    }, "[SISFE Login] Sesion capturada");

    // Guardar TODAS las cookies capturadas (incluyendo de justiciasantafe.gov.ar y www.google.com/recaptcha)
    // para que reCAPTCHA Enterprise reconozca la sesión del usuario.
    
    // 1. Intentar buscar el token de Angular en localStorage primero (Estrategia Principal)
    if (localStorageData.currentUser) {
      log.info("[SISFE Login] Token currentUser encontrado en localStorage");
      const payload = {
        currentUser: localStorageData.currentUser,
        _grecaptcha: localStorageData._grecaptcha || "",
        cookies: cookies
      };
      await saveSession(usuarioId, estudioId, "currentUser", JSON.stringify(payload), matricula);
      return;
    }

    // 2. Fallback: buscar cookie de JSESSIONID tradicional
    let sessionCookie = cookies.find(c => c.name.toUpperCase() === "JSESSIONID");

    // 3. Fallback: si no se encuentra JSESSIONID, usar cualquier otra cookie de dominio que tengamos
    if (!sessionCookie && cookies.length > 0) {
      sessionCookie = cookies[0];
    }

    if (!sessionCookie) {
      throw new Error("JSESSIONID_NOT_FOUND");
    }

    const payload = {
      cookies: cookies
    };
    await saveSession(usuarioId, estudioId, sessionCookie.name, JSON.stringify(payload), matricula);
  } finally {
    await browser.close();
  }
}
