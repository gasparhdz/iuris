import { describe, expect, it } from "vitest";
import { escapeHtml } from "../services/documentos.service.js";
import { consumeMemoryRateLimit, clearMemoryRateLimitForTests } from "../services/auth-memory-rate-limit.js";
import { registerTenantSchema, resetPasswordSchema, changePasswordSchema } from "../schemas/auth.schema.js";

describe("documentos — escapeHtml anti-XSS", () => {
  it("escapa caracteres peligrosos en sustituciones", () => {
    expect(escapeHtml(`<script>alert("x")</script>`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
    );
    expect(escapeHtml("A & B")).toBe("A &amp; B");
  });
});

describe("auth schema — password mínimo 12", () => {
  it("rechaza passwords cortas en registro/cambio/reset", () => {
    expect(registerTenantSchema.safeParse({
      estudioNombre: "Estudio",
      usuarioNombre: "A",
      usuarioApellido: "B",
      email: "a@b.com",
      password: "123456",
    }).success).toBe(false);

    expect(changePasswordSchema.safeParse({
      currentPassword: "old",
      newPassword: "short",
    }).success).toBe(false);

    expect(resetPasswordSchema.safeParse({
      email: "a@b.com",
      token: "tok",
      newPassword: "12345678901",
    }).success).toBe(false);

    expect(resetPasswordSchema.safeParse({
      email: "a@b.com",
      token: "tok",
      newPassword: "123456789012",
    }).success).toBe(true);
  });
});

describe("auth memory rate-limit fail-safe", () => {
  it("bloquea tras alcanzar el máximo", () => {
    clearMemoryRateLimitForTests();
    const key = `test-${Date.now()}`;
    expect(consumeMemoryRateLimit(key, 3, 60_000)).toBe(true);
    expect(consumeMemoryRateLimit(key, 3, 60_000)).toBe(true);
    expect(consumeMemoryRateLimit(key, 3, 60_000)).toBe(true);
    expect(consumeMemoryRateLimit(key, 3, 60_000)).toBe(false);
    clearMemoryRateLimitForTests();
  });
});
