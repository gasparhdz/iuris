import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db/index.js";
import { CasosQueries } from "../db/queries/casos.queries.js";
import { EventosQueries } from "../db/queries/eventos.queries.js";
import { TareasQueries } from "../db/queries/tareas.queries.js";
import { movimientosJudiciales, movimientosVistos } from "../db/schema.js";
import { serializeDates } from "../utils/serialize.js";
import { AuditoriaService } from "./auditoria.service.js";

export type AgendarMovimientoInput =
  | {
      tipo: "tarea";
      movimientoId: number;
      titulo: string;
      descripcion?: string | null;
      fechaLimite: string;
      recordatorio?: string | null;
    }
  | {
      tipo: "evento";
      movimientoId: number;
      descripcion: string;
      fechaInicio: string;
      tipoId: number;
      estadoId?: number | null;
      recordatorio?: string | null;
    };

export class AgendarMovimientoService {
  static async agendar(estudioId: number, userId: number, input: AgendarMovimientoInput) {
    return await db.transaction(async (tx) => {
      const [movimiento] = await tx
        .select({
          id: movimientosJudiciales.id,
          casoId: movimientosJudiciales.casoId,
          estudioId: movimientosJudiciales.estudioId,
        })
        .from(movimientosJudiciales)
        .where(and(
          eq(movimientosJudiciales.id, input.movimientoId),
          eq(movimientosJudiciales.estudioId, estudioId),
        ))
        .limit(1);

      if (!movimiento) throw new Error("MOVIMIENTO_NOT_FOUND");

      const caso = await CasosQueries.findById(movimiento.casoId, estudioId);
      if (!caso) throw new Error("PADRE_ELIMINADO");

      // Idempotencia: si ya hay tarea viva para este movimiento, devolverla.
      if (input.tipo === "tarea") {
        const existente = await TareasQueries.findByMovimientoId(input.movimientoId, estudioId);
        if (existente) {
          await marcarVisto(tx, estudioId, userId, input.movimientoId);
          return { tipo: "tarea" as const, item: serializeDates(existente), alreadyExisted: true };
        }

        const tarea = await TareasQueries.insert(tx, {
          titulo: input.titulo,
          descripcion: input.descripcion ?? null,
          fechaLimite: new Date(input.fechaLimite),
          recordatorio: input.recordatorio ? new Date(input.recordatorio) : null,
          casoId: movimiento.casoId,
          movimientoId: input.movimientoId,
          estudioId,
          createdBy: userId,
        });

        await marcarVisto(tx, estudioId, userId, input.movimientoId);

        await AuditoriaService.log({
          estudioId,
          usuarioId: userId,
          entidad: "tarea",
          entidadId: tarea.id,
          accion: "CREATE",
          descripcion: "Tarea agendada desde movimiento SISFE",
        });

        return { tipo: "tarea" as const, item: serializeDates(tarea), alreadyExisted: false };
      }

      const evento = await EventosQueries.insert(tx, {
        descripcion: input.descripcion,
        fechaInicio: new Date(input.fechaInicio),
        tipoId: input.tipoId,
        estadoId: input.estadoId ?? null,
        recordatorio: input.recordatorio ? new Date(input.recordatorio) : null,
        casoId: movimiento.casoId,
        estudioId,
        createdBy: userId,
      });

      await marcarVisto(tx, estudioId, userId, input.movimientoId);

      await AuditoriaService.log({
        estudioId,
        usuarioId: userId,
        entidad: "evento",
        entidadId: evento.id,
        accion: "CREATE",
        descripcion: "Evento agendado desde movimiento SISFE",
      });

      return { tipo: "evento" as const, item: serializeDates(evento), alreadyExisted: false };
    });
  }
}

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function marcarVisto(tx: DbTransaction, estudioId: number, usuarioId: number, movimientoId: number) {
  await tx
    .insert(movimientosVistos)
    .values({ estudioId, movimientoId, usuarioId })
    .onConflictDoNothing();
}
