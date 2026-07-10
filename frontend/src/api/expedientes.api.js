import api from "./axios";
import { unwrapPaged } from "./pagination";

/** Búsqueda server-side de expedientes (carátula, nro. y cliente). */
export async function searchExpedientes({ search, page = 1, limit = 20, orderBy = "caratula", order = "asc" } = {}) {
  const { data } = await api.get("/expedientes", {
    params: {
      page,
      limit,
      orderBy,
      order,
      ...(search?.trim() ? { search: search.trim() } : {}),
    },
  });
  return unwrapPaged(data).items;
}

export async function getExpediente(id) {
  const { data } = await api.get(`/expedientes/${id}`);
  return data?.data ?? data ?? null;
}
