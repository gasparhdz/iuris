import { useEffect, useMemo, useState } from "react";
import { Link as RouterLink, useLocation, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { alpha, useTheme } from "@mui/material/styles";
import api from "../api/axios";
import { fetchAllPages } from "../api/pagination";
import { usePermisos } from "../auth/usePermissions";
import {
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Link,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import {
  ArrowBack,
  CalendarToday,
  Delete,
  Edit,
  FolderOpen,
  LocationOn,
  NotificationsActive,
  Person,
  WarningAmber,
} from "@mui/icons-material";
import {
  casoLabel,
  clienteLabel,
  formatDateTime,
  formatFriendlyDate,
  getApiError,
  unwrapData,
  unwrapEntity,
  unwrapItems,
} from "./tareasUtils";

export default function EventoDetalle() {
  const { id } = useParams();
  const eventId = Number(id);
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = `${location.pathname}${location.search}`;
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { canEditar, canEliminar } = usePermisos("EVENTOS");

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const eventoQuery = useQuery({
    queryKey: ["eventos", eventId],
    enabled: Boolean(eventId),
    queryFn: async () => {
      const { data } = await api.get(`/eventos/${eventId}`);
      return unwrapEntity(data);
    },
  });

  const tiposQuery = useQuery({
    queryKey: ["catalogos", "parametros", "TIPO_EVENTO"],
    queryFn: async () => {
      const { data } = await api.get("/catalogos/parametros", { params: { categoria: "TIPO_EVENTO" } });
      return unwrapData(data);
    },
    staleTime: 1000 * 60 * 30,
  });

  const estadosQuery = useQuery({
    queryKey: ["catalogos", "parametros", "ESTADO_EVENTO"],
    queryFn: async () => {
      const { data } = await api.get("/catalogos/parametros", { params: { categoria: "ESTADO_EVENTO" } });
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

  const event = eventoQuery.data;
  const tiposById = useMemo(() => new Map((tiposQuery.data ?? []).map((t) => [Number(t.id), t])), [tiposQuery.data]);
  const estadosById = useMemo(() => new Map((estadosQuery.data ?? []).map((e) => [Number(e.id), e])), [estadosQuery.data]);
  const clientesById = useMemo(() => new Map((clientesQuery.data ?? []).map((c) => [Number(c.id), c])), [clientesQuery.data]);
  const expedientesById = useMemo(() => new Map((expedientesQuery.data ?? []).map((x) => [Number(x.id), x])), [expedientesQuery.data]);

  const tipo = tiposById.get(Number(event?.tipoId));
  const estado = estadosById.get(Number(event?.estadoId));
  const cliente = clientesById.get(Number(event?.clienteId));
  const caso = expedientesById.get(Number(event?.casoId));

  function invalidateEvento() {
    queryClient.invalidateQueries({ queryKey: ["eventos"] });
    queryClient.invalidateQueries({ queryKey: ["eventos", eventId] });
    queryClient.invalidateQueries({ queryKey: ["agenda"] });
  }

  function handleVolver() {
    if (location.state?.from) navigate(location.state.from);
    else navigate("/eventos");
  }

  const deleteMutation = useMutation({
    mutationFn: async () => api.delete(`/eventos/${eventId}`),
    onSuccess: () => {
      enqueueSnackbar("Evento eliminado correctamente", { variant: "success" });
      setConfirmDeleteOpen(false);
      invalidateEvento();
      navigate("/eventos");
    },
    onError: (error) => enqueueSnackbar(getApiError(error, "No se pudo eliminar el evento"), { variant: "error" }),
  });

  const panelSx = {
    border: "1px solid",
    borderColor: "divider",
    borderRadius: "16px",
    boxShadow: "none",
    bgcolor: "background.paper",
  };

  if (eventoQuery.isLoading) {
    return <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}><CircularProgress /></Box>;
  }

  if (eventoQuery.isError || !event) {
    return (
      <Paper elevation={0} sx={{ ...panelSx, p: 4, textAlign: "center" }}>
        <Typography variant="h6" sx={{ fontWeight: 900 }}>No pudimos cargar el evento</Typography>
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
              {tipo && <Chip label={tipo.nombre} variant="outlined" sx={{ fontWeight: 900 }} />}
              {estado && <Chip label={estado.nombre} color="info" sx={{ fontWeight: 900 }} />}
            </Stack>
            <Typography variant="h4" sx={{ fontWeight: 950, letterSpacing: 0, color: "text.primary" }}>
              {event.descripcion}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1.5}>
            {canEditar && (
              <Button variant="outlined" startIcon={<Edit />} onClick={() => navigate(`/eventos/editar/${eventId}`)} sx={{ borderRadius: "10px", fontWeight: 900 }}>
                Editar
              </Button>
            )}
            {canEliminar && (
              <Button variant="outlined" color="error" startIcon={<Delete />} onClick={() => setConfirmDeleteOpen(true)} sx={{ borderRadius: "10px", fontWeight: 900 }}>
                Eliminar
              </Button>
            )}
          </Stack>
        </Stack>
      </Paper>

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper elevation={0} sx={{ ...panelSx, p: { xs: 2, md: 3 }, height: "100%" }}>
            <Stack spacing={2.5}>
              <Typography variant="subtitle1" sx={{ fontWeight: 900, color: "primary.main" }}>Información General</Typography>
              <Divider />
              {event.observaciones && (
                <Box>
                  <Typography variant="caption" sx={{ color: "text.disabled", fontWeight: 900, textTransform: "uppercase" }}>Observaciones</Typography>
                  <Typography variant="body2" sx={{ mt: 0.75, whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{event.observaciones}</Typography>
                </Box>
              )}
              <InfoLine icon={<CalendarToday />} label="Fecha de inicio" value={formatDateTime(event.fechaInicio)} />
              {event.fechaFin && <InfoLine icon={<CalendarToday />} label="Fecha de finalización" value={formatDateTime(event.fechaFin)} />}
              {event.ubicacion && <InfoLine icon={<LocationOn />} label="Ubicación" value={event.ubicacion} />}
              {event.recordatorio && <InfoLine icon={<NotificationsActive />} label="Recordatorio" value={formatDateTime(event.recordatorio)} />}
              <Divider />
              <Stack spacing={0.5}>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>Creado el {formatDateTime(event.createdAt)}</Typography>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>Última modificación el {formatDateTime(event.updatedAt)}</Typography>
              </Stack>
            </Stack>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Stack spacing={2.5} sx={{ height: "100%" }}>
            <Paper elevation={0} sx={{ ...panelSx, p: { xs: 2, md: 3 }, flex: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 900, color: "primary.main", mb: 2 }}>Cliente Vinculado</Typography>
              {cliente ? (
                <Stack spacing={2}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Avatar sx={{ bgcolor: "primary.main", color: "primary.contrastText", fontWeight: 900 }}>
                      {clienteLabel(cliente)[0]?.toUpperCase() || "C"}
                    </Avatar>
                    <Box>
                      <Typography variant="body1" sx={{ fontWeight: 900 }}>{clienteLabel(cliente)}</Typography>
                      <Typography variant="caption" sx={{ color: "text.secondary" }}>{cliente.cuitCuil || "Sin CUIT/CUIL"}</Typography>
                    </Box>
                  </Stack>
                  <Button component={RouterLink} to={`/clientes/${cliente.id}`} state={{ from: currentPath }} variant="outlined" size="small" sx={{ borderRadius: "8px", fontWeight: 900, alignSelf: "flex-start" }}>
                    Ir a la Ficha del Cliente
                  </Button>
                </Stack>
              ) : (
                <Typography variant="body2" sx={{ color: "text.secondary" }}>Este evento no está vinculado a ningún cliente.</Typography>
              )}
            </Paper>

            <Paper elevation={0} sx={{ ...panelSx, p: { xs: 2, md: 3 }, flex: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 900, color: "primary.main", mb: 2 }}>Expediente / Caso Vinculado</Typography>
              {caso ? (
                <Stack spacing={2}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Avatar sx={{ bgcolor: "secondary.main", color: "secondary.contrastText", fontWeight: 900 }}>
                      <FolderOpen />
                    </Avatar>
                    <Box>
                      <Typography variant="body1" sx={{ fontWeight: 900 }}>{casoLabel(caso)}</Typography>
                      <Typography variant="caption" sx={{ color: "text.secondary" }}>{caso.nroExpte || "Sin número de expediente"}</Typography>
                    </Box>
                  </Stack>
                  <Button component={RouterLink} to={`/expedientes/${caso.id}`} state={{ from: currentPath }} variant="outlined" size="small" sx={{ borderRadius: "8px", fontWeight: 900, alignSelf: "flex-start" }}>
                    Ir al Expediente
                  </Button>
                </Stack>
              ) : (
                <Typography variant="body2" sx={{ color: "text.secondary" }}>Este evento no está vinculado a ningún expediente.</Typography>
              )}
            </Paper>
          </Stack>
        </Grid>
      </Grid>

      <Dialog open={confirmDeleteOpen} onClose={() => !deleteMutation.isPending && setConfirmDeleteOpen(false)} PaperProps={{ sx: { borderRadius: "16px", p: 1, width: "100%", maxWidth: 420 } }}>
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Avatar sx={{ bgcolor: alpha("#EF4444", 0.12), color: "#EF4444" }}><WarningAmber /></Avatar>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 900 }}>Eliminar evento</Typography>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>Esta acción no se puede deshacer</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "text.secondary", lineHeight: 1.7 }}>
            ¿Seguro que querés eliminar permanentemente el evento <Box component="span" sx={{ color: "text.primary", fontWeight: 900 }}>{event.descripcion}</Box>?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button variant="outlined" onClick={() => setConfirmDeleteOpen(false)} disabled={deleteMutation.isPending} sx={{ borderRadius: "10px", fontWeight: 800 }}>Cancelar</Button>
          <Button variant="contained" color="error" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending} sx={{ borderRadius: "10px", fontWeight: 900 }}>
            {deleteMutation.isPending ? <CircularProgress size={20} color="inherit" /> : "Sí, eliminar"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function InfoLine({ icon, label, value }) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="center">
      <Avatar sx={{ width: 34, height: 34, bgcolor: "action.hover", color: "text.secondary" }}>{icon}</Avatar>
      <Box>
        <Typography variant="caption" sx={{ display: "block", color: "text.disabled", fontWeight: 900, textTransform: "uppercase" }}>{label}</Typography>
        <Typography variant="body2" sx={{ fontWeight: 800 }}>{value}</Typography>
      </Box>
    </Stack>
  );
}
