import { createContext, useContext, useEffect, useState } from "react";
import api, { loginPersist, logoutClear } from "../api/axios";

const AuthContext = createContext(null);

function isTokenExpired(token) {
  try {
    const parts = String(token).split(".");
    if (parts.length !== 3) return true;
    const payload = JSON.parse(atob(parts[1]));
    if (!payload?.exp) return true;
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  // Verificamos si hay un token válido guardado
  const hasToken = (() => {
    const token = localStorage.getItem("token");
    return !!token && !isTokenExpired(token);
  })();

  useEffect(() => {
    const token = localStorage.getItem("token");

    // Limpiar si el token expiró
    if (token && isTokenExpired(token)) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      setUser(null);
      setReady(true);
      return;
    }

    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem("user");
      }
    }

    // Refrescar el perfil en background si el token es válido
    if (token) {
      (async () => {
        try {
          const { data } = await api.get("/auth/me");
          setUser(data);
          localStorage.setItem("user", JSON.stringify(data));
        } catch (e) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          setUser(null);
        } finally {
          setReady(true);
        }
      })();
      return;
    }

    setReady(true);
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    const token = data.token || data.accessToken || data?.data?.token || data?.data?.accessToken;
    if (!token) throw new Error("El backend no devolvió token");

    loginPersist(token);
    
    // Obtener los datos del perfil actualizados
    const me = (await api.get("/auth/me")).data;
    setUser(me);
    localStorage.setItem("user", JSON.stringify(me));
    if (!ready) setReady(true);
    return me;
  };

  const logout = () => {
    logoutClear();
    localStorage.removeItem("user");
    setUser(null);
    if (!ready) setReady(true);
  };

  const updateUser = (nextUser) => {
    setUser(nextUser);
    localStorage.setItem("user", JSON.stringify(nextUser));
  };

  return (
    <AuthContext.Provider value={{ user, ready, hasToken, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
