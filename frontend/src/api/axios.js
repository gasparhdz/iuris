import axios from "axios";

const api = axios.create({
  baseURL: "/lex/api",
  withCredentials: false,
});

// Cargar token de inicio si existe en localStorage
const token = localStorage.getItem("token");
if (token) {
  api.defaults.headers.common.Authorization = `Bearer ${token}`;
}

export function loginPersist(token) {
  if (token) {
    localStorage.setItem("token", token);
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    localStorage.removeItem("token");
    delete api.defaults.headers.common.Authorization;
  }
}

export function logoutClear() {
  localStorage.removeItem("token");
  delete api.defaults.headers.common.Authorization;
}

export default api;
