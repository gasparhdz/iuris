import fp from "fastify-plugin";
import fastifyJwt from "@fastify/jwt";
import fastifyCookie from "@fastify/cookie";
import { env } from "../env.js";
import { AuthQueries } from "../db/queries/auth.queries.js";
import type { FastifyReply, FastifyRequest } from "fastify";

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
  }

  interface FastifyRequest {
    authUser: AuthenticatedUser;
    refreshUser: JwtPayload;
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
