import { afterAll, beforeAll, describe, expect, it } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { authPlugin } from "../plugins/auth.plugin.js";
import { errorHandlerPlugin } from "../plugins/error-handler.plugin.js";
import { authRoutes } from "../routes/auth.routes.js";
import { env } from "../env.js";

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  await app.register(errorHandlerPlugin);
  await app.register(authPlugin);
  await app.register(authRoutes, { prefix: "/auth" });
  await app.ready();
  return app;
}

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
});

afterAll(async () => {
  await app.close();
});

describe("register-tenant — gate de producción", () => {
  it("en production responde 403 REGISTRATION_DISABLED", async () => {
    const prev = env.NODE_ENV;
    (env as { NODE_ENV: typeof env.NODE_ENV }).NODE_ENV = "production";
    try {
      const res = await app.inject({
        method: "POST",
        url: "/auth/register-tenant",
        payload: {
          estudioNombre: "Estudio Prod Block",
          usuarioNombre: "Test",
          usuarioApellido: "User",
          email: `blocked_${Date.now()}@test.local`,
          password: "123456",
        },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe("REGISTRATION_DISABLED");
    } finally {
      (env as { NODE_ENV: typeof env.NODE_ENV }).NODE_ENV = prev;
    }
  });

  it("fuera de production no aplica el gate 403 de registro", async () => {
    expect(env.NODE_ENV).not.toBe("production");
    const res = await app.inject({
      method: "POST",
      url: "/auth/register-tenant",
      payload: {
        estudioNombre: "X",
        usuarioNombre: "T",
        usuarioApellido: "U",
        email: "not-an-email",
        password: "123456",
      },
    });
    expect(res.statusCode).not.toBe(403);
    if (res.statusCode >= 400) {
      expect(res.json().error?.code).not.toBe("REGISTRATION_DISABLED");
    }
  });
});
