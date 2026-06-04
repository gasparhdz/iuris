import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import { env } from "./env.js";
import { authPlugin } from "./plugins/auth.plugin.js";
import { authRoutes } from "./routes/auth.routes.js";
import { clientesRoutes } from "./routes/clientes.routes.js";
import { catalogosRoutes } from "./routes/catalogos.routes.js";
import { tercerosRoutes } from "./routes/terceros.routes.js";
import { expedientesRoutes } from "./routes/expedientes.routes.js";
import { eventosRoutes } from "./routes/eventos.routes.js";
import { tareasRoutes } from "./routes/tareas.routes.js";
import { agendaRoutes } from "./routes/agenda.routes.js";
import { movimientosRoutes } from "./routes/movimientos.routes.js";
import { notasRoutes } from "./routes/notas.routes.js";
import { valorJusRoutes } from "./routes/valorjus.routes.js";
import { honorariosRoutes } from "./routes/honorarios.routes.js";
import { planesRoutes } from "./routes/planes.routes.js";
import { gastosRoutes } from "./routes/gastos.routes.js";
import { ingresosRoutes } from "./routes/ingresos.routes.js";
import { liquidacionRoutes } from "./routes/liquidacion.routes.js";
import { adjuntosRoutes } from "./routes/adjuntos.routes.js";
import { driveRoutes } from "./routes/drive.routes.js";
import { plantillasRoutes } from "./routes/plantillas.routes.js";
import { adminRoutes } from "./routes/admin.routes.js";
import { equipoRoutes } from "./routes/equipo.routes.js";
import { notificacionesRoutes } from "./routes/notificaciones.routes.js";
import { searchRoutes } from "./routes/search.routes.js";
import { auditoriaRoutes } from "./routes/auditoria.routes.js";
import { sisfeRoutes } from "./routes/sisfe.routes.js";
import { webhooksRoutes } from "./routes/webhooks.routes.js";
import { closeSisfeQueue, sisfeSyncQueue } from "./queue/sisfe.queue.js";
import { closeSisfeWorker } from "./queue/sisfe.worker.js";
import { closeBrowserPool } from "./services/browser-pool.js";
import { iniciarCronNotificaciones } from "./services/notificaciones.service.js";
import { iniciarCronValorJus } from "./services/valorjus-cron.service.js";
import { iniciarCronStorageWatch } from "./services/storage-watch.service.js";
import { swaggerPlugin } from "./plugins/swagger.plugin.js";
import { dateSerializationPlugin } from "./plugins/serialization.plugin.js";
import { errorHandlerPlugin } from "./plugins/error-handler.plugin.js";
import { SecurityAuditService } from "./services/security-audit.service.js";
import { db } from "./db/index.js";
import { sql } from "drizzle-orm";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { documentedResponses, healthDependencyFailureResponseSchema, healthResponseSchema } from "./schemas/common.schema.js";

const server = Fastify({
  trustProxy: true,
  // Evita el log automatico de "incoming request" / "request completed" por
  // cada peticion (ruido en consola). Los errores y logs propios se mantienen.
  disableRequestLogging: true,
  logger: {
    level: env.LOG_LEVEL,
    transport: env.NODE_ENV === "development" ? {
      target: "pino-pretty",
    } : undefined,
  },
});

// Configurar Zod como Type Provider
server.setValidatorCompiler(validatorCompiler);
server.setSerializerCompiler(serializerCompiler);

// Registrar Plugins
const corsOrigin = env.NODE_ENV === "production" && env.CORS_ORIGIN
  ? env.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean)
  : true;

server.register(cors, {
  origin: corsOrigin,
});
server.register(rateLimit, {
  global: false, // Solo aplica a rutas que lo configuren explícitamente
});
server.register(multipart, {
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
});
server.register(swaggerPlugin);
server.register(dateSerializationPlugin);
server.register(errorHandlerPlugin);
server.register(authPlugin);

server.addHook("onResponse", async (request, reply) => {
  const pathname = new URL(request.url, "http://iuris.local").pathname;
  const isDenied = reply.statusCode === 401 || reply.statusCode === 403;
  if (isDenied) {
    await SecurityAuditService.log({
      evento: "ACCESS_DENIED",
      request,
      statusCode: reply.statusCode,
      metadata: { route: pathname },
    });
  }

  if (pathname.startsWith("/api/v1/admin")) {
    await SecurityAuditService.log({
      evento: "ADMIN_ACTION",
      request,
      statusCode: reply.statusCode,
      targetEstudioId: extractTargetEstudioId(pathname),
    });
  }
});

