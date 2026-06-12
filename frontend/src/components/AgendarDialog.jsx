import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import dayjs from "dayjs";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { AssignmentTurnedIn, Event as EventIcon } from "@mui/icons-material";
import api from "../api/axios";

function normalizeCode(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "_")
    .toUpperCase();
}

// Título sugerido a partir de la novedad SISFE (acotado para no pasar el largo del backend).
function tituloSugerido(novedad) {
  const base = (novedad?.novedad || novedad?.tipo || "Movimiento judicial").trim();
  return base.length > 120 ? base.slice(0, 120) : base;
}

function contextoExpediente(novedad) {
  if (!novedad) return "";
  const detalle = novedad.descripcion || novedad.caratula || `Expediente #${novedad.casoId}`;
  return novedad.nroExpte ? `Expte: ${novedad.nroExpte} — ${detalle}` : detalle;
}

/**
 * Popover de "Agendar" desde una novedad de expediente: crea una tarea (con fecha límite y
 * recordatorio) o un evento (audiencia, vencimiento, etc.) ya vinculado al caso, sin salir
 * del dashboard. Al guardar, marca la novedad como leída via onCreated.
 */
export default function AgendarDialog({ open, modo, novedad, onClose, onCreated }) {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const esEvento = modo === "evento";

  const [titulo, setTitulo] = useState("");
  const [fecha, setFecha] = useState("");
  const [recordatorio, setRecordatorio] = useState("");
  const [tipoId, setTipoId] = useState("");
  const [error, setError] = useState("");

  // Catálogos solo para eventos (tipo + estado por defecto).
  const tiposQuery = useQuery({
    queryKey: ["catalogos", "parametros", "TIPO_EVENTO"],
    enabled: open && esEvento,
    queryFn: async () => {
      const { data } = await api.get("/catalogos/parametros", { params: { categoria: "TIPO_EVENTO" } });
      return data?.data ?? data ?? [];
    },
    staleTime: 1000 * 60 * 30,
  });

  const estadosQuery = useQuery({
    queryKey: ["catalogos", "parametros", "ESTADO_EVENTO"],
    enabled: open && esEvento,
    queryFn: async () => {
      const { data } = await api.get("/catalogos/parametros", { params: { categoria: "ESTADO_EVENTO" } });
      return data?.data ?? data ?? [];
    },
    staleTime: 1000 * 60 * 30,
  });

  const tipos = tiposQuery.data ?? [];
  const estadoPendienteId = useMemo(() => {
    const found = (estadosQuery.data ?? []).find((e) => normalizeCode(e.codigo) === "PENDIENTE");
    return found?.id ?? null;
  }, [estadosQuery.data]);

  // Reinicializar el formulario cada vez que se abre con una novedad/modo.
  useEffect(() => {
    if (!open) return;
    setTitulo(tituloSugerido(novedad));
    setFecha("");
    setRecordatorio("");
    setTipoId("");
    setError("");
  }, [open, modo, novedad]);

  const createMutation = useMutation({
    mutationFn: async (payload) => {
      const endpoint = esEvento ? "/eventos" : "/tareas";
      const { data } = await api.post(endpoint, payload);
      return data;
    },
    onSuccess: () => {
      enqueueSnackbar(esEvento ? "Evento creado y vinculado al expediente" : "Tarea creada y vinculada al expediente", {
        variant: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["tareas"] });
      queryClient.invalidateQueries({ queryKey: ["eventos"] });
      queryClient.invalidateQueries({ queryKey: ["agenda"] });
      onCreated?.(novedad);
      onClose?.();
    },
    onError: (err) => {
      const msg = err?.response?.data?.error?.message || "No se pudo guardar. Revisá los datos.";
      setError(msg);
    },
  });

  const handleGuardar = () => {
    setError("");
    const tituloLimpio = titulo.trim();
    if (tituloLimpio.length < 3) {
      setError("El título debe tener al menos 3 caracteres.");
      return;
    }
    if (!fecha) {
      setError(esEvento ? "Indicá la fecha del evento." : "Indicá la fecha límite.");
      return;
    }
    const fechaIso = dayjs(fecha).toISOString();
    const recordatorioIso = recordatorio ? dayjs(recordatorio).toISOString() : null;

    if (recordatorioIso && dayjs(recordatorioIso).isAfter(fechaIso)) {
      setError(esEvento
        ? "El recordatorio debe ser anterior o igual a la fecha del evento."
        : "El recordatorio debe ser anterior a la fecha límite.");
      return;
    }

    if (esEvento) {
      if (!tipoId) {
        setError("Elegí el tipo de evento.");
        return;
      }
      createMutation.mutate({
        descripcion: tituloLimpio,
        fechaInicio: fechaIso,
        tipoId: Number(tipoId),
        estadoId: estadoPendienteId,
        recordatorio: recordatorioIso,
        casoId: novedad?.casoId ?? null,
      });
    } else {
      if (!dayjs(fecha).isAfter(dayjs().startOf("day").subtract(1, "second"))) {
        setError("La fecha límite no puede estar en el pasado.");
        return;
      }
      createMutation.mutate({
        titulo: tituloLimpio,
        descripcion: novedad?.novedad || null,
        fechaLimite: fechaIso,
        recordatorio: recordatorioIso,
        casoId: novedad?.casoId ?? null,
      });
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, fontWeight: 800 }}>
        {esEvento ? <EventIcon color="primary" /> : <AssignmentTurnedIn color="primary" />}
        {esEvento ? "Nuevo evento" : "Nueva tarea"}
      </DialogTitle>
      <DialogContent>
        <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 2 }}>
          {contextoExpediente(novedad)}
        </Typography>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <TextField
            label={esEvento ? "Descripción del evento" : "Título de la tarea"}
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            size="small"
            fullWidth
            autoFocus
          />
          {esEvento && (
            <TextField
              select
              label="Tipo de evento"
              value={tipoId}
              onChange={(e) => setTipoId(e.target.value)}
              size="small"
              fullWidth
            >
              <MenuItem value="">Seleccionar</MenuItem>
              {tipos.map((t) => (
                <MenuItem key={t.id} value={t.id}>{t.nombre}</MenuItem>
              ))}
            </TextField>
          )}
          <TextField
            label={esEvento ? "Fecha y hora del evento" : "Fecha límite"}
            type="datetime-local"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            size="small"
            fullWidth
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Recordatorio (opcional)"
            type="datetime-local"
            value={recordatorio}
            onChange={(e) => setRecordatorio(e.target.value)}
            size="small"
            fullWidth
            InputLabelProps={{ shrink: true }}
            helperText="Cuándo querés que te avise"
          />
          {error && (
            <Box sx={{ color: "error.main", fontSize: "0.8rem", fontWeight: 600 }}>{error}</Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={createMutation.isPending}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={handleGuardar} disabled={createMutation.isPending}>
          {createMutation.isPending ? "Guardando…" : "Guardar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
