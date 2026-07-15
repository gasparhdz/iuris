import { Decimal, jus, pesos, tasa } from "../utils/decimal.js";
import { calcularMora, moraAplica, normalizeRegimenMora } from "./mora.js";

/**
 * Motor de cuenta corriente sobre Decimal (bigint). Es una función pura: recibe
 * los datos ya cargados (honorarios con su plan/cuotas/aplicaciones, gastos,
 * ingresos) y devuelve el libro mayor con saldo corrido y totales exactos.
 *
 * Reglas de valuación:
 * - JUS FECHA_REGULACION: capital congelado a valorJusRef; devenga mora por cuota
 *   vencida (o por el honorario entero si no hay plan).
 * - JUS AL_COBRO: no devenga mora (el capital se actualiza por cotización); cada
 *   pago cancela montoCapital/valorJusAlCobro JUS y el residuo se valúa al JUS
 *   vigente. La diferencia de revaluación se expone como fila AJUSTE.
 * - PESOS: aritmética directa; mora si hay tasa y vencimiento pasado.
 */

export type CCAplicacion = {
  fecha: Date;
  montoCapital: string;
  montoInteres: string;
  valorJusAlCobro: string | null;
};

export type CCCuota = {
  id: number;
  numero: number;
  vencimiento: Date;
  montoJus: string | null;
  montoPesos: string | null;
  valorJusRef: string | null;
  aplicaciones: CCAplicacion[];
};

export type CCPlan = {
  // Los planes guardan la tasa como fracción (0.05 = 5%).
  tasaInteresMensual: string | null;
  regimenMora: string | null;
  politicaCodigo: string | null;
  valorJusRef: string | null;
  cuotas: CCCuota[];
};

export type CCHonorario = {
  id: number;
  descripcion: string;
  fechaRegulacion: Date;
  fechaVencimiento: Date | null;
  jus: string | null;
  montoPesos: string | null;
  valorJusRef: string | null;
  politicaCodigo: string | null;
  monedaCodigo: string | null;
  // La tabla honorarios guarda la tasa como porcentaje (5.00 = 5%).
  tasaInteresMensualPct: string | null;
  plan: CCPlan | null;
  aplicaciones: CCAplicacion[];
};

export type CCGasto = {
  id: number;
  descripcion: string;
  fecha: Date;
  monto: string;
  /** Código de moneda (ARS / JUS / USD…). El motor decide por este campo, no por presencia de cotización. */
  monedaCodigo?: string | null;
  cotizacionArs?: string | null;
};

export type CCIngreso = {
  id: number;
  descripcion: string;
  fecha: Date;
  monto: string;
};

export type CCInput = {
  fechaCorte: Date;
  valorJusActual: string | number | Decimal;
  honorarios: CCHonorario[];
  gastos: CCGasto[];
  ingresos: CCIngreso[];
};

export type CCRowTipo = "HONORARIO" | "GASTO" | "INGRESO" | "INTERES" | "AJUSTE";

export type CCRow = {
  tipo: CCRowTipo;
  refId: number | null;
  fecha: string; // ISO
  descripcion: string;
  moneda: "ARS" | "JUS";
  cantidadJus: number | null;
  // Cotización JUS usada para valuar la fila (ref congelado o vigente al corte). null si no aplica.
  valorJusAplicado: number | null;
  esEstimado: boolean;
  debe: number;
  haber: number;
  saldo: number;
};

export type CCResult = {
  rows: CCRow[];
  totales: {
    capitalPesos: number;
    interesPesos: number;
    saldoPesos: number;
    saldoJus: number;
    honorariosPesos: number;
    gastosPesos: number;
    ingresosPesos: number;
    // Saldo de capital de honorarios al corte (plan-aware, sin gastos ni intereses).
    honorariosPendientesPesos: number;
  };
  fechaCorte: string;
  valorJusActual: number;
};

type DeudaCalculada = {
  saldoCapitalPesos: Decimal; // scale 2, al corte
  saldoJus: Decimal; // scale 4 (0 si no es JUS)
  interesDevengadoPesos: Decimal; // scale 2
  pagosCapitalPesos: Decimal; // scale 2 (nominal pagado)
};

type RowDraft = Omit<CCRow, "saldo" | "fecha"> & { fecha: Date; orden: number };

