import type { FastifyReply, FastifyRequest } from "fastify";
import { DriveService } from "../services/drive.service.js";
import type { VincularCarpetaInput } from "../schemas/drive.schema.js";

export class DriveController {
  static async crearCarpetaCliente(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
    return await handleDrive(reply, async () => DriveService.crearCarpetaCliente(request.params.id, getEstudioId(request, reply)));
  }

  static async crearCarpetaCaso(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
    return await handleDrive(reply, async () => DriveService.crearCarpetaCaso(request.params.id, getEstudioId(request, reply)));
  }

  static async vincularCarpetaCliente(request: FastifyRequest<{ Params: { id: number }; Body: VincularCarpetaInput }>, reply: FastifyReply) {
    return await handleDrive(reply, async () => DriveService.vincularCarpetaCliente(request.params.id, getEstudioId(request, reply), request.body.driveFolderId));
  }

  static async vincularCarpetaCaso(request: FastifyRequest<{ Params: { id: number }; Body: VincularCarpetaInput }>, reply: FastifyReply) {
    return await handleDrive(reply, async () => DriveService.vincularCarpetaCaso(request.params.id, getEstudioId(request, reply), request.body.driveFolderId));
  }
}

function getEstudioId(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user.estudioId) {
    reply.status(401).send({ error: { code: "UNAUTHORIZED", message: "Sesion invalida" } });
    throw new Error("UNAUTHORIZED");
  }
  return request.user.estudioId;
}

async function handleDrive(reply: FastifyReply, fn: () => Promise<{ id: number; driveFolderId: string | null }>) {
  try {
    const data = await fn();
    return reply.send({ data: { id: data.id, driveFolderId: data.driveFolderId } });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return;
    if (error instanceof Error) {
      return reply.status(400).send({ error: { code: error.message, message: error.message } });
    }
    throw error;
  }
}
