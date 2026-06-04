import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { and, eq, gte, isNull, lte } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { eventos, tareas } from "../db/schema.js";
import { documentedResponses } from "../schemas/common.schema.js";

const notificacionesPendientesResponseSchema = z.object({
  data: z.object({
    tareas: z.array(z.object({
      id: z.number(),
      titulo: z.string(),
      recordatorio: z.string().nullable(),
      fechaLimite: z.string().nullable(),
    })),
    eventos: z.array(z.object({
      id: z.number(),
      descripcion: z.string().nullable(),
      recordatorio: z.string().nullable(),
      fechaInicio: z.string(),
    })),
    total: z.number(),
  }),
});

export const notificacionesRoutes: FastifyPluginAsync = async (fastify) => {
  const server = fastify.withTypeProvider<ZodTypeProvider>();
  const authConfig = { preHandler: [fastify.authenticate] };

  server.get("/pendientes", {
    ...authConfig,
    schema: {
      tags: ["Notificaciones"],
      summary: "Listar recordatorios pendientes de las proximas 24 horas",
      security: [{ bearerAuth: [] }],
      response: documentedResponses(200, notificacionesPendientesResponseSchema),
    },
  }, async (request) => {
    const now = new Date();
    const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const estudioId = request.authUser.estudioId;

    const [tareasPendientes, eventosPendientes] = await Promise.all([
      db
        .select({
          id: tareas.id,
          titulo: tareas.titulo,
          recordatorio: tareas.recordatorio,
          fechaLimite: tareas.fechaLimite,
        })
        .from(tareas)
        .where(
          and(
            eq(tareas.estudioId, estudioId),
            gte(tareas.recordatorio, now),
            lte(tareas.recordatorio, next24Hours),
            eq(tareas.recordatorioEnviado, false),
            eq(tareas.completada, false),
            eq(tareas.activo, true),
            isNull(tareas.deletedAt)
          )
        ),
      db
        .select({
          id: eventos.id,
          descripcion: eventos.descripcion,
          recordatorio: eventos.recordatorio,
          fechaInicio: eventos.fechaInicio,
        })
        .from(eventos)
        .where(
          and(
            eq(eventos.estudioId, estudioId),
            gte(eventos.recordatorio, now),
            lte(eventos.recordatorio, next24Hours),
            eq(eventos.recordatorioEnviado, false),
            eq(eventos.activo, true),
            isNull(eventos.deletedAt)
          )
        ),
    ]);

    return {
      data: {
        tareas: tareasPendientes.map((tarea) => ({
          ...tarea,
          recordatorio: tarea.recordatorio?.toISOString() ?? null,
          fechaLimite: tarea.fechaLimite?.toISOString() ?? null,
        })),
        eventos: eventosPendientes.map((evento) => ({
          ...evento,
          recordatorio: evento.recordatorio?.toISOString() ?? null,
          fechaInicio: evento.fechaInicio.toISOString(),
        })),
        total: tareasPendientes.length + eventosPendientes.length,
      },
    };
  });
};
