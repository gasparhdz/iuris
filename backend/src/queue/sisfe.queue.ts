import { Queue, type JobsOptions } from "bullmq";
import { env } from "../env.js";

export const SISFE_SYNC_QUEUE_NAME = "sisfe-sync";

export type SisfeSyncJobData = {
  usuarioId: number;
  estudioId: number;
  casoId?: number;
};

export class SisfeSyncAlreadyRunningError extends Error {
  constructor() {
    super("Sincronización ya en curso");
    this.name = "SisfeSyncAlreadyRunningError";
  }
}

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
  // Lock por estudio: un solo job activo/pendiente por estudio (BullMQ jobId = SET NX).
  const jobId = `sync-estudio-${data.estudioId}`;

  const existing = await sisfeSyncQueue.getJob(jobId);
  if (existing) {
    const state = await existing.getState();
    // Nunca remover jobs activos/pendientes de otro claim.
    if (state === "active" || state === "waiting" || state === "delayed" || state === "prioritized" || state === "waiting-children") {
      throw new SisfeSyncAlreadyRunningError();
    }
    if (state === "completed" || state === "failed") {
      try {
        await existing.remove();
      } catch {
        // Job ya removido o bloqueado: BullMQ rechazará el add si el id sigue ocupado.
      }
    }
  }

  try {
    return await sisfeSyncQueue.add("sync", data, {
      ...syncJobOptions,
      jobId,
    });
  } catch (error) {
    // Carrera: otro claim encoló el mismo jobId entre el getJob y el add.
    const message = error instanceof Error ? error.message : String(error);
    if (/Job with this id already exists|already exists/i.test(message)) {
      throw new SisfeSyncAlreadyRunningError();
    }
    throw error;
  }
}

export async function closeSisfeQueue(): Promise<void> {
  await sisfeSyncQueue.close();
}
