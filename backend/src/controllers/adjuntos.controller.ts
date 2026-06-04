import type { FastifyReply, FastifyRequest } from "fastify";
import { AdjuntosService } from "../services/adjuntos.service.js";
import type { AdjuntosQueryInput, ConfirmAdjuntoInput, PresignAdjuntoInput, UploadAdjuntoInput } from "../schemas/adjuntos.schema.js";

export class AdjuntosController {
  static async findAll(request: FastifyRequest<{ Querystring: AdjuntosQueryInput }>, reply: FastifyReply) {
    const auth = getAuth(request, reply);
    if (!auth) return;
    const adjuntos = await AdjuntosService.findAdjuntos(request.query.scope, request.query.scopeId, auth.estudioId);
    return reply.send({ data: adjuntos });
  }

  static async upload(request: FastifyRequest<{ Querystring: UploadAdjuntoInput }>, reply: FastifyReply) {
    const auth = getAuth(request, reply);
    if (!auth) return;

    try {
      const file = await request.file();
      if (!file) return reply.status(400).send({ error: { code: "INVALID_INPUT", message: "Archivo requerido" } });
      const size = Number(file.fields.size && "value" in file.fields.size ? file.fields.size.value : undefined);
      const adjunto = await AdjuntosService.uploadAdjuntoStream({
        scope: request.query.scope,
        scopeId: request.query.scopeId,
        estudioId: auth.estudioId,
        fileStream: file.file,
        nombre: file.filename,
        mimeType: file.mimetype,
        size: Number.isFinite(size) ? size : undefined,
      });
      return reply.status(201).send({ data: adjunto });
    } catch (error: unknown) {
      return handleError(error, reply);
    }
  }

  static async presign(request: FastifyRequest<{ Body: PresignAdjuntoInput }>, reply: FastifyReply) {
    const auth = getAuth(request, reply);
    if (!auth) return;

    try {
      const presigned = await AdjuntosService.createPresignedUpload({ ...request.body, estudioId: auth.estudioId });
      return reply.send({ data: presigned });
    } catch (error: unknown) {
      return handleError(error, reply);
    }
  }

  static async confirm(request: FastifyRequest<{ Body: ConfirmAdjuntoInput }>, reply: FastifyReply) {
    const auth = getAuth(request, reply);
    if (!auth) return;

    try {
      const adjunto = await AdjuntosService.confirmPresignedUpload({ ...request.body, estudioId: auth.estudioId });
      return reply.status(201).send({ data: adjunto });
    } catch (error: unknown) {
      return handleError(error, reply);
    }
  }

  static async indexar(request: FastifyRequest<{ Querystring: AdjuntosQueryInput }>, reply: FastifyReply) {
    const auth = getAuth(request, reply);
    if (!auth) return;

    try {
      const result = await AdjuntosService.indexarAdjuntos(request.query.scope, request.query.scopeId, auth.estudioId);
      return reply.send({ data: result });
    } catch (error: unknown) {
      return handleError(error, reply);
    }
  }

  static async delete(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
    const auth = getAuth(request, reply);
    if (!auth) return;

    try {
      await AdjuntosService.deleteAdjunto(request.params.id, auth.estudioId);
      return reply.send({ data: { message: "Adjunto eliminado" } });
    } catch (error: unknown) {
      return handleError(error, reply);
    }
  }
}

function getAuth(request: FastifyRequest, reply: FastifyReply): { estudioId: number } | null {
  if (!request.user.estudioId) {
    reply.status(401).send({ error: { code: "UNAUTHORIZED", message: "Sesion invalida" } });
    return null;
  }
  return { estudioId: request.user.estudioId };
}

function handleError(error: unknown, reply: FastifyReply) {
  if (!(error instanceof Error)) throw error;
  const messages: Record<string, string> = {
    ADJUNTO_NOT_FOUND: "Adjunto no encontrado",
    CLIENTE_NOT_FOUND: "Cliente no encontrado",
    CASO_NOT_FOUND: "Expediente no encontrado",
    DRIVE_FOLDER_NOT_FOUND: "Carpeta de Drive no configurada",
    INVALID_FILE_EXTENSION: "Extension de archivo no permitida",
    FILE_TOO_LARGE: "Archivo demasiado grande",
    PRESIGNED_UPLOAD_NOT_SUPPORTED: "El proveedor de almacenamiento actual no soporta subida directa",
    INVALID_STORAGE_KEY: "Clave de almacenamiento invalida",
    FILE_SIZE_MISMATCH: "El tamano real del archivo no coincide",
    MIME_TYPE_MISMATCH: "El tipo de archivo real no coincide",
  };
  const message = messages[error.message];
  if (message) return reply.status(400).send({ error: { code: error.message, message } });
  throw error;
}
