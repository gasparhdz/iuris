import { useAuth } from './AuthContext';

export const usePermiso = (modulo, accion = 'ver') => {
  const { user } = useAuth();

  if (!user?.permisos) return false;

  const permiso = user.permisos.find(p => p.modulo === modulo);
  if (!permiso) return false;

  return permiso[accion] === true;
};

export const useHasRol = (rolCodigo) => {
  const { user } = useAuth();

  if (!user?.roles) return false;
  
  if (Array.isArray(rolCodigo)) {
    return user.roles.some(rol => rolCodigo.includes(rol));
  }
  
  return user.roles.includes(rolCodigo);
};

export const usePermisos = (modulo) => {
  const { user } = useAuth();

  if (!user?.permisos) {
    return { canView: false, canCrear: false, canEditar: false, canEliminar: false };
  }

  const permiso = user.permisos.find(p => p.modulo === modulo);
  if (!permiso) {
    return { canView: false, canCrear: false, canEditar: false, canEliminar: false };
  }

  return {
    canView: permiso.ver === true,
    canCrear: permiso.crear === true,
    canEditar: permiso.editar === true,
    canEliminar: permiso.eliminar === true,
  };
};
