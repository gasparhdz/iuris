import { z } from "zod";
import { idParamSchema, paginationMetaSchema, paginationQuerySchema, positiveIntSchema } from "./common.schema.js";

const positiveMoneySchema = z.coerce.number().positive();
const dateStringSchema = z.string().datetime();

const honorarioBaseSchema = z.object({
  clienteId: positiveIntSchema.optional().nullable(),
  casoId: positiveIntSchema.optional().nullable(),
  conceptoId: positiveIntSchema,
  parteId: positiveIntSchema,
  jus: positiveMoneySchema.optional().nullable(),
  montoPesos: positiveMoneySchema.optional().nullable(),
  monedaId: positiveIntSchema.optional().nullable(),
  valorJusRef: positiveMoneySchema.optional().nullable(),
  politicaJusId: positiveIntSchema.optional().nullable(),
  fechaRegulacion: dateStringSchema,
  fechaVencimiento: dateStringSchema.optional().nullable(),
  tasaInteresMensual: z.coerce.number().positive().max(100).optional().nullable(),
  estadoId: positiveIntSchema.optional().nullable(),
}).strict();

export const createHonorarioSchema = honorarioBaseSchema.refine(
  (data) => (data.jus !== undefined && data.jus !== null) || (data.montoPesos !== undefined && data.montoPesos !== null),
  {
    message: "Debe informar al menos jus o montoPesos.",
    path: ["jus"],
  }
);

export const updateHonorarioSchema = honorarioBaseSchema.partial().refine(
  (data) => {
    if (data.jus === undefined && data.montoPesos === undefined) return true;
    return (data.jus !== undefined && data.jus !== null) || (data.montoPesos !== undefined && data.montoPesos !== null);
  },
  {
    message: "Debe informar jus o montoPesos con valor mayor a 0.",
    path: ["jus"],
  }
);

export const honorarioQuerySchema = z.object({
  ...paginationQuerySchema.shape,
  clienteId: positiveIntSchema.optional(),
  casoId: positiveIntSchema.optional(),
  estadoId: positiveIntSchema.optional(),
  search: z.string().optional(),
  from: dateStringSchema.optional(),
  to: dateStringSchema.optional(),
}).strict();

const honorarioRelationSchema = z.object({
  id: z.number(),
  codigo: z.string().nullable().optional(),
  nombre: z.string().nullable().optional(),
  apellido: z.string().nullable().optional(),
  razonSocial: z.string().nullable().optional(),
  nroExpte: z.string().nullable().optional(),
  caratula: z.string().nullable().optional(),
}).nullable();

export const honorarioItemSchema = z.object({
  id: z.number(),
  estudioId: z.number(),
  clienteId: z.number().nullable(),
  casoId: z.number().nullable(),
  conceptoId: z.number(),
  parteId: z.number(),
  jus: z.number().nullable(),
  montoPesos: z.number().nullable(),
  monedaId: z.number().nullable(),
  valorJusRef: z.number().nullable(),
  politicaJusId: z.number().nullable(),
  fechaRegulacion: z.string(),
  fechaVencimiento: z.string().nullable(),
  tasaInteresMensual: z.number().nullable(),
  estadoId: z.number().nullable(),
  montoCobrado: z.number().optional(),
  tienePlan: z.boolean().optional(),
  activo: z.boolean(),
  createdBy: z.number().nullable(),
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
  updatedBy: z.number().nullable(),
  deletedAt: z.string().nullable(),
  deletedBy: z.number().nullable(),
  cliente: honorarioRelationSchema,
  caso: honorarioRelationSchema,
  concepto: honorarioRelationSchema,
  parte: honorarioRelationSchema,
  estado: honorarioRelationSchema,
  moneda: honorarioRelationSchema,
  calc: z.object({
    totalJus: z.number().nullable(),
    totalPesosRef: z.number().nullable(),
    valorJusRef: z.number().nullable(),
    diasMora: z.number(),
    interesAcumulado: z.number().nullable(),
    totalConInteres: z.number().nullable(),
  }),
});

export const honorarioResponseSchema = z.object({
  data: honorarioItemSchema,
});

export const honorarioListResponseSchema = z.object({
  data: z.object({
    items: z.array(honorarioItemSchema),
    meta: paginationMetaSchema,
  }),
});

export { idParamSchema };

export type CreateHonorarioInput = z.infer<typeof createHonorarioSchema>;
export type UpdateHonorarioInput = z.infer<typeof updateHonorarioSchema>;
export type HonorarioQueryInput = z.infer<typeof honorarioQuerySchema>;
