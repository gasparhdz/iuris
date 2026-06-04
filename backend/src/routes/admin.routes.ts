import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import * as ctrl from "../controllers/admin.controller.js";
import { SystemErrorLogsService } from "../services/system-error-logs.service.js";

export const adminRoutes: FastifyPluginAsync = async (fastify) => {
  const server = fastify.withTypeProvider<ZodTypeProvider>();

  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", async (request, reply) => {
    if (!ctrl.isSuperRole(request)) return ctrl.forbidden(reply);
  });

  fastify.get("/estudios", ctrl.listarEstudios);
  fastify.get("/estudios/:id", ctrl.obtenerEstudio);
  fastify.post("/estudios", ctrl.crearEstudio);
  fastify.put("/estudios/:id", ctrl.actualizarEstudio);
  fastify.post("/estudios/:id/toggle", ctrl.toggleEstudio);
  fastify.get("/planes-suscripcion", ctrl.listarPlanesSuscripcion);
  fastify.get("/planes-suscripcion/:id", ctrl.obtenerPlanSuscripcion);
  fastify.post("/planes-suscripcion", ctrl.crearPlanSuscripcion);
  fastify.put("/planes-suscripcion/:id", ctrl.actualizarPlanSuscripcion);
  fastify.post("/planes-suscripcion/:id/toggle", ctrl.togglePlanSuscripcion);
  fastify.get("/estudios/:id/usuarios", ctrl.listarUsuariosEstudio);
  fastify.post("/estudios/:id/usuarios", ctrl.crearUsuarioEstudio);
  fastify.put("/estudios/:id/usuarios/:usuarioId", ctrl.actualizarUsuarioEstudio);
  fastify.post("/estudios/:id/usuarios/:usuarioId/toggle", ctrl.toggleUsuarioEstudio);
  fastify.delete("/estudios/:id/usuarios/:usuarioId", ctrl.eliminarUsuarioEstudio);
  fastify.get("/roles", ctrl.listarRoles);
  fastify.get("/roles/:id", ctrl.obtenerRolConPermisos);
  fastify.post("/roles", ctrl.crearRol);
  fastify.put("/roles/:id", ctrl.actualizarRol);
  fastify.put("/roles/:id/permisos", ctrl.actualizarPermisosRol);
  fastify.post("/roles/:id/toggle", ctrl.toggleRol);
  fastify.delete("/roles/:id", ctrl.eliminarRol);

  server.get("/system-logs", {
    schema: {
      tags: ["Admin"],
      summary: "Listar errores del sistema",
      security: [{ bearerAuth: [] }],
      querystring: z.object({
        nivel: z.enum(["ERROR", "WARN"]).optional(),
        statusCode: z.coerce.number().optional(),
        desde: z.string().optional(),
        hasta: z.string().optional(),
        page: z.coerce.number().default(1),
        limit: z.coerce.number().default(50),
      }),
    },
  }, async (request, reply) => {
    const rol = String(request.authUser?.rol ?? "").toUpperCase();
    if (rol !== "SUPERADMIN") {
      return reply.status(403).send({
        error: { code: "FORBIDDEN", message: "Acceso restringido a SuperAdmin" },
      });
    }

    const result = await SystemErrorLogsService.findAll(request.query);
    return reply.send({ data: result });
  });
};
