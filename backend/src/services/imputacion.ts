import { Decimal } from "../utils/decimal.js";

export type TipoDeudaImputable = "GASTO" | "CUOTA";

export type DeudaImputable = {
  id: string;
  tipo: TipoDeudaImputable;
  vencimiento: Date;
  saldoPesos: Decimal;
  interesPesos: Decimal;
};

export type MovimientoImputacion = {
  deudaId: string;
  tipo: TipoDeudaImputable;
  aInteres: Decimal;
  aCapital: Decimal;
  total: Decimal;
};

export function ordenarPrelacion(deudas: DeudaImputable[], fechaCorte: Date = new Date()): DeudaImputable[] {
  return [...deudas].sort((a, b) => {
    const prelacion = rangoPrelacion(a, fechaCorte) - rangoPrelacion(b, fechaCorte);
    if (prelacion !== 0) return prelacion;
    const fecha = a.vencimiento.getTime() - b.vencimiento.getTime();
    if (fecha !== 0) return fecha;
    return a.id.localeCompare(b.id);
  });
}

export function imputarIngreso(monto: Decimal, deudasOrdenadas: DeudaImputable[]): { movimientos: MovimientoImputacion[]; remanente: Decimal } {
  let remanente = monto;
  const movimientos: MovimientoImputacion[] = [];

  for (const deuda of deudasOrdenadas) {
    if (remanente.isZeroOrLess()) break;

    const aInteres = remanente.min(deuda.interesPesos);
    remanente = remanente.sub(aInteres);
    const aCapital = remanente.min(deuda.saldoPesos);
    remanente = remanente.sub(aCapital);
    const total = aInteres.add(aCapital);

    if (total.isPositive()) {
      movimientos.push({
        deudaId: deuda.id,
        tipo: deuda.tipo,
        aInteres,
        aCapital,
        total,
      });
    }
  }

  return { movimientos, remanente };
}

function rangoPrelacion(deuda: DeudaImputable, fechaCorte: Date): number {
  if (deuda.tipo === "GASTO") return 0;
  return deuda.vencimiento < fechaCorte ? 1 : 2;
}
