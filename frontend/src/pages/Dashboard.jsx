import { useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import dayjs from "dayjs";
import "dayjs/locale/es";
import { motion, AnimatePresence } from "framer-motion";
import { alpha, useTheme } from "@mui/material/styles";
import {
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import {
  AssignmentTurnedIn,
  Balance,
  CalendarMonth,
  Check,
  ExpandLess,
  ExpandMore,
  FolderSpecial,
  Gavel,
  LocationOn,
  OpenInNew,
  Payments,
  PersonAdd,
  ReceiptLong,
  Refresh,
  WarningAmber,
} from "@mui/icons-material";
import api from "../api/axios";
import { useAuth } from "../auth/AuthContext";
import SisfeSyncButton from "../components/SisfeSyncButton";
import {
  formatMoneyAr,
  isHonorarioPendiente,
  movementAmountPesos,
  unwrapPaged,
  computeHonorarioAmounts,
} from "./finanzasUtils";
import {
  casoLabel,
  checklistStats,
  clienteLabel,
  formatFriendlyDate,
  getApiError,
  isOverdue,
  unwrapEntity,
  unwrapItems,
} from "./tareasUtils";

dayjs.locale("es");

const CARD_TONES = {
  blue: "#5B7CFA",
  orange: "#FFA726",
  green: "#2EBD85",
  red: "#EF5350",
  violet: "#8B5CF6",
  cyan: "#29B6F6",
};

const PRIORITY_TONES = {
  CRITICA: "#EF5350",
  CRITICA_: "#EF5350",
  ALTA: "#FFA726",
  MEDIA: "#29B6F6",
  BAJA: "#66BB6A",
  DEFAULT: "#8EA0B8",
};

const panelSx = {
  border: "1px solid",
  borderColor: "divider",
  backgroundColor: "background.paper",
  boxShadow: "none",
  borderRadius: "16px",
};

function normalizeCode(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .toUpperCase();
}

function payloadItems(data) {
  return unwrapPaged(data).items;
}

function readUserName(user) {
  const raw = user?.nombre || user?.name || user?.usuario?.nombre || user?.email || "";
  const clean = String(raw).split("@")[0].trim();
  return clean ? clean.split(/\s+/)[0] : "";
}

function displayDate() {
  const value = dayjs().format("dddd, D [de] MMMM [de] YYYY");
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function eventDate(event) {
  return event?.fechaInicio || event?.fecha || event?.inicio || event?.start;
}

function moneyCompact(value) {
  const n = Number(value || 0);
  if (Math.abs(n) >= 1_000_000) return `${formatMoneyAr(n / 1_000_000)} M`;
  return formatMoneyAr(n);
}

function priorityColor(priority) {
  const code = normalizeCode(priority?.codigo || priority?.nombre || priority);
  return PRIORITY_TONES[code] || PRIORITY_TONES.DEFAULT;
}

function priorityLabel(task) {
  return task?.prioridad?.nombre || task?.prioridadNombre || "Sin prioridad";
}

function KpiCard({ title, value, caption, Icon, tone, progress, loading }) {
  const theme = useTheme();
  return (
    <Box
      component={motion.div}
      whileHover={{ y: -5 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      sx={{ height: "100%" }}
    >
      <Paper
        elevation={0}
        sx={{
          ...panelSx,
          p: 2.25,
          height: "100%",
          position: "relative",
          overflow: "hidden",
          "&:hover": {
            borderColor: "primary.main",
          },
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2} sx={{ position: "relative" }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {title}
            </Typography>
            <Typography sx={{ fontSize: { xs: "1.8rem", xl: "2.05rem" }, fontWeight: 800, lineHeight: 1.05, mt: 1 }}>
              {loading ? <CircularProgress size={24} /> : value}
            </Typography>
            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 500, display: "block", mt: 0.8 }}>
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
            <Icon />
          </Avatar>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={Math.max(5, Math.min(100, Number(progress || 0)))}
          sx={{
            mt: 2.2,
            height: 5,
            borderRadius: 999,
            bgcolor: alpha(tone, 0.12),
            "& .MuiLinearProgress-bar": {
              borderRadius: 999,
              bgcolor: tone,
            },
          }}
        />
      </Paper>
    </Box>
  );
}

function PriorityPill({ task }) {
  const tone = priorityColor(task?.prioridad || task?.prioridadNombre);
  return (
    <Chip
      size="small"
      label={priorityLabel(task)}
      sx={{
        height: 23,
        borderRadius: "999px",
        bgcolor: alpha(tone, 0.14),
        color: tone,
        border: `1px solid ${alpha(tone, 0.38)}`,
        fontWeight: 800,
        fontSize: "0.68rem",
      }}
    />
  );
}

function AnimatedCheck({ checked, disabled, onClick }) {
  const theme = useTheme();
  return (
    <Tooltip title={checked ? "Marcar pendiente" : "Completar"}>
      <Box
        component={motion.button}
        type="button"
        disabled={disabled}
        onClick={onClick}
        whileTap={{ scale: 0.82 }}
        animate={{
          scale: checked ? 1 : 0.96,
          backgroundColor: checked ? CARD_TONES.green : alpha(theme.palette.background.paper, 0.55),
          borderColor: checked ? CARD_TONES.green : alpha(theme.palette.text.secondary, 0.32),
        }}
        transition={{ type: "spring", stiffness: 420, damping: 22 }}
        style={{
          width: 30,
          height: 30,
          borderRadius: 999,
          border: "1px solid",
          display: "grid",
          placeItems: "center",
          cursor: disabled ? "progress" : "pointer",
          padding: 0,
          flex: "0 0 auto",
        }}
      >
        <AnimatePresence>
          {checked && (
            <Box
              component={motion.span}
              initial={{ scale: 0, rotate: -45, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              sx={{ color: "white", lineHeight: 0 }}
            >
              <Check fontSize="small" />
            </Box>
          )}
        </AnimatePresence>
      </Box>
    </Tooltip>
  );
}

function TaskRow({ task, expanded, onExpand, onToggle, onToggleSubtask, busy, navigate }) {
  const theme = useTheme();
  const stats = checklistStats(task);
  const overdue = isOverdue(task);
  const subtasks = Array.isArray(task.items) ? task.items : [];
  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: "14px",
        border: "1px solid",
        borderColor: "divider",
        borderLeft: `4px solid ${overdue ? CARD_TONES.red : alpha(priorityColor(task.prioridad), 0.75)}`,
        bgcolor: "background.paper",
        boxShadow: "none",
      }}
    >
      <Stack direction="row" spacing={1.25} alignItems="flex-start">
        <AnimatedCheck checked={Boolean(task.completada)} disabled={busy} onClick={(e) => { e.stopPropagation(); onToggle(task); }} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="body2" sx={{ fontWeight: 800, color: task.completada ? "text.secondary" : "text.primary" }}>
              {task.titulo || "Tarea sin título"}
            </Typography>
            <PriorityPill task={task} />
            {overdue && (
              <Chip
                icon={<WarningAmber sx={{ fontSize: "14px !important" }} />}
                label="Atrasado"
                size="small"
                sx={{
                  height: 23,
                  bgcolor: alpha(CARD_TONES.red, 0.12),
                  color: CARD_TONES.red,
                  border: `1px solid ${alpha(CARD_TONES.red, 0.36)}`,
                  fontWeight: 800,
                }}
              />
            )}
          </Stack>
          <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.5 }}>
            {formatFriendlyDate(task.fechaLimite)} · {[clienteLabel(task.cliente), casoLabel(task.caso)].filter(Boolean).join(" · ") || "Sin vinculación"}
          </Typography>
          {stats.total > 0 && (
            <LinearProgress
              variant="determinate"
              value={stats.percent}
              sx={{
                mt: 1.2,
                height: 4,
                borderRadius: 999,
                bgcolor: alpha(theme.palette.text.secondary, 0.12),
                "& .MuiLinearProgress-bar": { borderRadius: 999, bgcolor: CARD_TONES.cyan },
              }}
            />
          )}
        </Box>
        <IconButton size="small" onClick={onExpand} sx={{ mt: -0.4 }}>
          {expanded ? <ExpandLess /> : <ExpandMore />}
        </IconButton>
      </Stack>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <Box sx={{ pl: 5.3, pt: 1.4 }}>
              {task.descripcion && (
                <Typography variant="body2" sx={{ color: "text.secondary", mb: 1.2 }}>
                  {task.descripcion}
                </Typography>
              )}
              {subtasks.length > 0 && (
                <Stack spacing={0.7} sx={{ mb: 1.2 }}>
                  {subtasks.map((item) => (
                    <Stack key={item.id} direction="row" spacing={1} alignItems="center">
                      <AnimatedCheck
                        checked={Boolean(item.completada)}
                        disabled={busy}
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleSubtask(task.id, item.id);
                        }}
                      />
                      <Typography variant="caption" sx={{ color: item.completada ? "text.disabled" : "text.secondary", fontWeight: 700 }}>
                        {item.titulo}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              )}
              <Button
                size="small"
                endIcon={<OpenInNew />}
                onClick={() => navigate(`/tareas/${task.id}`)}
                sx={{ borderRadius: "10px", fontWeight: 800 }}
              >
                Ver tarea
              </Button>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  );
}

function EventRow({ event, expanded, onExpand, navigate, checked, onToggle, busy, canToggle }) {
  const fecha = eventDate(event);
  const isAudiencia = /audiencia/i.test([event.titulo, event.tipo?.nombre, event.tipoEvento?.nombre].filter(Boolean).join(" "));
  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: "14px",
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
        position: "relative",
        overflow: "hidden",
        "@keyframes pulseDot": {
          "0%": { transform: "scale(0.9)", opacity: 0.55 },
          "50%": { transform: "scale(1.35)", opacity: 1 },
          "100%": { transform: "scale(0.9)", opacity: 0.55 },
        },
      }}
    >
      <Stack direction="row" spacing={1.4} alignItems="flex-start">
        {canToggle && (
          <AnimatedCheck
            checked={checked}
            disabled={busy}
            onClick={(e) => {
              e.stopPropagation();
              onToggle(event);
            }}
          />
        )}
        <Box
          sx={{
            width: 44,
            minWidth: 44,
            borderRadius: "12px",
            py: 0.9,
            textAlign: "center",
            bgcolor: alpha(isAudiencia ? CARD_TONES.violet : CARD_TONES.blue, 0.12),
            color: isAudiencia ? CARD_TONES.violet : CARD_TONES.blue,
            border: `1px solid ${alpha(isAudiencia ? CARD_TONES.violet : CARD_TONES.blue, 0.22)}`,
          }}
        >
          <Typography sx={{ fontSize: "0.64rem", fontWeight: 800, textTransform: "uppercase", lineHeight: 1 }}>
            {fecha ? dayjs(fecha).format("MMM") : "--"}
          </Typography>
          <Typography sx={{ fontSize: "1.2rem", fontWeight: 800, lineHeight: 1.15 }}>
            {fecha ? dayjs(fecha).format("D") : "--"}
          </Typography>
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
            {isAudiencia && (
              <Box
                sx={{
                  width: 9,
                  height: 9,
                  borderRadius: "50%",
                  bgcolor: CARD_TONES.violet,
                  animation: "pulseDot 1.8s ease-in-out infinite",
                }}
              />
            )}
            <Typography
              variant="body2"
              sx={{
                fontWeight: 800,
                color: checked ? "text.secondary" : "text.primary",
                textDecoration: checked ? "line-through" : "none",
              }}
            >
              {event.titulo || event.nombre || "Evento"}
            </Typography>
            {isAudiencia && (
              <Chip
                size="small"
                icon={<Gavel sx={{ fontSize: "14px !important" }} />}
                label="Audiencia"
                sx={{
                  height: 23,
                  color: CARD_TONES.violet,
                  bgcolor: alpha(CARD_TONES.violet, 0.12),
                  border: `1px solid ${alpha(CARD_TONES.violet, 0.34)}`,
                  fontWeight: 800,
                }}
              />
            )}
          </Stack>
          <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.45 }}>
            {fecha ? `${formatFriendlyDate(fecha)} hs` : "Sin fecha"}
          </Typography>
          <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.55 }}>
            {(event.ubicacion || event.lugar) && (
              <Stack direction="row" spacing={0.45} alignItems="center">
                <LocationOn sx={{ fontSize: 14, color: "text.disabled" }} />
                <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
                  {event.ubicacion || event.lugar}
                </Typography>
              </Stack>
            )}
            {(event.caso || event.expediente) && (
              <Stack direction="row" spacing={0.45} alignItems="center">
                <Balance sx={{ fontSize: 14, color: "text.disabled" }} />
                <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
                  {casoLabel(event.caso || event.expediente)}
                </Typography>
              </Stack>
            )}
          </Stack>
        </Box>
        <IconButton size="small" onClick={onExpand} sx={{ mt: -0.4 }}>
          {expanded ? <ExpandLess /> : <ExpandMore />}
        </IconButton>
      </Stack>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <Box sx={{ pl: 7, pt: 1.2 }}>
              {event.descripcion && (
                <Typography variant="body2" sx={{ color: "text.secondary", mb: 1.2 }}>
                  {event.descripcion}
                </Typography>
              )}
              <Button
                size="small"
                endIcon={<OpenInNew />}
                onClick={() => navigate(`/eventos/${event.id}`)}
                sx={{ borderRadius: "10px", fontWeight: 800 }}
              >
                Ver evento
              </Button>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuth();
  const [expandedTask, setExpandedTask] = useState(null);
  const [expandedEvent, setExpandedEvent] = useState(null);

  const tareasQuery = useQuery({
    queryKey: ["dashboard", "tareas"],
    queryFn: async () => {
      const { data } = await api.get("/tareas", { params: { page: 1, limit: 100, completada: "false" } });
      return unwrapItems(data);
    },
    staleTime: 60_000,
  });

  const eventosQuery = useQuery({
    queryKey: ["dashboard", "eventos"],
    queryFn: async () => {
      const { data } = await api.get("/eventos", { params: { limit: 100 } });
      return unwrapItems(data);
    },
    staleTime: 60_000,
  });

  const expedientesQuery = useQuery({
    queryKey: ["dashboard", "expedientes"],
    queryFn: async () => {
      const { data } = await api.get("/expedientes", { params: { limit: 100 } });
      return unwrapItems(data);
    },
    staleTime: 60_000,
  });

  const clientesQuery = useQuery({
    queryKey: ["dashboard", "clientes"],
    queryFn: async () => {
      const { data } = await api.get("/clientes", { params: { limit: 100 } });
      return unwrapItems(data);
    },
    staleTime: 60_000,
  });

  const honorariosQuery = useQuery({
    queryKey: ["dashboard", "honorarios"],
    queryFn: async () => {
      const { data } = await api.get("/honorarios", { params: { page: 1, limit: 100 } });
      return payloadItems(data);
    },
    staleTime: 60_000,
  });

  const gastosQuery = useQuery({
    queryKey: ["dashboard", "gastos"],
    queryFn: async () => {
      const { data } = await api.get("/gastos", { params: { page: 1, limit: 100 } });
      return payloadItems(data);
    },
    staleTime: 60_000,
  });

  const planesQuery = useQuery({
    queryKey: ["dashboard", "planes"],
    queryFn: () => api.get("/planes").then((r) => r.data?.data ?? []),
    staleTime: 60_000,
  });

  const valorJusQuery = useQuery({
    queryKey: ["dashboard", "valorjus", "actual"],
    queryFn: async () => {
      const { data } = await api.get("/valorjus/actual");
      return data?.data ?? data;
    },
    staleTime: 60_000,
  });

  const catalogQuery = useQuery({
    queryKey: ["dashboard", "catalogos"],
    queryFn: async () => {
      const cats = ["MONEDA", "POLITICA_JUS", "ESTADO_GASTO", "ESTADO_EVENTO"];
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

  const isLoading = [
    tareasQuery,
    eventosQuery,
    expedientesQuery,
    clientesQuery,
    honorariosQuery,
    gastosQuery,
    planesQuery,
    valorJusQuery,
    catalogQuery,
  ].some((q) => q.isLoading);

  function invalidateDashboard() {
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["tareas"] });
    queryClient.invalidateQueries({ queryKey: ["agenda"] });
  }

  const toggleTaskMutation = useMutation({
    mutationFn: async (task) => {
      const { data } = await api.put(`/tareas/${task.id}`, {
        completada: !task.completada,
        completarSubtareas: false,
      });
      return unwrapEntity(data);
    },
    onSuccess: (_, task) => {
      enqueueSnackbar(task.completada ? "Tarea reabierta" : "Tarea completada", { variant: "success" });
      invalidateDashboard();
    },
    onError: (error) => enqueueSnackbar(getApiError(error, "No se pudo actualizar la tarea"), { variant: "error" }),
  });

  const toggleSubtaskMutation = useMutation({
    mutationFn: async ({ taskId, subtaskId }) => {
      const { data } = await api.patch(`/tareas/${taskId}/subtareas/${subtaskId}/toggle`);
      return unwrapEntity(data);
    },
    onSuccess: (_, vars) => {
      enqueueSnackbar("Subtarea actualizada", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "tareas"] });
      queryClient.invalidateQueries({ queryKey: ["tareas"] });
      queryClient.invalidateQueries({ queryKey: ["tareas", String(vars.taskId)] });
      queryClient.invalidateQueries({ queryKey: ["agenda"] });
    },
    onError: (error) => enqueueSnackbar(getApiError(error, "No se pudo actualizar la subtarea"), { variant: "error" }),
  });

  const toggleEventMutation = useMutation({
    mutationFn: async (event) => {
      const isRealizado = realizadoEstadoId != null && Number(event.estadoId) === realizadoEstadoId;
      const nextEstadoId = isRealizado ? pendienteEstadoId : realizadoEstadoId;
      const { data } = await api.put(`/eventos/${event.id}`, { estadoId: nextEstadoId });
      return unwrapEntity(data);
    },
    onSuccess: (_, event) => {
      const wasRealizado = realizadoEstadoId != null && Number(event.estadoId) === realizadoEstadoId;
      enqueueSnackbar(wasRealizado ? "Evento marcado pendiente" : "Evento marcado como realizado", { variant: "success" });
      invalidateDashboard();
      queryClient.invalidateQueries({ queryKey: ["eventos"] });
    },
    onError: (error) => enqueueSnackbar(getApiError(error, "No se pudo actualizar el evento"), { variant: "error" }),
  });

  const tareas = tareasQuery.data ?? [];
  const eventos = eventosQuery.data ?? [];
  const expedientes = expedientesQuery.data ?? [];
  const clientes = clientesQuery.data ?? [];
  const honorarios = honorariosQuery.data ?? [];
  const gastos = gastosQuery.data ?? [];
  const planes = planesQuery.data ?? [];
  const valorJusActual = Number(valorJusQuery.data?.valor ?? 0);
  const catalogMonedas = catalogQuery.data?.MONEDA ?? [];
  const catalogPoliticas = catalogQuery.data?.POLITICA_JUS ?? [];
  const catalogEstadosGasto = catalogQuery.data?.ESTADO_GASTO ?? [];
  const catalogEstadosEvento = catalogQuery.data?.ESTADO_EVENTO ?? [];

  const estadoEventoIdByCodigo = useMemo(() => {
    const map = new Map();
    catalogEstadosEvento.forEach((estado) => {
      map.set(normalizeCode(estado.codigo), Number(estado.id));
    });
    return map;
  }, [catalogEstadosEvento]);

  const realizadoEstadoId = estadoEventoIdByCodigo.get("REALIZADO") ?? null;
  const pendienteEstadoId = estadoEventoIdByCodigo.get("PENDIENTE") ?? null;

  const planesByHonorario = useMemo(() => {
    const map = new Map();
    planes.forEach((plan) => {
      const honorarioId = Number(plan.honorarioId);
      if (!honorarioId) return;
      const current = map.get(honorarioId) ?? { saldo: 0, cobrado: 0 };
      current.saldo += Number(plan.totalSaldoArs ?? 0);
      current.cobrado += Number(plan.totalCobradoArs ?? 0);
      map.set(honorarioId, current);
    });
    return map;
  }, [planes]);

  const getHonorarioSaldoPendiente = useCallback((item, computed) => {
    const planSaldo = planesByHonorario.get(Number(item.id));
    if (planSaldo) {
      return {
        value: Math.max(0, planSaldo.saldo),
        currency: "ARS",
      };
    }

    return {
      value: isHonorarioPendiente(item) ? Math.max(0, Number(computed?.updatedVal ?? 0)) : 0,
      currency: computed?.currency ?? "ARS",
    };
  }, [planesByHonorario]);

  const estadosGastoById = useMemo(() => {
    return new Map(catalogEstadosGasto.map((e) => [Number(e.id), e]));
  }, [catalogEstadosGasto]);

  const pendingTasks = useMemo(() => tareas.filter((task) => !task.completada), [tareas]);
  const activeCases = useMemo(() => expedientes.filter((caso) => !caso.fechaCierre && !caso.cerrado), [expedientes]);
  const clientesNuevosMes = useMemo(() => {
    const limit = dayjs().subtract(30, "day");
    return clientes.filter((cliente) => {
      const created = cliente.createdAt || cliente.fechaAlta || cliente.created_at;
      return created && dayjs(created).isAfter(limit);
    }).length;
  }, [clientes]);

  const pendingHonorarios = useMemo(() => {
    return honorarios.reduce((acc, honorario) => {
      const computed = computeHonorarioAmounts(honorario, valorJusActual, catalogMonedas, catalogPoliticas);
      const saldo = getHonorarioSaldoPendiente(honorario, computed);
      return acc + Number(saldo.value ?? 0);
    }, 0);
  }, [honorarios, valorJusActual, catalogMonedas, catalogPoliticas, getHonorarioSaldoPendiente]);

  const totalGastos = useMemo(() => {
    return gastos.reduce((acc, gasto) => {
      const estado = estadosGastoById.get(Number(gasto.estadoId));
      if (String(estado?.codigo ?? "").toUpperCase() === "PAGADO") return acc;
      return acc + movementAmountPesos(gasto, "gasto", valorJusActual, catalogMonedas);
    }, 0);
  }, [gastos, estadosGastoById, valorJusActual, catalogMonedas]);

  const upcomingEvents = useMemo(() => {
    const now = Date.now();
    return eventos
      .filter((event) => {
        const time = new Date(eventDate(event)).getTime();
        if (Number.isNaN(time)) return false;
        // Futuros: siempre. Vencidos: solo si todavía no están realizados (quedan por cerrar).
        if (time >= now) return true;
        const isRealizado = realizadoEstadoId != null && Number(event.estadoId) === realizadoEstadoId;
        return !isRealizado;
      })
      .sort((a, b) => new Date(eventDate(a)).getTime() - new Date(eventDate(b)).getTime())
      .slice(0, 6);
  }, [eventos, realizadoEstadoId]);

  const kpis = [
    {
      title: "Casos activos",
      value: activeCases.length,
      caption: `${expedientes.length} expedientes cargados`,
      Icon: FolderSpecial,
      tone: CARD_TONES.blue,
      progress: expedientes.length ? (activeCases.length / expedientes.length) * 100 : 0,
    },
    {
      title: "Clientes nuevos",
      value: clientesNuevosMes,
      caption: "últimos 30 días",
      Icon: PersonAdd,
      tone: CARD_TONES.orange,
      progress: clientes.length ? (clientesNuevosMes / clientes.length) * 100 : 0,
    },
    {
      title: "Honorarios",
      value: moneyCompact(pendingHonorarios),
      caption: "pendientes de cobro",
      Icon: Payments,
      tone: CARD_TONES.green,
      progress: pendingHonorarios > 0 ? 72 : 0,
    },
    {
      title: "Gastos",
      value: moneyCompact(totalGastos),
      caption: "registrados para recuperar",
      Icon: ReceiptLong,
      tone: CARD_TONES.red,
      progress: totalGastos > 0 ? 48 : 0,
    },
  ];

  const firstName = readUserName(user);
  const refreshDashboard = () => invalidateDashboard();

  return (
    <Box
      sx={{
        position: "relative",
        pb: 4,
      }}
    >
      <Stack
        component={motion.div}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", md: "center" }}
        sx={{ mb: 3.5, position: "relative" }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.6 }}>
            {firstName ? `¡Hola de nuevo, ${firstName}!` : "¡Hola de nuevo!"}
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", fontWeight: 700 }}>
            {displayDate()}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<Refresh className="refresh-icon" />}
          onClick={refreshDashboard}
          sx={{
            borderRadius: "12px",
            fontWeight: 800,
            alignSelf: { xs: "stretch", md: "center" },
            "& .refresh-icon": { transition: "transform 0.45s ease" },
            "&:hover .refresh-icon": { transform: "rotate(180deg)" },
          }}
        >
          Refrescar
        </Button>
      </Stack>

      <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
        {kpis.map((kpi, index) => (
          <Grid key={kpi.title} size={{ xs: 12, sm: 6, md: 3 }}>
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: index * 0.05 }}
              style={{ height: "100%" }}
            >
              <KpiCard {...kpi} loading={isLoading} />
            </motion.div>
          </Grid>
        ))}
      </Grid>

      {/* ===== ACCIONES RÁPIDAS (ATAJOS DE CREACIÓN) ===== */}
      <Paper elevation={0} sx={{ ...panelSx, p: 2, mb: 2.5 }}>
        <Stack direction={{ xs: "column", lg: "row" }} spacing={2.5} alignItems={{ xs: "flex-start", lg: "center" }} justifyContent="space-between">
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
              Acciones Rápidas
            </Typography>
            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
              Crea nuevos registros directamente en la plataforma
            </Typography>
          </Box>
          <Box sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(3, 1fr)", lg: "repeat(6, 1fr)" },
            gap: 1.5,
            width: { xs: "100%", lg: "auto" },
          }}>
            {[
              { label: "Nuevo Expte.", path: "/expedientes/nuevo", icon: <FolderSpecial />, tone: CARD_TONES.blue },
              { label: "Nuevo Cliente", path: "/clientes/nuevo", icon: <PersonAdd />, tone: CARD_TONES.orange },
              { label: "Nuevo Evento", path: "/eventos/nuevo", icon: <CalendarMonth />, tone: CARD_TONES.violet },
              { label: "Nueva Tarea", path: "/tareas/nuevo", icon: <AssignmentTurnedIn />, tone: CARD_TONES.cyan },
              { label: "Cargar Finanza", path: "/finanzas/nuevo", icon: <Payments />, tone: CARD_TONES.green }
            ].map((action) => (
              <Button
                key={action.label}
                variant="outlined"
                component={motion.button}
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.97 }}
                startIcon={action.icon}
                onClick={() => navigate(action.path)}
                sx={{
                  borderRadius: "12px",
                  fontWeight: 800,
                  fontSize: "0.82rem",
                  px: 1.8,
                  py: 0.85,
                  width: "100%",
                  justifyContent: "flex-start",
                  borderColor: alpha(action.tone, 0.35),
                  color: action.tone,
                  bgcolor: alpha(action.tone, 0.04),
                  "&:hover": {
                    borderColor: action.tone,
                    bgcolor: alpha(action.tone, 0.08),
                  }
                }}
              >
                {action.label}
              </Button>
            ))}
            <SisfeSyncButton
              sx={{
                fontSize: "0.82rem",
                px: 1.8,
                py: 0.85,
                borderRadius: "12px",
                justifyContent: "flex-start",
                borderColor: alpha(CARD_TONES.cyan, 0.35),
                color: CARD_TONES.cyan,
                bgcolor: alpha(CARD_TONES.cyan, 0.04),
                "&:hover": {
                  borderColor: CARD_TONES.cyan,
                  bgcolor: alpha(CARD_TONES.cyan, 0.08),
                }
              }}
            />
          </Box>
        </Stack>
      </Paper>

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper elevation={0} sx={{ ...panelSx, p: 2.25 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  Tareas Pendientes
                </Typography>
                <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
                  Próximos compromisos operativos
                </Typography>
              </Box>
              <Chip label={`${pendingTasks.length} pendientes`} size="small" sx={{ fontWeight: 800, borderRadius: "999px" }} />
            </Stack>
            <Stack spacing={1.1}>
              {pendingTasks.slice(0, 7).map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  expanded={expandedTask === task.id}
                  onExpand={() => setExpandedTask((id) => (id === task.id ? null : task.id))}
                  onToggle={(target) => toggleTaskMutation.mutate(target)}
                  onToggleSubtask={(taskId, subtaskId) => toggleSubtaskMutation.mutate({ taskId, subtaskId })}
                  busy={toggleTaskMutation.isPending || toggleSubtaskMutation.isPending}
                  navigate={navigate}
                />
              ))}
              {!pendingTasks.length && (
                <Box sx={{ py: 4, textAlign: "center", color: "text.secondary" }}>
                  <AssignmentTurnedIn sx={{ mb: 1, color: "success.main" }} />
                  <Typography variant="body2" sx={{ fontWeight: 800 }}>No hay tareas pendientes.</Typography>
                </Box>
              )}
            </Stack>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper elevation={0} sx={{ ...panelSx, p: 2.25 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  Eventos
                </Typography>
                <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
                  Vencidos por cerrar y próximos
                </Typography>
              </Box>
              <Avatar sx={{ bgcolor: alpha(CARD_TONES.violet, 0.12), color: CARD_TONES.violet }}>
                <CalendarMonth />
              </Avatar>
            </Stack>
            <Stack spacing={1.1}>
              {upcomingEvents.map((event) => {
                const eventoPaso = new Date(eventDate(event)).getTime() < Date.now();
                return (
                <EventRow
                  key={event.id}
                  event={event}
                  expanded={expandedEvent === event.id}
                  onExpand={() => setExpandedEvent((id) => (id === event.id ? null : event.id))}
                  navigate={navigate}
                  canToggle={realizadoEstadoId != null && eventoPaso}
                  checked={realizadoEstadoId != null && Number(event.estadoId) === realizadoEstadoId}
                  onToggle={(target) => toggleEventMutation.mutate(target)}
                  busy={toggleEventMutation.isPending}
                />
                );
              })}
              {!upcomingEvents.length && (
                <Box sx={{ py: 4, textAlign: "center", color: "text.secondary" }}>
                  <Gavel sx={{ mb: 1, color: "primary.main" }} />
                  <Typography variant="body2" sx={{ fontWeight: 800 }}>No hay eventos pendientes.</Typography>
                </Box>
              )}
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

