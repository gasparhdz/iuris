import { z } from "zod";
import { idParamSchema, paginationMetaSchema, paginationQuerySchema, positiveIntSchema } from "./common.schema.js";

const dateStringSchema = z.string().datetime();

export const createValorJusSchema = z.object({
  valor: z.coerce.number().positive(),
  fecha: dateStringSchema,
}).strict();

export const updateValorJusSchema = createValorJusSchema.partial().extend({
  activo: z.boolean().optional(),
});

export const valorJusQuerySchema = z.object({
  ...paginationQuerySchema.shape,
  // El histórico de Valor JUS son datos de referencia que la UI carga en bloque
  // (gráficos y cálculos de honorarios). Permitimos un tope mayor al genérico de 100
  // para no truncar valores históricos.
  limit: positiveIntSchema.max(1000).default(20),
  from: dateStringSchema.optional(),
  to: dateStringSchema.optional(),
}).strict();

export const valorJusItemSchema = z.object({
  id: z.number(),
  estudioId: z.number(),
  valor: z.number(),
  fecha: z.string(),
  activo: z.boolean(),
  createdAt: z.string(),
  createdBy: z.number().nullable(),
  deletedAt: z.string().nullable(),
});

export const valorJusResponseSchema = z.object({
  data: valorJusItemSchema,
});

export const valorJusNullableResponseSchema = z.object({
  data: valorJusItemSchema.nullable(),
});

export const valorJusListResponseSchema = z.object({
  data: z.object({
    items: z.array(valorJusItemSchema),
    meta: paginationMetaSchema,
  }),
});

export const valorJusSyncResponseSchema = z.object({
  data: z.object({
    message: z.string(),
    insertedCount: z.number(),
    maxFechaActual: z.string().nullable(),
    parsedCount: z.number(),
    items: z.array(valorJusItemSchema),
  }),
});

export const valorJusActualQuerySchema = z.object({
  fecha: z.string().optional(),
}).strict();

export { idParamSchema };

export type CreateValorJusInput = z.infer<typeof createValorJusSchema>;
export type UpdateValorJusInput = z.infer<typeof updateValorJusSchema>;
export type ValorJusQueryInput = z.infer<typeof valorJusQuerySchema>;
export type ValorJusActualQueryInput = z.infer<typeof valorJusActualQuerySchema>;
