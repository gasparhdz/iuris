import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { AuthQueries } from "../db/queries/auth.queries.js";
import { env } from "../env.js";
import { SecurityAuditService } from "./security-audit.service.js";
import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  RegisterTenantInput,
  ResetPasswordInput,
  UpdateProfileInput,
} from "../schemas/auth.schema.js";
import { sendEmail } from "../utils/email.js";
import { assertAccountNotLocked, clearLoginThrottle, registerFailedLogin } from "./login-throttle.js";

type RefreshTokenMeta = { userAgent?: string; ip?: string };

export class AuthService {
  static async login(data: LoginInput) {
    // 0. Rate-limit por cuenta (anti brute-force distribuido, complementa el límite por IP).
    await assertAccountNotLocked(data.email);

    // 1. Buscar usuario
    const user = await AuthQueries.findUserByEmail(data.email);
    if (!user) {
      await registerFailedLogin(data.email);
      throw new Error("INVALID_CREDENTIALS");
    }

    if (!user.activo) {
      throw new Error("USER_DISABLED");
    }

    const estudio = await AuthQueries.findEstudioById(user.estudioId);
    if (!estudio?.activo) {
      throw new Error("STUDY_DISABLED");
    }

    // 2. Verificar contraseña (cost factor 12)
    const isValid = await bcrypt.compare(data.password, user.passwordHash);
    if (!isValid) {
      await registerFailedLogin(data.email);
      throw new Error("INVALID_CREDENTIALS");
    }

    // 3. Login válido: limpiar contador y actualizar last_login
    await clearLoginThrottle(data.email);
    await AuthQueries.updateUserLastLogin(user.id);

    // Obtener el rol del usuario (simplificado, asume que tiene al menos uno)
    const userRoleLink = await AuthQueries.findUserRoleLink(user.id);
    const rolStr = userRoleLink ? userRoleLink.codigo : "ABOGADO";

    // Devolvemos el usuario sin el hash de contraseña
    const { passwordHash: _, ...safeUser } = user;
    return { 
      ...safeUser, 
      estudioId: user.estudioId,
      estudio,
      rol: rolStr,
      tokenVersion: user.tokenVersion,
    };
  }

  static async registerTenant(data: RegisterTenantInput) {
    // 1. Verificar si el email ya existe
    const existing = await AuthQueries.findUserByEmail(data.email);
    if (existing) {
      throw new Error("EMAIL_IN_USE");
    }

    // 2. Hashear password
    const passwordHash = await bcrypt.hash(data.password, 12);

    // 3. Crear Estudio y Usuario Director en una transacción
    const { nuevoUsuario } = await AuthQueries.createTenantWithAdmin(data.estudioNombre, {
      nombre: data.usuarioNombre,
      apellido: data.usuarioApellido,
      email: data.email,
      passwordHash,
    });

    const { passwordHash: _, ...safeUser } = nuevoUsuario;
    const estudio = await AuthQueries.findEstudioById(nuevoUsuario.estudioId);
    return { ...safeUser, estudio, rol: "DIRECTOR", tokenVersion: nuevoUsuario.tokenVersion };
  }

  static async persistRefreshToken(input: { jti: string; familyId: string; userId: number; meta: RefreshTokenMeta }) {
    const jtiHash = hashRefreshTokenJti(input.jti);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await AuthQueries.insertRefreshToken({
      usuarioId: input.userId,
      jtiHash,
      familyId: input.familyId,
      userAgent: input.meta.userAgent,
      ip: input.meta.ip,
      expiresAt,
    });
  }

