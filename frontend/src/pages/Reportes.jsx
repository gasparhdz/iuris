import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { motion } from "framer-motion";
import { alpha, useTheme } from "@mui/material/styles";
import {
  Area,
  AreaChart,
  Bar,
  BarChart as RBarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Avatar,
  Box,
  Button,
  Chip,
  FormControl,
  GlobalStyles,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import {
  AccountBalanceWallet,
  AssignmentTurnedIn,
  BarChart as BarChartIcon,
  Download,
  FolderSpecial,
  Payments,
  Print,
  ReceiptLong,
  Search,
  TrendingDown,
  TrendingUp,
  WarningAmber,
  EventBusy,
  Schedule,
} from "@mui/icons-material";
import api from "../api/axios";
import { fetchEquipoUsuarios } from "../api/equipo";
import { useAuth } from "../auth/useAuth";
import {
  casoLabel,
  clienteLabel,
  compareValues,
  computeHonorarioAmounts,
  conceptoLabel,
  formatDateShort,
  formatMoneyAr,
  isHonorarioPendiente,
  movementAmountPesos,
  unwrapPaged,
} from "./finanzasUtils";

const CARD_TONES = {
  blue: "#5B7CFA",
  orange: "#FFA726",
  green: "#2EBD85",
  red: "#EF5350",
  violet: "#8B5CF6",
  cyan: "#29B6F6",
};

// Paleta rotativa para las barras del Top deudores (una por cliente).
const DEUDOR_BAR_COLORS = [
  CARD_TONES.orange,
  CARD_TONES.blue,
  CARD_TONES.violet,
  CARD_TONES.green,
  CARD_TONES.cyan,
  CARD_TONES.red,
];

const PIE_COLORS = [
  CARD_TONES.blue,
  CARD_TONES.green,
  CARD_TONES.orange,
  CARD_TONES.red,
  CARD_TONES.violet,
  CARD_TONES.cyan,
  "#66BB6A",
  "#EC407A",
];

const PERIODS = [
  { key: "mes", label: "Este mes" },
  { key: "trimestre", label: "Trimestre" },
  { key: "semestre", label: "Semestre" },
  { key: "anio", label: "Este año" },
  { key: "anio_anterior", label: "Año anterior" },
  { key: "custom", label: "Personalizado" },
];

const panelSx = {
  borderRadius: "16px",
  border: "1px solid",
  borderColor: "divider",
  bgcolor: "background.paper",
  boxShadow: "none",
};

function hasDirectorRole(user) {
  const userRol = String(user?.rol ?? "").toUpperCase();
  const userRoles = Array.isArray(user?.roles) ? user.roles.map((role) => String(role).toUpperCase()) : [];
  return userRol === "DIRECTOR" || userRoles.includes("DIRECTOR");
}

function toDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function dateInputValue(date) {
  if (!date) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function fromInputDate(value, end = false) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  return end ? endOfDay(date) : startOfDay(date);
}

function getPeriodRange(period, customFrom, customTo) {
  const now = new Date();
  if (period === "custom") {
    return { from: fromInputDate(customFrom), to: fromInputDate(customTo, true) };
  }
  if (period === "mes") return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: endOfDay(now) };
  if (period === "trimestre") {
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
    return { from: new Date(now.getFullYear(), quarterStartMonth, 1), to: endOfDay(now) };
  }
  if (period === "semestre") {
    const semesterStartMonth = now.getMonth() < 6 ? 0 : 6;
    return { from: new Date(now.getFullYear(), semesterStartMonth, 1), to: endOfDay(now) };
  }
  if (period === "anio_anterior") {
    return {
      from: new Date(now.getFullYear() - 1, 0, 1),
      to: endOfDay(new Date(now.getFullYear() - 1, 11, 31)),
    };
  }
  return { from: new Date(now.getFullYear(), 0, 1), to: endOfDay(now) };
}

function isInRange(value, from, to) {
  const date = toDate(value);
  if (!date) return false;
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date) {
  return new Intl.DateTimeFormat("es-AR", { month: "short" }).format(date).replace(".", "");
}

