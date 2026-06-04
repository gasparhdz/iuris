import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { PlanesController } from "../controllers/planes.controller.js";
import { documentedResponses, successMessageResponseSchema } from "../schemas/common.schema.js";
import {
  createIngresoSchema,
  createPlanPagoSchema,
  ingresoResponseSchema,
  planCuotasParamsSchema,
  planCuotasResponseSchema,
  planPagoQuerySchema,
  planPagoResponseSchema,
  planesPagoResponseSchema,
  proyeccionCobranzasResponseSchema,
} from "../schemas/planes.schema.js";

export const planesRoutes: FastifyPluginAsync = async (fastify) => {
  const server = fastify.withTypeProvider<ZodTypeProvider>();
  const authConfig = { preHandler: [fastify.authenticate] };

  server.get("/planes", {
    ...authConfig,
    schema: {
      tags: ["Planes de Pago"],
      summary: "Listar planes de pago",
      security: [{ bearerAuth: [] }],
      querystring: planPagoQuerySchema,
      response: documentedResponses(200, planesPagoResponseSchema),
    },
  }, PlanesController.findPlanes);

  server.post("/planes", {
    ...authConfig,
    schema: {
      tags: ["Planes de Pago"],
      summary: "Crear un plan de pagos y generar cuotas",
      security: [{ bearerAuth: [] }],
      body: createPlanPagoSchema,
      response: documentedResponses(201, planPagoResponseSchema),
    },
  }, PlanesController.createPlan);

  server.get("/planes/cuotas/proyeccion", {
    ...authConfig,
    schema: {
      tags: ["Planes de Pago"],
      summary: "Proyección de cobranzas: cuotas pendientes del estudio",
      security: [{ bearerAuth: [] }],
      response: documentedResponses(200, proyeccionCobranzasResponseSchema),
    },
  }, PlanesController.findProyeccionCobranzas);

  server.get("/planes/:id/cuotas", {
    ...authConfig,
    schema: {
      tags: ["Planes de Pago"],
      summary: "Listar cuotas de un plan",
      security: [{ bearerAuth: [] }],
      params: planCuotasParamsSchema,
      response: documentedResponses(200, planCuotasResponseSchema),
    },
  }, PlanesController.findCuotasByPlan);

  server.post("/ingresos", {
    ...authConfig,
    schema: {
      tags: ["Ingresos"],
      summary: "Registrar ingreso e imputar cuota opcional",
      security: [{ bearerAuth: [] }],
      body: createIngresoSchema,
      response: documentedResponses(201, ingresoResponseSchema),
    },
  }, PlanesController.createIngreso);

  server.delete("/planes/:id", {
    ...authConfig,
    schema: {
      tags: ["Planes de Pago"],
      summary: "Eliminar logicamente un plan y sus cuotas",
      security: [{ bearerAuth: [] }],
      params: planCuotasParamsSchema,
      response: documentedResponses(200, successMessageResponseSchema),
    },
  }, PlanesController.deletePlan);
};
