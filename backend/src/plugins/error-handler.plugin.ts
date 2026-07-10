import fp from "fastify-plugin";
import { hasZodFastifySchemaValidationErrors } from "fastify-type-provider-zod";
import { ZodError } from "zod";
import { SystemErrorLogsService } from "../services/system-error-logs.service.js";
import type { FastifyError, FastifyRequest } from "fastify";

interface RouteRegistryEntry {
  pattern: RegExp;
  methods: Set<string>;
}

const notFoundCodes = new Set([
  "CLIENTE_NOT_FOUND",
  "TERCERO_NOT_FOUND",
  "CASO_NOT_FOUND",
  "EVENTO_NOT_FOUND",
  "TAREA_NOT_FOUND",
  "SUBTAREA_NOT_FOUND",
  "PARTICIPANTE_NOT_FOUND",
  "MOVIMIENTO_NOT_FOUND",
]);

const conflictCodes = new Set([
  "EMAIL_IN_USE",
  "DUPLICATE_RESOURCE",
  "RESOURCE_CONFLICT",
  "CASO_DUPLICATE_NRO_EXPTE",
]);

const forbiddenCodes = new Set([
  "UNAUTHORIZED_TENANT_REFERENCE",
  "PLATFORM_ROLE_FORBIDDEN",
]);

