import { z } from "zod";
import { idParamSchema, paginationMetaSchema, paginationQuerySchema, positiveIntSchema } from "./common.schema.js";

export const terceroBaseSchema = z.object({
  tipoPersonaId: positiveIntSchema,
  nombre: z.string().max(100).optional().nullable(),
  apellido: z.string().max(100).optional().nullable(),
  razonSocial: z.string().max(255).optional().nullable(),
  dni: z.string().max(50).optional().nullable(),
  cuit: z.string().max(50).optional().nullable(),
  fechaNacimiento: z.string().optional().nullable(),
  email: z.string().email("Email invalido").max(255).optional().nullable(),
  telefono: z.string().max(50).optional().nullable(),
  dirCalle: z.string().max(255).optional().nullable(),
  dirNro: z.string().max(50).optional().nullable(),
  dirPiso: z.string().max(50).optional().nullable(),
  dirDepto: z.string().max(50).optional().nullable(),
  codigoPostal: z.string().max(20).optional().nullable(),
  provinciaId: positiveIntSchema.optional().nullable(),
  localidadId: positiveIntSchema.optional().nullable(),
  observaciones: z.string().optional().nullable(),
  activo: z.boolean().default(true),
}).strict();

export const createTerceroSchema = terceroBaseSchema;
export const updateTerceroSchema = terceroBaseSchema.partial();

const terceroItemSchema = terceroBaseSchema.extend({
  id: z.number(),
  estudioId: z.number(),
  createdAt: z.string(),
  createdBy: z.number().nullable(),
  updatedAt: z.string().nullable(),
  updatedBy: z.number().nullable(),
  deletedAt: z.string().nullable(),
  deletedBy: z.number().nullable(),
});

export const terceroResponseSchema = z.object({
  data: terceroItemSchema,
});

export const terceroListResponseSchema = z.object({
  data: z.object({
    items: z.array(terceroItemSchema),
    meta: paginationMetaSchema,
  }),
});

export const terceroQuerySchema = z.object({
  ...paginationQuerySchema.shape,
  search: z.string().optional(),
}).strict();

export { idParamSchema };

export type CreateTerceroInput = z.infer<typeof createTerceroSchema>;
export type UpdateTerceroInput = z.infer<typeof updateTerceroSchema>;
