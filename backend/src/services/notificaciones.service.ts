import cron from "node-cron";
import { and, eq, exists, isNull, lte, or } from "drizzle-orm";
import type { FastifyBaseLogger } from "fastify";
import { db } from "../db/index.js";
import { casos, clientes, eventos, subTareas, tareas, usuarios } from "../db/schema.js";
import { EmailService } from "./email.service.js";
import { PushService } from "./push.service.js";
import { procesarRecordatoriosCobranza } from "./cobranza-notificaciones.service.js";

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

function casoPadreVivo(casoIdCol: typeof tareas.casoId | typeof eventos.casoId) {
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

function clientePadreVivo(clienteIdCol: typeof tareas.clienteId | typeof eventos.clienteId) {
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

async function procesarRecordatorios(logger: FastifyBaseLogger) {
  const now = new Date();

  // Claim atómico: solo las filas reclamadas se envían (evita duplicados por doble instancia/reinicio).
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

      const casoCaratula = tarea.casoId ? await findCasoCaratula(tarea.casoId) : null;
      const subtareas = await findSubtareasTarea(tarea.id, tarea.estudioId);

      await EmailService.sendRecordatorioTarea({
        titulo: tarea.titulo,
        descripcion: tarea.descripcion,
        fechaLimite: tarea.fechaLimite,
        casoCaratula,
        subtareas,
      }, usuario);

      await PushService.sendToUsuario(usuarioId, {
        title: "Recordatorio de tarea",
        body: tarea.titulo,
        url: "/tareas",
        tag: `tarea-${tarea.id}`,
      }, logger);
    } catch (error) {
      logger.error({ err: error, tareaId: tarea.id }, "Error enviando recordatorio de tarea");
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

      await EmailService.sendRecordatorioEvento({
        descripcion: evento.descripcion,
        fechaInicio: evento.fechaInicio,
      }, usuario);

      await PushService.sendToUsuario(evento.createdBy, {
        title: "Recordatorio de evento",
        body: evento.descripcion ?? "Evento próximo",
        url: "/agenda",
        tag: `evento-${evento.id}`,
      }, logger);
    } catch (error) {
      logger.error({ err: error, eventoId: evento.id }, "Error enviando recordatorio de evento");
    }
  }
}

async function findCasoCaratula(casoId: number) {
  const [caso] = await db
    .select({ caratula: casos.caratula })
    .from(casos)
    .where(and(eq(casos.id, casoId), isNull(casos.deletedAt)))
    .limit(1);
  return caso?.caratula ?? null;
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
