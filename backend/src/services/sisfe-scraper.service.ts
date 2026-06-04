import { type Locator, type Page } from "playwright";
import fs from "node:fs";
import { SEL } from "./sisfe-selectors.js";
import { logger } from "../utils/logger.js";

const log = logger.child({ module: "SISFE-Scraper" });

const SISFE_BASE_URL = "https://sisfe.justiciasantafe.gov.ar";

export type SisfeErrorCode = "SESION_EXPIRADA" | "PORTAL_CAIDO" | "TIMEOUT_DESCARGA" | "DOM_CHANGED" | "RECAPTCHA_BLOQUEO";

export class SisfeError extends Error {
  constructor(
    public readonly code: SisfeErrorCode,
    message: string,
    public readonly retryable: boolean,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "SisfeError";
  }
}

export async function conReintentos<T>(
  fn: () => Promise<T>,
  label: string,
  maxIntentos = 3,
): Promise<T> {
  let ultimoError: unknown;

  for (let intento = 1; intento <= maxIntentos; intento++) {
    try {
      return await fn();
    } catch (error) {
      ultimoError = error;
      if (error instanceof SisfeError && !error.retryable) {
        throw error;
      }
      if (intento >= maxIntentos || (error instanceof SisfeError && !error.retryable)) {
        break;
      }

      const baseDelay = 1000 * 2 ** (intento - 1);
      const jitter = Math.floor(Math.random() * 250);
      log.warn({ err: error, intento, maxIntentos, label }, "[Scraper] Reintentando operacion SISFE");
      await new Promise((resolve) => setTimeout(resolve, baseDelay + jitter));
    }
  }

  throw ultimoError;
}

function safeUrl(value: string) {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return "[url no disponible]";
  }
}

function esTimeoutPlaywright(error: unknown): boolean {
  return error instanceof Error && error.name === "TimeoutError";
}

function normalizarTexto(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function buscarIndiceColumna(headers: string[], aliases: string[]): number {
  const normalizedAliases = aliases.map(normalizarTexto);
  return headers.findIndex((header) => {
    const normalizedHeader = normalizarTexto(header);
    return normalizedAliases.some((alias) => normalizedHeader.includes(alias));
  });
}

type ColumnasMovimientos = {
  fecha: number;
  novedad: number;
  observacion: number;
};

async function obtenerColumnasMovimientos(page: Page): Promise<ColumnasMovimientos> {
  const headers = await page.locator(SEL.detail.gridHeaders).allInnerTexts();
  if (headers.length === 0) {
    throw new SisfeError("DOM_CHANGED", "No se encontraron encabezados en la grilla de movimientos SISFE.", false);
  }

  const columnas = {
    fecha: buscarIndiceColumna(headers, ["fecha"]),
    novedad: buscarIndiceColumna(headers, ["novedad"]),
    observacion: buscarIndiceColumna(headers, ["observacion", "observaciones"]),
  };

  const faltantes = Object.entries(columnas)
    .filter(([, indice]) => indice < 0)
    .map(([nombre]) => nombre);
  if (faltantes.length > 0) {
    throw new SisfeError("DOM_CHANGED", `Faltan columnas esperadas en la grilla SISFE: ${faltantes.join(", ")}.`, false);
  }

  return columnas;
}

async function textoCelda(row: Locator, indice: number): Promise<string> {
  return (await row.locator(SEL.detail.gridCells).nth(indice).innerText().catch(() => "")).trim();
}

async function firmaPaginaMovimientos(page: Page): Promise<string> {
  const paginaActiva = (await page.locator(SEL.detail.paginationActive).first().innerText().catch(() => "")).trim();
  const primeraFila = (await page.locator(SEL.detail.gridRows).first().innerText().catch(() => "")).trim();
  return normalizarTexto(`${paginaActiva}|${primeraFila || page.url()}`);
}

async function gotoSisfe(page: Page, url: string): Promise<void> {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded" });
  } catch (error) {
    if (esTimeoutPlaywright(error)) {
      throw new SisfeError("PORTAL_CAIDO", "El portal SISFE no respondio a tiempo.", true, error);
    }
    throw error;
  }
}

async function esperarDescarga(page: Page) {
  try {
    return await page.waitForEvent("download", { timeout: 30000 });
  } catch (error) {
    if (esTimeoutPlaywright(error)) {
      throw new SisfeError("TIMEOUT_DESCARGA", "La descarga del expediente digital no respondio a tiempo.", true, error);
    }
    throw error;
  }
}

export interface ResultadoBusquedaSisfe {
  sisfeId: string;
  nroCujEncontrado: string;
  caratula: string;
  fechaInicio: string;
  ultimaActualizacion: string;
  radicacion: string;
}

