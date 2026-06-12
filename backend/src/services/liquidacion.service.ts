import { CuentaCorrienteService } from "./cuenta-corriente.service.js";
import type { CCResult, CCRow } from "./cuenta-corriente.js";

/**
 * Reporte de liquidación. Es un adaptador delgado sobre el motor único de
 * cuenta corriente (cuenta-corriente.ts, Decimal): mapea el libro mayor al
 * shape histórico de este endpoint. No hay cálculo propio acá — toda la
 * aritmética vive en el motor para que exista una sola fuente de verdad.
 */

const LEYENDA = "Los saldos en JUS con politica AL_COBRO son estimados: se valuan en pesos con la cotizacion vigente al corte y pueden variar al momento del cobro.";

type SaldoBidimensional = {
  jus: number;
  pesos: number;
  valorJusAplicado: number | null;
  esEstimado: boolean;
};

export class LiquidacionService {
  static async getLiquidacionCaso(casoId: number, estudioId: number) {
    const cc = await CuentaCorrienteService.getCuentaCorrienteCaso(casoId, estudioId);
    return mapReporte(cc);
  }

  static async getLiquidacionCliente(clienteId: number, estudioId: number) {
    const cc = await CuentaCorrienteService.getCuentaCorrienteCliente(clienteId, estudioId);
    return mapReporte(cc);
  }
}

function mapReporte(cc: CCResult) {
  const detalles = cc.rows.map(mapDetalle);
  const lineas = cc.rows.map((row) => {
    const detalle = mapDetalle(row);
    const esInteres = row.tipo === "INTERES";
    const neto = row.debe - row.haber;
    const capital: SaldoBidimensional = {
      jus: esInteres ? 0 : (row.cantidadJus ?? 0),
      pesos: esInteres ? 0 : neto,
      valorJusAplicado: row.valorJusAplicado,
      esEstimado: row.esEstimado,
    };
    const interes: SaldoBidimensional = {
      jus: 0,
      pesos: esInteres ? row.debe : 0,
      valorJusAplicado: row.valorJusAplicado,
      esEstimado: row.esEstimado,
    };
    const saldo: SaldoBidimensional = {
      jus: 0,
      pesos: row.saldo,
      valorJusAplicado: row.valorJusAplicado,
      esEstimado: row.esEstimado,
    };
    return { ...detalle, capital, interes, saldo };
  });

  return {
    detalles,
    lineas,
    cotizacion: {
      valorJusActual: cc.valorJusActual,
      fechaCorte: cc.fechaCorte,
    },
    totales: {
      capitalJus: cc.totales.saldoJus,
      capitalPesos: cc.totales.capitalPesos,
      interesPesos: cc.totales.interesPesos,
      saldoTotalPesos: cc.totales.saldoPesos,
      saldoTotalJus: cc.totales.saldoJus,
    },
    leyenda: LEYENDA,
    totalHonorariosPesos: cc.totales.honorariosPesos,
    totalGastosPesos: cc.totales.gastosPesos,
    totalIngresosPesos: cc.totales.ingresosPesos,
    saldoPendientePesos: cc.totales.saldoPesos,
    estadoFinanciero: cc.totales.saldoPesos <= 0 ? "Al Día" : "Deudor",
  };
}

function mapDetalle(row: CCRow) {
  return {
    tipo: row.tipo,
    id: row.refId ?? 0,
    fecha: row.fecha,
    descripcion: row.descripcion,
    montoPesos: row.debe > 0 ? row.debe : row.haber,
    debe: row.debe,
    haber: row.haber,
    monedaOriginal: row.moneda,
    cantidadOriginal: row.cantidadJus ?? 0,
    cotizacionArs: row.valorJusAplicado,
  };
}
