import { useEffect, useMemo, useState } from "react";
import { Link as RouterLink, useLocation, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { alpha, useTheme } from "@mui/material/styles";
import api from "../api/axios";
import { fetchAllPages } from "../api/pagination";
import { useAuth } from "../auth/AuthContext";
import { usePermisos } from "../auth/usePermissions";
import {
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  LinearProgress,
  Link,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import {
  Add,
  ArrowBack,
  CalendarToday,
  CheckCircle,
  Delete,
  Edit,
  FolderOpen,
  NotificationsActive,
  Person,
  Save,
} from "@mui/icons-material";
import {
  casoLabel,
  checklistStats,
  clienteLabel,
  formatDateTime,
  formatFriendlyDate,
  getApiError,
  priorityStyles,
  unwrapData,
  unwrapEntity,
  unwrapItems,
} from "./tareasUtils";

export default function TareaDetalle() {
  const { id } = useParams();
  const taskId = Number(id);
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = `${location.pathname}${location.search}`;
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuth();
  const { canEditar } = usePermisos("TAREAS");
  const [newSubtask, setNewSubtask] = useState("");
  const [confirmCascadeOpen, setConfirmCascadeOpen] = useState(false);

  const tareaQuery = useQuery({
    queryKey: ["tareas", taskId],
    enabled: Boolean(taskId),
    queryFn: async () => {
      const { data } = await api.get(`/tareas/${taskId}`);
      return unwrapEntity(data);
    },
  });

  const prioridadesQuery = useQuery({
    queryKey: ["catalogos", "parametros", "PRIORIDAD"],
    queryFn: async () => {
      const { data } = await api.get("/catalogos/parametros", { params: { categoria: "PRIORIDAD" } });
      return unwrapData(data);
    },
    staleTime: 1000 * 60 * 30,
  });

  const clientesQuery = useQuery({
    queryKey: ["clientes", "lookup"],
    queryFn: () => fetchAllPages("/clientes"),
    staleTime: 1000 * 60 * 5,
  });

  const expedientesQuery = useQuery({
    queryKey: ["expedientes", "lookup"],
    queryFn: () => fetchAllPages("/expedientes"),
    staleTime: 1000 * 60 * 5,
  });

  const tarea = tareaQuery.data;
  const prioritiesById = useMemo(() => new Map((prioridadesQuery.data ?? []).map((p) => [Number(p.id), p])), [prioridadesQuery.data]);
  const clientesById = useMemo(() => new Map((clientesQuery.data ?? []).map((c) => [Number(c.id), c])), [clientesQuery.data]);
  const expedientesById = useMemo(() => new Map((expedientesQuery.data ?? []).map((c) => [Number(c.id), c])), [expedientesQuery.data]);
  const priority = prioritiesById.get(Number(tarea?.prioridadId));
  const prioritySx = priorityStyles(priority, theme);
  const cliente = clientesById.get(Number(tarea?.clienteId));
  const caso = expedientesById.get(Number(tarea?.casoId));
  const items = Array.isArray(tarea?.items) ? tarea.items : [];
  const stats = checklistStats(tarea);
  const assignedName = [user?.nombre, user?.apellido].filter(Boolean).join(" ") || user?.email || "Usuario actual";
  const incompleteSubtasksCount = items.filter((item) => !item.completada).length;

  function invalidateTarea() {
    queryClient.invalidateQueries({ queryKey: ["tareas"] });
    queryClient.invalidateQueries({ queryKey: ["tareas", taskId] });
    queryClient.invalidateQueries({ queryKey: ["agenda"] });
  }

  function handleVolver() {
    if (location.state?.from) navigate(location.state.from);
    else navigate("/tareas");
  }

  const toggleTaskMutation = useMutation({
    mutationFn: async (cascade = false) => {
      const { data } = await api.put(`/tareas/${taskId}`, {
        completada: !tarea.completada,
        completarSubtareas: cascade,
      });
      return unwrapEntity(data);
    },
    onSuccess: () => {
      enqueueSnackbar(tarea.completada ? "Tarea marcada como pendiente" : "Tarea completada", { variant: "success" });
      invalidateTarea();
    },
    onError: (error) => enqueueSnackbar(getApiError(error, "No se pudo actualizar la tarea"), { variant: "error" }),
  });

  const addSubtaskMutation = useMutation({
    mutationFn: async (titulo) => {
      const { data } = await api.post(`/tareas/${taskId}/subtareas`, { titulo, orden: items.length });
      return unwrapEntity(data);
    },
    onSuccess: () => {
      setNewSubtask("");
      enqueueSnackbar("Subtarea agregada", { variant: "success" });
      invalidateTarea();
    },
    onError: (error) => enqueueSnackbar(getApiError(error, "No se pudo agregar la subtarea"), { variant: "error" }),
  });

  const toggleSubtaskMutation = useMutation({
    mutationFn: async (subtaskId) => {
      const { data } = await api.patch(`/tareas/${taskId}/subtareas/${subtaskId}/toggle`);
      return unwrapEntity(data);
    },
    onSuccess: invalidateTarea,
    onError: (error) => enqueueSnackbar(getApiError(error, "No se pudo actualizar la subtarea"), { variant: "error" }),
  });

  const updateSubtaskMutation = useMutation({
    mutationFn: async ({ subtask, titulo }) => {
      const { data } = await api.put(`/tareas/${taskId}/subtareas/${subtask.id}`, { titulo, orden: subtask.orden });
      return unwrapEntity(data);
    },
    onSuccess: () => {
      enqueueSnackbar("Subtarea actualizada", { variant: "success" });
      invalidateTarea();
    },
    onError: (error) => enqueueSnackbar(getApiError(error, "No se pudo editar la subtarea"), { variant: "error" }),
  });

  const deleteSubtaskMutation = useMutation({
    mutationFn: async (subtaskId) => api.delete(`/tareas/${taskId}/subtareas/${subtaskId}`),
    onSuccess: () => {
      enqueueSnackbar("Subtarea eliminada", { variant: "success" });
      invalidateTarea();
    },
    onError: (error) => enqueueSnackbar(getApiError(error, "No se pudo eliminar la subtarea"), { variant: "error" }),
  });

  function submitNewSubtask() {
    const title = newSubtask.trim();
    if (!title) return;
    addSubtaskMutation.mutate(title);
  }

  function handleMainToggle() {
    if (!tarea.completada && incompleteSubtasksCount > 0) {
      setConfirmCascadeOpen(true);
      return;
    }
    toggleTaskMutation.mutate(false);
  }

  const panelSx = {
    border: "1px solid",
    borderColor: "divider",
    borderRadius: "16px",
    boxShadow: "none",
    bgcolor: "background.paper",
  };

  if (tareaQuery.isLoading) {
    return <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}><CircularProgress /></Box>;
  }

  if (tareaQuery.isError || !tarea) {
    return (
      <Paper elevation={0} sx={{ ...panelSx, p: 4, textAlign: "center" }}>
        <Typography variant="h6" sx={{ fontWeight: 900 }}>No pudimos cargar la tarea</Typography>
        <Button onClick={handleVolver} sx={{ mt: 2 }}>Volver</Button>
      </Paper>
    );
  }

  return (
    <Box>
      <Button startIcon={<ArrowBack />} onClick={handleVolver} sx={{ mb: 2, fontWeight: 800 }}>
        Volver
      </Button>

      <Paper elevation={0} sx={{ ...panelSx, p: { xs: 2, md: 3 }, mb: 2.5 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "stretch", md: "center" }} justifyContent="space-between">
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ mb: 1 }}>
              <Chip label={priority?.nombre ?? "Sin prioridad"} sx={{ bgcolor: prioritySx.bg, color: prioritySx.color, border: "1px solid", borderColor: prioritySx.border, fontWeight: 900 }} />
              <Chip icon={<CheckCircle />} label={tarea.completada ? "Completada" : "Pendiente"} color={tarea.completada ? "success" : "warning"} sx={{ fontWeight: 900 }} />
            </Stack>
            <Typography variant="h4" sx={{ fontWeight: 950, letterSpacing: 0, textDecoration: tarea.completada ? "line-through" : "none", color: tarea.completada ? "text.secondary" : "text.primary" }}>
              {tarea.titulo}
            </Typography>
          </Box>
          {canEditar && (
            <Button variant="outlined" startIcon={<Edit />} onClick={() => navigate(`/tareas/editar/${taskId}`)} sx={{ borderRadius: "10px", fontWeight: 900 }}>
              Editar Tarea
            </Button>
          )}
        </Stack>
      </Paper>

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper elevation={0} sx={{ ...panelSx, p: { xs: 2, md: 3 }, height: "100%" }}>
            <Stack spacing={2.5}>
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <Checkbox checked={Boolean(tarea.completada)} onChange={handleMainToggle} disabled={toggleTaskMutation.isPending} sx={{ transform: "scale(1.25)" }} />
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>{tarea.completada ? "Tarea completada" : "Tarea pendiente"}</Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>{tarea.completadaAt ? `Completada el ${formatDateTime(tarea.completadaAt)}` : "Podés actualizar el estado desde esta ficha."}</Typography>
                </Box>
              </Stack>
              <Divider />
              {tarea.descripcion && (
                <Box>
                  <Typography variant="caption" sx={{ color: "text.disabled", fontWeight: 900, textTransform: "uppercase" }}>Descripción</Typography>
                  <Typography variant="body2" sx={{ mt: 0.75, whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{tarea.descripcion}</Typography>
                </Box>
              )}
              <InfoLine icon={<CalendarToday />} label="Fecha límite" value={formatFriendlyDate(tarea.fechaLimite)} />
              <InfoLine icon={<NotificationsActive />} label="Recordatorio" value={formatFriendlyDate(tarea.recordatorio)} />
              <InfoLine
                icon={<Person />}
                label="Asignado a"
                value={assignedName}
                avatar
              />
              <InfoLine
                icon={<Person />}
                label="Cliente"
                value={cliente ? clienteLabel(cliente) : "Sin cliente"}
                link={cliente ? `/clientes/${cliente.id}` : ""}
                linkState={{ from: currentPath }}
              />
              <InfoLine
                icon={<FolderOpen />}
                label="Expediente"
                value={caso ? casoLabel(caso) : "Sin expediente"}
                link={caso ? `/expedientes/${caso.id}` : ""}
                linkState={{ from: currentPath }}
              />
              <Divider />
              <Stack spacing={0.5}>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>Creado el {formatDateTime(tarea.createdAt)}</Typography>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>Última modificación el {formatDateTime(tarea.updatedAt)}</Typography>
              </Stack>
            </Stack>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 7 }}>
          <Paper elevation={0} sx={{ ...panelSx, overflow: "hidden" }}>
            <Box sx={{ p: { xs: 2, md: 3 } }}>
              <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1.5} sx={{ mb: 1.5 }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 950 }}>Checklist de Subtareas</Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800 }}>{stats.done}/{stats.total} completadas</Typography>
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 950, color: "primary.main" }}>{stats.percent}%</Typography>
              </Stack>
              <LinearProgress variant="determinate" value={stats.percent} sx={{ height: 7, borderRadius: 99 }} />
            </Box>
            <Divider />
            <Stack sx={{ p: { xs: 1.25, md: 2 } }} spacing={0.5}>
              {items.length === 0 ? (
                <Typography variant="body2" sx={{ color: "text.secondary", px: 1, py: 2 }}>Todavía no hay subtareas.</Typography>
              ) : (
                items.map((item) => (
                  <SubtaskRow
                    key={item.id}
                    item={item}
                    disabled={toggleSubtaskMutation.isPending || updateSubtaskMutation.isPending || deleteSubtaskMutation.isPending}
                    onToggle={() => toggleSubtaskMutation.mutate(item.id)}
                    onSave={(titulo) => updateSubtaskMutation.mutate({ subtask: item, titulo })}
                    onDelete={() => deleteSubtaskMutation.mutate(item.id)}
                  />
                ))
              )}
              {canEditar && (
                <Stack direction="row" spacing={1} sx={{ px: 1, pt: 1.5 }}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Añadir un elemento..."
                    value={newSubtask}
                    onChange={(event) => setNewSubtask(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        submitNewSubtask();
                      }
                    }}
                  />
                  <IconButton color="primary" disabled={addSubtaskMutation.isPending || !newSubtask.trim()} onClick={submitNewSubtask} sx={{ border: "1px solid", borderColor: "divider" }}>
                    <Add />
                  </IconButton>
                </Stack>
              )}
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      <CascadeConfirmDialog
        open={confirmCascadeOpen}
        incompleteCount={incompleteSubtasksCount}
        onClose={() => setConfirmCascadeOpen(false)}
        onOnlyTask={() => {
          setConfirmCascadeOpen(false);
          toggleTaskMutation.mutate(false);
        }}
        onCascade={() => {
          setConfirmCascadeOpen(false);
          toggleTaskMutation.mutate(true);
        }}
        theme={theme}
      />
    </Box>
  );
}

