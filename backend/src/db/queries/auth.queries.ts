import { and, eq, gt, isNull, inArray, sql } from "drizzle-orm";
import { db } from "../index.js";
import { estudios, passwordResetTokens, refreshTokens, roles, usuarioRoles, usuarios, permisos } from "../schema.js";

type NewUsuario = typeof usuarios.$inferInsert;
type NewEstudio = typeof estudios.$inferInsert;
type NewRefreshToken = typeof refreshTokens.$inferInsert;
type NewPasswordResetToken = typeof passwordResetTokens.$inferInsert;
type UserPermission = {
  modulo: string;
  ver: boolean;
  crear: boolean;
  editar: boolean;
  eliminar: boolean;
};

export class AuthQueries {
  static async findUserByEmail(email: string) {
    const [user] = await db
      .select()
      .from(usuarios)
      .where(eq(usuarios.email, email))
      .limit(1);
    return user ?? null;
  }

  static async findUserById(id: number) {
    const [user] = await db
      .select()
      .from(usuarios)
      .where(eq(usuarios.id, id))
      .limit(1);
    return user ?? null;
  }

  static async findUserAuthData(userId: number) {
    const [result] = await db
      .select({
        id: usuarios.id,
        activo: usuarios.activo,
        estudioId: usuarios.estudioId,
        tokenVersion: usuarios.tokenVersion,
        estudioActivo: estudios.activo,
        rolCodigo: roles.codigo,
      })
      .from(usuarios)
      .leftJoin(estudios, eq(usuarios.estudioId, estudios.id))
      .leftJoin(usuarioRoles, eq(usuarios.id, usuarioRoles.usuarioId))
      .leftJoin(roles, eq(usuarioRoles.rolId, roles.id))
      .where(eq(usuarios.id, userId))
      .limit(1);
    return result ?? null;
  }

  static async findEstudioById(id: number) {
    const [estudio] = await db
      .select({
        id: estudios.id,
        nombre: estudios.nombre,
        activo: estudios.activo,
      })
      .from(estudios)
      .where(eq(estudios.id, id))
      .limit(1);
    return estudio ?? null;
  }

  static async updateUserLastLogin(id: number) {
    await db
      .update(usuarios)
      .set({ lastLoginAt: new Date() })
      .where(eq(usuarios.id, id));
  }

  static async updateUserProfile(
    id: number,
    values: Partial<Pick<NewUsuario, "nombre" | "apellido" | "telefono">>
  ) {
    const [user] = await db
      .update(usuarios)
      .set(values)
      .where(eq(usuarios.id, id))
      .returning();
    return user ?? null;
  }

  static async updateUserPassword(id: number, passwordHash: string) {
    await db
      .update(usuarios)
      .set({ passwordHash })
      .where(eq(usuarios.id, id));
  }

  static async incrementUserTokenVersion(id: number) {
    await db
      .update(usuarios)
      .set({ tokenVersion: sql`${usuarios.tokenVersion} + 1` })
      .where(eq(usuarios.id, id));
  }

  static async findUserRoleLink(userId: number) {
    const [link] = await db
      .select({ codigo: roles.codigo })
      .from(usuarioRoles)
      .innerJoin(roles, eq(usuarioRoles.rolId, roles.id))
      .where(eq(usuarioRoles.usuarioId, userId))
      .limit(1);
    return link ?? null;
  }

  static async findUserRolesAndPermissions(userId: number) {
    const userRoles = await db
      .select({
        rolId: roles.id,
        codigo: roles.codigo,
      })
      .from(usuarioRoles)
      .innerJoin(roles, eq(usuarioRoles.rolId, roles.id))
      .where(eq(usuarioRoles.usuarioId, userId));

    const roleIds = userRoles.map((r) => r.rolId);
    let userPermisos: UserPermission[] = [];
    if (roleIds.length > 0) {
      userPermisos = await db
        .select({
          modulo: permisos.modulo,
          ver: permisos.ver,
          crear: permisos.crear,
          editar: permisos.editar,
          eliminar: permisos.eliminar,
        })
        .from(permisos)
        .where(inArray(permisos.rolId, roleIds));
    }

    return {
      roles: userRoles.map((r) => r.codigo),
      permisos: userPermisos,
    };
  }

  static async createTenantWithAdmin(
    estudioNombre: string,
    usuarioData: Pick<NewUsuario, "nombre" | "apellido" | "email" | "passwordHash">,
    estudioData: Partial<Omit<NewEstudio, "id" | "nombre">> = {}
  ) {
    return await db.transaction(async (tx) => {
      const [nuevoEstudio] = await tx
        .insert(estudios)
        .values({
          ...estudioData,
          nombre: estudioNombre,
        })
        .returning();

      const [nuevoUsuario] = await tx
        .insert(usuarios)
        .values({
          ...usuarioData,
          estudioId: nuevoEstudio.id,
        })
        .returning();

      let [directorRole] = await tx.select().from(roles).where(eq(roles.codigo, "DIRECTOR")).limit(1);
      if (!directorRole) {
        [directorRole] = await tx.insert(roles).values({ codigo: "DIRECTOR", nombre: "Director" }).returning();
      }

      await tx.insert(usuarioRoles).values({
        usuarioId: nuevoUsuario.id,
        rolId: directorRole.id,
      });

      return { nuevoUsuario, nuevoEstudio };
    });
  }

  static async insertRefreshToken(values: NewRefreshToken) {
    const [row] = await db.insert(refreshTokens).values(values).returning();
    return row;
  }

  static async findActiveRefreshTokensByUserId(usuarioId: number) {
    return await db
      .select()
      .from(refreshTokens)
      .where(and(eq(refreshTokens.usuarioId, usuarioId), isNull(refreshTokens.revokedAt)));
  }

  static async findRefreshTokenByJtiHash(jtiHash: string) {
    const [row] = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.jtiHash, jtiHash))
      .limit(1);
    return row ?? null;
  }

  static async markRefreshTokenRotated(id: number) {
    await db
      .update(refreshTokens)
      .set({ rotatedAt: new Date() })
      .where(eq(refreshTokens.id, id));
  }

  static async revokeActiveRefreshTokensByUserId(usuarioId: number) {
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.usuarioId, usuarioId), isNull(refreshTokens.revokedAt)));
  }

  static async revokeRefreshTokenFamily(familyId: string) {
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.familyId, familyId), isNull(refreshTokens.revokedAt)));
  }

  static async findRefreshTokenFamiliesByUserId(usuarioId: number) {
    return await db
      .select({ familyId: refreshTokens.familyId })
      .from(refreshTokens)
      .where(and(eq(refreshTokens.usuarioId, usuarioId), isNull(refreshTokens.revokedAt)));
  }

  static async insertPasswordResetToken(values: NewPasswordResetToken) {
    const [row] = await db.insert(passwordResetTokens).values(values).returning();
    return row;
  }

  static async findActivePasswordResetTokensByUserId(usuarioId: number) {
    return await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.usuarioId, usuarioId),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, new Date())
        )
      );
  }

  static async markPasswordResetTokenUsed(id: number) {
    await db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, id));
  }
}
