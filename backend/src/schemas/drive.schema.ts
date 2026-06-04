import { z } from "zod";
import { positiveIntSchema } from "./common.schema.js";

export const driveIdParamSchema = z.object({ id: positiveIntSchema }).strict();
export const vincularCarpetaSchema = z.object({
  driveFolderId: z.string().min(1),
}).strict();

export const driveFolderResponseSchema = z.object({
  data: z.object({
    id: z.number(),
    driveFolderId: z.string().nullable(),
  }),
});

export type VincularCarpetaInput = z.infer<typeof vincularCarpetaSchema>;
