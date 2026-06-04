import { db } from "../../db/index.js";
import { categorias as categoriasDb } from "../../db/schema.js";
import { eq } from "drizzle-orm";

async function main() {
  console.log('📂 Iniciando seed de categorías...');

  const categorias = [
    { id: 1, codigo: 'RAMA_DERECHO', nombre: 'Rama del Derecho', descripcion: null },
    { id: 2, codigo: 'TIPO_CASO', nombre: 'Tipo de Caso', descripcion: null },
    { id: 3, codigo: 'ESTADO_CASO', nombre: 'Estado del Caso', descripcion: null },
    { id: 4, codigo: 'ESTADO_RADICACION', nombre: 'Estado en Radicación', descripcion: null },
    { id: 5, codigo: 'TIPO_EVENTO', nombre: 'Tipo de Evento', descripcion: null },
    { id: 6, codigo: 'ESTADO_EVENTO', nombre: 'Estado de Evento', descripcion: null },
    { id: 7, codigo: 'PRIORIDAD', nombre: 'Prioridad', descripcion: null },
    { id: 8, codigo: 'RADICACION', nombre: 'Radicación', descripcion: null },
    { id: 9, codigo: 'LOCALIDAD_RADICACION', nombre: 'Localidad Radicación', descripcion: null },
    { id: 10, codigo: 'CONCEPTO_HONORARIO', nombre: 'Concepto Honorario', descripcion: null },
    { id: 11, codigo: 'PARTES', nombre: 'Partes', descripcion: null },
    { id: 12, codigo: 'CONCEPTO_GASTO', nombre: 'Concepto Gasto', descripcion: null },
    { id: 13, codigo: 'CONCEPTO_INGRESO', nombre: 'Concepto Ingreso', descripcion: null },
    { id: 14, codigo: 'MONEDA', nombre: 'Moneda', descripcion: null },
    { id: 15, codigo: 'ESTADO_INGRESO', nombre: 'Estado Ingreso', descripcion: null },
    { id: 16, codigo: 'ESTADO_HONORARIO', nombre: 'Estado Honorario', descripcion: null },
    { id: 17, codigo: 'TIPO_PERSONA', nombre: 'Tipo de Persona', descripcion: null },
    { id: 18, codigo: 'PERIODICIDAD', nombre: 'Periodicidad de Plan', descripcion: null },
    { id: 19, codigo: 'ESTADO_CUOTA', nombre: 'Estado de Cuota', descripcion: null },
    { id: 20, codigo: 'POLITICA_JUS', nombre: 'Política JUS', descripcion: null },
    { id: 21, codigo: 'ROL_PARTICIPANTE', nombre: 'Rol de Participante', descripcion: null },
    { id: 22, codigo: 'ESTADO_GASTO', nombre: 'Estado de Gasto', descripcion: null },
  ];

  for (const cat of categorias) {
    const [existing] = await db.select().from(categoriasDb).where(eq(categoriasDb.codigo, cat.codigo)).limit(1);
    if (existing) {
      await db.update(categoriasDb).set({ nombre: cat.nombre, descripcion: cat.descripcion, activo: true }).where(eq(categoriasDb.id, existing.id));
    } else {
      await db.insert(categoriasDb).values({ id: cat.id, codigo: cat.codigo, nombre: cat.nombre, descripcion: cat.descripcion, activo: true });
    }
    console.log(`  ✓ ${cat.codigo} (ID: ${cat.id})`);
  }

  console.log(`🎉 ${categorias.length} categorías creadas exitosamente`);
}

main()
  .then(() => console.log('✅ Seed ejecutado exitosamente'))
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });

