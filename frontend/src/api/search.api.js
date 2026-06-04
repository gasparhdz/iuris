import api from "./axios";

export async function globalSearch(query) {
  if (!query || query.trim().length < 2) return null;

  const { data } = await api.get(`/search?q=${encodeURIComponent(query)}`);
  return data.data;
}
