import { z } from "zod";
import { idParamSchema, positiveIntSchema } from "./common.schema.js";

export const adjuntosQuerySchema = z.object({
  scope: z.enum(["CLIENTE", "CASO"]),
  scopeId: positiveIntSchema,
}).strict();

export const uploadAdjuntoSchema = z.object({
  scope: z.enum(["CLIENTE", "CASO"]),
  scopeId: positiveIntSchema,
}).strict();

export const presignAdjuntoSchema = z.object({
  scope: z.enum(["CLIENTE", "CASO"]),
  scopeId: positiveIntSchema,
  nombre: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(100),
  size: z.number().int().positive(),
}).strict();

export const confirmAdjuntoSchema = z.object({
  scope: z.enum(["CLIENTE", "CASO"]),
  scopeId: positiveIntSchema,
  key: z.string().min(1),
  nombre: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(100),
  size: z.number().int().positive(),
}).strict();

export const adjuntoItemSchema = z.object({
  id: z.number(),
  estudioId: z.number(),
  scope: z.string(),
  scopeId: z.number(),
  nombre: z.string(),
  mime: z.string(),
  driveFileId: z.string(),
  driveFolderId: z.string(),
  storageDriver: z.string().optional(),
  etag: z.string().nullable().optional(),
  creadoEn: z.string(),
  eliminadoEn: z.string().nullable(),
});

export const adjuntoResponseSchema = z.object({ data: adjuntoItemSchema });
export const presignAdjuntoResponseSchema = z.object({
  data: z.object({
    key: z.string(),
    url: z.string(),
    method: z.enum(["POST", "PUT"]),
    fields: z.record(z.string(), z.string()).optional(),
    headers: z.record(z.string(), z.string()).optional(),
    expiresAt: z.string(),
  }),
});
export const adjuntoListResponseSchema = z.object({ data: z.array(adjuntoItemSchema) });
export const indexarAdjuntosResponseSchema = z.object({
  data: z.object({
    creados: z.number(),
    eliminados: z.number(),
  }),
});

export { idParamSchema };

export type AdjuntosQueryInput = z.infer<typeof adjuntosQuerySchema>;
export type UploadAdjuntoInput = z.infer<typeof uploadAdjuntoSchema>;
export type PresignAdjuntoInput = z.infer<typeof presignAdjuntoSchema>;
export type ConfirmAdjuntoInput = z.infer<typeof confirmAdjuntoSchema>;
