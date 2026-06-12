import { z } from "zod";
import { idParamSchema, paginationMetaSchema, paginationQuerySchema, positiveIntSchema } from "./common.schema.js";

const PERSONA_FISICA_IDS = new Set([1, 143]);
const PERSONA_JURIDICA_IDS = new Set([2, 144]);

function hasText(value?: string | null) {
  return typeof value === "string" && value.trim().length > 0;
}

function validarCuit(cuit: string): boolean {
  const limpio = cuit.replace(/[^0-9]/g, "");
  if (!/^\d{11}$/.test(limpio)) return false;
  const factores = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let suma = 0;

  for (let i = 0; i < 10; i++) {
    suma += Number.parseInt(limpio[i], 10) * factores[i];
  }

  const residuo = suma % 11;
  const verificadorCalculado = residuo === 0 ? 0 : residuo === 1 ? 9 : 11 - residuo;
  return verificadorCalculado === Number.parseInt(limpio[10], 10);
}

const clienteBaseObjectSchema = z.object({
  tipoPersonaId: positiveIntSchema,
  nombre: z.string().max(100).optional().nullable(),
  apellido: z.string().max(100).optional().nullable(),
  razonSocial: z.string().max(255).optional().nullable(),
  dni: z.string().max(50).optional().nullable(),
  cuit: z.string().max(50).optional().nullable(),
  fechaNacimiento: z.string().datetime().optional().nullable(),
  email: z.string().email("Email invalido").max(255).optional().nullable(),
  telFijo: z.string().max(50).optional().nullable(),
  telCelular: z.string().max(50).optional().nullable(),
  dirCalle: z.string().max(255).optional().nullable(),
  dirNro: z.string().max(50).optional().nullable(),
  dirPiso: z.string().max(50).optional().nullable(),
  dirDepto: z.string().max(50).optional().nullable(),
  codigoPostal: z.string().max(20).optional().nullable(),
  provinciaId: positiveIntSchema.optional().nullable(),
  localidadId: positiveIntSchema.optional().nullable(),
  observaciones: z.string().optional().nullable(),
  activo: z.boolean().default(true),
}).strict();

function validateCuitIfPresent<T extends { cuit?: string | null }>(schema: z.ZodType<T>) {
  return schema.refine(
  (data) => {
    if (!data.cuit) return true;
    return validarCuit(data.cuit);
  },
  {
    message: "El CUIT ingresado es inválido (error en dígito verificador)",
    path: ["cuit"],
  }
);
}

function validateTipoPersonaConsistency<T extends { tipoPersonaId?: number; nombre?: string | null; apellido?: string | null; razonSocial?: string | null }>(schema: z.ZodType<T>) {
  return schema.refine(
    (data) => {
      if (data.tipoPersonaId === undefined) return true;

      if (PERSONA_FISICA_IDS.has(data.tipoPersonaId)) {
        return hasText(data.nombre) && hasText(data.apellido) && !hasText(data.razonSocial);
      }

      if (PERSONA_JURIDICA_IDS.has(data.tipoPersonaId)) {
        return hasText(data.razonSocial) && !hasText(data.nombre) && !hasText(data.apellido);
      }

      return true;
    },
    {
      message: "Campos inválidos para el tipo de persona seleccionado",
      path: ["tipoPersonaId"],
    }
  );
}

export const clienteBaseSchema = validateCuitIfPresent(clienteBaseObjectSchema);

export const createClienteSchema = validateTipoPersonaConsistency(validateCuitIfPresent(clienteBaseObjectSchema));

export const updateClienteSchema = validateTipoPersonaConsistency(validateCuitIfPresent(clienteBaseObjectSchema.partial()));

export const clienteItemSchema = clienteBaseObjectSchema.extend({
  id: z.number(),
  estudioId: z.number(),
  driveFolderId: z.string().nullable(),
  createdAt: z.string(),
  createdBy: z.number().nullable(),
  updatedAt: z.string().nullable(),
  updatedBy: z.number().nullable(),
  deletedAt: z.string().nullable(),
  deletedBy: z.number().nullable(),
  casosActivos: z.number().optional(),
  concepto: z.object({
    id: z.number().nullable(),
    codigo: z.string().nullable(),
    nombre: z.string().nullable(),
  }).nullable().optional(),
  estado: z.object({
    id: z.number().nullable(),
    codigo: z.string().nullable(),
    nombre: z.string().nullable(),
  }).nullable().optional(),
});