  static async rotateRefreshToken(input: { userId: number; jti?: string; familyId?: string; meta: RefreshTokenMeta }) {
    if (!input.jti || !input.familyId) {
      throw new Error("INVALID_REFRESH_TOKEN");
    }

    const user = await AuthQueries.findUserById(input.userId);
    if (!user || !user.activo) {
      throw new Error("INVALID_REFRESH_TOKEN");
    }

    const storedToken = await AuthQueries.findRefreshTokenByJtiHash(hashRefreshTokenJti(input.jti));
    if (!storedToken || storedToken.usuarioId !== input.userId || storedToken.familyId !== input.familyId) {
      throw new Error("INVALID_REFRESH_TOKEN");
    }

    if (storedToken.rotatedAt || storedToken.revokedAt) {
      await AuthQueries.revokeRefreshTokenFamily(input.familyId);
      await SecurityAuditService.log({
        evento: "TOKEN_REUSE",
        usuarioId: user.id,
        estudioId: user.estudioId,
        ip: input.meta.ip ?? null,
        userAgent: input.meta.userAgent ?? null,
        metodo: "POST",
        path: "/api/v1/auth/refresh",
        metadata: { familyId: input.familyId },
      });
      throw new Error("REFRESH_TOKEN_REUSE");
    }

    if (storedToken.expiresAt.getTime() <= Date.now()) {
      throw new Error("INVALID_REFRESH_TOKEN");
    }

    await AuthQueries.markRefreshTokenRotated(storedToken.id);

    const userRoleLink = await AuthQueries.findUserRoleLink(user.id);
    const rolStr = userRoleLink ? userRoleLink.codigo : "ABOGADO";
    const estudio = await AuthQueries.findEstudioById(user.estudioId);
    const { passwordHash: _, ...safeUser } = user;

    return {
      ...safeUser,
      estudioId: user.estudioId,
      estudio,
      rol: rolStr,
      tokenVersion: user.tokenVersion,
      refreshFamilyId: input.familyId,
    };
  }

  static async revokeUserRefreshTokens(userId: number) {
    await AuthQueries.revokeActiveRefreshTokensByUserId(userId);
  }

  static async updateProfile(userId: number, data: UpdateProfileInput) {
    const updateValues: UpdateProfileInput = {};
    if (data.nombre !== undefined) updateValues.nombre = data.nombre;
    if (data.apellido !== undefined) updateValues.apellido = data.apellido;
    if (data.telefono !== undefined) updateValues.telefono = data.telefono;

    if (Object.keys(updateValues).length > 0) {
      const user = await AuthQueries.updateUserProfile(userId, updateValues);
      if (!user || !user.activo) {
        throw new Error("USER_NOT_FOUND_OR_DISABLED");
      }
    }

    return await AuthService.getUserProfile(userId);
  }

  static async changePassword(userId: number, data: ChangePasswordInput) {
    const user = await AuthQueries.findUserById(userId);
    if (!user || !user.activo) {
      throw new Error("USER_NOT_FOUND_OR_DISABLED");
    }

    const isValid = await bcrypt.compare(data.currentPassword, user.passwordHash);
    if (!isValid) {
      throw new Error("INVALID_CURRENT_PASSWORD");
    }

    const passwordHash = await bcrypt.hash(data.newPassword, 12);
    await AuthQueries.updateUserPassword(userId, passwordHash);
    await AuthQueries.incrementUserTokenVersion(userId);
    await AuthQueries.revokeActiveRefreshTokensByUserId(userId);

    return { message: "Contraseña actualizada exitosamente" };
  }

  static async forgotPassword(data: ForgotPasswordInput) {
    const user = await AuthQueries.findUserByEmail(data.email);
    if (user?.activo) {
      const token = crypto.randomBytes(32).toString("hex");
      const tokenHash = await bcrypt.hash(token, 12);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await AuthQueries.insertPasswordResetToken({
        usuarioId: user.id,
        tokenHash,
        expiresAt,
      });

      const resetUrl = `${env.APP_URL}/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(user.email)}`;
      await sendEmail(
        user.email,
        "Iuris — Recuperar Contraseña",
        buildPasswordResetEmail({
          nombre: user.nombre,
          resetUrl,
        })
      );
    }

    return { message: "Si el email existe, recibirás instrucciones para recuperar tu contraseña" };
  }

  static async resetPassword(data: ResetPasswordInput) {
    const user = await AuthQueries.findUserByEmail(data.email);
    if (!user || !user.activo) {
      throw new Error("INVALID_OR_EXPIRED_TOKEN");
    }

    const activeTokens = await AuthQueries.findActivePasswordResetTokensByUserId(user.id);
    const storedToken = await findMatchingPasswordResetToken(activeTokens, data.token);
    if (!storedToken) {
      throw new Error("INVALID_OR_EXPIRED_TOKEN");
    }

    const passwordHash = await bcrypt.hash(data.newPassword, 12);
    await AuthQueries.updateUserPassword(user.id, passwordHash);
    await AuthQueries.incrementUserTokenVersion(user.id);
    await AuthQueries.markPasswordResetTokenUsed(storedToken.id);
    await AuthQueries.revokeActiveRefreshTokensByUserId(user.id);

    return { message: "Contraseña restablecida exitosamente" };
  }

