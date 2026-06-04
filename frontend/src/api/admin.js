import api from "./axios";

let mockEstudios = [
  {
    id: 1,
    nombre: "Estudio Meotto",
    cuit: "30-71234567-8",
    emailAdmin: "admin@meotto.com",
    telefono: "+54 11 5555-0142",
    plan: "PREMIUM",
    maxUsuarios: 15,
    almacenamientoGb: 50,
    usuariosActivos: 11,
    expedientes: 284,
    activo: true,
    createdAt: new Date(new Date().getFullYear(), new Date().getMonth() - 5, 8).toISOString(),
  },
  {
    id: 2,
    nombre: "Gaspar & Asociados",
    cuit: "20-30111222-3",
    emailAdmin: "facturacion@gasparlegal.com",
    telefono: "+54 351 555-2390",
    plan: "PRO",
    maxUsuarios: 8,
    almacenamientoGb: 20,
    usuariosActivos: 5,
    expedientes: 126,
    activo: true,
    createdAt: new Date(new Date().getFullYear(), new Date().getMonth() - 3, 14).toISOString(),
  },
  {
    id: 3,
    nombre: "Lex Norte",
    cuit: "27-33444555-6",
    emailAdmin: "operaciones@lexnorte.ar",
    telefono: "+54 387 555-7788",
    plan: "FREE",
    maxUsuarios: 3,
    almacenamientoGb: 5,
    usuariosActivos: 2,
    expedientes: 37,
    activo: false,
    createdAt: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 22).toISOString(),
  },
];

let mockUsuariosEstudio = {};

let mockRoles = [
  { id: 1, codigo: "SUPERADMIN", nombre: "Super Administrador", activo: true, usuariosCount: 1 },
  { id: 2, codigo: "ADMIN", nombre: "Administrador SaaS", activo: true, usuariosCount: 1 },
  { id: 5, codigo: "DIRECTOR", nombre: "Director de Estudio", activo: true, usuariosCount: 4 },
  { id: 3, codigo: "ABOGADO", nombre: "Abogado Litigante", activo: true, usuariosCount: 12 },
  { id: 4, codigo: "ASISTENTE", nombre: "Asistente Jurídico", activo: true, usuariosCount: 5 },
];

let mockPlanesSuscripcion = [
  { id: 1, codigo: "SOLO", nombre: "Solo / Independiente", maxUsuarios: 1, almacenamientoGb: 5, precioMensualArs: "13200.00", precioMensualJus: "0.1000", activo: true },
  { id: 2, codigo: "PRO", nombre: "Pro / Estudio Boutique", maxUsuarios: 3, almacenamientoGb: 15, precioMensualArs: "29040.00", precioMensualJus: "0.2200", activo: true },
  { id: 3, codigo: "PREMIUM", nombre: "Premium / Corporativo", maxUsuarios: 10, almacenamientoGb: 100, precioMensualArs: "76560.00", precioMensualJus: "0.5800", activo: true },
];

const modulosPlataforma = [
  "CLIENTES", "CASOS", "TAREAS", "EVENTOS", "HONORARIOS",
  "GASTOS", "INGRESOS", "PLANTILLAS", "NOTAS", "VALORJUS",
  "TERCEROS", "PLANES", "ADJUNTOS",
];

let mockPermisosRol = {
  2: modulosPlataforma.map((modulo) => ({ modulo, ver: true, crear: true, editar: true, eliminar: true })),
  3: modulosPlataforma.map((modulo) => ({ modulo, ver: true, crear: true, editar: true, eliminar: modulo !== "CLIENTES" && modulo !== "CASOS" })),
  5: modulosPlataforma.map((modulo) => ({ modulo, ver: true, crear: true, editar: true, eliminar: true })),
};

function isMissingAdminApi(error) {
  return error?.response?.status === 404 || error?.response?.status === 405 || error?.code === "ERR_NETWORK";
}

function normalizeList(payload) {
  const raw = payload?.data?.items ?? payload?.data ?? payload?.items ?? payload;
  return Array.isArray(raw) ? raw : [];
}

function mockResponse(data) {
  return Promise.resolve({ data });
}

export async function fetchAdminEstudios() {
  try {
    const response = await api.get("/admin/estudios");
    return normalizeList(response.data);
  } catch (error) {
    if (isMissingAdminApi(error)) return mockResponse([...mockEstudios]).then((r) => r.data);
    throw error;
  }
}

export async function fetchAdminEstudio(id) {
  try {
    const response = await api.get(`/admin/estudios/${id}`);
    return response.data?.data ?? response.data;
  } catch (error) {
    if (isMissingAdminApi(error)) {
      return mockEstudios.find((estudio) => Number(estudio.id) === Number(id)) ?? null;
    }
    throw error;
  }
}