const ZERO2 = Decimal.zero(2);
const ZERO4 = Decimal.zero(4);
const CIEN = tasa("100");

export function buildCuentaCorriente(input: CCInput): CCResult {
  const fechaCorte = input.fechaCorte;
  const valorJusActual = Decimal.of(input.valorJusActual, 4);
  const drafts: RowDraft[] = [];

  let totalCapitalDebe = ZERO2;
  let totalInteres = ZERO2;
  let totalSaldoJus = ZERO4;
  let totalHonorariosDebe = ZERO2;
  let totalGastosDebe = ZERO2;
  let totalIngresosHaber = ZERO2;
  let totalSaldoCapitalHonorarios = ZERO2;

  for (const honorario of input.honorarios) {
    const esJus = honorario.jus !== null && jus(honorario.jus).isPositive();
    const politica = honorario.plan?.politicaCodigo ?? honorario.politicaCodigo;
    const esAlCobro = politica === "AL_COBRO";
    const valorJusRef = honorario.valorJusRef !== null ? jus(honorario.valorJusRef) : null;

    // Capital original del honorario en pesos (la fila DEBE del libro).
    let capitalOriginal: Decimal;
    let valorJusAplicadoHon: number | null = null;
    if (esJus) {
      // Siempre al valor JUS de origen: la revalorización AL_COBRO se expone en la fila AJUSTE,
      // no inflando el capital original (si no, el ajuste de lo ya pagado salía al haber).
      const valuacion = valorJusRef ?? valorJusActual;
      valorJusAplicadoHon = valuacion.toNumber();
      capitalOriginal = jus(honorario.jus!).mulByRate(valuacion, 2);
    } else {
      capitalOriginal = honorario.montoPesos !== null ? pesos(honorario.montoPesos) : ZERO2;
    }

    drafts.push({
      tipo: "HONORARIO",
      refId: honorario.id,
      fecha: honorario.fechaRegulacion,
      descripcion: honorario.descripcion,
      moneda: esJus ? "JUS" : "ARS",
      cantidadJus: esJus ? jus(honorario.jus!).toNumber() : null,
      valorJusAplicado: valorJusAplicadoHon,
      esEstimado: esJus && esAlCobro && valorJusRef === null,
      debe: capitalOriginal.toNumber(),
      haber: 0,
      orden: 0,
    });
    totalCapitalDebe = totalCapitalDebe.add(capitalOriginal);
    totalHonorariosDebe = totalHonorariosDebe.add(capitalOriginal);

    // Las deudas reales: cuotas del plan, o el honorario entero si no hay plan.
    const tasaFraccion = honorario.plan
      ? (honorario.plan.tasaInteresMensual !== null ? Decimal.of(honorario.plan.tasaInteresMensual, 6) : Decimal.zero(6))
      : (honorario.tasaInteresMensualPct !== null
          ? Decimal.of(honorario.tasaInteresMensualPct, 6).divByRate(CIEN, 6)
          : Decimal.zero(6));
    const regimen = normalizeRegimenMora(honorario.plan?.regimenMora ?? null);

    const deudas = honorario.plan
      ? honorario.plan.cuotas.map((cuota) => ({
          etiqueta: `Cuota ${cuota.numero}`,
          vencimiento: cuota.vencimiento,
          montoJus: cuota.montoJus,
          montoPesos: cuota.montoPesos,
          valorJusRef: cuota.valorJusRef ?? honorario.plan!.valorJusRef ?? honorario.valorJusRef,
          aplicaciones: cuota.aplicaciones,
        }))
      : [{
          etiqueta: honorario.descripcion,
          vencimiento: honorario.fechaVencimiento ?? honorario.fechaRegulacion,
          montoJus: honorario.jus,
          montoPesos: honorario.montoPesos,
          valorJusRef: honorario.valorJusRef,
          aplicaciones: honorario.aplicaciones,
        }];

    let saldoCapitalHonorario = ZERO2;
    let pagosCapitalHonorario = ZERO2;

    for (const deuda of deudas) {
      const calc = calcularDeuda(deuda, {
        politica,
        tasaFraccion,
        regimen,
        monedaCodigo: honorario.monedaCodigo,
        fechaCorte,
        valorJusActual,
      });

      saldoCapitalHonorario = saldoCapitalHonorario.add(calc.saldoCapitalPesos);
      pagosCapitalHonorario = pagosCapitalHonorario.add(calc.pagosCapitalPesos);
      totalSaldoJus = totalSaldoJus.add(calc.saldoJus);

      if (calc.interesDevengadoPesos.isPositive()) {
        totalInteres = totalInteres.add(calc.interesDevengadoPesos);
        drafts.push({
          tipo: "INTERES",
          refId: honorario.id,
          fecha: fechaCorte,
          descripcion: `Interés por mora — ${deuda.etiqueta}`,
          moneda: "ARS",
          cantidadJus: null,
          valorJusAplicado: null,
          esEstimado: false,
          debe: calc.interesDevengadoPesos.toNumber(),
          haber: 0,
          orden: 2,
        });
      }
    }

    totalSaldoCapitalHonorarios = totalSaldoCapitalHonorarios.add(saldoCapitalHonorario);

    // Revaluación AL_COBRO: cierra la diferencia entre el libro nominal
    // (capital original - pagos) y el saldo real valuado al JUS vigente.
    const ajuste = saldoCapitalHonorario.sub(capitalOriginal.sub(pagosCapitalHonorario));
    if (!ajuste.abs().lt(pesos("0.01"))) {
      drafts.push({
        tipo: "AJUSTE",
        refId: honorario.id,
        fecha: fechaCorte,
        descripcion: `Ajuste por actualización JUS — ${honorario.descripcion}`,
        moneda: "ARS",
        cantidadJus: null,
        valorJusAplicado: valorJusActual.toNumber(),
        esEstimado: true,
        debe: ajuste.isPositive() ? ajuste.toNumber() : 0,
        haber: ajuste.isPositive() ? 0 : ajuste.abs().toNumber(),
        orden: 3,
      });
    }
  }

  for (const gasto of input.gastos) {
    const codigo = String(gasto.monedaCodigo ?? "ARS").toUpperCase();
    const isJus = codigo === "JUS";
    const isArs = codigo === "ARS" || codigo === "";
    const cotizacion = gasto.cotizacionArs != null ? Decimal.of(gasto.cotizacionArs, 4) : null;

    let monto: Decimal;
    let cantidadJus: number | null = null;
    let valorJusAplicado: number | null = null;
    let moneda: "ARS" | "JUS" = "ARS";

    if (isJus) {
      const rate = cotizacion ?? valorJusActual;
      cantidadJus = Number(gasto.monto);
      valorJusAplicado = rate.toNumber();
      monto = jus(gasto.monto).mulByRate(rate, 2);
      moneda = "JUS";
    } else if (isArs) {
      // ARS: ignorar cotización aunque venga cargada (defensa en profundidad).
      monto = pesos(gasto.monto);
    } else {
      // USD u otras: convertir con cotizacionArs (validada en el alta del gasto).
      monto = cotizacion
        ? pesos(gasto.monto).mulByRate(cotizacion, 2)
        : pesos(gasto.monto);
      valorJusAplicado = cotizacion ? cotizacion.toNumber() : null;
    }

    totalCapitalDebe = totalCapitalDebe.add(monto);
    totalGastosDebe = totalGastosDebe.add(monto);
    drafts.push({
      tipo: "GASTO",
      refId: gasto.id,
      fecha: gasto.fecha,
      descripcion: gasto.descripcion,
      moneda,
      cantidadJus,
      valorJusAplicado,
      esEstimado: false,
      debe: monto.toNumber(),
      haber: 0,
      orden: 0,
    });
  }

  for (const ingreso of input.ingresos) {
    totalIngresosHaber = totalIngresosHaber.add(pesos(ingreso.monto));
    drafts.push({
      tipo: "INGRESO",
      refId: ingreso.id,
      fecha: ingreso.fecha,
      descripcion: ingreso.descripcion,
      moneda: "ARS",
      cantidadJus: null,
      valorJusAplicado: null,
      esEstimado: false,
      debe: 0,
      haber: pesos(ingreso.monto).toNumber(),
      orden: 1,
    });
  }

  drafts.sort((a, b) => {
    const tA = a.fecha.getTime();
    const tB = b.fecha.getTime();
    if (tA !== tB) return tA - tB;
    return a.orden - b.orden;
  });

  let saldo = ZERO2;
  const rows: CCRow[] = drafts.map(({ orden: _orden, ...draft }) => {
    saldo = saldo.add(pesos(draft.debe)).sub(pesos(draft.haber));
    return { ...draft, fecha: draft.fecha.toISOString(), saldo: saldo.toNumber() };
  });

  return {
    rows,
    totales: {
      capitalPesos: totalCapitalDebe.toNumber(),
      interesPesos: totalInteres.toNumber(),
      saldoPesos: saldo.toNumber(),
      saldoJus: totalSaldoJus.toNumber(),
      honorariosPesos: totalHonorariosDebe.toNumber(),
      gastosPesos: totalGastosDebe.toNumber(),
      ingresosPesos: totalIngresosHaber.toNumber(),
      honorariosPendientesPesos: totalSaldoCapitalHonorarios.toNumber(),
    },
    fechaCorte: fechaCorte.toISOString(),
    valorJusActual: valorJusActual.toNumber(),
  };
}

