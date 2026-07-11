import { useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { usePermisos } from "../auth/usePermissions";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import {
  format,
  parse,
  startOfWeek,
  getDay,
  startOfMonth,
  endOfMonth,
  endOfWeek,
  startOfDay,
  endOfDay,
  addDays,
  addMinutes,
} from "date-fns";
import { es } from "date-fns/locale/es";
import api from "../api/axios";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  Switch,
  FormControlLabel,
  Tooltip,
  IconButton,
  Button,
  ButtonGroup,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  Chip,
  Divider,
  CircularProgress,
  Paper,
  Grid,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import {
  CalendarMonth as CalendarIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Today as TodayIcon,
  FolderOpen as FolderIcon,
  CheckCircle as CheckIcon,
  CheckCircleOutline as PendingIcon,
  Event as EventIcon,
  Assignment as TaskIcon,
  Close as CloseIcon,
  AccessTime as TimeIcon,
  Description as DescriptionIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  WarningAmber as WarningIcon,
} from "@mui/icons-material";
import { useListState } from "../hooks/useListState";

import "react-big-calendar/lib/css/react-big-calendar.css";

// Configuración de Localización en Español para el Calendario
const locales = {
  es: es,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date) => startOfWeek(date, { weekStartsOn: 1 }),
  getDay,
  locales,
});

// Función auxiliar para calcular el rango de fechas basado en la vista del calendario
function getCalendarRange(view, currentDate) {
  const d = currentDate;
  switch (view) {
    case "month": {
      // Cargamos un buffer extra antes y después del mes para cubrir los slots de la cuadrícula
      const from = startOfWeek(startOfMonth(d), { weekStartsOn: 1 });
      const to = endOfWeek(endOfMonth(d), { weekStartsOn: 1 });
      return { from, to };
    }
    case "week": {
      const from = startOfWeek(d, { weekStartsOn: 1 });
      const to = endOfWeek(d, { weekStartsOn: 1 });
      return { from, to };
    }
    case "day":
      return { from: startOfDay(d), to: endOfDay(d) };
    case "agenda": {
      const from = startOfDay(d);
      const to = addDays(from, 30);
      return { from, to };
    }
    default: {
      const from = startOfWeek(d, { weekStartsOn: 1 });
      const to = endOfWeek(d, { weekStartsOn: 1 });
      return { from, to };
    }
  }
}

// Formateo de fecha legible para el Drawer
function formatDetailDate(dateStr) {
  if (!dateStr) return "Sin fecha";
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(dateStr));
}

// Formateo de hora legible
function formatTime(dateStr) {
  if (!dateStr) return "";
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateStr));
}

