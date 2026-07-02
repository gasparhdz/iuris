import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Link as RouterLink, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { usePermisos } from "../auth/usePermissions";
import { useFinanzasModals } from "../components/finanzas/FinanzasModalsProvider";
import PlanesPagoTable from "../components/finanzas/PlanesPagoTable";
import { alpha, useTheme } from "@mui/material/styles";
import Grid from "@mui/material/Grid";
import { motion } from "framer-motion";
import api from "../api/axios";

const MotionDiv = motion.div;
import {
  Avatar,
  Box,
  Button,
  Chip,
  Collapse,
  CircularProgress,
  Divider,
  IconButton,
  InputAdornment,
  Link,
  MenuItem,
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  AccountBalanceWallet,
  Add,
  ArrowBack,
  CalendarMonth,
  Delete,
  Edit,
  Payments,
  Print,
  ReceiptLong,
  Search,
  TrendingDown,
  TrendingUp,
  WarningAmber,
} from "@mui/icons-material";
import {
  clienteLabel,
  casoLabel,
  compareValues,
  conceptoLabel,
  denseTableSx,
  ellipsisSx,
  finanzasEditarUrl,
  finanzasNuevoUrl,
  formatDateShort,
  formatMoneyAr,
  honorarioEstadoChip,
  isHonorarioPendiente,
  invalidateFinanzasQueries,
  linkSx,
  unwrapPaged,
  formatCurrency,
  computeGastoAmounts,
  computeHonorarioAmounts,
  movementAmountPesos,
  getItemCurrencyGeneral,
  mapCuentaCorrienteApiRows,
} from "./finanzasUtils";
import { clienteLabel as clienteLabelFromTareas, getApiError, unwrapItems } from "./tareasUtils";

const TAB_KEYS = ["honorarios", "gastos", "ingresos", "planes", "cuentas_corrientes"];
const TAB_LABELS = {
  honorarios: "Honorarios",
  gastos: "Gastos",
  ingresos: "Ingresos",
  planes: "Planes",
  cuentas_corrientes: "Cuentas Corrientes",
};

const DATE_PRESETS = [
  { key: "todo", label: "Todo" },
  { key: "hoy", label: "Hoy" },
  { key: "semana", label: "Esta semana" },
  { key: "mes", label: "Este mes" },
  { key: "trimestre", label: "Ultimo trimestre" },
  { key: "anio", label: "Este ano" },
  { key: "custom", label: "Personalizado" },
];

function getPresetRange(key) {
  const now = new Date();
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const endOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  const today = startOfDay(now);

  switch (key) {
    case "hoy":
      return { from: today, to: endOfDay(now) };
    case "semana": {
      const day = today.getDay();
      const monday = new Date(today);
      monday.setDate(today.getDate() - ((day + 6) % 7));
      return { from: monday, to: endOfDay(now) };
    }
    case "mes":
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: endOfDay(now) };
    case "trimestre": {
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      return { from: startOfDay(threeMonthsAgo), to: endOfDay(now) };
    }
    case "anio":
      return { from: new Date(now.getFullYear(), 0, 1), to: endOfDay(now) };
    default:
      return { from: null, to: null };
  }
}

function isInDateRange(dateStr, from, to) {
  if (!from && !to) return true;
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function TabPanel({ children, value, index }) {
  if (value !== index) return null;
  return <Box sx={{ pt: 2 }}>{children}</Box>;
}

function KpiCard({ label, valuePesos, valueUsd, icon, tone }) {
  const theme = useTheme();
  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2.25, lg: 1.5 },
        height: "100%",
        borderRadius: "16px",
        border: "1px solid",
        borderColor: alpha(tone, 0.35),
        bgcolor: "background.paper",
        transition: "transform 0.18s ease, box-shadow 0.18s ease",
        "&:hover": {
          transform: "translateY(-4px)",
          boxShadow: theme.palette.mode === "dark"
            ? "0 18px 38px rgba(0,0,0,0.34)"
            : "0 18px 38px rgba(15,23,42,0.08)",
        },
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {label}
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 950, mt: 0.5, lineHeight: 1.2, fontSize: { lg: "1.25rem", xl: "1.5rem" } }}>
            {valuePesos}
          </Typography>
          {valueUsd ? (
            <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.25, fontWeight: 700 }}>
              {valueUsd}
            </Typography>
          ) : null}
        </Box>
        <Avatar sx={{ bgcolor: alpha(tone, 0.12), color: tone, width: { xs: 48, lg: 40, xl: 48 }, height: { xs: 48, lg: 40, xl: 48 } }}>{icon}</Avatar>
      </Stack>
    </Paper>
  );
}

function EntityLink({ to, label, state }) {
  if (!to || !label) return <Typography variant="body2" sx={{ color: "text.disabled" }}>-</Typography>;
  return (
    <Tooltip title={label}>
      <Link component={RouterLink} to={to} state={state} variant="body2" sx={linkSx} onClick={(e) => e.stopPropagation()}>
        <Box component="span" sx={ellipsisSx}>{label}</Box>
      </Link>
    </Tooltip>
  );
}


