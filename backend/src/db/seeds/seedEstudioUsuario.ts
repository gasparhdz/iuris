import { db } from "../../db/index.js";
import { estudios as estudiosDb, usuarios as usuariosDb, usuarioRoles as userRolesDb } from "../../db/schema.js";
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { upsertPlanesSuscripcion } from "./seedPlanesSuscripcion.js";

async function main() {
  const planes = await upsertPlanesSuscripcion();
  const premium = planes.find((plan) => plan.codigo === "PREMIUM") ?? null;
  console.log("🏢 Iniciando seed de Estudio y Usuario Maestro...");

  // 1. ESTUDIO MAESTRO (ID 1)
  const estudioId = 1;
  const [existingEstudio] = await db.select().from(estudiosDb).where(eq(estudiosDb.id, estudioId)).limit(1);
  
  if (existingEstudio) {
    await db.update(estudiosDb)
      .set({
        nombre: "Lex Sistema Global",
        emailContacto: "gaspihernandez@gmail.com",
        planSuscripcionId: premium?.id ?? null,
        plan: "PREMIUM",
        maxUsuarios: 100,
        almacenamientoGb: 1000,
        activo: true,
      })
      .where(eq(estudiosDb.id, estudioId));
    console.log("  ✓ Estudio Maestro actualizado (ID: 1)");
  } else {
    await db.insert(estudiosDb)
      .values({
        id: estudioId,
        nombre: "Lex Sistema Global",
        emailContacto: "gaspihernandez@gmail.com",
        planSuscripcionId: premium?.id ?? null,
        plan: "PREMIUM",
        maxUsuarios: 100,
        almacenamientoGb: 1000,
        activo: true,
      });
    console.log("  ✓ Estudio Maestro creado (ID: 1)");
  }

  // 2. USUARIO MAESTRO (ID 1)
  const usuarioId = 1;
  const passwordHash = await bcrypt.hash("123456", 12);
  const [existingUsuario] = await db.select().from(usuariosDb).where(eq(usuariosDb.id, usuarioId)).limit(1);

  if (existingUsuario) {
    await db.update(usuariosDb)
      .set({
        estudioId: estudioId,
        nombre: "Gaspar",
        apellido: "Hernández",
        email: "gaspihernandez@gmail.com",
        passwordHash: passwordHash,
        activo: true,
      })
      .where(eq(usuariosDb.id, usuarioId));
    console.log("  ✓ Usuario Maestro actualizado (ID: 1)");
  } else {
    await db.insert(usuariosDb)
      .values({
        id: usuarioId,
        estudioId: estudioId,
        nombre: "Gaspar",
        apellido: "Hernández",
        email: "gaspihernandez@gmail.com",
        passwordHash: passwordHash,
        activo: true,
      });
    console.log("  ✓ Usuario Maestro creado (ID: 1)");
  }

  // 3. VINCULO DE ROL MAESTRO (ID 1)
  // Vinculamos al usuario 1 con el rol 1 (SUPERADMIN)
  const userRoleId = 1;
  const rolId = 1; // SUPERADMIN
  const [existingUserRole] = await db.select().from(userRolesDb).where(eq(userRolesDb.id, userRoleId)).limit(1);

  if (existingUserRole) {
    await db.update(userRolesDb)
      .set({
        usuarioId: usuarioId,
        rolId: rolId,
      })
      .where(eq(userRolesDb.id, userRoleId));
    console.log("  ✓ Vínculo de Rol Maestro actualizado (ID: 1)");
  } else {
    await db.insert(userRolesDb)
      .values({
        id: userRoleId,
        usuarioId: usuarioId,
        rolId: rolId,
      });
    console.log("  ✓ Vínculo de Rol Maestro creado (ID: 1)");
  }

  // 4. REINICIAR SECUENCIAS
  console.log("🔄 Reiniciando secuencias de Estudio y Usuario...");
  await db.execute(sql`SELECT setval(pg_get_serial_sequence('estudios', 'id'), COALESCE(max(id), 1)) FROM estudios;`);
  await db.execute(sql`SELECT setval(pg_get_serial_sequence('usuarios', 'id'), COALESCE(max(id), 1)) FROM usuarios;`);
  await db.execute(sql`SELECT setval(pg_get_serial_sequence('usuario_roles', 'id'), COALESCE(max(id), 1)) FROM usuario_roles;`);

  console.log("🎉 Seed de Estudio y Usuario Maestro completado exitosamente.");
}

main()
  .then(() => {
    console.log("✅ Seed de Estudio y Usuario ejecutado correctamente");
    process.exit(0);
  })
  .catch((e) => {
    console.error("❌ Error en ejecución:", e);
    process.exit(1);
  });
