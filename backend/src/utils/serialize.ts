/**
 * Convierte todos los campos Date de un objeto (o array) a strings ISO 8601.
 * Esto resuelve el error FST_ERR_RESPONSE_SERIALIZATION de Fastify
 * cuando Zod espera string pero Drizzle devuelve Date.
 */
export function serializeDates<T>(data: T): T {
  if (data === null || data === undefined) return data;

  if (data instanceof Date) {
    return data.toISOString() as unknown as T;
  }

  if (Array.isArray(data)) {
    return data.map(serializeDates) as unknown as T;
  }

  if (typeof data === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      result[key] = serializeDates(value);
    }
    return result as T;
  }

  return data;
}
