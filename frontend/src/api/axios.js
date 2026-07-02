import axios from "axios";

const apiBasePath = `${import.meta.env.BASE_URL}api`.replace(/\/+$/, "");

const api = axios.create({
  baseURL: apiBasePath,
  // Necesario para enviar la cookie HttpOnly del refresh token en /auth/refresh.
  withCredentials: true,
});

// El access token vive SOLO en memoria (no en localStorage) para que una XSS no pueda
// exfiltrarlo e impersonar al usuario. Se re-hidrata al cargar la app vía /auth/refresh,
// que se autentica con la cookie HttpOnly (inaccesible desde JS).
let accessToken = null;

export function setAccessToken(token) {
  accessToken = token || null;
  if (accessToken) {
    api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

export function getAccessToken() {
  return accessToken;
}

// Single-flight: si varias requests fallan con 401 a la vez, comparten un único refresh.
let refreshPromise = null;

export function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = api
      .post("/auth/refresh")
      .then((res) => {
        const token = res.data?.data?.accessToken ?? res.data?.accessToken ?? null;
        setAccessToken(token);
        return token;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

function isAuthEndpoint(url) {
  return typeof url === "string"
    && (url.includes("/auth/refresh") || url.includes("/auth/login") || url.includes("/auth/logout"));
}

// Ante un 401, intenta UN refresh y reintenta la request original. Si el refresh falla,
// propaga el error (la sesión se considera caída).
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    if (status === 401 && original && !original._retry && !isAuthEndpoint(original.url)) {
      original._retry = true;
      try {
        const token = await refreshAccessToken();
        if (token) {
          original.headers = original.headers ?? {};
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        }
      } catch {
        // refresh fallido: cae al reject de abajo
      }
    }
    return Promise.reject(error);
  },
);

export default api;
