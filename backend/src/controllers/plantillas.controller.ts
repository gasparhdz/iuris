import type { FastifyReply, FastifyRequest } from "fastify";
import { DocumentosService } from "../services/documentos.service.js";
import { PlantillasService } from "../services/plantillas.service.js";
import type { CreatePlantillaInput, GenerarDocumentoInput, UpdatePlantillaInput } from "../schemas/plantillas.schema.js";

export class PlantillasController {
  static async findAll(request: FastifyRequest, reply: FastifyReply) {
    const estudioId = getEstudioId(request, reply);
    if (!estudioId) return;
    return reply.send({ data: await PlantillasService.findAll(estudioId) });
  }

  static async create(request: FastifyRequest<{ Body: CreatePlantillaInput }>, reply: FastifyReply) {
    const estudioId = getEstudioId(request, reply);
    if (!estudioId) return;
    return reply.status(201).send({ data: await PlantillasService.create(estudioId, request.body) });
  }

  static async update(request: FastifyRequest<{ Params: { id: number }; Body: UpdatePlantillaInput }>, reply: FastifyReply) {
    const estudioId = getEstudioId(request, reply);
    if (!estudioId) return;
    try {
      return reply.send({ data: await PlantillasService.update(request.params.id, estudioId, request.body) });
    } catch (error: unknown) {
      return handlePlantillaError(error, reply);
    }
  }

  static async delete(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
    const estudioId = getEstudioId(request, reply);
    if (!estudioId) return;
    try {
      await PlantillasService.delete(request.params.id, estudioId);
      return reply.send({ data: { message: "Plantilla eliminada" } });
    } catch (error: unknown) {
      return handlePlantillaError(error, reply);
    }
  }

  static async generarDocumento(request: FastifyRequest<{ Params: { casoId: number }; Body: GenerarDocumentoInput }>, reply: FastifyReply) {
    const estudioId = getEstudioId(request, reply);
    if (!estudioId) return;
    try {
      const result = await DocumentosService.generarYGuardar(request.body.plantillaId, request.params.casoId, estudioId, request.body.guardarEnDrive);
      return reply.send({ data: result });
    } catch (error: unknown) {
      return handlePlantillaError(error, reply);
    }
  }
}

function getEstudioId(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user.estudioId) {
    reply.status(401).send({ error: { code: "UNAUTHORIZED", message: "Sesion invalida" } });
    return null;
  }
  return request.user.estudioId;
}

function handlePlantillaError(error: unknown, reply: FastifyReply) {
  if (!(error instanceof Error)) throw error;
  const messages: Record<string, string> = {
    PLANTILLA_NOT_FOUND: "Plantilla no encontrada",
    CASO_NOT_FOUND: "Expediente no encontrado",
    DRIVE_FOLDER_NOT_FOUND: "Carpeta de Drive no configurada",
  };
  const message = messages[error.message];
  if (message) return reply.status(404).send({ error: { code: "NOT_FOUND", message } });
  throw error;
}
