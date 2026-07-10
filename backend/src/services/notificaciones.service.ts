import cron from "node-cron";
import { and, eq, exists, isNull, lte, or } from "drizzle-orm";
import type { FastifyBaseLogger } from "fastify";
import { db } from "../db/index.js";
import { casos, clientes, eventos, subTareas, tareas, usuarios } from "../db/schema.js";
import { EmailService } from "./email.service.js";
import { PushService } from "./push.service.js";
import { procesarRecordatoriosCobranza } from "./cobranza-notificaciones.service.js";
import {
  buildEventoPushCopy,
  buildTareaPushCopy,
  NOTIFICATION_PATHS,
  type CasoResumenNotificacion,
} from "./notification-copy.js";

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
      logger.error({ err: error }, "Error general en cron de recordatorios tareas/eventos");
    }

    try {
      await procesarRecordatoriosCobranza(logger);
    } catch (error) {
      logger.error({ err: error }, "Error general en cron de recordatorios de cobranza");
    } finally {
      isProcessing = false;
    }
  });

  logger.info("Cron de notificaciones iniciado");
}

/** Caso vinculado vivo, o sin caso (FK null). Usado por cron y /notificaciones/pendientes. */
export function casoPadreVivo(casoIdCol: typeof tareas.casoId | typeof eventos.casoId) {
  return or(
    isNull(casoIdCol),
    exists(
      db
        .select({ id: casos.id })
        .from(casos)
        .where(and(eq(casos.id, casoIdCol), isNull(casos.deletedAt))),
    ),
  );
}

/** Cliente vinculado vivo, o sin cliente (FK null). Usado por cron y /notificaciones/pendientes. */
export function clientePadreVivo(clienteIdCol: typeof tareas.clienteId | typeof eventos.clienteId) {
  return or(
    isNull(clienteIdCol),
    exists(
      db
        .select({ id: clientes.id })
        .from(clientes)
        .where(and(eq(clientes.id, clienteIdCol), isNull(clientes.deletedAt))),
    ),
  );
}

async function liberarClaimTarea(tareaId: number) {
  await db
    .update(tareas)
    .set({ recordatorioEnviado: false, updatedAt: new Date() })
    .where(and(eq(tareas.id, tareaId), eq(tareas.recordatorioEnviado, true)));
}

async function liberarClaimEvento(eventoId: number) {
  await db
    .update(eventos)
    .set({ recordatorioEnviado: false, updatedAt: new Date() })
    .where(and(eq(eventos.id, eventoId), eq(eventos.recordatorioEnviado, true)));
}

