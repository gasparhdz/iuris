import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams, useLocation } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import api from "../api/axios";
import { useAuth } from "../auth/AuthContext";
import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { Add, ArrowBack, CheckCircle, Delete, Edit, Save } from "@mui/icons-material";
import {
  buildTareaPayload,
  casoLabel,
  clienteLabel,
  EMPTY_TAREA_FORM,
  getApiError,
  tareaToForm,
  unwrapData,
  unwrapEntity,
  unwrapItems,
} from "./tareasUtils";

function formatQueryDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function TareaForm() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuth();
  const currentUserId = user?.id ?? user?.userId ?? 1;
  const [form, setForm] = useState({ ...EMPTY_TAREA_FORM, asignadoA: currentUserId });
  const [errors, setErrors] = useState({});
  const [newInitialItem, setNewInitialItem] = useState("");
  const [newEditItem, setNewEditItem] = useState("");

  function navigateBack() {
    const fromQuery = searchParams.get("from");
    const fromState = location.state?.from;
    if (fromState) navigate(fromState);
    else if (fromQuery === "agenda") navigate("/agenda");
    else navigate(-1);
  }

  const tareaQuery = useQuery({
    queryKey: ["tareas", id],
    enabled: isEdit,
    queryFn: async () => {
      const { data } = await api.get(`/tareas/${id}`);
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
    queryKey: ["clientes", "autocomplete"],
    queryFn: async () => {
      const { data } = await api.get("/clientes", { params: { limit: 100 } });
      return unwrapItems(data);
    },
    staleTime: 1000 * 60 * 5,
  });

  const expedientesQuery = useQuery({
    queryKey: ["expedientes", "autocomplete"],
    queryFn: async () => {
      const { data } = await api.get("/expedientes", { params: { limit: 100 } });
      return unwrapItems(data);
    },
    staleTime: 1000 * 60 * 5,
  });

  const teamOptions = useMemo(() => {
    const currentLabel = [user?.nombre, user?.apellido].filter(Boolean).join(" ") || user?.email || "Usuario actual";
    return [
      { id: currentUserId, nombre: currentLabel },
      { id: 2, nombre: "Dr. Gaspar Hernández" },
      { id: 3, nombre: "Dra. Sofía Meotto" },
    ].filter((item, index, arr) => arr.findIndex((other) => Number(other.id) === Number(item.id)) === index);
  }, [currentUserId, user]);

  useEffect(() => {
    if (isEdit && tareaQuery.data) {
      setForm(tareaToForm(tareaQuery.data, currentUserId));
    } else if (!isEdit) {
      setForm((current) => ({
        ...current,
        asignadoA: current.asignadoA || currentUserId,
        fechaLimite: current.fechaLimite || formatQueryDateTime(searchParams.get("fechaLimite")),
      }));
    }
  }, [currentUserId, isEdit, searchParams, tareaQuery.data]);

  const selectedCliente = (clientesQuery.data ?? []).find((cliente) => Number(cliente.id) === Number(form.clienteId)) ?? null;
  const filteredExpedientes = useMemo(() => {
    const expedientes = expedientesQuery.data ?? [];
    if (!form.clienteId) return expedientes;
    return expedientes.filter((caso) => Number(caso.clienteId) === Number(form.clienteId));
  }, [expedientesQuery.data, form.clienteId]);
  const selectedCaso = (expedientesQuery.data ?? []).find((caso) => Number(caso.id) === Number(form.casoId)) ?? null;

  function invalidateTarea() {
    queryClient.invalidateQueries({ queryKey: ["tareas"] });
    queryClient.invalidateQueries({ queryKey: ["tareas", id] });
    queryClient.invalidateQueries({ queryKey: ["agenda"] });
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isEdit) {
        const { data } = await api.put(`/tareas/${id}`, buildTareaPayload(form, { includeCompleted: true }));
        return unwrapEntity(data);
      }
      const { data } = await api.post("/tareas", buildTareaPayload(form, { includeItems: true }));
      return unwrapEntity(data);
    },
    onSuccess: (saved) => {
      enqueueSnackbar(isEdit ? "Tarea actualizada correctamente" : "Tarea creada correctamente", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["tareas"] });
      queryClient.invalidateQueries({ queryKey: ["agenda"] });
      const fromQuery = searchParams.get("from");
      const fromState = location.state?.from;
      if (fromState || fromQuery === "agenda") {
        navigateBack();
      } else {
        navigate(`/tareas/${saved?.id ?? id}`);
      }
    },
    onError: (error) => enqueueSnackbar(getApiError(error, "No se pudo guardar la tarea"), { variant: "error" }),
  });

  const addSubtaskMutation = useMutation({
    mutationFn: async (titulo) => {
      const items = tareaQuery.data?.items ?? [];
      const { data } = await api.post(`/tareas/${id}/subtareas`, { titulo, orden: items.length });
      return unwrapEntity(data);
    },
    onSuccess: () => {
      setNewEditItem("");
      enqueueSnackbar("Subtarea agregada", { variant: "success" });
      invalidateTarea();
    },
    onError: (error) => enqueueSnackbar(getApiError(error, "No se pudo agregar la subtarea"), { variant: "error" }),
  });

  const toggleSubtaskMutation = useMutation({
    mutationFn: async (subtaskId) => {
      const { data } = await api.patch(`/tareas/${id}/subtareas/${subtaskId}/toggle`);
      return unwrapEntity(data);
    },
    onSuccess: invalidateTarea,
    onError: (error) => enqueueSnackbar(getApiError(error, "No se pudo actualizar la subtarea"), { variant: "error" }),
  });

  const updateSubtaskMutation = useMutation({
    mutationFn: async ({ subtask, titulo }) => {
      const { data } = await api.put(`/tareas/${id}/subtareas/${subtask.id}`, { titulo, orden: subtask.orden });
      return unwrapEntity(data);
    },
    onSuccess: () => {
      enqueueSnackbar("Subtarea actualizada", { variant: "success" });
      invalidateTarea();
    },
    onError: (error) => enqueueSnackbar(getApiError(error, "No se pudo editar la subtarea"), { variant: "error" }),
  });

  const deleteSubtaskMutation = useMutation({
    mutationFn: async (subtaskId) => api.delete(`/tareas/${id}/subtareas/${subtaskId}`),
    onSuccess: () => {
      enqueueSnackbar("Subtarea eliminada", { variant: "success" });
      invalidateTarea();
    },
    onError: (error) => enqueueSnackbar(getApiError(error, "No se pudo eliminar la subtarea"), { variant: "error" }),
  });

  function setField(field) {
    return (event) => {
      const value = event.target.value;
      setForm((current) => ({
        ...current,
        [field]: value,
        ...(field === "clienteId" ? { casoId: "" } : {}),
      }));
      setErrors((current) => ({ ...current, [field]: "" }));
    };
  }

  function addInitialItem() {
    const title = newInitialItem.trim();
    if (!title) return;
    setForm((current) => ({ ...current, items: [...current.items, { titulo: title }] }));
    setNewInitialItem("");
  }

  function addEditItem() {
    const title = newEditItem.trim();
    if (!title) return;
    addSubtaskMutation.mutate(title);
  }

  function validate() {
    const nextErrors = {};
    if (!form.titulo.trim()) nextErrors.titulo = "El título es obligatorio";
    if (form.titulo.trim().length > 255) nextErrors.titulo = "Máximo 255 caracteres";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!validate()) return;
    saveMutation.mutate();
  }

  if (isEdit && tareaQuery.isLoading) {
    return <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}><CircularProgress /></Box>;
  }

  const subtaskPending = addSubtaskMutation.isPending || toggleSubtaskMutation.isPending || updateSubtaskMutation.isPending || deleteSubtaskMutation.isPending;

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
        <Button startIcon={<ArrowBack />} onClick={navigateBack} sx={{ alignSelf: "flex-start", fontWeight: 800 }}>
          Volver
        </Button>
        <Typography variant="h5" sx={{ fontWeight: 900 }}>{isEdit ? "Editar Tarea" : "Registrar Tarea"}</Typography>
      </Stack>

      <Paper elevation={0} sx={{ borderRadius: "16px", border: "1px solid", borderColor: "divider", p: { xs: 2, md: 3 } }}>
        <Typography variant="subtitle1" sx={{ color: "primary.main", fontWeight: 900, mb: 1 }}>Datos de la Tarea</Typography>
        <Divider sx={{ mb: 2.5 }} />
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12 }}>
            <TextField fullWidth required size="small" label="Título" value={form.titulo} onChange={setField("titulo")} error={Boolean(errors.titulo)} helperText={errors.titulo} inputProps={{ maxLength: 255 }} />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField fullWidth multiline minRows={4} size="small" label="Descripción" value={form.descripcion} onChange={setField("descripcion")} />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField fullWidth type="datetime-local" size="small" label="Fecha Límite" value={form.fechaLimite} onChange={setField("fechaLimite")} slotProps={{ inputLabel: { shrink: true } }} />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField fullWidth type="datetime-local" size="small" label="Recordatorio" value={form.recordatorio} onChange={setField("recordatorio")} slotProps={{ inputLabel: { shrink: true } }} />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Prioridad</InputLabel>
              <Select label="Prioridad" value={form.prioridadId} onChange={setField("prioridadId")}>
                <MenuItem value="">Sin prioridad</MenuItem>
                {(prioridadesQuery.data ?? []).map((priority) => <MenuItem key={priority.id} value={priority.id}>{priority.nombre}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Asignado A</InputLabel>
              <Select label="Asignado A" value={form.asignadoA} onChange={setField("asignadoA")}>
                <MenuItem value="">Sin asignar</MenuItem>
                {teamOptions.map((member) => <MenuItem key={member.id} value={member.id}>{member.nombre}</MenuItem>)}
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
        </Grid>

        <Divider sx={{ my: 3 }} />
        {!isEdit ? (
          <ChecklistInicial
            items={form.items}
            newItem={newInitialItem}
            setNewItem={setNewInitialItem}
            onAdd={addInitialItem}
            onRemove={(index) => setForm((current) => ({ ...current, items: current.items.filter((_, i) => i !== index) }))}
          />
        ) : (
          <ChecklistEdicion
            items={tareaQuery.data?.items ?? []}
            newItem={newEditItem}
            setNewItem={setNewEditItem}
            onAdd={addEditItem}
            onToggle={(item) => toggleSubtaskMutation.mutate(item.id)}
            onSave={(item, titulo) => updateSubtaskMutation.mutate({ subtask: item, titulo })}
            onDelete={(item) => deleteSubtaskMutation.mutate(item.id)}
            pending={subtaskPending}
          />
        )}

        <Divider sx={{ my: 3 }} />
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} justifyContent="flex-end">
          <Button variant="outlined" onClick={navigateBack} disabled={saveMutation.isPending} sx={{ borderRadius: "10px", fontWeight: 800 }}>
            Cancelar
          </Button>
          <Button type="submit" variant="contained" startIcon={!saveMutation.isPending ? <Save /> : null} disabled={saveMutation.isPending} sx={{ borderRadius: "10px", fontWeight: 900 }}>
            {saveMutation.isPending ? <CircularProgress size={20} color="inherit" /> : isEdit ? "Guardar Cambios" : "Crear Tarea"}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}

