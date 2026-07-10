import { Readable } from "node:stream";
import { AdjuntosQueries } from "../db/queries/adjuntos.queries.js";
import { DocumentosQueries } from "../db/queries/documentos.queries.js";
import { PlantillasQueries } from "../db/queries/plantillas.queries.js";
import { getStorage } from "../storage/factory.js";
import { serializeDates } from "../utils/serialize.js";

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export class DocumentosService {
  static async generarDocumento(plantillaId: number, casoId: number, estudioId: number): Promise<{ htmlGenerado: string; titulo: string; driveFolderId: string | null }> {
    const plantilla = await PlantillasQueries.findPlantillaById(plantillaId, estudioId);
    if (!plantilla) throw new Error("PLANTILLA_NOT_FOUND");

    const context = await DocumentosQueries.findCasoContext(casoId, estudioId);
    if (!context) throw new Error("CASO_NOT_FOUND");

    const replacements: Record<string, string> = {
      estudio_nombre: escapeHtml(context.estudio.nombre),
      cliente_nombre: escapeHtml(formatClienteNombre(context.cliente)),
      cliente_dni_cuit: escapeHtml(context.cliente.dni ?? context.cliente.cuit ?? ""),
      caso_caratula: escapeHtml(context.caso.caratula ?? ""),
      caso_nro_expte: escapeHtml(context.caso.nroExpte ?? ""),
      caso_juzgado: escapeHtml(context.juzgado?.nombre ?? ""),
      fecha_hoy: escapeHtml(formatFecha(new Date())),
    };

    const htmlGenerado = plantilla.contenidoHtml.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_match, key: string) => replacements[key] ?? "");
    return { htmlGenerado, titulo: plantilla.titulo, driveFolderId: context.caso.driveFolderId };
  }

  static async generarYGuardar(plantillaId: number, casoId: number, estudioId: number, guardarEnDrive: boolean) {
    const generated = await this.generarDocumento(plantillaId, casoId, estudioId);
    if (!guardarEnDrive) return { htmlGenerado: generated.htmlGenerado, adjunto: null };
    if (!generated.driveFolderId) throw new Error("DRIVE_FOLDER_NOT_FOUND");

    const fileName = `${generated.titulo} - ${new Date().toISOString().slice(0, 10)}.html`;
    const buffer = Buffer.from(generated.htmlGenerado, "utf8");
    const storage = getStorage(estudioId);
    const uploaded = await storage.uploadStream({
      body: Readable.from(buffer),
      name: fileName,
      mimeType: "text/html",
      folderKey: generated.driveFolderId,
      size: buffer.length,
    });
    const adjunto = await AdjuntosQueries.insertAdjunto({
      scope: "CASO",
      scopeId: casoId,
      nombre: uploaded.name,
      mime: uploaded.mimeType,
      driveFileId: uploaded.key,
      driveFolderId: generated.driveFolderId,
    }, estudioId);

    return { htmlGenerado: generated.htmlGenerado, adjunto: serializeDates(adjunto) };
  }
}

function formatClienteNombre(cliente: { nombre: string | null; apellido: string | null; razonSocial: string | null }) {
  return cliente.razonSocial ?? [cliente.nombre, cliente.apellido].filter(Boolean).join(" ");
}

function formatFecha(date: Date) {
  return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long", year: "numeric" }).format(date);
}
