import type { FastifyReply, FastifyRequest } from "fastify";
import crypto from "node:crypto";
import { env } from "../env.js";
import { AuthQueries } from "../db/queries/auth.queries.js";
import { AuthService } from "../services/auth.service.js";
import { SecurityAuditService } from "../services/security-audit.service.js";
import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  RegisterTenantInput,
  ResetPasswordInput,
  UpdateProfileInput,
} from "../schemas/auth.schema.js";

const refreshCookieOptions = {
  domain: env.COOKIE_DOMAIN,
  path: "/",
  secure: env.NODE_ENV === "production",
  httpOnly: true,
  sameSite: "strict" as const,
  maxAge: 30 * 24 * 60 * 60,
};

export class AuthController {
  static async login(request: FastifyRequest<{ Body: LoginInput }>, reply: FastifyReply) {
    try {
      const user = await AuthService.login(request.body);
      const accessToken = await signAccessToken(reply, user);
      const refreshToken = await signRefreshToken(reply, user.id);

      await AuthService.persistRefreshToken({
        jti: refreshToken.jti,
        familyId: refreshToken.familyId,
        userId: user.id,
        meta: {
          userAgent: request.headers["user-agent"],
          ip: request.ip,
        },
      });

      reply.setCookie("refreshToken", refreshToken.token, refreshCookieOptions);
      await SecurityAuditService.log({
        evento: "LOGIN_OK",
        request,
        usuarioId: user.id,
        estudioId: user.estudioId,
        statusCode: 200,
      });

      return reply.send({
        data: {
          accessToken,
          user: formatUser(user),
        },
      });
    } catch (error: unknown) {
      await auditLoginFail(request);
      if (error instanceof Error && error.message === "ACCOUNT_LOCKED") {
        return reply.status(429).send({ error: { code: "ACCOUNT_LOCKED", message: "Demasiados intentos fallidos. Probá de nuevo en unos minutos." } });
      }
      if (error instanceof Error && (error.message === "INVALID_CREDENTIALS" || error.message === "USER_DISABLED" || error.message === "STUDY_DISABLED")) {
        return reply.status(401).send({ error: { code: error.message, message: "Credenciales invalidas o usuario deshabilitado" } });
      }
      request.log.error(error);
      return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "Error interno del servidor" } });
    }
  }

  static async registerTenant(request: FastifyRequest<{ Body: RegisterTenantInput }>, reply: FastifyReply) {
    try {
      const user = await AuthService.registerTenant(request.body);
      const accessToken = await signAccessToken(reply, user);
      const refreshToken = await signRefreshToken(reply, user.id);

      await AuthService.persistRefreshToken({
        jti: refreshToken.jti,
        familyId: refreshToken.familyId,
        userId: user.id,
        meta: {
          userAgent: request.headers["user-agent"],
          ip: request.ip,
        },
      });

      reply.setCookie("refreshToken", refreshToken.token, refreshCookieOptions);
      await SecurityAuditService.log({
        evento: "LOGIN_OK",
        request,
        usuarioId: user.id,
        estudioId: user.estudioId,
        statusCode: 201,
        metadata: { source: "register_tenant" },
      });

      return reply.status(201).send({
        data: {
          accessToken,
          user: formatUser(user),
        },
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "EMAIL_IN_USE") {
        return reply.status(409).send({ error: { code: "EMAIL_IN_USE", message: "El correo electronico ya esta registrado" } });
      }
      request.log.error(error);
      return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "Error interno del servidor" } });
    }
  }

  static async refresh(request: FastifyRequest, reply: FastifyReply) {
    try {
      const refreshToken = request.cookies.refreshToken;
      if (!refreshToken) {
        return reply.status(401).send({ error: { code: "UNAUTHORIZED", message: "Refresh token requerido" } });
      }

      const user = await AuthService.rotateRefreshToken({
        userId: request.refreshUser.id,
        jti: request.refreshUser.jti,
        familyId: request.refreshUser.familyId,
        meta: {
          userAgent: request.headers["user-agent"],
          ip: request.ip,
        },
      });
      const accessToken = await signAccessToken(reply, user);
      const nextRefreshToken = await signRefreshToken(reply, user.id, user.refreshFamilyId as ReturnType<typeof crypto.randomUUID>);

      await AuthService.persistRefreshToken({
        jti: nextRefreshToken.jti,
        familyId: nextRefreshToken.familyId,
        userId: user.id,
        meta: {
          userAgent: request.headers["user-agent"],
          ip: request.ip,
        },
      });

      reply.setCookie("refreshToken", nextRefreshToken.token, refreshCookieOptions);
      await SecurityAuditService.log({
        evento: "TOKEN_REFRESH",
        request,
        usuarioId: user.id,
        estudioId: user.estudioId,
        statusCode: 200,
      });

      return reply.send({
        data: {
          accessToken,
          user: formatUser(user),
        },
      });
    } catch (error: unknown) {
      if (error instanceof Error && (error.message === "INVALID_REFRESH_TOKEN" || error.message === "REFRESH_TOKEN_REUSE")) {
        return reply.status(401).send({ error: { code: "UNAUTHORIZED", message: "Refresh token invalido" } });
      }
      request.log.error(error);
      return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "Error interno del servidor" } });
    }
  }

  static async logout(request: FastifyRequest, reply: FastifyReply) {
    await AuthService.revokeUserRefreshTokens(request.authUser.id);
    await SecurityAuditService.log({
      evento: "LOGOUT",
      request,
      statusCode: 200,
    });
    reply.clearCookie("refreshToken", { path: "/" });
    return reply.send({ data: { message: "Logged out" } });
  }

  static async updateProfile(request: FastifyRequest<{ Body: UpdateProfileInput }>, reply: FastifyReply) {
    try {
      const profile = await AuthService.updateProfile(request.authUser.id, request.body);
      return reply.send(profile);
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "USER_NOT_FOUND_OR_DISABLED") {
        return reply.status(404).send({ error: { code: "USER_NOT_FOUND", message: "Usuario no encontrado o deshabilitado" } });
      }
      request.log.error(error);
      return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "Error al actualizar perfil" } });
    }
  }

  static async changePassword(request: FastifyRequest<{ Body: ChangePasswordInput }>, reply: FastifyReply) {
    try {
      const result = await AuthService.changePassword(request.authUser.id, request.body);
      await SecurityAuditService.log({
        evento: "PASSWORD_CHANGE",
        request,
        statusCode: 200,
      });
      return reply.send({ data: result });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "INVALID_CURRENT_PASSWORD") {
        return reply.status(400).send({ error: { code: "INVALID_CURRENT_PASSWORD", message: "La contraseña actual no es correcta" } });
      }
      if (error instanceof Error && error.message === "USER_NOT_FOUND_OR_DISABLED") {
        return reply.status(404).send({ error: { code: "USER_NOT_FOUND", message: "Usuario no encontrado o deshabilitado" } });
      }
      request.log.error(error);
      return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "Error al cambiar contraseña" } });
    }
  }

  static async forgotPassword(request: FastifyRequest<{ Body: ForgotPasswordInput }>, reply: FastifyReply) {
    try {
      const result = await AuthService.forgotPassword(request.body);
      return reply.send({ data: result });
    } catch (error: unknown) {
      request.log.error(error);
      return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "Error al iniciar recupero de contraseña" } });
    }
  }

  static async resetPassword(request: FastifyRequest<{ Body: ResetPasswordInput }>, reply: FastifyReply) {
    try {
      const result = await AuthService.resetPassword(request.body);
      const user = await AuthQueries.findUserByEmail(request.body.email);
      await SecurityAuditService.log({
        evento: "PASSWORD_RESET",
        request,
        usuarioId: user?.id ?? null,
        estudioId: user?.estudioId ?? 0,
        statusCode: 200,
      });
      return reply.send({ data: result });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "INVALID_OR_EXPIRED_TOKEN") {
        return reply.status(400).send({ error: { code: "INVALID_OR_EXPIRED_TOKEN", message: "El enlace es inválido o expiró" } });
      }
      request.log.error(error);
      return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "Error al restablecer contraseña" } });
    }
  }

  static async me(request: FastifyRequest, reply: FastifyReply) {
    try {
      const profile = await AuthService.getUserProfile(request.authUser.id);
      return reply.send(profile);
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "USER_NOT_FOUND_OR_DISABLED") {
        return reply.status(404).send({ error: { code: "USER_NOT_FOUND", message: "Usuario no encontrado o deshabilitado" } });
      }
      request.log.error(error);
      return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "Error al obtener perfil" } });
    }
  }
}

