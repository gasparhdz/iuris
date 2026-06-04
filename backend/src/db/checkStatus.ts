import { db } from "./index.js";
import { sisfeSessions } from "./schema.js";

async function main() {
  const rows = await db.select().from(sisfeSessions);
  console.log("=== SISFE SESSIONS STATUS ===");
  console.log(rows.map((row) => ({
    id: row.id,
    usuarioId: row.usuarioId,
    estudioId: row.estudioId,
    syncStatus: row.syncStatus,
    lastVerifiedAt: row.lastVerifiedAt,
    lastSyncAt: row.lastSyncAt,
  })));
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
