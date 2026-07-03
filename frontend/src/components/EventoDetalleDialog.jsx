import { useMemo } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { alpha } from "@mui/material/styles";
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
  IconButton,
  Link,
  Stack,
  Typography,
} from "@mui/material";
import {
  AccessTime,
  CalendarToday,
  CheckCircle,
  Close,
  Edit,
  FolderOpen,
  LocationOn,
  NotificationsActive,
  OpenInNew,
  Person,
} from "@mui/icons-material";
import api from "../api/axios";
import { fetchAllPages } from "../api/pagination";
import { usePermisos } from "../auth/usePermissions";
import {
  casoLabel,
  clienteLabel,
  formatDateTime,
  formatFriendlyDate,
  getApiError,
  unwrapData,
  unwrapEntity,
} from "../pages/tareasUtils";

const EVENTO_TONE = "#7C5CFC";

function normalizeCode(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "_")
    .toUpperCase();
}

// Campo compacto de metadato (mismo lenguaje que TareaDetalleDialog).
function MetaField({ icon, label, value }) {
  return (
    <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ minWidth: 0 }}>
      <Box sx={{ color: "text.disabled", mt: "1px", display: "flex", flexShrink: 0 }}>{icon}</Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" sx={{ display: "block", color: "text.disabled", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", lineHeight: 1.3 }}>
          {label}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.35, wordBreak: "break-word" }}>
          {value}
        </Typography>
      </Box>
    </Stack>
  );
}

function LinkRow({ icon, label, value, to }) {
  const inner = (
    <Stack
      direction="row"
      spacing={1.25}
      alignItems="center"
      sx={{
        p: 1,
        borderRadius: "10px",
        border: "1px solid",
        borderColor: "divider",
        transition: "border-color 0.15s ease, background-color 0.15s ease",
        ...(to && { "&:hover": { borderColor: "primary.main", bgcolor: "action.hover" } }),
      }}
    >
      <Avatar sx={{ width: 30, height: 30, bgcolor: "action.hover", color: "text.secondary" }}>{icon}</Avatar>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" sx={{ display: "block", color: "text.disabled", fontWeight: 800, textTransform: "uppercase", lineHeight: 1.2 }}>
          {label}
        </Typography>
        <Typography variant="body2" noWrap sx={{ fontWeight: 700, color: to ? "primary.main" : "text.secondary" }}>
          {value}
        </Typography>
      </Box>
    </Stack>
  );

  return to ? (
    <Link component={RouterLink} to={to} sx={{ textDecoration: "none", display: "block" }}>
      {inner}
    </Link>
  ) : (
    inner
  );
}

