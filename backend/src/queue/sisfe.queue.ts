import { Queue, type JobsOptions } from "bullmq";
import { env } from "../env.js";

export const SISFE_SYNC_QUEUE_NAME = "sisfe-sync";

export type SisfeSyncJobData = {
  usuarioId: number;
  estudioId: number;
  casoId?: number;
};

export const sisfeRedisConnection = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  maxRetriesPerRequest: null,
};

export const sisfeSyncQueue = new Queue<SisfeSyncJobData, unknown, "sync">(SISFE_SYNC_QUEUE_NAME, {
  connection: sisfeRedisConnection,
});

// El reintento de operaciones transitorias se maneja en proceso con `conReintentos`
// (ver sisfe-scraper.service.ts). Los errores terminales como SESION_EXPIRADA no deben
// reintentarse, y `ejecutarSync` ya captura todo internamente, así que el reintento a
// nivel de job no aporta y se desactiva (attempts: 1) para no inducir a error.
const syncJobOptions: JobsOptions = {
  attempts: 1,
  removeOnComplete: true,
  removeOnFail: true,
};

export async function enqueueSisfeSync(data: SisfeSyncJobData) {
  return sisfeSyncQueue.add("sync", data, {
    ...syncJobOptions,
    jobId: `sync-${data.usuarioId}`,
  });
}

export async function closeSisfeQueue(): Promise<void> {
  await sisfeSyncQueue.close();
}
