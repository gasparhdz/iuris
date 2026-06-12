import { z } from "zod";
import { idParamSchema, positiveIntSchema } from "./common.schema.js";

const dateStringSchema = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: "Debe ser una fecha valida",
});

export const casoMovimientosParamsSchema = z.object({
  casoId: positiveIntSchema,
}).strict();

export const movimientoParamsSchema = idParamSchema;

export const createMovimientoSchema = z.object({
  fecha: dateStringSchema,
  tipo: z.string().trim().min(1).max(100),
  descripcion: z.string().optional().nullable(),
  foja: z.string().max(50).optional().nullable(),
  vencimiento: dateStringSchema.optional().nullable(),
}).strict();

export const updateMovimientoSchema = createMovimientoSchema.partial();

export const movimientoItemSchema = z.object({
  id: z.number(),
  casoId: z.number(),
  estudioId: z.number(),
  fecha: z.string(),
  tipo: z.string(),
  descripcion: z.string().nullable(),
  foja: z.string().nullable(),
  vencimiento: z.string().nullable(),
  createdAt: z.string(),
  createdBy: z.number().nullable(),
  novedad: z.string().nullable().optional(),
  // Tarea-plazo vinculada (la tarea ES el plazo del movimiento), si existe.
  tareaId: z.number().nullable().optional(),
  tareaVencimiento: z.string().nullable().optional(),
});

export const movimientoResponseSchema = z.object({
  data: movimientoItemSchema,
});

export const movimientosListResponseSchema = z.object({
  data: z.array(movimientoItemSchema),
});

export type CreateMovimientoInput = z.infer<typeof createMovimientoSchema>;
export type UpdateMovimientoInput = z.infer<typeof updateMovimientoSchema>;
