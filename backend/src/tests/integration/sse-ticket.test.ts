import { afterAll, beforeAll, describe, expect, it } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { estudios, usuarios } from "../../db/schema.js";
import { authPlugin } from "../../plugins/auth.plugin.js";
import { errorHandlerPlugin } from "../../plugins/error-handler.plugin.js";
import { sseRoutes } from "../../routes/sse.routes.js";
import {
  clearSseTicketMemoryStoreForTests,
  consumeSseTicket,
} from "../../services/sse-ticket.service.js";

describe("SSE stream HTTP — rechaza JWT, ticket de un solo uso", () => {
  let app: FastifyInstance;
  let estudioId: number;
  let user: { id: number; tokenVersion: number };
  const stamp = Date.now();

  beforeAll(async () => {
    clearSseTicketMemoryStoreForTests();
    app = Fastify({ logger: false });
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    await app.register(errorHandlerPlugin);
    await app.register(authPlugin);
    await app.register(sseRoutes, { prefix: "/notificaciones/sse" });
    await app.ready();

    const [est] = await db.insert(estudios).values({ nombre: `SSE ${stamp}` }).returning({ id: estudios.id });
    estudioId = est.id;
    const [u] = await db.insert(usuarios).values({
      estudioId,
      nombre: "Sse",
      apellido: "User",
      email: `sse_${stamp}@test.local`,
      passwordHash: "x",
    }).returning({ id: usuarios.id, tokenVersion: usuarios.tokenVersion });
    user = u;
  });

  afterAll(async () => {
    await db.delete(usuarios).where(eq(usuarios.id, user.id));
    await db.delete(estudios).where(eq(estudios.id, estudioId));
    clearSseTicketMemoryStoreForTests();
    await app.close();
  });

  function accessToken() {
    return app.jwt.sign({
      id: user.id,
      estudioId,
      rol: "ABOGADO",
      tokenVersion: user.tokenVersion,
    });
  }

  it("stream rechaza un access JWT en querystring", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/notificaciones/sse/stream?token=${encodeURIComponent(accessToken())}`,
    });
    expect(res.statusCode).toBe(401);
  });

  it("ticket emitido es válido una sola vez; segundo uso en stream → 401", async () => {
    const ticketRes = await app.inject({
      method: "POST",
      url: "/notificaciones/sse/ticket",
      headers: { authorization: `Bearer ${accessToken()}` },
    });
    expect(ticketRes.statusCode).toBe(200);
    const ticket = ticketRes.json().data.ticket as string;
    expect(typeof ticket).toBe("string");
    expect(ticket.length).toBeGreaterThan(20);

    // Primer uso (equivalente a lo que hace GET /stream al validar).
    const first = await consumeSseTicket(ticket);
    expect(first).toEqual({
      usuarioId: user.id,
      estudioId,
      tokenVersion: user.tokenVersion,
    });

    // Segundo uso vía el endpoint real → 401.
    const reuse = await app.inject({
      method: "GET",
      url: `/notificaciones/sse/stream?token=${encodeURIComponent(ticket)}`,
    });
    expect(reuse.statusCode).toBe(401);
  });
});
