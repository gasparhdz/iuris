import api from "./axios";
import { fetchAllPages, unwrapPaged } from "./pagination";

function unwrapList(data) {
  const raw = data?.data?.items ?? data?.data ?? data;
  return Array.isArray(raw) ? raw : [];
}

export async function fetchTerceros(params = {}) {
  const { data } = await api.get("/terceros", { params });
  return unwrapPaged(data);
}

export async function fetchAllTerceros(baseParams = {}) {
  return fetchAllPages("/terceros", baseParams);
}

export async function createTercero(data) {
  const r = await api.post("/terceros", data);
  return r.data?.data ?? r.data;
}

export async function updateTercero(id, data) {
  const r = await api.put(`/terceros/${id}`, data);
  return r.data?.data ?? r.data;
}

export async function deleteTercero(id) {
  await api.delete(`/terceros/${id}`);
  return { success: true };
}

export async function fetchParticipantesCaso(casoId) {
  const r = await api.get(`/expedientes/${casoId}/participantes`);
  return r.data?.data ?? r.data;
}

export async function addParticipanteCaso(casoId, data) {
  // rolNombre/tercero son metadata de UI; no se mandan al backend.
  const { rolNombre: _rolNombre, tercero: _tercero, ...postData } = data;
  const r = await api.post(`/expedientes/${casoId}/participantes`, postData);
  return r.data?.data ?? r.data;
}

export async function updateParticipanteCaso(casoId, participanteId, data) {
  const { rolNombre: _rolNombre, tercero: _tercero, ...putData } = data;
  const r = await api.put(`/expedientes/${casoId}/participantes/${participanteId}`, putData);
  return r.data?.data ?? r.data;
}

export async function removeParticipanteCaso(casoId, participanteId) {
  await api.delete(`/expedientes/${casoId}/participantes/${participanteId}`);
  return { success: true };
}

export { unwrapList };