function TableSkeleton({ columnWidths }) {
  const theme = useTheme();
  const widths = columnWidths || [150, "30%", "20%", 80, 100, 80, 100];
  return (
    <Table size="small" sx={denseTableSx}>
      <TableHead>
        <TableRow sx={{ bgcolor: alpha(theme.palette.text.primary, 0.03) }}>
          {widths.map((w, idx) => (
            <TableCell key={idx} style={{ width: w }}>
              <Skeleton variant="text" sx={{ fontSize: "0.875rem", width: "80%" }} />
            </TableCell>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        {Array.from({ length: 6 }).map((_, rowIndex) => (
          <TableRow key={rowIndex} sx={{ opacity: 1 - rowIndex * 0.12 }}>
            {widths.map((w, colIndex) => (
              <TableCell key={colIndex}>
                <Skeleton variant="text" width={w} sx={{ height: 24 }} />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}


function FinanzasTableShell({ loading, error, isEmpty, emptyTitle, emptySubtitle, children, footer, columnWidths }) {
  if (loading) {
    return (
      <Paper elevation={0} sx={{ borderRadius: "16px", border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
        <TableContainer>
          <TableSkeleton columnWidths={columnWidths} />
        </TableContainer>
      </Paper>
    );
  }
  if (error) {
    return (
      <Paper elevation={0} sx={{ p: 4, borderRadius: "16px", border: "1px solid", borderColor: "divider", textAlign: "center" }}>
        <WarningAmber sx={{ fontSize: 48, color: "error.main", mb: 1 }} />
        <Typography variant="h6" sx={{ fontWeight: 900 }}>No se pudieron cargar los datos</Typography>
        <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>{error}</Typography>
      </Paper>
    );
  }

  if (isEmpty) {
    return (
      <Paper elevation={0} sx={{ p: 5, borderRadius: "16px", border: "1px solid", borderColor: "divider", textAlign: "center" }}>
        <Typography variant="h6" sx={{ fontWeight: 900 }}>{emptyTitle}</Typography>
        <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>{emptySubtitle}</Typography>
      </Paper>
    );
  }
  return (
    <Paper elevation={0} sx={{ borderRadius: "16px", border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
      <TableContainer>{children}</TableContainer>
      {footer}
    </Paper>
  );
}


export default function Finanzas() {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const finanzasModals = useFinanzasModals();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentPath = `${location.pathname}${location.search}`;
  const tabKey = TAB_KEYS.includes(searchParams.get("tab")) ? searchParams.get("tab") : "honorarios";
  const tabIndex = TAB_KEYS.indexOf(tabKey);

  const honorariosPerm = usePermisos("HONORARIOS");
  const gastosPerm = usePermisos("GASTOS");
  const ingresosPerm = usePermisos("INGRESOS");
  // Crear cobros usa el modulo INGRESOS; cada seccion edita/elimina su propio modulo.
  const canCrearActivo = tabKey === "gastos" ? gastosPerm.canCrear : tabKey === "ingresos" ? ingresosPerm.canCrear : honorariosPerm.canCrear;

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search);
  const [orderBy, setOrderBy] = useState("fecha");
  const [order, setOrder] = useState("desc");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [datePreset, setDatePreset] = useState("todo");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const dateRange = useMemo(() => {
    if (datePreset === "custom") {
      return {
        from: customFrom ? new Date(`${customFrom}T00:00:00`) : null,
        to: customTo ? new Date(`${customTo}T23:59:59.999`) : null,
      };
    }
    return getPresetRange(datePreset);
  }, [datePreset, customFrom, customTo]);

  useEffect(() => {
    setPage(0);
  }, [tabKey, debouncedSearch, orderBy, order, datePreset, customFrom, customTo]);

  const honorariosQuery = useQuery({
    queryKey: ["honorarios", "global", debouncedSearch],
    queryFn: async () => {
      const { data } = await api.get("/honorarios", {
        params: { page: 1, limit: 100, search: debouncedSearch.trim() || undefined },
      });
      return unwrapPaged(data);
    },
    staleTime: 60_000,
  });

  const gastosQuery = useQuery({
    queryKey: ["gastos", "global", dateRange.from?.toISOString(), dateRange.to?.toISOString()],
    queryFn: async () => {
      const params = { page: 1, limit: 100 };
      if (dateRange.from) params.from = dateRange.from.toISOString();
      if (dateRange.to) params.to = dateRange.to.toISOString();
      const { data } = await api.get("/gastos", { params });
      return unwrapPaged(data);
    },
    staleTime: 60_000,
  });

  const ingresosQuery = useQuery({
    queryKey: ["ingresos", "global", dateRange.from?.toISOString(), dateRange.to?.toISOString()],
    queryFn: async () => {
      const params = { page: 1, limit: 100 };
      if (dateRange.from) params.from = dateRange.from.toISOString();
      if (dateRange.to) params.to = dateRange.to.toISOString();
      const { data } = await api.get("/ingresos", { params });
      return unwrapPaged(data);
    },
    staleTime: 60_000,
  });

  const planesQuery = useQuery({
    queryKey: ["planes", "global"],
    queryFn: () => api.get("/planes").then((r) => r.data?.data ?? []),
    staleTime: 60_000,
  });

  // Resumen de cuenta corriente por cliente calculado en el backend (motor Decimal).
  const ccResumenQuery = useQuery({
    queryKey: ["clientes", "cuentas-corrientes"],
    queryFn: async () => {
      const { data } = await api.get("/clientes/cuentas-corrientes");
      return data?.data ?? [];
    },
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

  const catalogQuery = useQuery({
    queryKey: ["catalogos", "finanzas-global"],
    queryFn: async () => {
      const cats = ["MONEDA", "POLITICA_JUS", "ESTADO_GASTO", "CONCEPTO_INGRESO"];
      const entries = await Promise.all(
        cats.map(async (categoria) => {
          const { data } = await api.get("/catalogos/parametros", { params: { categoria } });
          const raw = data?.data ?? data;
          return [categoria, Array.isArray(raw) ? raw : []];
        })
      );
      return Object.fromEntries(entries);
    },
    staleTime: 300_000,
  });

  const clientesQuery = useQuery({
    queryKey: ["clientes", "lookup", "finanzas"],
    queryFn: async () => {
      const { data } = await api.get("/clientes", { params: { limit: 100 } });
      return unwrapItems(data);
    },
    staleTime: 300_000,
  });

  const expedientesQuery = useQuery({
    queryKey: ["expedientes", "lookup", "finanzas"],
    queryFn: async () => {
      const { data } = await api.get("/expedientes", { params: { limit: 100 } });
      return unwrapItems(data);
    },
    staleTime: 300_000,
  });

  const conceptosQuery = useQuery({
    queryKey: ["catalogos", "parametros", "CONCEPTO_GASTO", "finanzas"],
    queryFn: async () => {
      const { data } = await api.get("/catalogos/parametros", { params: { categoria: "CONCEPTO_GASTO" } });
      const raw = data?.data ?? data;
      return Array.isArray(raw) ? raw : [];
    },
    staleTime: 300_000,
  });

  const clientesById = useMemo(
    () => new Map((clientesQuery.data ?? []).map((c) => [Number(c.id), c])),
    [clientesQuery.data],
  );

  const expedientesById = useMemo(
    () => new Map((expedientesQuery.data ?? []).map((c) => [Number(c.id), c])),
    [expedientesQuery.data],
  );

  const conceptosById = useMemo(
    () => new Map((conceptosQuery.data ?? []).map((c) => [Number(c.id), c])),
    [conceptosQuery.data],
  );

  const conceptosIngresoById = useMemo(
    () => new Map((catalogQuery.data?.CONCEPTO_INGRESO ?? []).map((c) => [Number(c.id), c])),
    [catalogQuery.data?.CONCEPTO_INGRESO],
  );

  const estadosGastoById = useMemo(() => {
    const list = catalogQuery.data?.ESTADO_GASTO ?? [];
    return new Map(list.map((e) => [Number(e.id), e]));
  }, [catalogQuery.data?.ESTADO_GASTO]);

  const honorarios = honorariosQuery.data?.items ?? [];
  const gastos = gastosQuery.data?.items ?? [];
  const ingresos = ingresosQuery.data?.items ?? [];

  const processedHonorarios = useMemo(() => {
    const valorJusActual = Number(valorJusQuery.data?.valor ?? 0);
    const catalogMonedas = catalogQuery.data?.MONEDA ?? [];
    const catalogPoliticas = catalogQuery.data?.POLITICA_JUS ?? [];

    return honorarios.map((item) => {
      const computed = computeHonorarioAmounts(item, valorJusActual, catalogMonedas, catalogPoliticas);
      return {
        ...item,
        computed,
      };
    });
  }, [honorarios, valorJusQuery.data, catalogQuery.data]);

  const planesByHonorario = useMemo(() => {
    const map = new Map();
    (planesQuery.data ?? []).forEach((plan) => {
      const honorarioId = Number(plan.honorarioId);
      if (!honorarioId) return;
      const current = map.get(honorarioId) ?? { saldo: 0, cobrado: 0 };
      current.saldo += Number(plan.totalSaldoArs ?? 0);
      current.cobrado += Number(plan.totalCobradoArs ?? 0);
      map.set(honorarioId, current);
    });
    return map;
  }, [planesQuery.data]);

  const getHonorarioSaldoPendiente = useCallback((item, computed) => {
    const planSaldo = planesByHonorario.get(Number(item.id));
    if (planSaldo) {
      return {
        value: Math.max(0, planSaldo.saldo),
        currency: "ARS",
      };
    }

    // Honorario SIN plan: saldo = bruto actualizado menos lo cobrado directo (montoCobrado).
    const bruto = isHonorarioPendiente(item) ? Math.max(0, Number(computed?.updatedVal ?? 0)) : 0;
    const cobrado = Number(item.montoCobrado ?? 0);
    return {
      value: Math.max(0, bruto - cobrado),
      currency: computed?.currency ?? "ARS",
    };
  }, [planesByHonorario]);

  const kpis = useMemo(() => {
    const catalogMonedas = catalogQuery.data?.MONEDA ?? [];
    const valorJusActual = Number(valorJusQuery.data?.valor ?? 0);
    const q = debouncedSearch.trim().toLowerCase();

    const honorariosFiltrados = processedHonorarios.filter((item) => {
      if (dateRange.from || dateRange.to) {
        if (!isInDateRange(item.fechaRegulacion, dateRange.from, dateRange.to)) return false;
      }
      if (!q) return true;
      const haystack = [
        conceptoLabel(item),
        clienteLabel(item.cliente) || clienteLabelFromTareas(clientesById.get(Number(item.clienteId))),
        casoLabel(item.caso) || casoLabel(expedientesById.get(Number(item.casoId))),
        item.estado?.nombre,
      ].join(" ").toLowerCase();
      return haystack.includes(q);
    });

    const honorariosKpi = honorariosFiltrados.reduce(
      (acc, honorario) => {
        const computed = honorario.computed;
        const planData = planesByHonorario.get(Number(honorario.id));
        acc.total += Number(computed?.updatedVal ?? 0);
        if (planData) {
          acc.cobrado += planData.cobrado;
          acc.pendiente += planData.saldo;
        } else {
          acc.cobrado += Number(honorario.montoCobrado ?? 0);
          const saldo = getHonorarioSaldoPendiente(honorario, computed);
          acc.pendiente += Number(saldo.value ?? 0);
        }
        return acc;
      },
      { total: 0, cobrado: 0, pendiente: 0 },
    );

    const gastosFiltrados = gastos.filter((item) => {
      if (!q) return true;
      const haystack = [
        conceptoLabel(item, conceptosById),
        clienteLabelFromTareas(clientesById.get(Number(item.clienteId))),
        casoLabel(expedientesById.get(Number(item.casoId))),
        item.descripcion,
        estadosGastoById.get(Number(item.estadoId))?.nombre,
      ].join(" ").toLowerCase();
      return haystack.includes(q);
    });

    const gastosKpi = gastosFiltrados.reduce(
      (acc, gasto) => {
        const amount = movementAmountPesos(gasto, "gasto", valorJusActual, catalogMonedas);
        const estado = estadosGastoById.get(Number(gasto.estadoId));
        const isPagado = String(estado?.codigo ?? "").toUpperCase() === "PAGADO";
        acc.total += amount;
        if (isPagado) acc.pagado += amount;
        else acc.pendiente += amount;
        return acc;
      },
      { total: 0, pagado: 0, pendiente: 0 },
    );

    const cuentasKpi = (ccResumenQuery.data ?? []).reduce(
      (acc, { totales }) => {
        acc.cargos += Number(totales?.honorariosPesos ?? 0) + Number(totales?.gastosPesos ?? 0);
        acc.cobrado += Number(totales?.ingresosPesos ?? 0);
        acc.pendiente += Number(totales?.saldoPesos ?? 0);
        return acc;
      },
      { cargos: 0, cobrado: 0, pendiente: 0 },
    );

    return { honorarios: honorariosKpi, gastos: gastosKpi, cuentas: cuentasKpi };
  }, [
    processedHonorarios,
    gastos,
    dateRange,
    debouncedSearch,
    catalogQuery.data,
    valorJusQuery.data,
    getHonorarioSaldoPendiente,
    estadosGastoById,
    planesByHonorario,
    clientesById,
    expedientesById,
    conceptosById,
    ccResumenQuery.data,
  ]);

  const kpiLoading = tabKey === "honorarios"
    ? honorariosQuery.isLoading || planesQuery.isLoading || valorJusQuery.isLoading || catalogQuery.isLoading
    : tabKey === "gastos"
      ? gastosQuery.isLoading || valorJusQuery.isLoading || catalogQuery.isLoading
      : tabKey === "cuentas_corrientes"
        ? ccResumenQuery.isLoading
        : false;

  const kpiCards = useMemo(() => {
    switch (tabKey) {
      case "honorarios":
        return [
          { label: "Total Honorarios", value: formatMoneyAr(kpis.honorarios.total), icon: <Payments />, tone: theme.palette.primary.main },
          { label: "Cobrado", value: formatMoneyAr(kpis.honorarios.cobrado), icon: <AccountBalanceWallet />, tone: theme.palette.success.main },
          { label: "Pendiente", value: formatMoneyAr(kpis.honorarios.pendiente), icon: <TrendingDown />, tone: theme.palette.warning.main },
        ];
      case "gastos":
        return [
          { label: "Gastos Totales", value: formatMoneyAr(kpis.gastos.total), icon: <ReceiptLong />, tone: theme.palette.warning.main },
          { label: "Cobrado", value: formatMoneyAr(kpis.gastos.pagado), icon: <AccountBalanceWallet />, tone: theme.palette.success.main },
          { label: "Pendiente", value: formatMoneyAr(kpis.gastos.pendiente), icon: <TrendingDown />, tone: theme.palette.error.main },
        ];
      case "cuentas_corrientes":
        return [
          { label: "Total Cargos", value: formatMoneyAr(kpis.cuentas.cargos), icon: <Payments />, tone: theme.palette.primary.main },
          { label: "Total Cobrado", value: formatMoneyAr(kpis.cuentas.cobrado), icon: <AccountBalanceWallet />, tone: theme.palette.success.main },
          { label: "Total Pendiente", value: formatMoneyAr(kpis.cuentas.pendiente), icon: <TrendingDown />, tone: kpis.cuentas.pendiente > 0 ? theme.palette.error.main : theme.palette.success.main },
        ];
      default:
        return [];
    }
  }, [tabKey, kpis, theme]);

  // La navegación entre secciones ahora es por la barra lateral (?tab=). Al cambiar de
  // sección limpiamos búsqueda, orden y página (lo que antes hacía el onChange de las tabs).
  useEffect(() => {
    setSearch("");
    setOrderBy("fecha");
    setOrder("desc");
    setPage(0);
  }, [tabKey]);

  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(property);
  };

  const filterBySearch = (rows, mapper) => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => mapper(row).toLowerCase().includes(q));
  };

  const sortedHonorarios = useMemo(() => {
    let rows = filterBySearch(processedHonorarios, (item) => [
      conceptoLabel(item),
      clienteLabel(item.cliente) || clienteLabelFromTareas(clientesById.get(Number(item.clienteId))),
      casoLabel(item.caso) || casoLabel(expedientesById.get(Number(item.casoId))),
      item.estado?.nombre,
    ].join(" "));

    if (dateRange.from || dateRange.to) {
      rows = rows.filter((item) => isInDateRange(item.fechaRegulacion, dateRange.from, dateRange.to));
    }

    return [...rows].sort((a, b) => {
      let valA;
      let valB;
      switch (orderBy) {
        case "concepto":
          valA = conceptoLabel(a);
          valB = conceptoLabel(b);
          break;
        case "cliente":
          valA = clienteLabel(a.cliente) || clienteLabelFromTareas(clientesById.get(Number(a.clienteId)));
          valB = clienteLabel(b.cliente) || clienteLabelFromTareas(clientesById.get(Number(b.clienteId)));
          break;
        case "expediente":
          valA = casoLabel(a.caso) || casoLabel(expedientesById.get(Number(a.casoId)));
          valB = casoLabel(b.caso) || casoLabel(expedientesById.get(Number(b.casoId)));
          break;
        case "vencimiento":
          valA = a.fechaVencimiento;
          valB = b.fechaVencimiento;
          break;
        case "monto":
          valA = a.computed?.originalVal ?? 0;
          valB = b.computed?.originalVal ?? 0;
          break;
        case "interes":
          valA = (a.computed?.updatedVal ?? 0) - (a.computed?.originalVal ?? 0);
          valB = (b.computed?.updatedVal ?? 0) - (b.computed?.originalVal ?? 0);
          break;
        case "saldo":
          valA = getHonorarioSaldoPendiente(a, a.computed).value;
          valB = getHonorarioSaldoPendiente(b, b.computed).value;
          break;
        case "estado":
          valA = honorarioEstadoChip(a).label;
          valB = honorarioEstadoChip(b).label;
          break;
        case "fecha":
        default:
          valA = a.fechaRegulacion;
          valB = b.fechaRegulacion;
      }
      const cmp = compareValues(valA, valB);
      return order === "desc" ? -cmp : cmp;
    });
  }, [processedHonorarios, debouncedSearch, orderBy, order, clientesById, expedientesById, dateRange, getHonorarioSaldoPendiente]);

  const sortedGastos = useMemo(() => {
    const rows = filterBySearch(gastos, (item) => [
      conceptoLabel(item, conceptosById),
      clienteLabelFromTareas(clientesById.get(Number(item.clienteId))),
      casoLabel(expedientesById.get(Number(item.casoId))),
      item.descripcion,
      estadosGastoById.get(Number(item.estadoId))?.nombre,
    ].join(" "));

    return [...rows].sort((a, b) => {
      let valA;
      let valB;
      switch (orderBy) {
        case "concepto":
          valA = conceptoLabel(a, conceptosById);
          valB = conceptoLabel(b, conceptosById);
          break;
        case "cliente":
          valA = clienteLabelFromTareas(clientesById.get(Number(a.clienteId)));
          valB = clienteLabelFromTareas(clientesById.get(Number(b.clienteId)));
          break;
        case "expediente":
          valA = casoLabel(expedientesById.get(Number(a.casoId)));
          valB = casoLabel(expedientesById.get(Number(b.casoId)));
          break;
        case "monto":
          valA = a.monto;
          valB = b.monto;
          break;
        case "estado": {
          const estA = estadosGastoById.get(Number(a.estadoId));
          const estB = estadosGastoById.get(Number(b.estadoId));
          valA = estA?.nombre ?? "Pendiente";
          valB = estB?.nombre ?? "Pendiente";
          break;
        }
        case "fecha":
        default:
          valA = a.fechaGasto;
          valB = b.fechaGasto;
      }
      const cmp = compareValues(valA, valB);
      return order === "desc" ? -cmp : cmp;
    });
  }, [gastos, debouncedSearch, orderBy, order, clientesById, expedientesById, conceptosById, estadosGastoById, dateRange]);

  const sortedIngresos = useMemo(() => {
    const rows = filterBySearch(ingresos, (item) => [
      conceptosIngresoById.get(Number(item.tipoId))?.nombre,
      item.descripcion,
      clienteLabelFromTareas(clientesById.get(Number(item.clienteId))),
      casoLabel(expedientesById.get(Number(item.casoId))),
    ].join(" "));

    return [...rows].sort((a, b) => {
      let valA;
      let valB;
      switch (orderBy) {
        case "concepto":
          valA = conceptosIngresoById.get(Number(a.tipoId))?.nombre || a.descripcion;
          valB = conceptosIngresoById.get(Number(b.tipoId))?.nombre || b.descripcion;
          break;
        case "cliente":
          valA = clienteLabelFromTareas(clientesById.get(Number(a.clienteId)));
          valB = clienteLabelFromTareas(clientesById.get(Number(b.clienteId)));
          break;
        case "expediente":
          valA = casoLabel(expedientesById.get(Number(a.casoId)));
          valB = casoLabel(expedientesById.get(Number(b.casoId)));
          break;
        case "monto":
          valA = a.monto;
          valB = b.monto;
          break;
        case "fecha":
        default:
          valA = a.fechaIngreso;
          valB = b.fechaIngreso;
      }
      const cmp = compareValues(valA, valB);
      return order === "desc" ? -cmp : cmp;
    });
  }, [ingresos, debouncedSearch, orderBy, order, clientesById, expedientesById, conceptosIngresoById, dateRange]);

  const cuentasCorrientes = useMemo(() => {
    const rows = (ccResumenQuery.data ?? []).map(({ clienteId, totales }) => {
      const cliente = clientesById.get(Number(clienteId));
      return {
        clienteId: Number(clienteId),
        cliente,
        clienteNombre: clienteLabelFromTareas(cliente) || `Cliente #${clienteId}`,
        totalCargos: Number(totales?.honorariosPesos ?? 0) + Number(totales?.gastosPesos ?? 0),
        totalCobrado: Number(totales?.ingresosPesos ?? 0),
        saldoPendiente: Number(totales?.saldoPesos ?? 0),
      };
    });

    return filterBySearch(rows, (item) => [
      item.clienteNombre,
      item.saldoPendiente > 0 ? "Deudor" : "Al Dia",
    ].join(" ")).sort((a, b) => {
      let valA;
      let valB;
      switch (orderBy) {
        case "cliente":
          valA = a.clienteNombre;
          valB = b.clienteNombre;
          break;
        case "cargos":
          valA = a.totalCargos;
          valB = b.totalCargos;
          break;
        case "cobrado":
          valA = a.totalCobrado;
          valB = b.totalCobrado;
          break;
        case "estado":
          valA = a.saldoPendiente > 0 ? "Deudor" : "Al Dia";
          valB = b.saldoPendiente > 0 ? "Deudor" : "Al Dia";
          break;
        case "saldo":
        default:
          valA = a.saldoPendiente;
          valB = b.saldoPendiente;
      }
      const cmp = compareValues(valA, valB);
      return order === "desc" ? -cmp : cmp;
    });
  }, [ccResumenQuery.data, clientesById, debouncedSearch, orderBy, order]);

  const activeRows = tabKey === "honorarios"
    ? sortedHonorarios
    : tabKey === "gastos"
      ? sortedGastos
      : tabKey === "ingresos"
        ? sortedIngresos
        : tabKey === "planes"
          ? (planesQuery.data ?? [])
          : cuentasCorrientes;
  const paginatedRows = activeRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const activeQuery = tabKey === "honorarios"
    ? honorariosQuery
    : tabKey === "gastos"
      ? gastosQuery
    : tabKey === "ingresos"
      ? ingresosQuery
    : tabKey === "planes"
      ? planesQuery
      : honorariosQuery;
  const activeError = activeQuery.error?.response?.data?.error?.message
    || activeQuery.error?.message
    || (activeQuery.isError ? "Error de conexion" : null);

  const sortableHead = (id, label, width) => (
    <TableCell
      key={id}
      sortDirection={orderBy === id ? order : false}
      sx={{ fontWeight: 900, fontSize: "0.72rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "text.secondary", width }}
    >
      <TableSortLabel
        active={orderBy === id}
        direction={orderBy === id ? order : "asc"}
        onClick={() => handleRequestSort(id)}
      >
        {label}
      </TableSortLabel>
    </TableCell>
  );

  const tablePagination = (
    <TablePagination
      component="div"
      count={activeRows.length}
      page={page}
      onPageChange={(_, newPage) => setPage(newPage)}
      rowsPerPage={rowsPerPage}
      onRowsPerPageChange={(event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
      }}
      rowsPerPageOptions={[10, 25, 50]}
      labelRowsPerPage="Filas:"
      labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
      sx={{ borderTop: "1px solid", borderColor: "divider" }}
    />
  );

  const selectedClienteId = searchParams.get("clienteId") ? Number(searchParams.get("clienteId")) : null;

  if (selectedClienteId) {
    return (
      <ClienteCuentaCorrienteDetail
        clienteId={selectedClienteId}
        onBack={() => setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          next.delete("clienteId");
          return next;
        })}
        theme={theme}
      />
    );
  }

  return (
    <Box>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", md: "flex-start" }} spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Finanzas
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: 0, mt: 0.25 }}>
            {TAB_LABELS[tabKey]}
          </Typography>
        </Box>
        {tabKey !== "cuentas_corrientes" && canCrearActivo && (
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => navigate(
              finanzasNuevoUrl({ tipo: tabKey === "honorarios" ? "honorario" : tabKey === "gastos" ? "gasto" : "ingreso" }),
              { state: { from: currentPath } },
            )}
            sx={{ borderRadius: "10px", fontWeight: 900, alignSelf: { xs: "stretch", md: "center" } }}
          >
            Registrar movimiento
          </Button>
        )}
      </Stack>

      <Paper
        elevation={0}
        sx={{
          mb: 2.5,
          p: 1.5,
          borderRadius: "12px",
          border: "1px solid",
          borderColor: "divider",
          bgcolor: "background.paper",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 1.5,
        }}
      >
        <TextField
          size="small"
          value={search}
          onChange={(event) => { setSearch(event.target.value); setPage(0); }}
          placeholder={
            tabKey === "honorarios"
              ? "Buscar por concepto, cliente o expediente..."
              : "Buscar por descripcion, cliente o expediente..."
          }
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" sx={{ color: "text.secondary" }} />
                </InputAdornment>
              ),
            },
          }}
          sx={{ flex: "1 1 240px", minWidth: 200 }}
        />
        <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1, ml: { md: "auto" } }}>
          <CalendarMonth sx={{ color: "text.secondary", fontSize: 20, mr: 0.5 }} />
        <Typography
          variant="caption"
          sx={{
            fontWeight: 900,
            color: "text.secondary",
            mr: 0.5,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          Periodo:
        </Typography>
        <TextField
          select
          size="small"
          value={datePreset}
          onChange={(e) => setDatePreset(e.target.value)}
          sx={{ minWidth: 180, flex: { xs: "1 1 100%", sm: "0 0 auto" } }}
        >
          {DATE_PRESETS.map((preset) => (
            <MenuItem key={preset.key} value={preset.key} sx={{ fontWeight: 700 }}>
              {preset.label}
            </MenuItem>
          ))}
        </TextField>
        {datePreset === "custom" && (
          <>
            <TextField
              size="small"
              type="date"
              label="Desde"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ ml: { sm: 1 }, width: { xs: "100%", sm: 160 } }}
            />
            <TextField
              size="small"
              type="date"
              label="Hasta"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ width: { xs: "100%", sm: 160 } }}
            />
          </>
        )}
        </Box>
      </Paper>

      {kpiCards.length > 0 && (
        <MotionDiv
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
        >
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            {kpiCards.map((card) => (
              <Grid key={card.label} size={{ xs: 12, sm: 6, md: 4 }}>
                <MotionDiv
                  variants={{
                    hidden: { opacity: 0, y: 16 },
                    show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
                  }}
                >
                  {kpiLoading ? (
                    <Skeleton variant="rounded" height={96} sx={{ borderRadius: "16px" }} />
                  ) : (
                    <KpiCard
                      label={card.label}
                      valuePesos={card.value}
                      valueUsd=""
                      icon={card.icon}
                      tone={card.tone}
                    />
                  )}
                </MotionDiv>
              </Grid>
            ))}
          </Grid>
        </MotionDiv>
      )}

          <TabPanel value={tabIndex} index={0}>
            <FinanzasTableShell
              loading={honorariosQuery.isLoading || planesQuery.isLoading}
              error={activeError}
              isEmpty={!honorariosQuery.isLoading && !planesQuery.isLoading && sortedHonorarios.length === 0}
              emptyTitle="No hay honorarios para mostrar"
              emptySubtitle="Ajusta el buscador o registra honorarios desde un cliente o expediente."
              footer={tablePagination}
              columnWidths={[180, "20%", "20%", 80, 100, 100, 80, 120]}
            >
              {/* Desktop Table View */}
              <Table size="small" sx={{ ...denseTableSx, display: { xs: "none", md: "table" } }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.06) }}>
                    {sortableHead("concepto", "Concepto")}
                    {sortableHead("cliente", "Cliente")}
                    {sortableHead("expediente", "Expediente")}
                    {sortableHead("fecha", "Fecha Reg.")}
                    {sortableHead("monto", "Monto Original")}
                    {sortableHead("saldo", "Saldo Pendiente")}
                    {sortableHead("estado", "Estado")}
                    <TableCell sx={{ fontWeight: 900, fontSize: "0.72rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "text.secondary", width: 120 }}>
                      Acciones
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedRows.map((item) => {
                    const cliente = item.cliente ?? clientesById.get(Number(item.clienteId));
                    const clienteNombre = clienteLabel(cliente) || clienteLabelFromTareas(cliente) || "Cliente";
                    const caso = item.caso ?? expedientesById.get(Number(item.casoId));
                    const computed = item.computed ?? computeHonorarioAmounts(
                      item,
                      Number(valorJusQuery.data?.valor ?? 0),
                      catalogQuery.data?.MONEDA ?? [],
                      catalogQuery.data?.POLITICA_JUS ?? [],
                    );
                    const chip = honorarioEstadoChip(item);
                    const saldoPendiente = getHonorarioSaldoPendiente(item, computed);
                    const puedeCobrar = chip.label === "Pendiente" || chip.label === "En Mora";
                    return (
                      <TableRow key={item.id} hover>
                        <TableCell>
                          <Tooltip title={conceptoLabel(item)}>
                            <Typography variant="body2" sx={{ fontWeight: 700, ...ellipsisSx, maxWidth: 180 }}>{conceptoLabel(item)}</Typography>
                          </Tooltip>
                        </TableCell>
                        <TableCell sx={{ maxWidth: 200 }}>
                          <EntityLink to={cliente?.id ? `/clientes/${cliente.id}` : null} label={clienteLabel(cliente) || clienteLabelFromTareas(cliente)} state={{ from: currentPath }} />
                        </TableCell>
                        <TableCell sx={{ maxWidth: 240 }}>
                          <EntityLink to={caso?.id ? `/expedientes/${caso.id}` : null} label={casoLabel(caso)} state={{ from: currentPath }} />
                        </TableCell>
                        <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDateShort(item.fechaRegulacion)}</TableCell>
                        <TableCell sx={{ whiteSpace: "nowrap" }}>
                          <Box sx={{ fontWeight: 800 }}>
                            {formatCurrency(computed.originalVal, computed.currency)}
                          </Box>
                          {computed.originalRef && (
                            <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: "0.75rem" }}>
                              {computed.originalRef}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: "nowrap" }}>
                          <Box sx={{ fontWeight: 900 }}>
                            {formatCurrency(saldoPendiente.value, saldoPendiente.currency)}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip size="small" label={chip.label} color={chip.color} sx={{ fontWeight: 900 }} role="status" aria-label={`Estado: ${chip.label}`} />
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Stack direction="row" spacing={0.25}>
                            {puedeCobrar && ingresosPerm.canCrear && (
                              <Tooltip title="Registrar cobro">
                                <IconButton
                                  size="small"
                                  color="success"
                                  sx={{ p: { xs: 1.25, md: 0.75 } }}
                                  onClick={() => navigate(
                                    finanzasNuevoUrl({
                                      tipo: "ingreso",
                                      clienteId: item.clienteId,
                                      casoId: item.casoId,
                                      honorarioId: item.id,
                                      monto: saldoPendiente.value,
                                    }),
                                    { state: { from: currentPath } },
                                  )}
                                  aria-label={`Registrar cobro de honorario de ${clienteNombre}`}
                                >
                                  <AccountBalanceWallet fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            {honorariosPerm.canEditar && (
                              <Tooltip title="Editar">
                                <IconButton
                                  size="small"
                                  color="primary"
                                  sx={{ p: { xs: 1.25, md: 0.75 } }}
                                  onClick={() => navigate(finanzasEditarUrl("honorario", item.id), { state: { from: currentPath, item } })}
                                  aria-label={`Editar honorario de ${clienteNombre}`}
                                >
                                  <Edit fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            {honorariosPerm.canEliminar && (
                              <Tooltip title="Eliminar">
                                <IconButton size="small" color="error" sx={{ p: { xs: 1.25, md: 0.75 } }} onClick={() => finanzasModals.openDelete({ type: "honorario", item })} aria-label={`Eliminar honorario de ${clienteNombre}`}>
                                  <Delete fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Mobile Card List View */}
              <Box sx={{ display: { xs: "block", md: "none" }, p: 2 }}>
                <Stack spacing={1.5}>
                  {paginatedRows.map((item) => {
                    const cliente = item.cliente ?? clientesById.get(Number(item.clienteId));
                    const caso = item.caso ?? expedientesById.get(Number(item.casoId));
                    const computed = item.computed ?? computeHonorarioAmounts(
                      item,
                      Number(valorJusQuery.data?.valor ?? 0),
                      catalogQuery.data?.MONEDA ?? [],
                      catalogQuery.data?.POLITICA_JUS ?? [],
                    );
                    const chip = honorarioEstadoChip(item);
                    const saldoPendiente = getHonorarioSaldoPendiente(item, computed);
                    const puedeCobrar = chip.label === "Pendiente" || chip.label === "En Mora";
                    const accentColor = chip.color === "success" ? "success.main"
                      : chip.color === "warning" ? "warning.main"
                      : chip.color === "error" ? "error.main"
                      : "divider";
                    return (
                      <Paper
                        key={item.id}
                        elevation={0}
                        sx={{
                          borderRadius: "12px",
                          border: "1px solid",
                          borderColor: "divider",
                          borderLeft: "4px solid",
                          borderLeftColor: accentColor,
                          overflow: "hidden",
                          bgcolor: alpha(theme.palette.background.paper, 0.6),
                        }}
                      >
                        {/* Nivel 1 — crítico */}
                        <Box sx={{ px: 2, pt: 1.75, pb: 1, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1 }}>
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <EntityLink to={cliente?.id ? `/clientes/${cliente.id}` : null} label={clienteLabel(cliente) || clienteLabelFromTareas(cliente)} state={{ from: currentPath }} sx={{ fontWeight: 800, fontSize: "0.95rem" }} />
                          </Box>
                          <Box sx={{ flexShrink: 0, textAlign: "right" }}>
                            <Typography variant="body1" fontWeight={800} color="primary.main" sx={{ lineHeight: 1.2 }}>
                              {formatCurrency(saldoPendiente.value, saldoPendiente.currency)}
                            </Typography>
                            {computed.originalRef && (
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.68rem" }}>
                                {computed.originalRef}
                              </Typography>
                            )}
                          </Box>
                        </Box>

                        {/* Nivel 2 — contexto */}
                        <Box sx={{ px: 2, pb: 1 }}>
                          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                            {conceptoLabel(item)}{caso ? ` · ${casoLabel(caso)}` : ""}
                          </Typography>
                        </Box>

                        {/* Nivel 3 — metadatos y acciones */}
                        <Box sx={{ px: 2, pb: 1.5, display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                          <Typography variant="caption" color="text.secondary">{formatDateShort(item.fechaRegulacion)}</Typography>
                          <Chip size="small" label={chip.label} color={chip.color} variant="outlined" sx={{ height: 20, fontSize: "0.65rem", fontWeight: 700 }} role="status" aria-label={`Estado: ${chip.label}`} />
                          <Box sx={{ ml: "auto", display: "flex", gap: 0.5 }}>
                            {puedeCobrar && ingresosPerm.canCrear && (
                              <IconButton size="small" color="success" aria-label="Cobrar honorario"
                                sx={{ p: { xs: 1.25, md: 0.75 } }}
                                onClick={() => navigate(finanzasNuevoUrl({ tipo: "ingreso", clienteId: item.clienteId, casoId: item.casoId, honorarioId: item.id, monto: saldoPendiente.value }), { state: { from: currentPath } })}
                              >
                                <AccountBalanceWallet fontSize="small" />
                              </IconButton>
                            )}
                            {honorariosPerm.canEditar && (
                              <IconButton size="small" color="primary" aria-label={`Editar honorario de ${clienteLabel(cliente) || ""}`}
                                sx={{ p: { xs: 1.25, md: 0.75 } }}
                                onClick={() => navigate(finanzasEditarUrl("honorario", item.id), { state: { from: currentPath, item } })}
                              >
                                <Edit fontSize="small" />
                              </IconButton>
                            )}
                            {honorariosPerm.canEliminar && (
                              <IconButton size="small" color="error" aria-label={`Eliminar honorario de ${clienteLabel(cliente) || ""}`}
                                sx={{ p: { xs: 1.25, md: 0.75 } }}
                                onClick={() => finanzasModals.openDelete({ type: "honorario", item })}
                              >
                                <Delete fontSize="small" />
                              </IconButton>
                            )}
                          </Box>
                        </Box>
                      </Paper>
                    );
                  })}
                </Stack>
              </Box>
            </FinanzasTableShell>
          </TabPanel>

          <TabPanel value={tabIndex} index={1}>
            <FinanzasTableShell
              loading={gastosQuery.isLoading}
              error={activeError}
              isEmpty={!gastosQuery.isLoading && sortedGastos.length === 0}
              emptyTitle="No hay gastos para mostrar"
              emptySubtitle="Registra gastos desde la ficha de un cliente o expediente."
              footer={tablePagination}
              columnWidths={[260, "25%", "25%", 80, 100, 80, 100]}
            >
              {/* Desktop Table View */}
              <Table size="small" sx={{ ...denseTableSx, display: { xs: "none", md: "table" } }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.06) }}>
                    {sortableHead("concepto", "Concepto")}
                    {sortableHead("cliente", "Cliente")}
                    {sortableHead("expediente", "Expediente")}
                    {sortableHead("fecha", "Fecha")}
                    {sortableHead("monto", "Monto")}
                    {sortableHead("estado", "Estado")}
                    <TableCell sx={{ fontWeight: 900, fontSize: "0.72rem", color: "text.secondary", width: 100 }}>Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedRows.map((item) => {
                    const cliente = clientesById.get(Number(item.clienteId));
                    const clienteNombre = clienteLabelFromTareas(cliente) || "Cliente";
                    const caso = expedientesById.get(Number(item.casoId));
                    const label = conceptoLabel(item, conceptosById);
                    const gastoAmounts = computeGastoAmounts(item, catalogQuery.data?.MONEDA ?? []);
                    const estadoGasto = estadosGastoById.get(Number(item.estadoId));
                    const estadoCodigo = String(estadoGasto?.codigo ?? "").toUpperCase();
                    return (
                      <TableRow key={item.id} hover>
                        <TableCell>
                          <Tooltip title={label}>
                            <Typography variant="body2" sx={{ fontWeight: 700, ...ellipsisSx, maxWidth: 260 }}>{label}</Typography>
                          </Tooltip>
                        </TableCell>
                        <TableCell sx={{ maxWidth: 200 }}>
                          <EntityLink to={cliente?.id ? `/clientes/${cliente.id}` : null} label={clienteLabelFromTareas(cliente)} state={{ from: currentPath }} />
                        </TableCell>
                        <TableCell sx={{ maxWidth: 240 }}>
                          <EntityLink to={caso?.id ? `/expedientes/${caso.id}` : null} label={casoLabel(caso)} state={{ from: currentPath }} />
                        </TableCell>
                        <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDateShort(item.fechaGasto)}</TableCell>
                        <TableCell sx={{ whiteSpace: "nowrap", fontWeight: 900 }}>
                          {gastoAmounts.formattedVal}
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={estadoGasto?.nombre || "Pendiente"}
                            color={
                              estadoCodigo === "PAGADO"
                                ? "success"
                                : estadoCodigo === "PENDIENTE"
                                  ? "warning"
                                  : "default"
                            }
                            sx={{ fontWeight: 900 }}
                            role="status"
                            aria-label={`Estado: ${estadoGasto?.nombre || "Pendiente"}`}
                          />
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.25}>
                            {ingresosPerm.canCrear && (
                            <Tooltip title="Reintegrar">
                              <span>
                                <IconButton
                                  size="small"
                                  color="success"
                                  sx={{ p: { xs: 1.25, md: 0.75 } }}
                                  disabled={["PAGADO", "ANULADO"].includes(estadoCodigo)}
                                  onClick={() => navigate(
                                    finanzasNuevoUrl({
                                      tipo: "ingreso",
                                      gastoId: item.id,
                                      clienteId: item.clienteId,
                                      casoId: item.casoId || "",
                                      monto: item.monto,
                                    }),
                                    { state: { from: currentPath } },
                                  )}
                                  aria-label={`Reintegrar gasto de ${clienteNombre}`}
                                >
                                  <ReceiptLong fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                            )}
                            {gastosPerm.canEditar && <IconButton size="small" color="primary" sx={{ p: { xs: 1.25, md: 0.75 } }} onClick={() => navigate(finanzasEditarUrl("gasto", item.id), { state: { from: currentPath, item } })} aria-label={`Editar gasto de ${clienteNombre}`}><Edit fontSize="small" /></IconButton>}
                            {gastosPerm.canEliminar && <IconButton size="small" color="error" sx={{ p: { xs: 1.25, md: 0.75 } }} onClick={() => finanzasModals.openDelete({ type: "gasto", item })} aria-label={`Eliminar gasto de ${clienteNombre}`}><Delete fontSize="small" /></IconButton>}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Mobile Card List View */}
              <Box sx={{ display: { xs: "block", md: "none" }, p: 2 }}>
                <Stack spacing={1.5}>
                  {paginatedRows.map((item) => {
                    const cliente = clientesById.get(Number(item.clienteId));
                    const caso = expedientesById.get(Number(item.casoId));
                    const label = conceptoLabel(item, conceptosById);
                    const gastoAmounts = computeGastoAmounts(item, catalogQuery.data?.MONEDA ?? []);
                    const estadoGasto = estadosGastoById.get(Number(item.estadoId));
                    const estadoCodigo = String(estadoGasto?.codigo ?? "").toUpperCase();
                    const chipColor = estadoCodigo === "PAGADO" ? "success" : estadoCodigo === "PENDIENTE" ? "warning" : "default";
                    const accentColor = estadoCodigo === "PAGADO" ? "success.main" : estadoCodigo === "PENDIENTE" ? "warning.main" : "divider";
                    return (
                      <Paper
                        key={item.id}
                        elevation={0}
                        sx={{
                          borderRadius: "12px",
                          border: "1px solid",
                          borderColor: "divider",
                          borderLeft: "4px solid",
                          borderLeftColor: accentColor,
                          overflow: "hidden",
                          bgcolor: alpha(theme.palette.background.paper, 0.6),
                        }}
                      >
                        {/* Nivel 1 — crítico */}
                        <Box sx={{ px: 2, pt: 1.75, pb: 1, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1 }}>
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <EntityLink to={cliente?.id ? `/clientes/${cliente.id}` : null} label={clienteLabelFromTareas(cliente)} state={{ from: currentPath }} sx={{ fontWeight: 800, fontSize: "0.95rem" }} />
                          </Box>
                          <Typography variant="body1" fontWeight={800} color="warning.main" sx={{ flexShrink: 0 }}>
                            {gastoAmounts.formattedVal}
                          </Typography>
                        </Box>

                        {/* Nivel 2 — contexto */}
                        <Box sx={{ px: 2, pb: 1 }}>
                          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                            {label}{caso ? ` · ${casoLabel(caso)}` : ""}
                          </Typography>
                        </Box>

                        {/* Nivel 3 — metadatos y acciones */}
                        <Box sx={{ px: 2, pb: 1.5, display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                          <Typography variant="caption" color="text.secondary">{formatDateShort(item.fechaGasto)}</Typography>
                          <Chip size="small" label={estadoGasto?.nombre || "Pendiente"} color={chipColor} variant="outlined" sx={{ height: 20, fontSize: "0.65rem", fontWeight: 700 }} role="status" aria-label={`Estado: ${estadoGasto?.nombre || "Pendiente"}`} />
                          <Box sx={{ ml: "auto", display: "flex", gap: 0.5 }}>
                            {ingresosPerm.canCrear && (
                              <IconButton size="small" color="success" aria-label="Reintegrar gasto"
                                disabled={["PAGADO", "ANULADO"].includes(estadoCodigo)}
                                sx={{ p: { xs: 1.25, md: 0.75 } }}
                                onClick={() => navigate(finanzasNuevoUrl({ tipo: "ingreso", gastoId: item.id, clienteId: item.clienteId, casoId: item.casoId || "", monto: item.monto }), { state: { from: currentPath } })}
                              >
                                <ReceiptLong fontSize="small" />
                              </IconButton>
                            )}
                            {gastosPerm.canEditar && (
                              <IconButton size="small" color="primary" aria-label={`Editar gasto de ${clienteLabelFromTareas(cliente) || ""}`}
                                sx={{ p: { xs: 1.25, md: 0.75 } }}
                                onClick={() => navigate(finanzasEditarUrl("gasto", item.id), { state: { from: currentPath, item } })}
                              >
                                <Edit fontSize="small" />
                              </IconButton>
                            )}
                            {gastosPerm.canEliminar && (
                              <IconButton size="small" color="error" aria-label={`Eliminar gasto de ${clienteLabelFromTareas(cliente) || ""}`}
                                sx={{ p: { xs: 1.25, md: 0.75 } }}
                                onClick={() => finanzasModals.openDelete({ type: "gasto", item })}
                              >
                                <Delete fontSize="small" />
                              </IconButton>
                            )}
                          </Box>
                        </Box>
                      </Paper>
                    );
                  })}
                </Stack>
              </Box>
            </FinanzasTableShell>
          </TabPanel>

          <TabPanel value={tabIndex} index={2}>
            <FinanzasTableShell
              loading={ingresosQuery.isLoading}
              error={activeError}
              isEmpty={!ingresosQuery.isLoading && sortedIngresos.length === 0}
              emptyTitle="No hay ingresos para mostrar"
              emptySubtitle="Los cobros registrados apareceran aqui con su vinculacion."
              footer={tablePagination}
              columnWidths={[260, "30%", "30%", 100, 100, 100]}
            >
              {/* Desktop Table View */}
              <Table size="small" sx={{ ...denseTableSx, display: { xs: "none", md: "table" } }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.06) }}>
                    {sortableHead("concepto", "Concepto")}
                    {sortableHead("cliente", "Cliente")}
                    {sortableHead("expediente", "Expediente")}
                    {sortableHead("fecha", "Fecha de Pago")}
                    {sortableHead("monto", "Monto")}
                    <TableCell sx={{ fontWeight: 900, fontSize: "0.72rem", color: "text.secondary", width: 100 }}>Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                   {paginatedRows.map((item) => {
                    const cliente = clientesById.get(Number(item.clienteId));
                    const clienteNombre = clienteLabelFromTareas(cliente) || "Cliente";
                    const caso = expedientesById.get(Number(item.casoId));
                    const conceptoIngreso = conceptosIngresoById.get(Number(item.tipoId));
                    const label = conceptoIngreso?.nombre || item.descripcion || `Ingreso #${item.id}`;
                    return (
                      <TableRow key={item.id} hover>
                        <TableCell>
                          <Tooltip title={item.descripcion || label}>
                            <Typography variant="body2" sx={{ fontWeight: 700, ...ellipsisSx, maxWidth: 260 }}>{label}</Typography>
                          </Tooltip>
                        </TableCell>
                        <TableCell sx={{ maxWidth: 200 }}>
                          <EntityLink to={cliente?.id ? `/clientes/${cliente.id}` : null} label={clienteLabelFromTareas(cliente)} state={{ from: currentPath }} />
                        </TableCell>
                        <TableCell sx={{ maxWidth: 240 }}>
                          <EntityLink to={caso?.id ? `/expedientes/${caso.id}` : null} label={casoLabel(caso)} state={{ from: currentPath }} />
                        </TableCell>
                        <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDateShort(item.fechaIngreso)}</TableCell>
                        <TableCell sx={{ whiteSpace: "nowrap", color: "success.main" }}>
                          {(() => {
                            const currency = getItemCurrencyGeneral(item, catalogQuery.data?.MONEDA ?? []);
                            const amount = Number(item.monto ?? 0);
                            const cotizacion = Number(item.cotizacionArs ?? 0);

                            if (cotizacion > 0) {
                              const quantityJus = amount / cotizacion;
                              const formattedJus = new Intl.NumberFormat("es-AR", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 4,
                              }).format(quantityJus);

                              return (
                                <Box>
                                  <Box component="div" sx={{ fontWeight: 900 }}>
                                    {formatMoneyAr(amount)}
                                  </Box>
                                  <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: "0.75rem", fontWeight: 700 }}>
                                    ({formattedJus} JUS)
                                  </Typography>
                                </Box>
                              );
                            }

                            return (
                              <Box sx={{ fontWeight: 900 }}>
                                {formatCurrency(amount, currency)}
                              </Box>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.25}>
                            {ingresosPerm.canEditar && <IconButton size="small" color="primary" sx={{ p: { xs: 1.25, md: 0.75 } }} onClick={() => navigate(finanzasEditarUrl("ingreso", item.id), { state: { from: currentPath, item } })} aria-label={`Editar ingreso de ${clienteNombre}`}><Edit fontSize="small" /></IconButton>}
                            {ingresosPerm.canEliminar && <IconButton size="small" color="error" sx={{ p: { xs: 1.25, md: 0.75 } }} onClick={() => finanzasModals.openDelete({ type: "ingreso", item })} aria-label={`Eliminar ingreso de ${clienteNombre}`}><Delete fontSize="small" /></IconButton>}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Mobile Card List View */}
              <Box sx={{ display: { xs: "block", md: "none" }, p: 2 }}>
                <Stack spacing={1.5}>
                  {paginatedRows.map((item) => {
                    const cliente = clientesById.get(Number(item.clienteId));
                    const caso = expedientesById.get(Number(item.casoId));
                    const conceptoIngreso = conceptosIngresoById.get(Number(item.tipoId));
                    const label = conceptoIngreso?.nombre || item.descripcion || `Ingreso #${item.id}`;
                    const currency = getItemCurrencyGeneral(item, catalogQuery.data?.MONEDA ?? []);
                    const amount = Number(item.monto ?? 0);
                    const cotizacion = Number(item.cotizacionArs ?? 0);
                    const formattedAmount = cotizacion > 0
                      ? formatMoneyAr(amount)
                      : formatCurrency(amount, currency);
                    const jusLabel = cotizacion > 0
                      ? `${new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(amount / cotizacion)} JUS`
                      : null;
                    return (
                      <Paper
                        key={item.id}
                        elevation={0}
                        sx={{
                          borderRadius: "12px",
                          border: "1px solid",
                          borderColor: "divider",
                          borderLeft: "4px solid",
                          borderLeftColor: "success.main",
                          overflow: "hidden",
                          bgcolor: alpha(theme.palette.background.paper, 0.6),
                        }}
                      >
                        {/* Nivel 1 — crítico */}
                        <Box sx={{ px: 2, pt: 1.75, pb: 1, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1 }}>
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <EntityLink to={cliente?.id ? `/clientes/${cliente.id}` : null} label={clienteLabelFromTareas(cliente)} state={{ from: currentPath }} sx={{ fontWeight: 800, fontSize: "0.95rem" }} />
                          </Box>
                          <Box sx={{ flexShrink: 0, textAlign: "right" }}>
                            <Typography variant="body1" fontWeight={800} color="success.main" sx={{ lineHeight: 1.2 }}>
                              {formattedAmount}
                            </Typography>
                            {jusLabel && (
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.68rem" }}>{jusLabel}</Typography>
                            )}
                          </Box>
                        </Box>

                        {/* Nivel 2 — contexto */}
                        <Box sx={{ px: 2, pb: 1 }}>
                          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                            {label}{caso ? ` · ${casoLabel(caso)}` : ""}
                          </Typography>
                        </Box>

                        {/* Nivel 3 — metadatos y acciones */}
                        <Box sx={{ px: 2, pb: 1.5, display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                          <Typography variant="caption" color="text.secondary">{formatDateShort(item.fechaIngreso)}</Typography>
                          <Box sx={{ ml: "auto", display: "flex", gap: 0.5 }}>
                            {ingresosPerm.canEditar && (
                              <IconButton size="small" color="primary" aria-label={`Editar ingreso de ${clienteLabelFromTareas(cliente) || ""}`}
                                sx={{ p: { xs: 1.25, md: 0.75 } }}
                                onClick={() => navigate(finanzasEditarUrl("ingreso", item.id), { state: { from: currentPath, item } })}
                              >
                                <Edit fontSize="small" />
                              </IconButton>
                            )}
                            {ingresosPerm.canEliminar && (
                              <IconButton size="small" color="error" aria-label={`Eliminar ingreso de ${clienteLabelFromTareas(cliente) || ""}`}
                                sx={{ p: { xs: 1.25, md: 0.75 } }}
                                onClick={() => finanzasModals.openDelete({ type: "ingreso", item })}
                              >
                                <Delete fontSize="small" />
                              </IconButton>
                            )}
                          </Box>
                        </Box>
                      </Paper>
                    );
                  })}
                </Stack>
              </Box>
            </FinanzasTableShell>
          </TabPanel>

          <TabPanel value={tabIndex} index={3}>
            <Paper elevation={0} sx={{ borderRadius: "16px", border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
              <PlanesPagoTable
                planes={planesQuery.data ?? []}
                loading={planesQuery.isLoading}
                error={planesQuery.error}
                empty="No hay planes de pago cargados"
              />
            </Paper>
          </TabPanel>

          <TabPanel value={tabIndex} index={4}>
            <FinanzasTableShell
              loading={kpiLoading}
              error={activeError}
              isEmpty={!kpiLoading && cuentasCorrientes.length === 0}
              emptyTitle="No hay cuentas corrientes para mostrar"
              emptySubtitle="Los balances apareceran cuando existan movimientos asociados a clientes."
              footer={tablePagination}
              columnWidths={["40%", 120, 120, 120, 100]}
            >
              {/* Desktop Table View */}
              <Table size="small" sx={{ ...denseTableSx, display: { xs: "none", md: "table" } }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: alpha(theme.palette.info.main, 0.08) }}>
                    {sortableHead("cliente", "Cliente")}
                    {sortableHead("cargos", "Total Cargos")}
                    {sortableHead("cobrado", "Total Cobrado")}
                    {sortableHead("saldo", "Saldo Pendiente")}
                    {sortableHead("estado", "Estado Financiero")}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedRows.map((item) => {
                    const deudor = item.saldoPendiente > 0;
                    return (
                      <TableRow
                        key={item.clienteId}
                        hover
                        onClick={() => setSearchParams((prev) => {
                          const next = new URLSearchParams(prev);
                          next.set("clienteId", String(item.clienteId));
                          return next;
                        })}
                        sx={{ cursor: "pointer" }}
                      >
                        <TableCell sx={{ fontWeight: 900 }}>{item.clienteNombre}</TableCell>
                        <TableCell sx={{ whiteSpace: "nowrap", fontWeight: 800 }}>{formatMoneyAr(item.totalCargos)}</TableCell>
                        <TableCell sx={{ whiteSpace: "nowrap", fontWeight: 800, color: "success.main" }}>{formatMoneyAr(item.totalCobrado)}</TableCell>
                        <TableCell sx={{ whiteSpace: "nowrap", fontWeight: 950, color: deudor ? "error.main" : "success.main" }}>
                          {formatMoneyAr(item.saldoPendiente)}
                        </TableCell>
                         <TableCell>
                          <Chip size="small" label={deudor ? "Deudor" : "Al Dia"} color={deudor ? "error" : "success"} sx={{ fontWeight: 900 }} role="status" aria-label={`Estado: ${deudor ? "Deudor" : "Al Dia"}`} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Mobile Card List View */}
              <Box sx={{ display: { xs: "block", md: "none" }, p: 2 }}>
                <Stack spacing={1.5}>
                  {paginatedRows.map((item) => {
                    const deudor = item.saldoPendiente > 0;
                    return (
                      <Paper
                        key={item.clienteId}
                        elevation={0}
                        onClick={() => setSearchParams((prev) => {
                          const next = new URLSearchParams(prev);
                          next.set("clienteId", String(item.clienteId));
                          return next;
                        })}
                        sx={{
                          borderRadius: "12px",
                          border: "1px solid",
                          borderColor: "divider",
                          borderLeft: "4px solid",
                          borderLeftColor: deudor ? "error.main" : "success.main",
                          overflow: "hidden",
                          bgcolor: alpha(theme.palette.background.paper, 0.6),
                          cursor: "pointer",
                          transition: "border-color 0.15s, box-shadow 0.15s",
                          "&:hover": { boxShadow: 2, borderColor: "primary.main" },
                        }}
                      >
                        {/* Nivel 1 — crítico */}
                        <Box sx={{ px: 2, pt: 1.75, pb: 1, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 }}>
                          <Typography variant="body2" fontWeight={800} noWrap sx={{ flex: 1 }}>
                            {item.clienteNombre}
                          </Typography>
                          <Typography variant="body1" fontWeight={800} color={deudor ? "error.main" : "success.main"} sx={{ flexShrink: 0 }}>
                            {formatMoneyAr(item.saldoPendiente)}
                          </Typography>
                        </Box>

                        {/* Nivel 2 — contexto financiero */}
                        <Box sx={{ px: 2, pb: 1, display: "flex", gap: 2 }}>
                          <Box>
                            <Typography variant="caption" color="text.secondary" sx={{ display: "block", lineHeight: 1.2 }}>Cargos</Typography>
                            <Typography variant="caption" fontWeight={700}>{formatMoneyAr(item.totalCargos)}</Typography>
                          </Box>
                          <Box>
                            <Typography variant="caption" color="text.secondary" sx={{ display: "block", lineHeight: 1.2 }}>Cobrado</Typography>
                            <Typography variant="caption" fontWeight={700} color="success.main">{formatMoneyAr(item.totalCobrado)}</Typography>
                          </Box>
                        </Box>

                        {/* Nivel 3 — estado */}
                        <Box sx={{ px: 2, pb: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
                          <Chip size="small" label={deudor ? "Deudor" : "Al Día"} color={deudor ? "error" : "success"} variant="outlined" sx={{ height: 20, fontSize: "0.65rem", fontWeight: 700 }} role="status" aria-label={`Estado: ${deudor ? "Deudor" : "Al Día"}`} />
                          <Typography variant="caption" color="text.secondary" sx={{ ml: "auto" }}>Ver detalle →</Typography>
                        </Box>
                      </Paper>
                    );
                  })}
                </Stack>
              </Box>
            </FinanzasTableShell>
          </TabPanel>



          {activeQuery.isFetching && !activeQuery.isLoading && (
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1 }}>
              <CircularProgress size={14} />
              <Typography variant="caption" sx={{ color: "text.secondary" }}>Sincronizando...</Typography>
            </Stack>
          )}
    </Box>
  );
}

function MoneyWithNote({ value, note, formatMoney }) {
  return (
    <Box>
      <Box>{formatMoney(value)}</Box>
      {note && <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>{note}</Typography>}
    </Box>
  );
}

function CuentaCorrienteLedger({ title, subtitle, rows, formatDate, formatMoney, onPrint }) {
  const theme = useTheme();
  const saldoFinal = Number(rows[rows.length - 1]?.saldo ?? 0);
  const saldoFinalColor = saldoFinal > 0 ? "error.main" : "success.main";
  return (
    <Paper elevation={0} className="print-ledger" sx={{ border: "1px solid", borderColor: "divider", borderRadius: "16px", overflow: "hidden" }}>
      <style>{`
        @media print {
          .print-only { display: block !important; }
          body * { visibility: hidden; }
          .print-ledger, .print-ledger * { visibility: visible; }
          .print-ledger { position: absolute; left: 0; top: 0; width: 100%; border: 0 !important; box-shadow: none !important; }
          .no-print { display: none !important; }
          @page { margin: 18mm; }
        }
      `}</style>
      
      {/* Formal Header for Printing only */}
      <Box className="print-only" sx={{ display: "none", p: 2, bgcolor: "background.paper" }}>
        <Typography variant="overline" sx={{ fontWeight: 900, color: "text.secondary" }}>Estudio Juridico Iuris</Typography>
        <Typography variant="h5" sx={{ fontWeight: 950 }}>Libro Mayor - Cuenta Corriente</Typography>
        <Typography variant="body1" sx={{ fontWeight: 800, color: "text.secondary" }}>{subtitle}</Typography>
        <Divider sx={{ mt: 1.5 }} />
      </Box>

      {/* Screen Simplified Header */}
      <Stack className="no-print" direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "stretch", sm: "center" }} justifyContent="space-between" spacing={1.5} sx={{ p: 2, bgcolor: "background.paper" }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 950 }}>Cuenta Corriente</Typography>
        </Box>
        <Button variant="contained" startIcon={<Print />} onClick={onPrint} sx={{ fontWeight: 900, borderRadius: "10px" }}>
          Imprimir Cuenta Corriente
        </Button>
      </Stack>
      <Divider className="no-print" />

      {/* Desktop Table View */}
      <TableContainer sx={{ display: { xs: "none", sm: "block" } }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {["Fecha", "Tipo", "Descripcion", "Debe", "Haber", "Saldo Acumulado"].map((col) => (
                <TableCell key={col} sx={{ fontWeight: 900 }}>{col}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={6} sx={{ color: "text.secondary" }}>No hay movimientos registrados.</TableCell></TableRow>
            ) : rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDate(row.fecha)}</TableCell>
                <TableCell><Chip size="small" label={row.tipo} sx={{ fontWeight: 900 }} role="img" aria-label={`Tipo: ${row.tipo}`} /></TableCell>
                <TableCell sx={{ fontWeight: 800 }}>{row.descripcion}</TableCell>
                <TableCell sx={{ whiteSpace: "nowrap", fontWeight: 900 }}>
                  {row.debe > 0 ? <MoneyWithNote value={row.debe} note={row.note} formatMoney={formatMoney} /> : "-"}
                </TableCell>
                <TableCell sx={{ whiteSpace: "nowrap", fontWeight: 900, color: "success.main" }}>
                  {row.haber > 0 ? <MoneyWithNote value={row.haber} note={row.note} formatMoney={formatMoney} /> : "-"}
                </TableCell>
                <TableCell sx={{ whiteSpace: "nowrap", fontWeight: 950, color: row.saldo > 0 ? "error.main" : "success.main" }}>{formatMoney(row.saldo)}</TableCell>
              </TableRow>
            ))}
            {rows.length > 0 && (
              <TableRow sx={{ bgcolor: alpha(theme.palette.text.primary, 0.03), borderTop: "2px solid", borderColor: "divider" }}>
                <TableCell />
                <TableCell><Chip size="small" label="Saldo" sx={{ fontWeight: 900 }} /></TableCell>
                <TableCell />
                <TableCell />
                <TableCell />
                <TableCell sx={{ whiteSpace: "nowrap", fontWeight: 950, color: saldoFinalColor }}>{formatMoney(saldoFinal)}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Mobile Card List View */}
      <Box className="no-print" sx={{ display: { xs: "block", sm: "none" }, px: 2, pb: 2 }}>
        {rows.length === 0 ? (
          <Typography variant="body2" sx={{ color: "text.secondary", py: 2 }}>No hay movimientos registrados.</Typography>
        ) : (
          <Stack spacing={1.5}>
            {rows.map((row) => (
              <Paper
                key={row.id}
                elevation={0}
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: "12px",
                  p: 2,
                  bgcolor: alpha(theme.palette.background.paper, 0.5),
                }}
              >
                <Stack spacing={1.25}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800 }}>{formatDate(row.fecha)}</Typography>
                    <Chip size="small" label={row.tipo} sx={{ fontWeight: 900, height: 20, fontSize: "0.7rem" }} role="img" aria-label={`Tipo: ${row.tipo}`} />
                  </Box>
                  <Divider sx={{ borderStyle: "dashed" }} />
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 900 }}>{row.descripcion}</Typography>
                  </Box>
                  <Divider sx={{ borderStyle: "dashed" }} />
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800 }}>Monto</Typography>
                    <Box sx={{ fontWeight: 800, fontSize: "0.875rem" }}>
                      {row.debe > 0 && (
                        <Box sx={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-end" }}>
                          <Typography variant="body2" color="error.main" sx={{ fontWeight: 900 }}>
                            -{formatMoney(row.debe)}
                          </Typography>
                          {row.note && <Typography variant="caption" color="text.secondary">{row.note}</Typography>}
                        </Box>
                      )}
                      {row.haber > 0 && (
                        <Box sx={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-end" }}>
                          <Typography variant="body2" color="success.main" sx={{ fontWeight: 900 }}>
                            +{formatMoney(row.haber)}
                          </Typography>
                          {row.note && <Typography variant="caption" color="text.secondary">{row.note}</Typography>}
                        </Box>
                      )}
                    </Box>
                  </Box>
                  <Divider sx={{ borderStyle: "dashed" }} />
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800 }}>Saldo Acumulado</Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 950,
                        color: row.saldo > 0 ? "error.main" : "success.main",
                      }}
                    >
                      {formatMoney(row.saldo)}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            ))}
            <Paper
              elevation={0}
              sx={{
                border: "2px solid",
                borderColor: "divider",
                borderRadius: "12px",
                p: 2,
                bgcolor: alpha(theme.palette.action.hover, 0.7),
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Chip size="small" label="Saldo" sx={{ fontWeight: 900, mb: 0.75 }} />
                </Box>
                <Typography variant="body1" sx={{ fontWeight: 950, color: saldoFinalColor }}>
                  {formatMoney(saldoFinal)}
                </Typography>
              </Stack>
            </Paper>
          </Stack>
        )}
      </Box>
    </Paper>
  );
}

function ClienteCuentaCorrienteDetail({ clienteId, onBack, theme }) {
  // El libro mayor se calcula en el backend (motor Decimal); acá solo se renderiza.
  const ccQuery = useQuery({
    queryKey: ["clientes", clienteId, "cuenta-corriente"],
    queryFn: async () => {
      const { data } = await api.get(`/clientes/${clienteId}/cuenta-corriente`);
      return data?.data ?? data;
    },
    enabled: Boolean(clienteId),
  });
  const clienteQuery = useQuery({
    queryKey: ["clientes", clienteId],
    queryFn: async () => {
      const { data } = await api.get(`/clientes/${clienteId}`);
      return data?.data ?? data;
    },
    enabled: Boolean(clienteId),
  });

  const loading = ccQuery.isLoading;
  const error = ccQuery.error?.response?.data?.error?.message
    || ccQuery.error?.message
    || (ccQuery.isError ? "Error de conexion" : null);

  const totales = ccQuery.data?.totales ?? null;
  const rows = useMemo(() => mapCuentaCorrienteApiRows(ccQuery.data?.rows ?? []), [ccQuery.data?.rows]);
  const saldo = Number(totales?.saldoPesos ?? 0);

  if (loading) {
    return (
      <Box sx={{ p: 10, display: "flex", justifyContent: "center", alignItems: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Paper elevation={0} sx={{ p: 4, borderRadius: "16px", border: "1px solid", borderColor: "divider", textAlign: "center" }}>
        <WarningAmber sx={{ fontSize: 48, color: "error.main", mb: 1 }} />
        <Typography variant="h6" sx={{ fontWeight: 900 }}>No se pudieron cargar los datos</Typography>
        <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>{error}</Typography>
        <Button variant="outlined" startIcon={<ArrowBack />} onClick={onBack} sx={{ mt: 2, borderRadius: "10px" }}>
          Volver
        </Button>
      </Paper>
    );
  }

  const cliente = clienteQuery.data ?? null;
  const nombre = clienteLabel(cliente) || (cliente ? [cliente.apellido, cliente.nombre].filter(Boolean).join(", ") : "") || `Cliente #${clienteId}`;

  const totalHonorarios = Number(totales?.honorariosPesos ?? 0);
  const totalGastos = Number(totales?.gastosPesos ?? 0);
  const totalIngresos = Number(totales?.ingresosPesos ?? 0);

  return (
    <Stack spacing={3}>
      <Box sx={{ display: "flex", justifyContent: "flex-start" }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={onBack}
          sx={{ fontWeight: 800 }}
        >
          Volver
        </Button>
      </Box>

      {/* Cards resumen ocultas por ahora. Dejarlas disponibles por si se quieren reactivar en el detalle de cuenta corriente.
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Paper elevation={0} sx={{ p: 2.5, border: "1px solid", borderColor: "divider", borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Box>
              <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800 }}>Total Honorarios</Typography>
              <Typography variant="h5" sx={{ fontWeight: 900, mt: 0.5 }}>{formatMoneyAr(totalHonorarios)}</Typography>
            </Box>
            <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1), color: "primary.main" }}><Payments /></Avatar>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Paper elevation={0} sx={{ p: 2.5, border: "1px solid", borderColor: "divider", borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Box>
              <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800 }}>Total Gastos</Typography>
              <Typography variant="h5" sx={{ fontWeight: 900, mt: 0.5 }}>{formatMoneyAr(totalGastos)}</Typography>
            </Box>
            <Avatar sx={{ bgcolor: alpha(theme.palette.warning.main, 0.1), color: "warning.main" }}><ReceiptLong /></Avatar>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Paper elevation={0} sx={{ p: 2.5, border: "1px solid", borderColor: "divider", borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Box>
              <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800 }}>Ingresos / Cobrado</Typography>
              <Typography variant="h5" sx={{ fontWeight: 900, mt: 0.5 }}>{formatMoneyAr(totalIngresos)}</Typography>
            </Box>
            <Avatar sx={{ bgcolor: alpha(theme.palette.success.main, 0.1), color: "success.main" }}><AccountBalanceWallet /></Avatar>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Paper elevation={0} sx={{ p: 2.5, border: "1px solid", borderColor: "divider", borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Box>
              <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800 }}>Saldo Pendiente</Typography>
              <Typography variant="h5" sx={{ fontWeight: 900, mt: 0.5 }}>{formatMoneyAr(saldo)}</Typography>
            </Box>
            <Avatar sx={{ bgcolor: alpha(saldo > 0 ? theme.palette.error.main : theme.palette.success.main, 0.1), color: saldo > 0 ? "error.main" : "success.main" }}><TrendingDown /></Avatar>
          </Paper>
        </Grid>
      </Grid>
      */}

      <CuentaCorrienteLedger
        title="Libro Mayor - Cuenta Corriente"
        subtitle={nombre}
        rows={rows}
        formatDate={formatDateShort}
        formatMoney={formatMoneyAr}
        onPrint={() => window.print()}
      />
    </Stack>
  );
}