// Registrar Rutas
server.register(authRoutes, { prefix: "/api/v1/auth" });
server.register(catalogosRoutes, { prefix: "/api/v1/catalogos" });
server.register(clientesRoutes, { prefix: "/api/v1/clientes" });
server.register(tercerosRoutes, { prefix: "/api/v1/terceros" });
server.register(expedientesRoutes, { prefix: "/api/v1/expedientes" });
server.register(eventosRoutes, { prefix: "/api/v1/eventos" });
server.register(tareasRoutes, { prefix: "/api/v1/tareas" });
server.register(agendaRoutes, { prefix: "/api/v1/agenda" });
server.register(movimientosRoutes, { prefix: "/api/v1" });
server.register(notasRoutes, { prefix: "/api/v1" });
server.register(valorJusRoutes, { prefix: "/api/v1/valorjus" });
server.register(honorariosRoutes, { prefix: "/api/v1/honorarios" });
server.register(planesRoutes, { prefix: "/api/v1" });
server.register(gastosRoutes, { prefix: "/api/v1/gastos" });
server.register(ingresosRoutes, { prefix: "/api/v1/ingresos" });
server.register(liquidacionRoutes, { prefix: "/api/v1" });
server.register(driveRoutes, { prefix: "/api/v1/drive" });
server.register(adjuntosRoutes, { prefix: "/api/v1/adjuntos" });
server.register(plantillasRoutes, { prefix: "/api/v1" });
server.register(adminRoutes, { prefix: "/api/v1/admin" });
server.register(equipoRoutes, { prefix: "/api/v1/equipo" });
server.register(notificacionesRoutes, { prefix: "/api/v1/notificaciones" });
server.register(searchRoutes, { prefix: "/api/v1/search" });
server.register(auditoriaRoutes, { prefix: "/api/v1/auditoria" });
server.register(sisfeRoutes, { prefix: "/api/v1/sisfe" });
server.register(webhooksRoutes, { prefix: "/api/v1/webhooks" });

// Ruta base para testear
server.get("/api/v1/health", {
  schema: {
    tags: ["Health"],
    summary: "Estado del backend",
    response: {
      ...documentedResponses(200, healthResponseSchema),
      503: healthDependencyFailureResponseSchema,
    },
  },
}, async (_request, reply) => {
  const dependencies = {
    postgres: await checkPostgres(),
    redis: await checkRedis(),
  };

  if (dependencies.postgres === "error" || dependencies.redis === "error") {
    return reply.code(503).send({
      error: {
        code: "HEALTH_CHECK_FAILED",
        message: "Una o mas dependencias no estan disponibles",
        dependencies,
      },
    });
  }

  return { data: { status: "ok", environment: env.NODE_ENV, timestamp: new Date().toISOString(), dependencies } };
});

// Función de arranque
const start = async () => {
  try {
    const host = env.NODE_ENV === "production" ? "127.0.0.1" : "0.0.0.0";
    await server.listen({ port: env.PORT, host });
    server.log.info(`🚀 Iuris Backend running at http://localhost:${env.PORT}`);
    process.send?.("ready");
    iniciarCronNotificaciones(server.log);
    iniciarCronValorJus(server.log);
    iniciarCronStorageWatch();

    // Resetear cualquier estado de sincronización 'running' colgado de una ejecución previa
    try {
      const { db } = await import("./db/index.js");
      const { sisfeSessions } = await import("./db/schema.js");
      const { eq } = await import("drizzle-orm");
      await db.update(sisfeSessions)
        .set({
          syncStatus: "idle",
          syncProgress: 0,
          syncMessage: "Sincronización cancelada por reinicio del servidor",
        })
        .where(eq(sisfeSessions.syncStatus, "running"));
      server.log.info("🧹 Estados de sincronización 'running' reseteados correctamente.");
    } catch (resetErr) {
      server.log.error(resetErr, "Error al resetear estados de sincronización en el arranque");
    }
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();

let shuttingDown = false;

async function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) return;
  shuttingDown = true;

  server.log.info({ signal }, "Cerrando backend");
  try {
    await server.close();
    await closeSisfeWorker();
    await closeSisfeQueue();
    await closeBrowserPool();
    process.exit(0);
  } catch (error) {
    server.log.error(error, "Error durante el cierre ordenado");
    process.exit(1);
  }
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

function extractTargetEstudioId(pathname: string) {
  const match = pathname.match(/\/admin\/estudios\/(\d+)/);
  return match ? Number(match[1]) : null;
}

async function checkPostgres() {
  try {
    await db.execute(sql`SELECT 1`);
    return "ok" as const;
  } catch (error) {
    server.log.error(error, "Health check PostgreSQL fallido");
    return "error" as const;
  }
}

async function checkRedis() {
  try {
    const client = await sisfeSyncQueue.client;
    await client.info();
    return "ok" as const;
  } catch (error) {
    server.log.error(error, "Health check Redis fallido");
    return "error" as const;
  }
}