export default function Agenda() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { canCrear: canCrearEventos, canEditar: canEditarEventos, canEliminar: canEliminarEventos } = usePermisos("EVENTOS");
  const { canCrear: canCrearTareas, canEditar: canEditarTareas, canEliminar: canEliminarTareas } = usePermisos("TAREAS");

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  // Estados locales para la navegación del Calendario
  const [list, setList] = useListState(
    {
      view: localStorage.getItem("calView") || "month",
      showEventos: true,
      showTareas: true,
    },
    { debounceKeys: [] },
  );
  const { view, showEventos, showTareas } = list;
  const setView = (view) => setList({ view });
  const setShowEventos = (showEventos) => setList({ showEventos });
  const setShowTareas = (showTareas) => setList({ showTareas });
  const [date, setDate] = useState(new Date());

  const handleViewChange = (newView) => {
    setView(newView);
    if (!isMobile) {
      localStorage.setItem("calView", newView);
    }
  };

  const currentView = isMobile ? "agenda" : view;

  // Estados del Drawer (panel lateral de detalles)
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [newSlot, setNewSlot] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Rango en Date local del navegador → ISO 8601 UTC para el backend (timestamptz).
  const { from, to } = useMemo(() => {
    const range = getCalendarRange(currentView, date);
    return {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
    };
  }, [currentView, date]);

  // Consulta de Agenda unificada al backend
  const agendaQuery = useQuery({
    queryKey: ["agenda", { from, to }],
    queryFn: async () => {
      const { data } = await api.get("/agenda", {
        params: { from, to },
      });
      return data?.data ?? [];
    },
    staleTime: 1000 * 60 * 3, // Cache por 3 minutos
  });

  // Mapear y filtrar los elementos para react-big-calendar
  const calendarEvents = useMemo(() => {
    const rawEvents = agendaQuery.data ?? [];

    return rawEvents
      .filter((item) => {
        if (item.tipo === "EVENTO" && !showEventos) return false;
        if (item.tipo === "TAREA" && !showTareas) return false;
        return true;
      })
      .map((item) => {
        const startDate = new Date(item.fecha);
        let endDate = item.fechaFin ? new Date(item.fechaFin) : null;

        if (!endDate) {
          // Si no tiene fecha de fin, le asignamos una duración por defecto
          endDate = item.tipo === "EVENTO" 
            ? addMinutes(startDate, 30) 
            : addMinutes(startDate, 60);
        }

        return {
          id: `${item.tipo.toLowerCase()}-${item.id}`,
          title: item.titulo || (item.tipo === "EVENTO" ? "Evento agendado" : "Tarea pendiente"),
          start: startDate,
          end: endDate,
          allDay: Boolean(item.allDay),
          color: item.color,
          resource: item, // Guardamos la referencia cruda
        };
      });
  }, [agendaQuery.data, showEventos, showTareas]);

  // Cabecera dinámica (nombre del mes/año o semana seleccionada)
  const calendarHeaderTitle = useMemo(() => {
    if (currentView === "month") {
      const str = format(date, "MMMM yyyy", { locale: es });
      return str.charAt(0).toUpperCase() + str.slice(1);
    } else if (currentView === "week") {
      const start = startOfWeek(date, { weekStartsOn: 1 });
      const end = endOfWeek(date, { weekStartsOn: 1 });
      return `${format(start, "dd MMM", { locale: es })} — ${format(end, "dd MMM yyyy", { locale: es })}`;
    } else if (currentView === "agenda") {
      const start = startOfDay(date);
      const end = addDays(start, 30);
      return `${format(start, "dd MMM", { locale: es })} — ${format(end, "dd MMM yyyy", { locale: es })}`;
    } else {
      return format(date, "eeee dd 'de' MMMM yyyy", { locale: es });
    }
  }, [currentView, date]);

  // Manejo de la navegación del calendario
  const handleNavigate = (action) => {
    if (action === "TODAY") {
      setDate(new Date());
    } else if (action === "PREV") {
      if (currentView === "month") setDate(addDays(startOfMonth(date), -1));
      else if (currentView === "week") setDate(addDays(date, -7));
      else if (currentView === "agenda") setDate(addDays(date, -30));
      else setDate(addDays(date, -1));
    } else if (action === "NEXT") {
      if (currentView === "month") setDate(addDays(endOfMonth(date), 1));
      else if (currentView === "week") setDate(addDays(date, 7));
      else if (currentView === "agenda") setDate(addDays(date, 30));
      else setDate(addDays(date, 1));
    }
  };

  // Mutación para marcar tarea como completa / incompleta
  const toggleTareaMutation = useMutation({
    mutationFn: async ({ id, completada }) => {
      const { data } = await api.put(`/tareas/${id}`, {
        completada,
      });
      return data;
    },
    onSuccess: (data, variables) => {
      enqueueSnackbar(
        variables.completada ? "Tarea completada" : "Tarea marcada como pendiente",
        { variant: "success" }
      );
      queryClient.invalidateQueries({ queryKey: ["agenda"] });
      // Actualizar el item seleccionado en pantalla si corresponde
      if (selectedItem && selectedItem.id === variables.id && selectedItem.tipo === "TAREA") {
        setSelectedItem((prev) => ({
          ...prev,
          completada: variables.completada,
        }));
      }
    },
    onError: (err) => {
      const msg = err?.response?.data?.message || "No se pudo actualizar la tarea";
      enqueueSnackbar(msg, { variant: "error" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (item) => {
      const endpoint = item.tipo === "EVENTO" ? `/eventos/${item.id}` : `/tareas/${item.id}`;
      await api.delete(endpoint);
      return item;
    },
    onSuccess: (item) => {
      enqueueSnackbar(item.tipo === "EVENTO" ? "Evento eliminado" : "Tarea eliminada", { variant: "success" });
      setDeleteTarget(null);
      setDrawerOpen(false);
      setSelectedItem(null);
      queryClient.invalidateQueries({ queryKey: ["agenda"] });
      queryClient.invalidateQueries({ queryKey: [item.tipo === "EVENTO" ? "eventos" : "tareas"] });
    },
    onError: (error) => enqueueSnackbar(error?.response?.data?.error?.message ?? "No se pudo eliminar", { variant: "error" }),
  });

  // Estilos de sobreescritura de react-big-calendar para unificarlo al diseño de Iuris
  const calendarStyles = {
    position: "relative",
    width: "100%",
    "@media (max-width: 600px)": {
      ".rbc-calendar": {
        fontSize: "0.75rem",
      },
      ".rbc-agenda-view table tbody tr td": {
        minHeight: "44px",
        padding: "10px 8px",
      },
      ".rbc-month-view .rbc-event-content": {
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      },
    },
    ".rbc-calendar": {
      fontFamily: "inherit",
      border: "none",
      height: "calc(100vh - 290px)",
      minHeight: "550px",
    },
    ".rbc-header": {
      padding: "12px 6px",
      fontWeight: 800,
      fontSize: "0.78rem",
      textTransform: "uppercase",
      color: "text.secondary",
      borderBottom: "1px solid",
      borderColor: "divider",
      textAlign: "center",
      bgcolor: "action.hover",
    },
    ".rbc-month-view": {
      borderRadius: "16px",
      border: "1px solid",
      borderColor: "divider",
      overflow: "hidden",
      bgcolor: "background.paper",
      boxShadow: (theme) =>
        theme.palette.mode === "dark"
          ? "0 4px 20px rgba(0,0,0,0.3)"
          : "0 4px 14px rgba(15,23,42,0.04)",
    },
    ".rbc-day-bg": {
      transition: "background-color 0.12s ease",
      "&:hover": {
        bgcolor: "action.hover",
      },
    },
    ".rbc-today": {
      bgcolor: (t) =>
        t.palette.mode === "dark"
          ? "rgba(99, 102, 241, 0.10) !important"
          : "rgba(99, 102, 241, 0.04) !important",
    },
    ".rbc-month-row": {
      borderBottom: "1px solid",
      borderColor: "divider",
      "&:last-child": {
        borderBottom: "none",
      },
    },
    ".rbc-day-bg + .rbc-day-bg": {
      borderLeft: "1px solid",
      borderColor: "divider",
    },
    ".rbc-month-row + .rbc-month-row": {
      borderTop: "none",
    },
    ".rbc-date-cell": {
      padding: "8px 10px",
      fontSize: "0.82rem",
      fontWeight: 800,
      textAlign: "right",
      color: "text.primary",
      "&.rbc-now": {
        "& a": {
          bgcolor: "primary.main",
          color: "primary.contrastText",
          borderRadius: "6px",
          padding: "2px 6px",
          display: "inline-block",
        },
      },
    },
    ".rbc-event": {
      borderRadius: "8px",
      border: "none",
      padding: "4px 8px",
      outline: "none",
      boxShadow: "none",
      transition: "transform 0.15s ease, box-shadow 0.15s ease",
      display: "flex",
      alignItems: "center",
      "&:hover": {
        transform: "translateY(-1px)",
        boxShadow: "0 4px 10px rgba(0,0,0,0.15)",
      },
    },
    ".rbc-show-more": {
      fontSize: "0.72rem",
      fontWeight: 800,
      color: "primary.light",
      bgcolor: "transparent",
      paddingLeft: "8px",
      "&:hover": {
        textDecoration: "underline",
      },
    },
    ".rbc-toolbar": {
      display: "none !important", // Ocultamos el nativo
    },
    ".rbc-time-view": {
      borderRadius: "16px",
      border: "1px solid",
      borderColor: "divider",
      overflow: "hidden",
      bgcolor: "background.paper",
      boxShadow: (theme) =>
        theme.palette.mode === "dark"
          ? "0 4px 20px rgba(0,0,0,0.3)"
          : "0 4px 14px rgba(15,23,42,0.04)",
    },
    ".rbc-time-header": {
      bgcolor: "action.hover",
    },
    ".rbc-time-header-content": {
      borderLeft: "1px solid",
      borderColor: "divider",
    },
    ".rbc-time-content": {
      borderTop: "1px solid",
      borderColor: "divider",
    },
    ".rbc-timeslot-group": {
      borderBottom: "1px solid",
      borderColor: "divider",
      minHeight: "44px",
    },
    ".rbc-time-slot": {
      borderTop: "1px solid",
      borderColor: "divider",
      fontSize: "0.75rem",
      color: "text.secondary",
    },
    ".rbc-day-slot": {
      borderLeft: "1px solid",
      borderColor: "divider",
    },
    ".rbc-allday-cell": {
      display: "none !important", // Eliminamos celda allday para simplificar
    },
  };

  // Función al hacer clic en un evento del calendario
  const handleSelectEvent = (event) => {
    setSelectedItem(event.resource);
    setDrawerOpen(true);
  };

  const handleSelectSlot = (slotInfo) => {
    const start = slotInfo?.start instanceof Date ? slotInfo.start : new Date();
    setNewSlot(start);
  };

  // Formateador visual para los eventos individuales en el calendario
  const eventPropGetter = (event) => {
    const isTarea = event.resource.tipo === "TAREA";
    const isCompletada = Boolean(event.resource.completada);

    let bg = "rgba(29, 78, 216, 0.12)"; // Azul por defecto para Evento
    let color = "#3B82F6";
    let border = "1px solid rgba(29, 78, 216, 0.35)";

    if (isTarea) {
      if (isCompletada) {
        bg = "rgba(16, 185, 129, 0.08)"; // Esmeralda suave
        color = "#34D399";
        border = "1px solid rgba(16, 185, 129, 0.25)";
      } else {
        // Tarea pendiente
        bg = "rgba(245, 158, 11, 0.10)"; // Ámbar suave
        color = "#FBBF24";
        border = "1px solid rgba(245, 158, 11, 0.30)";
      }
    }

    return {
      style: {
        backgroundColor: bg,
        color: color,
        border: border,
        fontSize: "0.75rem",
        fontWeight: 700,
        borderRadius: "6px",
      },
    };
  };

  // Renderizador personalizado del contenido del evento
  const customEventRenderer = ({ event }) => {
    const isTarea = event.resource.tipo === "TAREA";
    const isCompletada = Boolean(event.resource.completada);
    const Icon = isTarea ? (isCompletada ? CheckIcon : PendingIcon) : EventIcon;

    return (
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ overflow: "hidden", width: "100%" }}>
        <Icon sx={{ fontSize: 13, flexShrink: 0 }} />
        <Typography variant="caption" noWrap sx={{ fontWeight: 700, fontSize: "0.74rem", flexGrow: 1 }}>
          {event.title}
        </Typography>
      </Stack>
    );
  };

  return (
    <Box sx={{ width: "100%" }}>
      {/* ── Cabecera de Página ── */}
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", md: "center" }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: "-0.04em", mb: 0.5 }}>
            Agenda
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", display: { xs: "none", md: "block" } }}>
            Revisión unificada de plazos procesales, tareas y eventos para todo tu estudio.
          </Typography>
        </Box>

        {/* Botones de creación (arriba a la derecha, como en el resto de los módulos) */}
        {(canCrearEventos || canCrearTareas) && (
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            alignItems="center"
            justifyContent="center"
            sx={{ width: { xs: "100%", md: "auto" } }}
          >
            {canCrearEventos && (
              <Button
                variant="contained"
                size="medium"
                startIcon={<AddIcon />}
                onClick={() => navigate("/eventos/nuevo?from=agenda", { state: { from: location.pathname + location.search } })}
                sx={{
                  fontWeight: 800,
                  borderRadius: "8px",
                  textTransform: "none",
                  width: { xs: "100%", sm: "auto" },
                  py: { xs: 1, sm: 0.75 },
                }}
              >
                Nuevo Evento
              </Button>
            )}
            {canCrearTareas && (
              <Button
                variant="outlined"
                size="medium"
                startIcon={<AddIcon />}
                onClick={() => navigate("/tareas/nuevo?from=agenda", { state: { from: location.pathname + location.search } })}
                sx={{
                  fontWeight: 800,
                  borderRadius: "8px",
                  textTransform: "none",
                  width: { xs: "100%", sm: "auto" },
                  py: { xs: 1, sm: 0.75 },
                }}
              >
                Nueva Tarea
              </Button>
            )}
          </Stack>
        )}
      </Stack>

      {/* ── Custom Toolbar Premium (Navegación del Calendario) ── */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 2,
          border: "1px solid",
          borderColor: "divider",
          borderRadius: "16px",
          bgcolor: "background.paper",
        }}
      >
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          alignItems="center"
          justifyContent="space-between"
        >
          {/* Switches de visibilidad — izquierda en desktop, arriba (más grandes) en mobile */}
          <Stack
            direction="row"
            spacing={{ xs: 3, md: 1.5 }}
            alignItems="center"
            justifyContent="center"
            sx={{
              order: { xs: 0, md: 0 },
              transform: { xs: "scale(1.2)", md: "none" },
              transformOrigin: { xs: "center", md: "left" },
              py: { xs: 0.5, md: 0 },
            }}
          >
            <FormControlLabel
              sx={{ mr: 0 }}
              control={
                <Switch
                  checked={showEventos}
                  onChange={(e) => setShowEventos(e.target.checked)}
                  size="small"
                  color="primary"
                />
              }
              label={
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <EventIcon fontSize="inherit" sx={{ color: "primary.light" }} />
                  <Typography variant="caption" sx={{ fontWeight: 700 }}>
                    Eventos
                  </Typography>
                </Stack>
              }
            />
            <FormControlLabel
              sx={{ mr: 0 }}
              control={
                <Switch
                  checked={showTareas}
                  onChange={(e) => setShowTareas(e.target.checked)}
                  size="small"
                  color="success"
                />
              }
              label={
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <TaskIcon fontSize="inherit" sx={{ color: "success.light" }} />
                  <Typography variant="caption" sx={{ fontWeight: 700 }}>
                    Tareas
                  </Typography>
                </Stack>
              }
            />
          </Stack>

          {/* Título Mes/Año — centro en desktop, debajo de Hoy/flechas en mobile */}
          <Typography
            variant="h6"
            sx={{ fontWeight: 950, letterSpacing: "-0.02em", fontSize: "1.25rem", textAlign: "center", order: { xs: 2, md: 1 } }}
          >
            {calendarHeaderTitle}
          </Typography>

          {/* Navegación (Hoy + flechas) + selector de vista */}
          <Stack
            direction="row"
            spacing={1.5}
            alignItems="center"
            justifyContent="center"
            flexWrap="wrap"
            useFlexGap
            sx={{ order: { xs: 1, md: 2 } }}
          >
            <Button
              variant="outlined"
              size="small"
              startIcon={<TodayIcon />}
              onClick={() => handleNavigate("TODAY")}
              sx={{ fontWeight: 700, borderRadius: "8px", textTransform: "none", height: 36 }}
            >
              Hoy
            </Button>
            <ButtonGroup size="small" variant="outlined" sx={{ height: 36, borderRadius: "8px", display: "inline-flex" }}>
              <IconButton onClick={() => handleNavigate("PREV")} sx={{ px: 1.5, borderRight: "1px solid", borderColor: "divider" }}>
                <ChevronLeftIcon fontSize="small" />
              </IconButton>
              <IconButton onClick={() => handleNavigate("NEXT")} sx={{ px: 1.5 }}>
                <ChevronRightIcon fontSize="small" />
              </IconButton>
            </ButtonGroup>
            {agendaQuery.isFetching && <CircularProgress size={16} sx={{ color: "primary.light" }} />}
            <ButtonGroup
              size="small"
              variant="outlined"
              sx={{ display: { xs: "none", sm: "flex" }, ml: { sm: 0.5 } }}
            >
              <Button
                onClick={() => handleViewChange("month")}
                variant={currentView === "month" ? "contained" : "outlined"}
                sx={{ fontWeight: 700, textTransform: "none", borderRadius: "8px 0 0 8px" }}
              >
                Mes
              </Button>
              <Button
                onClick={() => handleViewChange("week")}
                variant={currentView === "week" ? "contained" : "outlined"}
                sx={{ fontWeight: 700, textTransform: "none", borderRadius: "0" }}
              >
                Semana
              </Button>
              <Button
                onClick={() => handleViewChange("day")}
                variant={currentView === "day" ? "contained" : "outlined"}
                sx={{ fontWeight: 700, textTransform: "none", borderRadius: "0 8px 8px 0" }}
              >
                Día
              </Button>
            </ButtonGroup>
          </Stack>
        </Stack>
      </Paper>

      {/* ── Contenedor del Calendario con Overrides ── */}
      <Box sx={calendarStyles}>
        {agendaQuery.isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "500px" }}>
            <CircularProgress />
          </Box>
        ) : agendaQuery.isError ? (
          <Paper elevation={0} sx={{ p: 5, borderRadius: "16px", border: "1px solid", borderColor: "divider", textAlign: "center", my: 4 }}>
            <Typography variant="h6" sx={{ fontWeight: 900 }}>
              No se pudo cargar la agenda
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5, mb: 2 }}>
              Hubo un problema de conexión o el servidor no respondió. Probá de nuevo.
            </Typography>
            <Button variant="contained" onClick={() => agendaQuery.refetch()} sx={{ fontWeight: 800 }}>
              Reintentar
            </Button>
          </Paper>
        ) : (
          <Calendar
            localizer={localizer}
            culture="es"
            events={calendarEvents}
            startAccessor="start"
            endAccessor="end"
            allDayAccessor="allDay"
            date={date}
            view={currentView}
            onNavigate={(newDate) => setDate(newDate)}
            onView={handleViewChange}
            onSelectEvent={handleSelectEvent}
            selectable
            onSelectSlot={handleSelectSlot}
            eventPropGetter={eventPropGetter}
            components={{
              event: customEventRenderer,
            }}
            messages={{
              noEventsInRange: "No hay eventos ni tareas agendados en este rango.",
              showMore: (total) => `+ Ver ${total} más`,
            }}
          />
        )}
      </Box>

      {/* ── Drawer Lateral de Detalles Premium ── */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{
          sx: {
            width: { xs: "100%", sm: 400 },
            borderLeft: "1px solid",
            borderColor: "divider",
            backgroundColor: "background.paper",
            boxShadow: "-10px 0 40px rgba(0,0,0,0.15)",
          },
        }}
      >
        {selectedItem && (
          <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
            {/* Header del Drawer */}
            <Box sx={{ p: 3, pb: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                {selectedItem.tipo === "EVENTO" ? (
                  <Chip
                    icon={<EventIcon fontSize="small" />}
                    label="Evento"
                    color="primary"
                    variant="outlined"
                    sx={{ fontWeight: 800, borderRadius: "8px" }}
                  />
                ) : (
                  <Chip
                    icon={<TaskIcon fontSize="small" />}
                    label="Tarea"
                    color="success"
                    variant="outlined"
                    sx={{
                      fontWeight: 800,
                      borderRadius: "8px",
                      borderColor: selectedItem.completada ? "rgba(16, 185, 129, 0.4)" : "rgba(245, 158, 11, 0.4)",
                      color: selectedItem.completada ? "success.main" : "warning.main",
                    }}
                  />
                )}

                {selectedItem.tipo === "TAREA" && (
                  <Chip
                    label={selectedItem.completada ? "Completada" : "Pendiente"}
                    color={selectedItem.completada ? "success" : "warning"}
                    size="small"
                    sx={{ fontWeight: 800, fontSize: "0.72rem" }}
                  />
                )}
              </Stack>

              <IconButton onClick={() => setDrawerOpen(false)} size="small" sx={{ border: "1px solid", borderColor: "divider" }}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>

            <Divider />

            {/* Contenido del Drawer */}
            <Box sx={{ p: 3, flexGrow: 1, overflowY: "auto" }}>
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 800,
                  letterSpacing: "-0.03em",
                  lineHeight: 1.25,
                  mb: 3,
                  color: "text.primary",
                }}
              >
                {selectedItem.titulo || "Sin título"}
              </Typography>

              {/* Sección de Fecha / Hora */}
              <Stack spacing={2.5} sx={{ mb: 4 }}>
                <Box>
                  <Typography variant="caption" sx={{ color: "text.disabled", fontWeight: 700, textTransform: "uppercase", display: "block", mb: 0.75 }}>
                    Fecha
                  </Typography>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Box sx={{ p: 1, borderRadius: "8px", bgcolor: "action.hover", color: "text.secondary", display: "inline-flex" }}>
                      <TodayIcon fontSize="small" />
                    </Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {formatDetailDate(selectedItem.fecha)}
                    </Typography>
                  </Stack>
                </Box>

                {selectedItem.tipo === "EVENTO" && selectedItem.fecha && (
                  <Box>
                    <Typography variant="caption" sx={{ color: "text.disabled", fontWeight: 700, textTransform: "uppercase", display: "block", mb: 0.75 }}>
                      Horario
                    </Typography>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Box sx={{ p: 1, borderRadius: "8px", bgcolor: "action.hover", color: "text.secondary", display: "inline-flex" }}>
                        <TimeIcon fontSize="small" />
                      </Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {formatTime(selectedItem.fecha)} hs
                        {selectedItem.fechaFin && ` — ${formatTime(selectedItem.fechaFin)} hs`}
                      </Typography>
                    </Stack>
                  </Box>
                )}
              </Stack>

            </Box>

            <Divider />

            {/* Acciones del Drawer */}
            <Box sx={{ p: 3, bgcolor: "action.hover" }}>
              <Stack spacing={1.5}>
                {/* Enlace al Expediente / Caso */}
                {selectedItem.link && (
                  <Button
                    variant="contained"
                    fullWidth
                    startIcon={<FolderIcon />}
                    onClick={() => {
                      setDrawerOpen(false);
                      navigate(selectedItem.link);
                    }}
                    sx={{
                      fontWeight: 700,
                      borderRadius: "10px",
                      textTransform: "none",
                      boxShadow: "none",
                      "&:hover": { boxShadow: "none" },
                    }}
                  >
                    Ir al Expediente
                  </Button>
                )}

                {/* Acciones de Tareas (Toggle de completada) */}
                {selectedItem.tipo === "TAREA" && canEditarTareas && (
                  <Button
                    variant="outlined"
                    fullWidth
                    color={selectedItem.completada ? "warning" : "success"}
                    startIcon={selectedItem.completada ? <PendingIcon /> : <CheckIcon />}
                    disabled={toggleTareaMutation.isPending}
                    onClick={() =>
                      toggleTareaMutation.mutate({
                        id: selectedItem.id,
                        completada: !selectedItem.completada,
                      })
                    }
                    sx={{
                      fontWeight: 700,
                      borderRadius: "10px",
                      textTransform: "none",
                    }}
                  >
                    {selectedItem.completada ? "Marcar como Pendiente" : "Marcar como Completada"}
                  </Button>
                )}

                {((selectedItem.tipo === "EVENTO" && canEditarEventos) || (selectedItem.tipo === "TAREA" && canEditarTareas)) && (
                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<EditIcon />}
                    onClick={() => {
                      setDrawerOpen(false);
                      navigate(selectedItem.tipo === "EVENTO" ? `/eventos/editar/${selectedItem.id}` : `/tareas/editar/${selectedItem.id}`, { state: { from: location.pathname + location.search } });
                    }}
                    sx={{ fontWeight: 700, borderRadius: "10px", textTransform: "none" }}
                  >
                    Editar
                  </Button>
                )}

                {((selectedItem.tipo === "EVENTO" && canEliminarEventos) || (selectedItem.tipo === "TAREA" && canEliminarTareas)) && (
                  <Button
                    variant="outlined"
                    fullWidth
                    color="error"
                    startIcon={<DeleteIcon />}
                    onClick={() => setDeleteTarget(selectedItem)}
                    sx={{ fontWeight: 700, borderRadius: "10px", textTransform: "none" }}
                  >
                    Eliminar
                  </Button>
                )}

                <Button
                  variant="text"
                  fullWidth
                  color="inherit"
                  onClick={() => setDrawerOpen(false)}
                  sx={{
                    fontWeight: 700,
                    textTransform: "none",
                    color: "text.secondary",
                  }}
                >
                  Cerrar panel
                </Button>
              </Stack>
            </Box>
          </Box>
        )}
      </Drawer>

      <Dialog open={Boolean(newSlot)} onClose={() => setNewSlot(null)} PaperProps={{ sx: { borderRadius: "16px", p: 1, width: "100%", maxWidth: 430 } }}>
        <DialogTitle sx={{ fontWeight: 900 }}>¿Qué desea programar?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Elegí el tipo de elemento para crear en el calendario.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1, flexWrap: "wrap" }}>
          <Button variant="outlined" onClick={() => setNewSlot(null)} sx={{ borderRadius: "10px", fontWeight: 800 }}>Cancelar</Button>
          {canCrearTareas && (
            <Button
              variant="outlined"
              onClick={() => {
                const iso = newSlot.toISOString();
                setNewSlot(null);
                navigate(`/tareas/nuevo?fechaLimite=${encodeURIComponent(iso)}`, { state: { from: location.pathname + location.search } });
              }}
              sx={{ borderRadius: "10px", fontWeight: 900 }}
            >
              Nueva Tarea
            </Button>
          )}
          {canCrearEventos && (
            <Button
              variant="contained"
              onClick={() => {
                const iso = newSlot.toISOString();
                setNewSlot(null);
                navigate(`/eventos/nuevo?from=agenda&fechaInicio=${encodeURIComponent(iso)}`, { state: { from: location.pathname + location.search } });
              }}
              sx={{ borderRadius: "10px", fontWeight: 900 }}
            >
              Nuevo Evento
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onClose={() => !deleteMutation.isPending && setDeleteTarget(null)} PaperProps={{ sx: { borderRadius: "16px", p: 1, width: "100%", maxWidth: 430 } }}>
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: "50%", display: "grid", placeItems: "center", bgcolor: "error.light", color: "error.contrastText" }}>
            <WarningIcon />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 900 }}>Eliminar {deleteTarget?.tipo === "EVENTO" ? "evento" : "tarea"}</Typography>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>¿Está seguro que desea eliminar este {deleteTarget?.tipo === "EVENTO" ? "evento" : "registro"}?</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button variant="outlined" onClick={() => setDeleteTarget(null)} disabled={deleteMutation.isPending} sx={{ borderRadius: "10px", fontWeight: 800 }}>Cancelar</Button>
          <Button variant="contained" color="error" onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)} disabled={deleteMutation.isPending} sx={{ borderRadius: "10px", fontWeight: 900 }}>
            {deleteMutation.isPending ? <CircularProgress size={18} color="inherit" /> : "Eliminar"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
