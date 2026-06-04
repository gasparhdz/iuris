import { db } from "./index.js";
import { sisfeSessions } from "./schema.js";

async function main() {
  console.log("Reseteando estado de sync en la base de datos...");
  await db.update(sisfeSessions).set({
    syncStatus: "idle",
    syncProgress: 0,
    syncMessage: "Sincronización cancelada por reinicio",
  });
  console.log("¡Reseteado con éxito!");
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
