const TIMEZONE = "America/Argentina/Buenos_Aires";

export type CuotaRecordatorio = {
  cuotaId: number;
  numero: number;
  vencimiento: Date;
  montoPesos: string | null;
  montoJus: string | null;
  montoAplicado: string;
  valorJusRef: string | null;
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

export function toArgentinaDateString(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(date);
}

export function startOfDayArgentina(date: Date): Date {
  const dateStr = toArgentinaDateString(date);
  return new Date(`${dateStr}T03:00:00.000Z`);
}

export function endOfDayArgentina(date: Date): Date {
  const start = startOfDayArgentina(date);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  end.setUTCMilliseconds(-1);
  return end;
}

export function isPastDailyCobranzaWindow(now: Date): boolean {
  const hour = Number(new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    hour: "numeric",
    hour12: false,
  }).format(now));
  return hour >= 8;
}

export function cuotaTieneSaldoPendiente(
  cuota: Pick<CuotaRecordatorio, "montoPesos" | "montoJus" | "montoAplicado" | "valorJusRef">,
): boolean {
  if (cuota.montoJus !== null && Number(cuota.montoJus) > 0) {
    const valorRef = cuota.valorJusRef ? Number(cuota.valorJusRef) : 1;
    const jusPagados = Number(cuota.montoAplicado) / valorRef;
    return Number(cuota.montoJus) - jusPagados > 0.0001;
  }

  return Number(cuota.montoPesos ?? 0) - Number(cuota.montoAplicado) > 0.01;
}

export function formatSaldoCuota(
  cuota: Pick<CuotaRecordatorio, "montoPesos" | "montoJus" | "montoAplicado" | "valorJusRef">,
): string {
  if (cuota.montoJus !== null && Number(cuota.montoJus) > 0) {
    const valorRef = cuota.valorJusRef ? Number(cuota.valorJusRef) : 1;
    const jusPagados = Number(cuota.montoAplicado) / valorRef;
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
    if (!cuota.createdBy) continue;
    const list = map.get(cuota.createdBy) ?? [];
    list.push(cuota);
    map.set(cuota.createdBy, list);
  }

  return map;
}

export function buildCobranzaPushBody(vencidas: number, porVencer: number): string {
  const parts: string[] = [];

  if (vencidas > 0) {
    parts.push(`${vencidas} cuota${vencidas === 1 ? "" : "s"} vencida${vencidas === 1 ? "" : "s"}`);
  }
  if (porVencer > 0) {
    parts.push(`${porVencer} por vencer`);
  }

  return parts.join(" y ");
}

export function formatVencimientoArgentina(date: Date): string {
  return date.toLocaleDateString("es-AR", {
    timeZone: TIMEZONE,
    dateStyle: "medium",
  });
}
