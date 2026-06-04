import { z } from "zod";
import { idParamSchema, positiveIntSchema } from "./common.schema.js";

export const clienteNotasParamsSchema = z.object({
  clienteId: positiveIntSchema,
}).strict();

export const casoNotasParamsSchema = z.object({
  casoId: positiveIntSchema,
}).strict();

export const notaParamsSchema = idParamSchema;

export const createNotaSchema = z.object({
  contenido: z.string().trim().min(1),
}).strict();

export const notaItemSchema = z.object({
  id: z.number(),
  clienteId: z.number().optional(),
  casoId: z.number().optional(),
  estudioId: z.number(),
  contenido: z.string(),
  createdAt: z.string(),
  createdBy: z.number().nullable().optional(),
});

export const notaResponseSchema = z.object({
  data: notaItemSchema,
});

export const notasListResponseSchema = z.object({
  data: z.array(notaItemSchema),
});

export type CreateNotaInput = z.infer<typeof createNotaSchema>;
