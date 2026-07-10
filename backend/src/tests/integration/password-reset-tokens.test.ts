import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { estudios, passwordResetTokens, usuarios } from "../../db/schema.js";
import { AuthQueries } from "../../db/queries/auth.queries.js";
import { AuthService } from "../../services/auth.service.js";
import { EmailService } from "../../services/email.service.js";

describe("password reset — invalidación de tokens previos", () => {
  let estudioId: number;
  let userId: number;
  const stamp = Date.now();
  const email = `reset_${stamp}@test.local`;
  const capturedTokens: string[] = [];

  beforeAll(async () => {
    const [est] = await db.insert(estudios).values({ nombre: `Reset ${stamp}` }).returning({ id: estudios.id });
    estudioId = est.id;
    const passwordHash = await bcrypt.hash("password-segura-12", 12);
    const [u] = await db.insert(usuarios).values({
      estudioId,
      nombre: "Reset",
      apellido: "User",
      email,
      passwordHash,
    }).returning({ id: usuarios.id });
    userId = u.id;

    vi.spyOn(EmailService, "sendRecuperarPassword").mockImplementation(async (input) => {
      const match = String(input.resetUrl).match(/[?&]token=([^&]+)/);
      if (match) capturedTokens.push(decodeURIComponent(match[1]));
      return true;
    });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.usuarioId, userId));
    await db.update(usuarios).set({ deletedAt: new Date(), activo: false, email: `del_${email}` }).where(eq(usuarios.id, userId));
    await db.update(estudios).set({ activo: false }).where(eq(estudios.id, estudioId));
  });

  it("pedir reset dos veces: el primero deja de servir tras usar el segundo", async () => {
    await AuthService.forgotPassword({ email });
    await AuthService.forgotPassword({ email });
    expect(capturedTokens.length).toBeGreaterThanOrEqual(2);

    const firstToken = capturedTokens[capturedTokens.length - 2]!;
    const secondToken = capturedTokens[capturedTokens.length - 1]!;

    // Tras el segundo forgot, solo debe quedar un token activo.
    const activeAfterIssue = await AuthQueries.findActivePasswordResetTokensByUserId(userId);
    expect(activeAfterIssue).toHaveLength(1);

    await AuthService.resetPassword({
      email,
      token: secondToken,
      newPassword: "nueva-password-12",
    });

    await expect(
      AuthService.resetPassword({
        email,
        token: firstToken,
        newPassword: "otra-password-12x",
      }),
    ).rejects.toThrow("INVALID_OR_EXPIRED_TOKEN");

    const activeAfterUse = await AuthQueries.findActivePasswordResetTokensByUserId(userId);
    expect(activeAfterUse).toHaveLength(0);
  });
});
