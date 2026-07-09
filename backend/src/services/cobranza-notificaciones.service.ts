import { and, eq, isNull } from "drizzle-orm";
import type { FastifyBaseLogger } from "fastify";
import { db } from "../db/index.js";
import { usuarios } from "../db/schema.js";
import {
  CobranzaRecordatorioQueries,
  PreferenciasCobranzaQueries,
} from "../db/queries/preferencias-cobranza.queries.js";
import {
  agruparCuotasPorUsuario,
  buildCobranzaPushBody,
  clasificarCuotasCobranza,
  isPastDailyCobranzaWindow,
  startOfDayArgentina,
  toArgentinaDateString,
} from "./cobranza-recordatorio.js";
import { EmailService } from "./email.service.js";
import { PushService } from "./push.service.js";

export async function procesarRecordatoriosCobranza(logger: FastifyBaseLogger) {
  const now = new Date();
  if (!isPastDailyCobranzaWindow(now)) return;

  const hoyArgentina = startOfDayArgentina(now);
  const fechaLog = toArgentinaDateString(now);

  let cuotasImpagas: Awaited<ReturnType<typeof CobranzaRecordatorioQueries.findCuotasImpagasParaRecordatorio>>;
  try {
    cuotasImpagas = await CobranzaRecordatorioQueries.findCuotasImpagasParaRecordatorio();
  } catch (error) {
    logger.error({ err: error }, "Error consultando cuotas impagas para recordatorio de cobranza");
    return;
  }

  const cuotasPorUsuario = agruparCuotasPorUsuario(cuotasImpagas);

  for (const [usuarioId, cuotasUsuario] of cuotasPorUsuario) {
    try {
      const yaEnviado = await CobranzaRecordatorioQueries.yaEnviadoHoy(usuarioId, fechaLog);
      if (yaEnviado) continue;

      const preferenciasRaw = await PreferenciasCobranzaQueries.findByUsuarioId(usuarioId);
      const preferencias = PreferenciasCobranzaQueries.resolveDefaults(preferenciasRaw);
      if (!preferencias.habilitado) continue;

      const { vencidas, porVencer } = clasificarCuotasCobranza(
        cuotasUsuario,
        hoyArgentina,
        preferencias.diasAnticipacion,
      );

      if (vencidas.length === 0 && porVencer.length === 0) continue;

      if (!preferencias.porEmail && !preferencias.porPush) continue;

      const registrado = await CobranzaRecordatorioQueries.registrarEnvio(usuarioId, fechaLog);
      if (!registrado) continue;

      const usuario = await findUsuarioDestino(usuarioId);
      if (!usuario) {
        logger.warn({ usuarioId }, "Usuario destino no encontrado para recordatorio de cobranza");
        continue;
      }

      if (preferencias.porEmail) {
        await EmailService.sendRecordatorioCobranza({ vencidas, porVencer }, usuario);
      }

      if (preferencias.porPush) {
        await PushService.sendToUsuario(usuarioId, {
          title: "Cobranzas pendientes",
          body: buildCobranzaPushBody(vencidas.length, porVencer.length),
          url: "/finanzas",
          tag: "cobranza-diaria",
        }, logger);
      }
    } catch (error) {
      logger.error({ err: error, usuarioId }, "Error enviando recordatorio de cobranza");
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
