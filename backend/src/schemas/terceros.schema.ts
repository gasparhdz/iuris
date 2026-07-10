import { z } from "zod";
import { idParamSchema, paginationMetaSchema, paginationQuerySchema, positiveIntSchema } from "./common.schema.js";

const PERSONA_FISICA_IDS = new Set([1, 143]);
const PERSONA_JURIDICA_IDS = new Set([2, 144]);

function hasText(value?: string | null) {
  return typeof value === "string" && value.trim().length > 0;
}

// TODO: migrar validación de tipoPersonaId a codigo (PERSONA_FISICA / PERSONA_JURIDICA)
// en lugar de sets de IDs hardcodeados (dev vs prod pueden diferir).
const TIPO_PERSONA_IDS_VALIDOS = new Set([...PERSONA_FISICA_IDS, ...PERSONA_JURIDICA_IDS]);

const terceroBaseObjectSchema = z.object({
  tipoPersonaId: positiveIntSchema.refine(
    (id) => TIPO_PERSONA_IDS_VALIDOS.has(id),
    { message: "tipoPersonaId inválido: debe ser un ID de TIPO_PERSONA válido" },
  ),
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

function validateTipoPersonaConsistency<T extends { tipoPersonaId?: number; nombre?: string | null; apellido?: string | null; razonSocial?: string | null }>(schema: z.ZodType<T>) {
  return schema.refine(
    (data) => {
      if (data.tipoPersonaId === undefined) return true;

      if (PERSONA_FISICA_IDS.has(data.tipoPersonaId)) {
        return hasText(data.nombre) && hasText(data.apellido) && !hasText(data.razonSocial);
      }

      if (PERSONA_JURIDICA_IDS.has(data.tipoPersonaId)) {
        return hasText(data.razonSocial) && !hasText(data.nombre) && !hasText(data.apellido);
      }

      return true;
    },
    {
      message: "Campos inválidos para el tipo de persona seleccionado",
      path: ["tipoPersonaId"],
    }
  );
}

export const terceroBaseSchema = terceroBaseObjectSchema;
export const createTerceroSchema = validateTipoPersonaConsistency(terceroBaseObjectSchema);
export const updateTerceroSchema = validateTipoPersonaConsistency(terceroBaseObjectSchema.partial());

const terceroItemSchema = terceroBaseObjectSchema.extend({
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
  orderBy: z.enum(["nombre", "dni", "tipo"]).default("nombre"),
  order: z.enum(["asc", "desc"]).default("asc"),
}).strict();

export { idParamSchema };

export type CreateTerceroInput = z.infer<typeof createTerceroSchema>;
export type UpdateTerceroInput = z.infer<typeof updateTerceroSchema>;
export type TerceroListQuery = z.infer<typeof terceroQuerySchema>;
