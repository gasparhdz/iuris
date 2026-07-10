import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Link as RouterLink, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { usePermisos } from "../auth/usePermissions";
import { useFinanzasModals } from "../components/finanzas/useFinanzasModals";
import PlanesPagoTable from "../components/finanzas/PlanesPagoTable";
import { alpha, useTheme } from "@mui/material/styles";
import Grid from "@mui/material/Grid";
import { motion } from "framer-motion";
import api from "../api/axios";
import { fetchAllPages } from "../api/pagination";

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
  conceptoLabel,
  denseTableSx,
  ellipsisSx,
  finanzasEditarUrl,
  finanzasNuevoUrl,
  formatDateShort,
  formatMoneyAr,
  honorarioEstadoChip,
  isHonorarioPendiente,
  linkSx,
  unwrapPaged,
  formatCurrency,
  computeGastoAmounts,
  computeHonorarioAmounts,
  movementAmountPesos,
  getItemCurrencyGeneral,
  mapCuentaCorrienteApiRows,
  startOfDayArgentina,
  endOfDayArgentina,
  toArgentinaDateString,
} from "./finanzasUtils";
import { clienteLabel as clienteLabelFromTareas } from "./tareasUtils";

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
  const todayStart = startOfDayArgentina(now);
  const todayEnd = endOfDayArgentina(now);
  const todayYmd = toArgentinaDateString(now);
  const [y, m, d] = todayYmd.split("-").map(Number);

  switch (key) {
    case "hoy":
      return { from: todayStart, to: todayEnd };
    case "semana": {
      // Lunes de la semana calendario ART
      const jsDay = new Date(`${todayYmd}T12:00:00.000Z`).getUTCDay();
      const daysFromMonday = (jsDay + 6) % 7;
      const monday = new Date(todayStart);
      monday.setUTCDate(monday.getUTCDate() - daysFromMonday);
      return { from: monday, to: todayEnd };
    }
    case "mes":
      return {
        from: new Date(`${y}-${String(m).padStart(2, "0")}-01T03:00:00.000Z`),
        to: todayEnd,
      };
    case "trimestre": {
      const threeMonthsAgo = new Date(Date.UTC(y, m - 1 - 3, d, 3, 0, 0, 0));
      return { from: startOfDayArgentina(threeMonthsAgo), to: todayEnd };
    }
    case "anio":
      return { from: new Date(`${y}-01-01T03:00:00.000Z`), to: todayEnd };
    default:
      return { from: null, to: null };
  }
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
        from: customFrom ? startOfDayArgentina(new Date(`${customFrom}T12:00:00.000Z`)) : null,
        to: customTo ? endOfDayArgentina(new Date(`${customTo}T12:00:00.000Z`)) : null,
      };
    }
    return getPresetRange(datePreset);
  }, [datePreset, customFrom, customTo]);

  const finanzasDateParams = useMemo(() => {
    const params = {};
    if (dateRange.from) params.from = dateRange.from.toISOString();
    if (dateRange.to) params.to = dateRange.to.toISOString();
    return params;
  }, [dateRange]);

  const honorariosFilterParams = useMemo(() => ({
    search: debouncedSearch.trim() || undefined,
    ...finanzasDateParams,
  }), [debouncedSearch, finanzasDateParams]);

  const honorariosListParams = useMemo(() => ({
    ...honorariosFilterParams,
    page: page + 1,
    limit: rowsPerPage,
    orderBy,
    order,
  }), [honorariosFilterParams, page, rowsPerPage, orderBy, order]);

  const gastosFilterParams = useMemo(() => ({
    search: debouncedSearch.trim() || undefined,
    ...finanzasDateParams,
  }), [debouncedSearch, finanzasDateParams]);

  const gastosListParams = useMemo(() => ({
    ...gastosFilterParams,
    page: page + 1,
    limit: rowsPerPage,
    orderBy,
    order,
  }), [gastosFilterParams, page, rowsPerPage, orderBy, order]);

  const ingresosFilterParams = useMemo(() => ({
    search: debouncedSearch.trim() || undefined,
    ...finanzasDateParams,
  }), [debouncedSearch, finanzasDateParams]);

  const ingresosListParams = useMemo(() => ({
    ...ingresosFilterParams,
    page: page + 1,
    limit: rowsPerPage,
    orderBy,
    order,
  }), [ingresosFilterParams, page, rowsPerPage, orderBy, order]);

  const ccListParams = useMemo(() => ({
    page: page + 1,
    limit: rowsPerPage,
    search: debouncedSearch.trim() || undefined,
    orderBy,
    order,
  }), [page, rowsPerPage, debouncedSearch, orderBy, order]);

  useEffect(() => {
    setPage(0);
  }, [tabKey, debouncedSearch, orderBy, order, datePreset, customFrom, customTo]);

  const honorariosQuery = useQuery({
    queryKey: ["honorarios", "list", honorariosListParams],
    queryFn: async () => {
      const { data } = await api.get("/honorarios", { params: honorariosListParams });
      return unwrapPaged(data);
    },
    enabled: tabKey === "honorarios",
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  });

  const honorariosKpiQuery = useQuery({
    queryKey: ["honorarios", "kpi", honorariosFilterParams],
    queryFn: () => fetchAllPages("/honorarios", honorariosFilterParams),
    enabled: tabKey === "honorarios",
    staleTime: 60_000,
  });

  const gastosQuery = useQuery({
    queryKey: ["gastos", "list", gastosListParams],
    queryFn: async () => {
      const { data } = await api.get("/gastos", { params: gastosListParams });
      return unwrapPaged(data);
    },
    enabled: tabKey === "gastos",
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  });

  const gastosKpiQuery = useQuery({
    queryKey: ["gastos", "kpi", gastosFilterParams],
    queryFn: () => fetchAllPages("/gastos", gastosFilterParams),
    enabled: tabKey === "gastos",
    staleTime: 60_000,
  });

  const ingresosQuery = useQuery({
    queryKey: ["ingresos", "list", ingresosListParams],
    queryFn: async () => {
      const { data } = await api.get("/ingresos", { params: ingresosListParams });
      return unwrapPaged(data);
    },
    enabled: tabKey === "ingresos",
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  });

  const planesQuery = useQuery({
    queryKey: ["planes", "global"],
    queryFn: () => api.get("/planes").then((r) => r.data?.data ?? []),
    enabled: tabKey === "planes" || tabKey === "honorarios",
    staleTime: 60_000,
  });

  // Resumen de cuenta corriente por cliente calculado en el backend (motor Decimal).
  const ccResumenQuery = useQuery({
    queryKey: ["clientes", "cuentas-corrientes", "list", ccListParams],
    queryFn: async () => {
      const { data } = await api.get("/clientes/cuentas-corrientes", { params: ccListParams });
      return unwrapPaged(data);
    },
    enabled: tabKey === "cuentas_corrientes",
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  });

  const ccKpiQuery = useQuery({
    queryKey: ["clientes", "cuentas-corrientes", "kpi"],
    queryFn: () => fetchAllPages("/clientes/cuentas-corrientes"),
    enabled: tabKey === "cuentas_corrientes",
    staleTime: 60_000,
  });

  const valorJusQuery = useQuery({
    queryKey: ["valorjus", "actual"],
    queryFn: async () => {
      const { data } = await api.get("/valorjus/actual");
      return data?.data ?? data;
    },
    enabled: tabKey === "honorarios" || tabKey === "gastos" || tabKey === "cuentas_corrientes",
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
    enabled: tabKey === "honorarios" || tabKey === "gastos" || tabKey === "ingresos",
    staleTime: 300_000,
  });

  const clientesQuery = useQuery({
    queryKey: ["clientes", "lookup", "finanzas"],
    queryFn: () => fetchAllPages("/clientes"),
    enabled: tabKey === "honorarios" || tabKey === "gastos" || tabKey === "ingresos",
    staleTime: 300_000,
  });

  const expedientesQuery = useQuery({
    queryKey: ["expedientes", "lookup", "finanzas"],
    queryFn: () => fetchAllPages("/expedientes"),
    enabled: tabKey === "honorarios" || tabKey === "gastos" || tabKey === "ingresos",
    staleTime: 300_000,
  });

  const conceptosQuery = useQuery({
    queryKey: ["catalogos", "parametros", "CONCEPTO_GASTO", "finanzas"],
    queryFn: async () => {
      const { data } = await api.get("/catalogos/parametros", { params: { categoria: "CONCEPTO_GASTO" } });
      const raw = data?.data ?? data;
      return Array.isArray(raw) ? raw : [];
    },
    enabled: tabKey === "gastos",
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

  const honorarios = useMemo(() => honorariosQuery.data?.items ?? [], [honorariosQuery.data?.items]);
  const gastos = useMemo(() => gastosQuery.data?.items ?? [], [gastosQuery.data?.items]);
  const ingresos = useMemo(() => ingresosQuery.data?.items ?? [], [ingresosQuery.data?.items]);
  const honorariosKpi = useMemo(() => honorariosKpiQuery.data ?? [], [honorariosKpiQuery.data]);
  const gastosKpi = useMemo(() => gastosKpiQuery.data ?? [], [gastosKpiQuery.data]);

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

  const processedHonorariosKpi = useMemo(() => {
    const valorJusActual = Number(valorJusQuery.data?.valor ?? 0);
    const catalogMonedas = catalogQuery.data?.MONEDA ?? [];
    const catalogPoliticas = catalogQuery.data?.POLITICA_JUS ?? [];

    return honorariosKpi.map((item) => {
      const computed = computeHonorarioAmounts(item, valorJusActual, catalogMonedas, catalogPoliticas);
      return {
        ...item,
        computed,
      };
    });
  }, [honorariosKpi, valorJusQuery.data, catalogQuery.data]);

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
    // Saldo del motor de CC expuesto por el backend (incluye intereses y JUS AL_COBRO).
    const backendSaldo = item?.calc?.saldoPesos ?? computed?.saldoPesos;
    if (backendSaldo != null && Number.isFinite(Number(backendSaldo))) {
      return {
        value: Math.max(0, Number(backendSaldo)),
        currency: "ARS",
      };
    }

    const planSaldo = planesByHonorario.get(Number(item.id));
    if (planSaldo) {
      return {
        value: Math.max(0, planSaldo.saldo),
        currency: "ARS",
      };
    }

    // Fallback legacy si el backend aún no envió saldoCalculado.
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

    const honorariosKpiCalc = processedHonorariosKpi.reduce(
      (acc, honorario) => {
        const computed = honorario.computed;
        const planData = planesByHonorario.get(Number(honorario.id));
        acc.total += Math.round(Number(computed?.updatedVal ?? 0) * 100);
        if (planData) {
          acc.cobrado += Math.round(Number(planData.cobrado) * 100);
          acc.pendiente += Math.round(Number(planData.saldo) * 100);
        } else {
          acc.cobrado += Math.round(Number(honorario.montoCobrado ?? 0) * 100);
          const saldo = getHonorarioSaldoPendiente(honorario, computed);
          acc.pendiente += Math.round(Number(saldo.value ?? 0) * 100);
        }
        return acc;
      },
      { total: 0, cobrado: 0, pendiente: 0 },
    );

    const gastosKpiCalc = gastosKpi.reduce(
      (acc, gasto) => {
        const amountCents = Math.round(movementAmountPesos(gasto, "gasto", valorJusActual, catalogMonedas) * 100);
        const estado = estadosGastoById.get(Number(gasto.estadoId));
        const isPagado = String(estado?.codigo ?? "").toUpperCase() === "PAGADO";
        acc.total += amountCents;
        if (isPagado) acc.pagado += amountCents;
        else acc.pendiente += amountCents;
        return acc;
      },
      { total: 0, pagado: 0, pendiente: 0 },
    );

    const cuentasKpi = (ccKpiQuery.data ?? []).reduce(
      (acc, { totales }) => {
        acc.cargos += Math.round((Number(totales?.honorariosPesos ?? 0) + Number(totales?.gastosPesos ?? 0)) * 100);
        acc.cobrado += Math.round(Number(totales?.ingresosPesos ?? 0) * 100);
        acc.pendiente += Math.round(Number(totales?.saldoPesos ?? 0) * 100);
        return acc;
      },
      { cargos: 0, cobrado: 0, pendiente: 0 },
    );

    return {
      honorarios: {
        total: honorariosKpiCalc.total / 100,
        cobrado: honorariosKpiCalc.cobrado / 100,
        pendiente: honorariosKpiCalc.pendiente / 100,
      },
      gastos: {
        total: gastosKpiCalc.total / 100,
        pagado: gastosKpiCalc.pagado / 100,
        pendiente: gastosKpiCalc.pendiente / 100,
      },
      cuentas: {
        cargos: cuentasKpi.cargos / 100,
        cobrado: cuentasKpi.cobrado / 100,
        pendiente: cuentasKpi.pendiente / 100,
      },
    };
  }, [
    processedHonorariosKpi,
    gastosKpi,
    catalogQuery.data,
    valorJusQuery.data,
    getHonorarioSaldoPendiente,
    estadosGastoById,
    planesByHonorario,
    ccKpiQuery.data,
  ]);

  const kpiLoading = tabKey === "honorarios"
    ? honorariosKpiQuery.isLoading || planesQuery.isLoading || valorJusQuery.isLoading || catalogQuery.isLoading
    : tabKey === "gastos"
      ? gastosKpiQuery.isLoading || valorJusQuery.isLoading || catalogQuery.isLoading
      : tabKey === "cuentas_corrientes"
        ? ccKpiQuery.isLoading
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
    setOrderBy(tabKey === "cuentas_corrientes" ? "saldo" : "fecha");
    setOrder("desc");
    setPage(0);
  }, [tabKey]);

  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(property);
    setPage(0);
  };

  const cuentasCorrientes = useMemo(() => {
    return (ccResumenQuery.data?.items ?? []).map((item) => {
      const {
        clienteId,
        terceroId,
        tipoDeudor = "cliente",
        deudorNombre,
        totales,
      } = item;
      const cliente = clienteId != null ? clientesById.get(Number(clienteId)) : null;
      const nombre = deudorNombre
        || (cliente ? clienteLabelFromTareas(cliente) : null)
        || (tipoDeudor === "tercero" ? `Tercero #${terceroId}` : `Cliente #${clienteId}`);
      return {
        key: tipoDeudor === "tercero" ? `tercero:${terceroId}` : `cliente:${clienteId}`,
        tipoDeudor,
        clienteId: clienteId != null ? Number(clienteId) : null,
        terceroId: terceroId != null ? Number(terceroId) : null,
        cliente,
        clienteNombre: nombre,
        totalCargos: Number(totales?.honorariosPesos ?? 0) + Number(totales?.gastosPesos ?? 0),
        totalCobrado: Number(totales?.ingresosPesos ?? 0),
        saldoPendiente: Number(totales?.saldoPesos ?? 0),
      };
    });
  }, [ccResumenQuery.data, clientesById]);

  const activeTotalCount = tabKey === "honorarios"
    ? honorariosQuery.data?.meta?.total ?? 0
    : tabKey === "gastos"
      ? gastosQuery.data?.meta?.total ?? 0
      : tabKey === "ingresos"
        ? ingresosQuery.data?.meta?.total ?? 0
        : tabKey === "planes"
          ? (planesQuery.data ?? []).length
          : ccResumenQuery.data?.meta?.total ?? 0;

  const activeRows = tabKey === "honorarios"
    ? processedHonorarios
    : tabKey === "gastos"
      ? gastos
      : tabKey === "ingresos"
        ? ingresos
        : tabKey === "planes"
          ? (planesQuery.data ?? [])
          : cuentasCorrientes;
  const paginatedRows = activeRows;

  const activeQuery = tabKey === "honorarios"
    ? honorariosQuery
    : tabKey === "gastos"
      ? gastosQuery
    : tabKey === "ingresos"
      ? ingresosQuery
    : tabKey === "planes"
      ? planesQuery
    : tabKey === "cuentas_corrientes"
      ? ccResumenQuery
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
      count={activeTotalCount}
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
          {tabKey !== "cuentas_corrientes" && (
            <>
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
              isEmpty={!honorariosQuery.isLoading && !planesQuery.isLoading && processedHonorarios.length === 0}
              emptyTitle="No hay honorarios para mostrar"
              emptySubtitle="Ajusta el buscador o registra honorarios desde un cliente o expediente."
              footer={tablePagination}
              columnWidths={[180, "16%", "16%", "14%", 80, 100, 100, 80, 120]}
            >
              {/* Desktop Table View */}
              <Table size="small" sx={{ ...denseTableSx, display: { xs: "none", md: "table" } }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.06) }}>
                    {sortableHead("concepto", "Concepto")}
                    {sortableHead("cliente", "Cliente")}
                    <TableCell sx={{ fontWeight: 900, fontSize: "0.72rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "text.secondary" }}>
                      Obligado
                    </TableCell>
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
                    const obligadoNombre = item.obligadoNombre
                      || (item.parte?.nombre ? item.parte.nombre : null)
                      || "—";
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
                        <TableCell sx={{ maxWidth: 180 }}>
                          <Tooltip title={obligadoNombre}>
                            <Typography variant="body2" sx={{ ...ellipsisSx, maxWidth: 180 }}>{obligadoNombre}</Typography>
                          </Tooltip>
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
                          {(item.obligadoNombre || item.parte?.nombre) && (
                            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                              Obligado: {item.obligadoNombre || item.parte?.nombre}
                            </Typography>
                          )}
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
              isEmpty={!gastosQuery.isLoading && gastos.length === 0}
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
                                  onClick={() => {
                                    const catalogMonedas = catalogQuery.data?.MONEDA ?? [];
                                    const currency = getItemCurrencyGeneral(item, catalogMonedas);
                                    const valorJus = Number(valorJusQuery.data?.valor ?? 0);
                                    const cotizacion = Number(item.cotizacionArs ?? (currency === "JUS" ? valorJus : 0));
                                    const cantidad = Number(item.monto ?? 0);
                                    const montoArs = (currency !== "ARS" && cotizacion > 0)
                                      ? Number((cantidad * cotizacion).toFixed(2))
                                      : cantidad;
                                    navigate(
                                      finanzasNuevoUrl({
                                        tipo: "ingreso",
                                        gastoId: item.id,
                                        clienteId: item.clienteId,
                                        casoId: item.casoId || "",
                                        monto: montoArs,
                                      }),
                                      {
                                        state: {
                                          from: currentPath,
                                          reintegroConversion: (currency !== "ARS" && cotizacion > 0)
                                            ? { cantidad, moneda: currency, cotizacion, montoArs }
                                            : null,
                                        },
                                      },
                                    );
                                  }}
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
                                onClick={() => {
                                  const catalogMonedas = catalogQuery.data?.MONEDA ?? [];
                                  const currency = getItemCurrencyGeneral(item, catalogMonedas);
                                  const valorJus = Number(valorJusQuery.data?.valor ?? 0);
                                  const cotizacion = Number(item.cotizacionArs ?? (currency === "JUS" ? valorJus : 0));
                                  const cantidad = Number(item.monto ?? 0);
                                  const montoArs = (currency !== "ARS" && cotizacion > 0)
                                    ? Number((cantidad * cotizacion).toFixed(2))
                                    : cantidad;
                                  navigate(
                                    finanzasNuevoUrl({
                                      tipo: "ingreso",
                                      gastoId: item.id,
                                      clienteId: item.clienteId,
                                      casoId: item.casoId || "",
                                      monto: montoArs,
                                    }),
                                    {
                                      state: {
                                        from: currentPath,
                                        reintegroConversion: (currency !== "ARS" && cotizacion > 0)
                                          ? { cantidad, moneda: currency, cotizacion, montoArs }
                                          : null,
                                      },
                                    },
                                  );
                                }}
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
              isEmpty={!ingresosQuery.isLoading && ingresos.length === 0}
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
                    const canOpenDetalle = item.tipoDeudor !== "tercero" && item.clienteId != null;
                    return (
                      <TableRow
                        key={item.key}
                        hover={canOpenDetalle}
                        onClick={canOpenDetalle ? () => setSearchParams((prev) => {
                          const next = new URLSearchParams(prev);
                          next.set("clienteId", String(item.clienteId));
                          return next;
                        }) : undefined}
                        sx={{ cursor: canOpenDetalle ? "pointer" : "default" }}
                      >
                        <TableCell sx={{ fontWeight: 900 }}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <span>{item.clienteNombre}</span>
                            {item.tipoDeudor === "tercero" && (
                              <Chip size="small" label="Tercero" color="warning" variant="outlined" sx={{ height: 20, fontSize: "0.65rem", fontWeight: 800 }} />
                            )}
                          </Stack>
                        </TableCell>
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
                    const canOpenDetalle = item.tipoDeudor !== "tercero" && item.clienteId != null;
                    return (
                      <Paper
                        key={item.key}
                        elevation={0}
                        onClick={canOpenDetalle ? () => setSearchParams((prev) => {
                          const next = new URLSearchParams(prev);
                          next.set("clienteId", String(item.clienteId));
                          return next;
                        }) : undefined}
                        sx={{
                          borderRadius: "12px",
                          border: "1px solid",
                          borderColor: "divider",
                          borderLeft: "4px solid",
                          borderLeftColor: deudor ? "error.main" : "success.main",
                          overflow: "hidden",
                          bgcolor: alpha(theme.palette.background.paper, 0.6),
                          cursor: canOpenDetalle ? "pointer" : "default",
                          transition: "border-color 0.15s, box-shadow 0.15s",
                          "&:hover": canOpenDetalle ? { boxShadow: 2, borderColor: "primary.main" } : undefined,
                        }}
                      >
                        {/* Nivel 1 — crítico */}
                        <Box sx={{ px: 2, pt: 1.75, pb: 1, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 }}>
                          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="body2" fontWeight={800} noWrap>
                              {item.clienteNombre}
                            </Typography>
                            {item.tipoDeudor === "tercero" && (
                              <Chip size="small" label="Tercero" color="warning" variant="outlined" sx={{ height: 18, fontSize: "0.6rem", fontWeight: 800 }} />
                            )}
                          </Stack>
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
                          {canOpenDetalle && (
                            <Typography variant="caption" color="text.secondary" sx={{ ml: "auto" }}>Ver detalle →</Typography>
                          )}
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

function CuentaCorrienteLedger({ subtitle, rows, formatDate, formatMoney, onPrint }) {
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

function ClienteCuentaCorrienteDetail({ clienteId, onBack }) {
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

  const rows = useMemo(() => mapCuentaCorrienteApiRows(ccQuery.data?.rows ?? []), [ccQuery.data?.rows]);

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
        subtitle={nombre}
        rows={rows}
        formatDate={formatDateShort}
        formatMoney={formatMoneyAr}
        onPrint={() => window.print()}
      />
    </Stack>
  );
}