export default function EventoDetalleDialog({ open, eventoId, onClose }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { canEditar } = usePermisos("EVENTOS");

  const eventoQuery = useQuery({
    queryKey: ["eventos", eventoId],
    enabled: open && Boolean(eventoId),
    queryFn: async () => {
      const { data } = await api.get(`/eventos/${eventoId}`);
      return unwrapEntity(data);
    },
  });

  const tiposQuery = useQuery({
    queryKey: ["catalogos", "parametros", "TIPO_EVENTO"],
    enabled: open,
    queryFn: async () => {
      const { data } = await api.get("/catalogos/parametros", { params: { categoria: "TIPO_EVENTO" } });
      return unwrapData(data);
    },
    staleTime: 1000 * 60 * 30,
  });

  const estadosQuery = useQuery({
    queryKey: ["catalogos", "parametros", "ESTADO_EVENTO"],
    enabled: open,
    queryFn: async () => {
      const { data } = await api.get("/catalogos/parametros", { params: { categoria: "ESTADO_EVENTO" } });
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

  const event = eventoQuery.data;
  const estados = estadosQuery.data ?? [];
  const tiposById = useMemo(() => new Map((tiposQuery.data ?? []).map((p) => [Number(p.id), p])), [tiposQuery.data]);
  const clientesById = useMemo(() => new Map((clientesQuery.data ?? []).map((c) => [Number(c.id), c])), [clientesQuery.data]);
  const expedientesById = useMemo(() => new Map((expedientesQuery.data ?? []).map((c) => [Number(c.id), c])), [expedientesQuery.data]);

  const tipo = tiposById.get(Number(event?.tipoId));
  const estado = estados.find((e) => Number(e.id) === Number(event?.estadoId));
  const cliente = clientesById.get(Number(event?.clienteId));
  const caso = expedientesById.get(Number(event?.casoId));

  const realizadoEstadoId = estados.find((e) => normalizeCode(e.codigo) === "REALIZADO")?.id ?? null;
  const pendienteEstadoId = estados.find((e) => normalizeCode(e.codigo) === "PENDIENTE")?.id ?? null;
  const isRealizado = realizadoEstadoId != null && Number(event?.estadoId) === realizadoEstadoId;
  const eventoPaso = event?.fechaInicio && new Date(event.fechaInicio).getTime() < Date.now();

  const titulo = event?.descripcion || tipo?.nombre || "Evento";

  function invalidateEvento() {
    queryClient.invalidateQueries({ queryKey: ["eventos"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["agenda"] });
  }

  const toggleEstadoMutation = useMutation({
    mutationFn: async () => {
      const nextEstadoId = isRealizado ? pendienteEstadoId : realizadoEstadoId;
      const { data } = await api.put(`/eventos/${eventoId}`, { estadoId: nextEstadoId });
      return unwrapEntity(data);
    },
    onSuccess: () => {
      enqueueSnackbar(isRealizado ? "Evento marcado como pendiente" : "Evento marcado como realizado", { variant: "success" });
      invalidateEvento();
    },
    onError: (error) => enqueueSnackbar(getApiError(error, "No se pudo actualizar el evento"), { variant: "error" }),
  });

  function goToFullPage() {
    onClose();
    navigate(`/eventos/${eventoId}`);
  }

  const canToggleEstado = realizadoEstadoId != null && pendienteEstadoId != null;
  const fechaInicioLabel = event?.allDay
    ? `${formatFriendlyDate(event.fechaInicio)} · Todo el día`
    : formatDateTime(event?.fechaInicio);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      scroll="paper"
      PaperProps={{ sx: { borderRadius: "18px", overflow: "hidden" } }}
    >
      <Box sx={{ height: 4, bgcolor: EVENTO_TONE, flexShrink: 0 }} />

      <DialogTitle component="div" sx={{ pr: 6, pt: 2, pb: 1.5 }}>
        <IconButton onClick={onClose} sx={{ position: "absolute", right: 12, top: 14 }} aria-label="Cerrar">
          <Close />
        </IconButton>
        <Typography variant="overline" sx={{ color: "text.secondary", fontWeight: 800, letterSpacing: "0.1em" }}>
          Detalle de evento
        </Typography>
        {event && (
          <>
            <Typography variant="h6" sx={{ fontWeight: 900, lineHeight: 1.3, mt: 0.25, wordBreak: "break-word" }}>
              {titulo}
            </Typography>
            <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
              {tipo && (
                <Chip
                  label={tipo.nombre}
                  size="small"
                  sx={{ bgcolor: alpha(EVENTO_TONE, 0.12), color: EVENTO_TONE, border: "1px solid", borderColor: alpha(EVENTO_TONE, 0.3), fontWeight: 800, height: 22 }}
                />
              )}
              {estado && (
                <Chip
                  icon={<CheckCircle sx={{ fontSize: "14px !important" }} />}
                  label={estado.nombre}
                  size="small"
                  color={isRealizado ? "success" : "warning"}
                  sx={{ fontWeight: 800, height: 22 }}
                />
              )}
            </Stack>
          </>
        )}
      </DialogTitle>

      <DialogContent dividers sx={{ px: { xs: 2, sm: 2.5 }, py: 2 }}>
        {eventoQuery.isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
            <CircularProgress size={28} />
          </Box>
        ) : eventoQuery.isError || !event ? (
          <Typography sx={{ color: "text.secondary", py: 4, textAlign: "center" }}>
            No pudimos cargar el evento.
          </Typography>
        ) : (
          <Stack spacing={2.25}>
            {event.observaciones && (
              <Box sx={{ p: 1.5, borderRadius: "12px", bgcolor: "action.hover" }}>
                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", lineHeight: 1.65, color: "text.secondary" }}>
                  {event.observaciones}
                </Typography>
              </Box>
            )}

            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.75 }}>
              <MetaField icon={<CalendarToday sx={{ fontSize: 18 }} />} label="Inicio" value={fechaInicioLabel} />
              {event.fechaFin && (
                <MetaField icon={<AccessTime sx={{ fontSize: 18 }} />} label="Fin" value={formatDateTime(event.fechaFin)} />
              )}
              {event.ubicacion && (
                <MetaField icon={<LocationOn sx={{ fontSize: 18 }} />} label="Ubicación" value={event.ubicacion} />
              )}
              {event.recordatorio && (
                <MetaField icon={<NotificationsActive sx={{ fontSize: 18 }} />} label="Recordatorio" value={formatDateTime(event.recordatorio)} />
              )}
            </Box>

            <Stack spacing={1}>
              <LinkRow
                icon={<Person sx={{ fontSize: 16 }} />}
                label="Cliente"
                value={cliente ? clienteLabel(cliente) : "Sin cliente"}
                to={cliente ? `/clientes/${cliente.id}` : undefined}
              />
              <LinkRow
                icon={<FolderOpen sx={{ fontSize: 16 }} />}
                label="Expediente"
                value={caso ? casoLabel(caso) : "Sin expediente"}
                to={caso ? `/expedientes/${caso.id}` : undefined}
              />
            </Stack>
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2.5, py: 1.75, gap: 1, flexWrap: "wrap" }}>
        {event && canToggleEstado && eventoPaso && (
          <Button
            variant={isRealizado ? "outlined" : "contained"}
            color="success"
            startIcon={<CheckCircle />}
            onClick={() => toggleEstadoMutation.mutate()}
            disabled={toggleEstadoMutation.isPending}
            sx={{ borderRadius: "10px", fontWeight: 800 }}
          >
            {isRealizado ? "Marcar pendiente" : "Marcar realizado"}
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        {canEditar && event && (
          <Button
            variant="text"
            startIcon={<Edit />}
            onClick={() => {
              onClose();
              navigate(`/eventos/editar/${eventoId}`);
            }}
            sx={{ borderRadius: "10px", fontWeight: 800 }}
          >
            Editar
          </Button>
        )}
        <Button
          variant="outlined"
          endIcon={<OpenInNew />}
          onClick={goToFullPage}
          disabled={!event}
          sx={{ borderRadius: "10px", fontWeight: 800 }}
        >
          Ficha completa
        </Button>
      </DialogActions>
    </Dialog>
  );
}