export interface MovimientoSisfe {
  fecha: string;
  tipo: string;
  novedad: string;
  observacion: string;
  sisfeMovId: string;
  documento?: {
    buffer: Buffer;
    filename: string;
    mimeType: string;
  } | null;
  documentos?: Array<{
    buffer: Buffer;
    filename: string;
    mimeType: string;
  }>;
}

export interface ExpedienteDetalleSisfe {
  caratula: string;
  radicadoEn: string;
  localidad: string;
  fechaIngreso: string;
  ubicacionActual: string;
  soloDigital: boolean;
  ultimaActualizacion: string;
  movimientos: MovimientoSisfe[];
  expedienteDigital?: {
    buffer: Buffer;
    filename: string;
    mimeType: string;
  } | null;
  // true si el botón de descarga existía pero la descarga del PDF consolidado falló
  // (timeout, bloqueo de reCAPTCHA, etc.). Los movimientos sí se extraen igual.
  expedienteDigitalFallido?: boolean;
}

export function parseFechaHoraSISFE(fechaHoraStr: string): Date | null {
  const match = fechaHoraStr.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?$/);
  if (!match) return null;

  const [, dia, mes, anio, hora = "0", minuto = "0"] = match;
  const parsed = new Date(Number(anio), Number(mes) - 1, Number(dia), Number(hora), Number(minuto), 0, 0);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function parseUbicacionActual(ubicacionStr: string): { ubicacion: string; fechaDesde: Date | null } {
  const [ubicacion, fechaDesdeStr] = ubicacionStr.split(/\s+desde el\s+/i);

  return {
    ubicacion: (ubicacion ?? "").trim(),
    fechaDesde: fechaDesdeStr ? parseFechaHoraSISFE(fechaDesdeStr.trim()) : null,
  };
}


export function sesionExpirada(url: string): boolean {
  const lowercaseUrl = url.toLowerCase();
  return lowercaseUrl.includes("/login") || lowercaseUrl.includes("login-matriculado");
}

export function attachDiagnostics(page: Page): void {
  page.on("pageerror", () => {
    log.error("[Browser Error]: error de pagina emitido por SISFE");
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      log.error("[Browser Console Error]: mensaje de consola omitido por seguridad");
    } else if (msg.type() === "warning") {
      log.warn("[Browser Console Warning]: mensaje de consola omitido por seguridad");
    }
  });

  page.on("requestfailed", (req) => {
    log.error(`[Browser Network Error]: Request to ${safeUrl(req.url())} failed: ${req.failure()?.errorText}`);
  });
  page.on("response", (res) => {
    if (res.status() >= 400) {
      log.error(`[Browser Network Error]: Response from ${safeUrl(res.url())} returned status ${res.status()}`);
    }
  });
}

export async function buscarExpedientePorCuij(page: Page, cuij: string): Promise<ResultadoBusquedaSisfe | null> {
  await gotoSisfe(page, `${SISFE_BASE_URL}/buscar-expediente`);
  const waitSelector = page.waitForSelector(SEL.search.readyButton, { timeout: 15000 }).catch(() => null);
  const waitRedirect = page.waitForURL(/\/login/, { timeout: 15000 }).catch(() => null);
  const ready = await Promise.race([waitSelector, waitRedirect]);
  if (sesionExpirada(page.url())) throw new SisfeError("SESION_EXPIRADA", "Sesion SISFE expirada.", false);
  if (!ready) throw new SisfeError("DOM_CHANGED", "No se encontro el formulario de busqueda SISFE.", false);

  const input = page.locator(SEL.search.cuijInput).first();
  await input.click();
  await input.fill("");
  await input.fill(cuij).catch(async () => {
    await input.click();
    await page.keyboard.type(cuij);
  });
  await page.click(SEL.search.readyButton);

  await page.waitForSelector(SEL.search.feedbackOrResult, { timeout: 15000 }).catch(() => {});
  if (sesionExpirada(page.url())) throw new SisfeError("SESION_EXPIRADA", "Sesion SISFE expirada.", false);

  const mensajeOk = await page.$(SEL.search.okMessage);
  if (!mensajeOk) return null;

  const primeraFila = page.locator(SEL.search.resultRows).first();
  const primerLink = await primeraFila.locator(SEL.search.resultFirstLink).elementHandle();
  if (!primerLink) return null;

  const href = await primerLink.getAttribute("href") || "";
  const sisfeId = href.split("/").pop();
  if (!sisfeId) return null;

  const nroCujEncontrado = (await primerLink.textContent() || "").trim();
  const celdas = primeraFila.locator(SEL.search.resultCells);
  const caratula = (await celdas.nth(2).innerText().catch(() => "")).trim();
  const fechaInicio = (await celdas.nth(3).innerText().catch(() => "")).trim();
  const ultimaActualizacion = (await celdas.nth(4).innerText().catch(() => "")).trim();
  const radicacion = (await celdas.nth(5).innerText().catch(() => "")).trim();

  return { sisfeId, nroCujEncontrado, caratula, fechaInicio, ultimaActualizacion, radicacion };
}

