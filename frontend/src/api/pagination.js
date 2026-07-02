import api from "./axios";

export function unwrapPaged(data) {
  const payload = data?.data ?? data;
  const items = payload?.items ?? (Array.isArray(payload) ? payload : []);
  const meta = payload?.meta ?? { total: items.length, page: 1, limit: items.length };
  return {
    items: Array.isArray(items) ? items : [],
    meta,
  };
}

/** Recorre todas las páginas de un endpoint paginado (máx. 100 ítems por página). */
export async function fetchAllPages(path, baseParams = {}, pageSize = 100) {
  const all = [];
  let page = 1;
  let total = Infinity;

  while (all.length < total) {
    const { data } = await api.get(path, { params: { ...baseParams, page, limit: pageSize } });
    const { items, meta } = unwrapPaged(data);
    all.push(...items);
    total = meta.total ?? all.length;
    if (!items.length) break;
    page += 1;
  }

  return all;
}
