import api from "./axios";

function normalizeList(payload) {
  const raw = payload?.data?.items ?? payload?.data ?? payload?.items ?? payload;
  return Array.isArray(raw) ? raw : [];
}

function unwrap(response) {
  return response.data?.data ?? response.data;
}

// --- Estudios ---

export async function fetchAdminEstudios() {
  const response = await api.get("/admin/estudios");
  return normalizeList(response.data);
}

export async function fetchAdminEstudio(id) {
  const response = await api.get(`/admin/estudios/${id}`);
  return unwrap(response);
}

export async function createAdminEstudio(data) {
  const response = await api.post("/admin/estudios", data);
  return unwrap(response);
}

export async function updateAdminEstudio(id, data) {
  const response = await api.put(`/admin/estudios/${id}`, data);
  return unwrap(response);
}

export async function toggleAdminEstudio(id) {
  const response = await api.post(`/admin/estudios/${id}/toggle`);
  return unwrap(response);
}

// --- Usuarios por estudio ---

export async function fetchAdminUsuariosEstudio(estudioId) {
  const response = await api.get(`/admin/estudios/${estudioId}/usuarios`);
  return unwrap(response);
}

export async function createAdminUsuarioEstudio(estudioId, data) {
  const response = await api.post(`/admin/estudios/${estudioId}/usuarios`, data);
  return unwrap(response);
}

export async function updateAdminUsuarioEstudio(estudioId, usuarioId, data) {
  const response = await api.put(`/admin/estudios/${estudioId}/usuarios/${usuarioId}`, data);
  return unwrap(response);
}

export async function toggleAdminUsuarioEstudio(estudioId, usuarioId) {
  const response = await api.post(`/admin/estudios/${estudioId}/usuarios/${usuarioId}/toggle`);
  return unwrap(response);
}

export async function deleteAdminUsuarioEstudio(estudioId, usuarioId) {
  const response = await api.delete(`/admin/estudios/${estudioId}/usuarios/${usuarioId}`);
  return unwrap(response);
}

// --- Roles y permisos ---

export async function fetchAdminRoles() {
  const response = await api.get("/admin/roles");
  return unwrap(response);
}

export async function fetchAdminRolConPermisos(id) {
  const response = await api.get(`/admin/roles/${id}`);
  return unwrap(response);
}

export async function createAdminRol(data) {
  const response = await api.post("/admin/roles", data);
  return unwrap(response);
}

export async function updateAdminRol(id, data) {
  const response = await api.put(`/admin/roles/${id}`, data);
  return unwrap(response);
}

export async function updateAdminPermisosRol(id, permisos) {
  const response = await api.put(`/admin/roles/${id}/permisos`, { permisos });
  return unwrap(response);
}

export async function toggleAdminRol(id) {
  const response = await api.post(`/admin/roles/${id}/toggle`);
  return unwrap(response);
}

export async function deleteAdminRol(id) {
  const response = await api.delete(`/admin/roles/${id}`);
  return unwrap(response);
}

// --- Planes de suscripción ---

export async function fetchAdminPlanesSuscripcion() {
  const response = await api.get("/admin/planes-suscripcion");
  return unwrap(response);
}

export async function createAdminPlanSuscripcion(data) {
  const response = await api.post("/admin/planes-suscripcion", data);
  return unwrap(response);
}

export async function updateAdminPlanSuscripcion(id, data) {
  const response = await api.put(`/admin/planes-suscripcion/${id}`, data);
  return unwrap(response);
}

export async function toggleAdminPlanSuscripcion(id) {
  const response = await api.post(`/admin/planes-suscripcion/${id}/toggle`);
  return unwrap(response);
}

// --- Logs del sistema ---

export async function fetchSystemErrorLogs(params = {}) {
  const { data } = await api.get("/admin/system-logs", { params });
  return data?.data ?? { items: [], meta: { total: 0, page: 1, limit: 50 } };
}
