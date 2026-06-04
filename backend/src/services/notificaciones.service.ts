import cron from "node-cron";
import { and, eq, isNull, lte } from "drizzle-orm";
import type { FastifyBaseLogger } from "fastify";
import { db } from "../db/index.js";
import { casos, eventos, subTareas, tareas, usuarios } from "../db/schema.js";
import { EmailService } from "./email.service.js";

let cronStarted = false;
let isProcessing = false;

export function iniciarCronNotificaciones(logger: FastifyBaseLogger) {
  if (cronStarted) return;
  cronStarted = true;

  cron.schedule("* * * * *", async () => {
    if (isProcessing) {
      logger.warn("Cron de notificaciones omitido: el ciclo anterior sigue en ejecucion");
      return;
    }

    isProcessing = true;
    try {
      await procesarRecordatorios(logger);
    } catch (error) {
      logger.error({ err: error }, "Error general en cron de notificaciones");
    } finally {
      isProcessing = false;
    }
  });

  logger.info("Cron de notificaciones iniciado");
}

async function procesarRecordatorios(logger: FastifyBaseLogger) {
  const now = new Date();

  const tareasPendientes = await db
    .select({
      id: tareas.id,
      titulo: tareas.titulo,
      descripcion: tareas.descripcion,
      estudioId: tareas.estudioId,
      fechaLimite: tareas.fechaLimite,
      asignadoA: tareas.asignadoA,
      createdBy: tareas.createdBy,
      casoCaratula: casos.caratula,
    })
    .from(tareas)
    .leftJoin(casos, eq(tareas.casoId, casos.id))
    .where(
      and(
        lte(tareas.recordatorio, now),
        eq(tareas.recordatorioEnviado, false),
        eq(tareas.completada, false),
        eq(tareas.activo, true),
        isNull(tareas.deletedAt)
      )
    );

  for (const tarea of tareasPendientes) {
    try {
      const usuarioId = tarea.asignadoA ?? tarea.createdBy;
      if (!usuarioId) {
        logger.warn({ tareaId: tarea.id }, "Tarea sin usuario destino para recordatorio");
        continue;
      }

      const usuario = await findUsuarioDestino(usuarioId);
      if (!usuario) {
        logger.warn({ tareaId: tarea.id, usuarioId }, "Usuario destino no encontrado para recordatorio de tarea");
        continue;
      }

      const subtareas = await findSubtareasTarea(tarea.id, tarea.estudioId);

      await EmailService.sendRecordatorioTarea({
        titulo: tarea.titulo,
        descripcion: tarea.descripcion,
        fechaLimite: tarea.fechaLimite,
        casoCaratula: tarea.casoCaratula,
        subtareas,
      }, usuario);

      await db
        .update(tareas)
        .set({ recordatorioEnviado: true, updatedAt: new Date() })
        .where(eq(tareas.id, tarea.id));
    } catch (error) {
      logger.error({ err: error, tareaId: tarea.id }, "Error enviando recordatorio de tarea");
    }
  }

  const eventosPendientes = await db
    .select({
      id: eventos.id,
      descripcion: eventos.descripcion,
      fechaInicio: eventos.fechaInicio,
      createdBy: eventos.createdBy,
    })
    .from(eventos)
    .where(
      and(
        lte(eventos.recordatorio, now),
        eq(eventos.recordatorioEnviado, false),
        eq(eventos.activo, true),
        isNull(eventos.deletedAt)
      )
    );

  for (const evento of eventosPendientes) {
    try {
      if (!evento.createdBy) {
        logger.warn({ eventoId: evento.id }, "Evento sin usuario destino para recordatorio");
        continue;
      }

      const usuario = await findUsuarioDestino(evento.createdBy);
      if (!usuario) {
        logger.warn({ eventoId: evento.id, usuarioId: evento.createdBy }, "Usuario destino no encontrado para recordatorio de evento");
        continue;
      }

      await EmailService.sendRecordatorioEvento({
        descripcion: evento.descripcion,
        fechaInicio: evento.fechaInicio,
      }, usuario);

      await db
        .update(eventos)
        .set({ recordatorioEnviado: true, updatedAt: new Date() })
        .where(eq(eventos.id, evento.id));
    } catch (error) {
      logger.error({ err: error, eventoId: evento.id }, "Error enviando recordatorio de evento");
    }
  }
}

async function findUsuarioDestino(usuarioId: number) {
  const [usuario] = await db
    .select({
      id: usuarios.id,
      email: usuarios.email,
      nombre: usuarios.nombre,
      apellido: usuarios.apellido,
    })
    .from(usuarios)
    .where(and(eq(usuarios.id, usuarioId), eq(usuarios.activo, true), isNull(usuarios.deletedAt)))
    .limit(1);

  return usuario;
}

async function findSubtareasTarea(tareaId: number, estudioId: number) {
  return await db
    .select({
      titulo: subTareas.titulo,
      descripcion: subTareas.descripcion,
      completada: subTareas.completada,
    })
    .from(subTareas)
    .innerJoin(tareas, eq(subTareas.tareaId, tareas.id))
    .where(
      and(
        eq(subTareas.tareaId, tareaId),
        eq(tareas.estudioId, estudioId),
        eq(subTareas.activo, true),
        isNull(subTareas.deletedAt),
        isNull(tareas.deletedAt)
      )
    )
    .orderBy(subTareas.orden);
}