export async function createAdminEstudio(data) {
  try {
    const response = await api.post("/admin/estudios", data);
    return response.data?.data ?? response.data;
  } catch (error) {
    if (isMissingAdminApi(error)) {
      const next = {
        ...data,
        id: Math.max(0, ...mockEstudios.map((e) => Number(e.id))) + 1,
        usuariosActivos: 1,
        expedientes: 0,
        activo: true,
        createdAt: new Date().toISOString(),
      };
      mockEstudios = [next, ...mockEstudios];
      return next;
    }
    throw error;
  }
}

export async function updateAdminEstudio(id, data) {
  try {
    const response = await api.put(`/admin/estudios/${id}`, data);
    return response.data?.data ?? response.data;
  } catch (error) {
    if (isMissingAdminApi(error)) {
      let updated = null;
      mockEstudios = mockEstudios.map((estudio) => {
        if (Number(estudio.id) !== Number(id)) return estudio;
        updated = { ...estudio, ...data, id: estudio.id };
        return updated;
      });
      return updated;
    }
    throw error;
  }
}

export async function toggleAdminEstudio(id) {
  try {
    const response = await api.post(`/admin/estudios/${id}/toggle`);
    return response.data?.data ?? response.data;
  } catch (error) {
    if (isMissingAdminApi(error)) {
      let updated = null;
      mockEstudios = mockEstudios.map((estudio) => {
        if (Number(estudio.id) !== Number(id)) return estudio;
        updated = { ...estudio, activo: !estudio.activo };
        return updated;
      });
      return updated;
    }
    throw error;
  }
}

function ensureMockUsuarios(estudioId) {
  if (!mockUsuariosEstudio[estudioId]) {
    mockUsuariosEstudio[estudioId] = [
      { id: 101, nombre: "Juan", apellido: "Pérez", email: "juan@meotto.com", dni: "33444555", telefono: "11-2222-3333", activo: true, roles: ["DIRECTOR"] },
      { id: 102, nombre: "María", apellido: "Gómez", email: "maria@meotto.com", dni: "34555666", telefono: "11-4444-5555", activo: true, roles: ["ABOGADO"] },
    ];
  }
  return mockUsuariosEstudio[estudioId];
}

export async function fetchAdminUsuariosEstudio(estudioId) {
  try {
    const response = await api.get(`/admin/estudios/${estudioId}/usuarios`);
    return response.data?.data ?? response.data;
  } catch (error) {
    if (isMissingAdminApi(error)) return [...ensureMockUsuarios(estudioId)];
    throw error;
  }
}

export async function createAdminUsuarioEstudio(estudioId, data) {
  try {
    const response = await api.post(`/admin/estudios/${estudioId}/usuarios`, data);
    return response.data?.data ?? response.data;
  } catch (error) {
    if (isMissingAdminApi(error)) {
      const next = {
        ...data,
        id: Date.now(),
        roles: [data.rol],
        activo: true,
      };
      mockUsuariosEstudio[estudioId] = [next, ...ensureMockUsuarios(estudioId)];
      return next;
    }
    throw error;
  }
}

export async function updateAdminUsuarioEstudio(estudioId, usuarioId, data) {
  try {
    const response = await api.put(`/admin/estudios/${estudioId}/usuarios/${usuarioId}`, data);
    return response.data?.data ?? response.data;
  } catch (error) {
    if (isMissingAdminApi(error)) {
      let updated = null;
      mockUsuariosEstudio[estudioId] = ensureMockUsuarios(estudioId).map((user) => {
        if (Number(user.id) !== Number(usuarioId)) return user;
        updated = { ...user, ...data, roles: data.rol ? [data.rol] : user.roles };
        return updated;
      });
      return updated;
    }
    throw error;
  }
}

export async function toggleAdminUsuarioEstudio(estudioId, usuarioId) {
  try {
    const response = await api.post(`/admin/estudios/${estudioId}/usuarios/${usuarioId}/toggle`);
    return response.data?.data ?? response.data;
  } catch (error) {
    if (isMissingAdminApi(error)) {
      let updated = null;
      mockUsuariosEstudio[estudioId] = ensureMockUsuarios(estudioId).map((user) => {
        if (Number(user.id) !== Number(usuarioId)) return user;
        updated = { ...user, activo: !user.activo };
        return updated;
      });
      return updated;
    }
    throw error;
  }
}

export async function deleteAdminUsuarioEstudio(estudioId, usuarioId) {
  try {
    const response = await api.delete(`/admin/estudios/${estudioId}/usuarios/${usuarioId}`);
    return response.data?.data ?? response.data;
  } catch (error) {
    if (isMissingAdminApi(error)) {
      mockUsuariosEstudio[estudioId] = ensureMockUsuarios(estudioId).filter((user) => Number(user.id) !== Number(usuarioId));
      return { success: true };
    }
    throw error;
  }
}

