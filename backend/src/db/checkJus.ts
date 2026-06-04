import { db } from "./index.js";
import { valoresJus } from "./schema.js";
import { desc } from "drizzle-orm";

async function main() {
  const rows = await db.select().from(valoresJus).orderBy(desc(valoresJus.id)).limit(10);
  console.log("=== ÚLTIMOS 10 REGISTROS DE VALORES JUS ===");
  console.log(rows.map((row) => ({ id: row.id, estudioId: row.estudioId, fecha: row.fecha, activo: row.activo })));
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
