import api from "./axios";

export const getAuditoriaLogs = async (params = {}) => {
  const { data } = await api.get("/auditoria", { params });
  return data.data;
};

export const getAuditoriaExpediente = async (expedienteId) => {
  const { data } = await api.get(`/auditoria/expediente/${expedienteId}`);
  return data.data;
};