export const contactoClienteParamsSchema = z.object({
  id: positiveIntSchema,
  contactoId: positiveIntSchema,
}).strict();

export const contactoClienteBaseSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio").max(255),
  rol: z.string().trim().max(100).optional().nullable(),
  email: z.string().trim().email("Email invalido").max(255).optional().nullable(),
  telefono: z.string().trim().max(50).optional().nullable(),
  observaciones: z.string().trim().optional().nullable(),
  activo: z.boolean().default(true),
}).strict();

export const createContactoClienteSchema = contactoClienteBaseSchema;
export const updateContactoClienteSchema = contactoClienteBaseSchema.partial();

export const contactoClienteItemSchema = contactoClienteBaseSchema.extend({
  id: z.number(),
  clienteId: z.number(),
  createdAt: z.string(),
  createdBy: z.number().nullable(),
  updatedAt: z.string().nullable(),
  updatedBy: z.number().nullable(),
  deletedAt: z.string().nullable(),
  deletedBy: z.number().nullable(),
});

export const contactoClienteResponseSchema = z.object({
  data: contactoClienteItemSchema,
});

const casoResumenSchema = z.object({
  id: z.number(),
  estudioId: z.number(),
  clienteId: z.number(),
  nroExpte: z.string().nullable(),
  nroExpteNorm: z.string().nullable(),
  caratula: z.string().nullable(),
  tipoId: z.number(),
  descripcion: z.string().nullable(),
  estadoId: z.number().nullable(),
  fechaEstado: z.string(),
  radicacionId: z.number().nullable(),
  estadoRadicacionId: z.number().nullable(),
  fechaEstadoRadicacion: z.string().nullable(),
  driveFolderId: z.string().nullable(),
  numeroDrive: z.number().nullable(),
  activo: z.boolean(),
  createdAt: z.string(),
  createdBy: z.number().nullable(),
  updatedAt: z.string().nullable(),
  updatedBy: z.number().nullable(),
  deletedAt: z.string().nullable(),
  deletedBy: z.number().nullable(),
});

const tareaResumenSchema = z.object({
  id: z.number(),
  estudioId: z.number(),
  titulo: z.string(),
  descripcion: z.string().nullable(),
  fechaLimite: z.string().nullable(),
  prioridadId: z.number().nullable(),
  recordatorio: z.string().nullable(),
  completada: z.boolean(),
  completadaAt: z.string().nullable(),
  asignadoA: z.number().nullable(),
  clienteId: z.number().nullable(),
  casoId: z.number().nullable(),
  recordatorioEnviado: z.boolean(),
  activo: z.boolean(),
  createdBy: z.number().nullable(),
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
  updatedBy: z.number().nullable(),
  deletedAt: z.string().nullable(),
  deletedBy: z.number().nullable(),
});

const eventoResumenSchema = z.object({
  id: z.number(),
  estudioId: z.number(),
  casoId: z.number().nullable(),
  clienteId: z.number().nullable(),
  fechaInicio: z.string(),
  fechaFin: z.string().nullable(),
  allDay: z.boolean(),
  tipoId: z.number(),
  estadoId: z.number().nullable(),
  descripcion: z.string().nullable(),
  observaciones: z.string().nullable(),
  recordatorio: z.string().nullable(),
  recordatorioEnviado: z.boolean(),
  ubicacion: z.string().nullable(),
  activo: z.boolean(),
  createdBy: z.number().nullable(),
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
  updatedBy: z.number().nullable(),
  deletedAt: z.string().nullable(),
  deletedBy: z.number().nullable(),
});

const honorarioResumenSchema = z.object({
  id: z.number(),
  estudioId: z.number(),
  clienteId: z.number().nullable(),
  casoId: z.number().nullable(),
  conceptoId: z.number(),
  parteId: z.number(),
  jus: z.string().nullable(),
  montoPesos: z.string().nullable(),
  monedaId: z.number().nullable(),
  valorJusRef: z.string().nullable(),
  politicaJusId: z.number().nullable(),
  fechaRegulacion: z.string(),
  fechaVencimiento: z.string().nullable(),
  tasaInteresMensual: z.string().nullable(),
  estadoId: z.number().nullable(),
  // Capital cobrado por cobro directo + si tiene plan activo. Sin estos campos en el schema,
  // Fastify los descartaba de la respuesta y el detalle calculaba el saldo sobre el bruto.
  montoCobrado: z.union([z.string(), z.number()]).nullable().optional(),
  tienePlan: z.boolean().optional(),
  estado: z.object({
    id: z.number().nullable(),
    codigo: z.string().nullable(),
    nombre: z.string().nullable(),
  }).nullable().optional(),
  concepto: z.object({
    id: z.number().nullable(),
    codigo: z.string().nullable(),
    nombre: z.string().nullable(),
  }).nullable().optional(),
  activo: z.boolean(),
  createdBy: z.number().nullable(),
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
  updatedBy: z.number().nullable(),
  deletedAt: z.string().nullable(),
  deletedBy: z.number().nullable(),
});

