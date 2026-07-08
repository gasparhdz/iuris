import { SisfeError, normalizarCuj } from "./sisfe-scraper.service.js";
import { logger } from "../utils/logger.js";

const log = logger.child({ module: "SISFE-API" });

const SISFE_BASE_URL = "https://sisfe.justiciasantafe.gov.ar";
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_NETWORK_RETRIES = 2;

export type SisfePaginatedResponse<T> = {
  totalElements: number | null;
  lista: T[];
};

export type SisfeExpedienteListItem = {
  id: number;
  expediente: string;
  expCaratula: string;
  expFechaInicio: string;
  fechaActualizacion: string;
  radicacionActual: string;
  expVisible: string;
  expDigital: number | null;
  expUbicacion: string;
};

export type SisfeExpedienteDetalle = {
  expCaratula: string;
  cuijSufijo: string;
  radicado: string;
  localidad: string;
  fechaIngresoMEU: string;
  expUbicacion: string;
  ultimaActualizacionDelExpediente: string;
  expDigital: number | null;
};

export type SisfeNovedadItem = {
  id: number;
  tabla: string;
  fecha: string;
  novedad: string;
  observacion: string;
  adjunto1: string;
  adjunto2: string;
  adjunto3: string;
  tipoActuacion: number | null;
  actuacionTipoFirma: number | null;
};

export type SisfeApiClient = {
  findByFilter(params: { diasNovedades: number; page: number; size: number }): Promise<SisfePaginatedResponse<SisfeExpedienteListItem>>;
  findByCuij(cuij: string): Promise<SisfeExpedienteListItem | null>;
  findById(idExpediente: number): Promise<SisfeExpedienteDetalle>;
  findNovedadesById(idExpediente: number, params: { page: number; size: number }): Promise<SisfePaginatedResponse<SisfeNovedadItem>>;
  fetchAllByFilter(diasNovedades: number, size?: number): Promise<SisfeExpedienteListItem[]>;
  fetchAllNovedadesById(idExpediente: number, size?: number): Promise<SisfeNovedadItem[]>;
};

function buildUrl(path: string, params: Record<string, string | number>): string {
  const url = new URL(path, SISFE_BASE_URL);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function requestJson<T>(token: string, url: string, label: string): Promise<T> {
  let ultimoError: unknown;

  for (let intento = 1; intento <= MAX_NETWORK_RETRIES; intento++) {
    try {
      const response = await fetchWithTimeout(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      }, REQUEST_TIMEOUT_MS);

      if (response.status === 401 || response.status === 403) {
        throw new SisfeError("SESION_EXPIRADA", "Sesion SISFE expirada.", false);
      }

      if (!response.ok) {
        throw new SisfeError(
          "PORTAL_CAIDO",
          `SISFE respondio ${response.status} en ${label}.`,
          response.status >= 500,
        );
      }

      return await response.json() as T;
    } catch (error) {
      ultimoError = error;
      if (error instanceof SisfeError && !error.retryable) {
        throw error;
      }

      const esRed = error instanceof Error && (
        error.name === "AbortError"
        || error.message.includes("fetch failed")
        || error.message.includes("network")
      );

      if (!esRed || intento >= MAX_NETWORK_RETRIES) {
        if (error instanceof SisfeError) throw error;
        throw new SisfeError("PORTAL_CAIDO", `Error de red al consultar SISFE (${label}).`, true, error);
      }

      log.warn({ err: error, intento, label }, "[SISFE-API] Reintentando request");
      await new Promise((resolve) => setTimeout(resolve, 1000 * intento));
    }
  }

  throw ultimoError;
}

// Tope de seguridad: SISFE puede ignorar `page`/`size` (se observó que devuelve más items
// que `size` en una sola respuesta). Sin estos guardas, la paginación entra en loop infinito.
const MAX_PAGINAS = 50;

export async function fetchAllPages<T>(
  fetchPage: (page: number, size: number) => Promise<SisfePaginatedResponse<T>>,
  size = 25,
): Promise<T[]> {
  const all: T[] = [];
  let page = 1;
  let firmaPaginaAnterior: string | null = null;

  while (page <= MAX_PAGINAS) {
    const response = await fetchPage(page, size);
    const lista = response.lista ?? [];

    // Si el servidor ignora `page` y devuelve siempre lo mismo, cortamos al detectar repetición.
    const firmaPagina = lista.length > 0 ? JSON.stringify(lista[0]) : null;
    if (firmaPagina !== null && firmaPagina === firmaPaginaAnterior) break;
    firmaPaginaAnterior = firmaPagina;

    all.push(...lista);
    // != en vez de <: si devuelve MÁS que `size`, el servidor ignoró la paginación
    // y ya nos dio todo en una sola respuesta.
    if (lista.length !== size) break;
    page++;
  }

  return all;
}

export function createSisfeApiClient(token: string): SisfeApiClient {
  return {
    // Reservado para optimización futura: pre-filtro por feed de novedades cuando el volumen de
    // expedientes lo justifique (miles). Hoy el sync enumera todos los expedientes de Iuris directamente.
    findByFilter({ diasNovedades, page, size }) {
      const url = buildUrl("/iol/expedientes/findByFilter", {
        page,
        size,
        diasNovedades,
      });
      return requestJson<SisfePaginatedResponse<SisfeExpedienteListItem>>(token, url, "findByFilter");
    },

    async findByCuij(cuij) {
      const url = buildUrl("/iol/expedientes/findByFilter", {
        page: 1,
        size: 25,
        cuij,
      });
      const response = await requestJson<SisfePaginatedResponse<SisfeExpedienteListItem>>(token, url, "findByFilter(cuij)");
      const cuijNorm = normalizarCuj(cuij);
      return response.lista.find((exp) => normalizarCuj(exp.expediente) === cuijNorm) ?? null;
    },

    findById(idExpediente) {
      const url = buildUrl("/iol/expedientes/findById", { idExpediente });
      return requestJson<SisfeExpedienteDetalle>(token, url, "findById");
    },

    findNovedadesById(idExpediente, { page, size }) {
      const url = buildUrl("/iol/expedientes/findNovedadesById", {
        page,
        size,
        idExpediente,
      });
      return requestJson<SisfePaginatedResponse<SisfeNovedadItem>>(token, url, "findNovedadesById");
    },

    // Reservado para optimización futura: pre-filtro por feed de novedades cuando el volumen de
    // expedientes lo justifique (miles). Hoy el sync enumera todos los expedientes de Iuris directamente.
    fetchAllByFilter(diasNovedades, size = 25) {
      return fetchAllPages(
        (page, pageSize) => this.findByFilter({ diasNovedades, page, size: pageSize }),
        size,
      );
    },

    fetchAllNovedadesById(idExpediente, size = 25) {
      return fetchAllPages(
        (page, pageSize) => this.findNovedadesById(idExpediente, { page, size: pageSize }),
        size,
      );
    },
  };
}