function defaultPermisos() {
  return modulosPlataforma.map((modulo) => ({ modulo, ver: false, crear: false, editar: false, eliminar: false }));
}

export async function fetchAdminRoles() {
  try {
    const response = await api.get("/admin/roles");
    return response.data?.data ?? response.data;
  } catch {
    return [...mockRoles];
  }
}

export async function fetchAdminRolConPermisos(id) {
  try {
    const response = await api.get(`/admin/roles/${id}`);
    return response.data?.data ?? response.data;
  } catch {
    const rol = mockRoles.find((r) => Number(r.id) === Number(id));
    if (!rol) throw new Error("Rol no encontrado");
    const permisos = mockPermisosRol[id] || defaultPermisos();
    return { ...rol, permisos };
  }
}

export async function createAdminRol(data) {
  try {
    const response = await api.post("/admin/roles", data);
    return response.data?.data ?? response.data;
  } catch {
    const next = { ...data, codigo: String(data.codigo || "").toUpperCase(), id: Date.now(), activo: true, usuariosCount: 0 };
    mockRoles = [...mockRoles, next];
    mockPermisosRol[next.id] = defaultPermisos();
    return next;
  }
}

export async function updateAdminRol(id, data) {
  try {
    const response = await api.put(`/admin/roles/${id}`, data);
    return response.data?.data ?? response.data;
  } catch {
    let updated = null;
    mockRoles = mockRoles.map((rol) => {
      if (Number(rol.id) !== Number(id)) return rol;
      updated = { ...rol, ...data, codigo: data.codigo ? String(data.codigo).toUpperCase() : rol.codigo };
      return updated;
    });
    return updated;
  }
}

export async function updateAdminPermisosRol(id, permisos) {
  try {
    const response = await api.put(`/admin/roles/${id}/permisos`, { permisos });
    return response.data?.data ?? response.data;
  } catch {
    mockPermisosRol[id] = permisos;
    return { success: true };
  }
}

export async function toggleAdminRol(id) {
  try {
    const response = await api.post(`/admin/roles/${id}/toggle`);
    return response.data?.data ?? response.data;
  } catch {
    let updated = null;
    mockRoles = mockRoles.map((rol) => {
      if (Number(rol.id) !== Number(id)) return rol;
      updated = { ...rol, activo: !rol.activo };
      return updated;
    });
    return updated;
  }
}

export async function deleteAdminRol(id) {
  try {
    const response = await api.delete(`/admin/roles/${id}`);
    return response.data?.data ?? response.data;
  } catch {
    mockRoles = mockRoles.filter((rol) => Number(rol.id) !== Number(id));
    delete mockPermisosRol[id];
    return { success: true };
  }
}

export async function fetchAdminPlanesSuscripcion() {
  try {
    const response = await api.get("/admin/planes-suscripcion");
    return response.data?.data ?? response.data;
  } catch (error) {
    if (isMissingAdminApi(error)) return [...mockPlanesSuscripcion];
    throw error;
  }
}

export async function createAdminPlanSuscripcion(data) {
  try {
    const response = await api.post("/admin/planes-suscripcion", data);
    return response.data?.data ?? response.data;
  } catch (error) {
    if (isMissingAdminApi(error)) {
      const next = { ...data, id: Date.now(), codigo: String(data.codigo || "").toUpperCase(), activo: data.activo ?? true };
      mockPlanesSuscripcion = [...mockPlanesSuscripcion, next];
      return next;
    }
    throw error;
  }
}

export async function updateAdminPlanSuscripcion(id, data) {
  try {
    const response = await api.put(`/admin/planes-suscripcion/${id}`, data);
    return response.data?.data ?? response.data;
  } catch (error) {
    if (isMissingAdminApi(error)) {
      let updated = null;
      mockPlanesSuscripcion = mockPlanesSuscripcion.map((plan) => {
        if (Number(plan.id) !== Number(id)) return plan;
        updated = { ...plan, ...data, codigo: data.codigo ? String(data.codigo).toUpperCase() : plan.codigo };
        return updated;
      });
      return updated;
    }
    throw error;
  }
}

export async function toggleAdminPlanSuscripcion(id) {
  try {
    const response = await api.post(`/admin/planes-suscripcion/${id}/toggle`);
    return response.data?.data ?? response.data;
  } catch (error) {
    if (isMissingAdminApi(error)) {
      let updated = null;
      mockPlanesSuscripcion = mockPlanesSuscripcion.map((plan) => {
        if (Number(plan.id) !== Number(id)) return plan;
        updated = { ...plan, activo: !plan.activo };
        return updated;
      });
      return updated;
    }
    throw error;
  }
}

export async function fetchSystemErrorLogs(params = {}) {
  const { data } = await api.get("/admin/system-logs", { params });
  return data?.data ?? { items: [], meta: { total: 0, page: 1, limit: 50 } };
}

