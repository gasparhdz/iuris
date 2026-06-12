import fp from "fastify-plugin";
import fastifyJwt from "@fastify/jwt";
import fastifyCookie from "@fastify/cookie";
import { env } from "../env.js";
import { AuthQueries, type UserPermission } from "../db/queries/auth.queries.js";
import { hasPermiso } from "../auth/permissions.js";
import type { FastifyReply, FastifyRequest } from "fastify";

export type ModuloPermiso =
  | "CLIENTES"
  | "CASOS"
  | "TAREAS"
  | "EVENTOS"
  | "HONORARIOS"
  | "GASTOS"
  | "INGRESOS"
  | "PLANTILLAS"
  | "NOTAS"
  | "VALORJUS"
  | "TERCEROS"
  | "PLANES"
  | "ADJUNTOS"
  | "EQUIPO";

export type AccionPermiso = "ver" | "crear" | "editar" | "eliminar";

export interface JwtPayload {
  id: number;
  estudioId?: number;
  rol?: string;
  tokenVersion?: number;
  jti?: string;
  familyId?: string;
  type?: string;
}

export interface AuthenticatedUser {
  id: number;
  estudioId: number;
  rol?: string;
  tokenVersion: number;
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authenticateRefresh: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authorize: (
      modulo: ModuloPermiso,
      accion: AccionPermiso,
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    authUser: AuthenticatedUser;
    refreshUser: JwtPayload;
    permisosCache?: UserPermission[];
  }
}

export const authPlugin = fp(async (fastify) => {
  await fastify.register(fastifyCookie);

  await fastify.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    cookie: {
      cookieName: "refreshToken",
      signed: false,
    },
  });

  fastify.decorate("authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
      if (!request.user.estudioId) {
        return reply.status(401).send({ error: { code: "UNAUTHORIZED", message: "Sesion invalida" } });
      }
      const authData = await AuthQueries.findUserAuthData(request.user.id);
      if (!authData?.activo) {
        return reply.status(401).send({ error: { code: "UNAUTHORIZED", message: "Usuario deshabilitado o inexistente" } });
      }
      if (authData.tokenVersion !== request.user.tokenVersion) {
        return reply.status(401).send({ error: { code: "UNAUTHORIZED", message: "Sesion invalida" } });
      }
      if (authData.estudioId !== request.user.estudioId) {
        return reply.status(401).send({ error: { code: "UNAUTHORIZED", message: "Sesion invalida" } });
      }
      if (!authData.estudioActivo) {
        return reply.status(403).send({ error: { code: "ESTUDIO_SUSPENDIDO", message: "El estudio se encuentra suspendido" } });
      }
      request.authUser = {
        id: authData.id,
        estudioId: authData.estudioId,
        rol: authData.rolCodigo ?? "ABOGADO",
        tokenVersion: authData.tokenVersion,
      };
    } catch {
      return reply.status(401).send({ error: { code: "UNAUTHORIZED", message: "Token invalido o expirado" } });
    }
  });

  // Enforcement de RBAC a nivel de funcion (OWASP A01). Debe usarse SIEMPRE despues de
  // `authenticate` en el array de preHandler, que ya valido el token y dejo `authUser`.
  // Los permisos del usuario se cargan una sola vez por request (memoizados en
  // `request.permisosCache`) para no repetir la query si una ruta encadena varios checks.
  // Es fail-closed: sin permiso explicito para (modulo, accion) -> 403.
  fastify.decorate("authorize", (modulo: ModuloPermiso, accion: AccionPermiso) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.authUser) {
        return reply.status(401).send({ error: { code: "UNAUTHORIZED", message: "Sesion invalida" } });
      }

      if (!request.permisosCache) {
        request.permisosCache = await AuthQueries.findUserPermisos(request.authUser.id);
      }

      const permitido = hasPermiso(request.permisosCache, modulo, accion);
      if (!permitido) {
        return reply.status(403).send({
          error: { code: "FORBIDDEN", message: "No tenés permiso para realizar esta acción" },
        });
      }
    };
  });

  fastify.decorate("authenticateRefresh", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify({ onlyCookie: true });
      if (request.user.type !== "refresh") {
        return reply.status(401).send({ error: { code: "UNAUTHORIZED", message: "Refresh token invalido" } });
      }
      if (!request.user.jti || !request.user.familyId) {
        return reply.status(401).send({ error: { code: "UNAUTHORIZED", message: "Refresh token invalido" } });
      }
      request.refreshUser = request.user;
    } catch {
      return reply.status(401).send({ error: { code: "UNAUTHORIZED", message: "Refresh token invalido o expirado" } });
    }
  });
});
