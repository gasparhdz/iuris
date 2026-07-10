import { Decimal, jus, pesos, tasa } from "../utils/decimal.js";
import { startOfDayArgentina } from "../utils/timezone.js";

export type RegimenMora = "SIMPLE" | "COMPUESTO";
export type BaseDiasMora = 30 | 365;
export type MonedaMora = "PESOS" | "JUS";

export function normalizeRegimenMora(value: string | null | undefined): RegimenMora {
  return value === "COMPUESTO" ? "COMPUESTO" : "SIMPLE";
}

export function moraAplica(params: {
  politicaCodigo: string | null | undefined;
  esJus: boolean;
  esUsd: boolean;
  tieneMontoPesos: boolean;
  tasaMensual: Decimal;
  vencida: boolean;
  saldoPositivo: boolean;
}): boolean {
  if (!params.tasaMensual.isPositive() || !params.vencida || !params.saldoPositivo) return false;

  // Regla contable por defecto: la mora aplica a JUS congelado en FECHA_REGULACION
  // o a deudas en pesos puros. JUS AL_COBRO no devenga mora porque su capital ya
  // se actualiza por valor JUS vigente al cobro. Para cambiar esa politica, este
  // predicado es el unico lugar que debe modificarse.
  return params.politicaCodigo === "FECHA_REGULACION"
    || (!params.esJus && !params.esUsd && params.tieneMontoPesos);
}

export type PagoMora = {
  fecha: Date;
  montoNativo?: Decimal;
  montoPesos?: Decimal;
  valorJusAlCobro?: Decimal | null;
};

export type TramoMora = {
  desde: Date;
  hasta: Date;
  dias: number;
  saldoNativo: Decimal;
  interesNativo: Decimal;
};

export function calcularMora(params: {
  capital: Decimal;
  moneda: MonedaMora;
  vencimiento: Date;
  fechaCorte?: Date;
  tasaMensual: Decimal | string | number;
  regimen?: RegimenMora;
  baseDias?: BaseDiasMora;
  pagos?: PagoMora[];
  valorJusAlCorte?: Decimal | string | number | null;
}): { interesNativo: Decimal; interesPesos: Decimal; tramos: TramoMora[] } {
  const fechaCorte = params.fechaCorte ?? new Date();
  const nativeScale = params.moneda === "JUS" ? 4 : 2;
  const capital = params.capital.toScale(nativeScale);
  const zeroNative = Decimal.zero(nativeScale);
  if (fechaCorte <= params.vencimiento) {
    return { interesNativo: zeroNative, interesPesos: Decimal.zero(2), tramos: [] };
  }

  const tasaMensual = Decimal.of(params.tasaMensual, 6);
  if (tasaMensual.isZeroOrLess()) {
    return { interesNativo: zeroNative, interesPesos: Decimal.zero(2), tramos: [] };
  }

  const regimen = params.regimen ?? "SIMPLE";
  const baseDias = params.baseDias ?? 30;
  const pagos = (params.pagos ?? [])
    .filter((p) => p.fecha > params.vencimiento && p.fecha <= fechaCorte)
    .sort((a, b) => a.fecha.getTime() - b.fecha.getTime());

  let saldo = capital;
  let interesTotal = zeroNative;
  const tramos: TramoMora[] = [];
  const eventos = [...pagos.map((p) => ({ fecha: p.fecha, pago: pagoANativo(p, params.moneda, nativeScale) })), { fecha: fechaCorte, pago: zeroNative }];
  let desde = params.vencimiento;

  for (const evento of eventos) {
    if (saldo.isZeroOrLess()) break;
    const dias = diffDias(desde, evento.fecha);
    if (dias > 0) {
      if (regimen === "COMPUESTO") {
        let tramoDesde = desde;
        let diasRestantes = dias;
        while (diasRestantes > 0) {
          const diasTramo = Math.min(baseDias, diasRestantes);
          const tramoHasta = diasTramo === diasRestantes ? evento.fecha : addDays(tramoDesde, diasTramo);
          const interes = interesTramo(saldo, tasaMensual, diasTramo, baseDias, nativeScale);
          interesTotal = interesTotal.add(interes);
          tramos.push({ desde: tramoDesde, hasta: tramoHasta, dias: diasTramo, saldoNativo: saldo, interesNativo: interes });
          saldo = saldo.add(interes);
          tramoDesde = tramoHasta;
          diasRestantes -= diasTramo;
        }
      } else {
        const interes = interesTramo(saldo, tasaMensual, dias, baseDias, nativeScale);
        interesTotal = interesTotal.add(interes);
        tramos.push({ desde, hasta: evento.fecha, dias, saldoNativo: saldo, interesNativo: interes });
      }
    }
    saldo = saldo.sub(evento.pago.min(saldo)).max(zeroNative);
    desde = evento.fecha;
  }

  const interesPesos = params.moneda === "JUS"
    ? interesTotal.mulByRate(params.valorJusAlCorte ? Decimal.of(params.valorJusAlCorte, 4) : jus(0), 2)
    : pesos(interesTotal);

  return { interesNativo: interesTotal, interesPesos, tramos };
}

function interesTramo(saldo: Decimal, tasaMensual: Decimal, dias: number, baseDias: BaseDiasMora, targetScale: 2 | 4): Decimal {
  const diasRate = tasa(dias.toString());
  const baseRate = tasa(baseDias.toString());
  const factor = tasaMensual.mulByRate(diasRate, 6).divByRate(baseRate, 6);
  return saldo.mulByRate(factor, targetScale);
}

function pagoANativo(pago: PagoMora, moneda: MonedaMora, scale: 2 | 4): Decimal {
  if (pago.montoNativo) return pago.montoNativo.toScale(scale);
  if (moneda === "JUS" && pago.montoPesos && pago.valorJusAlCobro) return pago.montoPesos.divByRate(pago.valorJusAlCobro, 4);
  if (pago.montoPesos) return pago.montoPesos.toScale(scale);
  return Decimal.zero(scale);
}

function diffDias(desde: Date, hasta: Date): number {
  const start = startOfDayArgentina(desde).getTime();
  const end = startOfDayArgentina(hasta).getTime();
  return Math.max(0, Math.floor((end - start) / 86400000));
}

function addDays(fecha: Date, dias: number): Date {
  const next = new Date(fecha);
  next.setUTCDate(next.getUTCDate() + dias);
  return next;
}
