import { Worker } from "bullmq";
import { env } from "../env.js";
import { ejecutarSync } from "../services/sisfe-sync.service.js";
import { updateSyncStatus } from "../services/sisfe-session.service.js";
import { logger } from "../utils/logger.js";
import { SISFE_SYNC_QUEUE_NAME, sisfeRedisConnection, type SisfeSyncJobData } from "./sisfe.queue.js";

const log = logger.child({ module: "SISFE-Worker" });

export const sisfeSyncWorker = new Worker<SisfeSyncJobData, void, "sync">(
  SISFE_SYNC_QUEUE_NAME,
  async (job) => {
    await ejecutarSync(job.data.usuarioId, job.data.estudioId, job.data.casoId);
  },
  {
    connection: sisfeRedisConnection,
    concurrency: env.SISFE_CONCURRENCY,
    lockDuration: 5 * 60 * 1000,
  },
);

// El error de conexión a Redis es la falla silenciosa más difícil de diagnosticar: sin este
// handler el worker simplemente no consume jobs y no deja rastro.
sisfeSyncWorker.on("error", (err) => log.error({ err }, "Worker SISFE: error de conexión/procesamiento"));

sisfeSyncWorker.on("completed", (job) => {
  log.info({ jobId: job.id }, "Job SISFE completado");
});

sisfeSyncWorker.on("failed", async (job, error) => {
  log.error({ err: error, jobId: job?.id }, "Job SISFE fallido");
  if (!job?.data?.usuarioId) return;
  try {
    await updateSyncStatus(
      job.data.usuarioId,
      "error",
      0,
      error instanceof Error ? error.message : "La sincronización SISFE falló inesperadamente",
    );
  } catch (updateError) {
    log.error({ err: updateError, jobId: job.id }, "No se pudo actualizar estado tras fallo SISFE");
  }
});

export async function closeSisfeWorker(): Promise<void> {
  await sisfeSyncWorker.close();
}