function buildMonthBuckets(from, to) {
  const start = from || new Date(new Date().getFullYear(), 0, 1);
  const end = to || new Date();
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  const buckets = [];
  while (cursor <= last) {
    buckets.push({
      key: monthKey(cursor),
      mes: monthLabel(cursor),
      cobrado: 0,
      pendiente: 0,
      aperturas: 0,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return buckets;
}

function getPersonaName(item) {
  return item?.razonSocial || [item?.apellido, item?.nombre].filter(Boolean).join(", ") || item?.nombre || item?.email || "Sin nombre";
}

function userName(user) {
  return [user?.nombre, user?.apellido].filter(Boolean).join(" ") || user?.email || `Usuario #${user?.id}`;
}

function getClienteId(item) {
  return Number(item?.clienteId ?? item?.cliente?.id ?? item?.expediente?.clienteId ?? item?.caso?.clienteId ?? 0);
}

function getExpedienteClienteId(expediente) {
  return Number(expediente?.clienteId ?? expediente?.cliente?.id ?? expediente?.clientePrincipalId ?? 0);
}

function isExpedienteActivo(expediente) {
  // El dato real es el booleano `activo`; si no viene, caemos a códigos de estado.
  if (typeof expediente?.activo === "boolean") return expediente.activo;
  const estado = String(expediente?.estado?.codigo || expediente?.estado || expediente?.estadoNombre || "").toUpperCase();
  return !["CERRADO", "FINALIZADO", "ARCHIVADO"].includes(estado);
}

function lastMovementDate(expediente) {
  const candidates = [
    expediente?.sisfeFechaUltimaActualizacion,
    expediente?.sisfeFechaUbicacionActual,
    expediente?.updatedAt,
    expediente?.fechaEstado,
    expediente?.createdAt,
  ]
    .map(toDate)
    .filter(Boolean);
  if (!candidates.length) return null;
  return new Date(Math.max(...candidates.map((d) => d.getTime())));
}

function daysSince(date) {
  const d = toDate(date);
  if (!d) return null;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function daysUntil(date) {
  const d = toDate(date);
  if (!d) return null;
  return Math.ceil((startOfDay(d).getTime() - startOfDay(new Date()).getTime()) / (1000 * 60 * 60 * 24));
}

function isTaskAssignedTo(task, userId) {
  if (Number(task?.asignadoA ?? task?.asignadoId ?? task?.asignado?.id) === Number(userId)) return true;
  const asignados = Array.isArray(task?.asignados) ? task.asignados : [];
  return asignados.some((item) => Number(item?.id ?? item?.usuarioId ?? item?.usuario?.id) === Number(userId));
}

function isTaskOverdue(task) {
  const limit = toDate(task?.fechaLimite);
  return !task?.completada && Boolean(limit) && limit < new Date();
}

function isCaseAssignedTo(expediente, userId) {
  return (
    Number(expediente?.responsableId) === Number(userId)
    || Number(expediente?.abogadoId) === Number(userId)
  );
}

function expedienteDate(expediente) {
  return expediente?.createdAt || expediente?.fechaInicio || expediente?.fechaAlta || expediente?.fecha;
}

function expedienteTipo(expediente, tipoCasoById) {
  if (tipoCasoById && expediente?.tipoId != null) {
    const tipo = tipoCasoById.get(Number(expediente.tipoId));
    if (tipo?.nombre) return tipo.nombre;
  }
  return expediente?.tipoExpediente?.nombre || expediente?.tipo?.nombre || expediente?.tipoExpedienteNombre || expediente?.tipo || "Sin tipo";
}

function compactLabel(value, maxLength = 34) {
  const text = String(value || "Sin dato").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function gastoConceptoReportLabel(item) {
  const fromConcepto = item?.concepto?.nombre || item?.conceptoNombre;
  if (fromConcepto) return fromConcepto;

  const description = String(item?.descripcion || "").trim();
  const generic = description.match(/^([A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]+?)(?:\s+(?:devengad[oa]|en|del|de)\b|\.|,|$)/);
  return generic?.[1]?.trim() || description || "Sin concepto";
}

function ChartTooltip({ active, payload, label, money = false }) {
  if (!active || !payload?.length) return null;
  return (
    <Paper elevation={0} sx={{ ...panelSx, p: 1.25, borderRadius: "12px" }}>
      <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 900 }}>
        {label}
      </Typography>
      <Stack spacing={0.4} sx={{ mt: 0.5 }}>
        {payload.map((entry) => (
          <Typography key={entry.dataKey} variant="caption" sx={{ color: entry.color, fontWeight: 800 }}>
            {entry.name}: {money ? formatMoneyAr(entry.value) : entry.value}
          </Typography>
        ))}
      </Stack>
    </Paper>
  );
}

function PieTooltip({ active, payload, money = false }) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  return (
    <Paper elevation={0} sx={{ ...panelSx, p: 1.25, borderRadius: "12px" }}>
      <Typography variant="caption" sx={{ fontWeight: 900 }}>
        {entry.name}
      </Typography>
      <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.4, fontWeight: 800 }}>
        {money ? formatMoneyAr(entry.value) : entry.value}
      </Typography>
    </Paper>
  );
}

function KpiCard({ title, value, caption, icon, tone, loading }) {
  const theme = useTheme();
  return (
    <Paper elevation={0} sx={{ ...panelSx, p: 2.25, height: "100%" }}>
      <Stack direction="row" justifyContent="space-between" spacing={2}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {title}
          </Typography>
          <Typography sx={{ fontSize: { xs: "1.55rem", md: "1.85rem" }, fontWeight: 950, lineHeight: 1.1, mt: 0.8 }}>
            {loading ? <Skeleton width={120} /> : value}
          </Typography>
          <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.6, fontWeight: 700 }}>
            {caption}
          </Typography>
        </Box>
        <Avatar
          sx={{
            width: 46,
            height: 46,
            bgcolor: alpha(tone, theme.palette.mode === "dark" ? 0.18 : 0.12),
            color: tone,
            border: `1px solid ${alpha(tone, 0.28)}`,
          }}
        >
          {icon}
        </Avatar>
      </Stack>
    </Paper>
  );
}

function ChartPanel({ title, subtitle, loading, children }) {
  return (
    <Paper elevation={0} sx={{ ...panelSx, p: 2.25, height: "100%" }}>
      <Box sx={{ mb: 1.75 }}>
        <Typography variant="h6" sx={{ fontWeight: 900 }}>
          {title}
        </Typography>
        <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
          {subtitle}
        </Typography>
      </Box>
      {loading ? <Skeleton variant="rounded" height={280} /> : children}
    </Paper>
  );
}

function TableShell({ loading, isEmpty, emptyTitle, children }) {
  if (loading) {
    return (
      <Paper elevation={0} sx={{ ...panelSx, p: 2 }}>
        <Stack spacing={1}>
          {Array.from({ length: 7 }).map((_, index) => (
            <Skeleton key={index} variant="rounded" height={38} />
          ))}
        </Stack>
      </Paper>
    );
  }
  if (isEmpty) {
    return (
      <Paper elevation={0} sx={{ ...panelSx, p: 5, textAlign: "center" }}>
        <Typography variant="h6" sx={{ fontWeight: 900 }}>
          {emptyTitle}
        </Typography>
      </Paper>
    );
  }
  return (
    <Paper elevation={0} sx={{ ...panelSx, overflow: "hidden" }}>
      <TableContainer>{children}</TableContainer>
    </Paper>
  );
}

async function fetchReportItems(path, maxItems = 500) {
  const pageSize = 100;
  let page = 1;
  let total = Infinity;
  const items = [];

  while (items.length < maxItems && items.length < total) {
    const { data } = await api.get(path, { params: { page, limit: Math.min(pageSize, maxItems - items.length) } });
    const result = unwrapPaged(data);
    items.push(...result.items);
    total = Number(result.meta?.total ?? items.length);

    if (result.items.length < pageSize) break;
    page += 1;
  }

  return items.slice(0, maxItems);
}

function StatusChip({ status }) {
  const tone = status === "Moroso" ? CARD_TONES.red : status === "Deudor" ? CARD_TONES.orange : CARD_TONES.green;
  return (
    <Chip
      size="small"
      label={status}
      sx={{ bgcolor: alpha(tone, 0.12), color: tone, border: `1px solid ${alpha(tone, 0.3)}`, fontWeight: 900 }}
    />
  );
}

