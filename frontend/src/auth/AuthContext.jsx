import { useEffect, useState } from "react";
import api, { setAccessToken, refreshAccessToken } from "../api/axios";
import { AuthContext } from "./auth-context";

export function AuthProvider({ children }) {
  // El perfil cacheado NO es una credencial (no permite autenticarse); se guarda solo para
  // evitar parpadeo en el primer render y se revalida contra el backend al montar.
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem("user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [ready, setReady] = useState(false);

  // Bootstrap de sesión: el access token se perdió al recargar (vive en memoria), así que se
  // re-obtiene con la cookie HttpOnly del refresh. Si no hay sesión válida, queda deslogueado.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const token = await refreshAccessToken();
        if (!token) throw new Error("NO_SESSION");
        const me = (await api.get("/auth/me")).data;
        if (!active) return;
        setUser(me);
        localStorage.setItem("user", JSON.stringify(me));
      } catch {
        if (!active) return;
        setAccessToken(null);
        setUser(null);
        localStorage.removeItem("user");
      } finally {
        if (active) setReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    const token = data.token || data.accessToken || data?.data?.token || data?.data?.accessToken;
    if (!token) throw new Error("El backend no devolvió token");

    setAccessToken(token);
    const me = (await api.get("/auth/me")).data;
    setUser(me);
    localStorage.setItem("user", JSON.stringify(me));
    setReady(true);
    return me;
  };

  const logout = async () => {
    // Se llama al backend ANTES de limpiar el token para que el logout se autentique y revoque
    // el refresh token del servidor.
    try {
      await api.post("/auth/logout");
    } catch {
      // noop: igual limpiamos el estado local
    }
    setAccessToken(null);
    setUser(null);
    localStorage.removeItem("user");
    setReady(true);
  };

  const updateUser = (nextUser) => {
    setUser(nextUser);
    localStorage.setItem("user", JSON.stringify(nextUser));
  };

  return (
    <AuthContext.Provider value={{ user, ready, hasToken: Boolean(user), login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}