async function procesarRecordatorios(logger: FastifyBaseLogger) {
  const now = new Date();

  // Claim atómico: evita duplicados entre instancias. Si ambos canales fallan, se libera.
  const tareasPendientes = await db
    .update(tareas)
    .set({ recordatorioEnviado: true, updatedAt: new Date() })
    .where(
      and(
        lte(tareas.recordatorio, now),
        eq(tareas.recordatorioEnviado, false),
        eq(tareas.completada, false),
        eq(tareas.activo, true),
        isNull(tareas.deletedAt),
        casoPadreVivo(tareas.casoId),
        clientePadreVivo(tareas.clienteId),
      ),
    )
    .returning({
      id: tareas.id,
      titulo: tareas.titulo,
      descripcion: tareas.descripcion,
      estudioId: tareas.estudioId,
      fechaLimite: tareas.fechaLimite,
      asignadoA: tareas.asignadoA,
      createdBy: tareas.createdBy,
      casoId: tareas.casoId,
    });

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

      const caso = tarea.casoId ? await findCasoResumen(tarea.casoId) : null;
      const subtareas = await findSubtareasTarea(tarea.id, tarea.estudioId);

      let enviadoEmail = false;
      let enviadoPush = false;

      try {
        enviadoEmail = await EmailService.sendRecordatorioTarea({
          id: tarea.id,
          titulo: tarea.titulo,
          descripcion: tarea.descripcion,
          fechaLimite: tarea.fechaLimite,
          caso,
          subtareas,
        }, usuario);
      } catch (error) {
        logger.error({ err: error, tareaId: tarea.id, canal: "email" }, "Error enviando recordatorio de tarea por email");
      }

      try {
        const pushCopy = buildTareaPushCopy({
          titulo: tarea.titulo,
          fechaLimite: tarea.fechaLimite,
          caso,
        });
        enviadoPush = await PushService.sendToUsuario(usuarioId, {
          title: pushCopy.title,
          body: pushCopy.body,
          url: NOTIFICATION_PATHS.tarea(tarea.id),
          tag: `tarea-${tarea.id}`,
        }, logger);
      } catch (error) {
        logger.error({ err: error, tareaId: tarea.id, canal: "push" }, "Error enviando recordatorio de tarea por push");
      }

      if (!enviadoEmail && !enviadoPush) {
        await liberarClaimTarea(tarea.id);
        logger.warn({ tareaId: tarea.id }, "Recordatorio de tarea sin canales OK; claim liberado para reintento");
      }
    } catch (error) {
      logger.error({ err: error, tareaId: tarea.id }, "Error enviando recordatorio de tarea");
      try {
        await liberarClaimTarea(tarea.id);
      } catch (releaseError) {
        logger.error({ err: releaseError, tareaId: tarea.id }, "Error liberando claim de recordatorio de tarea");
      }
    }
  }

  const eventosPendientes = await db
    .update(eventos)
    .set({ recordatorioEnviado: true, updatedAt: new Date() })
    .where(
      and(
        lte(eventos.recordatorio, now),
        eq(eventos.recordatorioEnviado, false),
        eq(eventos.activo, true),
        isNull(eventos.deletedAt),
        casoPadreVivo(eventos.casoId),
        clientePadreVivo(eventos.clienteId),
      ),
    )
    .returning({
      id: eventos.id,
      descripcion: eventos.descripcion,
      fechaInicio: eventos.fechaInicio,
      createdBy: eventos.createdBy,
      estudioId: eventos.estudioId,
      casoId: eventos.casoId,
    });

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

      const caso = evento.casoId ? await findCasoResumen(evento.casoId) : null;

      let enviadoEmail = false;
      let enviadoPush = false;

      try {
        enviadoEmail = await EmailService.sendRecordatorioEvento({
          id: evento.id,
          descripcion: evento.descripcion,
          fechaInicio: evento.fechaInicio,
          caso,
        }, usuario);
      } catch (error) {
        logger.error({ err: error, eventoId: evento.id, canal: "email" }, "Error enviando recordatorio de evento por email");
      }

      try {
        const pushCopy = buildEventoPushCopy({
          descripcion: evento.descripcion,
          fechaInicio: evento.fechaInicio,
          caso,
        });
        enviadoPush = await PushService.sendToUsuario(evento.createdBy, {
          title: pushCopy.title,
          body: pushCopy.body,
          url: NOTIFICATION_PATHS.evento(evento.id),
          tag: `evento-${evento.id}`,
        }, logger);
      } catch (error) {
        logger.error({ err: error, eventoId: evento.id, canal: "push" }, "Error enviando recordatorio de evento por push");
      }

      if (!enviadoEmail && !enviadoPush) {
        await liberarClaimEvento(evento.id);
        logger.warn({ eventoId: evento.id }, "Recordatorio de evento sin canales OK; claim liberado para reintento");
      }
    } catch (error) {
      logger.error({ err: error, eventoId: evento.id }, "Error enviando recordatorio de evento");
      try {
        await liberarClaimEvento(evento.id);
      } catch (releaseError) {
        logger.error({ err: releaseError, eventoId: evento.id }, "Error liberando claim de recordatorio de evento");
      }
    }
  }
}

async function findCasoResumen(casoId: number): Promise<CasoResumenNotificacion | null> {
  const [caso] = await db
    .select({ caratula: casos.caratula, nroExpte: casos.nroExpte })
    .from(casos)
    .where(and(eq(casos.id, casoId), isNull(casos.deletedAt)))
    .limit(1);
  return caso ?? null;
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