export const errorHandlerPlugin = fp(async (fastify) => {
  const registeredRoutes = new Map<string, RouteRegistryEntry>();

  fastify.addHook("onRoute", (routeOptions) => {
    const url = routeOptions.url;
    const methods = Array.isArray(routeOptions.method) ? routeOptions.method : [routeOptions.method];
    const entry = registeredRoutes.get(url) ?? {
      pattern: routePatternToRegex(url),
      methods: new Set<string>(),
    };

    for (const method of methods) {
      entry.methods.add(method.toUpperCase());
    }

    registeredRoutes.set(url, entry);
  });

  fastify.setErrorHandler((error: FastifyError, request, reply) => {
    if (hasZodFastifySchemaValidationErrors(error) || error instanceof ZodError || error.validation) {
      request.log.warn(error);
      return reply.status(400).send({
        error: {
          code: "INVALID_INPUT",
          message: "Input invalido",
        },
      });
    }

    if (error.statusCode === 429) {
      logSystemError(request, {
        nivel: "WARN",
        statusCode: 429,
        errorCode: "RATE_LIMITED",
        mensaje: "Demasiadas solicitudes",
      });
      return reply.status(429).send({
        error: {
          code: "RATE_LIMITED",
          message: "Demasiadas solicitudes. Intente nuevamente mas tarde.",
        },
      });
    }

    if (error.code === "FST_JWT_NO_AUTHORIZATION_IN_HEADER" || error.code === "FST_JWT_AUTHORIZATION_TOKEN_INVALID" || error.code === "FST_JWT_AUTHORIZATION_TOKEN_EXPIRED") {
      return reply.status(401).send({
        error: {
          code: "UNAUTHORIZED",
          message: "Token requerido, invalido o expirado",
        },
      });
    }

    if (notFoundCodes.has(error.message)) {
      logSystemError(request, {
        nivel: "WARN",
        statusCode: 404,
        errorCode: "NOT_FOUND",
        mensaje: "Recurso no encontrado",
      });
      return reply.status(404).send({
        error: {
          code: "NOT_FOUND",
          message: "Recurso no encontrado",
        },
      });
    }

    if (error.message === "MONEDA_NO_SOPORTADA") {
      logSystemError(request, {
        nivel: "WARN",
        statusCode: 422,
        errorCode: error.message,
        mensaje: "Moneda no soportada",
      });
      return reply.status(422).send({
        error: {
          code: error.message,
          message: "La moneda seleccionada no está habilitada.",
        },
      });
    }

    if (error.message === "INGRESO_IMPUTADO_NO_EDITABLE") {
      logSystemError(request, {
        nivel: "WARN",
        statusCode: 409,
        errorCode: error.message,
        mensaje: "No se puede editar un cobro ya imputado",
      });
      return reply.status(409).send({
        error: {
          code: error.message,
          message: "No se puede editar el monto, la fecha ni la cotización de un cobro ya imputado. Eliminá el cobro y registralo de nuevo.",
        },
      });
    }

    if (error.message === "PADRE_ELIMINADO") {
      logSystemError(request, {
        nivel: "WARN",
        statusCode: 409,
        errorCode: error.message,
        mensaje: "El expediente o cliente vinculado fue eliminado",
      });
      return reply.status(409).send({
        error: {
          code: error.message,
          message: "No se puede modificar: el expediente o cliente vinculado fue eliminado",
        },
      });
    }

    if (error.message === "CLIENT_DUPLICATE_DNI_OR_CUIT") {
      logSystemError(request, {
        nivel: "WARN",
        statusCode: 409,
        errorCode: error.message,
        mensaje: "Ya existe un cliente con ese DNI o CUIT",
      });
      return reply.status(409).send({
        error: {
          code: error.message,
          message: "Ya existe un cliente con ese DNI o CUIT",
        },
      });
    }

    if (conflictCodes.has(error.message)) {
      logSystemError(request, {
        nivel: "WARN",
        statusCode: 409,
        errorCode: error.message,
        mensaje: "Conflicto con el estado actual del recurso",
      });
      return reply.status(409).send({
        error: {
          code: error.message,
          message: "Conflicto con el estado actual del recurso",
        },
      });
    }

    if (forbiddenCodes.has(error.message)) {
      logSystemError(request, {
        nivel: "WARN",
        statusCode: 403,
        errorCode: error.message,
        mensaje: error.message === "PLATFORM_ROLE_FORBIDDEN"
          ? "Los roles de plataforma solo pueden asignarse en el estudio del sistema"
          : "La referencia indicada no pertenece al estudio actual",
      });
      return reply.status(403).send({
        error: {
          code: error.message,
          message: error.message === "PLATFORM_ROLE_FORBIDDEN"
            ? "Los roles de plataforma solo pueden asignarse en el estudio del sistema"
            : "La referencia indicada no pertenece al estudio actual",
        },
      });
    }

    if (isPostgresError(error)) {
      if (error.code === "23503") {
        logSystemError(request, {
          nivel: "WARN",
          statusCode: 404,
          errorCode: "RELATED_RESOURCE_NOT_FOUND",
          mensaje: "Una relacion indicada no existe o no pertenece al recurso",
        });
        return reply.status(404).send({
          error: {
            code: "RELATED_RESOURCE_NOT_FOUND",
            message: "Una relacion indicada no existe o no pertenece al recurso",
          },
        });
      }

      if (error.code === "23505") {
        logSystemError(request, {
          nivel: "WARN",
          statusCode: 409,
          errorCode: "DUPLICATE_RESOURCE",
          mensaje: "El recurso ya existe",
        });
        return reply.status(409).send({
          error: {
            code: "DUPLICATE_RESOURCE",
            message: "El recurso ya existe",
          },
        });
      }

      if (["23502", "22001", "22007", "22P02"].includes(error.code)) {
        logSystemError(request, {
          nivel: "WARN",
          statusCode: 400,
          errorCode: "INVALID_INPUT",
          mensaje: "Input invalido",
        });
        return reply.status(400).send({
          error: {
            code: "INVALID_INPUT",
            message: "Input invalido",
          },
        });
      }
    }

    request.log.error(error);
    logSystemError(request, {
      nivel: "ERROR",
      statusCode: 500,
      errorCode: error.code ?? "INTERNAL_ERROR",
      mensaje: error.message ?? "Error interno del servidor",
      stackTrace: error.stack,
    });
    return reply.status(500).send({
      error: {
        code: "INTERNAL_ERROR",
        message: "Error interno del servidor",
      },
    });
  });

  fastify.setNotFoundHandler((request, reply) => {
    const pathname = new URL(request.url, "http://localhost").pathname;
    const matchingRoute = [...registeredRoutes.values()].find((entry) => entry.pattern.test(pathname));

    if (matchingRoute && !matchingRoute.methods.has(request.method.toUpperCase())) {
      reply.header("Allow", [...matchingRoute.methods].sort().join(", "));
      logSystemError(request, {
        nivel: "WARN",
        statusCode: 405,
        errorCode: "METHOD_NOT_ALLOWED",
        mensaje: "Metodo no soportado para esta ruta",
      });
      return reply.status(405).send({
        error: {
          code: "METHOD_NOT_ALLOWED",
          message: "Metodo no soportado para esta ruta",
        },
      });
    }

    logSystemError(request, {
      nivel: "WARN",
      statusCode: 404,
      errorCode: "NOT_FOUND",
      mensaje: "Ruta no encontrada",
    });
    return reply.status(404).send({
      error: {
        code: "NOT_FOUND",
        message: "Ruta no encontrada",
      },
    });
  });
});

function routePatternToRegex(routeUrl: string) {
  const escapedSegments = routeUrl
    .split("/")
    .map((segment) => {
      if (segment.startsWith(":")) return "[^/]+";
      return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");

  return new RegExp(`^${escapedSegments}/?$`);
}

function isPostgresError(error: FastifyError): error is FastifyError & { code: string } {
  return typeof error.code === "string" && /^[0-9A-Z]{5}$/.test(error.code);
}

function logSystemError(
  request: FastifyRequest,
  input: {
    nivel: "ERROR" | "WARN";
    statusCode: number;
    errorCode: string;
    mensaje: string;
    stackTrace?: string;
  },
) {
  void SystemErrorLogsService.registrar({
    ...input,
    metodo: request.method,
    ruta: request.url,
    ip: request.ip,
    usuarioId: request.authUser?.id ?? request.user?.id,
    estudioId: request.authUser?.estudioId ?? request.user?.estudioId,
    contexto: { headers: { "user-agent": request.headers["user-agent"] } },
  });
}
