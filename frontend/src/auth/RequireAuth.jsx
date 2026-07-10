import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./useAuth";

export default function RequireAuth({ children }) {
  const { ready, hasToken } = useAuth();
  const location = useLocation();

  if (!ready) {
    // Pantalla de carga mínima hasta validar token
    return null; 
  }

  if (!hasToken) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  return children;
}
