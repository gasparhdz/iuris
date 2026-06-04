import type { FastifyPluginAsync } from "fastify";
import * as ctrl from "../controllers/equipo.controller.js";

export const equipoRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/miembros", ctrl.listarMiembrosEstudio);
  fastify.get("/usuarios", ctrl.listarEquipoUsuarios);
  fastify.post("/usuarios", ctrl.crearEquipoUsuario);
  fastify.put("/usuarios/:usuarioId", ctrl.actualizarEquipoUsuario);
  fastify.post("/usuarios/:usuarioId/toggle", ctrl.toggleEquipoUsuario);
  fastify.delete("/usuarios/:usuarioId", ctrl.eliminarEquipoUsuario);
};