/** Saldo de un honorario con la misma lógica que liquidación/CC (intereses + JUS AL_COBRO). */
export function calcularSaldosHonorario(
  honorario: CCHonorario,
  valorJusActualInput: string | number | Decimal,
  fechaCorte: Date = new Date(),
): { saldoCapitalPesos: number; interesPesos: number; saldoPesos: number; saldoJus: number } {
  const valorJusActual = Decimal.of(valorJusActualInput, 4);
  const politica = honorario.plan?.politicaCodigo ?? honorario.politicaCodigo;
  const tasaFraccion = honorario.plan
    ? (honorario.plan.tasaInteresMensual !== null ? Decimal.of(honorario.plan.tasaInteresMensual, 6) : Decimal.zero(6))
    : (honorario.tasaInteresMensualPct !== null
        ? Decimal.of(honorario.tasaInteresMensualPct, 6).divByRate(CIEN, 6)
        : Decimal.zero(6));
  const regimen = normalizeRegimenMora(honorario.plan?.regimenMora ?? null);

  const deudas = honorario.plan
    ? honorario.plan.cuotas.map((cuota) => ({
        vencimiento: cuota.vencimiento,
        montoJus: cuota.montoJus,
        montoPesos: cuota.montoPesos,
        valorJusRef: cuota.valorJusRef ?? honorario.plan!.valorJusRef ?? honorario.valorJusRef,
        aplicaciones: cuota.aplicaciones,
      }))
    : [{
        vencimiento: honorario.fechaVencimiento ?? honorario.fechaRegulacion,
        montoJus: honorario.jus,
        montoPesos: honorario.montoPesos,
        valorJusRef: honorario.valorJusRef,
        aplicaciones: honorario.aplicaciones,
      }];

  let saldoCapitalPesos = ZERO2;
  let interesPesos = ZERO2;
  let saldoJus = ZERO4;

  for (const deuda of deudas) {
    const calc = calcularDeuda(deuda, {
      politica,
      tasaFraccion,
      regimen,
      monedaCodigo: honorario.monedaCodigo,
      fechaCorte,
      valorJusActual,
    });
    saldoCapitalPesos = saldoCapitalPesos.add(calc.saldoCapitalPesos);
    interesPesos = interesPesos.add(calc.interesDevengadoPesos);
    saldoJus = saldoJus.add(calc.saldoJus);
  }

  return {
    saldoCapitalPesos: saldoCapitalPesos.toNumber(),
    interesPesos: interesPesos.toNumber(),
    saldoPesos: saldoCapitalPesos.add(interesPesos).toNumber(),
    saldoJus: saldoJus.toNumber(),
  };
}

