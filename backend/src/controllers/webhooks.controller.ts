import type { FastifyReply, FastifyRequest } from "fastify";
import { StorageWatchService } from "../services/storage-watch.service.js";

export class WebhooksController {
  static async drive(request: FastifyRequest, reply: FastifyReply) {
    reply.status(200).send({ data: { ok: true } });
    try {
      await StorageWatchService.handleDriveWebhook(request.headers);
    } catch {
      // El webhook responde 200 inmediatamente; los errores se registran en el worker/service.
    }
  }
}
