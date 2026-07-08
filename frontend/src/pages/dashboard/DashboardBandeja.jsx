import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale/es";
import { alpha, lighten, useTheme } from "@mui/material/styles";
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import {
  Add,
  AssignmentTurnedIn,
  CalendarMonth,
  Check,
  Event as EventIcon,
  ExpandMore,
  Gavel,
  NightsStay,
  Payments,
  PersonAdd,
  Sync,
  WarningAmber,
  WbSunny,
  WbTwilight,
} from "@mui/icons-material";
import AgendarDialog from "../../components/AgendarDialog";
import TareaDetalleDialog from "../../components/TareaDetalleDialog";
import EventoDetalleDialog from "../../components/EventoDetalleDialog";
import SisfeSyncButton from "../../components/SisfeSyncButton";
import { useAuth } from "../../auth/useAuth";
import { clienteLabel, formatFriendlyDate } from "../tareasUtils";
import { bandejaFilterCounts, buildBandejaGroups } from "./bandejaGrouping";
import { BANDEJA_TONES, bandejaGreeting, displayDate, eventDate, tipoMovimientoInfo } from "./dashboardUtils";
import { useDashboardData } from "./useDashboardData";
import { useNovedadesData } from "./useNovedadesData";

const GREETING_ICON = {
  morning: { Icon: WbSunny, color: "#F5A623" },
  afternoon: { Icon: WbTwilight, color: "#E87C4C" },
  evening: { Icon: NightsStay, color: "#6B7CFA" },
};

const FILTERS = [
  { id: "todo", label: "Todo" },
  { id: "novedades", label: "Movimientos SISFE", dot: BANDEJA_TONES.novedad },
  { id: "tareas", label: "Tareas", dot: BANDEJA_TONES.tarea },
  { id: "eventos", label: "Eventos", dot: BANDEJA_TONES.evento },
];

const BANDEJA_PREVIEW_LIMIT = 5;
const BANDEJA_COLLAPSED_GROUPS_KEY = "bandeja_collapsed_groups";

const QUICK_CREATE = [
  { label: "Nuevo cliente", path: "/clientes/nuevo", icon: PersonAdd },
  { label: "Nuevo evento", path: "/eventos/nuevo", icon: CalendarMonth },
  { label: "Nueva tarea", path: "/tareas/nuevo", icon: AssignmentTurnedIn },
  { label: "Cargar finanza", path: "/finanzas/nuevo", icon: Payments },
];

function TypeBadge({ kind, overdue, label, icon, color: colorOverride }) {
  const config = {
    tarea: { label: "Tarea", bg: overdue ? alpha(BANDEJA_TONES.overdue, 0.1) : alpha(BANDEJA_TONES.novedad, 0.1), color: overdue ? BANDEJA_TONES.overdue : BANDEJA_TONES.novedad, Icon: AssignmentTurnedIn },
    novedad: { label: "Movimiento", bg: alpha(BANDEJA_TONES.novedad, 0.1), color: BANDEJA_TONES.novedad, Icon: Gavel },
    evento: { label: "Evento", bg: alpha(BANDEJA_TONES.evento, 0.1), color: BANDEJA_TONES.evento, Icon: CalendarMonth },
  }[kind];
  const color = colorOverride || config.color;
  const bg = colorOverride ? alpha(colorOverride, 0.1) : config.bg;
  const Icon = icon || config.Icon;
  const text = label || config.label;
  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.6,
        height: 22,
        px: 1.1,
        borderRadius: "6px",
        bgcolor: bg,
        color,
        fontWeight: 700,
        fontSize: "0.66rem",
        flexShrink: 0,
      }}
    >
      <Icon sx={{ fontSize: 11 }} />
      {text}
    </Box>
  );
}

