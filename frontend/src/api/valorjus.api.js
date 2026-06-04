import api from "./axios";

const unwrap = (response) => response.data?.data ?? response.data;

export const getValoresJus = async (params) => unwrap(await api.get("/valorjus", { params }));

export const syncValoresJus = async () => unwrap(await api.post("/valorjus/sync"));

export const createValorJus = async (data) => {
  const payload = {
    ...data,
    fecha: new Date(data.fecha).toISOString(),
  };

  return unwrap(await api.post("/valorjus", payload));
};

export const deleteValorJus = async (id) => unwrap(await api.delete(`/valorjus/${id}`));
