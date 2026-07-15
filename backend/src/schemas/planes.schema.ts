import { z } from "zod";
import { idParamSchema, positiveIntSchema } from "./common.schema.js";

const dateStringSchema = z.string().datetime();
const positiveAmountSchema = z.coerce.number().positive();
const regimenMoraSchema = z.enum(["SIMPLE", "COMPUESTO"]);

export const createPlanPagoSchema = z.object({
  honorarioId: positiveIntSchema,
  clienteId: positiveIntSchema.optional().nullable(),
  casoId: positiveIntSchema.optional().nullable(),
  descripcion: z.string().optional().nullable(),
  fechaInicio: dateStringSchema,
  periodicidadId: positiveIntSchema,
  cantidadCuotas: positiveIntSchema.max(240),
  diasPeriodicidad: positiveIntSchema.optional(),
  montoCuotaPesos: positiveAmountSchema.optional().nullable(),
  montoCuotaJus: positiveAmountSchema.optional().nullable(),
  valorJusRef: positiveAmountSchema.optional().nullable(),
  politicaJusId: positiveIntSchema.optional().nullable(),
  tasaInteresMensual: z.number().min(0).max(1).optional().nullable(),
  regimenMora: regimenMoraSchema.default("SIMPLE").optional(),
  diaVencimiento: z.number().int().min(1).max(31).optional().nullable(),
}).strict().refine(
  (data) => data.montoCuotaPesos !== undefined && data.montoCuotaPesos !== null
    || data.montoCuotaJus !== undefined && data.montoCuotaJus !== null,
  {
    message: "Debe informar montoCuotaPesos o montoCuotaJus.",
    path: ["montoCuotaPesos"],
  }
);
// politicaJusId: el plan hereda la del honorario en el service; el cliente puede omitirla.

export const createIngresoSchema = z.object({
  clienteId: positiveIntSchema.optional().nullable(),
  casoId: positiveIntSchema.optional().nullable(),
  obligadoClienteId: positiveIntSchema.optional().nullable(),
  obligadoTerceroId: positiveIntSchema.optional().nullable(),
  planId: positiveIntSchema.optional().nullable(),
  cuotaId: positiveIntSchema.optional().nullable(),
  cuotaIds: z.array(positiveIntSchema).optional(),
  gastoIds: z.array(positiveIntSchema).optional(),
  honorarioIds: z.array(positiveIntSchema).optional(),
  descripcion: z.string().optional().nullable(),
  monto: positiveAmountSchema,
  monedaId: positiveIntSchema.optional().nullable(),
  cotizacionArs: positiveAmountSchema.optional().nullable(),
  valorJusAlCobro: positiveAmountSchema.optional().nullable(),
  fechaIngreso: dateStringSchema,
  tipoId: positiveIntSchema.optional().nullable(),
  estadoId: positiveIntSchema.optional().nullable(),
}).strict();

export const planCuotasParamsSchema = z.object({
  id: idParamSchema.shape.id,
}).strict();

export const planPagoQuerySchema = z.object({
  clienteId: positiveIntSchema.optional(),
  casoId: positiveIntSchema.optional(),
}).strict();

export const planPagoItemSchema = z.object({
  id: z.number(),
  estudioId: z.number(),
  honorarioId: z.number(),
  clienteId: z.number().nullable(),
  casoId: z.number().nullable(),
  descripcion: z.string().nullable(),
  fechaInicio: z.string().nullable(),
  periodicidadId: z.number().nullable(),
  montoCuotaPesos: z.number().nullable(),
  montoCuotaJus: z.number().nullable(),
  valorJusRef: z.number().nullable(),
  politicaJusId: z.number().nullable(),
  monedaId: z.number().nullable().optional(),
  monedaCodigo: z.string().nullable().optional(),
  tasaInteresMensual: z.number().nullable().optional(),
  regimenMora: regimenMoraSchema.optional(),
  diaVencimiento: z.number().nullable().optional(),
  totalCobradoArs: z.number().optional(),
  totalSaldoArs: z.number().optional(),
  totalHonorarioArs: z.number().optional(),
  activo: z.boolean(),
  createdBy: z.number().nullable(),
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
  updatedBy: z.number().nullable(),
  deletedAt: z.string().nullable(),
  deletedBy: z.number().nullable(),
  cliente: z.object({
    id: z.number(),
    nombre: z.string().nullable(),
    apellido: z.string().nullable(),
    razonSocial: z.string().nullable(),
  }).nullable().optional(),
  caso: z.object({
    id: z.number(),
    nroExpte: z.string().nullable(),
    caratula: z.string().nullable(),
  }).nullable().optional(),
  periodicidad: z.object({
    id: z.number(),
    codigo: z.string(),
    nombre: z.string(),
  }).nullable().optional(),
  obligadoClienteId: z.number().nullable().optional(),
  obligadoTerceroId: z.number().nullable().optional(),
  tipoDeudor: z.enum(["cliente", "tercero"]).optional(),
  deudorNombre: z.string().nullable().optional(),
});

