import { db } from "./index.js";
import { estudios, usuarios, roles, usuarioRoles } from "./schema.js";
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { upsertPlanesSuscripcion } from "./seeds/seedPlanesSuscripcion.js";

async function run() {
  const customPassword = process.argv[2];
  
  if (!customPassword) {
    console.error("❌ Error: Debes especificar una contraseña para el SuperAdmin.");
    console.error("👉 Ejemplo de uso: npx tsx src/db/resetAndCreateSuperAdmin.ts \"tu_contrasena_aqui\"\n");
    process.exit(1);
  }

  console.log("⚠️  Iniciando proceso de limpieza de base de datos...");
  try {
    // 1. Resetear todas las tablas operativas reiniciando sus IDs (secuencias) a 1
    // Mantenemos: categorias, parametros, paises, provincias, localidades, codigos_postales y roles
    console.log("🧹 Reseteando tablas operativas y reiniciando contadores de ID...");
    await db.execute(sql`
      TRUNCATE TABLE 
        ingresos,
        gastos,
        plan_cuotas,
        planes_pago,
        honorarios,
        sub_tareas,
        tareas,
        eventos,
        notas_caso,
        notas_cliente,
        movimientos_judiciales,
        participantes_caso,
        casos,
        contactos_clientes,
        clientes,
        terceros,
        refresh_tokens,
        usuario_roles,
        usuarios,
        estudios,
        planes_suscripcion,
        valores_jus,
        adjuntos,
        plantillas
      RESTART IDENTITY 
      CASCADE;
    `);
    console.log("✅ Base de datos operativa limpiada con éxito. IDs reseteados a 1.");

    console.log("💳 Sembrando planes de suscripción...");
    const planes = await upsertPlanesSuscripcion();
    const premium = planes.find((plan) => plan.codigo === "PREMIUM") ?? null;
    console.log("✅ Planes de suscripción inicializados.");

    // 2. Crear Estudio de Sistema Global (Tendrá ID 1 al haber reseteado la secuencia)
    // Usamos el Estudio de Sistema como ancla obligatoria por consistencia del backend sin romper restricciones NOT NULL.
    console.log("🏢 Creando Estudio de Administración SaaS...");
    const [estudio] = await db.insert(estudios).values({
      nombre: "Lex Sistema Global",
      emailContacto: "gaspihernandez@gmail.com",
      planSuscripcionId: premium?.id ?? null,
      plan: "PREMIUM",
      maxUsuarios: 100,
      almacenamientoGb: 1000,
      activo: true,
    }).returning();
    console.log(`✅ Estudio del Sistema creado: ${estudio.nombre} (ID: ${estudio.id})`);

    // 3. Asegurar que existe el rol SUPERADMIN en la tabla roles (que no fue truncada)
    let [superadminRole] = await db.select().from(roles).where(eq(roles.codigo, "SUPERADMIN")).limit(1);
    if (!superadminRole) {
      console.log("⚙️ Creando Rol SUPERADMIN en catálogo...");
      [superadminRole] = await db.insert(roles).values({
        codigo: "SUPERADMIN",
        nombre: "Super Administrador",
        activo: true,
      }).returning();
    }
    console.log(`✅ Rol SUPERADMIN registrado (ID: ${superadminRole.id})`);

    // 4. Crear usuario SuperAdmin con los datos reales del usuario
    const email = "gaspihernandez@gmail.com";
    console.log(`👤 Creando usuario SuperAdmin: ${email}...`);
    const passwordHash = await bcrypt.hash(customPassword, 12);
    
    const [superUser] = await db.insert(usuarios).values({
      estudioId: estudio.id, // Vinculado al estudio de control del sistema (ID 1)
      nombre: "Gaspar",
      apellido: "Hernández",
      email,
      passwordHash,
      activo: true,
    }).returning();
    console.log(`✅ Usuario SuperAdmin creado (ID: ${superUser.id})`);

    // 5. Vincular Rol SUPERADMIN al usuario
    console.log("🔗 Asignando permisos de SuperAdmin...");
    await db.insert(usuarioRoles).values({
      usuarioId: superUser.id,
      rolId: superadminRole.id,
    });
    console.log(`✅ Permisos asignados con éxito!`);

    console.log("\n🎉 BASE DE DATOS RESETEADA Y SUPERADMIN CREADO CON ÉXITO!");
    console.log("==========================================================");
    console.log(`📧 Email: ${email}`);
    console.log(`🔑 Contraseña: [La contraseña que ingresaste]`);
    console.log(`🏢 Estudio SaaS: ${estudio.nombre} (ID: ${estudio.id})`);
    console.log("==========================================================\n");
  } catch (error) {
    console.error("❌ Error durante el proceso de reset/creación:", error);
  } finally {
    process.exit(0);
  }
}

run();
