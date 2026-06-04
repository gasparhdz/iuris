import { z } from "zod";
import { documentedResponses, positiveIntSchema } from "./common.schema.js";

export const localidadQuerySchema = z.object({
  provinciaId: positiveIntSchema.optional(),
}).strict();

export const parametroQuerySchema = z.object({
  categoria: z.string().min(1).max(50).optional(),
}).strict();

export const provinciaSchema = z.object({
  id: z.number(),
  nombre: z.string(),
  paisId: z.number(),
});

export const localidadSchema = z.object({
  id: z.number(),
  nombre: z.string(),
  provinciaId: z.number(),
  codigoPostal: z.string().nullable(),
});

export const parametroSchema = z.object({
  id: z.number(),
  codigo: z.string(),
  nombre: z.string(),
  orden: z.number(),
  parentId: z.number().nullable(),
  categoriaId: z.number(),
  categoriaCodigo: z.string(),
  categoriaNombre: z.string(),
});

export const provinciasResponseSchema = z.object({
  data: z.array(provinciaSchema),
});

export const localidadesResponseSchema = z.object({
  data: z.array(localidadSchema),
});

export const parametrosResponseSchema = z.object({
  data: z.array(parametroSchema),
});

export const catalogoResponses = {
  provincias: documentedResponses(200, provinciasResponseSchema),
  localidades: documentedResponses(200, localidadesResponseSchema),
  parametros: documentedResponses(200, parametrosResponseSchema),
};

export type LocalidadQuery = z.infer<typeof localidadQuerySchema>;
export type ParametroQuery = z.infer<typeof parametroQuerySchema>;
