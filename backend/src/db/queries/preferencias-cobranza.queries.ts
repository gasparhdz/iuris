import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../index.js";
import {
  casos,
  categorias,
  clientes,
  honorarios,
  parametros,
  planCuotas,
  planesPago,
  preferenciasCobranza,
  recordatoriosCobranzaLog,
  terceros,
} from "../schema.js";
import type { CuotaRecordatorio } from "../../services/cobranza-recordatorio.js";
import { PREFERENCIAS_COBRANZA_DEFAULTS } from "../../services/cobranza-recordatorio.js";

export type PreferenciasCobranza = {
  habilitado: boolean;
  diasAnticipacion: number;
  porEmail: boolean;
  porPush: boolean;
};

export class PreferenciasCobranzaQueries {
  static async findByUsuarioId(usuarioId: number) {
    const [row] = await db
      .select({
        habilitado: preferenciasCobranza.habilitado,
        diasAnticipacion: preferenciasCobranza.diasAnticipacion,
        porEmail: preferenciasCobranza.porEmail,
        porPush: preferenciasCobranza.porPush,
      })
      .from(preferenciasCobranza)
      .where(eq(preferenciasCobranza.usuarioId, usuarioId))
      .limit(1);

    return row ?? null;
  }

  static async upsert(usuarioId: number, data: PreferenciasCobranza) {
    const [row] = await db
      .insert(preferenciasCobranza)
      .values({
        usuarioId,
        habilitado: data.habilitado,
        diasAnticipacion: data.diasAnticipacion,
        porEmail: data.porEmail,
        porPush: data.porPush,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: preferenciasCobranza.usuarioId,
        set: {
          habilitado: data.habilitado,
          diasAnticipacion: data.diasAnticipacion,
          porEmail: data.porEmail,
          porPush: data.porPush,
          updatedAt: new Date(),
        },
      })
      .returning({
        habilitado: preferenciasCobranza.habilitado,
        diasAnticipacion: preferenciasCobranza.diasAnticipacion,
        porEmail: preferenciasCobranza.porEmail,
        porPush: preferenciasCobranza.porPush,
      });

    return row;
  }

  static resolveDefaults(preferencias: PreferenciasCobranza | null): PreferenciasCobranza {
    return preferencias ?? { ...PREFERENCIAS_COBRANZA_DEFAULTS };
  }
}

export class CobranzaRecordatorioQueries {
  private static async findEstadoCuotaId(codigo: string) {
    const [row] = await db
      .select({ id: parametros.id })
      .from(parametros)
      .innerJoin(categorias, eq(parametros.categoriaId, categorias.id))
      .where(and(eq(categorias.codigo, "ESTADO_CUOTA"), eq(parametros.codigo, codigo)))
      .limit(1);

    return row?.id ?? null;
  }

  static async findCuotasImpagasParaRecordatorio(): Promise<CuotaRecordatorio[]> {
    const estadoPagadaId = await this.findEstadoCuotaId("PAGADA");
    if (!estadoPagadaId) return [];
    const estadoCondonadaId = await this.findEstadoCuotaId("CONDONADA");

    const obligadoCliente = alias(clientes, "obligado_cliente");
    const clienteNombreFallback = sql<string>`COALESCE(${clientes.razonSocial}, CONCAT_WS(' ', ${clientes.nombre}, ${clientes.apellido}), 'Sin cliente')`;
    const obligadoClienteNombre = sql<string>`COALESCE(${obligadoCliente.razonSocial}, NULLIF(CONCAT_WS(', ', ${obligadoCliente.apellido}, ${obligadoCliente.nombre}), ''), ${obligadoCliente.nombre}, 'Sin cliente')`;
    const terceroNombre = sql<string>`COALESCE(${terceros.razonSocial}, NULLIF(CONCAT_WS(', ', ${terceros.apellido}, ${terceros.nombre}), ''), ${terceros.nombre}, 'Sin nombre')`;
    const clienteNombre = sql<string>`CASE
      WHEN ${honorarios.obligadoTerceroId} IS NOT NULL THEN ${terceroNombre}
      WHEN ${honorarios.obligadoClienteId} IS NOT NULL THEN ${obligadoClienteNombre}
      ELSE ${clienteNombreFallback}
    END`;

    const rows = await db
      .select({
        cuotaId: planCuotas.id,
        numero: planCuotas.numero,
        vencimiento: planCuotas.vencimiento,
        montoPesos: planCuotas.montoPesos,
        montoJus: planCuotas.montoJus,
        montoAplicado: planCuotas.montoAplicado,
        valorJusRef: planCuotas.valorJusRef,
        clienteNombre,
        casoCaratula: casos.caratula,
        createdBy: planesPago.createdBy,
      })
      .from(planCuotas)
      .innerJoin(planesPago, eq(planCuotas.planId, planesPago.id))
      .leftJoin(honorarios, and(
        eq(planesPago.honorarioId, honorarios.id),
        eq(honorarios.estudioId, planesPago.estudioId),
        isNull(honorarios.deletedAt),
      ))
      .leftJoin(terceros, and(
        eq(honorarios.obligadoTerceroId, terceros.id),
        eq(terceros.estudioId, planesPago.estudioId),
        isNull(terceros.deletedAt),
      ))
      .leftJoin(obligadoCliente, and(
        eq(honorarios.obligadoClienteId, obligadoCliente.id),
        eq(obligadoCliente.estudioId, planesPago.estudioId),
      ))
      .leftJoin(clientes, and(
        eq(planesPago.clienteId, clientes.id),
        eq(clientes.estudioId, planesPago.estudioId),
      ))
      .leftJoin(casos, and(
        eq(planesPago.casoId, casos.id),
        eq(casos.estudioId, planesPago.estudioId),
      ))
      .where(and(
        eq(planesPago.activo, true),
        isNull(planesPago.deletedAt),
        eq(planCuotas.activo, true),
        isNull(planCuotas.deletedAt),
        isNull(clientes.deletedAt),
        isNull(casos.deletedAt),
        ne(planCuotas.estadoId, estadoPagadaId),
        estadoCondonadaId ? ne(planCuotas.estadoId, estadoCondonadaId) : undefined,
        sql`${planesPago.createdBy} IS NOT NULL`,
      ));

    return rows
      .filter((row): row is typeof row & { createdBy: number } => row.createdBy !== null)
      .map((row) => ({
        cuotaId: row.cuotaId,
        numero: row.numero,
        vencimiento: row.vencimiento,
        montoPesos: row.montoPesos,
        montoJus: row.montoJus,
        montoAplicado: row.montoAplicado,
        valorJusRef: row.valorJusRef,
        clienteNombre: row.clienteNombre,
        casoCaratula: row.casoCaratula,
        createdBy: row.createdBy,
      }));
  }

  static async yaEnviadoHoy(usuarioId: number, fecha: string) {
    const [row] = await db
      .select({ id: recordatoriosCobranzaLog.id })
      .from(recordatoriosCobranzaLog)
      .where(and(
        eq(recordatoriosCobranzaLog.usuarioId, usuarioId),
        eq(recordatoriosCobranzaLog.fecha, fecha),
      ))
      .limit(1);

    return Boolean(row);
  }

  static async registrarEnvio(usuarioId: number, fecha: string): Promise<boolean> {
    const inserted = await db
      .insert(recordatoriosCobranzaLog)
      .values({ usuarioId, fecha })
      .onConflictDoNothing()
      .returning({ id: recordatoriosCobranzaLog.id });

    return inserted.length > 0;
  }
}
