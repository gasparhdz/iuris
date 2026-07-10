import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { and, asc, eq, gte, ilike, inArray, isNull, lte, not, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { casos, eventos, movimientosJudiciales, movimientosVistos, sisfeSessions, tareas } from "../db/schema.js";
import { documentedResponses } from "../schemas/common.schema.js";
import { AuthQueries } from "../db/queries/auth.queries.js";
import { PushService } from "../services/push.service.js";
import { AgendarMovimientoService } from "../services/agendar-movimiento.service.js";
import { env } from "../env.js";
import { PreferenciasCobranzaQueries } from "../db/queries/preferencias-cobranza.queries.js";

const NOVEDADES_DEFAULT_LIMIT = 50;

const novedadesQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(NOVEDADES_DEFAULT_LIMIT),
  offset: z.coerce.number().int().min(0).default(0),
}).strict();

const novedadesResponseSchema = z.object({
  data: z.object({
    novedades: z.array(z.object({
      id: z.number(),
      casoId: z.number(),
      caratula: z.string().nullable(),
      nroExpte: z.string().nullable(),
      descripcion: z.string().nullable(),
      tipo: z.string(),
      novedad: z.string().nullable(),
      fecha: z.string(),
      createdAt: z.string(),
    })),
    total: z.number(),
  }),
});

const marcarLeidoBodySchema = z.object({
  // Solo marca los IDs materializados en la UI (no "todas las no vistas" al momento del request).
  movimientoIds: z.array(z.number().int().positive()).min(1),
});

const agendarMovimientoBodySchema = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("tarea"),
    movimientoId: z.number().int().positive(),
    titulo: z.string().min(3).max(255),
    descripcion: z.string().optional().nullable(),
    fechaLimite: z.string().datetime(),
    recordatorio: z.string().datetime().optional().nullable(),
  }).strict(),
  z.object({
    tipo: z.literal("evento"),
    movimientoId: z.number().int().positive(),
    descripcion: z.string().min(3).max(255),
    fechaInicio: z.string().datetime(),
    tipoId: z.number().int().positive(),
    estadoId: z.number().int().positive().optional().nullable(),
    recordatorio: z.string().datetime().optional().nullable(),
  }).strict(),
]);

const agendarMovimientoResponseSchema = z.object({
  data: z.object({
    tipo: z.enum(["tarea", "evento"]),
    alreadyExisted: z.boolean(),
    item: z.record(z.string(), z.unknown()),
  }),
});

const pushSubscribeBodySchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

const pushUnsubscribeBodySchema = z.object({
  endpoint: z.string().url(),
});

const vapidPublicKeyResponseSchema = z.object({
  data: z.object({
    publicKey: z.string().nullable(),
    enabled: z.boolean(),
  }),
});

const pushOkResponseSchema = z.object({
  data: z.object({
    ok: z.literal(true),
  }),
});

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

const preferenciasCobranzaSchema = z.object({
  habilitado: z.boolean(),
  diasAnticipacion: z.number().int().min(0).max(30),
  porEmail: z.boolean(),
  porPush: z.boolean(),
});

