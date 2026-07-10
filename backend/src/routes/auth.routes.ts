import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { AuthController } from "../controllers/auth.controller.js";
import { documentedResponses, successMessageResponseSchema } from "../schemas/common.schema.js";
import {
  authResponseSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerTenantSchema,
  resetPasswordSchema,
  updateProfileSchema,
  userProfileResponseSchema,
} from "../schemas/auth.schema.js";
import { env } from "../env.js";

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  const server = fastify.withTypeProvider<ZodTypeProvider>();

  const rateLimitConfig = {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: "15 minutes",
        ban: 30,
      },
    },
  };

  const forgotPasswordRateLimitConfig = {
    config: {
      rateLimit: {
        max: 3,
        timeWindow: "15 minutes",
      },
    },
  };

  const resetPasswordRateLimitConfig = {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: "15 minutes",
      },
    },
  };

  server.post(
    "/login",
    {
      ...rateLimitConfig,
      schema: {
        tags: ["Auth"],
        summary: "Iniciar sesion",
        body: loginSchema,
        response: documentedResponses(200, authResponseSchema),
      },
    },
    AuthController.login
  );

  // Self-serve deshabilitado en producción (spam / abuso de recursos).
  // Cuando el registro self-serve sea objetivo comercial, reactivar con captcha,
  // aprobación admin o invite-only — no dejar la ruta abierta en internet pública.
  server.post(
    "/register-tenant",
    {
      ...rateLimitConfig,
      preHandler: async (_request, reply) => {
        if (env.NODE_ENV === "production") {
          return reply.status(403).send({
            error: { code: "REGISTRATION_DISABLED", message: "Registro no disponible" },
          });
        }
      },
      schema: {
        tags: ["Auth"],
        summary: "Registrar un nuevo Estudio y Usuario Admin",
        body: registerTenantSchema,
        response: documentedResponses(201, authResponseSchema),
      },
    },
    AuthController.registerTenant
  );

  server.post(
    "/refresh",
    {
      preHandler: [fastify.authenticateRefresh],
      schema: {
        tags: ["Auth"],
        summary: "Rotar refresh token y obtener nuevo access token",
        response: documentedResponses(200, authResponseSchema),
      },
    },
    AuthController.refresh
  );

  server.post(
    "/logout",
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ["Auth"],
        summary: "Cerrar sesion y revocar refresh tokens",
        response: documentedResponses(200, successMessageResponseSchema),
      },
    },
    AuthController.logout
  );

  server.put(
    "/profile",
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ["Auth"],
        summary: "Actualizar perfil del usuario autenticado",
        body: updateProfileSchema,
        response: documentedResponses(200, userProfileResponseSchema),
      },
    },
    AuthController.updateProfile
  );

  server.put(
    "/change-password",
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ["Auth"],
        summary: "Cambiar contraseña del usuario autenticado",
        body: changePasswordSchema,
        response: documentedResponses(200, successMessageResponseSchema),
      },
    },
    AuthController.changePassword
  );

  server.post(
    "/forgot-password",
    {
      ...forgotPasswordRateLimitConfig,
      schema: {
        tags: ["Auth"],
        summary: "Iniciar recupero de contraseña",
        body: forgotPasswordSchema,
        response: documentedResponses(200, successMessageResponseSchema),
      },
    },
    AuthController.forgotPassword
  );

  server.post(
    "/reset-password",
    {
      ...resetPasswordRateLimitConfig,
      schema: {
        tags: ["Auth"],
        summary: "Restablecer contraseña con token",
        body: resetPasswordSchema,
        response: documentedResponses(200, successMessageResponseSchema),
      },
    },
    AuthController.resetPassword
  );

  server.get(
    "/me",
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ["Auth"],
        summary: "Obtener perfil del usuario autenticado",
        response: documentedResponses(200, userProfileResponseSchema),
      },
    },
    AuthController.me
  );
};