function CascadeConfirmDialog({ open, incompleteCount, onClose, onOnlyTask, onCascade, theme }) {
  return (
    <Dialog open={open} onClose={onClose} PaperProps={{ sx: { borderRadius: "16px", p: 1, width: "100%", maxWidth: 500 } }}>
      <DialogTitle sx={{ display: "flex", gap: 1.5, alignItems: "center", pb: 1 }}>
        <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.12), color: "primary.main" }}>
          <CheckCircle />
        </Avatar>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 900 }}>¿Completar subtareas pendientes?</Typography>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>Confirmación de completado en cascada</Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: "text.secondary", lineHeight: 1.7 }}>
          Esta tarea tiene{" "}
          <Box component="span" sx={{ color: "text.primary", fontWeight: 900 }}>
            {incompleteCount}
          </Box>{" "}
          subtareas sin completar. ¿Querés marcarlas todas como completadas también?
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1, flexWrap: "wrap" }}>
        <Button variant="outlined" color="inherit" onClick={onClose} sx={{ borderRadius: "10px", fontWeight: 800 }}>
          Cancelar
        </Button>
        <Button variant="outlined" onClick={onOnlyTask} sx={{ borderRadius: "10px", fontWeight: 900 }}>
          Solo la tarea
        </Button>
        <Button variant="contained" onClick={onCascade} sx={{ borderRadius: "10px", fontWeight: 900 }}>
          Sí, completar todo
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function InfoLine({ icon, label, value, link, linkState, avatar = false }) {
  const content = link ? (
    <Link component={RouterLink} to={link} state={linkState} sx={{ fontWeight: 900, textDecoration: "none" }}>{value}</Link>
  ) : (
    <Typography variant="body2" sx={{ fontWeight: 800 }}>{value}</Typography>
  );
  return (
    <Stack direction="row" spacing={1.5} alignItems="center">
      {avatar ? (
        <Avatar sx={{ width: 34, height: 34, fontSize: 13 }}>{String(value || "U")[0]}</Avatar>
      ) : (
        <Avatar sx={{ width: 34, height: 34, bgcolor: "action.hover", color: "text.secondary" }}>{icon}</Avatar>
      )}
      <Box>
        <Typography variant="caption" sx={{ display: "block", color: "text.disabled", fontWeight: 900, textTransform: "uppercase" }}>{label}</Typography>
        {content}
      </Box>
    </Stack>
  );
}

