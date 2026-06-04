import { z } from "zod";
import { positiveIntSchema } from "./common.schema.js";

export const casoLiquidacionParamsSchema = z.object({
  casoId: positiveIntSchema,
}).strict();

export const clienteLiquidacionParamsSchema = z.object({
  clienteId: positiveIntSchema,
}).strict();

export const liquidacionDetalleSchema = z.object({
  tipo: z.enum(["HONORARIO", "GASTO", "INGRESO", "AJUSTE", "INTERES"]),
  id: z.number(),
  fecha: z.string(),
  fechaVencimiento: z.string().nullable().optional(),
  clienteId: z.number().nullable().optional(),
  casoId: z.number().nullable().optional(),
  descripcion: z.string(),
  montoPesos: z.number(),
  debe: z.number().optional(),
  haber: z.number().optional(),
  monedaOriginal: z.enum(["ARS", "USD", "JUS"]).optional(),
  cantidadOriginal: z.number().optional(),
  cotizacionArs: z.number().nullable().optional(),
  estado: z.object({
    id: z.number().nullable(),
    codigo: z.string().nullable(),
    nombre: z.string().nullable(),
  }).nullable().optional(),
});

export const saldoBidimensionalSchema = z.object({
  jus: z.number(),
  pesos: z.number(),
  valorJusAplicado: z.number().nullable(),
  esEstimado: z.boolean(),
});

export const lineaLiquidacionSchema = liquidacionDetalleSchema.extend({
  capital: saldoBidimensionalSchema,
  interes: saldoBidimensionalSchema,
  saldo: saldoBidimensionalSchema,
});

export const liquidacionResponseSchema = z.object({
  data: z.object({
    detalles: z.array(liquidacionDetalleSchema),
    lineas: z.array(lineaLiquidacionSchema),
    cotizacion: z.object({
      valorJusActual: z.number(),
      fechaCorte: z.string(),
    }),
    totales: z.object({
      capitalJus: z.number(),
      capitalPesos: z.number(),
      interesPesos: z.number(),
      saldoTotalPesos: z.number(),
      saldoTotalJus: z.number(),
    }),
    leyenda: z.string(),
    totalHonorariosPesos: z.number(),
    totalGastosPesos: z.number(),
    totalIngresosPesos: z.number(),
    saldoPendientePesos: z.number(),
    estadoFinanciero: z.enum(["Al Día", "Deudor"]),
  }),
});