export default function Reportes() {
  const { user } = useAuth();
  const isDirector = hasDirectorRole(user);
  const [tab, setTab] = useState("financiero");
  const [period, setPeriod] = useState("anio");
  const [customFrom, setCustomFrom] = useState(dateInputValue(new Date(new Date().getFullYear(), 0, 1)));
  const [customTo, setCustomTo] = useState(dateInputValue(new Date()));
  const [clientSearch, setClientSearch] = useState("");
  const [clientOrderBy, setClientOrderBy] = useState("saldo");
  const [clientOrder, setClientOrder] = useState("desc");

  useEffect(() => {
    if (!isDirector && tab === "productividad") setTab("financiero");
  }, [isDirector, tab]);

  const availableTabs = useMemo(
    () => [
      { key: "financiero", label: "Resumen Financiero" },
      { key: "clientes", label: "Cartera de Clientes" },
      { key: "expedientes", label: "Estado de Expedientes" },
      { key: "vencimientos", label: "Vencimientos" },
      ...(isDirector ? [{ key: "productividad", label: "Productividad por Abogado" }] : []),
    ],
    [isDirector],
  );

  const activeIndex = Math.max(0, availableTabs.findIndex((item) => item.key === tab));
  const { from, to } = useMemo(() => getPeriodRange(period, customFrom, customTo), [period, customFrom, customTo]);

  const honorariosQuery = useQuery({
    queryKey: ["reportes", "honorarios"],
    queryFn: () => fetchReportItems("/honorarios"),
    staleTime: 60_000,
  });

  const gastosQuery = useQuery({
    queryKey: ["reportes", "gastos"],
    queryFn: () => fetchReportItems("/gastos"),
    staleTime: 60_000,
  });

  const ingresosQuery = useQuery({
    queryKey: ["reportes", "ingresos"],
    queryFn: () => fetchReportItems("/ingresos"),
    staleTime: 60_000,
  });

  const expedientesQuery = useQuery({
    queryKey: ["reportes", "expedientes"],
    queryFn: () => fetchReportItems("/expedientes"),
    staleTime: 60_000,
  });

  const clientesQuery = useQuery({
    queryKey: ["reportes", "clientes"],
    queryFn: () => fetchReportItems("/clientes"),
    staleTime: 60_000,
  });

  const tareasQuery = useQuery({
    queryKey: ["reportes", "tareas"],
    queryFn: () => fetchReportItems("/tareas"),
    staleTime: 60_000,
  });

  const eventosQuery = useQuery({
    queryKey: ["reportes", "eventos"],
    queryFn: () => fetchReportItems("/eventos"),
    staleTime: 60_000,
  });

  const proyeccionQuery = useQuery({
    queryKey: ["reportes", "proyeccion-cobranzas"],
    queryFn: async () => {
      const { data } = await api.get("/planes/cuotas/proyeccion");
      return Array.isArray(data?.data) ? data.data : [];
    },
    staleTime: 60_000,
  });

  const equipoQuery = useQuery({
    queryKey: ["reportes", "equipo", "usuarios"],
    queryFn: fetchEquipoUsuarios,
    enabled: isDirector,
    staleTime: 60_000,
  });

  const valorJusQuery = useQuery({
    queryKey: ["valorjus", "actual"],
    queryFn: async () => {
      const { data } = await api.get("/valorjus/actual");
      return data?.data ?? data;
    },
    staleTime: 60_000,
  });

  // Resumen de cuenta corriente por deudor calculado en el backend (motor Decimal).
  const ccResumenQuery = useQuery({
    queryKey: ["clientes", "cuentas-corrientes"],
    queryFn: async () => {
      // El backend limita a 100 por página: paginamos hasta traer todo.
      const pageSize = 100;
      const items = [];
      let pageNum = 1;
      for (;;) {
        const { data } = await api.get("/clientes/cuentas-corrientes", { params: { limit: pageSize, page: pageNum } });
        const page = data?.data?.items ?? data?.data ?? [];
        if (!Array.isArray(page) || page.length === 0) break;
        items.push(...page);
        if (page.length < pageSize || items.length >= 10000) break;
        pageNum += 1;
      }
      return items;
    },
    staleTime: 60_000,
  });

  const ccResumenItems = useMemo(() => {
    const raw = ccResumenQuery.data;
    return Array.isArray(raw) ? raw : [];
  }, [ccResumenQuery.data]);

  const catalogQuery = useQuery({
    queryKey: ["reportes", "catalogos", "finanzas"],
    queryFn: async () => {
      const cats = ["MONEDA", "POLITICA_JUS", "TIPO_CASO", "ESTADO_CASO"];
      const entries = await Promise.all(
        cats.map(async (categoria) => {
          const { data } = await api.get("/catalogos/parametros", { params: { categoria } });
          const raw = data?.data ?? data;
          return [categoria, Array.isArray(raw) ? raw : []];
        }),
      );
      return Object.fromEntries(entries);
    },
    staleTime: 60_000,
  });

  const honorarios = useMemo(() => honorariosQuery.data ?? [], [honorariosQuery.data]);
  const gastos = useMemo(() => gastosQuery.data ?? [], [gastosQuery.data]);
  const ingresos = useMemo(() => ingresosQuery.data ?? [], [ingresosQuery.data]);
  const expedientes = useMemo(() => expedientesQuery.data ?? [], [expedientesQuery.data]);
  const clientes = useMemo(() => clientesQuery.data ?? [], [clientesQuery.data]);
  const tareas = useMemo(() => tareasQuery.data ?? [], [tareasQuery.data]);
  const equipo = useMemo(() => equipoQuery.data ?? [], [equipoQuery.data]);
  const valorJusActual = Number(valorJusQuery.data?.valor ?? 0);
  const catalogMonedas = useMemo(() => catalogQuery.data?.MONEDA ?? [], [catalogQuery.data?.MONEDA]);
  const catalogPoliticas = useMemo(() => catalogQuery.data?.POLITICA_JUS ?? [], [catalogQuery.data?.POLITICA_JUS]);

  const eventos = useMemo(() => eventosQuery.data ?? [], [eventosQuery.data]);
  const proyeccionCuotas = useMemo(() => proyeccionQuery.data ?? [], [proyeccionQuery.data]);
  const tipoCasoById = useMemo(() => new Map((catalogQuery.data?.TIPO_CASO ?? []).map((t) => [Number(t.id), t])), [catalogQuery.data?.TIPO_CASO]);

  const clientesById = useMemo(() => new Map(clientes.map((cliente) => [Number(cliente.id), cliente])), [clientes]);
  const expedientesById = useMemo(() => new Map(expedientes.map((item) => [Number(item.id), item])), [expedientes]);

  const financial = useMemo(() => {
    const buckets = buildMonthBuckets(from, to);
    const byMonth = new Map(buckets.map((bucket) => [bucket.key, bucket]));
    const periodHonorarios = honorarios.filter((item) => isInRange(item.fechaRegulacion || item.fecha, from, to));
    const periodGastos = gastos.filter((item) => isInRange(item.fecha || item.fechaGasto, from, to));
    const periodIngresos = ingresos.filter((item) => isInRange(item.fecha || item.fechaIngreso, from, to));

    let totalCobrado = 0;
    let totalPendiente = 0;
    periodHonorarios.forEach((item) => {
      const date = toDate(item.fechaRegulacion || item.fecha);
      const amount = computeHonorarioAmounts(item, valorJusActual, catalogMonedas, catalogPoliticas).updatedVal;
      const target = isHonorarioPendiente(item) ? "pendiente" : "cobrado";
      if (target === "pendiente") totalPendiente += amount;
      else totalCobrado += amount;
      if (date && byMonth.has(monthKey(date))) {
        byMonth.get(monthKey(date))[target] += amount;
      }
    });

    const gastosByConcepto = new Map();
    const totalGastos = periodGastos.reduce((sum, item) => {
      const amount = movementAmountPesos(item, "gasto", valorJusActual, catalogMonedas);
      const label = gastoConceptoReportLabel(item) || conceptoLabel(item) || "Sin concepto";
      gastosByConcepto.set(label, (gastosByConcepto.get(label) ?? 0) + amount);
      return sum + amount;
    }, 0);
    const totalIngresos = periodIngresos.reduce((sum, item) => sum + movementAmountPesos(item, "ingreso", valorJusActual, catalogMonedas), 0);

    const honorariosExport = periodHonorarios.map((item) => {
      const expediente = item.expediente || item.caso || expedientesById.get(Number(item.expedienteId ?? item.casoId));
      const cliente = item.cliente || expediente?.cliente || clientesById.get(getClienteId(item));
      const deudor = item.obligadoNombre
        || item.parte?.nombre
        || clienteLabel(cliente)
        || "Sin deudor";
      return {
        Fecha: formatDateShort(item.fechaRegulacion || item.fecha),
        Cliente: clienteLabel(cliente) || "Sin cliente",
        Deudor: deudor,
        Expediente: casoLabel(expediente) || "Sin expediente",
        Monto: computeHonorarioAmounts(item, valorJusActual, catalogMonedas, catalogPoliticas).updatedVal,
        Estado: isHonorarioPendiente(item) ? "Pendiente" : "Cobrado",
      };
    });

    return {
      monthly: buckets,
      gastosPie: (() => {
        const sorted = Array.from(gastosByConcepto.entries())
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value);
        const main = sorted.slice(0, 6);
        const others = sorted.slice(6).reduce((sum, item) => sum + item.value, 0);
        return others > 0 ? [...main, { name: "Otros", value: others }] : main;
      })(),
      kpis: {
        totalCobrado,
        totalPendiente,
        totalGastos,
        totalIngresos,
        saldoNeto: totalCobrado + totalIngresos - totalGastos,
      },
      honorariosExport,
    };
  }, [honorarios, gastos, ingresos, from, to, valorJusActual, catalogMonedas, catalogPoliticas, clientesById, expedientesById]);

  const productividad = useMemo(() => {
    if (!isDirector) return [];
    return equipo
      .filter((usuario) => usuario?.activo !== false && !usuario?.deletedAt)
      .map((usuario) => {
        const userTasks = tareas.filter((task) => isTaskAssignedTo(task, usuario.id));
        return {
          id: usuario.id,
          abogado: userName(usuario),
          completadas: userTasks.filter((task) => task.completada).length,
          pendientes: userTasks.filter((task) => !task.completada).length,
          vencidas: userTasks.filter(isTaskOverdue).length,
          expedientesActivos: expedientes.filter((expediente) => isExpedienteActivo(expediente) && isCaseAssignedTo(expediente, usuario.id)).length,
        };
      });
  }, [isDirector, equipo, tareas, expedientes]);

  const cartera = useMemo(() => {
    const rows = ccResumenItems.map((item) => {
      const tipoDeudor = item.tipoDeudor ?? "cliente";
      const clienteId = item.clienteId != null ? Number(item.clienteId) : null;
      const terceroId = item.terceroId != null ? Number(item.terceroId) : null;
      const totales = item.totales;
      const saldo = Number(totales?.saldoPesos || 0);
      const estado = saldo > 50_000 ? "Moroso" : saldo > 0 ? "Deudor" : "Al día";
      const nombre = item.deudorNombre
        || (clienteId != null ? getPersonaName(clientesById.get(clienteId)) : null)
        || (tipoDeudor === "tercero" ? `Tercero #${terceroId}` : `Cliente #${clienteId}`);
      return {
        id: tipoDeudor === "tercero" ? `tercero:${terceroId}` : `cliente:${clienteId}`,
        tipoDeudor,
        cliente: nombre,
        expedientesActivos: clienteId != null
          ? expedientes.filter((expediente) => getExpedienteClienteId(expediente) === clienteId && isExpedienteActivo(expediente)).length
          : 0,
        honorariosPendientes: Number(totales?.honorariosPendientesPesos || 0),
        saldo,
        estado,
      };
    });

    const query = clientSearch.trim().toLowerCase();
    return rows
      .filter((row) => !query || row.cliente.toLowerCase().includes(query) || row.tipoDeudor.includes(query))
      .sort((a, b) => {
        const direction = clientOrder === "asc" ? 1 : -1;
        return compareValues(a[clientOrderBy], b[clientOrderBy]) * direction;
      });
  }, [ccResumenItems, clientesById, expedientes, clientSearch, clientOrderBy, clientOrder]);

  const clientesEstadoPie = useMemo(() => {
    const counts = new Map([
      ["Al día", 0],
      ["Deudor", 0],
      ["Moroso", 0],
    ]);
    cartera.forEach((row) => counts.set(row.estado, (counts.get(row.estado) ?? 0) + 1));
    return Array.from(counts.entries()).map(([name, value]) => ({ name, value }));
  }, [cartera]);

  const resumenFinanciero = useMemo(() => {
    // Saldos reales por deudor (sin filtro de búsqueda), usando la cuenta corriente
    let totalHonorariosPendientes = 0;
    let totalACobrar = 0;
    const deudores = [];
    ccResumenItems.forEach((item) => {
      const totales = item.totales;
      const saldo = Math.max(0, Number(totales?.saldoPesos || 0));
      totalHonorariosPendientes += Number(totales?.honorariosPendientesPesos || 0);
      totalACobrar += saldo;
      if (saldo > 0) {
        const nombre = item.deudorNombre
          || (item.clienteId != null ? getPersonaName(clientesById.get(Number(item.clienteId))) : null)
          || (item.tipoDeudor === "tercero" ? `Tercero #${item.terceroId}` : `Cliente #${item.clienteId}`);
        deudores.push({ name: compactLabel(nombre, 22), saldo });
      }
    });

    // Período: cobrado (ingresos) y gastos
    const periodIngresos = ingresos.filter((item) => isInRange(item.fecha || item.fechaIngreso, from, to));
    const periodGastos = gastos.filter((item) => isInRange(item.fecha || item.fechaGasto, from, to));
    const totalCobrado = periodIngresos.reduce((sum, item) => sum + movementAmountPesos(item, "ingreso", valorJusActual, catalogMonedas), 0);
    const totalGastos = periodGastos.reduce((sum, item) => sum + movementAmountPesos(item, "gasto", valorJusActual, catalogMonedas), 0);

    // Evolución mensual: cobrado real (ingresos, por fecha de cobro) vs pendiente (saldo de
    // cuotas por fecha de vencimiento; incluye cuotas vencidas e impagas).
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 6, 1);
    const buckets = [];
    const byKey = new Map();
    const cursor = new Date(start);
    while (cursor <= end) {
      const bucket = { key: monthKey(cursor), mes: `${monthLabel(cursor)} ${String(cursor.getFullYear()).slice(2)}`, cobrado: 0, pendiente: 0 };
      buckets.push(bucket);
      byKey.set(bucket.key, bucket);
      cursor.setMonth(cursor.getMonth() + 1);
    }
    ingresos.forEach((item) => {
      const date = toDate(item.fecha || item.fechaIngreso);
      if (date && byKey.has(monthKey(date))) byKey.get(monthKey(date)).cobrado += movementAmountPesos(item, "ingreso", valorJusActual, catalogMonedas);
    });
    proyeccionCuotas.forEach((cuota) => {
      const date = toDate(cuota.vencimiento);
      const saldo = Number(cuota.saldoPesos || 0);
      if (date && saldo > 0 && byKey.has(monthKey(date))) byKey.get(monthKey(date)).pendiente += saldo;
    });

    return {
      totalCobrado,
      totalGastos,
      totalHonorariosPendientes,
      totalACobrar,
      mensual: buckets,
      topDeudores: deudores.sort((a, b) => b.saldo - a.saldo).slice(0, 8),
    };
  }, [ccResumenItems, clientesById, ingresos, gastos, proyeccionCuotas, from, to, valorJusActual, catalogMonedas]);

  const SIN_MOVIMIENTO_DIAS = 90;

  const estadoExpedientes = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const last12 = buildMonthBuckets(new Date(now.getFullYear(), now.getMonth() - 11, 1), now);
    const byMonth = new Map(last12.map((bucket) => [bucket.key, bucket]));
    const tipos = new Map();

    expedientes.forEach((expediente) => {
      const openDate = toDate(expedienteDate(expediente));
      if (openDate && byMonth.has(monthKey(openDate))) byMonth.get(monthKey(openDate)).aperturas += 1;
      const tipo = expedienteTipo(expediente, tipoCasoById);
      tipos.set(tipo, (tipos.get(tipo) ?? 0) + 1);
    });

    const sinMovimiento = expedientes
      .filter(isExpedienteActivo)
      .map((item) => ({ item, dias: daysSince(lastMovementDate(item)) }))
      .filter((row) => row.dias !== null && row.dias >= SIN_MOVIMIENTO_DIAS)
      .sort((a, b) => b.dias - a.dias);

    return {
      activos: expedientes.filter(isExpedienteActivo).length,
      cerrados: expedientes.filter((item) => !isExpedienteActivo(item)).length,
      abiertosMes: expedientes.filter((item) => {
        const date = toDate(expedienteDate(item));
        return date && date >= monthStart;
      }).length,
      sinMovimiento: sinMovimiento.length,
      sinMovimientoRows: sinMovimiento.map((row) => ({
        id: row.item.id,
        expediente: casoLabel(row.item),
        cliente: clienteLabel(row.item.cliente) || clienteLabel(clientesById.get(getExpedienteClienteId(row.item))) || "Sin cliente",
        tipo: expedienteTipo(row.item, tipoCasoById),
        dias: row.dias,
        ultimoMovimiento: formatDateShort(lastMovementDate(row.item)),
      })),
      aperturas: last12,
      tipos: Array.from(tipos.entries()).map(([name, cantidad]) => ({ name, cantidad })).sort((a, b) => b.cantidad - a.cantidad),
      exportRows: expedientes.map((item) => ({
        Expediente: casoLabel(item),
        Cliente: clienteLabel(item.cliente) || clienteLabel(clientesById.get(getExpedienteClienteId(item))) || "Sin cliente",
        Tipo: expedienteTipo(item, tipoCasoById),
        Estado: isExpedienteActivo(item) ? "Activo" : "Cerrado",
        Apertura: formatDateShort(expedienteDate(item)),
        "Días sin movimiento": daysSince(lastMovementDate(item)) ?? "",
      })),
    };
  }, [expedientes, clientesById, tipoCasoById]);

  const vencimientos = useMemo(() => {
    const items = [];
    tareas.forEach((tarea) => {
      if (tarea.completada) return;
      const fecha = toDate(tarea.fechaLimite);
      if (!fecha) return;
      items.push({ id: `t-${tarea.id}`, tipo: "Tarea", titulo: tarea.titulo, fecha, dias: daysUntil(fecha), clienteId: tarea.clienteId, casoId: tarea.casoId });
    });
    eventos.forEach((evento) => {
      const fecha = toDate(evento.fechaInicio);
      if (!fecha) return;
      items.push({ id: `e-${evento.id}`, tipo: "Evento", titulo: evento.descripcion || "Evento agendado", fecha, dias: daysUntil(fecha), clienteId: evento.clienteId, casoId: evento.casoId });
    });
    const horizon = items.filter((item) => item.dias !== null && item.dias <= 30).sort((a, b) => a.fecha - b.fecha);
    const count = (pred) => horizon.filter(pred).length;
    return {
      rows: horizon,
      vencidas: count((i) => i.dias < 0),
      hoy: count((i) => i.dias === 0),
      semana: count((i) => i.dias > 0 && i.dias <= 7),
      mes: count((i) => i.dias > 7 && i.dias <= 30),
    };
  }, [tareas, eventos]);

  const loadingFinancial = [honorariosQuery, gastosQuery, ingresosQuery, valorJusQuery, catalogQuery].some((query) => query.isLoading);
  const loadingProductividad = isDirector && [equipoQuery, tareasQuery, expedientesQuery].some((query) => query.isLoading);
  const loadingCartera = [clientesQuery, honorariosQuery, gastosQuery, ingresosQuery, expedientesQuery, valorJusQuery, catalogQuery].some((query) => query.isLoading);
  const loadingExpedientes = [expedientesQuery, catalogQuery].some((query) => query.isLoading);
  const loadingVencimientos = [tareasQuery, eventosQuery].some((query) => query.isLoading);

  const handleClientSort = (field) => {
    if (clientOrderBy === field) {
      setClientOrder((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setClientOrderBy(field);
    setClientOrder(field === "cliente" ? "asc" : "desc");
  };

  const handleExportExcel = () => {
    const sheets = {
      financiero: { name: "Honorarios", rows: financial.honorariosExport },
      productividad: {
        name: "Productividad",
        rows: productividad.map((row) => ({
          Abogado: row.abogado,
          "Tareas completadas": row.completadas,
          "Tareas pendientes": row.pendientes,
          "Tareas vencidas": row.vencidas,
          "Expedientes activos asignados": row.expedientesActivos,
        })),
      },
      clientes: {
        name: "Cartera",
        rows: cartera.map((row) => ({
          Deudor: row.cliente,
          Tipo: row.tipoDeudor === "tercero" ? "Tercero" : "Cliente",
          "Expedientes activos": row.expedientesActivos,
          "Honorarios pendientes": row.honorariosPendientes,
          Saldo: row.saldo,
          Estado: row.estado,
        })),
      },
      expedientes: { name: "Expedientes", rows: estadoExpedientes.exportRows },
      vencimientos: {
        name: "Vencimientos",
        rows: vencimientos.rows.map((row) => ({
          Tipo: row.tipo,
          Detalle: row.titulo,
          Fecha: formatDateShort(row.fecha),
          Estado: row.dias < 0 ? `Vencido (${Math.abs(row.dias)}d)` : row.dias === 0 ? "Hoy" : `En ${row.dias}d`,
          Cliente: clienteLabel(clientesById.get(Number(row.clienteId))) || "—",
        })),
      },
    };
    const current = sheets[tab] ?? sheets.financiero;
    const worksheet = XLSX.utils.json_to_sheet(current.rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, current.name);
    XLSX.writeFile(workbook, `reportes_${current.name.toLowerCase()}_${dateInputValue(new Date())}.xlsx`);
  };

  return (
    <Box className="reportes-page" sx={{ pb: 4 }}>
      <GlobalStyles
        styles={{
          "@media print": {
            ".MuiAppBar-root, .MuiDrawer-root, .reportes-actions, .reportes-tabs": { display: "none !important" },
            "main": { marginLeft: "0 !important", width: "100% !important", padding: "16px !important" },
            ".reportes-page": { paddingBottom: "0 !important" },
            ".reportes-print-scope": { display: "block !important" },
            ".reportes-no-print": { display: "none !important" },
          },
        }}
      />

      <Stack
        component={motion.div}
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", md: "center" }}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 950, mb: 0.5 }}>
            Reportes y Estadísticas
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", fontWeight: 700 }}>
            Indicadores financieros, productividad, cartera y expedientes.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.25} className="reportes-actions">
          <Button variant="outlined" startIcon={<Print />} onClick={() => window.print()} sx={{ borderRadius: "12px", fontWeight: 900 }}>
            Imprimir / PDF
          </Button>
          <Button variant="contained" startIcon={<Download />} onClick={handleExportExcel} sx={{ borderRadius: "12px", fontWeight: 900 }}>
            Exportar Excel
          </Button>
        </Stack>
      </Stack>

      <Paper elevation={0} sx={{ ...panelSx, overflow: "hidden" }}>
        <Box className="reportes-tabs" sx={{ px: 2, pt: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
          <Tabs
            value={activeIndex}
            onChange={(_, index) => setTab(availableTabs[index].key)}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            sx={{ minHeight: 44, "& .MuiTab-root": { minHeight: 44, fontWeight: 900, textTransform: "none" } }}
          >
            {availableTabs.map((item) => (
              <Tab key={item.key} label={item.label} />
            ))}
          </Tabs>
        </Box>

        <Box className="reportes-print-scope" sx={{ p: 2 }}>
          {tab === "financiero" && (
            <Box component={motion.div} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
              <Paper elevation={0} className="reportes-no-print" sx={{ ...panelSx, p: 1.5, mb: 2 }}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} useFlexGap alignItems={{ xs: "stretch", sm: "center" }}>
                  <FormControl size="small" sx={{ minWidth: 220 }}>
                    <InputLabel id="reportes-periodo-label">Período</InputLabel>
                    <Select
                      labelId="reportes-periodo-label"
                      label="Período"
                      value={period}
                      onChange={(event) => setPeriod(event.target.value)}
                    >
                      {PERIODS.map((item) => (
                        <MenuItem key={item.key} value={item.key}>{item.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  {period === "custom" && (
                    <>
                      <TextField size="small" type="date" label="Desde" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} InputLabelProps={{ shrink: true }} sx={{ width: 160 }} />
                      <TextField size="small" type="date" label="Hasta" value={customTo} onChange={(event) => setCustomTo(event.target.value)} InputLabelProps={{ shrink: true }} sx={{ width: 160 }} />
                    </>
                  )}
                </Stack>
              </Paper>

              <Grid container spacing={2} sx={{ mb: 2 }}>
                {[
                  { title: "Cobrado", value: formatMoneyAr(resumenFinanciero.totalCobrado), caption: "Ingresos del período", icon: <TrendingUp />, tone: CARD_TONES.green },
                  { title: "Honorarios pendientes", value: formatMoneyAr(resumenFinanciero.totalHonorariosPendientes), caption: "Saldo a hoy", icon: <Payments />, tone: CARD_TONES.orange },
                  { title: "Gastos", value: formatMoneyAr(resumenFinanciero.totalGastos), caption: "Registrados en el período", icon: <TrendingDown />, tone: CARD_TONES.red },
                  { title: "Total a cobrar", value: formatMoneyAr(resumenFinanciero.totalACobrar), caption: "Honorarios + gastos sin cobrar", icon: <AccountBalanceWallet />, tone: CARD_TONES.blue },
                ].map((item) => (
                  <Grid key={item.title} size={{ xs: 12, sm: 6, md: 3 }}>
                    <KpiCard {...item} loading={loadingFinancial} />
                  </Grid>
                ))}
              </Grid>

              <Grid container spacing={2}>
                <Grid size={{ xs: 12, lg: 7 }}>
                  <ChartPanel title="Cobranzas por mes" subtitle="Cobrado del mes vs saldo pendiente (por vencimiento)" loading={loadingFinancial}>
                    <ResponsiveContainer width="100%" height={280}>
                      <RBarChart data={resumenFinanciero.mensual}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.18} />
                        <XAxis dataKey="mes" />
                        <YAxis tickFormatter={(value) => `$${Math.round(value / 1000)}k`} />
                        <RechartsTooltip content={<ChartTooltip money />} />
                        <Legend />
                        <Bar dataKey="cobrado" name="Cobrado" fill={CARD_TONES.green} radius={[6, 6, 0, 0]} />
                        <Bar dataKey="pendiente" name="Pendiente" fill={CARD_TONES.orange} radius={[6, 6, 0, 0]} />
                      </RBarChart>
                    </ResponsiveContainer>
                  </ChartPanel>
                </Grid>
                <Grid size={{ xs: 12, lg: 5 }}>
                  <ChartPanel title="Top deudores" subtitle="Clientes con mayor saldo pendiente" loading={loadingFinancial}>
                    {resumenFinanciero.topDeudores.length ? (
                      <ResponsiveContainer width="100%" height={280}>
                        <RBarChart data={resumenFinanciero.topDeudores} layout="vertical" margin={{ left: 24 }}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.18} />
                          <XAxis type="number" tickFormatter={(value) => `$${Math.round(value / 1000)}k`} />
                          <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12 }} />
                          <RechartsTooltip content={<ChartTooltip money />} />
                          <Bar dataKey="saldo" name="Saldo" radius={[0, 8, 8, 0]}>
                            {resumenFinanciero.topDeudores.map((entry, index) => (
                              <Cell key={entry.name ?? index} fill={DEUDOR_BAR_COLORS[index % DEUDOR_BAR_COLORS.length]} />
                            ))}
                          </Bar>
                        </RBarChart>
                      </ResponsiveContainer>
                    ) : (
                      <Box sx={{ height: 280, display: "grid", placeItems: "center", color: "text.secondary" }}>
                        <Typography variant="body2" sx={{ fontWeight: 800 }}>Sin deudores.</Typography>
                      </Box>
                    )}
                  </ChartPanel>
                </Grid>
              </Grid>
            </Box>
          )}

          {tab === "productividad" && isDirector && (
            <Box component={motion.div} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, lg: 7 }}>
                  <TableShell loading={loadingProductividad} isEmpty={!productividad.length} emptyTitle="Sin usuarios activos para reportar">
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Abogado</TableCell>
                          <TableCell align="right">Tareas completadas</TableCell>
                          <TableCell align="right">Tareas pendientes</TableCell>
                          <TableCell align="right">Tareas vencidas</TableCell>
                          <TableCell align="right">Expedientes activos asignados</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {productividad.map((row) => (
                          <TableRow key={row.id} hover>
                            <TableCell sx={{ fontWeight: 900 }}>{row.abogado}</TableCell>
                            <TableCell align="right">{row.completadas}</TableCell>
                            <TableCell align="right">{row.pendientes}</TableCell>
                            <TableCell align="right">{row.vencidas}</TableCell>
                            <TableCell align="right">{row.expedientesActivos}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableShell>
                </Grid>
                <Grid size={{ xs: 12, lg: 5 }}>
                  <ChartPanel title="Tareas por abogado" subtitle="Completadas y pendientes" loading={loadingProductividad}>
                    <ResponsiveContainer width="100%" height={280}>
                      <RBarChart data={productividad}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.18} />
                        <XAxis dataKey="abogado" />
                        <YAxis allowDecimals={false} />
                        <RechartsTooltip content={<ChartTooltip />} />
                        <Legend />
                        <Bar dataKey="completadas" name="Tareas completadas" fill={CARD_TONES.green} radius={[8, 8, 0, 0]} />
                        <Bar dataKey="pendientes" name="Tareas pendientes" fill={CARD_TONES.orange} radius={[8, 8, 0, 0]} />
                      </RBarChart>
                    </ResponsiveContainer>
                  </ChartPanel>
                </Grid>
              </Grid>
            </Box>
          )}

          {tab === "clientes" && (
            <Box component={motion.div} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, lg: 7 }}>
                  <TextField
                    className="reportes-no-print"
                    size="small"
                    fullWidth
                    value={clientSearch}
                    onChange={(event) => setClientSearch(event.target.value)}
                    placeholder="Buscar cliente..."
                    sx={{ mb: 2 }}
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <Search fontSize="small" sx={{ color: "text.secondary" }} />
                          </InputAdornment>
                        ),
                      },
                    }}
                  />
                  <TableShell loading={loadingCartera} isEmpty={!cartera.length} emptyTitle="Sin clientes para reportar">
                    <Table>
                      <TableHead>
                        <TableRow>
                          {[
                            ["cliente", "Deudor"],
                            ["expedientesActivos", "Expedientes activos"],
                            ["honorariosPendientes", "Honorarios pendientes"],
                            ["estado", "Estado"],
                          ].map(([field, label]) => (
                            <TableCell key={field} align={field === "cliente" || field === "estado" ? "left" : "right"}>
                              <TableSortLabel active={clientOrderBy === field} direction={clientOrderBy === field ? clientOrder : "asc"} onClick={() => handleClientSort(field)}>
                                {label}
                              </TableSortLabel>
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {cartera.map((row) => (
                          <TableRow key={row.id} hover>
                            <TableCell sx={{ fontWeight: 900 }}>
                              <Stack direction="row" spacing={1} alignItems="center">
                                <span>{row.cliente}</span>
                                {row.tipoDeudor === "tercero" && (
                                  <Chip size="small" label="Tercero" color="warning" variant="outlined" sx={{ height: 20, fontSize: "0.65rem", fontWeight: 800 }} />
                                )}
                              </Stack>
                            </TableCell>
                            <TableCell align="right">{row.expedientesActivos}</TableCell>
                            <TableCell align="right">{formatMoneyAr(row.honorariosPendientes)}</TableCell>
                            <TableCell><StatusChip status={row.estado} /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableShell>
                </Grid>
                <Grid size={{ xs: 12, lg: 5 }}>
                  <ChartPanel title="Clientes por estado" subtitle="Al día, deudores y morosos" loading={loadingCartera}>
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie data={clientesEstadoPie} dataKey="value" nameKey="name" innerRadius={64} outerRadius={96} paddingAngle={3}>
                          {clientesEstadoPie.map((entry) => (
                            <Cell key={entry.name} fill={entry.name === "Al día" ? CARD_TONES.green : entry.name === "Deudor" ? CARD_TONES.orange : CARD_TONES.red} />
                          ))}
                        </Pie>
                        <RechartsTooltip content={<PieTooltip />} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartPanel>
                </Grid>
              </Grid>
            </Box>
          )}

          {tab === "expedientes" && (
            <Box component={motion.div} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                {[
                  { title: "Activos", value: estadoExpedientes.activos, caption: "Expedientes en curso", icon: <FolderSpecial />, tone: CARD_TONES.blue },
                  { title: "Cerrados", value: estadoExpedientes.cerrados, caption: "Finalizados o archivados", icon: <AssignmentTurnedIn />, tone: CARD_TONES.green },
                  { title: "Abiertos este mes", value: estadoExpedientes.abiertosMes, caption: "Altas recientes", icon: <TrendingUp />, tone: CARD_TONES.orange },
                  { title: "Sin movimiento", value: estadoExpedientes.sinMovimiento, caption: "+90 días sin actividad", icon: <WarningAmber />, tone: CARD_TONES.red },
                ].map((item) => (
                  <Grid key={item.title} size={{ xs: 12, sm: 6, md: 3 }}>
                    <KpiCard {...item} loading={loadingExpedientes} />
                  </Grid>
                ))}
              </Grid>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, lg: 6 }}>
                  <ChartPanel title="Aperturas por mes" subtitle="Últimos 12 meses" loading={loadingExpedientes}>
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart data={estadoExpedientes.aperturas}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.18} />
                        <XAxis dataKey="mes" />
                        <YAxis allowDecimals={false} />
                        <RechartsTooltip content={<ChartTooltip />} />
                        <Line type="monotone" dataKey="aperturas" name="Aperturas" stroke={CARD_TONES.blue} strokeWidth={3} dot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartPanel>
                </Grid>
                <Grid size={{ xs: 12, lg: 6 }}>
                  <ChartPanel title="Tipos de expediente" subtitle="Distribución por categoría" loading={loadingExpedientes}>
                    <ResponsiveContainer width="100%" height={280}>
                      <RBarChart data={estadoExpedientes.tipos} layout="vertical" margin={{ left: 34 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.18} />
                        <XAxis type="number" allowDecimals={false} />
                        <YAxis type="category" dataKey="name" width={120} />
                        <RechartsTooltip content={<ChartTooltip />} />
                        <Bar dataKey="cantidad" name="Cantidad" fill={CARD_TONES.violet} radius={[0, 8, 8, 0]} />
                      </RBarChart>
                    </ResponsiveContainer>
                  </ChartPanel>
                </Grid>
              </Grid>

              <Box sx={{ mt: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 900, mb: 1 }}>Expedientes sin movimiento (+90 días)</Typography>
                <TableShell loading={loadingExpedientes} isEmpty={!estadoExpedientes.sinMovimientoRows.length} emptyTitle="Todos los expedientes activos tienen movimiento reciente">
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Expediente</TableCell>
                        <TableCell>Cliente</TableCell>
                        <TableCell>Tipo</TableCell>
                        <TableCell align="right">Último movimiento</TableCell>
                        <TableCell align="right">Días</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {estadoExpedientes.sinMovimientoRows.map((row) => (
                        <TableRow key={row.id} hover>
                          <TableCell sx={{ fontWeight: 900 }}>{compactLabel(row.expediente, 48)}</TableCell>
                          <TableCell>{row.cliente}</TableCell>
                          <TableCell>{row.tipo}</TableCell>
                          <TableCell align="right">{row.ultimoMovimiento}</TableCell>
                          <TableCell align="right"><Chip size="small" label={`${row.dias} d`} sx={{ fontWeight: 900, bgcolor: alpha(CARD_TONES.red, 0.12), color: CARD_TONES.red }} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableShell>
              </Box>
            </Box>
          )}

          {tab === "vencimientos" && (
            <Box component={motion.div} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                {[
                  { title: "Vencidas", value: vencimientos.vencidas, caption: "Tareas/eventos sin completar", icon: <EventBusy />, tone: CARD_TONES.red },
                  { title: "Hoy", value: vencimientos.hoy, caption: "Vencen hoy", icon: <Schedule />, tone: CARD_TONES.orange },
                  { title: "Próx. 7 días", value: vencimientos.semana, caption: "Esta semana", icon: <Schedule />, tone: CARD_TONES.blue },
                  { title: "Próx. 30 días", value: vencimientos.mes, caption: "Este mes", icon: <AssignmentTurnedIn />, tone: CARD_TONES.violet },
                ].map((item) => (
                  <Grid key={item.title} size={{ xs: 12, sm: 6, md: 3 }}>
                    <KpiCard {...item} loading={loadingVencimientos} />
                  </Grid>
                ))}
              </Grid>

              <Typography variant="h6" sx={{ fontWeight: 900, mb: 1 }}>Próximos vencimientos (hasta 30 días)</Typography>
              <TableShell loading={loadingVencimientos} isEmpty={!vencimientos.rows.length} emptyTitle="No hay vencimientos próximos">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Tipo</TableCell>
                      <TableCell>Detalle</TableCell>
                      <TableCell>Cliente</TableCell>
                      <TableCell align="right">Fecha</TableCell>
                      <TableCell align="right">Estado</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {vencimientos.rows.map((row) => (
                      <TableRow key={row.id} hover>
                        <TableCell><Chip size="small" label={row.tipo} sx={{ fontWeight: 800 }} /></TableCell>
                        <TableCell sx={{ fontWeight: 900 }}>{compactLabel(row.titulo, 48)}</TableCell>
                        <TableCell>{clienteLabel(clientesById.get(Number(row.clienteId))) || "—"}</TableCell>
                        <TableCell align="right">{formatDateShort(row.fecha)}</TableCell>
                        <TableCell align="right">
                          <Chip
                            size="small"
                            label={row.dias < 0 ? `Vencido ${Math.abs(row.dias)}d` : row.dias === 0 ? "Hoy" : `En ${row.dias}d`}
                            sx={{ fontWeight: 900, bgcolor: alpha(row.dias < 0 ? CARD_TONES.red : row.dias <= 7 ? CARD_TONES.orange : CARD_TONES.blue, 0.12), color: row.dias < 0 ? CARD_TONES.red : row.dias <= 7 ? CARD_TONES.orange : CARD_TONES.blue }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableShell>
            </Box>
          )}
        </Box>
      </Paper>
    </Box>
  );
}