async function auditLoginFail(request: FastifyRequest<{ Body: LoginInput }>) {
  const email = request.body?.email;
  const user = email ? await AuthQueries.findUserByEmail(email).catch(() => null) : null;
  await SecurityAuditService.log({
    evento: "LOGIN_FAIL",
    request,
    usuarioId: user?.id ?? null,
    estudioId: user?.estudioId ?? 0,
    statusCode: 401,
  });
}

async function signAccessToken(reply: FastifyReply, user: { id: number; estudioId: number; rol: string; tokenVersion: number }) {
  return await reply.jwtSign(
    { id: user.id, estudioId: user.estudioId, rol: user.rol, tokenVersion: user.tokenVersion },
    { expiresIn: "15m" }
  );
}

async function signRefreshToken(reply: FastifyReply, userId: number, familyId = crypto.randomUUID()) {
  const jti = crypto.randomBytes(32).toString("base64url");
  const token = await reply.jwtSign(
    { id: userId, type: "refresh", jti, familyId },
    { expiresIn: "30d" }
  );
  return { token, jti, familyId };
}

function formatUser(user: { id: number; estudioId: number; estudio?: { id: number; nombre: string } | null; nombre: string; apellido: string; email: string; rol: string; telefono?: string | null }) {
  return {
    id: user.id,
    estudioId: user.estudioId,
    estudio: user.estudio ?? null,
    nombre: user.nombre,
    apellido: user.apellido,
    email: user.email,
    rol: user.rol,
    telefono: user.telefono ?? null,
  };
}
