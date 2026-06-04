import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { CatalogosController } from "../controllers/catalogos.controller.js";
import {
  catalogoResponses,
  localidadQuerySchema,
  parametroQuerySchema,
} from "../schemas/catalogos.schema.js";

export const catalogosRoutes: FastifyPluginAsync = async (fastify) => {
  const server = fastify.withTypeProvider<ZodTypeProvider>();
  const authConfig = { preHandler: [fastify.authenticate] };

  server.get("/provincias", {
    ...authConfig,
    schema: {
      tags: ["Catálogos"],
      summary: "Listar provincias",
      security: [{ bearerAuth: [] }],
      response: catalogoResponses.provincias,
    },
  }, CatalogosController.provincias);

  server.get("/localidades", {
    ...authConfig,
    schema: {
      tags: ["Catálogos"],
      summary: "Listar localidades",
      security: [{ bearerAuth: [] }],
      querystring: localidadQuerySchema,
      response: catalogoResponses.localidades,
    },
  }, CatalogosController.localidades);

  server.get("/parametros", {
    ...authConfig,
    schema: {
      tags: ["Catálogos"],
      summary: "Listar parámetros por categoría",
      security: [{ bearerAuth: [] }],
      querystring: parametroQuerySchema,
      response: catalogoResponses.parametros,
    },
  }, CatalogosController.parametros);
};
