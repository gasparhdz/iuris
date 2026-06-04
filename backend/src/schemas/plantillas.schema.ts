import { z } from "zod";
import { idParamSchema } from "./common.schema.js";
import { adjuntoItemSchema } from "./adjuntos.schema.js";

export const createPlantillaSchema = z.object({
  titulo: z.string().min(1).max(255),
  contenidoHtml: z.string().min(1),
}).strict();

export const updatePlantillaSchema = createPlantillaSchema.partial();

export const generarDocumentoSchema = z.object({
  plantillaId: z.coerce.number().int().positive(),
  guardarEnDrive: z.boolean().default(false),
}).strict();

export const generarDocumentoParamsSchema = z.object({
  casoId: z.coerce.number().int().positive(),
}).strict();

export const plantillaItemSchema = z.object({
  id: z.number(),
  estudioId: z.number(),
  titulo: z.string(),
  contenidoHtml: z.string(),
  activo: z.boolean(),
  createdAt: z.string(),
});

export const plantillaResponseSchema = z.object({ data: plantillaItemSchema });
export const plantillaListResponseSchema = z.object({ data: z.array(plantillaItemSchema) });
export const generarDocumentoResponseSchema = z.object({
  data: z.object({
    htmlGenerado: z.string(),
    adjunto: adjuntoItemSchema.nullable(),
  }),
});

export { idParamSchema };

export type CreatePlantillaInput = z.infer<typeof createPlantillaSchema>;
export type UpdatePlantillaInput = z.infer<typeof updatePlantillaSchema>;
export type GenerarDocumentoInput = z.infer<typeof generarDocumentoSchema>;
