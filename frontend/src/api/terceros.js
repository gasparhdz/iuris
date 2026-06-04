import api from "./axios";

let mockTerceros = [
  { id: 201, nombre: "Lucía", apellido: "Torres", razonSocial: null, dni: "32111222", email: "ltorres@derecho.com", telefono: "11-9988-7766", activo: true },
  { id: 202, nombre: null, apellido: null, razonSocial: "Aseguradora del Sur S.A.", cuit: "30-55443322-1", email: "siniestros@asur.com.ar", telefono: "0800-444-1234", activo: true },
];

let mockParticipantesCaso = {};

function unwrapList(data) {
  const raw = data?.data?.items ?? data?.data ?? data;
  return Array.isArray(raw) ? raw : [];
}

export async function fetchTerceros() {
  try {
    const r = await api.get("/terceros", { params: { limit: 100 } });
    return unwrapList(r.data);
  } catch {
    return [...mockTerceros];
  }
}

export async function createTercero(data) {
  try {
    const r = await api.post("/terceros", data);
    return r.data?.data ?? r.data;
  } catch {
    const n = { ...data, id: Date.now(), activo: true };
    mockTerceros = [n, ...mockTerceros];
    return n;
  }
}

export async function updateTercero(id, data) {
  try {
    const r = await api.put(`/terceros/${id}`, data);
    return r.data?.data ?? r.data;
  } catch {
    let updated = null;
    mockTerceros = mockTerceros.map((t) => {
      if (Number(t.id) !== Number(id)) return t;
      updated = { ...t, ...data, id: t.id };
      return updated;
    });
    return updated;
  }
}

export async function deleteTercero(id) {
  try {
    await api.delete(`/terceros/${id}`);
    return { success: true };
  } catch {
    mockTerceros = mockTerceros.filter((t) => Number(t.id) !== Number(id));
    return { success: true };
  }
}

export async function fetchParticipantesCaso(casoId) {
  try {
    const r = await api.get(`/expedientes/${casoId}/participantes`);
    return r.data?.data ?? r.data;
  } catch {
    if (!mockParticipantesCaso[casoId]) {
      mockParticipantesCaso[casoId] = [
        { id: 501, casoId, terceroId: 201, tercero: mockTerceros[0], rolNombre: "Abogado Contraparte", rol: "Abogado Contraparte", rolId: 10, observaciones: "Estudio Torres & Asoc." },
      ];
    }
    return mockParticipantesCaso[casoId];
  }
}

export async function addParticipanteCaso(casoId, data) {
  try {
    const { rolNombre, tercero, ...postData } = data;
    const r = await api.post(`/expedientes/${casoId}/participantes`, postData);
    return r.data?.data ?? r.data;
  } catch {
    const tercero = mockTerceros.find((t) => Number(t.id) === Number(data.terceroId)) || {};
    const n = { id: Date.now(), casoId, terceroId: data.terceroId, tercero, rol: data.rolNombre || "Contraparte", rolNombre: data.rolNombre || "Contraparte", rolId: data.rolId, observaciones: data.observaciones };
    if (!mockParticipantesCaso[casoId]) mockParticipantesCaso[casoId] = [];
    mockParticipantesCaso[casoId] = [...mockParticipantesCaso[casoId], n];
    return n;
  }
}

export async function updateParticipanteCaso(casoId, participanteId, data) {
  try {
    const { rolNombre, tercero, ...putData } = data;
    const r = await api.put(`/expedientes/${casoId}/participantes/${participanteId}`, putData);
    return r.data?.data ?? r.data;
  } catch {
    let updated = null;
    mockParticipantesCaso[casoId] = (mockParticipantesCaso[casoId] ?? []).map((p) => {
      if (Number(p.id) !== Number(participanteId)) return p;
      updated = { ...p, ...data };
      return updated;
    });
    return updated;
  }
}

export async function removeParticipanteCaso(casoId, participanteId) {
  try {
    await api.delete(`/expedientes/${casoId}/participantes/${participanteId}`);
    return { success: true };
  } catch {
    mockParticipantesCaso[casoId] = (mockParticipantesCaso[casoId] ?? []).filter((p) => Number(p.id) !== Number(participanteId));
    return { success: true };
  }
}
