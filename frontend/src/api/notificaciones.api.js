import api, { getAccessToken } from "./axios";

export async function getNotificacionesPendientes(token) {
  const config = token
    ? { headers: { Authorization: `Bearer ${token}` } }
    : undefined;

  const { data } = await api.get("/notificaciones/pendientes", config);
  return data;
}

export async function getNovedades({ limit = 50, offset = 0 } = {}) {
  const { data } = await api.get("/notificaciones/novedades", { params: { limit, offset } });
  return data;
}

export async function marcarNovedadesLeidas(movimientoIds) {
  if (!Array.isArray(movimientoIds) || movimientoIds.length === 0) {
    throw new Error("movimientoIds es requerido");
  }
  const { data } = await api.post("/notificaciones/novedades/marcar-leido", { movimientoIds });
  return data;
}

/** Crea tarea/evento desde una novedad SISFE y la marca leída en una sola operación. */
export async function agendarDesdeNovedad(payload) {
  const { data } = await api.post("/notificaciones/novedades/agendar", payload);
  return data;
}

export async function getPreferenciasCobranza() {
  const { data } = await api.get("/notificaciones/cobranza/preferencias");
  return data;
}

export async function updatePreferenciasCobranza(preferencias) {
  const { data } = await api.put("/notificaciones/cobranza/preferencias", preferencias);
  return data;
}

/**
 * Abre el canal SSE de notificaciones. Devuelve el EventSource para cerrarlo.
 * Pide un ticket efímero autenticado (no el access JWT) para la querystring.
 *
 * @param {((data: unknown) => void) | { onNovedades?: (data: unknown) => void; onSisfeSync?: (data: unknown) => void }} handlers
 * @returns {Promise<EventSource | null>}
 */
export async function abrirCanalNotificaciones(handlers) {
  const normalized = typeof handlers === "function"
    ? { onNovedades: handlers }
    : (handlers ?? {});

  if (!getAccessToken()) return null;

  let ticket;
  try {
    const { data } = await api.post("/notificaciones/sse/ticket");
    ticket = data?.data?.ticket;
  } catch {
    return null;
  }
  if (!ticket) return null;

  const url = `${api.defaults.baseURL}/notificaciones/sse/stream?token=${encodeURIComponent(ticket)}`;
  const source = new EventSource(url);

  const parse = (event) => {
    try {
      return JSON.parse(event.data);
    } catch {
      return null;
    }
  };

  source.addEventListener("novedades", (event) => {
    normalized.onNovedades?.(parse(event));
  });

  source.addEventListener("sisfe_sync", (event) => {
    normalized.onSisfeSync?.(parse(event));
  });

  return source;
}
