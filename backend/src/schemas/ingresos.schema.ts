import { z } from "zod";
import { idParamSchema, paginationMetaSchema, paginationQuerySchema, positiveIntSchema } from "./common.schema.js";
import { createIngresoSchema, ingresoItemSchema, ingresoResponseSchema } from "./planes.schema.js";

const dateStringSchema = z.string().datetime();
const positiveAmountSchema = z.coerce.number().positive();

export const updateIngresoSchema = z.object({
  clienteId: positiveIntSchema.optional().nullable(),
  casoId: positiveIntSchema.optional().nullable(),
  cuotaId: positiveIntSchema.optional().nullable(),
  descripcion: z.string().optional().nullable(),
  monto: positiveAmountSchema.optional(),
  monedaId: positiveIntSchema.optional().nullable(),
  cotizacionArs: positiveAmountSchema.optional().nullable(),
  fechaIngreso: dateStringSchema.optional(),
  tipoId: positiveIntSchema.optional().nullable(),
  estadoId: positiveIntSchema.optional().nullable(),
  activo: z.boolean().optional(),
}).strict();

export const ingresoQuerySchema = z.object({
  ...paginationQuerySchema.shape,
  clienteId: positiveIntSchema.optional(),
  casoId: positiveIntSchema.optional(),
  cuotaId: positiveIntSchema.optional(),
  from: dateStringSchema.optional(),
  to: dateStringSchema.optional(),
}).strict();

export const ingresoListResponseSchema = z.object({
  data: z.object({
    items: z.array(ingresoItemSchema),
    meta: paginationMetaSchema,
  }),
});

export { createIngresoSchema, idParamSchema, ingresoItemSchema, ingresoResponseSchema };

export type UpdateIngresoInput = z.infer<typeof updateIngresoSchema>;
export type IngresoQueryInput = z.infer<typeof ingresoQuerySchema>;