function SubtaskRow({ item, disabled, onToggle, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.titulo ?? "");

  useEffect(() => {
    setTitle(item.titulo ?? "");
  }, [item.titulo]);

  function commit() {
    const next = title.trim();
    setEditing(false);
    if (next && next !== item.titulo) onSave(next);
    if (!next) setTitle(item.titulo ?? "");
  }

  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 1, py: 1, borderRadius: "10px", "&:hover": { bgcolor: "action.hover" } }}>
      <Checkbox size="small" checked={Boolean(item.completada)} disabled={disabled} onChange={onToggle} />
      {editing ? (
        <TextField
          autoFocus
          fullWidth
          size="small"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit();
            if (event.key === "Escape") {
              setTitle(item.titulo ?? "");
              setEditing(false);
            }
          }}
        />
      ) : (
        <Typography onDoubleClick={() => setEditing(true)} variant="body2" sx={{ flex: 1, fontWeight: 800, cursor: "text", textDecoration: item.completada ? "line-through" : "none", color: item.completada ? "text.secondary" : "text.primary" }}>
          {item.titulo}
        </Typography>
      )}
      {editing ? (
        <IconButton size="small" color="primary" onMouseDown={(event) => event.preventDefault()} onClick={commit}><Save fontSize="small" /></IconButton>
      ) : (
        <IconButton size="small" color="primary" disabled={disabled} onClick={() => setEditing(true)}><Edit fontSize="small" /></IconButton>
      )}
      <IconButton size="small" color="error" disabled={disabled} onClick={onDelete}><Delete fontSize="small" /></IconButton>
    </Stack>
  );
}