function calcularDeuda(
  deuda: {
    vencimiento: Date;
    montoJus: string | null;
    montoPesos: string | null;
    valorJusRef: string | null;
    aplicaciones: CCAplicacion[];
  },
  ctx: {
    politica: string | null;
    tasaFraccion: Decimal;
    regimen: ReturnType<typeof normalizeRegimenMora>;
    monedaCodigo: string | null;
    fechaCorte: Date;
    valorJusActual: Decimal;
  },
): DeudaCalculada {
  const esJus = deuda.montoJus !== null && jus(deuda.montoJus).isPositive();
  const esAlCobro = ctx.politica === "AL_COBRO";
  const valorJusRef = deuda.valorJusRef !== null ? jus(deuda.valorJusRef) : null;

  const pagosCapitalPesos = deuda.aplicaciones.reduce(
    (acc, app) => acc.add(pesos(app.montoCapital)),
    ZERO2,
  );
  const interesCobrado = deuda.aplicaciones.reduce(
    (acc, app) => acc.add(pesos(app.montoInteres)),
    ZERO2,
  );

  let saldoCapitalPesos: Decimal;
  let saldoJus = ZERO4;

  if (esJus && esAlCobro) {
    // Cada pago cancela JUS a su cotización; el residuo en pesos se calcula
    // multiplicando primero (escala 6) para que pesos→JUS→pesos sea exacto
    // cuando la cotización no cambió.
    const capitalHoy = jus(deuda.montoJus!).mulByRate(ctx.valorJusActual, 2);
    const pagosRevaluados = deuda.aplicaciones.reduce((acc, app) => {
      const cotizacionPago = app.valorJusAlCobro !== null ? jus(app.valorJusAlCobro) : (valorJusRef ?? jus(1));
      const revaluado = Decimal.of(app.montoCapital, 6)
        .mulByRate(ctx.valorJusActual, 6)
        .divByRate(cotizacionPago, 2);
      return acc.add(revaluado);
    }, ZERO2);
    saldoCapitalPesos = capitalHoy.sub(pagosRevaluados).max(ZERO2);

    const jusPagados = deuda.aplicaciones.reduce((acc, app) => {
      const cotizacionPago = app.valorJusAlCobro !== null ? jus(app.valorJusAlCobro) : (valorJusRef ?? jus(1));
      return acc.add(pesos(app.montoCapital).divByRate(cotizacionPago, 4));
    }, ZERO4);
    saldoJus = jus(deuda.montoJus!).sub(jusPagados).max(ZERO4);
  } else if (esJus) {
    // FECHA_REGULACION: capital congelado en pesos a valorJusRef.
    const capitalCongelado = jus(deuda.montoJus!).mulByRate(valorJusRef ?? ctx.valorJusActual, 2);
    saldoCapitalPesos = capitalCongelado.sub(pagosCapitalPesos).max(ZERO2);
    if (valorJusRef && valorJusRef.isPositive()) {
      saldoJus = saldoCapitalPesos.toScale(4).divByRate(valorJusRef, 4);
    }
  } else if (deuda.montoPesos !== null) {
    saldoCapitalPesos = pesos(deuda.montoPesos).sub(pagosCapitalPesos).max(ZERO2);
  } else {
    saldoCapitalPesos = ZERO2;
  }

  const monedaCodigo = String(ctx.monedaCodigo ?? "").toUpperCase();
  const esUsd = monedaCodigo.includes("USD") || monedaCodigo.includes("DOLAR") || monedaCodigo.includes("DÓLAR");
  const vencida = deuda.vencimiento < ctx.fechaCorte;

  let interesDevengadoPesos = ZERO2;
  const aplica = moraAplica({
    politicaCodigo: ctx.politica,
    esJus,
    esUsd,
    tieneMontoPesos: deuda.montoPesos !== null,
    tasaMensual: ctx.tasaFraccion,
    vencida,
    saldoPositivo: saldoCapitalPesos.isPositive(),
  });
  if (aplica) {
    const resultado = calcularMora({
      capital: esJus ? jus(deuda.montoJus!) : pesos(deuda.montoPesos!),
      moneda: esJus ? "JUS" : "PESOS",
      vencimiento: deuda.vencimiento,
      fechaCorte: ctx.fechaCorte,
      tasaMensual: ctx.tasaFraccion,
      regimen: ctx.regimen,
      baseDias: 30,
      pagos: deuda.aplicaciones.map((app) => ({
        fecha: app.fecha,
        montoPesos: pesos(app.montoCapital),
        valorJusAlCobro: app.valorJusAlCobro !== null ? jus(app.valorJusAlCobro) : valorJusRef,
      })),
      valorJusAlCorte: esJus ? (valorJusRef ?? ctx.valorJusActual) : null,
    });
    interesDevengadoPesos = resultado.interesPesos;
  }

  // El interés ya cobrado entra al libro vía las filas HABER de los ingresos;
  // acá solo se devenga el total para que la identidad del saldo cierre.
  void interesCobrado;

  return { saldoCapitalPesos, saldoJus, interesDevengadoPesos, pagosCapitalPesos };
}
