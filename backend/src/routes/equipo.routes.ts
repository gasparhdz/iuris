import type { FastifyPluginAsync } from "fastify";
import * as ctrl from "../controllers/equipo.controller.js";
import type { EquipoUsuarioBody, UsuarioParams } from "../controllers/equipo.controller.js";

export const equipoRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", fastify.authenticate);
  const can = (accion: "ver" | "crear" | "editar" | "eliminar") =>
    fastify.authorize("EQUIPO", accion);

  // Listado liviano (id + nombre) usado por los selectores de "responsable" en toda la app:
  // se mantiene accesible a cualquier usuario autenticado, no se gatea con EQUIPO para no
  // romper la asignacion de tareas/expedientes/eventos.
  fastify.get("/miembros", ctrl.listarMiembrosEstudio);

  // Gestion de usuarios del estudio: gateada por el modulo EQUIPO de la matriz de permisos.
  fastify.get("/usuarios", { preHandler: [can("ver")] }, ctrl.listarEquipoUsuarios);
  fastify.post<{ Body: EquipoUsuarioBody }>("/usuarios", { preHandler: [can("crear")] }, ctrl.crearEquipoUsuario);
  fastify.put<{ Params: UsuarioParams; Body: EquipoUsuarioBody }>("/usuarios/:usuarioId", { preHandler: [can("editar")] }, ctrl.actualizarEquipoUsuario);
  fastify.post<{ Params: UsuarioParams }>("/usuarios/:usuarioId/toggle", { preHandler: [can("editar")] }, ctrl.toggleEquipoUsuario);
  fastify.delete<{ Params: UsuarioParams }>("/usuarios/:usuarioId", { preHandler: [can("eliminar")] }, ctrl.eliminarEquipoUsuario);
};
