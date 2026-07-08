import { Navigate } from "react-router-dom";
import { useAuth } from "./useAuth";

export default function RequireAuth({ children }) {
  const { ready, hasToken } = useAuth();

  if (!ready) {
    // Pantalla de carga mínima hasta validar token
    return null; 
  }

  if (!hasToken) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
