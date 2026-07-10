import { and, eq, isNull } from "drizzle-orm";
import type { FastifyBaseLogger } from "fastify";
import { db } from "../db/index.js";
import { usuarios } from "../db/schema.js";
import { env } from "../env.js";
import {
  CobranzaRecordatorioQueries,
  PreferenciasCobranzaQueries,
} from "../db/queries/preferencias-cobranza.queries.js";
import {
  agruparCuotasPorUsuario,
  clasificarCuotasCobranza,
  isPastDailyCobranzaWindow,
  startOfDayArgentina,
  toArgentinaDateString,
} from "./cobranza-recordatorio.js";
import { buildCobranzaPushCopy, NOTIFICATION_PATHS } from "./notification-copy.js";
import { EmailService } from "./email.service.js";
import { PushService } from "./push.service.js";

export async function procesarRecordatoriosCobranza(logger: FastifyBaseLogger) {
  const now = new Date();
  if (!isPastDailyCobranzaWindow(now, env.COBRANZA_HORA_ART)) return;

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

      const usuario = await findUsuarioDestino(usuarioId);
      if (!usuario) {
        logger.warn({ usuarioId }, "Usuario destino no encontrado para recordatorio de cobranza");
        continue;
      }

      const preferenciasRaw = await PreferenciasCobranzaQueries.findByUsuarioId(usuarioId, usuario.estudioId);
      const preferencias = PreferenciasCobranzaQueries.resolveDefaults(preferenciasRaw);
      if (!preferencias.habilitado) continue;

      const { vencidas, porVencer } = clasificarCuotasCobranza(
        cuotasUsuario,
        hoyArgentina,
        preferencias.diasAnticipacion,
      );

      if (vencidas.length === 0 && porVencer.length === 0) continue;

      if (!preferencias.porEmail && !preferencias.porPush) continue;

      let enviadoEmail = false;
      let enviadoPush = false;

      if (preferencias.porEmail) {
        try {
          enviadoEmail = await EmailService.sendRecordatorioCobranza({ vencidas, porVencer }, usuario);
          if (enviadoEmail) {
            logger.info({ usuarioId, canal: "email" }, "Recordatorio de cobranza enviado");
          }
        } catch (error) {
          logger.error({ err: error, usuarioId, canal: "email" }, "Error enviando recordatorio de cobranza por email");
        }
      }

      if (preferencias.porPush) {
        try {
          const pushCopy = buildCobranzaPushCopy({ vencidas, porVencer });
          enviadoPush = await PushService.sendToUsuario(usuarioId, {
            title: pushCopy.title,
            body: pushCopy.body,
            url: NOTIFICATION_PATHS.cobranza(),
            tag: "cobranza-diaria",
          }, logger);
          if (enviadoPush) {
            logger.info({ usuarioId, canal: "push" }, "Recordatorio de cobranza enviado");
          }
        } catch (error) {
          logger.error({ err: error, usuarioId, canal: "push" }, "Error enviando recordatorio de cobranza por push");
        }
      }

      // Registrar DESPUÉS del envío exitoso por canal: un fallo de SMTP no debe
      // marcar el día como enviado y dejar al usuario sin recordatorio.
      if (enviadoEmail || enviadoPush) {
        await CobranzaRecordatorioQueries.registrarEnvio(usuarioId, fechaLog);
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
      estudioId: usuarios.estudioId,
      email: usuarios.email,
      nombre: usuarios.nombre,
      apellido: usuarios.apellido,
    })
    .from(usuarios)
    .where(and(eq(usuarios.id, usuarioId), eq(usuarios.activo, true), isNull(usuarios.deletedAt)))
    .limit(1);

  return usuario;
}
