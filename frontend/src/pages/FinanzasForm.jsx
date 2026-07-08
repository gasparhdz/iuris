import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { NumericFormat } from "react-number-format";
import { alpha, useTheme } from "@mui/material/styles";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";

const MotionDiv = motion.div;
import api from "../api/axios";
import { fetchAllPages } from "../api/pagination";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  LinearProgress,
  Checkbox,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  FormControl,
  FormHelperText,
  FormControlLabel,
  InputAdornment,
  InputLabel,
  IconButton,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import {
  AccountBalanceWallet,
  ArrowBack,
  CalendarMonth,
  ExpandLess,
  ExpandMore,
  Payments,
  ReceiptLong,
  Save,
} from "@mui/icons-material";
import {
  dateInputFromIso,
  ESTADO_HONORARIO_UI,
  estadoUiFromHonorario,
  findParamByCodigo,
  formatMoneyAr,
  honorarioEstadoChip,
  honorarioMontoBase,
  invalidateFinanzasQueries,
  isHonorarioPendiente,
  normalizeTipoMovimiento,
  resolveEstadoHonorarioId,
  todayInputValue,
  toIsoDateTimeLocal,
} from "./finanzasUtils";
import { casoLabel, clienteLabel, getApiError, unwrapEntity } from "./tareasUtils";

const NumericFormatCustom = React.forwardRef(function NumericFormatCustom(props, ref) {
  const { onChange, decimalScale = 2, ...other } = props;
  return (
    <NumericFormat
      {...other}
      getInputRef={ref}
      inputMode="decimal"
      onValueChange={(values) => {
        onChange({
          target: {
            value: values.value,
          },
        });
      }}
      thousandSeparator="."
      decimalSeparator=","
      decimalScale={decimalScale}
      allowNegative={false}
      valueIsNumericString
    />
  );
});

function politicaJusLabel(parametro) {
  const codigo = String(parametro?.codigo ?? "").toUpperCase();
  if (codigo === "AL_COBRO") return "Fecha de cobro";
  if (codigo === "FECHA_REGULACION") return "Fecha de regulación";
  return parametro?.nombre ?? "Política JUS";
}

function cuotaMonto(cuota) {
  if (cuota?.montoPesos != null) return Number(cuota.montoPesos);
  if (cuota?.montoJus != null && cuota?.valorJusRef != null) {
    return Number(cuota.montoJus) * Number(cuota.valorJusRef);
  }
  return 0;
}

function cuotaMontoDisplay(cuota) {
  const estado = String(cuota?.estadoCodigo ?? "").toUpperCase();
  const saldo = Number(cuota?.saldoPesos ?? cuota?.saldo ?? 0);
  const cobrado = Number(cuota?.montoCobrado ?? 0);
  if ((estado === "PAGADA" || saldo <= 0.01) && cobrado > 0) return cobrado;
  return cuotaMonto(cuota);
}

function cuotaEstadoChip(cuota) {
  const estado = String(cuota?.estadoCodigo ?? "").toUpperCase();
  if (estado === "PAGADA") return { label: "Pagada", color: "success" };
  if (estado === "VENCIDA") return { label: "Vencida", color: "error" };
  if (estado === "PARCIAL") return { label: "Parcial", color: "info" };
  if (estado === "CONDONADA") return { label: "Condonada", color: "default" };

  const saldo = Number(cuota?.saldo ?? 0);
  const cobrado = Number(cuota?.montoCobrado ?? 0);
  if (saldo <= 0.01 && cuotaMonto(cuota) > 0) return { label: "Pagada", color: "success" };
  if (cobrado > 0) return { label: "Parcial", color: "info" };
  return { label: "Pendiente", color: "warning" };
}

