import type { FastifyPluginAsync } from "fastify";
import { SearchController } from "../controllers/search.controller.js";

export const searchRoutes: FastifyPluginAsync = async (fastify) => {
  const authConfig = { preHandler: [fastify.authenticate] };

  fastify.get<{ Querystring: { q?: string } }>("/", authConfig, SearchController.query);
};
