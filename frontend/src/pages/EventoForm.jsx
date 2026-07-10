import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { es } from "date-fns/locale/es";
import api from "../api/axios";
import { fetchAllPages } from "../api/pagination";
import {
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { ArrowBack, AttachFile, Save } from "@mui/icons-material";
import { casoLabel, clienteLabel, getApiError, unwrapData, unwrapEntity } from "./tareasUtils";

const EMPTY_FORM = {
  casoId: "",
  clienteId: "",
  fechaInicio: null,
  fechaFin: null,
  allDay: false,
  tipoId: "",
  estadoId: "",
  descripcion: "",
  observaciones: "",
  ubicacion: "",
  recordatorio: null,
};

function dateOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function nullableNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toIsoOrNull(value) {
  if (!value) return null;
  return value.toISOString();
}

function eventoToForm(evento) {
  return {
    casoId: evento?.casoId ?? "",
    clienteId: evento?.clienteId ?? "",
    fechaInicio: dateOrNull(evento?.fechaInicio),
    fechaFin: dateOrNull(evento?.fechaFin),
    allDay: Boolean(evento?.allDay),
    tipoId: evento?.tipoId ?? "",
    estadoId: evento?.estadoId ?? "",
    descripcion: evento?.descripcion ?? "",
    observaciones: evento?.observaciones ?? "",
    ubicacion: evento?.ubicacion ?? "",
    recordatorio: dateOrNull(evento?.recordatorio),
  };
}

function buildPayload(form) {
  return {
    casoId: nullableNumber(form.casoId),
    clienteId: nullableNumber(form.clienteId),
    fechaInicio: form.fechaInicio?.toISOString(),
    fechaFin: toIsoOrNull(form.fechaFin),
    allDay: Boolean(form.allDay),
    tipoId: nullableNumber(form.tipoId),
    estadoId: nullableNumber(form.estadoId),
    descripcion: form.descripcion.trim(),
    observaciones: form.observaciones.trim() || null,
    ubicacion: form.ubicacion.trim() || null,
    recordatorio: toIsoOrNull(form.recordatorio),
  };
}

export default function EventoForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});

  const eventoQuery = useQuery({
    queryKey: ["eventos", id],
    enabled: isEdit,
    queryFn: async () => {
      const { data } = await api.get(`/eventos/${id}`);
      return unwrapEntity(data);
    },
  });

  const clientesQuery = useQuery({
    queryKey: ["clientes", "autocomplete"],
    queryFn: () => fetchAllPages("/clientes"),
    staleTime: 1000 * 60 * 5,
  });

  const expedientesQuery = useQuery({
    queryKey: ["expedientes", "autocomplete"],
    queryFn: () => fetchAllPages("/expedientes"),
    staleTime: 1000 * 60 * 5,
  });

  const useCatalogQuery = (categoria) => useQuery({
    queryKey: ["catalogos", "parametros", categoria],
    queryFn: async () => {
      const { data } = await api.get("/catalogos/parametros", { params: { categoria } });
      return unwrapData(data);
    },
    staleTime: 1000 * 60 * 30,
  });

  const tiposQuery = useCatalogQuery("TIPO_EVENTO");
  const estadosQuery = useCatalogQuery("ESTADO_EVENTO");

  const tipos = useMemo(() => tiposQuery.data ?? [], [tiposQuery.data]);
  const estados = useMemo(() => estadosQuery.data ?? [], [estadosQuery.data]);

  useEffect(() => {
    if (isEdit && eventoQuery.data) {
      setForm(eventoToForm(eventoQuery.data));
      return;
    }

    if (!isEdit) {
      setForm({
        ...EMPTY_FORM,
        clienteId: searchParams.get("clienteId") || "",
        casoId: searchParams.get("casoId") || "",
        fechaInicio: dateOrNull(searchParams.get("fechaInicio")) ?? new Date(),
        fechaFin: null,
      });
    }
  }, [eventoQuery.data, isEdit, searchParams]);

  const selectedCliente = (clientesQuery.data ?? []).find((cliente) => Number(cliente.id) === Number(form.clienteId)) ?? null;
  const filteredExpedientes = useMemo(() => {
    const expedientes = expedientesQuery.data ?? [];
    if (!form.clienteId) return expedientes;
    return expedientes.filter((caso) => Number(caso.clienteId) === Number(form.clienteId));
  }, [expedientesQuery.data, form.clienteId]);
  const selectedCaso = (expedientesQuery.data ?? []).find((caso) => Number(caso.id) === Number(form.casoId)) ?? null;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = buildPayload(form);
      if (isEdit) {
        const { data } = await api.put(`/eventos/${id}`, payload);
        return unwrapEntity(data);
      }
      const { data } = await api.post("/eventos", payload);
      return unwrapEntity(data);
    },
    onSuccess: () => {
      enqueueSnackbar(isEdit ? "Evento actualizado correctamente" : "Evento creado correctamente", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["agenda"] });
      queryClient.invalidateQueries({ queryKey: ["eventos"] });
      navigateBack();
    },
    onError: (error) => enqueueSnackbar(getApiError(error, "No se pudo guardar el evento"), { variant: "error" }),
  });

  function navigateBack() {
    const fromQuery = searchParams.get("from");
    const fromState = location.state?.from;
    if (fromState) navigate(fromState);
    else if (fromQuery === "agenda") navigate("/agenda");
    else navigate(-1);
  }

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
  }

  function validate() {
    const nextErrors = {};
    if (!form.descripcion.trim() || form.descripcion.trim().length < 3) nextErrors.descripcion = "La descripción es requerida";
    if (!form.fechaInicio) nextErrors.fechaInicio = "Seleccioná una fecha de inicio";
    if (!form.tipoId) nextErrors.tipoId = "Seleccioná un tipo de evento";
    if (form.fechaInicio && form.fechaFin && form.fechaFin <= form.fechaInicio) nextErrors.fechaFin = "La fecha de fin debe ser posterior a la fecha de inicio";
    if (form.fechaInicio && form.recordatorio && form.recordatorio > form.fechaInicio) nextErrors.recordatorio = "El recordatorio debe ser anterior o igual al inicio";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!validate()) return;
    saveMutation.mutate();
  }

  if (isEdit && eventoQuery.isLoading) {
    return <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}><CircularProgress /></Box>;
  }

  if (isEdit && (eventoQuery.isError || !eventoQuery.data)) {
    return (
      <Paper
        elevation={0}
        sx={{
          borderRadius: "16px",
          border: "1px solid",
          borderColor: "divider",
          p: 4,
          textAlign: "center",
          bgcolor: "background.paper",
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 900 }}>No pudimos cargar el evento</Typography>
        <Button onClick={() => navigate("/eventos")} sx={{ mt: 2 }}>Volver</Button>
      </Paper>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={es}>
      <Box component="form" onSubmit={handleSubmit}>
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
          <Button startIcon={<ArrowBack />} onClick={navigateBack} sx={{ alignSelf: "flex-start", fontWeight: 800 }}>
            Volver
          </Button>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>{isEdit ? "Editar Evento" : "Registrar Evento"}</Typography>
        </Stack>

        <Paper elevation={0} sx={{ borderRadius: "16px", border: "1px solid", borderColor: "divider", p: { xs: 2, md: 3 } }}>
          <Typography variant="subtitle1" sx={{ color: "primary.main", fontWeight: 900, mb: 1 }}>Datos del Evento</Typography>
          <Divider sx={{ mb: 2.5 }} />
          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth required size="small" label="Descripción" value={form.descripcion} onChange={(event) => setField("descripcion", event.target.value)} error={Boolean(errors.descripcion)} helperText={errors.descripcion} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <DateTimePicker
                label="Fecha de inicio"
                value={form.fechaInicio}
                onChange={(value) => setField("fechaInicio", value)}
                slotProps={{ textField: { fullWidth: true, size: "small", error: Boolean(errors.fechaInicio), helperText: errors.fechaInicio } }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <DateTimePicker
                label="Fecha de fin"
                value={form.fechaFin}
                onChange={(value) => setField("fechaFin", value)}
                slotProps={{ textField: { fullWidth: true, size: "small", error: Boolean(errors.fechaFin), helperText: errors.fechaFin } }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <DateTimePicker
                label="Recordatorio"
                value={form.recordatorio}
                onChange={(value) => setField("recordatorio", value)}
                slotProps={{ textField: { fullWidth: true, size: "small", error: Boolean(errors.recordatorio), helperText: errors.recordatorio } }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormControlLabel control={<Switch checked={form.allDay} onChange={(event) => setField("allDay", event.target.checked)} />} label="Todo el día" />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth size="small" error={Boolean(errors.tipoId)}>
                <InputLabel>Tipo de Evento</InputLabel>
                <Select label="Tipo de Evento" value={form.tipoId} onChange={(event) => setField("tipoId", event.target.value)}>
                  <MenuItem value="">Seleccionar</MenuItem>
                  {tipos.map((tipo) => <MenuItem key={tipo.id} value={tipo.id}>{tipo.nombre}</MenuItem>)}
                </Select>
                {errors.tipoId && <Typography variant="caption" sx={{ color: "error.main", mt: 0.5, ml: 1.75 }}>{errors.tipoId}</Typography>}
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Estado</InputLabel>
                <Select label="Estado" value={form.estadoId} onChange={(event) => setField("estadoId", event.target.value)}>
                  <MenuItem value="">Sin estado</MenuItem>
                  {estados.map((estado) => <MenuItem key={estado.id} value={estado.id}>{estado.nombre}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Autocomplete
                options={clientesQuery.data ?? []}
                value={selectedCliente}
                loading={clientesQuery.isLoading}
                getOptionLabel={clienteLabel}
                onChange={(_, value) => setForm((current) => ({ ...current, clienteId: value?.id ?? "", casoId: "" }))}
                renderInput={(params) => <TextField {...params} size="small" label="Cliente" />}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Autocomplete
                options={filteredExpedientes}
                value={selectedCaso}
                loading={expedientesQuery.isLoading}
                getOptionLabel={casoLabel}
                onChange={(_, value) => setForm((current) => ({ ...current, casoId: value?.id ?? "", clienteId: current.clienteId || value?.clienteId || "" }))}
                renderInput={(params) => <TextField {...params} size="small" label="Expediente / Caso" />}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField fullWidth size="small" label="Ubicación" value={form.ubicacion} onChange={(event) => setField("ubicacion", event.target.value)} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Button component="label" variant="outlined" startIcon={<AttachFile />} sx={{ borderRadius: "10px", fontWeight: 800, height: 40 }}>
                Adjuntar archivo
                <input hidden type="file" />
              </Button>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth multiline minRows={4} size="small" label="Observaciones" value={form.observaciones} onChange={(event) => setField("observaciones", event.target.value)} />
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} justifyContent="flex-end">
            <Button variant="outlined" onClick={navigateBack} disabled={saveMutation.isPending} sx={{ borderRadius: "10px", fontWeight: 800 }}>
              Cancelar
            </Button>
            <Button type="submit" variant="contained" startIcon={!saveMutation.isPending ? <Save /> : null} disabled={saveMutation.isPending} sx={{ borderRadius: "10px", fontWeight: 900 }}>
              {saveMutation.isPending ? <CircularProgress size={20} color="inherit" /> : isEdit ? "Guardar Cambios" : "Crear Evento"}
            </Button>
          </Stack>
        </Paper>
      </Box>
    </LocalizationProvider>
  );
}
