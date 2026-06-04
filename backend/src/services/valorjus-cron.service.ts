import cron from "node-cron";
import type { FastifyBaseLogger } from "fastify";
import { ValorJusScraperService } from "./valorjus-scraper.service.js";

let cronStarted = false;
let isProcessing = false;

export function iniciarCronValorJus(logger: FastifyBaseLogger) {
  if (cronStarted) return;
  cronStarted = true;

  cron.schedule("0 8-18 * * *", async () => {
    if (isProcessing) {
      logger.warn("Cron Valor JUS omitido: el ciclo anterior sigue en ejecucion");
      return;
    }

    isProcessing = true;
    try {
      const result = await ValorJusScraperService.sync();
      logger.info(
        {
          insertedCount: result.insertedCount,
          parsedCount: result.parsedCount,
          maxFechaActual: result.maxFechaActual,
        },
        "Cron Valor JUS ejecutado correctamente",
      );
    } catch (error) {
      logger.error({ err: error }, "Error en cron Valor JUS");
    } finally {
      isProcessing = false;
    }
  });

  logger.info("Cron Valor JUS iniciado");
}
