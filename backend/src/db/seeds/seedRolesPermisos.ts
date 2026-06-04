import { db } from "../../db/index.js";
import { roles as rolesDb, permisos as permisosDb } from "../../db/schema.js";
import { eq, sql } from "drizzle-orm";

async function main() {
  console.log("⚙️ Iniciando seed de Roles y Permisos...");

  // 1. ROLES
  const roles = [
    { id: 1, codigo: "SUPERADMIN", nombre: "Super Administrador" },
    { id: 2, codigo: "ADMIN", nombre: "Administrador" },
    { id: 3, codigo: "ABOGADO", nombre: "Abogado" },
    { id: 4, codigo: "ASISTENTE", nombre: "Asistente" },
    { id: 5, codigo: "DIRECTOR", nombre: "Director" },
  ];

  for (const rol of roles) {
    const [existing] = await db.select().from(rolesDb).where(eq(rolesDb.id, rol.id)).limit(1);
    if (existing) {
      await db.update(rolesDb).set({ codigo: rol.codigo, nombre: rol.nombre, activo: true }).where(eq(rolesDb.id, rol.id));
    } else {
      await db.insert(rolesDb).values({ id: rol.id, codigo: rol.codigo, nombre: rol.nombre, activo: true });
    }
    console.log(`  ✓ Rol: ${rol.codigo} (ID: ${rol.id})`);
  }

  // 2. MODULOS
  const modulos = [
    "CLIENTES", "CASOS", "TAREAS", "EVENTOS", "HONORARIOS", 
    "GASTOS", "INGRESOS", "PLANTILLAS", "NOTAS", "VALORJUS", 
    "TERCEROS", "PLANES", "ADJUNTOS"
  ];

  // 3. PERMISOS (13 modulos * 4 roles = 52 permisos estáticos)
  let permissionId = 1;

  for (const rol of roles) {
    for (const modulo of modulos) {
      const currentId = permissionId++;
      
      // Reglas de negocio para permisos por defecto:
      // SUPERADMIN, ADMIN y DIRECTOR tienen acceso total (crear, editar, eliminar, ver).
      // ABOGADO tiene acceso total a la operatoria habitual.
      // ASISTENTE puede ver, crear y editar, pero no eliminar.
      const isFullAccessRole = rol.codigo === "SUPERADMIN" || rol.codigo === "ADMIN" || rol.codigo === "DIRECTOR";
      const isAbogado = rol.codigo === "ABOGADO";
      
      const canVer = true;
      const canCrear = true;
      const canEditar = true;
      const canEliminar = isFullAccessRole || isAbogado; // Asistente no puede eliminar

      const [existing] = await db.select().from(permisosDb).where(eq(permisosDb.id, currentId)).limit(1);
      
      if (existing) {
        await db.update(permisosDb)
          .set({
            rolId: rol.id,
            modulo,
            ver: canVer,
            crear: canCrear,
            editar: canEditar,
            eliminar: canEliminar,
          })
          .where(eq(permisosDb.id, currentId));
      } else {
        await db.insert(permisosDb)
          .values({
            id: currentId,
            rolId: rol.id,
            modulo,
            ver: canVer,
            crear: canCrear,
            editar: canEditar,
            eliminar: canEliminar,
          });
      }
    }
  }

  console.log(`✅ ${permissionId - 1} registros de permisos establecidos de forma estática.`);

  // 4. RESET SECUENCIA
  console.log("🔄 Reiniciando secuencias de Roles y Permisos...");
  await db.execute(sql`SELECT setval(pg_get_serial_sequence('roles', 'id'), COALESCE(max(id), 1)) FROM roles;`);
  await db.execute(sql`SELECT setval(pg_get_serial_sequence('permisos', 'id'), COALESCE(max(id), 1)) FROM permisos;`);

  console.log("🎉 Seed de Roles y Permisos completado exitosamente.");
}

main()
  .then(() => {
    console.log("✅ Seed de Roles y Permisos ejecutado correctamente");
    process.exit(0);
  })
  .catch((e) => {
    console.error("❌ Error en ejecución:", e);
    process.exit(1);
  });