  static async getUserProfile(userId: number) {
    const user = await AuthQueries.findUserById(userId);
    if (!user || !user.activo) {
      throw new Error("USER_NOT_FOUND_OR_DISABLED");
    }

    const { roles: userRoles, permisos: userPermisos } = await AuthQueries.findUserRolesAndPermissions(userId);
    const estudio = await AuthQueries.findEstudioById(user.estudioId);

    // Conveniencia SOLO para desarrollo: si un titular de estudio quedo sin permisos
    // persistidos (p. ej. seeds no corridos), se le otorga acceso total para no trabar el
    // entorno local. En produccion esto NUNCA debe ocurrir: los permisos son la fuente de
    // verdad (rol DIRECTOR se siembra con acceso total en seedRolesPermisos), y conceder
    // god-mode ante su ausencia seria una escalada de privilegios fail-open. Produccion es
    // fail-closed: sin permisos persistidos, sin permisos.
    let finalPermisos = userPermisos;
    if (
      env.NODE_ENV !== "production"
      && (userRoles.includes("DIRECTOR") || userRoles.includes("ADMIN"))
      && userPermisos.length === 0
    ) {
      const modulos = [
        "CLIENTES", "CASOS", "TAREAS", "EVENTOS", "HONORARIOS", 
        "GASTOS", "INGRESOS", "PLANTILLAS", "NOTAS", "VALORJUS", 
        "TERCEROS", "PLANES", "ADJUNTOS"
      ];
      finalPermisos = modulos.map(modulo => ({
        modulo,
        ver: true,
        crear: true,
        editar: true,
        eliminar: true
      }));
    }

    return {
      id: user.id,
      estudioId: user.estudioId,
      estudio,
      nombre: user.nombre,
      apellido: user.apellido,
      email: user.email,
      telefono: user.telefono ?? null,
      roles: userRoles.length > 0 ? userRoles : ["ABOGADO"],
      permisos: finalPermisos,
    };
  }
}

async function findMatchingPasswordResetToken(
  tokens: Awaited<ReturnType<typeof AuthQueries.findActivePasswordResetTokensByUserId>>,
  token: string
) {
  for (const storedToken of tokens) {
    if (await bcrypt.compare(token, storedToken.tokenHash)) {
      return storedToken;
    }
  }

  return null;
}

function hashRefreshTokenJti(jti: string) {
  return crypto.createHash("sha256").update(jti).digest("hex");
}

function buildPasswordResetEmail({ nombre, resetUrl }: { nombre: string; resetUrl: string }) {
  return `
    <div style="font-family: Inter, Arial, sans-serif; background:#f6f7fb; padding:32px;">
      <div style="max-width:560px; margin:0 auto; background:#ffffff; border:1px solid #e5e7eb; border-radius:16px; overflow:hidden;">
        <div style="height:4px; background:linear-gradient(90deg,#6366f1,#14b8a6);"></div>
        <div style="padding:32px;">
          <h1 style="margin:0 0 12px; color:#111827; font-size:24px;">Recuperar contraseña</h1>
          <p style="margin:0 0 18px; color:#374151; line-height:1.6;">Hola ${escapeHtml(nombre)}, recibimos una solicitud para restablecer tu contraseña de Iuris.</p>
          <p style="margin:0 0 24px; color:#374151; line-height:1.6;">Usá el siguiente botón para crear una nueva contraseña. El enlace expira en 1 hora.</p>
          <a href="${resetUrl}" style="display:inline-block; background:#4f46e5; color:#ffffff; text-decoration:none; font-weight:700; padding:12px 18px; border-radius:10px;">Restablecer contraseña</a>
          <p style="margin:24px 0 0; color:#6b7280; line-height:1.6; font-size:14px;">Si no solicitaste este cambio, podés ignorar este email.</p>
          <p style="margin:16px 0 0; color:#9ca3af; line-height:1.6; font-size:12px; word-break:break-all;">${resetUrl}</p>
        </div>
      </div>
    </div>
  `;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