function ChecklistInicial({ items, newItem, setNewItem, onAdd, onRemove }) {
  return (
    <>
      <Typography variant="subtitle1" sx={{ fontWeight: 900, mb: 1.5 }}>Checklist inicial</Typography>
      <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: "12px", bgcolor: "action.hover" }}>
        <Stack spacing={1}>
          {items.length === 0 && <Typography variant="body2" sx={{ color: "text.secondary" }}>Agregá subtareas preliminares si querés iniciar la tarea con un checklist.</Typography>}
          {items.map((item, index) => (
            <Stack key={`${item.titulo}-${index}`} direction="row" spacing={1} alignItems="center">
              <CheckCircle sx={{ fontSize: 18, color: "text.disabled" }} />
              <Typography variant="body2" sx={{ flex: 1, fontWeight: 700 }}>{item.titulo}</Typography>
              <IconButton size="small" color="error" onClick={() => onRemove(index)}>
                <Delete fontSize="small" />
              </IconButton>
            </Stack>
          ))}
          <Stack direction="row" spacing={1}>
            <TextField
              fullWidth
              size="small"
              placeholder="Añadir subtarea preliminar"
              value={newItem}
              onChange={(event) => setNewItem(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onAdd();
                }
              }}
            />
            <IconButton color="primary" onClick={onAdd} disabled={!newItem.trim()} sx={{ border: "1px solid", borderColor: "divider" }}><Add /></IconButton>
          </Stack>
        </Stack>
      </Paper>
    </>
  );
}

