/**
 * resetFull.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Script de reset completo de la base de datos.
 * Limpia todas las tablas operativas, re-siembra los catálogos de sistema y
 * crea el usuario SuperAdmin predefinido.
 *
 * Uso:
 *   npx tsx src/db/resetFull.ts
 *
 * ⚠️  DESTRUCTIVO: borra todos los datos operativos (clientes, casos, ingresos,
 *     planes, honorarios, etc.). Los catálogos de sistema (categorias, parametros,
 *     roles, ubicaciones) NO se borran; se actualizan de forma idempotente.
 */

import { db } from "./index.js";
import { sql, eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import {
  estudios,
  usuarios,
  usuarioRoles,
  roles,
} from "./schema.js";

// ── Seeds importados como funciones (no como scripts autónomos) ──────────────
import { upsertPlanesSuscripcion } from "./seeds/seedPlanesSuscripcion.js";
import { seedValorJus }            from "./seeds/seedValorJusData.js";

// Los seeds de catálogos no exportan funciones — los ejecutamos mediante
// importación dinámica para reutilizar su lógica sin duplicar código.
// Nota: cada seed individual llama process.exit() al terminar, por eso los
// ejecutamos inline reimportando solo su lógica.

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURACIÓN DEL SUPERADMIN (hardcodeado según especificación)
// ─────────────────────────────────────────────────────────────────────────────
const SUPERADMIN = {
  nombre:   "Gaspar",
  apellido: "Hernández",
  email:    "drive.iuris@gmail.com",
  password: "123456",
};

const ESTUDIO = {
  nombre:          "Lex Sistema Global",
  emailContacto:   "drive.iuris@gmail.com",
  plan:            "PREMIUM" as const,
  maxUsuarios:     100,
  almacenamientoGb: 1000,
};

// ─────────────────────────────────────────────────────────────────────────────

async function truncateOperativas() {
  console.log("\n🧹 [1/8] Reseteando tablas operativas...");
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
      password_reset_tokens,
      sisfe_sessions,
      adjuntos,
      plantillas,
      auditoria_logs,
      usuario_roles,
      usuarios,
      estudios,
      planes_suscripcion,
      valores_jus
    RESTART IDENTITY
    CASCADE;
  `);
  console.log("  ✓ Tablas operativas limpias. IDs reiniciados a 1.");
}

async function seedCatalogos() {
  console.log("\n📂 [2/8] Sembrando categorías...");
  const { categorias: categoriasDb } = await import("./schema.js");
  const categorias = [
    { id: 1,  codigo: "RAMA_DERECHO",       nombre: "Rama del Derecho" },
    { id: 2,  codigo: "TIPO_CASO",          nombre: "Tipo de Caso" },
    { id: 3,  codigo: "ESTADO_CASO",        nombre: "Estado del Caso" },
    { id: 4,  codigo: "ESTADO_RADICACION",  nombre: "Estado en Radicación" },
    { id: 5,  codigo: "TIPO_EVENTO",        nombre: "Tipo de Evento" },
    { id: 6,  codigo: "ESTADO_EVENTO",      nombre: "Estado de Evento" },
    { id: 7,  codigo: "PRIORIDAD",          nombre: "Prioridad" },
    { id: 8,  codigo: "RADICACION",         nombre: "Radicación" },
    { id: 9,  codigo: "LOCALIDAD_RADICACION", nombre: "Localidad Radicación" },
    { id: 10, codigo: "CONCEPTO_HONORARIO", nombre: "Concepto Honorario" },
    { id: 11, codigo: "PARTES",             nombre: "Partes" },
    { id: 12, codigo: "CONCEPTO_GASTO",     nombre: "Concepto Gasto" },
    { id: 13, codigo: "CONCEPTO_INGRESO",   nombre: "Concepto Ingreso" },
    { id: 14, codigo: "MONEDA",             nombre: "Moneda" },
    { id: 15, codigo: "ESTADO_INGRESO",     nombre: "Estado Ingreso" },
    { id: 16, codigo: "ESTADO_HONORARIO",   nombre: "Estado Honorario" },
    { id: 17, codigo: "TIPO_PERSONA",       nombre: "Tipo de Persona" },
    { id: 18, codigo: "PERIODICIDAD",       nombre: "Periodicidad de Plan" },
    { id: 19, codigo: "ESTADO_CUOTA",       nombre: "Estado de Cuota" },
    { id: 20, codigo: "POLITICA_JUS",       nombre: "Política JUS" },
    { id: 21, codigo: "ROL_PARTICIPANTE",   nombre: "Rol de Participante" },
    { id: 22, codigo: "ESTADO_GASTO",       nombre: "Estado de Gasto" },
  ];
  for (const cat of categorias) {
    const [existing] = await db.select().from(categoriasDb).where(eq(categoriasDb.codigo, cat.codigo)).limit(1);
    if (existing) {
      await db.update(categoriasDb).set({ nombre: cat.nombre, activo: true }).where(eq(categoriasDb.id, existing.id));
    } else {
      await db.insert(categoriasDb).values({ id: cat.id, codigo: cat.codigo, nombre: cat.nombre, activo: true });
    }
  }
  await db.execute(sql`SELECT setval(pg_get_serial_sequence('categorias', 'id'), COALESCE(max(id), 1)) FROM categorias;`);
  console.log(`  ✓ ${categorias.length} categorías.`);
}

async function seedRolesYPermisos() {
  console.log("\n🔐 [3/8] Sembrando roles y permisos...");
  const { roles: rolesDb, permisos: permisosDb } = await import("./schema.js");

  const rolesList = [
    { id: 1, codigo: "SUPERADMIN", nombre: "Super Administrador" },
    { id: 2, codigo: "ADMIN",      nombre: "Administrador" },
    { id: 3, codigo: "ABOGADO",    nombre: "Abogado" },
    { id: 4, codigo: "ASISTENTE",  nombre: "Asistente" },
    { id: 5, codigo: "DIRECTOR",   nombre: "Director" },
  ];

  for (const rol of rolesList) {
    const [existing] = await db.select().from(rolesDb).where(eq(rolesDb.id, rol.id)).limit(1);
    if (existing) {
      await db.update(rolesDb).set({ codigo: rol.codigo, nombre: rol.nombre, activo: true }).where(eq(rolesDb.id, rol.id));
    } else {
      await db.insert(rolesDb).values({ id: rol.id, codigo: rol.codigo, nombre: rol.nombre, activo: true });
    }
  }

  const modulos = [
    "CLIENTES", "CASOS", "TAREAS", "EVENTOS", "HONORARIOS",
    "GASTOS", "INGRESOS", "PLANTILLAS", "NOTAS", "VALORJUS",
    "TERCEROS", "PLANES", "ADJUNTOS",
  ];

  let permId = 1;
  for (const rol of rolesList) {
    for (const modulo of modulos) {
      const currentId = permId++;
      const isFullAccessRole = rol.codigo === "SUPERADMIN" || rol.codigo === "ADMIN" || rol.codigo === "DIRECTOR";
      const isAbogado      = rol.codigo === "ABOGADO";
      const canEliminar    = isFullAccessRole || isAbogado;

      const [existing] = await db.select().from(permisosDb).where(eq(permisosDb.id, currentId)).limit(1);
      if (existing) {
        await db.update(permisosDb).set({ rolId: rol.id, modulo, ver: true, crear: true, editar: true, eliminar: canEliminar }).where(eq(permisosDb.id, currentId));
      } else {
        await db.insert(permisosDb).values({ id: currentId, rolId: rol.id, modulo, ver: true, crear: true, editar: true, eliminar: canEliminar });
      }
    }
  }

  await db.execute(sql`SELECT setval(pg_get_serial_sequence('roles', 'id'), COALESCE(max(id), 1)) FROM roles;`);
  await db.execute(sql`SELECT setval(pg_get_serial_sequence('permisos', 'id'), COALESCE(max(id), 1)) FROM permisos;`);
  console.log(`  ✓ ${rolesList.length} roles, ${permId - 1} permisos.`);
}

async function seedUbicaciones() {
  console.log("\n📍 [4/8] Sembrando ubicaciones...");
  const { paises, provincias, localidades, codigosPostales } = await import("./schema.js");

  // País
  const [arg] = await db.select().from(paises).where(eq(paises.id, 1)).limit(1);
  if (!arg) await db.insert(paises).values({ id: 1, nombre: "Argentina", codigoIso: "AR" });

  // Provincia
  const [sf] = await db.select().from(provincias).where(eq(provincias.id, 1)).limit(1);
  if (sf) {
    await db.update(provincias).set({ nombre: "Santa Fe", paisId: 1 }).where(eq(provincias.id, 1));
  } else {
    await db.insert(provincias).values({ id: 1, nombre: "Santa Fe", paisId: 1 });
  }

  // Localidades
  const locs = [
    { id: 1,  nombre: "Aldao",           provinciaId: 1 },
    { id: 2,  nombre: "Andino",          provinciaId: 1 },
    { id: 3,  nombre: "Bustinza",        provinciaId: 1 },
    { id: 4,  nombre: "Cañada de Gomez", provinciaId: 1 },
    { id: 5,  nombre: "Carrizales",      provinciaId: 1 },
    { id: 6,  nombre: "Lucio V. Lopez",  provinciaId: 1 },
    { id: 7,  nombre: "Rosario",         provinciaId: 1 },
    { id: 8,  nombre: "Salto Grande",    provinciaId: 1 },
    { id: 9,  nombre: "San Lorenzo",     provinciaId: 1 },
    { id: 10, nombre: "Santa Fé",        provinciaId: 1 },
    { id: 11, nombre: "Serodino",        provinciaId: 1 },
    { id: 12, nombre: "Totoras",         provinciaId: 1 },
  ];
  for (const loc of locs) {
    const [ex] = await db.select().from(localidades).where(eq(localidades.id, loc.id)).limit(1);
    if (ex) { await db.update(localidades).set({ nombre: loc.nombre }).where(eq(localidades.id, loc.id)); }
    else     { await db.insert(localidades).values(loc); }
  }

  // Códigos postales
  const cps = [
    { id: 1,  codigo: "2214", localidadId: 1  },
    { id: 2,  codigo: "2214", localidadId: 2  },
    { id: 3,  codigo: "2501", localidadId: 3  },
    { id: 4,  codigo: "2500", localidadId: 4  },
    { id: 5,  codigo: "2218", localidadId: 5  },
    { id: 6,  codigo: "2142", localidadId: 6  },
    { id: 7,  codigo: "2000", localidadId: 7  },
    { id: 8,  codigo: "2142", localidadId: 8  },
    { id: 9,  codigo: "2200", localidadId: 9  },
    { id: 10, codigo: "3000", localidadId: 10 },
    { id: 11, codigo: "2216", localidadId: 11 },
    { id: 12, codigo: "2144", localidadId: 12 },
  ];
  for (const cp of cps) {
    const [ex] = await db.select().from(codigosPostales).where(eq(codigosPostales.id, cp.id)).limit(1);
    if (ex) { await db.update(codigosPostales).set({ codigo: cp.codigo }).where(eq(codigosPostales.id, cp.id)); }
    else     { await db.insert(codigosPostales).values(cp); }
  }

  await db.execute(sql`SELECT setval(pg_get_serial_sequence('paises', 'id'), COALESCE(max(id), 1)) FROM paises;`);
  await db.execute(sql`SELECT setval(pg_get_serial_sequence('provincias', 'id'), COALESCE(max(id), 1)) FROM provincias;`);
  await db.execute(sql`SELECT setval(pg_get_serial_sequence('localidades', 'id'), COALESCE(max(id), 1)) FROM localidades;`);
  await db.execute(sql`SELECT setval(pg_get_serial_sequence('codigos_postales', 'id'), COALESCE(max(id), 1)) FROM codigos_postales;`);
  console.log(`  ✓ 1 país, 1 provincia, ${locs.length} localidades, ${cps.length} códigos postales.`);
}

async function seedParametros() {
  console.log("\n⚙️  [5/8] Sembrando parámetros...");
  // Ejecutamos el seed de parámetros como subprocess para evitar conflictos
  // con el contador nextParamId global del módulo.
  const { execSync } = await import("child_process");
  try {
    execSync("npx tsx src/db/seeds/seedParametros.ts", {
      cwd: process.cwd(),
      stdio: "pipe",
    });
    console.log("  ✓ Parámetros sembrados correctamente.");
  } catch (err: any) {
    // stdout/stderr pueden contener los logs del seed
    const output = err.stdout?.toString() ?? err.message ?? "";
    if (output.includes("Seed de parámetros completado")) {
      console.log("  ✓ Parámetros sembrados correctamente.");
    } else {
      throw new Error(`Error en seedParametros: ${output}\n${err.stderr?.toString()}`);
    }
  }
}

async function seedPlanes() {
  console.log("\n💳 [6/8] Sembrando planes de suscripción...");
  const planes = await upsertPlanesSuscripcion();
  console.log(`  ✓ ${planes.length} planes de suscripción.`);
  return planes;
}

async function crearEstudioYSuperAdmin(planId: number | null) {
  console.log("\n🏢 [7/8] Creando estudio y SuperAdmin...");

  // Estudio
  const [estudio] = await db.insert(estudios).values({
    nombre:           ESTUDIO.nombre,
    emailContacto:    ESTUDIO.emailContacto,
    planSuscripcionId: planId,
    plan:             ESTUDIO.plan,
    maxUsuarios:      ESTUDIO.maxUsuarios,
    almacenamientoGb: ESTUDIO.almacenamientoGb,
    activo:           true,
  }).returning();
  console.log(`  ✓ Estudio "${estudio.nombre}" creado (ID: ${estudio.id})`);

  // Rol SUPERADMIN (puede no existir si la tabla roles fue truncada)
  let [rolSuperadmin] = await db.select().from(roles).where(eq(roles.codigo, "SUPERADMIN")).limit(1);
  if (!rolSuperadmin) {
    [rolSuperadmin] = await db.insert(roles).values({ codigo: "SUPERADMIN", nombre: "Super Administrador", activo: true }).returning();
    console.log(`  ✓ Rol SUPERADMIN creado (ID: ${rolSuperadmin.id})`);
  }

  // Usuario
  const passwordHash = await bcrypt.hash(SUPERADMIN.password, 12);
  const [usuario] = await db.insert(usuarios).values({
    estudioId:    estudio.id,
    nombre:       SUPERADMIN.nombre,
    apellido:     SUPERADMIN.apellido,
    email:        SUPERADMIN.email,
    passwordHash,
    activo:       true,
  }).returning();
  console.log(`  ✓ Usuario "${usuario.nombre} ${usuario.apellido}" creado (ID: ${usuario.id})`);

  // Vínculo de rol
  await db.insert(usuarioRoles).values({ usuarioId: usuario.id, rolId: rolSuperadmin.id });
  console.log(`  ✓ Rol SUPERADMIN asignado al usuario.`);

  // Reiniciar secuencias
  await db.execute(sql`SELECT setval(pg_get_serial_sequence('estudios', 'id'), COALESCE(max(id), 1)) FROM estudios;`);
  await db.execute(sql`SELECT setval(pg_get_serial_sequence('usuarios', 'id'), COALESCE(max(id), 1)) FROM usuarios;`);
  await db.execute(sql`SELECT setval(pg_get_serial_sequence('usuario_roles', 'id'), COALESCE(max(id), 1)) FROM usuario_roles;`);

  return { estudio, usuario };
}

async function seedJus(estudioId: number) {
  console.log("\n💱 [8/8] Sembrando valores JUS históricos...");
  await seedValorJus(estudioId);
  console.log("  ✓ 33 valores JUS cargados (jul 2023 → mar 2026).");
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
async function run() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║         IURIS — RESET COMPLETO DE BASE           ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log("⚠️  Esto BORRARÁ todos los datos operativos.");
  console.log("    Los catálogos se actualizarán de forma idempotente.\n");

  try {
    await truncateOperativas();
    await seedCatalogos();
    await seedRolesYPermisos();
    await seedUbicaciones();
    await seedParametros();

    const planes = await seedPlanes();
    const premium = planes.find((p) => p.codigo === "PREMIUM") ?? null;

    const { estudio } = await crearEstudioYSuperAdmin(premium?.id ?? null);
    await seedJus(estudio.id);

    console.log("\n╔══════════════════════════════════════════════════╗");
    console.log("║         ✅  RESET COMPLETADO CON ÉXITO           ║");
    console.log("╠══════════════════════════════════════════════════╣");
    console.log(`║  📧 Email:     ${SUPERADMIN.email.padEnd(33)}║`);
    console.log(`║  🔑 Password:  ${"[redactada]".padEnd(33)}║`);
    console.log(`║  🏢 Estudio:   ${ESTUDIO.nombre.padEnd(33)}║`);
    console.log(`║  💱 JUS actual: $132.863,18 (mar 2026)           ║`);
    console.log("╚══════════════════════════════════════════════════╝\n");
  } catch (error) {
    console.error("\n❌ Error durante el reset:", error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

run();