function formatIsoDateShort(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

const EMPTY_FORM = {
  clienteId: "",
  casoId: "",
  monedaCodigo: "JUS",
  monto: "",
  conceptoId: "",
  parteId: "",
  conceptoGastoId: "",
  estadoGastoId: "",
  conceptoIngresoId: "",
  descripcion: "",
  fechaRegulacion: "",
  fechaGasto: "",
  fechaIngreso: "",
  tasaInteres: "0",
  aplicarInteres: false,
  estadoUi: "pendiente",
  crearPlanPago: false,
  honorarioVinculoId: "",
  cuotaVinculoId: "",
  selectedCuotaIds: [],
  selectedGastoIds: [],
  selectedHonorarioIds: [],
  planVinculoId: "",
  gastoVinculoId: "",
  convenioHonorarioId: "",
  convenioPeriodicidad: "",
  convenioCuotas: "",
  convenioMontoCuota: "",
  convenioFechaInicio: "",
  convenioDescripcion: "",
  tasaInteresMensual: "",
  diaVencimiento: "",
  politicaJusId: "",
};

const REQUIRED_FIELDS = {
  honorario: ["clienteId", "conceptoId", "parteId", "monedaCodigo", "monto", "fechaRegulacion"],
  gasto:     ["clienteId", "monedaCodigo", "monto", "fechaGasto"],
  ingreso:   ["clienteId", "monedaCodigo", "monto", "fechaIngreso"],
  convenio:  ["convenioHonorarioId", "convenioPeriodicidad", "convenioCuotas", "convenioMontoCuota", "convenioFechaInicio"],
};

export default function FinanzasForm() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { tipo: tipoParam, id: editId } = useParams();
  const [searchParams] = useSearchParams();

  const isEdit = Boolean(editId && tipoParam);
  const lockClienteId = searchParams.get("clienteId");
  const lockCasoId = searchParams.get("casoId");
  const queryHonorarioId = searchParams.get("honorarioId");
  const queryCuotaId = searchParams.get("cuotaId");
  const queryGastoId = searchParams.get("gastoId");
  const queryPlanId = searchParams.get("planId");
  const queryMonto = searchParams.get("monto");

  const initialTipo = isEdit
    ? normalizeTipoMovimiento(tipoParam)
    : normalizeTipoMovimiento(searchParams.get("tipo"));
  const initialMonedaCodigo = initialTipo === "gasto" || initialTipo === "ingreso" ? "ARS" : "JUS";

  const [tipoMovimiento, setTipoMovimiento] = useState(initialTipo);

  // Ref para valores JUS — evita dependencia circular con queries que necesitan `form`
  const jusRef = useRef({ regulacion: 0, gasto: 0, ingreso: 0 });

  // Schemas Zod para validación por tipo de movimiento
  const honorarioSchema = useMemo(() => {
    return z.object({
      clienteId: z.string().min(1, "Seleccioná un cliente"),
      casoId: z.string().optional(),
      conceptoId: z.string().min(1, "Seleccioná un concepto"),
      parteId: z.string().min(1, "Seleccioná el obligado al pago"),
      estadoUi: z.string().optional(),
      monedaCodigo: z.string(),
      monto: z.union([z.number(), z.string(), z.null()]),
      fechaRegulacion: z.string().min(1, "Indicá la fecha de regulación"),
      politicaJusId: z.string().optional(),
      aplicarInteres: z.boolean().optional(),
      tasaInteres: z.union([z.number(), z.string(), z.null()]).optional(),
      crearPlanPago: z.boolean().optional(),
      convenioPeriodicidad: z.string().optional(),
      convenioCuotas: z.union([z.number(), z.string(), z.null()]).optional(),
      convenioMontoCuota: z.union([z.number(), z.string(), z.null()]).optional(),
      convenioFechaInicio: z.string().optional(),
      diaVencimiento: z.union([z.number(), z.string(), z.null()]).optional(),
      convenioDescripcion: z.string().optional(),
    }).superRefine((data, ctx) => {
      const montoNum = Number(data.monto);
      const isJus = data.monedaCodigo === "JUS";
      if (Number.isNaN(montoNum) || montoNum <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["monto"],
          message: isJus ? "Ingresá una cantidad de JUS válida" : "Ingresá un monto válido",
        });
      }
      if (data.fechaRegulacion) {
        const regDate = new Date(`${data.fechaRegulacion}T00:00:00`);
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        if (regDate > today) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["fechaRegulacion"],
            message: "La fecha de regulación no puede ser futura",
          });
        }
      }
      if (isJus) {
        if (!data.politicaJusId) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["politicaJusId"],
            message: "Seleccioná la política de actualización",
          });
        }
        const valJus = Number(jusRef.current.regulacion || 0);
        if (valJus <= 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["fechaRegulacion"],
            message: "No hay valor de JUS cargado para esa fecha. Cargá el valor histórico antes de continuar.",
          });
        }
      }
      if (data.aplicarInteres) {
        const tasa = Number(data.tasaInteres);
        if (Number.isNaN(tasa) || tasa <= 0 || tasa > 100) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["tasaInteres"],
            message: "El interés debe estar entre 0.01% y 100%",
          });
        }
      }
      if (!isEdit && data.crearPlanPago) {
        if (!data.convenioPeriodicidad) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["convenioPeriodicidad"],
            message: "Seleccioná la periodicidad",
          });
        }
        const cuotas = Number(data.convenioCuotas);
        if (Number.isNaN(cuotas) || cuotas < 1) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["convenioCuotas"],
            message: "Mínimo 1 cuota",
          });
        }
        const montoCuota = Number(data.convenioMontoCuota);
        if (Number.isNaN(montoCuota) || montoCuota <= 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["convenioMontoCuota"],
            message: "Ingresá un monto válido",
          });
        }
        if (!data.convenioFechaInicio) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["convenioFechaInicio"],
            message: "Indicá la fecha de inicio",
          });
        }
        if (data.diaVencimiento) {
          const dia = Number(data.diaVencimiento);
          if (!Number.isInteger(dia) || dia < 1 || dia > 31) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["diaVencimiento"],
              message: "Usá un día entre 1 y 31",
            });
          }
        }
      }
    });
  }, [isEdit]);

  const gastoSchema = useMemo(() => {
    return z.object({
      clienteId: z.string().min(1, "Seleccioná un cliente"),
      casoId: z.string().optional(),
      conceptoGastoId: z.string().optional(),
      estadoGastoId: z.string().min(1, "Seleccioná un estado"),
      monedaCodigo: z.string(),
      monto: z.union([z.number(), z.string(), z.null()]),
      fechaGasto: z.string().min(1, "Indicá la fecha de gasto"),
      descripcion: z.string().optional(),
    }).superRefine((data, ctx) => {
      const montoNum = Number(data.monto);
      const isJus = data.monedaCodigo === "JUS";
      if (Number.isNaN(montoNum) || montoNum <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["monto"],
          message: isJus ? "Ingresá una cantidad de JUS válida" : "Ingresá un monto válido",
        });
      }
      if (isJus) {
        const valJus = Number(jusRef.current.gasto || 0);
        if (valJus <= 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["fechaGasto"],
            message: "No hay valor de JUS cargado para esa fecha. Cargá el valor histórico antes de continuar.",
          });
        }
      }
    });
  }, []);

  const ingresoSchema = useMemo(() => {
    return z.object({
      clienteId: z.string().min(1, "Seleccioná un cliente"),
      casoId: z.string().optional(),
      conceptoIngresoId: z.string().optional(),
      monedaCodigo: z.string(),
      monto: z.union([z.number(), z.string(), z.null()]),
      fechaIngreso: z.string().min(1, "Indicá la fecha de ingreso"),
      descripcion: z.string().optional(),
      selectedCuotaIds: z.array(z.number()).optional(),
      selectedGastoIds: z.array(z.number()).optional(),
      selectedHonorarioIds: z.array(z.number()).optional(),
    }).superRefine((data, ctx) => {
      const montoNum = Number(data.monto);
      const isJus = data.monedaCodigo === "JUS";
      if (Number.isNaN(montoNum) || montoNum <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["monto"],
          message: isJus ? "Ingresá una cantidad de JUS válida" : "Ingresá un monto válido",
        });
      }
      if (isJus) {
        const valJus = Number(jusRef.current.ingreso || 0);
        if (valJus <= 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["fechaIngreso"],
            message: "No hay valor de JUS cargado para esa fecha. Cargá el valor histórico antes de continuar.",
          });
        }
      }
    });
  }, []);

  const convenioSchema = useMemo(() => {
    return z.object({
      convenioHonorarioId: z.string().min(1, "Seleccioná el honorario a financiar"),
      convenioPeriodicidad: z.string().min(1, "Seleccioná la periodicidad"),
      convenioCuotas: z.union([z.number(), z.string(), z.null()]),
      convenioMontoCuota: z.union([z.number(), z.string(), z.null()]),
      convenioFechaInicio: z.string().min(1, "Indicá la fecha de inicio"),
      diaVencimiento: z.union([z.number(), z.string(), z.null()]).optional(),
      tasaInteresMensual: z.union([z.number(), z.string(), z.null()]).optional(),
      convenioDescripcion: z.string().optional(),
    }).superRefine((data, ctx) => {
      const cuotas = Number(data.convenioCuotas);
      if (Number.isNaN(cuotas) || cuotas < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["convenioCuotas"],
          message: "Mínimo 1 cuota",
        });
      }
      const montoCuota = Number(data.convenioMontoCuota);
      if (Number.isNaN(montoCuota) || montoCuota <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["convenioMontoCuota"],
          message: "Ingresá un monto válido",
        });
      }
    });
  }, []);

  const { control, handleSubmit, formState: { errors }, setValue, getValues, watch } = useForm({
    resolver: (values, context, options) => {
      const currentSchema = tipoMovimiento === "honorario" ? honorarioSchema
                           : tipoMovimiento === "gasto" ? gastoSchema
                           : tipoMovimiento === "ingreso" ? ingresoSchema
                           : convenioSchema;
      return zodResolver(currentSchema)(values, context, options);
    },
    mode: "onBlur",
    defaultValues: {
      ...EMPTY_FORM,
      monedaCodigo: initialMonedaCodigo,
      fechaRegulacion: todayInputValue(),
      fechaGasto: todayInputValue(),
      fechaIngreso: todayInputValue(),
      convenioFechaInicio: todayInputValue(),
      monto: queryMonto ?? "",
      honorarioVinculoId: queryHonorarioId ?? "",
      cuotaVinculoId: queryCuotaId ?? "",
      selectedCuotaIds: queryCuotaId ? [Number(queryCuotaId)] : [],
      selectedGastoIds: queryGastoId ? [Number(queryGastoId)] : [],
      selectedHonorarioIds: [],
      planVinculoId: queryPlanId ?? "",
      gastoVinculoId: queryGastoId ?? "",
      convenioHonorarioId: queryHonorarioId ?? "",
    }
  });

  const form = watch();

  const formProgress = useMemo(() => {
    const fields = REQUIRED_FIELDS[tipoMovimiento] ?? [];
    if (!fields.length) return 100;
    const completed = fields.filter((f) => {
      const v = form[f];
      return v !== undefined && v !== "" && v !== null;
    }).length;
    return Math.round((completed / fields.length) * 100);
  }, [form, tipoMovimiento]);

  const setForm = useCallback((updater) => {
    const current = getValues();
    const next = typeof updater === "function" ? updater(current) : updater;
    Object.entries(next).forEach(([key, val]) => {
      if (current[key] !== val) {
        setValue(key, val, { shouldValidate: false });
      }
    });
  }, [getValues, setValue]);
  const [honorariosIngresoExpanded, setHonorariosIngresoExpanded] = useState(true);
  const [gastosIngresoExpanded, setGastosIngresoExpanded] = useState(true);
  const [honorariosDirectosExpanded, setHonorariosDirectosExpanded] = useState(true);

  const catalogQuery = useQuery({
    queryKey: ["catalogos", "finanzas-form"],
    queryFn: async () => {
      const cats = [
        "CONCEPTO_HONORARIO",
        "CONCEPTO_GASTO",
        "CONCEPTO_INGRESO",
        "MONEDA",
        "ESTADO_GASTO",
        "ESTADO_HONORARIO",
        "ESTADO_INGRESO",
        "PARTES",
        "PERIODICIDAD",
        "POLITICA_JUS",
      ];
      const entries = await Promise.all(
        cats.map(async (categoria) => {
          const { data } = await api.get("/catalogos/parametros", { params: { categoria } });
          const raw = data?.data ?? data;
          return [categoria, Array.isArray(raw) ? raw : []];
        }),
      );
      return Object.fromEntries(entries);
    },
    staleTime: 1000 * 60 * 30,
  });

  const clientesQuery = useQuery({
    queryKey: ["clientes", "autocomplete"],
    queryFn: () => fetchAllPages("/clientes"),
  });

  const expedientesQuery = useQuery({
    queryKey: ["expedientes", "autocomplete"],
    queryFn: () => fetchAllPages("/expedientes"),
  });

  const valorJusQuery = useQuery({
    queryKey: ["valorjus", "actual"],
    queryFn: async () => {
      const { data } = await api.get("/valorjus/actual");
      return data?.data ?? data ?? null;
    },
  });

  const valorJusRegulacionQuery = useQuery({
    queryKey: ["valorjus", "regulacion", form.fechaRegulacion],
    enabled: Boolean(form.fechaRegulacion),
    queryFn: async () => {
      const { data } = await api.get("/valorjus/actual", {
        params: { fecha: form.fechaRegulacion },
      });
      return data?.data ?? data ?? null;
    },
  });

  const valorJusGastoQuery = useQuery({
    queryKey: ["valorjus", "gasto", form.fechaGasto],
    enabled: Boolean(form.fechaGasto) && form.monedaCodigo === "JUS" && tipoMovimiento === "gasto",
    queryFn: async () => {
      const { data } = await api.get("/valorjus/historico", {
        params: { fecha: form.fechaGasto },
      });
      return data?.data ?? data ?? null;
    },
  });

  const valorJusIngresoQuery = useQuery({
    queryKey: ["valorjus", "ingreso", form.fechaIngreso],
    enabled: Boolean(form.fechaIngreso) && form.monedaCodigo === "JUS" && tipoMovimiento === "ingreso",
    queryFn: async () => {
      const { data } = await api.get("/valorjus/historico", {
        params: { fecha: form.fechaIngreso },
      });
      return data?.data ?? data ?? null;
    },
  });

  // Mantener el ref sincronizado con los valores JUS actuales para los schemas
  jusRef.current.regulacion = valorJusRegulacionQuery.data?.valor ?? 0;
  jusRef.current.gasto = valorJusGastoQuery.data?.valor ?? 0;
  jusRef.current.ingreso = valorJusIngresoQuery.data?.valor ?? 0;

  const entityQuery = useQuery({
    queryKey: ["finanzas-form", tipoParam, editId, location.state?.item?.id],
    enabled: isEdit,
    queryFn: async () => {
      if (location.state?.item && Number(location.state.item.id) === Number(editId)) {
        return location.state.item;
      }
      const tipo = normalizeTipoMovimiento(tipoParam);
      if (tipo === "honorario") {
        const { data } = await api.get(`/honorarios/${editId}`);
        return unwrapEntity(data);
      }
      const path = tipo === "gasto" ? "gastos" : "ingresos";
      const items = await fetchAllPages(`/${path}`);
      const found = items.find((row) => Number(row.id) === Number(editId));
      if (!found) throw new Error("NOT_FOUND");
      return found;
    },
  });



  const clienteIdForHonorarios = form.clienteId || lockClienteId;
  const honorariosPendientesQuery = useQuery({
    queryKey: ["honorarios", "pendientes", clienteIdForHonorarios, form.casoId],
    enabled: (tipoMovimiento === "ingreso" || tipoMovimiento === "convenio") && Boolean(clienteIdForHonorarios),
    queryFn: async () => {
      const items = await fetchAllPages("/honorarios", {
        clienteId: clienteIdForHonorarios,
        casoId: form.casoId || lockCasoId || undefined,
      });
      return items.filter(isHonorarioPendiente);
    },
  });

  const planesIngresoQuery = useQuery({
    queryKey: ["planes", "ingreso-form", form.clienteId, form.casoId],
    enabled: tipoMovimiento === "ingreso" && Boolean(form.clienteId),
    queryFn: async () => {
      const params = { clienteId: form.clienteId };
      if (form.casoId) params.casoId = form.casoId;
      const { data } = await api.get("/planes", { params });
      const raw = data?.data ?? data;
      return Array.isArray(raw) ? raw : [];
    },
    staleTime: 60_000,
  });

  const gastosIngresoQuery = useQuery({
    queryKey: ["gastos", "ingreso-form", form.clienteId || lockClienteId, form.casoId || lockCasoId],
    enabled: tipoMovimiento === "ingreso" && Boolean(form.clienteId || lockClienteId),
    queryFn: async () => {
      const params = {
        clienteId: form.clienteId || lockClienteId,
      };
      if (form.casoId || lockCasoId) params.casoId = form.casoId || lockCasoId;
      return fetchAllPages("/gastos", params);
    },
    staleTime: 60_000,
  });

  const planesIngreso = useMemo(() => {
    const rows = planesIngresoQuery.data ?? [];
    if (!form.honorarioVinculoId) return rows;
    return rows.filter((plan) => Number(plan.honorarioId) === Number(form.honorarioVinculoId));
  }, [planesIngresoQuery.data, form.honorarioVinculoId]);

  const cuotasIngresoQueries = useQueries({
    queries: planesIngreso.map((plan) => ({
      queryKey: ["planes", plan.id, "cuotas", "ingreso-form"],
      enabled: tipoMovimiento === "ingreso",
      queryFn: async () => {
        const { data } = await api.get(`/planes/${plan.id}/cuotas`);
        const raw = data?.data ?? data;
        return Array.isArray(raw) ? raw : [];
      },
      staleTime: 60_000,
    })),
  });

  const cuotasByPlanId = useMemo(() => {
    const map = new Map();
    planesIngreso.forEach((plan, index) => {
      map.set(plan.id, cuotasIngresoQueries[index]?.data ?? []);
    });
    return map;
  }, [planesIngreso, cuotasIngresoQueries]);

  const cuotasSeleccionables = useMemo(() => {
    return planesIngreso.flatMap((plan) => (cuotasByPlanId.get(plan.id) ?? []).map((cuota) => ({ ...cuota, plan })));
  }, [planesIngreso, cuotasByPlanId]);

  const clientes = useMemo(() => clientesQuery.data ?? [], [clientesQuery.data]);
  const expedientes = useMemo(() => expedientesQuery.data ?? [], [expedientesQuery.data]);
  const catalog = useMemo(() => catalogQuery.data ?? {}, [catalogQuery.data]);
  const valorJusActual = Number(valorJusQuery.data?.valor ?? 0);
  const valorJusRegulacion = Number(valorJusRegulacionQuery.data?.valor ?? valorJusActual);
  const valorJusGasto = Number(valorJusGastoQuery.data?.valor ?? valorJusActual);
  const valorJusIngreso = Number(valorJusIngresoQuery.data?.valor ?? valorJusActual);

  const selectedCliente = clientes.find((c) => Number(c.id) === Number(form.clienteId)) ?? null;
  const filteredExpedientes = useMemo(() => {
    if (!form.clienteId) return [];
    return expedientes.filter((e) => Number(e.clienteId) === Number(form.clienteId));
  }, [expedientes, form.clienteId]);
  const selectedCaso = expedientes.find((c) => Number(c.id) === Number(form.casoId)) ?? null;

  const isJus = form.monedaCodigo === "JUS";
  const isUsd = form.monedaCodigo === "USD";
  const selectedPolitica = (catalog.POLITICA_JUS ?? []).find(
    (p) => String(p.id) === String(form.politicaJusId)
  );
  const isAlCobro = isJus && selectedPolitica?.codigo === "AL_COBRO";

  const montoNum = Number(form.monto) || 0;
  const importeIngresoArs = tipoMovimiento === "ingreso" && form.monedaCodigo === "JUS"
    ? montoNum * valorJusIngreso
    : montoNum;
  const selectedCuotas = useMemo(
    () => cuotasSeleccionables.filter((cuota) => form.selectedCuotaIds.includes(Number(cuota.id))),
    [cuotasSeleccionables, form.selectedCuotaIds],
  );
  const conceptoGastoById = useMemo(() => {
    return new Map((catalog.CONCEPTO_GASTO ?? []).map((item) => [Number(item.id), item]));
  }, [catalog.CONCEPTO_GASTO]);
  const estadoGastoById = useMemo(() => {
    return new Map((catalog.ESTADO_GASTO ?? []).map((item) => [Number(item.id), item]));
  }, [catalog.ESTADO_GASTO]);
  const gastosPendientesIngreso = useMemo(() => {
    const rows = gastosIngresoQuery.data ?? [];
    return rows
      .filter((gasto) => {
        const estado = estadoGastoById.get(Number(gasto.estadoId));
        const codigo = String(estado?.codigo ?? "").toUpperCase();
        return codigo === "PENDIENTE" || form.selectedGastoIds.includes(Number(gasto.id));
      })
      .sort((a, b) => new Date(a.fechaGasto).getTime() - new Date(b.fechaGasto).getTime());
  }, [gastosIngresoQuery.data, estadoGastoById, form.selectedGastoIds]);
  const selectedGastos = useMemo(
    () => gastosPendientesIngreso.filter((gasto) => form.selectedGastoIds.includes(Number(gasto.id))),
    [gastosPendientesIngreso, form.selectedGastoIds],
  );
  const selectableIngresoCuotas = useMemo(
    () => cuotasSeleccionables.filter((cuota) => !["PAGADA", "CONDONADA"].includes(String(cuota.estadoCodigo ?? "").toUpperCase())),
    [cuotasSeleccionables],
  );
  const allIngresoCuotasSelected = selectableIngresoCuotas.length > 0
    && selectableIngresoCuotas.every((cuota) => form.selectedCuotaIds.includes(Number(cuota.id)));
  const someIngresoCuotasSelected = selectableIngresoCuotas.some((cuota) => form.selectedCuotaIds.includes(Number(cuota.id)));
  const totalHonorariosIngreso = useMemo(
    () => planesIngreso.reduce((acc, plan) => acc + Number(plan.totalHonorarioArs ?? 0), 0),
    [planesIngreso],
  );
  const totalCuotasSeleccionadas = useMemo(
    () => selectedCuotas.reduce((acc, cuota) => acc + Number(cuota.totalAPagarPesos ?? cuota.saldoPesos ?? cuota.saldo ?? 0), 0),
    [selectedCuotas],
  );
  const gastoSimulation = useMemo(() => {
    let restante = importeIngresoArs;
    return selectedGastos
      .slice()
      .sort((a, b) => new Date(a.fechaGasto).getTime() - new Date(b.fechaGasto).getTime())
      .map((gasto) => {
        const saldo = Number(gasto.monto ?? 0);
        const aplicado = Math.min(Math.max(restante, 0), saldo);
        restante -= aplicado;
        return {
          id: Number(gasto.id),
          aplicado,
          saldoRestante: Math.max(0, saldo - aplicado),
          cancelado: saldo > 0 && saldo - aplicado <= 0.0001,
        };
      });
  }, [importeIngresoArs, selectedGastos]);
  const gastoSimulationById = useMemo(() => {
    return new Map(gastoSimulation.map((item) => [item.id, item]));
  }, [gastoSimulation]);
  const totalGastosSeleccionados = useMemo(
    () => selectedGastos.reduce((acc, gasto) => acc + Number(gasto.monto ?? 0), 0),
    [selectedGastos],
  );
  // Honorarios que cobran de forma directa (sin plan de pago activo). Un honorario con plan
  // se cobra por sus cuotas (seccion "Honorarios" de arriba), nunca por las dos vias.
  const honorarioIdsConPlan = useMemo(
    () => new Set((planesIngresoQuery.data ?? []).map((plan) => Number(plan.honorarioId))),
    [planesIngresoQuery.data],
  );
  const honorariosSinPlanIngreso = useMemo(() => {
    const rows = honorariosPendientesQuery.data ?? [];
    return rows
      .filter((h) => !honorarioIdsConPlan.has(Number(h.id)) || form.selectedHonorarioIds.includes(Number(h.id)))
      .sort((a, b) => {
        const va = new Date(a.fechaVencimiento ?? a.fechaRegulacion).getTime();
        const vb = new Date(b.fechaVencimiento ?? b.fechaRegulacion).getTime();
        return va - vb;
      });
  }, [honorariosPendientesQuery.data, honorarioIdsConPlan, form.selectedHonorarioIds]);
  const selectedHonorariosDirectos = useMemo(
    () => honorariosSinPlanIngreso.filter((h) => form.selectedHonorarioIds.includes(Number(h.id))),
    [honorariosSinPlanIngreso, form.selectedHonorarioIds],
  );
  const totalHonorariosDirectosSeleccionados = useMemo(
    () => selectedHonorariosDirectos.reduce((acc, h) => acc + Number(honorarioMontoBase(h) ?? 0), 0),
    [selectedHonorariosDirectos],
  );
  const totalSeleccionadoIngreso = totalCuotasSeleccionadas + totalGastosSeleccionados + totalHonorariosDirectosSeleccionados;
  const disponibleIngreso = Math.max(0, importeIngresoArs - totalSeleccionadoIngreso);

  useEffect(() => {
    if (tipoMovimiento !== "ingreso") return;
    if (planesIngresoQuery.isLoading || cuotasIngresoQueries.some((query) => query.isLoading)) return;
    const visibleIds = new Set(cuotasSeleccionables.map((cuota) => Number(cuota.id)));
    setForm((f) => {
      const nextSelected = f.selectedCuotaIds.filter((id) => visibleIds.has(Number(id)));
      if (nextSelected.length === f.selectedCuotaIds.length) return f;
      return { ...f, selectedCuotaIds: nextSelected, cuotaVinculoId: nextSelected[0] ? String(nextSelected[0]) : "" };
    });
  }, [cuotasIngresoQueries, cuotasSeleccionables, planesIngresoQuery.isLoading, tipoMovimiento, setForm]);

  useEffect(() => {
    if (tipoMovimiento !== "ingreso" || gastosIngresoQuery.isLoading) return;
    const visibleIds = new Set(gastosPendientesIngreso.map((gasto) => Number(gasto.id)));
    setForm((f) => {
      const nextSelected = f.selectedGastoIds.filter((id) => visibleIds.has(Number(id)));
      if (nextSelected.length === f.selectedGastoIds.length) return f;
      return { ...f, selectedGastoIds: nextSelected, gastoVinculoId: nextSelected[0] ? String(nextSelected[0]) : "" };
    });
  }, [gastosIngresoQuery.isLoading, gastosPendientesIngreso, tipoMovimiento, setForm]);

  useEffect(() => {
    if (tipoMovimiento !== "ingreso" || honorariosPendientesQuery.isLoading) return;
    const visibleIds = new Set(honorariosSinPlanIngreso.map((h) => Number(h.id)));
    setForm((f) => {
      const nextSelected = f.selectedHonorarioIds.filter((id) => visibleIds.has(Number(id)));
      if (nextSelected.length === f.selectedHonorarioIds.length) return f;
      return { ...f, selectedHonorarioIds: nextSelected };
    });
  }, [honorariosPendientesQuery.isLoading, honorariosSinPlanIngreso, tipoMovimiento, setForm]);

  const selectedConvenioHonorario = (honorariosPendientesQuery.data ?? []).find(
    (h) => String(h.id) === String(form.convenioHonorarioId),
  );
  const isConvenioHonorarioJus = Number(selectedConvenioHonorario?.jus) > 0;
  const convenioInheritedPoliticaJusId = selectedConvenioHonorario?.politicaJusId;
  const politicaJusOptions = catalog.POLITICA_JUS ?? [];
  const idPeriodicidadMensual = (catalog.PERIODICIDAD ?? []).find((p) => String(p.codigo).toUpperCase() === "MENSUAL")?.id;
  useEffect(() => {
    if (!isEdit) {
      setTipoMovimiento(normalizeTipoMovimiento(searchParams.get("tipo")));
    }
  }, [isEdit, searchParams]);

  useEffect(() => {
    if (!isEdit) {
      setForm((f) => ({
        ...f,
        monedaCodigo: tipoMovimiento === "gasto" || tipoMovimiento === "ingreso" ? "ARS" : "JUS",
      }));
    }
  }, [isEdit, tipoMovimiento, setForm]);

  useEffect(() => {
    if (lockClienteId && clientes.length) {
      setForm((f) => ({ ...f, clienteId: String(lockClienteId) }));
    }
    if (lockCasoId && expedientes.length) {
      setForm((f) => ({ ...f, casoId: String(lockCasoId) }));
    }
  }, [lockClienteId, lockCasoId, clientes.length, expedientes.length, setForm]);

  useEffect(() => {
    const defaultPolitica = findParamByCodigo(catalog.POLITICA_JUS, ["AL_COBRO"]);
    setForm((f) => ({
      ...f,
      politicaJusId: defaultPolitica?.id ? (f.politicaJusId || String(defaultPolitica.id)) : f.politicaJusId,
    }));
  }, [catalog.POLITICA_JUS, setForm]);

  useEffect(() => {
    if (form.monedaCodigo === "JUS" && catalog.POLITICA_JUS?.length && !form.politicaJusId) {
      const defaultPolitica = findParamByCodigo(catalog.POLITICA_JUS, ["AL_COBRO"]);
      if (defaultPolitica) {
        setForm((f) => ({ ...f, politicaJusId: String(defaultPolitica.id) }));
      }
    }
  }, [form.monedaCodigo, catalog.POLITICA_JUS, form.politicaJusId, setForm]);

  useEffect(() => {
    if (!idPeriodicidadMensual || form.convenioPeriodicidad) return;
    setForm((f) => ({ ...f, convenioPeriodicidad: String(idPeriodicidadMensual) }));
  }, [idPeriodicidadMensual, form.convenioPeriodicidad, setForm]);

  useEffect(() => {
    if (tipoMovimiento === "gasto" && catalog.ESTADO_GASTO?.length && !form.estadoGastoId) {
      const defaultEstado = findParamByCodigo(catalog.ESTADO_GASTO, ["PENDIENTE"]);
      if (defaultEstado) {
        setForm((f) => ({ ...f, estadoGastoId: String(defaultEstado.id) }));
      }
    }
  }, [catalog.ESTADO_GASTO, form.estadoGastoId, tipoMovimiento, setForm]);

  useEffect(() => {
    if (isEdit || tipoMovimiento !== "ingreso" || !queryGastoId) return;
    const gasto = gastosPendientesIngreso.find((item) => Number(item.id) === Number(queryGastoId));
    if (!gasto) return;

    const conceptoReintegro = findParamByCodigo(catalog.CONCEPTO_INGRESO, ["REINTEGRO_DE_GASTO"]);
    const conceptoGasto = conceptoGastoById.get(Number(gasto.conceptoId));
    const descripcionGasto = gasto.descripcion || conceptoGasto?.nombre || `#${gasto.id}`;
    setForm((f) => ({
      ...f,
      selectedGastoIds: f.selectedGastoIds.includes(Number(gasto.id)) ? f.selectedGastoIds : [Number(gasto.id)],
      gastoVinculoId: String(gasto.id),
      monto: queryMonto ?? f.monto,
      conceptoIngresoId: conceptoReintegro?.id ? String(conceptoReintegro.id) : f.conceptoIngresoId,
      descripcion: f.descripcion || `Reintegro de gasto: ${descripcionGasto}`,
    }));
  }, [catalog.CONCEPTO_INGRESO, conceptoGastoById, gastosPendientesIngreso, isEdit, queryGastoId, queryMonto, tipoMovimiento, setForm]);

  useEffect(() => {
    if (tipoMovimiento === "honorario" && isJus && isAlCobro) {
      setForm((f) => {
        if (f.aplicarInteres || f.tasaInteres !== "0") {
          return { ...f, aplicarInteres: false, tasaInteres: "0" };
        }
        return f;
      });
    }
  }, [tipoMovimiento, isJus, isAlCobro, setForm]);

  useEffect(() => {
    if (!isEdit || !entityQuery.data) return;
    const item = entityQuery.data;
    const tipo = normalizeTipoMovimiento(tipoParam);
    setTipoMovimiento(tipo);

    const base = {
      clienteId: item.clienteId ? String(item.clienteId) : "",
      casoId: item.casoId ? String(item.casoId) : "",
      monto: "",
      monedaCodigo: "ARS",
    };

    if (tipo === "honorario") {
      const jus = Number(item.jus);
      const monedas = catalog.MONEDA ?? [];
      const itemMoneda = monedas.find((m) => Number(m.id) === Number(item.monedaId));
      let code = "ARS";
      if (jus > 0) {
        code = "JUS";
      } else if (itemMoneda) {
        const c = String(itemMoneda.codigo || "").toUpperCase();
        if (c.includes("USD") || c.includes("DOLAR") || c.includes("DÓLAR")) {
          code = "USD";
        }
      }
      setForm({
        ...EMPTY_FORM,
        ...base,
        conceptoId: String(item.conceptoId ?? ""),
        parteId: String(item.parteId ?? ""),
        monedaCodigo: code,
        monto: jus > 0 ? String(jus) : String(item.montoPesos ?? ""),
        fechaRegulacion: dateInputFromIso(item.fechaRegulacion) || todayInputValue(),
        aplicarInteres: Number(item.tasaInteresMensual ?? 0) > 0,
        tasaInteres: String(item.tasaInteresMensual ?? 0),
        estadoUi: estadoUiFromHonorario(item, catalog.ESTADO_HONORARIO),
        politicaJusId: item.politicaJusId ? String(item.politicaJusId) : "",
      });
    } else if (tipo === "gasto") {
      const monedas = catalog.MONEDA ?? [];
      const itemMoneda = monedas.find((m) => Number(m.id) === Number(item.monedaId));
      let code = "ARS";
      if (itemMoneda) {
        const c = String(itemMoneda.codigo || "").toUpperCase();
        if (c.includes("JUS")) {
          code = "JUS";
        } else if (c.includes("USD") || c.includes("DOLAR") || c.includes("DÓLAR")) {
          code = "USD";
        }
      }
      setForm({
        ...EMPTY_FORM,
        ...base,
        conceptoGastoId: item.conceptoId ? String(item.conceptoId) : "",
        descripcion: item.descripcion ?? "",
        fechaGasto: dateInputFromIso(item.fechaGasto) || todayInputValue(),
        monto: String(item.monto ?? ""),
        monedaCodigo: code,
        estadoGastoId: item.estadoId ? String(item.estadoId) : "",
      });
    } else {
      const monedas = catalog.MONEDA ?? [];
      const itemMoneda = monedas.find((m) => Number(m.id) === Number(item.monedaId));
      let code = "ARS";
      if (itemMoneda) {
        const c = String(itemMoneda.codigo || "").toUpperCase();
        if (c.includes("USD") || c.includes("DOLAR") || c.includes("DÓLAR")) {
          code = "USD";
        }
      }
      setForm({
        ...EMPTY_FORM,
        ...base,
        descripcion: item.descripcion ?? "",
        conceptoIngresoId: item.tipoId ? String(item.tipoId) : "",
        fechaIngreso: dateInputFromIso(item.fechaIngreso) || todayInputValue(),
        monto: String(item.monto ?? ""),
        monedaCodigo: code,
        honorarioVinculoId: item.cuotaId ? String(item.cuotaId) : "",
        gastoVinculoId: "",
      });
    }
  }, [isEdit, entityQuery.data, tipoParam, catalog.ESTADO_GASTO, catalog.ESTADO_HONORARIO, catalog.MONEDA, setForm]);

  useEffect(() => {
    if (isEdit || !queryHonorarioId || tipoMovimiento !== "ingreso") return;
    const pendientes = honorariosPendientesQuery.data ?? [];
    const match = pendientes.find((h) => Number(h.id) === Number(queryHonorarioId));
    if (match && !form.descripcion) {
      setForm((f) => ({
        ...f,
        honorarioVinculoId: String(match.id),
        descripcion: `Cobro honorario #${match.id}`,
        monto: queryMonto ?? f.monto,
      }));
    }
  }, [isEdit, queryHonorarioId, tipoMovimiento, honorariosPendientesQuery.data, queryMonto, form.descripcion, setForm]);

  useEffect(() => {
    if (!isEdit && tipoMovimiento === "convenio" && queryHonorarioId) {
      setForm((f) => ({ ...f, convenioHonorarioId: String(queryHonorarioId) }));
    }
  }, [isEdit, tipoMovimiento, queryHonorarioId, setForm]);

  // Cobro lanzado desde Planes/Honorarios (honorarioId/planId/cuotaId): precargar el
  // concepto "Pago de honorarios". El reintegro de gasto (queryGastoId) tiene su propio concepto.
  useEffect(() => {
    if (isEdit || tipoMovimiento !== "ingreso") return;
    if (queryGastoId) return;
    if (!(queryHonorarioId || queryPlanId || queryCuotaId)) return;
    const concepto = findParamByCodigo(catalog.CONCEPTO_INGRESO, ["PAGO_DE_HONORARIOS"]);
    if (!concepto?.id) return;
    setForm((f) => (f.conceptoIngresoId ? f : { ...f, conceptoIngresoId: String(concepto.id) }));
  }, [isEdit, tipoMovimiento, queryGastoId, queryHonorarioId, queryPlanId, queryCuotaId, catalog.CONCEPTO_INGRESO, setForm]);

  function navigateBack() {
    if (location.state?.from) {
      navigate(location.state.from);
      return;
    }
    navigate(-1);
  }

  function planMontoBaseParaCuotas() {
    if (tipoMovimiento === "honorario") return montoNum;
    if (tipoMovimiento === "convenio" && selectedConvenioHonorario) {
      if (isConvenioHonorarioJus) return Number(selectedConvenioHonorario.jus ?? 0);
      return Number(selectedConvenioHonorario.montoPesos ?? selectedConvenioHonorario.calc?.totalPesosRef ?? honorarioMontoBase(selectedConvenioHonorario) ?? 0);
    }
    return 0;
  }

  // Validación manual eliminada. Refactorizada a zodResolver + schemas Zod en useForm.

  const saveMutation = useMutation({
    mutationFn: async () => {
      const monedas = catalog.MONEDA ?? [];
      const monedaJus = findParamByCodigo(monedas, ["JUS"]);
      const monedaArs = findParamByCodigo(monedas, ["ARS", "PESO"]);
      const monedaUsd = findParamByCodigo(monedas, ["USD", "DOLAR", "DÓLAR"]);
      const partes = catalog.PARTES ?? [];
      const parteDefault = findParamByCodigo(partes, ["CLIENTE"]);

      if (tipoMovimiento === "honorario") {
        const payload = {
          clienteId: form.clienteId ? Number(form.clienteId) : null,
          casoId: form.casoId ? Number(form.casoId) : null,
          conceptoId: Number(form.conceptoId),
          parteId: Number(form.parteId || parteDefault?.id),
          fechaRegulacion: toIsoDateTimeLocal(form.fechaRegulacion),
          estadoId: resolveEstadoHonorarioId(catalog.ESTADO_HONORARIO, form.estadoUi),
          monedaId: isJus ? monedaJus?.id : (isUsd ? monedaUsd?.id : monedaArs?.id),
          tasaInteresMensual: form.aplicarInteres ? (Number(form.tasaInteres) > 0 ? Number(form.tasaInteres) : null) : null,
          jus: isJus ? montoNum : null,
          montoPesos: !isJus ? montoNum : null,
          politicaJusId: isJus ? Number(form.politicaJusId) : null,
        };
        let honorarioResult;
        if (isEdit) {
          const { data } = await api.put(`/honorarios/${editId}`, payload);
          honorarioResult = unwrapEntity(data);
          return { honorario: honorarioResult, plan: null };
        }
        const { data } = await api.post("/honorarios", payload);
        honorarioResult = unwrapEntity(data);
        if (form.crearPlanPago) {
          const planPayload = {
            honorarioId: Number(honorarioResult.id),
            clienteId: form.clienteId ? Number(form.clienteId) : null,
            casoId: form.casoId ? Number(form.casoId) : null,
            descripcion: form.convenioDescripcion.trim() || null,
            fechaInicio: toIsoDateTimeLocal(form.convenioFechaInicio),
            periodicidadId: Number(form.convenioPeriodicidad),
            cantidadCuotas: Number(form.convenioCuotas),
            montoCuotaPesos: isJus ? null : Number(form.convenioMontoCuota),
            montoCuotaJus: isJus ? Number(form.convenioMontoCuota) : null,
            politicaJusId: isJus ? (form.politicaJusId ? Number(form.politicaJusId) : null) : null,
            tasaInteresMensual: form.aplicarInteres && Number(form.tasaInteres) > 0 ? Number(form.tasaInteres) / 100 : null,
            diaVencimiento: form.diaVencimiento ? Number(form.diaVencimiento) : null,
          };
          const planResponse = await api.post("/planes", planPayload);
          return { honorario: honorarioResult, plan: planResponse.data?.data ?? planResponse.data };
        }
        return { honorario: honorarioResult, plan: null };
      }

      if (tipoMovimiento === "gasto") {
        const payload = {
          clienteId: Number(form.clienteId),
          casoId: form.casoId ? Number(form.casoId) : null,
          conceptoId: form.conceptoGastoId ? Number(form.conceptoGastoId) : null,
          descripcion: form.descripcion.trim() || null,
          fechaGasto: toIsoDateTimeLocal(form.fechaGasto),
          monto: montoNum,
          monedaId: isJus ? monedaJus?.id : (isUsd ? monedaUsd?.id : monedaArs?.id),
          cotizacionArs: isJus ? Number(valorJusGasto) : null,
          estadoId: form.estadoGastoId ? Number(form.estadoGastoId) : null,
        };
        if (isEdit) {
          const { data } = await api.put(`/gastos/${editId}`, payload);
          return unwrapEntity(data);
        }
        const { data } = await api.post("/gastos", payload);
        return unwrapEntity(data);
      }

      if (tipoMovimiento === "convenio") {
        const payload = {
          honorarioId: Number(form.convenioHonorarioId),
          clienteId: form.clienteId ? Number(form.clienteId) : null,
          casoId: form.casoId ? Number(form.casoId) : null,
          descripcion: form.convenioDescripcion.trim() || null,
          fechaInicio: toIsoDateTimeLocal(form.convenioFechaInicio),
          periodicidadId: Number(form.convenioPeriodicidad),
          cantidadCuotas: Number(form.convenioCuotas),
          montoCuotaPesos: isConvenioHonorarioJus ? null : Number(form.convenioMontoCuota),
          montoCuotaJus: isConvenioHonorarioJus ? Number(form.convenioMontoCuota) : null,
          politicaJusId: isConvenioHonorarioJus
            ? (convenioInheritedPoliticaJusId ? Number(convenioInheritedPoliticaJusId) : null)
            : null,
          tasaInteresMensual: form.tasaInteresMensual ? Number(form.tasaInteresMensual) / 100 : null,
          diaVencimiento: form.diaVencimiento ? Number(form.diaVencimiento) : null,
        };
        const { data } = await api.post("/planes", payload);
        return data?.data ?? data;
      }

      const estadosIngreso = catalog.ESTADO_INGRESO ?? [];
      const confirmado = findParamByCodigo(estadosIngreso, ["CONFIRMADO", "PAGADO"]);
      let descripcion = form.descripcion.trim();
      if (form.honorarioVinculoId) {
        descripcion = descripcion || `Cobro honorario #${form.honorarioVinculoId}`;
      }
      if (form.gastoVinculoId) {
        descripcion = descripcion || `Reintegro de gasto #${form.gastoVinculoId}`;
      }
      const ingresoIsJus = form.monedaCodigo === "JUS";
      const ingresoIsUsd = form.monedaCodigo === "USD";
      let finalMonto = montoNum;
      let finalMonedaId = monedaArs?.id ?? null;
      let finalCotizacion = null;
      if (ingresoIsJus) {
        finalMonto = montoNum * valorJusIngreso;
        finalMonedaId = monedaArs?.id ?? null;
        finalCotizacion = valorJusIngreso;
      } else if (ingresoIsUsd) {
        finalMonto = montoNum;
        finalMonedaId = monedaUsd?.id ?? null;
      } else {
        finalMonto = montoNum;
        finalMonedaId = monedaArs?.id ?? null;
      }
      const payload = {
        clienteId: form.clienteId ? Number(form.clienteId) : null,
        casoId: form.casoId ? Number(form.casoId) : null,
        descripcion: descripcion || null,
        monto: finalMonto,
        fechaIngreso: toIsoDateTimeLocal(form.fechaIngreso),
        tipoId: form.conceptoIngresoId ? Number(form.conceptoIngresoId) : null,
        estadoId: confirmado?.id ?? null,
        monedaId: finalMonedaId,
        cotizacionArs: finalCotizacion ? String(finalCotizacion) : null,
        ...(form.selectedCuotaIds.length > 0 ? { cuotaIds: form.selectedCuotaIds.map(Number) } : {}),
        ...(form.selectedGastoIds.length > 0 ? { gastoIds: form.selectedGastoIds.map(Number) } : {}),
        ...(form.selectedHonorarioIds.length > 0 ? { honorarioIds: form.selectedHonorarioIds.map(Number) } : {}),
        ...(form.planVinculoId && form.selectedCuotaIds.length === 0 ? { planId: Number(form.planVinculoId) } : {}),
      };
      if (isEdit) {
        const { data } = await api.put(`/ingresos/${editId}`, payload);
        return unwrapEntity(data);
      }
      const { data } = await api.post("/ingresos", payload);
      return unwrapEntity(data);
    },
    onSuccess: (result) => {
      invalidateFinanzasQueries(queryClient);
      queryClient.invalidateQueries({ queryKey: ["planes"] });
      const cuotas = result?.plan?.cuotas?.length ?? result?.cuotas?.length;
      const msg = cuotas
        ? tipoMovimiento === "honorario"
          ? `Honorario registrado con plan de ${cuotas} cuotas generado correctamente`
          : `Plan creado con ${cuotas} cuotas generadas correctamente`
        : isEdit
          ? "Movimiento actualizado correctamente"
          : "Movimiento registrado correctamente";
      enqueueSnackbar(msg, { variant: "success" });
      if (location.state?.from) navigate(location.state.from);
      else navigate("/finanzas");
    },
    onError: (error) => enqueueSnackbar(getApiError(error, "No se pudo guardar el movimiento"), { variant: "error" }),
  });

  const titles = {
    honorario: isEdit ? "Editar honorario" : "Registrar honorario",
    gasto: isEdit ? "Editar gasto" : "Registrar gasto",
    ingreso: isEdit ? "Editar cobro" : "Registrar cobro / ingreso",
    convenio: "Crear convenio / plan de pago",
  };

  const loading = catalogQuery.isLoading || (isEdit && entityQuery.isLoading);
  const parteCliente = findParamByCodigo(catalog.PARTES, ["CLIENTE"]);

  useEffect(() => {
    if (!isEdit && parteCliente?.id && !form.parteId) {
      setForm((f) => ({ ...f, parteId: String(parteCliente.id) }));
    }
  }, [parteCliente, isEdit, form.parteId, setForm]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isEdit && entityQuery.isError) {
    return (
      <Box sx={{ maxWidth: 600, mx: "auto", textAlign: "center", py: 8 }}>
        <Typography variant="h6" sx={{ fontWeight: 900, mb: 1 }}>No se pudo cargar el movimiento</Typography>
        <Button startIcon={<ArrowBack />} onClick={navigateBack} sx={{ fontWeight: 800 }}>Volver</Button>
      </Box>
    );
  }

  return (
    <Box
      component="form"
      onSubmit={handleSubmit(
        () => saveMutation.mutate(),
        (errs) => {
          if (errs.selectedGastoIds) {
            setHonorariosIngresoExpanded(true);
            setGastosIngresoExpanded(true);
          }
        }
      )}
      sx={{ width: "100%" }}
    >
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }} spacing={2} sx={{ mb: 3 }}>
        <Button startIcon={<ArrowBack />} onClick={navigateBack} sx={{ alignSelf: "flex-start", fontWeight: 800 }}>
          Volver
        </Button>
        <Typography variant="h5" sx={{ fontWeight: 900 }}>{titles[tipoMovimiento]}</Typography>
      </Stack>

      <Paper
        elevation={0}
        sx={{
          borderRadius: "20px",
          border: "1px solid",
          borderColor: "divider",
          p: { xs: 2.5, md: 3.5 },
          boxShadow: theme.palette.mode === "dark"
            ? "0 24px 48px rgba(0,0,0,0.35)"
            : "0 24px 48px rgba(15,23,42,0.06)",
        }}
      >
        {!isEdit && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 900, color: "text.secondary", mb: 1.5, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Tipo de movimiento
            </Typography>
            <ToggleButtonGroup
              exclusive
              fullWidth
              orientation={isMobile ? "vertical" : "horizontal"}
              value={tipoMovimiento}
              onChange={(_, val) => val && setTipoMovimiento(val)}
              sx={{
                "& .MuiToggleButton-root": {
                  py: 1.25,
                  fontWeight: 900,
                  textTransform: "none",
                  borderRadius: "12px !important",
                  justifyContent: { xs: "flex-start", sm: "center" },
                  m: { xs: "0.25rem 0", sm: "0 0.25rem" },
                },
              }}
            >
              <ToggleButton value="honorario">
                <Payments sx={{ mr: 1, fontSize: 20 }} /> Honorario
              </ToggleButton>
              <ToggleButton value="gasto">
                <ReceiptLong sx={{ mr: 1, fontSize: 20 }} /> Gasto
              </ToggleButton>
              <ToggleButton value="ingreso">
                <AccountBalanceWallet sx={{ mr: 1, fontSize: 20 }} /> Ingreso / Cobro
              </ToggleButton>
              <ToggleButton value="convenio">
                <CalendarMonth sx={{ mr: 1, fontSize: 20 }} /> Plan de pago
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
        )}

        <Typography variant="subtitle1" sx={{ color: "primary.main", fontWeight: 900, mb: 1 }}>
          {tipoMovimiento === "convenio"
            ? "Cliente"
            : tipoMovimiento === "honorario"
            ? "Detalle de Honorario"
            : tipoMovimiento === "gasto"
              ? "Detalle de Gasto"
              : tipoMovimiento === "ingreso"
                ? "Detalle de Ingreso"
                : "Cliente e importe"}
        </Typography>
        <Divider sx={{ mb: 2.5 }} />

        {/* Indicador de progreso del formulario */}
        <Box sx={{ mb: 2.5 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
            <Typography variant="caption" color="text.secondary">Campos requeridos</Typography>
            <Typography variant="caption" color={formProgress === 100 ? "success.main" : "primary.main"} fontWeight={700}>
              {formProgress}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={formProgress}
            color={formProgress === 100 ? "success" : "primary"}
            sx={{
              height: 4,
              borderRadius: 2,
              bgcolor: "action.hover",
              "& .MuiLinearProgress-bar": { borderRadius: 2, transition: "transform 0.4s ease" },
            }}
          />
        </Box>

        <Grid container spacing={2.5}>
          {tipoMovimiento !== "gasto" && tipoMovimiento !== "ingreso" && (
            <>
          <Grid size={{ xs: 12, md: 6 }}>
            <Controller
              name="clienteId"
              control={control}
              render={({ field, fieldState: { error } }) => (
                <Autocomplete
                  options={clientes}
                  value={clientes.find((c) => Number(c.id) === Number(field.value)) ?? null}
                  disabled={Boolean(lockClienteId)}
                  onChange={(_, val) => {
                    const newId = val ? String(val.id) : "";
                    field.onChange(newId);
                    setValue("casoId", lockCasoId ? getValues("casoId") : "");
                  }}
                  getOptionLabel={clienteLabel}
                  isOptionEqualToValue={(a, b) => Number(a?.id) === Number(b?.id)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      size="small"
                      label="Cliente"
                      error={Boolean(error)}
                      helperText={error?.message}
                      required={tipoMovimiento === "honorario"}
                      inputProps={{ ...params.inputProps, "aria-label": "Buscar cliente por nombre o CUIT" }}
                    />
                  )}
                />
              )}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Controller
              name="casoId"
              control={control}
              render={({ field }) => (
                <Autocomplete
                  options={filteredExpedientes}
                  value={filteredExpedientes.find((c) => Number(c.id) === Number(field.value)) ?? null}
                  disabled={Boolean(lockCasoId) || !form.clienteId}
                  onChange={(_, val) => field.onChange(val ? String(val.id) : "")}
                  getOptionLabel={casoLabel}
                  isOptionEqualToValue={(a, b) => Number(a?.id) === Number(b?.id)}
                  noOptionsText={form.clienteId ? "Sin expedientes" : "Seleccioná un cliente"}
                  renderInput={(params) => (
                    <TextField {...params} size="small" label="Expediente (opcional)" inputProps={{ ...params.inputProps, "aria-label": "Buscar expediente por carátula o número" }} />
                  )}
                />
              )}
            />
          </Grid>
            </>
          )}

          {tipoMovimiento === "honorario" && (
            <>
              <Grid size={{ xs: 12, md: 4 }}>
                <Controller
                  name="conceptoId"
                  control={control}
                  render={({ field, fieldState: { error } }) => (
                    <FormControl fullWidth size="small" error={Boolean(error)}>
                      <InputLabel>Concepto</InputLabel>
                      <Select label="Concepto" {...field}>
                        {(catalog.CONCEPTO_HONORARIO ?? []).map((c) => (
                          <MenuItem key={c.id} value={String(c.id)}>{c.nombre}</MenuItem>
                        ))}
                      </Select>
                      {error && <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>{error.message}</Typography>}
                    </FormControl>
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Controller
                  name="parteId"
                  control={control}
                  render={({ field, fieldState: { error } }) => (
                    <FormControl fullWidth size="small" error={Boolean(error)}>
                      <InputLabel>Obligado al pago</InputLabel>
                      <Select label="Obligado al pago" {...field}>
                        {(catalog.PARTES ?? []).map((p) => (
                          <MenuItem key={p.id} value={String(p.id)}>{p.nombre}</MenuItem>
                        ))}
                      </Select>
                      {error && <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>{error.message}</Typography>}
                    </FormControl>
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Controller
                  name="estadoUi"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth size="small">
                      <InputLabel>Estado</InputLabel>
                      <Select label="Estado" {...field}>
                        {ESTADO_HONORARIO_UI.map((est) => (
                          <MenuItem key={est.key} value={est.key}>{est.label}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12 }}>
                <Controller
                  name="monedaCodigo"
                  control={control}
                  render={({ field }) => (
                    <ToggleButtonGroup
                      exclusive
                      fullWidth
                      size="small"
                      value={field.value}
                      onChange={(_, val) => {
                        if (val) {
                          field.onChange(val);
                          if (val === "JUS" && !form.politicaJusId) {
                            const defaultPolitica = findParamByCodigo(catalog.POLITICA_JUS, ["AL_COBRO"]);
                            if (defaultPolitica) {
                              setValue("politicaJusId", String(defaultPolitica.id));
                            }
                          }
                        }
                      }}
                    >
                      <ToggleButton value="JUS" sx={{ fontWeight: 900 }}>JUS</ToggleButton>
                      <ToggleButton value="ARS" sx={{ fontWeight: 900 }}>ARS</ToggleButton>
                    </ToggleButtonGroup>
                  )}
                />
              </Grid>
              {form.monedaCodigo === "ARS" && (
                <>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Controller
                      name="monto"
                      control={control}
                      render={({ field, fieldState: { error } }) => (
                        <Box>
                          <TextField
                            fullWidth
                            size="small"
                            label="Monto (ARS)"
                            value={field.value}
                            onChange={(e) => field.onChange(e.target.value === "" ? "" : Number(e.target.value))}
                            onBlur={field.onBlur}
                            error={Boolean(error)}
                            helperText={error?.message}
                            inputProps={{ decimalScale: 2, inputMode: "decimal", "aria-describedby": "monto-hint" }}
                            InputProps={{
                              inputComponent: NumericFormatCustom,
                              startAdornment: <InputAdornment position="start">$</InputAdornment>,
                            }}
                          />
                          <FormHelperText id="monto-hint">Ingrese el monto sin símbolo de moneda</FormHelperText>
                        </Box>
                      )}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Controller
                      name="fechaRegulacion"
                      control={control}
                      render={({ field, fieldState: { error } }) => (
                        <TextField
                          {...field}
                          fullWidth
                          size="small"
                          type="date"
                          label="Fecha regulación"
                          InputLabelProps={{ shrink: true }}
                          error={Boolean(error)}
                          helperText={error?.message}
                        />
                      )}
                    />
                  </Grid>
                </>
              )}
              {form.monedaCodigo === "JUS" && (
                <>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <Controller
                      name="monto"
                      control={control}
                      render={({ field, fieldState: { error } }) => (
                        <Box>
                          <TextField
                            fullWidth
                            size="small"
                            label="Cantidad JUS"
                            value={field.value}
                            onChange={(e) => field.onChange(e.target.value === "" ? "" : Number(e.target.value))}
                            onBlur={field.onBlur}
                            error={Boolean(error)}
                            helperText={error?.message}
                            inputProps={{ decimalScale: 4, inputMode: "decimal", "aria-describedby": "monto-hint" }}
                            InputProps={{
                              inputComponent: NumericFormatCustom,
                            }}
                          />
                          <FormHelperText id="monto-hint">Ingrese el monto sin símbolo de moneda</FormHelperText>
                        </Box>
                      )}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <Controller
                      name="fechaRegulacion"
                      control={control}
                      render={({ field, fieldState: { error } }) => (
                        <TextField
                          {...field}
                          fullWidth
                          size="small"
                          type="date"
                          label="Fecha regulación"
                          InputLabelProps={{ shrink: true }}
                          error={Boolean(error)}
                          helperText={error?.message}
                        />
                      )}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Valor JUS a fecha de regulación (ARS)"
                      value={valorJusRegulacionQuery.isLoading ? "Cargando..." : (valorJusRegulacion > 0 ? formatMoneyAr(valorJusRegulacion) : "No disponible")}
                      InputProps={{ readOnly: true }}
                      disabled
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Importe regulado (ARS)"
                      value={valorJusRegulacion > 0 && montoNum > 0 ? formatMoneyAr(montoNum * valorJusRegulacion) : "$ 0,00"}
                      InputProps={{ readOnly: true }}
                      disabled
                    />
                  </Grid>
                </>
              )}
              {form.monedaCodigo === "USD" && (
                <>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Controller
                      name="monto"
                      control={control}
                      render={({ field, fieldState: { error } }) => (
                        <Box>
                          <TextField
                            fullWidth
                            size="small"
                            label="Monto (USD)"
                            value={field.value}
                            onChange={(e) => field.onChange(e.target.value === "" ? "" : Number(e.target.value))}
                            onBlur={field.onBlur}
                            error={Boolean(error)}
                            helperText={error?.message}
                            inputProps={{ decimalScale: 2, inputMode: "decimal", "aria-describedby": "monto-hint" }}
                            InputProps={{
                              inputComponent: NumericFormatCustom,
                              startAdornment: <InputAdornment position="start">US$</InputAdornment>,
                            }}
                          />
                          <FormHelperText id="monto-hint">Ingrese el monto sin símbolo de moneda</FormHelperText>
                        </Box>
                      )}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Controller
                      name="fechaRegulacion"
                      control={control}
                      render={({ field, fieldState: { error } }) => (
                        <TextField
                          {...field}
                          fullWidth
                          size="small"
                          type="date"
                          label="Fecha regulación"
                          InputLabelProps={{ shrink: true }}
                          error={Boolean(error)}
                          helperText={error?.message}
                        />
                      )}
                    />
                  </Grid>
                </>
              )}
              {form.monedaCodigo === "JUS" && (
                <>
                  <Grid size={{ xs: 12, md: isAlCobro ? 12 : 6 }}>
                    <Controller
                      name="politicaJusId"
                      control={control}
                      render={({ field, fieldState: { error } }) => (
                        <FormControl fullWidth size="small" error={Boolean(error)}>
                          <InputLabel>Cobrar al valor JUS de</InputLabel>
                          <Select
                            label="Cobrar al valor JUS de"
                            {...field}
                          >
                            <MenuItem value="">Seleccioná criterio</MenuItem>
                            {politicaJusOptions.map((p) => (
                              <MenuItem key={p.id} value={String(p.id)}>{politicaJusLabel(p)}</MenuItem>
                            ))}
                          </Select>
                          {error && (
                            <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
                              {error.message}
                            </Typography>
                          )}
                        </FormControl>
                      )}
                    />
                  </Grid>
                  {!isAlCobro && (
                    <Grid size={{ xs: 12, md: 6 }}>
                      <Stack direction="row" spacing={2} alignItems="center" sx={{ height: "100%", minHeight: 40 }}>
                        <Controller
                          name="aplicarInteres"
                          control={control}
                          render={({ field }) => (
                            <FormControlLabel
                              control={
                                <Switch
                                  checked={field.value}
                                  onChange={(event) => {
                                    field.onChange(event.target.checked);
                                    if (!event.target.checked) {
                                      setValue("tasaInteres", 0);
                                    }
                                  }}
                                />
                              }
                              label={<Typography variant="body2" sx={{ fontWeight: 900 }}>Aplicar interés</Typography>}
                            />
                          )}
                        />
                        <AnimatePresence>
                          {form.aplicarInteres && (
                            <MotionDiv
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.25 }}
                              style={{ overflow: "hidden" }}
                            >
                              <Controller
                                name="tasaInteres"
                                control={control}
                                render={({ field, fieldState: { error } }) => (
                                  <TextField
                                    size="small"
                                    label="% interés mensual"
                                    placeholder="3,5"
                                    value={field.value}
                                    onChange={(e) => field.onChange(e.target.value === "" ? "" : Number(e.target.value))}
                                    onBlur={field.onBlur}
                                    error={Boolean(error)}
                                    helperText={error?.message}
                                    sx={{ width: 150 }}
                                    inputProps={{ decimalScale: 2, inputMode: "decimal" }}
                                    InputProps={{
                                      inputComponent: NumericFormatCustom,
                                      endAdornment: <InputAdornment position="end">%</InputAdornment>,
                                    }}
                                  />
                                )}
                              />
                            </MotionDiv>
                          )}
                        </AnimatePresence>
                      </Stack>
                    </Grid>
                  )}
                </>
              )}
              {(form.monedaCodigo === "ARS" || form.monedaCodigo === "USD") && (
                <Grid size={{ xs: 12 }}>
                  <Stack direction="row" spacing={2} alignItems="center" sx={{ height: "100%", minHeight: 40 }}>
                    <Controller
                      name="aplicarInteres"
                      control={control}
                      render={({ field }) => (
                        <FormControlLabel
                          control={
                            <Switch
                              checked={field.value}
                              onChange={(event) => {
                                field.onChange(event.target.checked);
                                if (!event.target.checked) {
                                  setValue("tasaInteres", 0);
                                }
                              }}
                            />
                          }
                          label={<Typography variant="body2" sx={{ fontWeight: 900 }}>Aplicar interés</Typography>}
                        />
                      )}
                    />
                    <AnimatePresence>
                      {form.aplicarInteres && (
                        <MotionDiv
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.25 }}
                          style={{ overflow: "hidden" }}
                        >
                          <Controller
                            name="tasaInteres"
                            control={control}
                            render={({ field, fieldState: { error } }) => (
                              <TextField
                                size="small"
                                label="% interés mensual"
                                placeholder="3,5"
                                value={field.value}
                                onChange={(e) => field.onChange(e.target.value === "" ? "" : Number(e.target.value))}
                                onBlur={field.onBlur}
                                error={Boolean(error)}
                                helperText={error?.message}
                                sx={{ width: 150 }}
                                inputProps={{ decimalScale: 2, inputMode: "decimal" }}
                                InputProps={{
                                  inputComponent: NumericFormatCustom,
                                  endAdornment: <InputAdornment position="end">%</InputAdornment>,
                                }}
                              />
                            )}
                          />
                        </MotionDiv>
                      )}
                    </AnimatePresence>
                  </Stack>
                </Grid>
              )}
              {!isEdit && (
                <Grid size={{ xs: 12 }}>
                  <Box
                    sx={{
                      mt: 1,
                      p: 2,
                      borderRadius: "12px",
                      border: "1px solid",
                      borderColor: form.crearPlanPago ? alpha(theme.palette.primary.main, 0.35) : "divider",
                      bgcolor: form.crearPlanPago ? alpha(theme.palette.primary.main, 0.04) : "transparent",
                    }}
                  >
                    <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "flex-start", sm: "center" }} justifyContent="space-between" spacing={1.5}>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 950 }}>Plan de pago</Typography>
                        <Typography variant="body2" sx={{ color: "text.secondary" }}>
                          Generar cuotas al guardar este honorario.
                        </Typography>
                      </Box>
                      <Controller
                        name="crearPlanPago"
                        control={control}
                        render={({ field }) => (
                          <FormControlLabel
                            control={
                              <Switch
                                checked={field.value}
                                onChange={(event) => field.onChange(event.target.checked)}
                              />
                            }
                            label={<Typography variant="body2" sx={{ fontWeight: 900 }}>Crear plan</Typography>}
                          />
                        )}
                      />
                    </Stack>

                    <AnimatePresence>
                      {form.crearPlanPago && (
                        <MotionDiv
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.25 }}
                          style={{ overflow: "hidden" }}
                        >
                          <Grid container spacing={2} sx={{ mt: 1 }}>
                            <Grid size={{ xs: 12, sm: 6, lg: 2.4 }}>
                              <Controller
                                name="convenioPeriodicidad"
                                control={control}
                                render={({ field, fieldState: { error } }) => (
                                  <FormControl fullWidth size="small" error={Boolean(error)}>
                                    <InputLabel>Periodicidad</InputLabel>
                                    <Select label="Periodicidad" {...field}>
                                      <MenuItem value="">Seleccioná periodicidad</MenuItem>
                                      {(catalog.PERIODICIDAD ?? []).map((p) => (
                                        <MenuItem key={p.id} value={String(p.id)}>{p.nombre}</MenuItem>
                                      ))}
                                    </Select>
                                    {error && (
                                      <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
                                        {error.message}
                                      </Typography>
                                    )}
                                  </FormControl>
                                )}
                              />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6, lg: 2.4 }}>
                              <Controller
                                name="convenioCuotas"
                                control={control}
                                render={({ field, fieldState: { error } }) => (
                                  <TextField
                                    {...field}
                                    fullWidth
                                    size="small"
                                    type="number"
                                    label="Cantidad de cuotas"
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      const cantidad = Number(val);
                                      const base = planMontoBaseParaCuotas();
                                      field.onChange(val === "" ? "" : cantidad);
                                      if (cantidad > 0 && base > 0) {
                                        setValue("convenioMontoCuota", (base / cantidad).toFixed((tipoMovimiento === "honorario" ? isJus : isConvenioHonorarioJus) ? 4 : 2));
                                      }
                                    }}
                                    error={Boolean(error)}
                                    helperText={error?.message}
                                    inputProps={{ min: 1, max: 240, step: 1, inputMode: "decimal" }}
                                  />
                                )}
                              />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6, lg: 2.4 }}>
                              <Controller
                                name="convenioMontoCuota"
                                control={control}
                                render={({ field, fieldState: { error } }) => (
                                  <Box>
                                    <TextField
                                      {...field}
                                      fullWidth
                                      size="small"
                                      label={isJus ? "Monto por cuota (JUS)" : isUsd ? "Monto por cuota (USD)" : "Monto por cuota (ARS)"}
                                      onChange={(e) => field.onChange(e.target.value === "" ? "" : Number(e.target.value))}
                                      error={Boolean(error)}
                                      helperText={error?.message}
                                      inputProps={{ decimalScale: isJus ? 4 : 2, inputMode: "decimal", "aria-describedby": "convenioMontoCuota-hint" }}
                                      InputProps={{
                                        inputComponent: NumericFormatCustom,
                                        startAdornment: isJus ? undefined : <InputAdornment position="start">{isUsd ? "US$" : "$"}</InputAdornment>,
                                      }}
                                    />
                                    <FormHelperText id="convenioMontoCuota-hint">Ingrese el monto sin símbolo de moneda</FormHelperText>
                                  </Box>
                                )}
                              />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6, lg: 2.4 }}>
                              <Controller
                                name="convenioFechaInicio"
                                control={control}
                                render={({ field, fieldState: { error } }) => (
                                  <TextField
                                    {...field}
                                    fullWidth
                                    size="small"
                                    type="date"
                                    label="Fecha primera cuota"
                                    error={Boolean(error)}
                                    helperText={error?.message}
                                    InputLabelProps={{ shrink: true }}
                                  />
                                )}
                              />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6, lg: 2.4 }}>
                              <Controller
                                name="diaVencimiento"
                                control={control}
                                render={({ field, fieldState: { error } }) => (
                                  <TextField
                                    {...field}
                                    fullWidth
                                    size="small"
                                    label="Día de vencimiento"
                                    type="number"
                                    onChange={(e) => field.onChange(e.target.value === "" ? "" : Number(e.target.value))}
                                    error={Boolean(error)}
                                    helperText={error?.message}
                                    inputProps={{ min: 1, max: 31, inputMode: "decimal" }}
                                  />
                                )}
                              />
                            </Grid>
                            <Grid size={{ xs: 12 }}>
                              <Controller
                                name="convenioDescripcion"
                                control={control}
                                render={({ field }) => (
                                  <TextField
                                    {...field}
                                    fullWidth
                                    size="small"
                                    label="Descripción del plan (opcional)"
                                    multiline
                                    minRows={2}
                                  />
                                )}
                              />
                            </Grid>
                          </Grid>
                        </MotionDiv>
                      )}
                    </AnimatePresence>
                  </Box>
                </Grid>
              )}
            </>
          )}

        </Grid>

        {tipoMovimiento === "gasto" && (
          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Controller
                name="clienteId"
                control={control}
                render={({ field, fieldState: { error } }) => (
                  <Autocomplete
                    options={clientes}
                    value={clientes.find((c) => Number(c.id) === Number(field.value)) ?? null}
                    disabled={Boolean(lockClienteId)}
                    onChange={(_, val) => {
                      const newId = val ? String(val.id) : "";
                      field.onChange(newId);
                      setValue("casoId", lockCasoId ? getValues("casoId") : "");
                    }}
                    getOptionLabel={clienteLabel}
                    isOptionEqualToValue={(a, b) => Number(a?.id) === Number(b?.id)}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        size="small"
                        label="Cliente"
                        error={Boolean(error)}
                        helperText={error?.message}
                        required
                      />
                    )}
                  />
                )}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Controller
                name="casoId"
                control={control}
                render={({ field }) => (
                  <Autocomplete
                    options={filteredExpedientes}
                    value={filteredExpedientes.find((c) => Number(c.id) === Number(field.value)) ?? null}
                    disabled={Boolean(lockCasoId) || !form.clienteId}
                    onChange={(_, val) => field.onChange(val ? String(val.id) : "")}
                    getOptionLabel={casoLabel}
                    isOptionEqualToValue={(a, b) => Number(a?.id) === Number(b?.id)}
                    noOptionsText={form.clienteId ? "Sin expedientes" : "Seleccioná un cliente"}
                    renderInput={(params) => (
                      <TextField {...params} size="small" label="Expediente (opcional)" inputProps={{ ...params.inputProps, "aria-label": "Buscar expediente por carátula o número" }} />
                    )}
                  />
                )}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Controller
                name="conceptoGastoId"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth size="small">
                    <InputLabel>Concepto de gasto</InputLabel>
                    <Select label="Concepto de gasto" {...field}>
                      <MenuItem value="">Sin concepto</MenuItem>
                      {(catalog.CONCEPTO_GASTO ?? []).map((c) => (
                        <MenuItem key={c.id} value={String(c.id)}>{c.nombre}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Controller
                name="estadoGastoId"
                control={control}
                render={({ field, fieldState: { error } }) => (
                  <FormControl fullWidth size="small" error={Boolean(error)}>
                    <InputLabel>Estado</InputLabel>
                    <Select label="Estado" {...field} required>
                      {(catalog.ESTADO_GASTO ?? []).map((e) => (
                        <MenuItem key={e.id} value={String(e.id)}>{e.nombre}</MenuItem>
                      ))}
                    </Select>
                    {error && (
                      <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
                        {error.message}
                      </Typography>
                    )}
                  </FormControl>
                )}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Controller
                name="monedaCodigo"
                control={control}
                render={({ field }) => (
                  <ToggleButtonGroup
                    exclusive
                    fullWidth
                    size="small"
                    value={field.value}
                    onChange={(_, val) => val && field.onChange(val)}
                  >
                    <ToggleButton value="JUS" sx={{ fontWeight: 900 }}>JUS</ToggleButton>
                    <ToggleButton value="ARS" sx={{ fontWeight: 900 }}>ARS</ToggleButton>
                  </ToggleButtonGroup>
                )}
              />
            </Grid>
            {form.monedaCodigo === "JUS" ? (
              <>
                <Grid size={{ xs: 12, md: 3 }}>
                  <Controller
                    name="monto"
                    control={control}
                    render={({ field, fieldState: { error } }) => (
                      <Box>
                        <TextField fullWidth size="small" label="Cantidad JUS" value={field.value} onChange={(e) => field.onChange(e.target.value === "" ? "" : Number(e.target.value))} onBlur={field.onBlur} error={Boolean(error)} helperText={error?.message} inputProps={{ decimalScale: 4, inputMode: "decimal", "aria-describedby": "monto-hint" }} InputProps={{ inputComponent: NumericFormatCustom }} />
                        <FormHelperText id="monto-hint">Ingrese el monto sin símbolo de moneda</FormHelperText>
                      </Box>
                    )}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <Controller
                    name="fechaGasto"
                    control={control}
                    render={({ field, fieldState: { error } }) => (
                      <TextField fullWidth size="small" type="date" label="Fecha de gasto" {...field} InputLabelProps={{ shrink: true }} error={Boolean(error)} helperText={error?.message} />
                    )}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField fullWidth size="small" label="Valor JUS a fecha de gasto (ARS)" value={valorJusGastoQuery.isLoading ? "Cargando..." : (valorJusGasto > 0 ? formatMoneyAr(valorJusGasto) : "No disponible")} InputProps={{ readOnly: true }} disabled />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField fullWidth size="small" label="Equivalencia (ARS)" value={valorJusGasto > 0 && montoNum > 0 ? formatMoneyAr(montoNum * valorJusGasto) : "$ 0,00"} InputProps={{ readOnly: true }} disabled />
                </Grid>
              </>
            ) : (
              <>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Controller
                    name="monto"
                    control={control}
                    render={({ field, fieldState: { error } }) => (
                      <Box>
                        <TextField
                          fullWidth
                          size="small"
                          label={form.monedaCodigo === "USD" ? "Monto (USD)" : "Monto (ARS)"}
                          value={field.value}
                          onChange={(e) => field.onChange(e.target.value === "" ? "" : Number(e.target.value))}
                          onBlur={field.onBlur}
                          error={Boolean(error)}
                          helperText={error?.message}
                          inputProps={{ decimalScale: 2, inputMode: "decimal", "aria-describedby": "monto-hint" }}
                          InputProps={{
                            inputComponent: NumericFormatCustom,
                            startAdornment: <InputAdornment position="start">{form.monedaCodigo === "USD" ? "US$" : "$"}</InputAdornment>,
                          }}
                        />
                        <FormHelperText id="monto-hint">Ingrese el monto sin símbolo de moneda</FormHelperText>
                      </Box>
                    )}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Controller
                    name="fechaGasto"
                    control={control}
                    render={({ field, fieldState: { error } }) => (
                      <TextField fullWidth size="small" type="date" label="Fecha de gasto" {...field} InputLabelProps={{ shrink: true }} error={Boolean(error)} helperText={error?.message} />
                    )}
                  />
                </Grid>
              </>
            )}
            <Grid size={{ xs: 12 }}>
              <Controller
                name="descripcion"
                control={control}
                render={({ field }) => (
                  <TextField fullWidth size="small" label="Descripción" {...field} multiline minRows={2} />
                )}
              />
            </Grid>
          </Grid>
        )}

        {tipoMovimiento === "ingreso" && (
          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Controller
                name="clienteId"
                control={control}
                render={({ field, fieldState: { error } }) => (
                  <Autocomplete
                    options={clientes}
                    value={clientes.find((c) => Number(c.id) === Number(field.value)) ?? null}
                    disabled={Boolean(lockClienteId)}
                    onChange={(_, val) => {
                      const newId = val ? String(val.id) : "";
                      field.onChange(newId);
                      setValue("casoId", lockCasoId ? getValues("casoId") : "");
                    }}
                    getOptionLabel={clienteLabel}
                    isOptionEqualToValue={(a, b) => Number(a?.id) === Number(b?.id)}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        size="small"
                        label="Cliente"
                        error={Boolean(error)}
                        helperText={error?.message}
                        required
                      />
                    )}
                  />
                )}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Controller
                name="casoId"
                control={control}
                render={({ field }) => (
                  <Autocomplete
                    options={filteredExpedientes}
                    value={filteredExpedientes.find((c) => Number(c.id) === Number(field.value)) ?? null}
                    disabled={Boolean(lockCasoId) || !form.clienteId}
                    onChange={(_, val) => field.onChange(val ? String(val.id) : "")}
                    getOptionLabel={casoLabel}
                    isOptionEqualToValue={(a, b) => Number(a?.id) === Number(b?.id)}
                    noOptionsText={form.clienteId ? "Sin expedientes" : "Seleccioná un cliente"}
                    renderInput={(params) => (
                      <TextField {...params} size="small" label="Expediente (opcional)" inputProps={{ ...params.inputProps, "aria-label": "Buscar expediente por carátula o número" }} />
                    )}
                  />
                )}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Controller
                name="monedaCodigo"
                control={control}
                render={({ field }) => (
                  <ToggleButtonGroup
                    exclusive
                    fullWidth
                    size="small"
                    value={field.value}
                    onChange={(_, val) => val && field.onChange(val)}
                  >
                    <ToggleButton value="JUS" sx={{ fontWeight: 900 }}>JUS</ToggleButton>
                    <ToggleButton value="ARS" sx={{ fontWeight: 900 }}>ARS</ToggleButton>
                  </ToggleButtonGroup>
                )}
              />
            </Grid>
            {form.monedaCodigo === "JUS" ? (
              <>
                <Grid size={{ xs: 12, md: 3 }}>
                  <Controller
                    name="monto"
                    control={control}
                    render={({ field, fieldState: { error } }) => (
                      <Box>
                        <TextField fullWidth size="small" label="Cantidad JUS" value={field.value} onChange={(e) => field.onChange(e.target.value === "" ? "" : Number(e.target.value))} onBlur={field.onBlur} error={Boolean(error)} helperText={error?.message} inputProps={{ decimalScale: 4, inputMode: "decimal", "aria-describedby": "monto-hint" }} InputProps={{ inputComponent: NumericFormatCustom }} />
                        <FormHelperText id="monto-hint">Ingrese el monto sin símbolo de moneda</FormHelperText>
                      </Box>
                    )}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <Controller
                    name="fechaIngreso"
                    control={control}
                    render={({ field, fieldState: { error } }) => (
                      <TextField fullWidth size="small" type="date" label="Fecha de ingreso" {...field} InputLabelProps={{ shrink: true }} error={Boolean(error)} helperText={error?.message} />
                    )}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <Controller
                    name="conceptoIngresoId"
                    control={control}
                    render={({ field }) => (
                      <FormControl fullWidth size="small">
                        <InputLabel>Concepto de ingreso</InputLabel>
                        <Select label="Concepto de ingreso" {...field}>
                          <MenuItem value="">Sin concepto</MenuItem>
                          {(catalog.CONCEPTO_INGRESO ?? []).map((c) => (
                            <MenuItem key={c.id} value={String(c.id)}>{c.nombre}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField fullWidth size="small" label="Valor JUS a fecha de ingreso (ARS)" value={valorJusIngresoQuery.isLoading ? "Cargando..." : (valorJusIngreso > 0 ? formatMoneyAr(valorJusIngreso) : "No disponible")} InputProps={{ readOnly: true }} disabled />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField fullWidth size="small" label="Equivalencia (ARS)" value={valorJusIngreso > 0 && montoNum > 0 ? formatMoneyAr(montoNum * valorJusIngreso) : "$ 0,00"} InputProps={{ readOnly: true }} disabled />
                </Grid>
              </>
            ) : (
              <>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Controller
                    name="monto"
                    control={control}
                    render={({ field, fieldState: { error } }) => (
                      <Box>
                        <TextField
                          fullWidth
                          size="small"
                          label={form.monedaCodigo === "USD" ? "Monto (USD)" : "Monto (ARS)"}
                          value={field.value}
                          onChange={(e) => field.onChange(e.target.value === "" ? "" : Number(e.target.value))}
                          onBlur={field.onBlur}
                          error={Boolean(error)}
                          helperText={error?.message}
                          inputProps={{ decimalScale: 2, inputMode: "decimal", "aria-describedby": "monto-hint" }}
                          InputProps={{
                            inputComponent: NumericFormatCustom,
                            startAdornment: <InputAdornment position="start">{form.monedaCodigo === "USD" ? "US$" : "$"}</InputAdornment>,
                          }}
                        />
                        <FormHelperText id="monto-hint">Ingrese el monto sin símbolo de moneda</FormHelperText>
                      </Box>
                    )}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Controller
                    name="fechaIngreso"
                    control={control}
                    render={({ field, fieldState: { error } }) => (
                      <TextField fullWidth size="small" type="date" label="Fecha de ingreso" {...field} InputLabelProps={{ shrink: true }} error={Boolean(error)} helperText={error?.message} />
                    )}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Controller
                    name="conceptoIngresoId"
                    control={control}
                    render={({ field }) => (
                      <FormControl fullWidth size="small">
                        <InputLabel>Concepto de ingreso</InputLabel>
                        <Select label="Concepto de ingreso" {...field}>
                          <MenuItem value="">Sin concepto</MenuItem>
                          {(catalog.CONCEPTO_INGRESO ?? []).map((c) => (
                            <MenuItem key={c.id} value={String(c.id)}>{c.nombre}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )}
                  />
                </Grid>
              </>
            )}
            {tipoMovimiento === "ingreso" && (
              <>
                {form.selectedCuotaIds.length === 0 && form.selectedGastoIds.length === 0 && form.selectedHonorarioIds.length === 0 && (
                  <Grid size={{ xs: 12 }} sx={{ mb: 1 }}>
                    <Alert severity="info" sx={{ borderRadius: "12px", "& .MuiAlert-message": { fontWeight: 700 } }}>
                      Si no seleccionás ninguna cuota, gasto u honorario, el ingreso se aplicará automáticamente al primer movimiento en vencer.
                    </Alert>
                  </Grid>
                )}
                <Grid size={{ xs: 12 }}>
                  <Paper elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2.5, overflow: "hidden" }}>
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    alignItems={{ xs: "flex-start", md: "center" }}
                    justifyContent="space-between"
                    spacing={1}
                    sx={{ px: 2, py: 1.5 }}
                  >
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                      <Checkbox
                        size="small"
                        checked={allIngresoCuotasSelected}
                        indeterminate={someIngresoCuotasSelected && !allIngresoCuotasSelected}
                        onChange={(event) => {
                          const cuotaIds = selectableIngresoCuotas.map((cuota) => Number(cuota.id));
                          setForm((f) => {
                            const current = new Set(f.selectedCuotaIds);
                            cuotaIds.forEach((id) => {
                              if (event.target.checked) current.add(id);
                              else current.delete(id);
                            });
                            const selected = [...current];
                            return { ...f, selectedCuotaIds: selected, cuotaVinculoId: selected[0] ? String(selected[0]) : "" };
                          });
                        }}
                      />
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 950 }}>Honorarios</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 800 }}>
                          {clienteLabel(selectedCliente) || "Seleccioná un cliente"} — Expediente {planesIngreso[0]?.caso?.nroExpte || casoLabel(selectedCaso) || "Sin expediente"}
                        </Typography>
                      </Box>
                    </Stack>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Chip size="small" label={`${form.selectedCuotaIds.length} cuotas seleccionadas`} sx={{ fontWeight: 800 }} />
                      <Typography variant="body2" sx={{ fontWeight: 950 }}>
                        {formatMoneyAr(totalHonorariosIngreso)}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() => setHonorariosIngresoExpanded((value) => !value)}
                        aria-label={honorariosIngresoExpanded ? "Colapsar honorarios" : "Expandir honorarios"}
                      >
                        {honorariosIngresoExpanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                      </IconButton>
                    </Stack>
                  </Stack>
                  <Collapse in={honorariosIngresoExpanded}>
                    <Divider />
                    {planesIngreso.length === 0 ? (
                      <Box sx={{ px: 2, py: 3, color: "text.secondary" }}>
                        <Typography variant="body2" sx={{ fontWeight: 800 }}>
                          {!form.clienteId ? "Seleccioná un cliente para ver honorarios/cuotas pendientes." : planesIngresoQuery.isLoading ? "Cargando honorarios..." : "No hay honorarios/cuotas pendientes para este filtro."}
                        </Typography>
                      </Box>
                    ) : planesIngreso.map((plan) => {
                      const cuotas = cuotasByPlanId.get(plan.id) ?? [];
                      const toggleCuota = (cuotaId, checked) => setForm((f) => {
                        const current = new Set(f.selectedCuotaIds);
                        if (checked) current.add(Number(cuotaId));
                        else current.delete(Number(cuotaId));
                        const selected = [...current];
                        return { ...f, selectedCuotaIds: selected, cuotaVinculoId: selected[0] ? String(selected[0]) : "" };
                      });
                      return (
                        <Box key={plan.id}>
                          {/* Desktop */}
                          <TableContainer sx={{ display: { xs: "none", md: "block" } }}>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell padding="checkbox" />
                                  <TableCell sx={{ fontWeight: 900 }}>N°</TableCell>
                                  <TableCell sx={{ fontWeight: 900 }}>Vto</TableCell>
                                  <TableCell sx={{ fontWeight: 900 }}>Monto cuota</TableCell>
                                  <TableCell sx={{ fontWeight: 900 }}>Aplicado ($)</TableCell>
                                  <TableCell sx={{ fontWeight: 900 }}>Saldo ($)</TableCell>
                                  <TableCell sx={{ fontWeight: 900 }}>Estado</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {cuotas.map((cuota) => {
                                  const disabled = ["PAGADA", "CONDONADA"].includes(String(cuota.estadoCodigo ?? "").toUpperCase());
                                  const checked = form.selectedCuotaIds.includes(Number(cuota.id));
                                  const chip = cuotaEstadoChip(cuota);
                                  const saldo = Number(cuota.totalAPagarPesos ?? cuota.saldoPesos ?? cuota.saldo ?? 0);
                                  return (
                                    <TableRow key={cuota.id} hover>
                                      <TableCell padding="checkbox">
                                        <Checkbox size="small" checked={checked} disabled={disabled} onChange={(e) => toggleCuota(cuota.id, e.target.checked)} />
                                      </TableCell>
                                      <TableCell sx={{ fontWeight: 800 }}>{cuota.numero}</TableCell>
                                      <TableCell sx={{ whiteSpace: "nowrap" }}>{formatIsoDateShort(cuota.vencimiento)}</TableCell>
                                      <TableCell sx={{ whiteSpace: "nowrap" }}>{formatMoneyAr(cuotaMontoDisplay(cuota))}</TableCell>
                                      <TableCell sx={{ whiteSpace: "nowrap" }}>{formatMoneyAr(cuota.montoCobrado ?? 0)}</TableCell>
                                      <TableCell sx={{ whiteSpace: "nowrap", fontWeight: 900 }}>{formatMoneyAr(saldo)}</TableCell>
                                      <TableCell><Chip size="small" label={chip.label} color={chip.color} sx={{ fontWeight: 900 }} /></TableCell>
                                    </TableRow>
                                  );
                                })}
                                {cuotas.length === 0 && (
                                  <TableRow>
                                    <TableCell colSpan={7} sx={{ textAlign: "center", color: "text.secondary", py: 4 }}>
                                      {cuotasIngresoQueries.some((q) => q.isLoading) ? "Cargando cuotas..." : "No hay cuotas para mostrar."}
                                    </TableCell>
                                  </TableRow>
                                )}
                              </TableBody>
                            </Table>
                          </TableContainer>
                          {/* Mobile */}
                          <Stack spacing={1} sx={{ display: { xs: "flex", md: "none" }, p: 1 }}>
                            {cuotas.length === 0 ? (
                              <Typography variant="body2" color="text.secondary" sx={{ px: 1, py: 2, fontWeight: 800 }}>
                                {cuotasIngresoQueries.some((q) => q.isLoading) ? "Cargando cuotas..." : "No hay cuotas para mostrar."}
                              </Typography>
                            ) : cuotas.map((cuota) => {
                              const disabled = ["PAGADA", "CONDONADA"].includes(String(cuota.estadoCodigo ?? "").toUpperCase());
                              const checked = form.selectedCuotaIds.includes(Number(cuota.id));
                              const chip = cuotaEstadoChip(cuota);
                              const saldo = Number(cuota.totalAPagarPesos ?? cuota.saldoPesos ?? cuota.saldo ?? 0);
                              return (
                                <Paper key={cuota.id} elevation={0} sx={{ p: 1.5, border: "1px solid", borderColor: checked ? "primary.main" : "divider", borderRadius: "10px", opacity: disabled ? 0.5 : 1 }}>
                                  <Stack direction="row" alignItems="center" spacing={1}>
                                    <Checkbox size="small" checked={checked} disabled={disabled} onChange={(e) => toggleCuota(cuota.id, e.target.checked)} sx={{ p: 0.5 }} />
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                                        <Typography variant="body2" sx={{ fontWeight: 900 }}>Cuota #{cuota.numero} — {formatIsoDateShort(cuota.vencimiento)}</Typography>
                                        <Chip size="small" label={chip.label} color={chip.color} sx={{ fontWeight: 900 }} />
                                      </Stack>
                                      <Stack direction="row" spacing={2} sx={{ mt: 0.5, flexWrap: "wrap", gap: 0.5 }}>
                                        <Typography variant="caption">Monto: <strong>{formatMoneyAr(cuotaMontoDisplay(cuota))}</strong></Typography>
                                        <Typography variant="caption">Saldo: <strong>{formatMoneyAr(saldo)}</strong></Typography>
                                      </Stack>
                                    </Box>
                                  </Stack>
                                </Paper>
                              );
                            })}
                          </Stack>
                        </Box>
                      );
                    })}
                  </Collapse>
                </Paper>
              </Grid>
              </>
            )}
            {tipoMovimiento === "ingreso" && (
              <Grid size={{ xs: 12 }}>
                <Paper elevation={0} sx={{ border: "1px solid", borderColor: errors.selectedGastoIds ? "error.main" : "divider", borderRadius: 2.5, overflow: "hidden" }}>
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    alignItems={{ xs: "flex-start", md: "center" }}
                    justifyContent="space-between"
                    spacing={1}
                    sx={{ px: 2, py: 1.5 }}
                  >
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                      <Checkbox
                        size="small"
                        checked={gastosPendientesIngreso.length > 0 && gastosPendientesIngreso.every((gasto) => form.selectedGastoIds.includes(Number(gasto.id)))}
                        indeterminate={gastosPendientesIngreso.some((gasto) => form.selectedGastoIds.includes(Number(gasto.id))) && !gastosPendientesIngreso.every((gasto) => form.selectedGastoIds.includes(Number(gasto.id)))}
                        onChange={(event) => {
                          const gastoIds = gastosPendientesIngreso.map((gasto) => Number(gasto.id));
                          setForm((f) => {
                            const current = new Set(f.selectedGastoIds);
                            gastoIds.forEach((id) => {
                              if (event.target.checked) current.add(id);
                              else current.delete(id);
                            });
                            const selected = [...current];
                            return { ...f, selectedGastoIds: selected, gastoVinculoId: selected[0] ? String(selected[0]) : "" };
                          });
                        }}
                      />
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 950 }}>Gastos pendientes</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 800 }}>
                          {clienteLabel(selectedCliente) || "Seleccioná un cliente"}{selectedCaso ? ` · ${casoLabel(selectedCaso)}` : ""}
                        </Typography>
                      </Box>
                    </Stack>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Chip size="small" label={`${form.selectedGastoIds.length} gastos seleccionados`} sx={{ fontWeight: 800 }} />
                      <Typography variant="body2" sx={{ fontWeight: 950 }}>
                        {formatMoneyAr(totalGastosSeleccionados)}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() => setGastosIngresoExpanded((value) => !value)}
                        aria-label={gastosIngresoExpanded ? "Colapsar gastos" : "Expandir gastos"}
                      >
                        {gastosIngresoExpanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                      </IconButton>
                    </Stack>
                  </Stack>
                  <Collapse in={gastosIngresoExpanded}>
                    <Divider />
                    {gastosPendientesIngreso.length === 0 ? (
                      <Box sx={{ px: 2, py: 3, color: "text.secondary" }}>
                        <Typography variant="body2" sx={{ fontWeight: 800 }}>
                          {!form.clienteId ? "Seleccioná un cliente para ver gastos pendientes." : gastosIngresoQuery.isLoading ? "Cargando gastos..." : "No hay gastos pendientes para este filtro."}
                        </Typography>
                      </Box>
                    ) : (
                      <>
                        {/* Desktop */}
                        <TableContainer sx={{ display: { xs: "none", md: "block" } }}>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell padding="checkbox" />
                                <TableCell sx={{ fontWeight: 900 }}>Descripcion / Concepto</TableCell>
                                <TableCell sx={{ fontWeight: 900 }}>Fecha</TableCell>
                                <TableCell sx={{ fontWeight: 900 }}>Monto</TableCell>
                                <TableCell sx={{ fontWeight: 900 }}>Estado</TableCell>
                                <TableCell sx={{ fontWeight: 900 }}>Aplicacion</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {gastosPendientesIngreso.map((gasto) => {
                                const checked = form.selectedGastoIds.includes(Number(gasto.id));
                                const concepto = conceptoGastoById.get(Number(gasto.conceptoId));
                                const estado = estadoGastoById.get(Number(gasto.estadoId));
                                const simulation = gastoSimulationById.get(Number(gasto.id));
                                const label = gasto.descripcion || concepto?.nombre || `Gasto #${gasto.id}`;
                                return (
                                  <TableRow key={gasto.id} hover>
                                    <TableCell padding="checkbox">
                                      <Checkbox size="small" checked={checked} onChange={(e) => setForm((f) => { const s = new Set(f.selectedGastoIds); if (e.target.checked) s.add(Number(gasto.id)); else s.delete(Number(gasto.id)); const sel = [...s]; return { ...f, selectedGastoIds: sel, gastoVinculoId: sel[0] ? String(sel[0]) : "" }; })} />
                                    </TableCell>
                                    <TableCell sx={{ fontWeight: 800 }}>{label}</TableCell>
                                    <TableCell sx={{ whiteSpace: "nowrap" }}>{formatIsoDateShort(gasto.fechaGasto)}</TableCell>
                                    <TableCell sx={{ whiteSpace: "nowrap", fontWeight: 900 }}>{formatMoneyAr(gasto.monto ?? 0)}</TableCell>
                                    <TableCell><Chip size="small" label={estado?.nombre || "Pendiente"} color="warning" sx={{ fontWeight: 900 }} /></TableCell>
                                    <TableCell>
                                      {checked ? (
                                        <Stack direction="row" spacing={1} alignItems="center">
                                          <Typography variant="body2" sx={{ fontWeight: 900 }}>{formatMoneyAr(simulation?.aplicado ?? 0)}</Typography>
                                          <Chip size="small" label={simulation?.cancelado ? "Cancelado" : "Parcial"} color={simulation?.cancelado ? "success" : "info"} sx={{ fontWeight: 900 }} />
                                          {!simulation?.cancelado && <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>Saldo {formatMoneyAr(simulation?.saldoRestante ?? Number(gasto.monto ?? 0))}</Typography>}
                                        </Stack>
                                      ) : <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 800 }}>Sin imputar</Typography>}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </TableContainer>
                        {/* Mobile */}
                        <Stack spacing={1} sx={{ display: { xs: "flex", md: "none" }, p: 1 }}>
                          {gastosPendientesIngreso.map((gasto) => {
                            const checked = form.selectedGastoIds.includes(Number(gasto.id));
                            const concepto = conceptoGastoById.get(Number(gasto.conceptoId));
                            const estado = estadoGastoById.get(Number(gasto.estadoId));
                            const simulation = gastoSimulationById.get(Number(gasto.id));
                            const label = gasto.descripcion || concepto?.nombre || `Gasto #${gasto.id}`;
                            return (
                              <Paper key={gasto.id} elevation={0} sx={{ p: 1.5, border: "1px solid", borderColor: checked ? "primary.main" : "divider", borderRadius: "10px" }}>
                                <Stack direction="row" alignItems="flex-start" spacing={1}>
                                  <Checkbox size="small" checked={checked} onChange={(e) => setForm((f) => { const s = new Set(f.selectedGastoIds); if (e.target.checked) s.add(Number(gasto.id)); else s.delete(Number(gasto.id)); const sel = [...s]; return { ...f, selectedGastoIds: sel, gastoVinculoId: sel[0] ? String(sel[0]) : "" }; })} sx={{ p: 0.5, mt: 0.25 }} />
                                  <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                                      <Typography variant="body2" sx={{ fontWeight: 900 }}>{label}</Typography>
                                      <Chip size="small" label={estado?.nombre || "Pendiente"} color="warning" sx={{ fontWeight: 900 }} />
                                    </Stack>
                                    <Stack direction="row" spacing={2} sx={{ mt: 0.5, flexWrap: "wrap", gap: 0.5 }}>
                                      <Typography variant="caption">{formatIsoDateShort(gasto.fechaGasto)}</Typography>
                                      <Typography variant="caption" sx={{ fontWeight: 900 }}>{formatMoneyAr(gasto.monto ?? 0)}</Typography>
                                      {checked && <Typography variant="caption" color={simulation?.cancelado ? "success.main" : "info.main"} sx={{ fontWeight: 800 }}>{simulation?.cancelado ? "Cancelado" : `Aplicado: ${formatMoneyAr(simulation?.aplicado ?? 0)}`}</Typography>}
                                    </Stack>
                                  </Box>
                                </Stack>
                              </Paper>
                            );
                          })}
                        </Stack>
                      </>
                    )}
                  </Collapse>
                  {errors.selectedGastoIds && (
                    <Typography variant="caption" color="error" sx={{ display: "block", px: 2, py: 1, fontWeight: 800 }}>
                      {errors.selectedGastoIds.message}
                    </Typography>
                  )}
                </Paper>
              </Grid>
            )}
            {tipoMovimiento === "ingreso" && honorariosSinPlanIngreso.length > 0 && (
              <Grid size={{ xs: 12 }}>
                <Paper elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2.5, overflow: "hidden" }}>
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    alignItems={{ xs: "flex-start", md: "center" }}
                    justifyContent="space-between"
                    spacing={1}
                    sx={{ px: 2, py: 1.5 }}
                  >
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                      <Checkbox
                        size="small"
                        checked={honorariosSinPlanIngreso.length > 0 && honorariosSinPlanIngreso.every((h) => form.selectedHonorarioIds.includes(Number(h.id)))}
                        indeterminate={honorariosSinPlanIngreso.some((h) => form.selectedHonorarioIds.includes(Number(h.id))) && !honorariosSinPlanIngreso.every((h) => form.selectedHonorarioIds.includes(Number(h.id)))}
                        onChange={(event) => {
                          const ids = honorariosSinPlanIngreso.map((h) => Number(h.id));
                          setForm((f) => {
                            const current = new Set(f.selectedHonorarioIds);
                            ids.forEach((id) => {
                              if (event.target.checked) current.add(id);
                              else current.delete(id);
                            });
                            return { ...f, selectedHonorarioIds: [...current] };
                          });
                        }}
                      />
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 950 }}>Honorarios sin plan</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 800 }}>
                          Cobro directo (parcial o total){selectedCaso ? ` · ${casoLabel(selectedCaso)}` : ""}
                        </Typography>
                      </Box>
                    </Stack>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Chip size="small" label={`${form.selectedHonorarioIds.length} honorarios seleccionados`} sx={{ fontWeight: 800 }} />
                      <Typography variant="body2" sx={{ fontWeight: 950 }}>
                        {formatMoneyAr(totalHonorariosDirectosSeleccionados)}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() => setHonorariosDirectosExpanded((value) => !value)}
                        aria-label={honorariosDirectosExpanded ? "Colapsar honorarios sin plan" : "Expandir honorarios sin plan"}
                      >
                        {honorariosDirectosExpanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                      </IconButton>
                    </Stack>
                  </Stack>
                  <Collapse in={honorariosDirectosExpanded}>
                    <Divider />
                    {honorariosSinPlanIngreso.length === 0 ? (
                      <Box sx={{ px: 2, py: 3, color: "text.secondary" }}>
                        <Typography variant="body2" sx={{ fontWeight: 800 }}>
                          {!form.clienteId ? "Seleccioná un cliente para ver honorarios sin plan." : honorariosPendientesQuery.isLoading ? "Cargando honorarios..." : "No hay honorarios sin plan pendientes para este filtro."}
                        </Typography>
                      </Box>
                    ) : (
                      <>
                        {/* Desktop */}
                        <TableContainer sx={{ display: { xs: "none", md: "block" } }}>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell padding="checkbox" />
                                <TableCell sx={{ fontWeight: 900 }}>Concepto</TableCell>
                                <TableCell sx={{ fontWeight: 900 }}>Vencimiento</TableCell>
                                <TableCell sx={{ fontWeight: 900 }}>Monto</TableCell>
                                <TableCell sx={{ fontWeight: 900 }}>Estado</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {honorariosSinPlanIngreso.map((h) => {
                                const checked = form.selectedHonorarioIds.includes(Number(h.id));
                                const chip = honorarioEstadoChip(h);
                                const label = h.concepto?.nombre || `Honorario #${h.id}`;
                                return (
                                  <TableRow key={h.id} hover>
                                    <TableCell padding="checkbox">
                                      <Checkbox size="small" checked={checked} onChange={(e) => setForm((f) => { const s = new Set(f.selectedHonorarioIds); if (e.target.checked) s.add(Number(h.id)); else s.delete(Number(h.id)); return { ...f, selectedHonorarioIds: [...s] }; })} />
                                    </TableCell>
                                    <TableCell sx={{ fontWeight: 800 }}>{label}</TableCell>
                                    <TableCell sx={{ whiteSpace: "nowrap" }}>{formatIsoDateShort(h.fechaVencimiento ?? h.fechaRegulacion)}</TableCell>
                                    <TableCell sx={{ whiteSpace: "nowrap", fontWeight: 900 }}>{formatMoneyAr(honorarioMontoBase(h))}</TableCell>
                                    <TableCell><Chip size="small" label={chip.label} color={chip.color} sx={{ fontWeight: 900 }} /></TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </TableContainer>
                        {/* Mobile */}
                        <Stack spacing={1} sx={{ display: { xs: "flex", md: "none" }, p: 1 }}>
                          {honorariosSinPlanIngreso.map((h) => {
                            const checked = form.selectedHonorarioIds.includes(Number(h.id));
                            const chip = honorarioEstadoChip(h);
                            const label = h.concepto?.nombre || `Honorario #${h.id}`;
                            return (
                              <Paper key={h.id} elevation={0} sx={{ p: 1.5, border: "1px solid", borderColor: checked ? "primary.main" : "divider", borderRadius: "10px" }}>
                                <Stack direction="row" alignItems="flex-start" spacing={1}>
                                  <Checkbox size="small" checked={checked} onChange={(e) => setForm((f) => { const s = new Set(f.selectedHonorarioIds); if (e.target.checked) s.add(Number(h.id)); else s.delete(Number(h.id)); return { ...f, selectedHonorarioIds: [...s] }; })} sx={{ p: 0.5, mt: 0.25 }} />
                                  <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                                      <Typography variant="body2" sx={{ fontWeight: 900 }}>{label}</Typography>
                                      <Chip size="small" label={chip.label} color={chip.color} sx={{ fontWeight: 900 }} />
                                    </Stack>
                                    <Stack direction="row" spacing={2} sx={{ mt: 0.5, flexWrap: "wrap", gap: 0.5 }}>
                                      <Typography variant="caption">{formatIsoDateShort(h.fechaVencimiento ?? h.fechaRegulacion)}</Typography>
                                      <Typography variant="caption" sx={{ fontWeight: 900 }}>{formatMoneyAr(honorarioMontoBase(h))}</Typography>
                                    </Stack>
                                  </Box>
                                </Stack>
                              </Paper>
                            );
                          })}
                        </Stack>
                      </>
                    )}
                  </Collapse>
                </Paper>
              </Grid>
            )}
            <Grid size={{ xs: 12 }}>
              <Controller
                name="descripcion"
                control={control}
                render={({ field }) => (
                  <TextField fullWidth size="small" label="Descripción" {...field} multiline minRows={2} />
                )}
              />
            </Grid>
            {planesIngreso.length > 0 && (
              <Grid size={{ xs: 12 }}>
                <Paper elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2.5, p: 2 }}>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>Importe del ingreso (ARS)</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 950 }}>{formatMoneyAr(importeIngresoArs)}</Typography>
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>Seleccionado</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 950 }}>{formatMoneyAr(totalSeleccionadoIngreso)}</Typography>
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>Disponible</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 950, color: disponibleIngreso > 0 ? "success.main" : "text.primary" }}>
                        {formatMoneyAr(disponibleIngreso)}
                      </Typography>
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>
            )}
          </Grid>
        )}

        {tipoMovimiento === "convenio" && (
          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12 }}>
              <Controller
                name="convenioHonorarioId"
                control={control}
                render={({ field, fieldState: { error } }) => (
                  <FormControl fullWidth size="small" error={Boolean(error)}>
                    <InputLabel>Honorario a financiar</InputLabel>
                    <Select
                      label="Honorario a financiar"
                      {...field}
                    >
                      <MenuItem value="">Seleccioná un honorario</MenuItem>
                      {(honorariosPendientesQuery.data ?? []).map((h) => (
                        <MenuItem key={h.id} value={String(h.id)}>
                          #{h.id} — {formatMoneyAr(honorarioMontoBase(h))}
                          {h.concepto?.nombre ? ` (${h.concepto.nombre})` : ""}
                          {h.caso?.caratula ? ` - ${h.caso.caratula}` : ""}
                        </MenuItem>
                      ))}
                    </Select>
                    {error && (
                      <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
                        {error.message}
                      </Typography>
                    )}
                  </FormControl>
                )}
              />
              {!form.clienteId && !lockClienteId && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                  Seleccioná un cliente primero para ver sus honorarios pendientes.
                </Typography>
              )}
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Controller
                name="convenioPeriodicidad"
                control={control}
                render={({ field, fieldState: { error } }) => (
                  <FormControl fullWidth size="small" error={Boolean(error)}>
                    <InputLabel>Periodicidad</InputLabel>
                    <Select
                      label="Periodicidad"
                      {...field}
                    >
                      <MenuItem value="">Seleccioná periodicidad</MenuItem>
                      {(catalog.PERIODICIDAD ?? []).map((p) => (
                        <MenuItem key={p.id} value={String(p.id)}>{p.nombre}</MenuItem>
                      ))}
                    </Select>
                    {error && (
                      <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
                        {error.message}
                      </Typography>
                    )}
                  </FormControl>
                )}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Controller
                name="convenioCuotas"
                control={control}
                render={({ field, fieldState: { error } }) => (
                  <TextField
                    {...field}
                    fullWidth
                    size="small"
                    type="number"
                    label="Cantidad de cuotas"
                    onChange={(e) => {
                      const val = e.target.value;
                      const cantidad = Number(val);
                      const base = planMontoBaseParaCuotas();
                      field.onChange(val === "" ? "" : cantidad);
                      if (cantidad > 0 && base > 0) {
                        setValue("convenioMontoCuota", (base / cantidad).toFixed(isConvenioHonorarioJus ? 4 : 2));
                      }
                    }}
                    error={Boolean(error)}
                    helperText={error?.message}
                    inputProps={{ min: 1, max: 240, step: 1, inputMode: "decimal" }}
                  />
                )}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Controller
                name="convenioMontoCuota"
                control={control}
                render={({ field, fieldState: { error } }) => (
                  <TextField
                    {...field}
                    fullWidth
                    size="small"
                    label={isConvenioHonorarioJus ? "Monto por cuota (JUS)" : "Monto por cuota (ARS)"}
                    onChange={(e) => field.onChange(e.target.value === "" ? "" : Number(e.target.value))}
                    error={Boolean(error)}
                    helperText={error?.message}
                    inputProps={{ decimalScale: isConvenioHonorarioJus ? 4 : 2, inputMode: "decimal" }}
                    InputProps={{
                      inputComponent: NumericFormatCustom,
                      startAdornment: isConvenioHonorarioJus ? undefined : <InputAdornment position="start">$</InputAdornment>,
                    }}
                  />
                )}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Controller
                name="convenioFechaInicio"
                control={control}
                render={({ field, fieldState: { error } }) => (
                  <TextField
                    {...field}
                    fullWidth
                    size="small"
                    type="date"
                    label="Fecha primer cuota"
                    error={Boolean(error)}
                    helperText={error?.message}
                    InputLabelProps={{ shrink: true }}
                  />
                )}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Controller
                name="tasaInteresMensual"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    size="small"
                    label="Tasa de interés mensual (%)"
                    type="number"
                    onChange={(e) => field.onChange(e.target.value === "" ? "" : Number(e.target.value))}
                    inputProps={{ min: 0, max: 100, step: 0.01, inputMode: "decimal" }}
                    helperText="Opcional. Ej: 4 para 4% mensual"
                  />
                )}
              />
            </Grid>
            {String(form.convenioPeriodicidad) === String(idPeriodicidadMensual) && (
              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="diaVencimiento"
                  control={control}
                  render={({ field, fieldState: { error } }) => (
                    <TextField
                      {...field}
                      fullWidth
                      size="small"
                      label="Día de vencimiento"
                      type="number"
                      onChange={(e) => field.onChange(e.target.value === "" ? "" : Number(e.target.value))}
                      error={Boolean(error)}
                      helperText={error?.message || "Día del mes en que vence cada cuota (ej: 5)"}
                      inputProps={{ min: 1, max: 31, inputMode: "decimal" }}
                    />
                  )}
                />
              </Grid>
            )}
            <Grid size={{ xs: 12 }}>
              <Controller
                name="convenioDescripcion"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    size="small"
                    label="Descripción del convenio (opcional)"
                    multiline
                    minRows={2}
                    placeholder="Ej: Plan de pagos acordado el 21/05/2026..."
                  />
                )}
              />
            </Grid>
            {Number(form.convenioCuotas) > 0 && Number(form.convenioMontoCuota) > 0 && (
              <Grid size={{ xs: 12 }}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 1.75,
                    borderRadius: "12px",
                    bgcolor: alpha(theme.palette.primary.main, 0.06),
                    border: "1px solid",
                    borderColor: alpha(theme.palette.primary.main, 0.2),
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 800, color: "primary.main" }}>
                    Resumen del plan
                  </Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
                    {form.convenioCuotas} cuotas de{" "}
                    <Box component="span" sx={{ fontWeight: 900, color: "text.primary" }}>
                      {isConvenioHonorarioJus ? `${Number(form.convenioMontoCuota).toLocaleString("es-AR", { maximumFractionDigits: 4 })} JUS` : formatMoneyAr(Number(form.convenioMontoCuota))}
                    </Box>
                    {" "}- Total:{" "}
                    <Box component="span" sx={{ fontWeight: 900, color: "primary.main" }}>
                      {isConvenioHonorarioJus
                        ? `${(Number(form.convenioCuotas) * Number(form.convenioMontoCuota)).toLocaleString("es-AR", { maximumFractionDigits: 4 })} JUS`
                        : formatMoneyAr(Number(form.convenioCuotas) * Number(form.convenioMontoCuota))}
                    </Box>
                    {isConvenioHonorarioJus && valorJusActual > 0 && (
                      <>
                        {" "}(
                        ≈ {formatMoneyAr(Number(form.convenioCuotas) * Number(form.convenioMontoCuota) * valorJusActual)} ARS al JUS actual)
                      </>
                    )}
                  </Typography>
                </Paper>
              </Grid>
            )}
          </Grid>
        )}

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} justifyContent="flex-end" sx={{ mt: 4 }}>
          <Button variant="outlined" onClick={navigateBack} disabled={saveMutation.isPending} sx={{ fontWeight: 800, borderRadius: "12px" }}>
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="contained"
            startIcon={saveMutation.isPending ? <CircularProgress size={18} color="inherit" /> : <Save />}
            disabled={saveMutation.isPending}
            sx={{ fontWeight: 900, borderRadius: "12px", minWidth: 160 }}
          >
            {isEdit ? "Guardar cambios" : tipoMovimiento === "convenio" ? "Crear plan" : "Guardar"}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
