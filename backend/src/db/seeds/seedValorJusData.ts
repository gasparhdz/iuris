import { fileURLToPath } from "url";
import { db } from "../../db/index.js";
import { valoresJus, estudios } from "../../db/schema.js";
import { eq, and, sql } from "drizzle-orm";

// ─── Datos embebidos desde valorJus.csv ────────────────────────────────────
// Fuente original: C:\Users\Gaspar\Desktop\iuris\valorJus.csv
// Última actualización: 2026-03-01 (JUS = $132.863,18)
const VALORES_JUS: { valor: string; fecha: Date; activo: boolean }[] = [
  { valor: "28615.0000",  fecha: new Date("2023-07-01"), activo: true },
  { valor: "32048.8100",  fecha: new Date("2023-08-01"), activo: true },
  { valor: "35253.6900",  fecha: new Date("2023-09-01"), activo: true },
  { valor: "38602.7900",  fecha: new Date("2023-10-01"), activo: true },
  { valor: "42463.0700",  fecha: new Date("2023-11-01"), activo: true },
  { valor: "47770.9500",  fecha: new Date("2023-12-01"), activo: true },
  { valor: "56369.7200",  fecha: new Date("2024-01-01"), activo: true },
  { valor: "63134.0900",  fecha: new Date("2024-02-01"), activo: true },
  { valor: "68184.8200",  fecha: new Date("2024-03-01"), activo: true },
  { valor: "72957.7500",  fecha: new Date("2024-04-01"), activo: true },
  { valor: "76021.9800",  fecha: new Date("2024-05-01"), activo: true },
  { valor: "79214.9000",  fecha: new Date("2024-06-01"), activo: true },
  { valor: "81987.4200",  fecha: new Date("2024-07-01"), activo: true },
  { valor: "84447.0500",  fecha: new Date("2024-08-01"), activo: true },
  { valor: "86135.9900",  fecha: new Date("2024-09-01"), activo: true },
  { valor: "88289.3900",  fecha: new Date("2024-10-01"), activo: true },
  { valor: "90496.6200",  fecha: new Date("2024-11-01"), activo: true },
  { valor: "92306.5500",  fecha: new Date("2024-12-01"), activo: true },
  { valor: "93968.0700",  fecha: new Date("2025-01-01"), activo: true },
  { valor: "95847.4300",  fecha: new Date("2025-02-01"), activo: true },
  { valor: "98243.6200",  fecha: new Date("2025-03-01"), activo: true },
  { valor: "100404.9800", fecha: new Date("2025-04-01"), activo: true },
  { valor: "101710.2400", fecha: new Date("2025-05-01"), activo: true },
  { valor: "103337.6100", fecha: new Date("2025-06-01"), activo: true },
  { valor: "105301.0200", fecha: new Date("2025-07-01"), activo: true },
  { valor: "107301.7400", fecha: new Date("2025-08-01"), activo: true },
  { valor: "109555.0800", fecha: new Date("2025-09-01"), activo: true },
  { valor: "112074.8500", fecha: new Date("2025-10-01"), activo: true },
  { valor: "118048.4400", fecha: new Date("2025-11-01"), activo: true },
  { valor: "121353.7900", fecha: new Date("2025-12-01"), activo: true },
  { valor: "124873.0500", fecha: new Date("2026-01-01"), activo: true },
  { valor: "128494.3700", fecha: new Date("2026-02-01"), activo: true },
  { valor: "132863.1800", fecha: new Date("2026-03-01"), activo: true },
  { valor: "135000.0000", fecha: new Date("2026-05-02"), activo: true },
];

export async function seedValorJus(estudioId: number) {
  console.log(`  💱 Insertando ${VALORES_JUS.length} valores JUS para estudio ID ${estudioId}...`);

  let creados = 0;
  let actualizados = 0;

  for (const row of VALORES_JUS) {
    const [existing] = await db
      .select()
      .from(valoresJus)
      .where(
        and(
          eq(valoresJus.estudioId, estudioId),
          eq(valoresJus.fecha, row.fecha)
        )
      )
      .limit(1);

    if (existing) {
      if (existing.valor !== row.valor || existing.activo !== row.activo) {
        await db.update(valoresJus)
          .set({ valor: row.valor, activo: row.activo })
          .where(eq(valoresJus.id, existing.id));
        actualizados++;
      }
    } else {
      await db.insert(valoresJus).values({
        estudioId,
        valor: row.valor,
        fecha: row.fecha,
        activo: row.activo,
      });
      creados++;
    }
  }

  await db.execute(sql`SELECT setval(pg_get_serial_sequence('valores_jus', 'id'), COALESCE(max(id), 1)) FROM valores_jus;`);
  console.log(`  ✓ JUS: ${creados} creados, ${actualizados} actualizados.`);
}

// ─── Ejecutable standalone (solo cuando se corre directamente) ──────────────
async function main() {
  console.log("🚀 Iniciando seed de valores JUS (datos embebidos)...");
  const estudiosList = await db.select().from(estudios);
  if (estudiosList.length === 0) {
    console.error("❌ No hay estudios en la base de datos. Ejecutá resetFull.ts primero.");
    process.exit(1);
  }
  for (const estudio of estudiosList) {
    await seedValorJus(estudio.id);
  }
  console.log("🎉 Seed de valores JUS completado.");
}

// Patrón ESM: solo ejecutar main() si este archivo es el punto de entrada.
// Cuando resetFull.ts importa { seedValorJus }, esta función NO se dispara.
const __filename = fileURLToPath(import.meta.url);
const isMain = process.argv[1] === __filename ||
               process.argv[1]?.replace(/\\/g, "/") === __filename.replace(/\\/g, "/");

if (isMain) {
  main()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error("❌ Error:", e);
      process.exit(1);
    });
}