function GroupHeader({ group, onMarkAll, collapsed, onToggle }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  // Colores derivados del tono del grupo, adaptados al modo: en oscuro el texto y
  // el punto se aclaran para contraste, y la línea es un tinte translúcido del tono
  // (antes eran hex claros fijos que quedaban como rayas fantasma sobre fondo oscuro).
  const labelColor = isDark ? lighten(group.tone, 0.35) : group.tone;
  const dotColor = isDark ? lighten(group.dot, 0.12) : group.dot;
  const lineColor = alpha(group.tone, isDark ? 0.32 : 0.18);
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1.1}
      flexWrap="wrap"
      useFlexGap
      onClick={onToggle}
      sx={{ mt: 2.75, mb: 1.25, rowGap: 1, cursor: "pointer", userSelect: "none" }}
    >
      <ExpandMore sx={{ fontSize: 18, color: "text.disabled", flexShrink: 0, transition: "transform 0.2s ease", transform: collapsed ? "rotate(-90deg)" : "none" }} />
      <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: dotColor, flexShrink: 0 }} />
      <Typography sx={{ fontWeight: 700, fontSize: "0.75rem", letterSpacing: "0.08em", textTransform: "uppercase", color: labelColor }}>
        {group.label}
      </Typography>
      <Typography sx={{ fontWeight: 600, fontSize: "0.75rem", color: "text.disabled" }}>
        {group.items.length}
      </Typography>
      <Box sx={{ flex: 1, minWidth: 48, height: 1, bgcolor: lineColor }} />
      {group.showMarkAll && (
        <Button
          size="small"
          onClick={(e) => { e.stopPropagation(); onMarkAll(); }}
          sx={{
            height: 26,
            px: 1.25,
            borderRadius: "7px",
            border: "1px solid",
            borderColor: "divider",
            bgcolor: "background.paper",
            color: "text.secondary",
            fontWeight: 600,
            fontSize: "0.69rem",
            whiteSpace: "nowrap",
            ml: { xs: "auto", sm: 0 },
          }}
        >
          Marcar todo leído
        </Button>
      )}
    </Stack>
  );
}

const ROW_SX = {
  px: { xs: 1.5, sm: 2 },
  py: 1.1,
  borderBottom: "1px solid",
  borderColor: "divider",
  "&:last-child": { borderBottom: "none" },
};

// Segunda línea uniforme para tareas, movimientos y eventos: FECHA - Expte: NNNNNN - Carátula: XXXX.
function metaLine({ fecha, nroExpte, caratula, extra = [] }) {
  const parts = [fecha || "Sin fecha"];
  if (nroExpte) parts.push(`Expte: ${nroExpte}`);
  if (caratula) parts.push(`Carátula: ${caratula}`);
  parts.push(...extra.filter(Boolean));
  return parts.join(" - ");
}

function BandejaActionButton({ title, onClick, disabled, children, color }) {
  return (
    <IconButton
      size="small"
      disabled={disabled}
      onClick={onClick}
      sx={{ border: "1px solid", borderColor: "divider", borderRadius: "8px", flexShrink: 0 }}
      title={title}
    >
      {children ?? <Check sx={{ fontSize: 15, color: color ?? BANDEJA_TONES.success }} />}
    </IconButton>
  );
}

