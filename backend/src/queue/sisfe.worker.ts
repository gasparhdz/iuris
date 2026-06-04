import { Worker } from "bullmq";
import { env } from "../env.js";
import { ejecutarSync } from "../services/sisfe-sync.service.js";
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

sisfeSyncWorker.on("completed", (job) => {
  log.info({ jobId: job.id }, "Job SISFE completado");
});

sisfeSyncWorker.on("failed", (job, error) => {
  log.error({ err: error, jobId: job?.id }, "Job SISFE fallido");
});

export async function closeSisfeWorker(): Promise<void> {
  await sisfeSyncWorker.close();
}
