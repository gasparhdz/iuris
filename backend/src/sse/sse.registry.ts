import type { FastifyReply } from "fastify";

/**
 * Registro en memoria de conexiones SSE abiertas, indexadas por usuario.
 *
 * TODO(SSE multi-instancia): este registro vive en el proceso. Hoy el backend
 * corre como instancia única (ver reset de sync 'running' al arrancar en
 * server.ts), por lo que alcanza. Si se escala horizontalmente, abanicar
 * eventos entre instancias con Redis Pub/Sub (ioredis ya disponible): cada
 * instancia publica en un canal y todas reenvían a sus conexiones locales.
 */
const conexiones = new Map<number, Set<FastifyReply>>();

export function registrarConexion(usuarioId: number, reply: FastifyReply): void {
  let set = conexiones.get(usuarioId);
  if (!set) {
    set = new Set();
    conexiones.set(usuarioId, set);
  }
  set.add(reply);

  reply.raw.on("close", () => {
    const actual = conexiones.get(usuarioId);
    if (!actual) return;
    actual.delete(reply);
    if (actual.size === 0) conexiones.delete(usuarioId);
  });
}

/** Empuja un evento SSE a todas las conexiones abiertas de un usuario. */
export function emitirAUsuario(usuarioId: number, evento: string, data: unknown): void {
  const set = conexiones.get(usuarioId);
  if (!set || set.size === 0) return;

  const payload =
    `id: ${Date.now()}\n` +
    `event: ${evento}\n` +
    `data: ${JSON.stringify(data)}\n\n`;

  for (const reply of set) {
    try {
      reply.raw.write(payload);
    } catch {
      // conexión rota: el handler 'close' la limpiará
    }
  }
}
