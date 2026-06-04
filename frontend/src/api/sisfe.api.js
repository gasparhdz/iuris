import api from "./axios";

const unwrap = (response) => response.data?.data ?? response.data;

export const getSisfeStatus = async () => unwrap(await api.get("/sisfe/auth/status"));
export const deleteSisfeSession = async () => unwrap(await api.delete("/sisfe/auth/session"));
export const postSisfeManualSession = async (cookieName, cookieValue) =>
  unwrap(await api.post("/sisfe/auth/session", { cookieName, cookieValue }));
export const startSisfeSync = async (casoId) => unwrap(await api.post("/sisfe/sync", { casoId }));
export const cancelSisfeSync = async () => unwrap(await api.post("/sisfe/sync/cancel"));
export const getSisfeSyncStatus = async () => unwrap(await api.get("/sisfe/sync/status"));
export const startSisfeInteractiveLogin = async () => unwrap(await api.post("/sisfe/auth/interactive"));