const preferenciasCobranzaResponseSchema = z.object({
  data: preferenciasCobranzaSchema,
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

    // Cada recordatorio se incluye solo si el usuario tiene lectura del modulo respectivo.
    const permisos = await AuthQueries.findUserPermisos(request.authUser.id);
    const verTareas = permisos.some((p) => p.modulo === "TAREAS" && p.ver);
    const verEventos = permisos.some((p) => p.modulo === "EVENTOS" && p.ver);

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
            isNull(tareas.deletedAt),
            verTareas ? undefined : sql`false`
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
            isNull(eventos.deletedAt),
            verEventos ? undefined : sql`false`
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

  // Movimientos judiciales de origen SISFE que el usuario todavía no marcó como vistos.
  server.get("/novedades", {
    preHandler: [fastify.authenticate, fastify.authorize("CASOS", "ver")],
    schema: {
      tags: ["Notificaciones"],
      summary: "Listar novedades de expedientes (movimientos SISFE no leidos)",
      security: [{ bearerAuth: [] }],
      querystring: novedadesQuerySchema,
      response: documentedResponses(200, novedadesResponseSchema),
    },
  }, async (request) => {
    const estudioId = request.authUser.estudioId;
    const usuarioId = request.authUser.id;
    const { limit, offset } = request.query as z.infer<typeof novedadesQuerySchema>;

    // Matrícula SISFE del usuario: si la tenemos, descartamos las novedades que el propio
    // usuario presentó (la observación del movimiento incluye "Presentante: ... - <matrícula>").
    const [sesion] = await db
      .select({ sisfeMatricula: sisfeSessions.sisfeMatricula })
      .from(sisfeSessions)
      .where(eq(sisfeSessions.usuarioId, usuarioId))
      .limit(1);
    const matricula = sesion?.sisfeMatricula?.trim();

    const noVistoCondition = and(
      eq(movimientosJudiciales.estudioId, estudioId),
      eq(movimientosJudiciales.origenSisfe, true),
      isNull(movimientosVistos.id),
      isNull(casos.deletedAt),
      ...(matricula
        ? [or(
            isNull(movimientosJudiciales.descripcion),
            not(ilike(movimientosJudiciales.descripcion, `%${matricula}%`)),
          )]
        : []),
    );

    const novedades = await db
      .select({
        id: movimientosJudiciales.id,
        casoId: movimientosJudiciales.casoId,
        caratula: casos.caratula,
        nroExpte: casos.nroExpte,
        descripcion: casos.descripcion,
        tipo: movimientosJudiciales.tipo,
        novedad: movimientosJudiciales.novedad,
        fecha: movimientosJudiciales.fecha,
        createdAt: movimientosJudiciales.createdAt,
      })
      .from(movimientosJudiciales)
      .innerJoin(casos, eq(movimientosJudiciales.casoId, casos.id))
      .leftJoin(
        movimientosVistos,
        and(
          eq(movimientosVistos.movimientoId, movimientosJudiciales.id),
          eq(movimientosVistos.usuarioId, usuarioId),
        ),
      )
      .where(noVistoCondition)
      .orderBy(asc(movimientosJudiciales.fecha))
      .limit(limit)
      .offset(offset);

    const [{ total }] = await db
      .select({ total: sql<number>`cast(count(*) as int)` })
      .from(movimientosJudiciales)
      .innerJoin(casos, eq(movimientosJudiciales.casoId, casos.id))
      .leftJoin(
        movimientosVistos,
        and(
          eq(movimientosVistos.movimientoId, movimientosJudiciales.id),
          eq(movimientosVistos.usuarioId, usuarioId),
        ),
      )
      .where(noVistoCondition);

    return {
      data: {
        novedades: novedades.map((n) => ({
          ...n,
          fecha: n.fecha.toISOString(),
          createdAt: n.createdAt.toISOString(),
        })),
        total,
      },
    };
  });

  // Agendar tarea/evento desde una novedad SISFE (transaccional + marca leída).
  server.post("/novedades/agendar", {
    preHandler: [fastify.authenticate, fastify.authorize("CASOS", "ver")],
    schema: {
      tags: ["Notificaciones"],
      summary: "Agendar tarea o evento desde un movimiento SISFE",
      security: [{ bearerAuth: [] }],
      body: agendarMovimientoBodySchema,
      response: documentedResponses(200, agendarMovimientoResponseSchema),
    },
  }, async (request, reply) => {
    const body = request.body as z.infer<typeof agendarMovimientoBodySchema>;
    const permisos = await AuthQueries.findUserPermisos(request.authUser.id);
    const puedeCrear = body.tipo === "tarea"
      ? permisos.some((p) => p.modulo === "TAREAS" && p.crear)
      : permisos.some((p) => p.modulo === "EVENTOS" && p.crear);
    if (!puedeCrear) {
      return reply.status(403).send({
        error: { code: "FORBIDDEN", message: "No tenés permiso para crear este tipo de ítem" },
      });
    }

    const result = await AgendarMovimientoService.agendar(
      request.authUser.estudioId,
      request.authUser.id,
      body,
    );
    return reply.send({ data: result });
  });

  // Marca novedades como leídas (idempotente). Solo los IDs enviados.
  server.post("/novedades/marcar-leido", {
    preHandler: [fastify.authenticate, fastify.authorize("CASOS", "ver")],
    schema: {
      tags: ["Notificaciones"],
      summary: "Marcar novedades de expedientes como leidas",
      security: [{ bearerAuth: [] }],
      body: marcarLeidoBodySchema,
      response: documentedResponses(200, z.object({ data: z.object({ marcados: z.number() }) })),
    },
  }, async (request) => {
    const estudioId = request.authUser.estudioId;
    const usuarioId = request.authUser.id;
    const { movimientoIds } = request.body as z.infer<typeof marcarLeidoBodySchema>;

    const objetivo = await db
      .select({ id: movimientosJudiciales.id })
      .from(movimientosJudiciales)
      .leftJoin(
        movimientosVistos,
        and(
          eq(movimientosVistos.movimientoId, movimientosJudiciales.id),
          eq(movimientosVistos.usuarioId, usuarioId),
        ),
      )
      .where(and(
        eq(movimientosJudiciales.estudioId, estudioId),
        eq(movimientosJudiciales.origenSisfe, true),
        isNull(movimientosVistos.id),
        inArray(movimientosJudiciales.id, movimientoIds),
      ));

    if (objetivo.length === 0) {
      return { data: { marcados: 0 } };
    }

    await db
      .insert(movimientosVistos)
      .values(objetivo.map((m) => ({ estudioId, movimientoId: m.id, usuarioId })))
      .onConflictDoNothing();

    return { data: { marcados: objetivo.length } };
  });

  server.get("/push/vapid-public-key", {
    ...authConfig,
    schema: {
      tags: ["Notificaciones"],
      summary: "Obtener clave publica VAPID para suscripcion push",
      security: [{ bearerAuth: [] }],
      response: documentedResponses(200, vapidPublicKeyResponseSchema),
    },
  }, async () => {
    const enabled = PushService.isEnabled();
    return {
      data: {
        publicKey: enabled ? env.VAPID_PUBLIC_KEY ?? null : null,
        enabled,
      },
    };
  });

  server.post("/push/subscribe", {
    ...authConfig,
    schema: {
      tags: ["Notificaciones"],
      summary: "Registrar suscripcion push del dispositivo",
      security: [{ bearerAuth: [] }],
      body: pushSubscribeBodySchema,
      response: documentedResponses(200, pushOkResponseSchema),
    },
  }, async (request) => {
    const { endpoint, keys } = request.body as z.infer<typeof pushSubscribeBodySchema>;
    const userAgent = request.headers["user-agent"];

    await PushService.saveSubscription({
      estudioId: request.authUser.estudioId,
      usuarioId: request.authUser.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: typeof userAgent === "string" ? userAgent : null,
    });

    return { data: { ok: true as const } };
  });

  server.post("/push/unsubscribe", {
    ...authConfig,
    schema: {
      tags: ["Notificaciones"],
      summary: "Eliminar suscripcion push del dispositivo",
      security: [{ bearerAuth: [] }],
      body: pushUnsubscribeBodySchema,
      response: documentedResponses(200, pushOkResponseSchema),
    },
  }, async (request) => {
    const { endpoint } = request.body as z.infer<typeof pushUnsubscribeBodySchema>;

    await PushService.deleteSubscription(endpoint, request.authUser.id);

    return { data: { ok: true as const } };
  });

  server.get("/cobranza/preferencias", {
    ...authConfig,
    schema: {
      tags: ["Notificaciones"],
      summary: "Obtener preferencias de recordatorios de cobranza del usuario autenticado",
      security: [{ bearerAuth: [] }],
      response: documentedResponses(200, preferenciasCobranzaResponseSchema),
    },
  }, async (request) => {
    const estudioId = request.user.estudioId;
    if (!estudioId) {
      return { data: PreferenciasCobranzaQueries.resolveDefaults(null) };
    }
    const preferencias = await PreferenciasCobranzaQueries.findByUsuarioId(request.authUser.id, estudioId);
    return {
      data: PreferenciasCobranzaQueries.resolveDefaults(preferencias),
    };
  });

  server.put("/cobranza/preferencias", {
    ...authConfig,
    schema: {
      tags: ["Notificaciones"],
      summary: "Actualizar preferencias de recordatorios de cobranza del usuario autenticado",
      security: [{ bearerAuth: [] }],
      body: preferenciasCobranzaSchema,
      response: documentedResponses(200, preferenciasCobranzaResponseSchema),
    },
  }, async (request, reply) => {
    const estudioId = request.user.estudioId;
    if (!estudioId) {
      return reply.status(401).send({ error: { code: "UNAUTHORIZED", message: "Sesion invalida" } });
    }
    const body = request.body as z.infer<typeof preferenciasCobranzaSchema>;
    const saved = await PreferenciasCobranzaQueries.upsert(request.authUser.id, estudioId, body);
    if (!saved) {
      return reply.status(403).send({ error: { code: "FORBIDDEN", message: "Usuario inactivo" } });
    }
    return { data: saved };
  });
};
