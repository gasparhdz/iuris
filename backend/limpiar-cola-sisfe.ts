// Script de un solo uso: limpia la cola BullMQ "sisfe-sync" en Redis,
// eliminando jobs zombies que quedaron colgados (estado "active" sin worker vivo).
// Uso:  npx tsx limpiar-cola-sisfe.ts   (parado en la carpeta backend)
// Borralo cuando termines.
import { sisfeSyncQueue, closeSisfeQueue } from "./src/queue/sisfe.queue.js";

async function main() {
  // obliterate({ force: true }) borra TODOS los jobs, incluidos los "active" zombies.
  await sisfeSyncQueue.obliterate({ force: true });
  console.log("✅ Cola 'sisfe-sync' limpiada (jobs zombies eliminados).");
  await closeSisfeQueue();
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error limpiando la cola:", err);
  process.exit(1);
});
