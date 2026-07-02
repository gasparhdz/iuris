import { useMemo, useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { alpha, useTheme } from "@mui/material/styles";
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
  Stack,
  Typography,
} from "@mui/material";
import {
  CalendarToday,
  CheckCircle,
  Close,
  Edit,
  FolderOpen,
  NotificationsActive,
  OpenInNew,
  Person,
  WarningAmber,
} from "@mui/icons-material";
import api from "../api/axios";
import { fetchAllPages } from "../api/pagination";
import { usePermisos } from "../auth/usePermissions";
import {
  casoLabel,
  checklistStats,
  clienteLabel,
  formatDateTime,
  formatFriendlyDate,
  getApiError,
  isOverdue,
  priorityStyles,
  unwrapData,
  unwrapEntity,
} from "../pages/tareasUtils";

function MetaRow({ icon, label, value, link }) {
  return (
    <Stack direction="row" spacing={1.25} alignItems="flex-start">
      <Avatar sx={{ width: 32, height: 32, bgcolor: "action.hover", color: "text.secondary" }}>
        {icon}
      </Avatar>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" sx={{ display: "block", color: "text.disabled", fontWeight: 700, textTransform: "uppercase" }}>
          {label}
        </Typography>
        {link ? (
          <Link component={RouterLink} to={link} sx={{ fontWeight: 700, fontSize: "0.84rem", textDecoration: "none" }}>
            {value}
          </Link>
        ) : (
          <Typography variant="body2" sx={{ fontWeight: 700, fontSize: "0.84rem" }}>
            {value}
          </Typography>
        )}
      </Box>
    </Stack>
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

export default function TareaDetalleDialog({ open, taskId, onClose }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { canEditar } = usePermisos("TAREAS");
  const [confirmCascadeOpen, setConfirmCascadeOpen] = useState(false);

  const tareaQuery = useQuery({
    queryKey: ["tareas", taskId],
    enabled: open && Boolean(taskId),
    queryFn: async () => {
      const { data } = await api.get(`/tareas/${taskId}`);
      return unwrapEntity(data);
    },
  });

  const prioridadesQuery = useQuery({
    queryKey: ["catalogos", "parametros", "PRIORIDAD"],
    enabled: open,
    queryFn: async () => {
      const { data } = await api.get("/catalogos/parametros", { params: { categoria: "PRIORIDAD" } });
      return unwrapData(data);
    },
    staleTime: 1000 * 60 * 30,
  });

  const clientesQuery = useQuery({
    queryKey: ["clientes", "lookup"],
    enabled: open,
    queryFn: () => fetchAllPages("/clientes"),
    staleTime: 1000 * 60 * 5,
  });

  const expedientesQuery = useQuery({
    queryKey: ["expedientes", "lookup"],
    enabled: open,
    queryFn: () => fetchAllPages("/expedientes"),
    staleTime: 1000 * 60 * 5,
  });

  const usuariosQuery = useQuery({
    queryKey: ["equipo", "usuarios"],
    enabled: open,
    queryFn: async () => {
      const { data } = await api.get("/equipo/usuarios");
      return data?.data ?? data ?? [];
    },
    staleTime: 1000 * 60 * 5,
  });

  const tarea = tareaQuery.data;
  const prioritiesById = useMemo(
    () => new Map((prioridadesQuery.data ?? []).map((p) => [Number(p.id), p])),
    [prioridadesQuery.data],
  );
  const clientesById = useMemo(
    () => new Map((clientesQuery.data ?? []).map((c) => [Number(c.id), c])),
    [clientesQuery.data],
  );
  const expedientesById = useMemo(
    () => new Map((expedientesQuery.data ?? []).map((c) => [Number(c.id), c])),
    [expedientesQuery.data],
  );
  const usuariosById = useMemo(
    () => new Map((usuariosQuery.data ?? []).map((u) => [Number(u.id), u])),
    [usuariosQuery.data],
  );

  const priority = prioritiesById.get(Number(tarea?.prioridadId));
  const prioritySx = priorityStyles(priority, theme);
  const cliente = clientesById.get(Number(tarea?.clienteId));
  const caso = expedientesById.get(Number(tarea?.casoId));
  const asignado = usuariosById.get(Number(tarea?.asignadoA));
  const items = Array.isArray(tarea?.items) ? tarea.items : [];
  const stats = checklistStats(tarea);
  const overdue = isOverdue(tarea);
  const incompleteSubtasksCount = items.filter((item) => !item.completada).length;
  const asignadoLabel = asignado
    ? [asignado.nombre, asignado.apellido].filter(Boolean).join(" ") || asignado.email || `Usuario #${asignado.id}`
    : tarea?.asignadoA
      ? `Usuario #${tarea.asignadoA}`
      : "Sin asignar";

  function invalidateTarea() {
    queryClient.invalidateQueries({ queryKey: ["tareas"] });
    queryClient.invalidateQueries({ queryKey: ["tareas", taskId] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["agenda"] });
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
      if (!tarea.completada) onClose();
    },
    onError: (error) => enqueueSnackbar(getApiError(error, "No se pudo actualizar la tarea"), { variant: "error" }),
  });

  const toggleSubtaskMutation = useMutation({
    mutationFn: async (subtaskId) => {
      const { data } = await api.patch(`/tareas/${taskId}/subtareas/${subtaskId}/toggle`);
      return unwrapEntity(data);
    },
    onSuccess: invalidateTarea,
    onError: (error) => enqueueSnackbar(getApiError(error, "No se pudo actualizar la subtarea"), { variant: "error" }),
  });

  function handleMainToggle() {
    if (!tarea.completada && incompleteSubtasksCount > 0) {
      setConfirmCascadeOpen(true);
      return;
    }
    toggleTaskMutation.mutate(false);
  }

  function goToFullPage() {
    onClose();
    navigate(`/tareas/${taskId}`);
  }

  const busy = toggleTaskMutation.isPending || toggleSubtaskMutation.isPending;

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        fullWidth
        maxWidth="sm"
        scroll="paper"
        PaperProps={{ sx: { borderRadius: "16px" } }}
      >
        <DialogTitle sx={{ pr: 6, pb: 1 }}>
          <Typography variant="overline" sx={{ color: "text.secondary", fontWeight: 700, letterSpacing: "0.08em" }}>
            Detalle de tarea
          </Typography>
          <IconButton onClick={onClose} sx={{ position: "absolute", right: 12, top: 12 }} aria-label="Cerrar">
            <Close />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ px: { xs: 2, sm: 2.5 }, py: 2 }}>
          {tareaQuery.isLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
              <CircularProgress size={28} />
            </Box>
          ) : tareaQuery.isError || !tarea ? (
            <Typography sx={{ color: "text.secondary", py: 4, textAlign: "center" }}>
              No pudimos cargar la tarea.
            </Typography>
          ) : (
            <Stack spacing={2.25}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Chip
                  label={priority?.nombre ?? "Sin prioridad"}
                  size="small"
                  sx={{
                    bgcolor: prioritySx.bg,
                    color: prioritySx.color,
                    border: "1px solid",
                    borderColor: prioritySx.border,
                    fontWeight: 800,
                  }}
                />
                <Chip
                  icon={<CheckCircle sx={{ fontSize: "14px !important" }} />}
                  label={tarea.completada ? "Completada" : "Pendiente"}
                  size="small"
                  color={tarea.completada ? "success" : "warning"}
                  sx={{ fontWeight: 800 }}
                />
                {overdue && (
                  <Chip
                    icon={<WarningAmber sx={{ fontSize: "14px !important" }} />}
                    label="Atrasada"
                    size="small"
                    sx={{
                      bgcolor: alpha("#C13A33", 0.1),
                      color: "#C13A33",
                      border: "1px solid",
                      borderColor: alpha("#C13A33", 0.3),
                      fontWeight: 800,
                    }}
                  />
                )}
              </Stack>

              <Typography
                variant="h6"
                sx={{
                  fontWeight: 900,
                  lineHeight: 1.35,
                  textDecoration: tarea.completada ? "line-through" : "none",
                  color: tarea.completada ? "text.secondary" : "text.primary",
                }}
              >
                {tarea.titulo || "Tarea sin título"}
              </Typography>

              {tarea.descripcion && (
                <Box>
                  <Typography variant="caption" sx={{ color: "text.disabled", fontWeight: 800, textTransform: "uppercase" }}>
                    Descripción
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.6, whiteSpace: "pre-wrap", lineHeight: 1.7, color: "text.secondary" }}>
                    {tarea.descripcion}
                  </Typography>
                </Box>
              )}

              <Stack spacing={1.5}>
                <MetaRow icon={<CalendarToday sx={{ fontSize: 17 }} />} label="Fecha límite" value={formatFriendlyDate(tarea.fechaLimite)} />
                <MetaRow icon={<NotificationsActive sx={{ fontSize: 17 }} />} label="Recordatorio" value={formatFriendlyDate(tarea.recordatorio)} />
                <MetaRow icon={<Person sx={{ fontSize: 17 }} />} label="Asignado a" value={asignadoLabel} />
                <MetaRow
                  icon={<Person sx={{ fontSize: 17 }} />}
                  label="Cliente"
                  value={cliente ? clienteLabel(cliente) : "Sin cliente"}
                  link={cliente ? `/clientes/${cliente.id}` : undefined}
                />
                <MetaRow
                  icon={<FolderOpen sx={{ fontSize: 17 }} />}
                  label="Expediente"
                  value={caso ? casoLabel(caso) : "Sin expediente"}
                  link={caso ? `/expedientes/${caso.id}` : undefined}
                />
              </Stack>

              <Divider />

              <Stack direction="row" alignItems="center" spacing={1.25}>
                <Checkbox
                  checked={Boolean(tarea.completada)}
                  onChange={handleMainToggle}
                  disabled={busy}
                />
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 800 }}>
                    {tarea.completada ? "Tarea completada" : "Marcar como completada"}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    {tarea.completadaAt ? `Completada el ${formatDateTime(tarea.completadaAt)}` : "Podés actualizar el estado desde acá."}
                  </Typography>
                </Box>
              </Stack>

              <Box>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>Subtareas</Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
                      {stats.done}/{stats.total} completadas
                    </Typography>
                  </Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 900, color: "primary.main" }}>
                    {stats.percent}%
                  </Typography>
                </Stack>
                <LinearProgress variant="determinate" value={stats.percent} sx={{ height: 6, borderRadius: 99, mb: 1.25 }} />
                {items.length === 0 ? (
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>Sin subtareas.</Typography>
                ) : (
                  <Stack spacing={0.25}>
                    {items.map((item) => (
                      <Stack
                        key={item.id}
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        sx={{ py: 0.35, borderRadius: "8px", "&:hover": { bgcolor: "action.hover" } }}
                      >
                        <Checkbox
                          size="small"
                          checked={Boolean(item.completada)}
                          disabled={busy}
                          onChange={() => toggleSubtaskMutation.mutate(item.id)}
                        />
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 700,
                            textDecoration: item.completada ? "line-through" : "none",
                            color: item.completada ? "text.secondary" : "text.primary",
                          }}
                        >
                          {item.titulo}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                )}
              </Box>

              <Stack spacing={0.35}>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  Creada el {formatDateTime(tarea.createdAt)}
                </Typography>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  Última modificación el {formatDateTime(tarea.updatedAt)}
                </Typography>
              </Stack>
            </Stack>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 2.5, py: 1.75, gap: 1, flexWrap: "wrap" }}>
          <Button onClick={onClose} color="inherit" sx={{ fontWeight: 700 }}>
            Cerrar
          </Button>
          <Box sx={{ flex: 1 }} />
          {canEditar && tarea && (
            <Button
              variant="outlined"
              startIcon={<Edit />}
              onClick={() => {
                onClose();
                navigate(`/tareas/editar/${taskId}`);
              }}
              sx={{ borderRadius: "10px", fontWeight: 800 }}
            >
              Editar
            </Button>
          )}
          <Button
            variant="contained"
            endIcon={<OpenInNew />}
            onClick={goToFullPage}
            disabled={!tarea}
            sx={{ borderRadius: "10px", fontWeight: 800 }}
          >
            Ver ficha completa
          </Button>
        </DialogActions>
      </Dialog>

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
    </>
  );
}
