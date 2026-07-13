import { z } from "zod";
import { idParamSchema, paginationMetaSchema, paginationQuerySchema, positiveIntSchema } from "./common.schema.js";
import { startOfDayArgentina } from "../utils/timezone.js";

export const subtareaInputSchema = z.object({
  titulo: z.string().min(2).max(255),
  completada: z.boolean().default(false),
  orden: z.coerce.number().int().min(0).default(0),
}).strict();

export const createSubtareaSchema = z.object({
  titulo: z.string().min(2).max(255),
  orden: z.coerce.number().int().min(0).optional(),
}).strict();

export const updateSubtareaSchema = z.object({
  titulo: z.string().min(2).max(255).optional(),
  orden: z.coerce.number().int().min(0).optional(),
}).strict();

export const tareaBaseSchema = z.object({
  titulo: z.string().min(3).max(255),
  descripcion: z.string().optional().nullable(),
  fechaLimite: z.string().datetime().optional().nullable(),
  prioridadId: positiveIntSchema.max(999999).optional().nullable(),
  asignadoA: positiveIntSchema.max(999999).optional().nullable(),
  clienteId: positiveIntSchema.max(999999).optional().nullable(),
  casoId: positiveIntSchema.max(999999).optional().nullable(),
  // Movimiento judicial al que esta tarea representa el plazo (opcional).
  movimientoId: positiveIntSchema.max(999999).optional().nullable(),
  recordatorio: z.string().datetime().optional().nullable(),
  items: z.array(subtareaInputSchema).optional(),
}).strict();

function recordatorioAntesDeLimite(data: { recordatorio?: string | null; fechaLimite?: string | null }) {
  if (data.recordatorio && data.fechaLimite) {
    return new Date(data.recordatorio) < new Date(data.fechaLimite);
  }
  return true;
}

function fechaLimiteNoPasada(data: { fechaLimite?: string | null }) {
  if (data.fechaLimite) {
    const inicioHoy = startOfDayArgentina(new Date());
    return new Date(data.fechaLimite) >= inicioHoy;
  }
  return true;
}

export const createTareaSchema = tareaBaseSchema
  .refine(recordatorioAntesDeLimite, {
    message: "La fecha del recordatorio debe ser anterior a la fecha límite",
    path: ["recordatorio"],
  })
  .refine(fechaLimiteNoPasada, {
    message: "La fecha límite no puede estar en el pasado",
    path: ["fechaLimite"],
  });
export const updateTareaSchema = tareaBaseSchema.partial().extend({
  completada: z.boolean().optional(),
  completarSubtareas: z.boolean().optional(),
}).refine(recordatorioAntesDeLimite, {
  message: "La fecha del recordatorio debe ser anterior a la fecha límite",
  path: ["recordatorio"],
});

export const tareaQuerySchema = z.object({
  completada: z.enum(["true", "false"]).optional().describe("true o false"),
  asignadoA: positiveIntSchema.optional(),
  search: z.string().optional(),
  prioridadId: positiveIntSchema.optional(),
  ...paginationQuerySchema.shape,
  orderBy: z.enum(["titulo", "prioridad", "vencimiento", "vinculacion"]).default("titulo"),
  order: z.enum(["asc", "desc"]).default("asc"),
}).strict();

export const subtareaParamsSchema = z.object({
  id: idParamSchema.shape.id,
  subtareaId: idParamSchema.shape.id,
}).strict();

export { idParamSchema };

export const subtareaItemSchema = z.object({
  id: z.number(),
  tareaId: z.number(),
  titulo: z.string(),
  descripcion: z.string().nullable(),
  completada: z.boolean(),
  completadaAt: z.string().nullable(),
  orden: z.number(),
  activo: z.boolean(),
  deletedAt: z.string().nullable(),
});

export const tareaItemSchema = z.object({
  id: z.number(),
  estudioId: z.number(),
  titulo: z.string(),
  descripcion: z.string().nullable(),
  fechaLimite: z.string().nullable(),
  prioridadId: z.number().nullable(),
  recordatorio: z.string().nullable(),
  completada: z.boolean(),
  completadaAt: z.string().nullable(),
  asignadoA: z.number().nullable(),
  clienteId: z.number().nullable(),
  casoId: z.number().nullable(),
  movimientoId: z.number().nullable(),
  recordatorioEnviado: z.boolean(),
  activo: z.boolean(),
  createdBy: z.number().nullable(),
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
  updatedBy: z.number().nullable(),
  deletedAt: z.string().nullable(),
  deletedBy: z.number().nullable(),
});

export const tareaDetailSchema = tareaItemSchema.extend({
  items: z.array(subtareaItemSchema),
});

export const tareaResponseSchema = z.object({
  data: tareaItemSchema,
});

export const tareaDetailResponseSchema = z.object({
  data: tareaDetailSchema,
});

export const tareaListResponseSchema = z.object({
  data: z.object({
    items: z.array(tareaItemSchema),
    meta: paginationMetaSchema,
  }),
});

export const subtareaResponseSchema = z.object({
  data: subtareaItemSchema,
});

export const subtareaToggleResponseSchema = z.object({
  data: z.array(subtareaItemSchema),
});

export type CreateTareaInput = z.infer<typeof createTareaSchema>;
export type UpdateTareaInput = z.infer<typeof updateTareaSchema>;
export type TareaQueryInput = z.infer<typeof tareaQuerySchema>;
