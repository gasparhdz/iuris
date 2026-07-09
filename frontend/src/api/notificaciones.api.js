import api, { getAccessToken } from "./axios";

export async function getNotificacionesPendientes(token) {
  const config = token
    ? { headers: { Authorization: `Bearer ${token}` } }
    : undefined;

  const { data } = await api.get("/notificaciones/pendientes", config);
  return data;
}

export async function getNovedades() {
  const { data } = await api.get("/notificaciones/novedades");
  return data;
}

export async function marcarNovedadesLeidas(movimientoIds) {
  const body = movimientoIds && movimientoIds.length > 0 ? { movimientoIds } : {};
  const { data } = await api.post("/notificaciones/novedades/marcar-leido", body);
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
 * El token viaja por query param porque EventSource no admite headers.
 *
 * @param {((data: unknown) => void) | { onNovedades?: (data: unknown) => void; onSisfeSync?: (data: unknown) => void }} handlers
 */
export function abrirCanalNotificaciones(handlers) {
  const normalized = typeof handlers === "function"
    ? { onNovedades: handlers }
    : (handlers ?? {});

  // EventSource no admite headers, así que el token viaja por query param. Se toma de memoria
  // (getAccessToken) porque ya no se persiste en localStorage.
  const token = getAccessToken();
  if (!token) return null;

  const url = `${api.defaults.baseURL}/notificaciones/sse/stream?token=${encodeURIComponent(token)}`;
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