function BandejaTaskRow({ task, caso, overdue, onComplete, onOpen, busy }) {
  const meta = metaLine({
    fecha: formatFriendlyDate(task.fechaLimite),
    nroExpte: caso?.nroExpte,
    caratula: caso?.caratula,
  });
  const overdueLabel = task.fechaLimite && overdue
    ? formatDistanceToNow(new Date(task.fechaLimite), { locale: es, addSuffix: true })
    : null;

  return (
    <Box
      sx={{
        ...ROW_SX,
        cursor: "pointer",
        transition: "background-color 0.15s ease",
        "&:hover": { bgcolor: "action.hover" },
      }}
      onClick={() => onOpen?.(task)}
    >
      <Stack direction="row" alignItems="center" spacing={1}>
        <TypeBadge kind="tarea" overdue={overdue} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={{
              fontWeight: 700,
              fontSize: "0.84rem",
              lineHeight: 1.3,
              color: "text.primary",
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: { xs: 2, sm: 1 },
              WebkitBoxOrient: "vertical",
            }}
          >
            {task.titulo || "Tarea sin título"}
          </Typography>
          <Typography
            sx={{
              mt: 0.2,
              fontWeight: 500,
              fontSize: "0.72rem",
              lineHeight: 1.3,
              color: "text.secondary",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: { xs: "normal", sm: "nowrap" },
            }}
          >
            {meta}
          </Typography>
        </Box>
        {overdue && overdueLabel && (
          <Stack
            direction="row"
            alignItems="center"
            spacing={0.5}
            sx={{ flexShrink: 0, color: BANDEJA_TONES.overdue, display: { xs: "none", sm: "flex" } }}
          >
            <WarningAmber sx={{ fontSize: 12 }} />
            <Typography sx={{ fontWeight: 700, fontSize: "0.69rem", whiteSpace: "nowrap" }}>
              {overdueLabel}
            </Typography>
          </Stack>
        )}
        <Box onClick={(e) => e.stopPropagation()}>
          <BandejaActionButton
            title="Completar"
            disabled={busy}
            onClick={() => onComplete(task)}
          />
        </Box>
      </Stack>
      {overdue && overdueLabel && (
        <Stack
          direction="row"
          alignItems="center"
          spacing={0.5}
          sx={{ mt: 0.5, color: BANDEJA_TONES.overdue, display: { xs: "flex", sm: "none" } }}
        >
          <WarningAmber sx={{ fontSize: 12, flexShrink: 0 }} />
          <Typography sx={{ fontWeight: 700, fontSize: "0.69rem" }} noWrap>
            {overdueLabel}
          </Typography>
        </Stack>
      )}
    </Box>
  );
}

function BandejaNovedadRow({ novedad, onVerExpediente, onMarcarLeido, onAgendar, busy }) {
  const titulo = novedad.novedad || novedad.tipo || "Movimiento";
  const tipoInfo = tipoMovimientoInfo(novedad.tipo);
  const meta = metaLine({
    fecha: formatFriendlyDate(novedad.fecha, false),
    nroExpte: novedad.nroExpte,
    caratula: novedad.caratula,
  });

  const actions = (
    <Stack direction="row" spacing={0.75} alignItems="center" flexShrink={0}>
      <IconButton
        size="small"
        disabled={busy}
        onClick={(e) => { e.stopPropagation(); onAgendar(e, novedad); }}
        sx={{ border: "1px solid", borderColor: "divider", borderRadius: "8px" }}
        title="Agendar tarea o evento"
      >
        <CalendarMonth sx={{ fontSize: 15 }} />
      </IconButton>
      <IconButton
        size="small"
        disabled={busy}
        onClick={(e) => { e.stopPropagation(); onMarcarLeido(novedad); }}
        sx={{ border: "1px solid", borderColor: "divider", borderRadius: "8px" }}
        title="Marcar leído"
      >
        <Check sx={{ fontSize: 15 }} />
      </IconButton>
    </Stack>
  );

  return (
    <Box
      sx={{
        ...ROW_SX,
        cursor: "pointer",
        transition: "background-color 0.15s ease",
        "&:hover": { bgcolor: "action.hover" },
      }}
      onClick={() => onVerExpediente(novedad)}
    >
      <Stack direction="row" alignItems="center" spacing={1}>
        <Box sx={{ width: 9, height: 9, borderRadius: "50%", bgcolor: tipoInfo.color, flexShrink: 0 }} />
        <TypeBadge kind="novedad" label={tipoInfo.label} icon={tipoInfo.Icon} color={tipoInfo.color} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={{
              fontWeight: 600,
              fontSize: "0.84rem",
              lineHeight: 1.3,
              color: "text.primary",
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: { xs: 3, sm: 1 },
              WebkitBoxOrient: "vertical",
            }}
          >
            {titulo}
          </Typography>
          <Typography
            sx={{
              mt: 0.2,
              fontWeight: 500,
              fontSize: "0.72rem",
              lineHeight: 1.3,
              color: "text.secondary",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: { xs: "normal", sm: "nowrap" },
            }}
          >
            {meta}
          </Typography>
        </Box>
        <Box sx={{ display: { xs: "none", md: "flex" } }}>{actions}</Box>
      </Stack>
      <Box sx={{ mt: 0.75, display: { xs: "block", md: "none" } }}>
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
          {actions}
        </Stack>
      </Box>
    </Box>
  );
}

