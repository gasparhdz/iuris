import {
  APP_TIMEZONE,
  endOfDayArgentina,
  startOfDayArgentina,
  toArgentinaDateString,
} from "../utils/timezone.js";

export {
  APP_TIMEZONE,
  endOfDayArgentina,
  startOfDayArgentina,
  toArgentinaDateString,
} from "../utils/timezone.js";

export type CuotaRecordatorio = {
  cuotaId: number;
  numero: number;
  vencimiento: Date;
  montoPesos: string | null;
  montoJus: string | null;
  montoAplicado: string;
  valorJusRef: string | null;
  /** Política JUS del plan (AL_COBRO / FECHA_REGULACION). */
  politicaCodigo?: string | null;
  /**
   * JUS ya cobrados según calcularSaldoCuota (valorJusAlCobro por aplicación cuando AL_COBRO).
   * Si falta, se usa el fallback montoAplicado/valorJusRef (tests unitarios).
   */
  jusPagados?: string | null;
  clienteNombre: string;
  casoCaratula: string | null;
  createdBy: number;
};

export const PREFERENCIAS_COBRANZA_DEFAULTS = {
  habilitado: true,
  diasAnticipacion: 3,
  porEmail: true,
  porPush: true,
} as const;

/**
 * Prioridad del nombre en recordatorios (igual al CASE de CobranzaRecordatorioQueries):
 * tercero → obligadoCliente → cliente del plan.
 */
export function resolveNombreDeudorCobranza(input: {
  obligadoTerceroId?: number | null;
  obligadoClienteId?: number | null;
  terceroNombre?: string | null;
  obligadoClienteNombre?: string | null;
  clienteNombre?: string | null;
}): string {
  if (input.obligadoTerceroId != null) {
    return input.terceroNombre?.trim() || "Sin nombre";
  }
  if (input.obligadoClienteId != null) {
    return input.obligadoClienteNombre?.trim() || "Sin cliente";
  }
  return input.clienteNombre?.trim() || "Sin cliente";
}

export function isPastDailyCobranzaWindow(now: Date): boolean {
  const hour = Number(new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    hour: "numeric",
    hour12: false,
  }).format(now));
  return hour >= 8;
}

function resolveJusPagados(
  cuota: Pick<CuotaRecordatorio, "montoAplicado" | "valorJusRef" | "jusPagados">,
): number {
  if (cuota.jusPagados != null && cuota.jusPagados !== "") {
    return Number(cuota.jusPagados);
  }
  const valorRef = cuota.valorJusRef ? Number(cuota.valorJusRef) : 1;
  return Number(cuota.montoAplicado) / (valorRef || 1);
}

export function cuotaTieneSaldoPendiente(
  cuota: Pick<CuotaRecordatorio, "montoPesos" | "montoJus" | "montoAplicado" | "valorJusRef" | "jusPagados">,
): boolean {
  if (cuota.montoJus !== null && Number(cuota.montoJus) > 0) {
    const jusPagados = resolveJusPagados(cuota);
    return Number(cuota.montoJus) - jusPagados > 0.0001;
  }

  return Number(cuota.montoPesos ?? 0) - Number(cuota.montoAplicado) > 0.01;
}

export function formatSaldoCuota(
  cuota: Pick<CuotaRecordatorio, "montoPesos" | "montoJus" | "montoAplicado" | "valorJusRef" | "jusPagados">,
): string {
  if (cuota.montoJus !== null && Number(cuota.montoJus) > 0) {
    const jusPagados = resolveJusPagados(cuota);
    const saldoJus = Math.max(0, Number(cuota.montoJus) - jusPagados);
    return `${saldoJus.toFixed(4).replace(/\.?0+$/, "")} JUS`;
  }

  const saldo = Math.max(0, Number(cuota.montoPesos ?? 0) - Number(cuota.montoAplicado));
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(saldo);
}

export function clasificarCuotasCobranza(
  cuotas: CuotaRecordatorio[],
  hoyArgentina: Date,
  diasAnticipacion: number,
): { vencidas: CuotaRecordatorio[]; porVencer: CuotaRecordatorio[] } {
  const finPorVencer = endOfDayArgentina(hoyArgentina);
  finPorVencer.setUTCDate(finPorVencer.getUTCDate() + diasAnticipacion);

  const vencidas: CuotaRecordatorio[] = [];
  const porVencer: CuotaRecordatorio[] = [];

  for (const cuota of cuotas) {
    if (!cuotaTieneSaldoPendiente(cuota)) continue;

    if (cuota.vencimiento < hoyArgentina) {
      vencidas.push(cuota);
    } else if (cuota.vencimiento <= finPorVencer) {
      porVencer.push(cuota);
    }
  }

  const sortByVencimiento = (a: CuotaRecordatorio, b: CuotaRecordatorio) =>
    a.vencimiento.getTime() - b.vencimiento.getTime();

  vencidas.sort(sortByVencimiento);
  porVencer.sort(sortByVencimiento);

  return { vencidas, porVencer };
}

export function agruparCuotasPorUsuario(cuotas: CuotaRecordatorio[]): Map<number, CuotaRecordatorio[]> {
  const map = new Map<number, CuotaRecordatorio[]>();
  for (const cuota of cuotas) {
    const list = map.get(cuota.createdBy) ?? [];
    list.push(cuota);
    map.set(cuota.createdBy, list);
  }
  return map;
}

export function buildCobranzaPushBody(vencidasCount: number, porVencerCount: number): string {
  const parts: string[] = [];
  if (vencidasCount > 0) {
    parts.push(`${vencidasCount} cuota${vencidasCount === 1 ? "" : "s"} vencida${vencidasCount === 1 ? "" : "s"}`);
  }
  if (porVencerCount > 0) {
    parts.push(`${porVencerCount} por vencer`);
  }
  if (parts.length === 0) return "Cobranzas pendientes";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} y ${parts[1]}`;
}