export async function fetchDetalleExpediente(page: Page, sisfeId: string, nroCuj: string): Promise<ExpedienteDetalleSisfe> {
  await gotoSisfe(page, `${SISFE_BASE_URL}/detalle-expediente/${sisfeId}`);
  const waitSelector = page.waitForSelector(SEL.detail.header, { timeout: 15000 }).catch(() => null);
  const waitRedirect = page.waitForURL(/\/login/, { timeout: 15000 }).catch(() => null);
  const ready = await Promise.race([waitSelector, waitRedirect]);
  if (sesionExpirada(page.url())) throw new SisfeError("SESION_EXPIRADA", "Sesion SISFE expirada.", false);
  if (!ready) throw new SisfeError("DOM_CHANGED", "No se encontro el encabezado del detalle SISFE.", false);

  // Esperar 3 segundos para que los scripts en segundo plano (reCAPTCHA, etc.) se inicialicen por completo
  await page.waitForTimeout(3000);

  const caratula = (await page.locator(SEL.detail.title).first().innerText().catch(() => "")).trim();
  const radicadoEn = await extraerCampoDetalle(page, "Radicado en:");
  const localidad = await extraerCampoDetalle(page, "Localidad:");
  const fechaIngreso = await extraerCampoDetalle(page, "Fecha de ingreso en MEU:");
  const soloDigital = await page.evaluate(() => {
    const text = document.body.innerText
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase();

    return text.includes("EXPEDIENTE DE TRAMITACION SOLO DIGITAL") || text.includes("TRAMITACION SOLO DIGITAL");
  }).catch(() => false);
  const ubicacionActual = await extraerCampoDetalle(page, "Ubicacion actual:");
  const ultimaActualizacion = await extraerCampoDetalle(page, "Ultima actualizacion del expte al:");

  // --- Descargar expediente digital completo de forma prioritaria ---
  let expedienteDigital = null;
  let expedienteDigitalFallido = false;
  const btnDescargarExpediente = page.locator(SEL.detail.downloadButton).first();
  if (await btnDescargarExpediente.count().catch(() => 0) > 0) {
    try {
      log.info("[Scraper] Boton de descarga de expediente digital detectado.");
      await btnDescargarExpediente.scrollIntoViewIfNeeded().catch(() => {});
      await btnDescargarExpediente.hover().catch(() => {});
      await page.waitForTimeout(500 + Math.random() * 500); // Demora humana

      const downloadPromise = esperarDescarga(page);
      await btnDescargarExpediente.click().catch(async () => {
        await btnDescargarExpediente.click({ force: true });
      });

      const download = await downloadPromise;
      const filenameOriginal = download.suggestedFilename();
        const [d, m, y] = ultimaActualizacion.split("/");
        const fechaFormateada = (d && m && y) ? `${d}${m}${y}` : new Date().toLocaleDateString('es-AR').replace(/\//g, "");
        
        const lastDot = filenameOriginal.lastIndexOf(".");
        const base = lastDot !== -1 ? filenameOriginal.substring(0, lastDot) : filenameOriginal;
        const ext = lastDot !== -1 ? filenameOriginal.substring(lastDot + 1) : "pdf";
        const filename = `${base}_${fechaFormateada}.${ext}`;

        const path = await download.path();
        if (path) {
          const buffer = await fs.promises.readFile(path);
          const isPdf = buffer.slice(0, 5).toString("ascii") === "%PDF-";
          if (!isPdf) {
            log.warn(`[Scraper] El expediente digital descargado no es un PDF válido (posible bloqueo por reCAPTCHA). Omitiendo.`);
            await fs.promises.unlink(path).catch(() => {});
            throw new SisfeError("RECAPTCHA_BLOQUEO", "SISFE bloqueo la descarga del PDF con reCAPTCHA.", false);
          } else {
            expedienteDigital = {
              buffer,
              filename,
              mimeType: "application/pdf"
            };
            await fs.promises.unlink(path).catch(() => {});
            log.info("[Scraper] Expediente digital completo descargado correctamente.");
          }
      }
    } catch (err) {
      expedienteDigitalFallido = true;
      log.error({ err }, "[Scraper] Error al descargar expediente digital completo");
    }
  }

  const movimientos: MovimientoSisfe[] = [];
  const paginasVisitadas = new Set<string>();
  await page.waitForSelector(SEL.detail.gridTable, { timeout: 15000 }).catch(() => {
    throw new SisfeError("DOM_CHANGED", "No se encontro la grilla de movimientos SISFE.", false);
  });
  const columnas = await obtenerColumnasMovimientos(page);

  while (true) {
    await page.waitForSelector(SEL.detail.gridRows, { timeout: 15000 }).catch(() => {});
    const pageKey = await firmaPaginaMovimientos(page);
    if (paginasVisitadas.has(pageKey)) break;
    paginasVisitadas.add(pageKey);

    const totalFilas = await page.locator(SEL.detail.gridRows).count().catch(() => 0);
    log.debug(`[Scraper] Total de filas encontradas en la grilla: ${totalFilas}`);

    const totalFilasAProcesar = totalFilas;
    log.debug(`[Scraper] Procesando ${totalFilasAProcesar} filas en esta pagina.`);

    for (let idx = 0; idx < totalFilasAProcesar; idx++) {
      if (page.isClosed()) {
        throw new Error("El navegador o la página fue cerrada durante la sincronización.");
      }

      const fila = page.locator(SEL.detail.gridRows).nth(idx);
      
      const fecha = await textoCelda(fila, columnas.fecha);
      const novedad = await textoCelda(fila, columnas.novedad);
      const observacion = await textoCelda(fila, columnas.observacion);
      let tipoEstandar = "Trámite";
      if (await fila.locator(SEL.detail.iconSentence).count().catch(() => 0) > 0) {
        tipoEstandar = "Resolución/Sentencia";
      } else if (await fila.locator(SEL.detail.iconNotification).count().catch(() => 0) > 0) {
        tipoEstandar = "Notificación con firma digital";
      } else if (await fila.locator(SEL.detail.iconDocument).count().catch(() => 0) > 0) {
        tipoEstandar = "Escrito";
      } else if (await fila.locator(SEL.detail.iconShield).count().catch(() => 0) > 0) {
        tipoEstandar = "Trámite";
      }

      log.debug(`[Scraper] Procesando fila SISFE ${idx + 1}.`);

      if (!fecha || !novedad) {
        if (page.isClosed()) {
          throw new Error("El navegador o la página fue cerrada durante la sincronización.");
        }
        log.debug(`[Scraper] Fila SISFE ${idx + 1} omitida por campos requeridos faltantes.`);
        continue;
      }
      const sisfeMovId = `${normalizarCuj(nroCuj)}_${fecha}_${novedad}`.toLowerCase().replace(/[\s/-]/g, "_").substring(0, 490);
      movimientos.push({ 
        fecha, 
        tipo: tipoEstandar,
        novedad, 
        observacion, 
        sisfeMovId, 
        documento: null,
        documentos: []
      });
    }

    const nextItem = page.locator(SEL.detail.paginationNextItem).first();
    if (await nextItem.count().catch(() => 0) === 0) break;
    const isDisabled = await nextItem.evaluate((el) => el.classList.contains("disabled")).catch(() => true);
    if (isDisabled) break;
    const nextLink = nextItem.locator("a").first();
    await nextLink.click();
    await page.waitForTimeout(1500);
  }

  return { caratula, radicadoEn, localidad, fechaIngreso, ubicacionActual, soloDigital, ultimaActualizacion, movimientos, expedienteDigital, expedienteDigitalFallido };
}

export async function extraerCampoDetalle(page: Page, labelText: string, optional = false): Promise<string> {
  const rows = page.locator(SEL.detail.dataRows);
  if (await rows.count().catch(() => 0) === 0) {
    if (optional) return "";
    throw new SisfeError("DOM_CHANGED", "No se encontraron campos de detalle SISFE.", false);
  }

  const labelNormalizado = normalizarTexto(labelText);
  const result = await rows.evaluateAll((items, label) => {
    const normalize = (value: string) => value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

    for (const item of items) {
      const labelNode = item.querySelector("span");
      const labelValue = normalize(labelNode?.textContent ?? "");
      if (!labelValue.includes(label)) continue;

      return {
        found: true,
        value: (item.textContent ?? "").replace(labelNode?.textContent ?? "", "").trim(),
      };
    }

    return { found: false, value: "" };
  }, labelNormalizado);

  if (!result.found && !optional) {
    throw new SisfeError("DOM_CHANGED", `No se encontro el campo de detalle SISFE: ${labelText}`, false);
  }

  return result.value;
}

export function normalizarCuj(cuj: string): string {
  return cuj.trim().split("(")[0]?.trim().replace(/\s/g, "").toLowerCase() ?? "";
}