function BandejaEventRow({ event, tipoEvento, cliente, caso, realizadoEstadoId, onToggle, busy, onOpen, overdue }) {
  const fecha = eventDate(event);
  const eventoPaso = fecha && new Date(fecha).getTime() < Date.now();
  const checked = realizadoEstadoId != null && Number(event.estadoId) === realizadoEstadoId;
  const titulo = event.descripcion || tipoEvento?.nombre || "Evento";
  const subtitle = metaLine({
    fecha: fecha ? formatFriendlyDate(fecha) : null,
    nroExpte: caso?.nroExpte,
    caratula: caso?.caratula,
    extra: [!caso && cliente ? clienteLabel(cliente) : null, event.ubicacion],
  });

  const checkbox = eventoPaso && realizadoEstadoId != null ? (
    <BandejaActionButton
      title={checked ? "Marcar pendiente" : "Marcar realizado"}
      disabled={busy}
      onClick={(e) => { e.stopPropagation(); onToggle(event); }}
      color={checked ? BANDEJA_TONES.success : undefined}
    />
  ) : null;

  return (
    <Box
      sx={{
        ...ROW_SX,
        cursor: "pointer",
        transition: "background-color 0.15s ease",
        "&:hover": { bgcolor: "action.hover" },
      }}
      onClick={() => onOpen?.(event)}
    >
      <Stack direction="row" alignItems="center" spacing={1}>
        <TypeBadge kind="evento" label={tipoEvento?.nombre} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={{
              fontWeight: 700,
              fontSize: "0.84rem",
              lineHeight: 1.3,
              color: "text.primary",
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: { xs: 2, sm: 1 },
              WebkitBoxOrient: "vertical",
            }}
          >
            {titulo}
          </Typography>
          <Typography
            sx={{
              mt: 0.2,
              fontWeight: 500,
              fontSize: "0.72rem",
              lineHeight: 1.3,
              color: "text.secondary",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: { xs: "normal", sm: "nowrap" },
            }}
          >
            {subtitle}
          </Typography>
        </Box>
        {overdue && (
          <Stack
            direction="row"
            alignItems="center"
            spacing={0.5}
            sx={{ flexShrink: 0, color: BANDEJA_TONES.overdue, display: { xs: "none", sm: "flex" } }}
          >
            <WarningAmber sx={{ fontSize: 12 }} />
            <Typography sx={{ fontWeight: 700, fontSize: "0.69rem", whiteSpace: "nowrap" }}>
              Atrasado
            </Typography>
          </Stack>
        )}
        {checkbox && (
          <Stack direction="row" spacing={0.75} alignItems="center" flexShrink={0}>
            {checkbox}
          </Stack>
        )}
      </Stack>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        spacing={1}
        sx={{ mt: 0.75, display: { xs: "flex", sm: "none" } }}
      >
        {overdue && (
          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ color: BANDEJA_TONES.overdue }}>
            <WarningAmber sx={{ fontSize: 12 }} />
            <Typography sx={{ fontWeight: 700, fontSize: "0.69rem" }}>Atrasado</Typography>
          </Stack>
        )}
        {checkbox && (
          <Stack direction="row" spacing={0.75} sx={{ ml: "auto" }}>
            {checkbox}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}

function EmptyGroup({ groupId }) {
  const config = {
    eventos: {
      Icon: Check,
      title: "Sin próximos eventos",
      subtitle: "Estás al día con la agenda. Los próximos aparecerán acá.",
      iconColor: BANDEJA_TONES.success,
    },
    tareas: {
      Icon: Check,
      title: "Sin tareas pendientes",
      subtitle: "No hay tareas por hacer. ¡Buen trabajo!",
      iconColor: BANDEJA_TONES.success,
    },
    novedades: {
      Icon: Check,
      title: "Sin movimientos SISFE sin leer",
      subtitle: "Todos los movimientos judiciales están al día.",
      iconColor: BANDEJA_TONES.success,
    },
  }[groupId];

  if (!config) return null;
  const { Icon, title, subtitle, iconColor } = config;

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        borderRadius: "13px",
        border: "1px solid",
        borderColor: "divider",
        display: "flex",
        alignItems: "center",
        gap: 1.75,
      }}
    >
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: "11px",
          bgcolor: "action.hover",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        <Icon sx={{ fontSize: 20, color: iconColor }} />
      </Box>
      <Box>
        <Typography sx={{ fontWeight: 600, fontSize: "0.875rem" }}>{title}</Typography>
        <Typography sx={{ mt: 0.25, fontWeight: 500, fontSize: "0.75rem", color: "text.secondary" }}>
          {subtitle}
        </Typography>
      </Box>
    </Paper>
  );
}