function ChecklistEdicion({ items, newItem, setNewItem, onAdd, onToggle, onSave, onDelete, pending }) {
  return (
    <>
      <Typography variant="subtitle1" sx={{ fontWeight: 900, mb: 1.5 }}>Subtareas</Typography>
      <Paper elevation={0} sx={{ p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: "12px", bgcolor: "action.hover" }}>
        <Stack spacing={0.75}>
          {items.length === 0 ? (
            <Typography variant="body2" sx={{ color: "text.secondary", px: 0.5, py: 1 }}>Todavía no hay subtareas para esta tarea.</Typography>
          ) : (
            items.map((item) => (
              <EditableSubtask
                key={item.id}
                item={item}
                disabled={pending}
                onToggle={() => onToggle(item)}
                onSave={(titulo) => onSave(item, titulo)}
                onDelete={() => onDelete(item)}
              />
            ))
          )}
          <Stack direction="row" spacing={1} sx={{ pt: 1 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Añadir un elemento..."
              value={newItem}
              onChange={(event) => setNewItem(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onAdd();
                }
              }}
            />
            <IconButton color="primary" onClick={onAdd} disabled={pending || !newItem.trim()} sx={{ border: "1px solid", borderColor: "divider" }}><Add /></IconButton>
          </Stack>
        </Stack>
      </Paper>
    </>
  );
}

function EditableSubtask({ item, disabled, onToggle, onSave, onDelete }) {
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
    <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 0.5, py: 0.5, borderRadius: "10px", bgcolor: "background.paper", border: "1px solid", borderColor: "divider" }}>
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
        <Typography variant="body2" onDoubleClick={() => setEditing(true)} sx={{ flex: 1, fontWeight: 800, cursor: "text", textDecoration: item.completada ? "line-through" : "none", color: item.completada ? "text.secondary" : "text.primary" }}>
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
