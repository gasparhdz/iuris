/**
 * Resuelve el deudor de un honorario.
 * Prioridad: obligadoTerceroId → obligadoClienteId → clienteId (fallback legacy).
 */
export type HonorarioDeudorRef = {
  obligadoTerceroId?: number | null;
  obligadoClienteId?: number | null;
  clienteId?: number | null;
};

export type DeudorResuelto =
  | { tipo: "tercero"; id: number }
  | { tipo: "cliente"; id: number };

export function resolveHonorarioDeudor(h: HonorarioDeudorRef): DeudorResuelto | null {
  if (h.obligadoTerceroId != null) {
    return { tipo: "tercero", id: h.obligadoTerceroId };
  }
  const clienteId = h.obligadoClienteId ?? h.clienteId ?? null;
  if (clienteId != null) {
    return { tipo: "cliente", id: clienteId };
  }
  return null;
}

/** True si el deudor del honorario es el cliente indicado (no un tercero). */
export function honorarioDeudorEsCliente(h: HonorarioDeudorRef, clienteId: number): boolean {
  const deudor = resolveHonorarioDeudor(h);
  return deudor?.tipo === "cliente" && deudor.id === clienteId;
}

/** Clave estable para agrupar por deudor. */
export function deudorKey(deudor: DeudorResuelto): string {
  return `${deudor.tipo}:${deudor.id}`;
}

export function deudoresIguales(a: DeudorResuelto | null, b: DeudorResuelto | null): boolean {
  if (!a || !b) return false;
  return a.tipo === b.tipo && a.id === b.id;
}

/**
 * Exige que todos los honorarios compartan el mismo deudor.
 * Lanza Error("PLAN_DEUDORES_DISTINTOS") si hay mezcla.
 * Lanza Error("HONORARIO_SIN_DEUDOR") si alguno no resuelve deudor.
 */
export function assertMismoDeudor(honorarios: HonorarioDeudorRef[]): DeudorResuelto {
  if (honorarios.length === 0) {
    throw new Error("HONORARIO_SIN_DEUDOR");
  }
  const primero = resolveHonorarioDeudor(honorarios[0]);
  if (!primero) throw new Error("HONORARIO_SIN_DEUDOR");

  for (let i = 1; i < honorarios.length; i++) {
    const d = resolveHonorarioDeudor(honorarios[i]);
    if (!d) throw new Error("HONORARIO_SIN_DEUDOR");
    if (!deudoresIguales(primero, d)) throw new Error("PLAN_DEUDORES_DISTINTOS");
  }
  return primero;
}
