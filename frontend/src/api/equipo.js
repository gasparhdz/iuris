import api from "./axios";

export async function fetchEquipoUsuarios() {
  const response = await api.get("/equipo/usuarios");
  return response.data?.data ?? response.data ?? [];
}

export async function createEquipoUsuario(data) {
  const response = await api.post("/equipo/usuarios", data);
  return response.data?.data ?? response.data;
}

export async function updateEquipoUsuario(usuarioId, data) {
  const response = await api.put(`/equipo/usuarios/${usuarioId}`, data);
  return response.data?.data ?? response.data;
}

export async function toggleEquipoUsuario(usuarioId) {
  const response = await api.post(`/equipo/usuarios/${usuarioId}/toggle`);
  return response.data?.data ?? response.data;
}

export async function deleteEquipoUsuario(usuarioId) {
  const response = await api.delete(`/equipo/usuarios/${usuarioId}`);
  return response.data?.data ?? response.data;
}