const gastoResumenSchema = z.object({
  id: z.number(),
  estudioId: z.number(),
  clienteId: z.number(),
  casoId: z.number().nullable(),
  conceptoId: z.number().nullable(),
  descripcion: z.string().nullable(),
  fechaGasto: z.string(),
  monto: z.string(),
  monedaId: z.number().nullable(),
  cotizacionArs: z.string().nullable(),
  estadoId: z.number().nullable(),
  activo: z.boolean(),
  createdAt: z.string(),
  createdBy: z.number().nullable(),
  updatedAt: z.string().nullable(),
  updatedBy: z.number().nullable(),
  deletedAt: z.string().nullable(),
  deletedBy: z.number().nullable(),
});

const ingresoResumenSchema = z.object({
  id: z.number(),
  estudioId: z.number(),
  clienteId: z.number().nullable(),
  casoId: z.number().nullable(),
  cuotaId: z.number().nullable(),
  descripcion: z.string().nullable(),
  monto: z.string(),
  monedaId: z.number().nullable(),
  cotizacionArs: z.string().nullable(),
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

const notaClienteResumenSchema = z.object({
  id: z.number(),
  clienteId: z.number(),
  estudioId: z.number(),
  contenido: z.string(),
  createdAt: z.string(),
  createdBy: z.number().nullable(),
});

export const clienteDetalleResponseSchema = z.object({
  data: z.object({
    cliente: clienteItemSchema.extend({
      contactos: z.array(contactoClienteItemSchema),
    }),
    casos: z.array(casoResumenSchema),
    tareas: z.array(tareaResumenSchema),
    eventos: z.array(eventoResumenSchema),
    honorarios: z.array(honorarioResumenSchema),
    gastos: z.array(gastoResumenSchema),
    ingresos: z.array(ingresoResumenSchema),
    notas: z.array(notaClienteResumenSchema),
  }),
});

export const clienteResponseSchema = z.object({
  data: clienteItemSchema,
});

const cuentaCorrienteRowSchema = z.object({
  tipo: z.enum(["HONORARIO", "GASTO", "INGRESO", "INTERES", "AJUSTE"]),
  refId: z.number().nullable(),
  fecha: z.string(),
  descripcion: z.string(),
  moneda: z.enum(["ARS", "JUS"]),
  cantidadJus: z.number().nullable(),
  esEstimado: z.boolean(),
  debe: z.number(),
  haber: z.number(),
  saldo: z.number(),
});

const cuentaCorrienteTotalesSchema = z.object({
  capitalPesos: z.number(),
  interesPesos: z.number(),
  saldoPesos: z.number(),
  saldoJus: z.number(),
  honorariosPesos: z.number(),
  gastosPesos: z.number(),
  ingresosPesos: z.number(),
  honorariosPendientesPesos: z.number(),
});

export const cuentaCorrienteResponseSchema = z.object({
  data: z.object({
    rows: z.array(cuentaCorrienteRowSchema),
    totales: cuentaCorrienteTotalesSchema,
    fechaCorte: z.string(),
    valorJusActual: z.number(),
  }),
});

export const cuentaCorrienteResumenResponseSchema = z.object({
  data: z.array(z.object({
    clienteId: z.number(),
    totales: cuentaCorrienteTotalesSchema,
  })),
});

export const clienteListResponseSchema = z.object({
  data: z.object({
    items: z.array(clienteItemSchema),
    meta: paginationMetaSchema,
  }),
});

export const clienteQuerySchema = z.object({
  ...paginationQuerySchema.shape,
  search: z.string().optional(),
}).strict();

export { idParamSchema };

export type CreateClienteInput = z.infer<typeof createClienteSchema>;
export type UpdateClienteInput = z.infer<typeof updateClienteSchema>;
export type CreateContactoClienteInput = z.infer<typeof createContactoClienteSchema>;
export type UpdateContactoClienteInput = z.infer<typeof updateContactoClienteSchema>;
