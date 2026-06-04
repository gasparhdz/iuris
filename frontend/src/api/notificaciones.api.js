import api from "./axios";

export async function getNotificacionesPendientes(token) {
  const config = token
    ? { headers: { Authorization: `Bearer ${token}` } }
    : undefined;

  const { data } = await api.get("/notificaciones/pendientes", config);
  return data;
}
