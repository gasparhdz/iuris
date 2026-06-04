import { db } from "./index.js";
import { estudios, usuarios, roles, usuarioRoles } from "./schema.js";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function run() {
  console.log("🚀 Creando usuario SUPERADMIN en la base de datos de Iuris...");
  try {
    // 1. Asegurar que existe el Estudio del Sistema
    let [estudio] = await db.select().from(estudios).where(eq(estudios.nombre, "Lex Sistema Global")).limit(1);
    if (!estudio) {
      console.log("🏢 Creando Estudio del Sistema...");
      [estudio] = await db.insert(estudios).values({
        nombre: "Lex Sistema Global",
        emailContacto: "soporte@lex.com",
        activo: true,
      }).returning();
    }
    console.log(`✅ Estudio del Sistema: ${estudio.nombre} (ID: ${estudio.id})`);

    // 2. Asegurar que existe el rol SUPERADMIN
    let [superadminRole] = await db.select().from(roles).where(eq(roles.codigo, "SUPERADMIN")).limit(1);
    if (!superadminRole) {
      console.log("⚙️ Creando Rol SUPERADMIN...");
      [superadminRole] = await db.insert(roles).values({
        codigo: "SUPERADMIN",
        nombre: "Super Administrador",
        activo: true,
      }).returning();
    }
    console.log(`✅ Rol SUPERADMIN registrado (ID: ${superadminRole.id})`);

    // 3. Crear usuario SuperAdmin
    const email = "superadmin@lex.com";
    const password = "supersecretpassword123";
    
    let [superUser] = await db.select().from(usuarios).where(eq(usuarios.email, email)).limit(1);
    if (!superUser) {
      console.log(`👤 Creando usuario ${email}...`);
      const passwordHash = await bcrypt.hash(password, 12);
      [superUser] = await db.insert(usuarios).values({
        estudioId: estudio.id,
        nombre: "Super",
        apellido: "Admin",
        email,
        passwordHash,
        activo: true,
      }).returning();
      console.log(`✅ Usuario creado con éxito!`);
    } else {
      console.log(`ℹ️ El usuario ${email} ya existe (ID: ${superUser.id})`);
    }

    // 4. Vincular Rol
    let [userRole] = await db.select().from(usuarioRoles).where(eq(usuarioRoles.usuarioId, superUser.id)).limit(1);
    if (!userRole) {
      console.log("🔗 Vinculando Rol SUPERADMIN al usuario...");
      await db.insert(usuarioRoles).values({
        usuarioId: superUser.id,
        rolId: superadminRole.id,
      });
      console.log(`✅ Vinculación exitosa!`);
    } else {
      console.log(`ℹ️ El usuario ya posee un rol asignado en la base de datos.`);
    }

    console.log("\n🎉 PROCESO COMPLETADO CON ÉXITO!");
    console.log("=========================================");
    console.log(`📧 Email: ${email}`);
    console.log("🔑 Contraseña: [redactada]");
    console.log("=========================================\n");
  } catch (error) {
    console.error("❌ Error al crear el SuperAdmin:", error);
  } finally {
    process.exit(0);
  }
}

run();
