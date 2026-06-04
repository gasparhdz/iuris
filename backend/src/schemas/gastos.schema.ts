import { z } from "zod";
import { idParamSchema, paginationMetaSchema, paginationQuerySchema, positiveIntSchema } from "./common.schema.js";

const dateStringSchema = z.string().datetime();
const positiveAmountSchema = z.coerce.number().positive();

export const createGastoSchema = z.object({
  clienteId: positiveIntSchema,
  casoId: positiveIntSchema.optional().nullable(),
  conceptoId: positiveIntSchema.optional().nullable(),
  descripcion: z.string().optional().nullable(),
  fechaGasto: dateStringSchema,
  monto: positiveAmountSchema,
  monedaId: positiveIntSchema.optional().nullable(),
  cotizacionArs: positiveAmountSchema.optional().nullable(),
  estadoId: positiveIntSchema.optional().nullable(),
}).strict();

export const updateGastoSchema = createGastoSchema.partial();

export const gastoQuerySchema = z.object({
  ...paginationQuerySchema.shape,
  clienteId: positiveIntSchema.optional(),
  casoId: positiveIntSchema.optional(),
  from: dateStringSchema.optional(),
  to: dateStringSchema.optional(),
}).strict();

export const gastoItemSchema = z.object({
  id: z.number(),
  estudioId: z.number(),
  clienteId: z.number(),
  casoId: z.number().nullable(),
  conceptoId: z.number().nullable(),
  descripcion: z.string().nullable(),
  fechaGasto: z.string(),
  monto: z.number(),
  monedaId: z.number().nullable(),
  cotizacionArs: z.number().nullable(),
  estadoId: z.number().nullable(),
  activo: z.boolean(),
  createdAt: z.string(),
  createdBy: z.number().nullable(),
  updatedAt: z.string().nullable(),
  updatedBy: z.number().nullable(),
  deletedAt: z.string().nullable(),
  deletedBy: z.number().nullable(),
});

export const gastoResponseSchema = z.object({
  data: gastoItemSchema,
});

export const gastoListResponseSchema = z.object({
  data: z.object({
    items: z.array(gastoItemSchema),
    meta: paginationMetaSchema,
  }),
});

export { idParamSchema };

export type CreateGastoInput = z.infer<typeof createGastoSchema>;
export type UpdateGastoInput = z.infer<typeof updateGastoSchema>;
export type GastoQueryInput = z.infer<typeof gastoQuerySchema>;
