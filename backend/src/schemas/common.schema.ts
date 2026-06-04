import { z } from "zod";

export const positiveIntSchema = z.coerce.number().int().positive();

export const idParamSchema = z.object({
  id: positiveIntSchema,
}).strict();

export const paginationQuerySchema = z.object({
  page: positiveIntSchema.default(1),
  limit: positiveIntSchema.max(100).default(20),
}).strict();

export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

export const successMessageResponseSchema = z.object({
  data: z.object({
    message: z.string(),
  }),
});

export const paginationMetaSchema = z.object({
  total: z.number(),
  page: z.number(),
  limit: z.number(),
});

export const healthResponseSchema = z.object({
  data: z.object({
    status: z.string(),
    environment: z.string(),
    timestamp: z.string(),
    dependencies: z.object({
      postgres: z.literal("ok"),
      redis: z.literal("ok"),
    }).optional(),
  }),
});

export const healthDependencyFailureResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    dependencies: z.object({
      postgres: z.enum(["ok", "error"]),
      redis: z.enum(["ok", "error"]),
    }),
  }),
});

export function documentedResponses<TSchema extends z.ZodTypeAny>(successCode: 200 | 201, successSchema: TSchema) {
  return {
    [successCode]: successSchema,
    400: errorResponseSchema,
    401: errorResponseSchema,
    403: errorResponseSchema,
    404: errorResponseSchema,
    405: errorResponseSchema,
    409: errorResponseSchema,
    500: errorResponseSchema,
  };
}
