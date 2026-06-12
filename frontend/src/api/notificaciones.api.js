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

/**
 * Abre el canal SSE de notificaciones. Devuelve el EventSource para cerrarlo.
 * El token viaja por query param porque EventSource no admite headers.
 */
export function abrirCanalNotificaciones(onNovedades) {
  // EventSource no admite headers, así que el token viaja por query param. Se toma de memoria
  // (getAccessToken) porque ya no se persiste en localStorage.
  const token = getAccessToken();
  if (!token) return null;

  const url = `${api.defaults.baseURL}/notificaciones/sse/stream?token=${encodeURIComponent(token)}`;
  const source = new EventSource(url);
  source.addEventListener("novedades", (event) => {
    try {
      onNovedades(JSON.parse(event.data));
    } catch {
      onNovedades(null);
    }
  });
  return source;
}
