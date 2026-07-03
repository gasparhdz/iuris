import { z } from "zod";
import { idParamSchema, paginationMetaSchema, paginationQuerySchema, positiveIntSchema } from "./common.schema.js";
import { tareaItemSchema } from "./tareas.schema.js";
import { eventoItemSchema } from "./eventos.schema.js";

export const casoBaseSchema = z.object({
  clienteId: positiveIntSchema,
  caratula: z.string().min(3).max(500),
  nroExpte: z.string().max(100).optional().nullable(),
  tipoId: positiveIntSchema,
  estadoId: positiveIntSchema.optional().nullable(),
  radicacionId: positiveIntSchema.optional().nullable(),
  estadoRadicacionId: positiveIntSchema.optional().nullable(),
  responsableId: positiveIntSchema.optional().nullable(),
  descripcion: z.string().optional().nullable(),
  driveFolderId: z.string().max(255).optional().nullable(),
}).strict();

export const createCasoSchema = casoBaseSchema;
export const updateCasoSchema = casoBaseSchema.partial();

export const addParticipanteSchema = z.object({
  terceroId: positiveIntSchema,
  rolId: positiveIntSchema,
  observaciones: z.string().optional().nullable(),
}).strict();

export const casoQuerySchema = z.object({
  ...paginationQuerySchema.shape,
  search: z.string().optional(),
  estadoId: positiveIntSchema.optional(),
  ramaId: positiveIntSchema.optional(),
  radicacionParentId: positiveIntSchema.optional(),
  orderBy: z.enum(["caratula", "cliente", "nroExpte", "tipo", "juzgado", "estado"]).default("caratula"),
  order: z.enum(["asc", "desc"]).default("asc"),
}).strict();

export const participanteParamsSchema = z.object({
  id: idParamSchema.shape.id,
  participanteId: idParamSchema.shape.id,
}).strict();

export { idParamSchema };

export const casoItemSchema = z.object({
  id: z.number(),
  estudioId: z.number(),
  clienteId: z.number(),
  nroExpte: z.string().nullable(),
  nroExpteNorm: z.string().nullable(),
  caratula: z.string().nullable(),
  tipoId: z.number(),
  descripcion: z.string().nullable(),
  estadoId: z.number().nullable(),
  fechaEstado: z.string(),
  radicacionId: z.number().nullable(),
  estadoRadicacionId: z.number().nullable(),
  fechaEstadoRadicacion: z.string().nullable(),
  responsableId: z.number().nullable().optional(),
  responsableNombre: z.string().nullable().optional(),
  driveFolderId: z.string().nullable(),
  numeroDrive: z.number().nullable(),
  activo: z.boolean(),
  createdAt: z.string(),
  createdBy: z.number().nullable(),
  updatedAt: z.string().nullable(),
  updatedBy: z.number().nullable(),
  deletedAt: z.string().nullable(),
  deletedBy: z.number().nullable(),
  sisfeExpteId: z.string().nullable().optional(),
  sisfeLastSyncAt: z.string().nullable().optional(),
  sisfeSyncedBy: z.number().nullable().optional(),
  sisfeRadicadoEn: z.string().nullable().optional(),
  sisfeLocalidad: z.string().nullable().optional(),
  sisfeFechaIngresoMeu: z.string().nullable().optional(),
  sisfeUbicacionActual: z.string().nullable().optional(),
  sisfeFechaUbicacionActual: z.string().nullable().optional(),
  sisfeSoloDigital: z.boolean().nullable().optional(),
  sisfeFechaUltimaActualizacion: z.string().nullable().optional(),
});

export const casoResponseSchema = z.object({
  data: casoItemSchema,
});

export const casoListResponseSchema = z.object({
  data: z.object({
    items: z.array(casoItemSchema),
    meta: paginationMetaSchema,
  }),
});

export const participanteItemSchema = z.object({
  id: z.number(),
  casoId: z.number(),
  terceroId: z.number(),
  rolId: z.number().nullable(),
  rolCodigo: z.string().nullable().optional(),
  rolNombre: z.string().nullable().optional(),
  observaciones: z.string().nullable(),
  tercero: z.object({
    id: z.number(),
    nombre: z.string().nullable(),
    apellido: z.string().nullable(),
    razonSocial: z.string().nullable(),
    dni: z.string().nullable(),
    cuit: z.string().nullable(),
    email: z.string().nullable(),
    telefono: z.string().nullable(),
  }).optional(),
});

export const participanteResponseSchema = z.object({
  data: participanteItemSchema,
});

export const participanteListResponseSchema = z.object({
  data: z.array(participanteItemSchema),
});

export const casoTareasListResponseSchema = z.object({
  data: z.array(tareaItemSchema),
});

export const casoEventosListResponseSchema = z.object({
  data: z.array(eventoItemSchema),
});

export type CreateCasoInput = z.infer<typeof createCasoSchema>;
export type UpdateCasoInput = z.infer<typeof updateCasoSchema>;
export type AddParticipanteInput = z.infer<typeof addParticipanteSchema>;
export type CasoQueryInput = z.infer<typeof casoQuerySchema>;
