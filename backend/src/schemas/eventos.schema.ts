import { z } from "zod";
import { idParamSchema, paginationMetaSchema, paginationQuerySchema, positiveIntSchema } from "./common.schema.js";

export const eventoBaseObjectSchema = z.object({
  casoId: positiveIntSchema.optional().nullable(),
  clienteId: positiveIntSchema.optional().nullable(),
  fechaInicio: z.string().datetime({ message: "Fecha de inicio invalida (ISO 8601)" }),
  fechaFin: z.string().datetime().optional().nullable(),
  allDay: z.boolean().default(false),
  tipoId: positiveIntSchema,
  estadoId: positiveIntSchema.optional().nullable(),
  descripcion: z.string().max(255).min(3, "La descripcion es requerida"),
  observaciones: z.string().optional().nullable(),
  ubicacion: z.string().max(255).optional().nullable(),
  recordatorio: z.string().datetime().optional().nullable(),
}).strict();

function fechaFinPosterior<T extends { fechaInicio?: string; fechaFin?: string | null }>(data: T) {
  if (data.fechaInicio && data.fechaFin) {
    return new Date(data.fechaFin) > new Date(data.fechaInicio);
  }
  return true;
}

function recordatorioAntesDeInicio<T extends { fechaInicio?: string; recordatorio?: string | null }>(data: T) {
  if (data.fechaInicio && data.recordatorio) {
    return new Date(data.recordatorio) <= new Date(data.fechaInicio);
  }
  return true;
}

function withEventoRefinements<T extends { fechaInicio?: string; fechaFin?: string | null; recordatorio?: string | null }>(schema: z.ZodType<T>) {
  return schema
    .refine(fechaFinPosterior, {
      message: "La fecha de fin debe ser posterior a la fecha de inicio",
      path: ["fechaFin"],
    })
    .refine(recordatorioAntesDeInicio, {
      message: "El recordatorio debe ser anterior o igual a la fecha de inicio",
      path: ["recordatorio"],
    });
}

export const eventoBaseSchema = eventoBaseObjectSchema;
export const createEventoSchema = withEventoRefinements(eventoBaseObjectSchema);
export const updateEventoSchema = withEventoRefinements(eventoBaseObjectSchema.partial());

export const eventoQuerySchema = z.object({
  from: z.string().datetime().optional().describe("Fecha desde (ISO 8601)"),
  to: z.string().datetime().optional().describe("Fecha hasta (ISO 8601)"),
  ...paginationQuerySchema.shape,
}).strict();

export { idParamSchema };

export const eventoItemSchema = z.object({
  id: z.number(),
  estudioId: z.number(),
  casoId: z.number().nullable(),
  clienteId: z.number().nullable(),
  fechaInicio: z.string(),
  fechaFin: z.string().nullable(),
  allDay: z.boolean(),
  tipoId: z.number(),
  estadoId: z.number().nullable(),
  descripcion: z.string().nullable(),
  observaciones: z.string().nullable(),
  recordatorio: z.string().nullable(),
  recordatorioEnviado: z.boolean(),
  ubicacion: z.string().nullable(),
  activo: z.boolean(),
  createdBy: z.number().nullable(),
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
  updatedBy: z.number().nullable(),
  deletedAt: z.string().nullable(),
  deletedBy: z.number().nullable(),
});

export const eventoResponseSchema = z.object({
  data: eventoItemSchema,
});

export const eventoListResponseSchema = z.object({
  data: z.object({
    items: z.array(eventoItemSchema),
    meta: paginationMetaSchema,
  }),
});

export type CreateEventoInput = z.infer<typeof createEventoSchema>;
export type UpdateEventoInput = z.infer<typeof updateEventoSchema>;
