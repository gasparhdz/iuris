import type { FastifyReply, FastifyRequest } from "fastify";
import { PlanesService } from "../services/planes.service.js";
import type { CreateIngresoInput, CreatePlanPagoInput, PlanPagoQuery } from "../schemas/planes.schema.js";

export class PlanesController {
  static async findPlanes(request: FastifyRequest<{ Querystring: PlanPagoQuery }>, reply: FastifyReply) {
    const auth = getAuthContext(request, reply);
    if (!auth) return;

    try {
      const planes = await PlanesService.findPlanes(auth.estudioId, request.query);
      return reply.send({ data: planes });
    } catch (error: unknown) {
      return handleKnownError(error, reply);
    }
  }

  static async createPlan(request: FastifyRequest<{ Body: CreatePlanPagoInput }>, reply: FastifyReply) {
    const auth = getAuthContext(request, reply);
    if (!auth) return;

    try {
      const result = await PlanesService.createPlan(auth.estudioId, auth.userId, request.body);
      return reply.status(201).send({ data: result });
    } catch (error: unknown) {
      return handleKnownError(error, reply);
    }
  }

  static async findCuotasByPlan(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
    const auth = getAuthContext(request, reply);
    if (!auth) return;

    try {
      const cuotas = await PlanesService.findCuotasByPlan(request.params.id, auth.estudioId);
      return reply.send({ data: cuotas });
    } catch (error: unknown) {
      return handleKnownError(error, reply);
    }
  }

  static async findProyeccionCobranzas(request: FastifyRequest, reply: FastifyReply) {
    const auth = getAuthContext(request, reply);
    if (!auth) return;

    try {
      const cuotas = await PlanesService.findProyeccionCobranzas(auth.estudioId);
      return reply.send({ data: cuotas });
    } catch (error: unknown) {
      return handleKnownError(error, reply);
    }
  }

  static async createIngreso(request: FastifyRequest<{ Body: CreateIngresoInput }>, reply: FastifyReply) {
    const auth = getAuthContext(request, reply);
    if (!auth) return;

    try {
      const ingreso = await PlanesService.registrarIngreso(auth.estudioId, auth.userId, request.body);
      return reply.status(201).send({ data: ingreso });
    } catch (error: unknown) {
      return handleKnownError(error, reply);
    }
  }

  static async deletePlan(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
    const auth = getAuthContext(request, reply);
    if (!auth) return;

    try {
      await PlanesService.deletePlan(request.params.id, auth.estudioId, auth.userId);
      return reply.send({ data: { message: "Plan eliminado" } });
    } catch (error: unknown) {
      return handleKnownError(error, reply);
    }
  }
}

function getAuthContext(request: FastifyRequest, reply: FastifyReply): { estudioId: number; userId: number } | null {
  if (!request.user.estudioId) {
    reply.status(401).send({ error: { code: "UNAUTHORIZED", message: "Sesion invalida" } });
    return null;
  }

  return { estudioId: request.user.estudioId, userId: request.authUser.id };
}

function handleKnownError(error: unknown, reply: FastifyReply) {
  if (!(error instanceof Error)) throw error;

  const errors409: Record<string, string> = {
    MONTO_EXCEDE_SALDO_CUOTA: "El monto excede el saldo pendiente de la cuota",
  };
  const msg409 = errors409[error.message];
  if (msg409) return reply.status(409).send({ error: { code: "CONFLICT", message: msg409 } });

  const errors: Record<string, string> = {
    PLAN_NOT_FOUND: "Plan no encontrado",
    CUOTA_NOT_FOUND: "Cuota no encontrada",
    HONORARIO_NOT_FOUND: "Honorario no encontrado",
    CLIENTE_NOT_FOUND: "Cliente no encontrado",
    CASO_NOT_FOUND: "Expediente no encontrado",
    PERIODICIDAD_NOT_FOUND: "Periodicidad no encontrada",
    VALOR_JUS_NOT_FOUND: "No hay valor JUS disponible",
    PARAMETRO_PENDIENTE_NOT_FOUND: "No se encontró el estado pendiente",
    PLAN_DEUDORES_DISTINTOS: "No se pueden mezclar honorarios de distintos deudores en el mismo cobro o plan",
    HONORARIO_SIN_DEUDOR: "El honorario no tiene un deudor válido",
  };

  if (error.message === "PLAN_DEUDORES_DISTINTOS" || error.message === "HONORARIO_SIN_DEUDOR") {
    return reply.status(400).send({ error: { code: "INVALID_INPUT", message: errors[error.message] } });
  }

  const message = errors[error.message];
  if (message) return reply.status(404).send({ error: { code: "NOT_FOUND", message } });

  throw error;
}
