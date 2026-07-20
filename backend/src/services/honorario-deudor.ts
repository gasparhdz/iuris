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

/** True si el deudor del honorario es el tercero indicado. */
export function honorarioDeudorEsTercero(h: HonorarioDeudorRef, terceroId: number): boolean {
  const deudor = resolveHonorarioDeudor(h);
  return deudor?.tipo === "tercero" && deudor.id === terceroId;
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

/**
 * Regla de inmutabilidad del deudor al editar un honorario.
 * - Sin cambio real de campos → noop.
 * - Con pagos imputados → 409 HONORARIO_DEUDOR_INMUTABLE.
 * - En plan sin pagos → assertMismoDeudor; sync de datos derivados del plan.
 * - Sin plan ni pagos → libre.
 */
export type DeudorUpdateDecision = "noop" | "allow" | "sync_plan";

export function decideDeudorUpdate(params: {
  fieldsChanging: boolean;
  hasPagosImputados: boolean;
  inPlan: boolean;
  /** Honorarios del plan (incluido este) ya con el deudor propuesto. */
  honorariosDelPlan: HonorarioDeudorRef[];
}): DeudorUpdateDecision {
  if (!params.fieldsChanging) return "noop";
  if (params.hasPagosImputados) throw new Error("HONORARIO_DEUDOR_INMUTABLE");
  if (params.inPlan) {
    assertMismoDeudor(params.honorariosDelPlan);
    return "sync_plan";
  }
  return "allow";
}

/** Atribuye montos de aplicaciones de un ingreso a cada deudor (parte por aplicación). */
export function atribuirMontosPorDeudor(
  apps: Array<{
    deudor: DeudorResuelto | null;
    montoCapital: number;
    montoInteres: number;
  }>,
): Array<{ deudor: DeudorResuelto; monto: number }> {
  const byKey = new Map<string, { deudor: DeudorResuelto; monto: number }>();
  for (const app of apps) {
    if (!app.deudor) continue;
    const key = deudorKey(app.deudor);
    const monto = app.montoCapital + app.montoInteres;
    const prev = byKey.get(key);
    if (prev) {
      prev.monto += monto;
    } else {
      byKey.set(key, { deudor: app.deudor, monto });
    }
  }
  return [...byKey.values()];
}

type IngresoParaFiltroDeudor = {
  id: number;
  clienteId: number | null;
  obligadoClienteId?: number | null;
  obligadoTerceroId?: number | null;
  monto: string;
};

/**
 * Parte pura de filterIngresosParaDeudor: dado el mapa de atribuciones por ingreso,
 * recorta montos al deudor pedido (incluye sobrante y legado).
 */
export function filtrarIngresosAtribuidosParaDeudor<T extends IngresoParaFiltroDeudor>(
  ingresosList: T[],
  atribucionesByIngresoId: Map<number, Array<{ deudor: DeudorResuelto; monto: number }>>,
  deudor: DeudorResuelto,
  fallbackClienteId: number | null,
): T[] {
  const deudorPropio = (ingreso: IngresoParaFiltroDeudor): DeudorResuelto | null => {
    if (ingreso.obligadoTerceroId != null) return { tipo: "tercero", id: ingreso.obligadoTerceroId };
    const clienteId = ingreso.obligadoClienteId ?? ingreso.clienteId ?? null;
    return clienteId != null ? { tipo: "cliente", id: clienteId } : null;
  };
  const esDeudor = (d: DeudorResuelto | null) => d !== null && d.tipo === deudor.tipo && d.id === deudor.id;

  const result: T[] = [];
  for (const ingreso of ingresosList) {
    const atribuciones = atribucionesByIngresoId.get(ingreso.id) ?? [];
    const aplicadoTotal = atribuciones.reduce((acc, a) => acc + a.monto, 0);
    const match = atribuciones.find((a) => esDeudor(a.deudor));
    const sobrante = Math.max(Number(ingreso.monto) - aplicadoTotal, 0);
    let monto = match?.monto ?? 0;
    if (sobrante > 0.01 && esDeudor(deudorPropio(ingreso))) monto += sobrante;
    if (monto <= 0.01 && atribuciones.length === 0 && deudorPropio(ingreso) === null
      && deudor.tipo === "cliente" && fallbackClienteId != null && ingreso.clienteId === fallbackClienteId) {
      monto = Number(ingreso.monto);
    }
    if (monto > 0.01) result.push({ ...ingreso, monto: monto.toFixed(2) });
  }
  return result;
}

/**
 * Espejo en memoria del superset SQL de ingresos candidatos para un deudor
 * (findIngresosCandidatosParaDeudor).
 */
export function ingresoEsCandidatoParaDeudor(
  ingreso: {
    id: number;
    clienteId: number | null;
    obligadoClienteId?: number | null;
    obligadoTerceroId?: number | null;
  },
  deudor: DeudorResuelto,
  ctx: {
    apps: Array<{
      ingresoId: number;
      honorarioId: number | null;
      cuotaId: number | null;
      gastoId: number | null;
      activo: boolean;
      deletedAt: Date | null;
    }>;
    honorarioById: Map<number, HonorarioDeudorRef>;
    cuotaToHonorario: Map<number, number>;
    gastoClienteById: Map<number, number>;
  },
): boolean {
  if (deudor.tipo === "tercero" && ingreso.obligadoTerceroId === deudor.id) return true;
  if (deudor.tipo === "cliente" && ingreso.obligadoClienteId === deudor.id) return true;
  if (
    deudor.tipo === "cliente"
    && ingreso.obligadoClienteId == null
    && ingreso.obligadoTerceroId == null
    && ingreso.clienteId === deudor.id
  ) {
    return true;
  }

  for (const app of ctx.apps) {
    if (app.ingresoId !== ingreso.id || !app.activo || app.deletedAt != null) continue;

    let honorarioId = app.honorarioId;
    if (!honorarioId && app.cuotaId != null) {
      honorarioId = ctx.cuotaToHonorario.get(app.cuotaId) ?? null;
    }
    if (honorarioId != null) {
      const h = ctx.honorarioById.get(honorarioId);
      if (h) {
        if (deudor.tipo === "cliente" && honorarioDeudorEsCliente(h, deudor.id)) return true;
        if (deudor.tipo === "tercero" && honorarioDeudorEsTercero(h, deudor.id)) return true;
      }
    }

    if (deudor.tipo === "cliente" && app.gastoId != null) {
      const gastoClienteId = ctx.gastoClienteById.get(app.gastoId);
      if (gastoClienteId === deudor.id) return true;
    }
  }

  return false;
}