function GroupShowMore({ hiddenCount, expanded, onToggle }) {
  return (
    <Button
      fullWidth
      onClick={onToggle}
      sx={{
        py: 0.85,
        borderRadius: 0,
        borderTop: "1px solid",
        borderColor: "divider",
        color: "text.secondary",
        fontWeight: 600,
        fontSize: "0.75rem",
        textTransform: "none",
        "&:hover": { bgcolor: "action.hover" },
      }}
    >
      {expanded ? "Ver menos" : `Ver más (${hiddenCount})`}
    </Button>
  );
}

function SisfeBanner({ lastSyncAt, frescura }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  if (!frescura.stale) return null;

  const syncText = lastSyncAt
    ? `Última sincronización con SISFE ${formatDistanceToNow(new Date(lastSyncAt), { locale: es, addSuffix: true })}.`
    : "Todavía no sincronizaste con SISFE.";

  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      alignItems={{ xs: "flex-start", sm: "center" }}
      spacing={1.5}
      sx={{
        mt: 2,
        p: "11px 16px",
        borderRadius: "11px",
        bgcolor: isDark ? alpha(theme.palette.warning.main, 0.1) : "#FBF6E7",
        border: "1px solid",
        borderColor: isDark ? alpha(theme.palette.warning.main, 0.28) : "#F0E4C3",
      }}
    >
      <Box
        sx={{
          width: 30,
          height: 30,
          borderRadius: "8px",
          bgcolor: isDark ? alpha(theme.palette.warning.main, 0.18) : "#F6EBCB",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        <Sync sx={{ fontSize: 16, color: isDark ? theme.palette.warning.light : "#B5820A" }} />
      </Box>
      <Typography
        sx={{
          flex: 1,
          fontWeight: 500,
          fontSize: "0.78rem",
          color: isDark ? theme.palette.text.secondary : "#7A6320",
        }}
      >
        <Box
          component="span"
          sx={{ fontWeight: 700, color: isDark ? theme.palette.warning.light : "#5E4E14" }}
        >
          {syncText}
        </Box>{" "}
        Sincronizá para traer los movimientos SISFE más recientes.
      </Typography>
      <SisfeSyncButton
        variant="contained"
        size="small"
        lastSyncAt={lastSyncAt}
        sx={{
          height: 32,
          px: 1.75,
          borderRadius: "8px",
          fontWeight: 600,
          fontSize: "0.78rem",
          whiteSpace: "nowrap",
          flexShrink: 0,
          ...(isDark
            ? {
                bgcolor: "warning.main",
                color: "warning.contrastText",
                "&:hover": { bgcolor: "warning.dark" },
              }
            : {
                bgcolor: "#B5820A",
                color: "#fff",
                "&:hover": { bgcolor: "#9A6E08" },
              }),
        }}
      >
        Sincronizar ahora
      </SisfeSyncButton>
    </Stack>
  );
}

export default function DashboardBandeja() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [filter, setFilter] = useState("todo");
  const [createAnchor, setCreateAnchor] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [menuNovedad, setMenuNovedad] = useState(null);
  const [dialog, setDialog] = useState({ open: false, modo: "tarea", novedad: null });
  const [tareaDialogId, setTareaDialogId] = useState(null);
  const [eventoDialogId, setEventoDialogId] = useState(null);
  const [collapsedGroups, setCollapsedGroups] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(BANDEJA_COLLAPSED_GROUPS_KEY)) || {};
    } catch {
      return {};
    }
  });
  const [expandedItemGroups, setExpandedItemGroups] = useState({});
  useEffect(() => {
    localStorage.setItem(BANDEJA_COLLAPSED_GROUPS_KEY, JSON.stringify(collapsedGroups));
  }, [collapsedGroups]);
  const toggleGroup = (id) => setCollapsedGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  const toggleGroupItemsExpand = (id) => setExpandedItemGroups((prev) => ({ ...prev, [id]: !prev[id] }));

  const { text: greetingText, slot: greetingSlot } = bandejaGreeting(user);
  const { Icon: GreetingIcon, color: greetingColor } = GREETING_ICON[greetingSlot];
  const {
    overdueTasks,
    upcomingTasks,
    futureEvents,
    pastPendingEvents,
    tiposEventoById,
    clientesById,
    expedientesById,
    realizadoEstadoId,
    toggleTaskMutation,
    toggleEventMutation,
    taskBusy,
    eventBusy,
  } = useDashboardData();

  const {
    novedades,
    totalNovedades,
    lastSyncAt,
    frescura,
    marcarTodo,
    marcarUno,
    isLoading: novedadesLoading,
  } = useNovedadesData();

  const eventCount = pastPendingEvents.length + futureEvents.length;
  const counts = bandejaFilterCounts({
    totalNovedades,
    overdueCount: overdueTasks.length,
    upcomingTaskCount: upcomingTasks.length,
    eventCount,
  });

  const groups = useMemo(
    () =>
      buildBandejaGroups({
        overdueTasks,
        upcomingTasks,
        novedades,
        pastPendingEvents,
        futureEvents,
        filter,
      }),
    [overdueTasks, upcomingTasks, novedades, pastPendingEvents, futureEvents, filter],
  );

  const overdueCount = overdueTasks.length + pastPendingEvents.length;

  const allClear =
    overdueCount === 0 &&
    totalNovedades === 0 &&
    upcomingTasks.length === 0 &&
    futureEvents.length === 0;

  const urgencyText = useMemo(() => {
    if (overdueCount > 0) {
      return (
        <>
          <Box component="span" sx={{ color: BANDEJA_TONES.overdue, fontWeight: 600 }}>
            {overdueCount} {overdueCount === 1 ? "atrasado" : "atrasados"}
          </Box>{" "}
          requieren tu atención.
        </>
      );
    }
    if (totalNovedades > 0) {
      return `${totalNovedades} ${totalNovedades === 1 ? "movimiento SISFE sin leer" : "movimientos SISFE sin leer"}.`;
    }
    if (allClear) return "Estás al día. No hay pendientes urgentes.";
    return "Revisá tu bandeja del día.";
  }, [overdueCount, totalNovedades, allClear]);

  const irAlExpediente = (novedad) => {
    marcarUno.mutate(novedad.id);
    navigate(`/expedientes/${novedad.casoId}`);
  };

  const abrirMenuAgendar = (e, novedad) => {
    e.stopPropagation();
    setMenuAnchor(e.currentTarget);
    setMenuNovedad(novedad);
  };

  const elegirModo = (modo) => {
    setDialog({ open: true, modo, novedad: menuNovedad });
    setMenuAnchor(null);
    setMenuNovedad(null);
  };

  const renderBandejaItem = (item) => {
    if (item.kind === "tarea") {
      return (
        <BandejaTaskRow
          key={`tarea-${item.data.id}`}
          task={item.data}
          caso={expedientesById.get(Number(item.data.casoId))}
          overdue={item.subkind === "atrasada"}
          onComplete={(t) => toggleTaskMutation.mutate(t)}
          onOpen={(t) => setTareaDialogId(t.id)}
          busy={taskBusy}
        />
      );
    }
    if (item.kind === "novedad") {
      return (
        <BandejaNovedadRow
          key={`novedad-${item.data.id}`}
          novedad={item.data}
          onVerExpediente={irAlExpediente}
          onMarcarLeido={(n) => marcarUno.mutate(n.id)}
          onAgendar={abrirMenuAgendar}
          busy={marcarUno.isPending}
        />
      );
    }
    return (
      <BandejaEventRow
        key={`evento-${item.data.id}`}
        event={item.data}
        tipoEvento={tiposEventoById.get(Number(item.data.tipoId))}
        cliente={clientesById.get(Number(item.data.clienteId))}
        caso={expedientesById.get(Number(item.data.casoId))}
        realizadoEstadoId={realizadoEstadoId}
        onToggle={(e) => toggleEventMutation.mutate(e)}
        busy={eventBusy}
        onOpen={(e) => setEventoDialogId(e.id)}
        overdue={item.subkind === "atrasado"}
      />
    );
  };

  const renderGroupItems = (group) => {
    if (group.id === "eventos" && group.items.length === 0) {
      return <EmptyGroup groupId="eventos" />;
    }

    const expanded = Boolean(expandedItemGroups[group.id]);
    const hasMore = group.items.length > BANDEJA_PREVIEW_LIMIT;
    const visibleItems = expanded ? group.items : group.items.slice(0, BANDEJA_PREVIEW_LIMIT);
    const hiddenCount = group.items.length - BANDEJA_PREVIEW_LIMIT;

    return (
      <Paper
        elevation={0}
        sx={{
          borderRadius: "13px",
          border: "1px solid",
          borderColor: "divider",
          overflow: "hidden",
        }}
      >
        {visibleItems.map(renderBandejaItem)}
        {hasMore && (
          <GroupShowMore
            hiddenCount={hiddenCount}
            expanded={expanded}
            onToggle={() => toggleGroupItemsExpand(group.id)}
          />
        )}
      </Paper>
    );
  };

  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      sx={{ pb: 4, width: "100%" }}
    >
      <Stack
        direction="row"
        alignItems="flex-start"
        justifyContent="space-between"
        spacing={1.5}
        sx={{ mb: 1.5 }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" alignItems="center" spacing={1.25} sx={{ minWidth: 0 }}>
            <GreetingIcon sx={{ fontSize: { xs: 26, sm: 30 }, color: greetingColor, flexShrink: 0 }} />
            <Typography
              variant="h5"
              sx={{
                fontWeight: 800,
                letterSpacing: "-0.02em",
                lineHeight: 1.2,
              }}
            >
              {greetingText}
            </Typography>
          </Stack>
          <Typography
            sx={{
              mt: 0.4,
              fontWeight: 500,
              fontSize: "0.8125rem",
              color: "text.secondary",
              lineHeight: 1.45,
            }}
          >
            {displayDate()} — {urgencyText}
          </Typography>
        </Box>
      </Stack>

      <SisfeBanner lastSyncAt={lastSyncAt} frescura={frescura} />

      <Stack
        direction={{ xs: "column", md: "row" }}
        alignItems={{ xs: "stretch", md: "center" }}
        spacing={1.5}
        sx={{ mt: 2.75, gap: 1.5 }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.4,
            p: 0.4,
            borderRadius: "11px",
            bgcolor: "action.hover",
            border: "1px solid",
            borderColor: "divider",
            overflowX: "auto",
            flex: 1,
          }}
        >
          {FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <Button
                key={f.id}
                onClick={() => setFilter(f.id)}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.9,
                  height: 32,
                  px: 1.9,
                  borderRadius: "8px",
                  minWidth: "auto",
                  whiteSpace: "nowrap",
                  fontWeight: 600,
                  fontSize: "0.8125rem",
                  color: active ? "primary.main" : "text.secondary",
                  bgcolor: active ? "background.paper" : "transparent",
                  boxShadow: active ? "0 1px 2px rgba(12,16,21,.10)" : "none",
                }}
              >
                {f.dot && (
                  <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: f.dot, flexShrink: 0 }} />
                )}
                {f.label}
                <Box component="span" sx={{ color: "text.disabled", fontWeight: active ? 600 : 500 }}>
                  {counts[f.id]}
                </Box>
              </Button>
            );
          })}
        </Box>

        <Box
          sx={{
            display: "inline-flex",
            width: { xs: "100%", md: "auto" },
            flexShrink: 0,
            borderRadius: "9px",
            overflow: "hidden",
            bgcolor: "primary.main",
            boxShadow: (t) => t.shadows[2],
          }}
        >
          <Button
            variant="contained"
            startIcon={<Add sx={{ fontSize: 15 }} />}
            onClick={() => navigate("/expedientes/nuevo")}
            sx={{
              flex: { xs: 1, md: "none" },
              height: 36,
              px: 1.9,
              borderRadius: 0,
              fontWeight: 600,
              fontSize: "0.8125rem",
              whiteSpace: "nowrap",
              boxShadow: "none",
              "&:hover": { boxShadow: "none", bgcolor: "primary.dark" },
            }}
          >
            Nuevo expediente
          </Button>
          <IconButton
            onClick={(e) => setCreateAnchor(e.currentTarget)}
            sx={{
              width: 36,
              height: 36,
              borderRadius: 0,
              bgcolor: "primary.main",
              color: "primary.contrastText",
              borderLeft: "1px solid rgba(255,255,255,.25)",
              flexShrink: 0,
              boxShadow: "none",
              "&:hover": { bgcolor: "primary.dark", boxShadow: "none" },
            }}
            title="Crear cliente, evento, tarea o finanza"
          >
            <ExpandMore sx={{ fontSize: 15 }} />
          </IconButton>
        </Box>
      </Stack>

      {novedadesLoading && filter !== "tareas" && filter !== "eventos" ? (
        <Box sx={{ py: 6, display: "flex", justifyContent: "center" }}>
          <CircularProgress size={28} />
        </Box>
      ) : allClear && filter === "todo" ? (
        <Paper
          elevation={0}
          sx={{
            mt: 3,
            p: 3,
            borderRadius: "13px",
            border: "1px solid",
            borderColor: "divider",
            textAlign: "center",
          }}
        >
          <Check sx={{ fontSize: 36, color: BANDEJA_TONES.success, mb: 1 }} />
          <Typography sx={{ fontWeight: 700, fontSize: "1rem" }}>Estás al día</Typography>
          <Typography sx={{ mt: 0.5, color: "text.secondary", fontSize: "0.875rem" }}>
            No hay tareas atrasadas, movimientos SISFE sin leer ni eventos pendientes.
          </Typography>
        </Paper>
      ) : (
        groups.map((group) => (
          <Box key={group.id}>
            <GroupHeader
              group={group}
              onMarkAll={() => marcarTodo.mutate()}
              collapsed={Boolean(collapsedGroups[group.id])}
              onToggle={() => toggleGroup(group.id)}
            />
            {!collapsedGroups[group.id] && renderGroupItems(group)}
          </Box>
        ))
      )}

      {!allClear && filter !== "todo" && groups.length === 0 && (
        <Box sx={{ mt: 3 }}>
          <EmptyGroup groupId={filter === "novedades" ? "novedades" : filter === "tareas" ? "tareas" : "eventos"} />
        </Box>
      )}

      <Menu anchorEl={createAnchor} open={Boolean(createAnchor)} onClose={() => setCreateAnchor(null)}>
        {QUICK_CREATE.map((item) => {
          const ItemIcon = item.icon;
          return (
            <MenuItem
              key={item.path}
              onClick={() => {
                setCreateAnchor(null);
                navigate(item.path);
              }}
            >
              <ListItemIcon><ItemIcon fontSize="small" /></ListItemIcon>
              <ListItemText>{item.label}</ListItemText>
            </MenuItem>
          );
        })}
      </Menu>

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
        <MenuItem onClick={() => elegirModo("tarea")}>
          <ListItemIcon><AssignmentTurnedIn fontSize="small" /></ListItemIcon>
          <ListItemText>Crear tarea</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => elegirModo("evento")}>
          <ListItemIcon><EventIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Crear evento</ListItemText>
        </MenuItem>
      </Menu>

      <AgendarDialog
        open={dialog.open}
        modo={dialog.modo}
        novedad={dialog.novedad}
        onClose={() => setDialog((d) => ({ ...d, open: false }))}
        onCreated={(novedad) => {
          if (novedad?.id) marcarUno.mutate(novedad.id);
        }}
      />

      <TareaDetalleDialog
        open={tareaDialogId != null}
        taskId={tareaDialogId}
        onClose={() => setTareaDialogId(null)}
      />

      <EventoDetalleDialog
        open={eventoDialogId != null}
        eventoId={eventoDialogId}
        onClose={() => setEventoDialogId(null)}
      />
    </Box>
  );
}