export const planCuotaItemSchema = z.object({
  id: z.number(),
  planId: z.number(),
  numero: z.number(),
  vencimiento: z.string(),
  montoPesos: z.number().nullable(),
  montoJus: z.number().nullable(),
  valorJusRef: z.number().nullable(),
  montoCobrado: z.number(),
  saldo: z.number().nullable(),
  saldoJus: z.number().nullable().optional(),
  saldoPesos: z.number().nullable().optional(),
  cobradoJus: z.number().nullable().optional(),
  valorJusHoy: z.number().nullable().optional(),
  interes: z.object({
    aplica: z.boolean(),
    jus: z.number().nullable(),
    pesos: z.number().nullable(),
    diasVencida: z.number(),
  }).optional(),
  totalAPagarPesos: z.number().nullable().optional(),
  estadoId: z.number().nullable(),
  estadoCodigo: z.string().nullable().optional(),
  activo: z.boolean(),
  createdBy: z.number().nullable(),
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
  updatedBy: z.number().nullable(),
  deletedAt: z.string().nullable(),
  deletedBy: z.number().nullable(),
});

export const ingresoItemSchema = z.object({
  id: z.number(),
  estudioId: z.number(),
  clienteId: z.number().nullable(),
  casoId: z.number().nullable(),
  obligadoClienteId: z.number().nullable().optional(),
  obligadoTerceroId: z.number().nullable().optional(),
  obligadoNombre: z.string().nullable().optional(),
  cuotaId: z.number().nullable(),
  descripcion: z.string().nullable(),
  monto: z.number(),
  monedaId: z.number().nullable(),
  cotizacionArs: z.number().nullable(),
  valorJusAlCobro: z.number().nullable().optional(),
  fechaIngreso: z.string(),
  tipoId: z.number().nullable(),
  estadoId: z.number().nullable(),
  activo: z.boolean(),
  createdAt: z.string(),
  createdBy: z.number().nullable(),
  updatedAt: z.string().nullable(),
  updatedBy: z.number().nullable(),
  deletedAt: z.string().nullable(),
  deletedBy: z.number().nullable(),
  jusAplicados: z.number().nullable().optional(),
  montoAplicadoJusPesos: z.number().nullable().optional(),
  montoAplicadoGastoPesos: z.number().nullable().optional(),
});

export const planPagoResponseSchema = z.object({
  data: z.object({
    plan: planPagoItemSchema,
    cuotas: z.array(planCuotaItemSchema),
  }),
});

export const planesPagoResponseSchema = z.object({
  data: z.array(planPagoItemSchema),
});

export const planCuotasResponseSchema = z.object({
  data: z.array(planCuotaItemSchema),
});

const personaMiniSchema = z.object({
  id: z.number(),
  nombre: z.string().nullable().optional(),
  apellido: z.string().nullable().optional(),
  razonSocial: z.string().nullable().optional(),
}).nullable();

const casoMiniSchema = z.object({
  id: z.number(),
  nroExpte: z.string().nullable().optional(),
  caratula: z.string().nullable().optional(),
}).nullable();

export const proyeccionCobranzaSchema = z.object({
  planId: z.number(),
  cuotaId: z.number(),
  numero: z.number(),
  vencimiento: z.string().nullable(),
  saldoPesos: z.number(),
  saldoJus: z.number().nullable().optional(),
  totalAPagarPesos: z.number(),
  estadoCodigo: z.string().nullable(),
  clienteId: z.number().nullable(),
  cliente: personaMiniSchema.optional(),
  casoId: z.number().nullable(),
  caso: casoMiniSchema.optional(),
  tipoDeudor: z.enum(["cliente", "tercero"]).optional(),
  deudorNombre: z.string().nullable().optional(),
  obligadoTerceroId: z.number().nullable().optional(),
  obligadoClienteId: z.number().nullable().optional(),
});

export const proyeccionCobranzasResponseSchema = z.object({
  data: z.array(proyeccionCobranzaSchema),
});

export const ingresoResponseSchema = z.object({
  data: ingresoItemSchema,
});

export type CreatePlanPagoInput = z.infer<typeof createPlanPagoSchema>;
export type CreateIngresoInput = z.infer<typeof createIngresoSchema>;
export type PlanPagoQuery = z.infer<typeof planPagoQuerySchema>;
