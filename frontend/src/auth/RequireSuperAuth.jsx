import { useEffect, useRef } from "react";
import { Navigate } from "react-router-dom";
import { useSnackbar } from "notistack";
import { useAuth } from "./AuthContext";

function hasPlatformAdminRole(user) {
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  const singleRole = user?.rol ? [user.rol] : [];
  const isPlatformStudy = Number(user?.estudioId) === 1;
  return isPlatformStudy && [...roles, ...singleRole].some((role) => ["SUPERADMIN", "ADMIN"].includes(String(role).toUpperCase()));
}

export default function RequireSuperAuth({ children }) {
  const { user, ready } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const notifiedRef = useRef(false);

  const allowed = hasPlatformAdminRole(user);

  useEffect(() => {
    if (ready && !allowed && !notifiedRef.current) {
      notifiedRef.current = true;
      enqueueSnackbar("Acceso no autorizado", { variant: "error" });
    }
  }, [allowed, enqueueSnackbar, ready]);

  if (!ready) return null;
  if (!allowed) return <Navigate to="/" replace />;

  return children;
}
