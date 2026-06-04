import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";

/**
 * Este plugin intercepta todas las respuestas y convierte cualquier objeto Date
 * en una cadena ISO string. Esto evita errores de serialización FST_ERR_RESPONSE_SERIALIZATION
 * cuando se usa fastify-type-provider-zod con esquemas que esperan strings.
 */
export const dateSerializationPlugin = fp(async (fastify: FastifyInstance) => {
  fastify.addHook("onSend", async () => {
    // Solo intentamos parsear si el payload es un string (JSON ya serializado)
    // O si estamos en una fase previa. Pero onSend recibe el payload final.
    // Sin embargo, Fastify ejecuta el serializador ANTES de onSend.
    // El problema es que el serializador de Zod falla ANTES de onSend.
    
    // Por lo tanto, la mejor estrategia en Fastify para "limpiar" datos de salida
    // de forma global es usar un preSerialization hook.
  });

  fastify.addHook("preSerialization", async (request, reply, payload) => {
    return transformDates(payload);
  });
});

function transformDates(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;

  if (obj instanceof Date) {
    return obj.toISOString();
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => transformDates(item));
  }

  if (typeof obj === "object") {
    const newObj: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      newObj[key] = transformDates(value);
    }
    return newObj;
  }

  return obj;
}
