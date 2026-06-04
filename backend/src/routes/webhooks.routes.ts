import type { FastifyPluginAsync } from "fastify";
import { WebhooksController } from "../controllers/webhooks.controller.js";

export const webhooksRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/drive", WebhooksController.drive);
};
