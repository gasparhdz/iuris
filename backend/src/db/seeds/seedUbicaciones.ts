import { db } from "../../db/index.js";
import { paises as paisesDb, provincias as provinciasDb, localidades as localidadesDb, codigosPostales as cpDb } from "../../db/schema.js";
import { eq, sql } from "drizzle-orm";

async function main() {
  console.log('📍 Iniciando seed de ubicaciones...');

  // 1. PAIS
  let [argentina] = await db.select().from(paisesDb).where(eq(paisesDb.id, 1)).limit(1);
  if (!argentina) {
    [argentina] = await db.insert(paisesDb).values({ id: 1, nombre: 'Argentina', codigoIso: 'AR' }).returning();
  }
  console.log('✅ País Argentina creado (ID: ' + argentina.id + ')');

  // 2. PROVINCIA
  let [santaFe] = await db.select().from(provinciasDb).where(eq(provinciasDb.id, 1)).limit(1);
  if (!santaFe) {
    [santaFe] = await db.insert(provinciasDb).values({ id: 1, nombre: 'Santa Fe', paisId: 1 }).returning();
  } else {
    await db.update(provinciasDb).set({ nombre: 'Santa Fe', paisId: 1 }).where(eq(provinciasDb.id, 1));
  }
  console.log('✅ Provincia Santa Fe creada (ID: ' + santaFe.id + ')');

  // 3. LOCALIDADES
  const localidades = [
    { id: 1, nombre: 'Aldao', provinciaId: 1 },
    { id: 2, nombre: 'Andino', provinciaId: 1 },
    { id: 3, nombre: 'Bustinza', provinciaId: 1 },
    { id: 4, nombre: 'Cañada de Gomez', provinciaId: 1 },
    { id: 5, nombre: 'Carrizales', provinciaId: 1 },
    { id: 6, nombre: 'Lucio V. Lopez', provinciaId: 1 },
    { id: 7, nombre: 'Rosario', provinciaId: 1 },
    { id: 8, nombre: 'Salto Grande', provinciaId: 1 },
    { id: 9, nombre: 'San Lorenzo', provinciaId: 1 },
    { id: 10, nombre: 'Santa Fé', provinciaId: 1 },
    { id: 11, nombre: 'Serodino', provinciaId: 1 },
    { id: 12, nombre: 'Totoras', provinciaId: 1 },
  ];

  for (const loc of localidades) {
    const [existing] = await db.select().from(localidadesDb).where(eq(localidadesDb.id, loc.id)).limit(1);
    if (existing) {
        await db.update(localidadesDb).set({ nombre: loc.nombre, provinciaId: loc.provinciaId }).where(eq(localidadesDb.id, loc.id));
    } else {
        await db.insert(localidadesDb).values({ id: loc.id, nombre: loc.nombre, provinciaId: loc.provinciaId });
    }
  }
  console.log(`✅ ${localidades.length} localidades creadas`);

  // 4. CÓDIGOS POSTALES
  const codigosPostales = [
    { id: 1, codigo: '2214', localidadId: 1 },
    { id: 2, codigo: '2214', localidadId: 2 },
    { id: 3, codigo: '2501', localidadId: 3 },
    { id: 4, codigo: '2500', localidadId: 4 },
    { id: 5, codigo: '2218', localidadId: 5 },
    { id: 6, codigo: '2142', localidadId: 6 },
    { id: 7, codigo: '2000', localidadId: 7 },
    { id: 8, codigo: '2142', localidadId: 8 },
    { id: 9, codigo: '2200', localidadId: 9 },
    { id: 10, codigo: '3000', localidadId: 10 },
    { id: 11, codigo: '2216', localidadId: 11 },
    { id: 12, codigo: '2144', localidadId: 12 },
  ];

  for (const cp of codigosPostales) {
    const [existing] = await db.select().from(cpDb).where(eq(cpDb.id, cp.id)).limit(1);
    if (existing) {
        await db.update(cpDb).set({ codigo: cp.codigo, localidadId: cp.localidadId }).where(eq(cpDb.id, cp.id));
    } else {
        await db.insert(cpDb).values({ id: cp.id, codigo: cp.codigo, localidadId: cp.localidadId });
    }
  }
  console.log(`✅ ${codigosPostales.length} códigos postales creados`);

  console.log('🔄 Reiniciando secuencias de ID de ubicaciones...');
  await db.execute(sql`SELECT setval(pg_get_serial_sequence('paises', 'id'), COALESCE(max(id), 1)) FROM paises;`);
  await db.execute(sql`SELECT setval(pg_get_serial_sequence('provincias', 'id'), COALESCE(max(id), 1)) FROM provincias;`);
  await db.execute(sql`SELECT setval(pg_get_serial_sequence('localidades', 'id'), COALESCE(max(id), 1)) FROM localidades;`);
  await db.execute(sql`SELECT setval(pg_get_serial_sequence('codigos_postales', 'id'), COALESCE(max(id), 1)) FROM codigos_postales;`);

  console.log('🎉 Seed de ubicaciones completado');
}

main()
  .then(() => {
      console.log('✅ Seed ejecutado exitosamente');
      process.exit(0);
  })
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  });
