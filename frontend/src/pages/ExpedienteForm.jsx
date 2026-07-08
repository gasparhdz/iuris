import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { alpha, useTheme } from "@mui/material/styles";
import api from "../api/axios";
import { fetchAllPages } from "../api/pagination";
import { fetchAllTerceros, fetchParticipantesCaso, addParticipanteCaso, updateParticipanteCaso, removeParticipanteCaso } from "../api/terceros";
import {
  Autocomplete,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
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
import { ArrowBack, Save, Add, Delete, People } from "@mui/icons-material";

const EMPTY_FORM = {
  clienteId: "",
  caratula: "",
  nroExpte: "",
  ramaId: "",
  tipoId: "",
  estadoId: "",
  responsableId: "",
  descripcion: "",
  driveFolderId: "",
};

function unwrapItems(data) {
  const raw = Array.isArray(data) ? data : data?.data?.items ?? data?.data ?? [];
  return Array.isArray(raw) ? raw : [];
}

function unwrapData(data) {
  return Array.isArray(data?.data) ? data.data : [];
}

function clienteLabel(cliente) {
  if (!cliente) return "";
  return cliente.razonSocial || [cliente.apellido, cliente.nombre].filter(Boolean).join(", ") || cliente.nombre || `Cliente #${cliente.id}`;
}

export function mapExpedienteDbToForm(c) {
  return {
    clienteId: c.clienteId || "",
    caratula: c.caratula || "",
    nroExpte: c.nroExpte || "",
    tipoId: c.tipoId || "",
    estadoId: c.estadoId || "",
    responsableId: c.responsableId || "",
    descripcion: c.descripcion || "",
    driveFolderId: c.driveFolderId || "",
  };
}

export function mapExpedienteFormToDb(form) {
  return {
    clienteId: Number(form.clienteId),
    caratula: form.caratula.trim(),
    nroExpte: form.nroExpte.trim() || null,
    tipoId: Number(form.tipoId),
    estadoId: form.estadoId ? Number(form.estadoId) : null,
    responsableId: form.responsableId ? Number(form.responsableId) : null,
    descripcion: form.descripcion.trim() || null,
    driveFolderId: form.driveFolderId.trim() || null,
  };
}

export default function ExpedienteForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});

  const theme = useTheme();

  // Estados para la gestión de Terceros Participantes
  const [participants, setParticipants] = useState([]);
  const [deletedParticipantIds, setDeletedParticipantIds] = useState([]);
  
  // Estado local para agregar participante en el formulario
  const [selectedTercero, setSelectedTercero] = useState(null);
  const [selectedRolId, setSelectedRolId] = useState("");
  const [observacionesText, setObservacionesText] = useState("");

  const clientesQuery = useQuery({
    queryKey: ["clientes", "autocomplete"],
    queryFn: () => fetchAllPages("/clientes"),
  });

  const catalogQuery = (categoria) => useQuery({
    queryKey: ["catalogos", "parametros", categoria],
    queryFn: async () => {
      const { data } = await api.get("/catalogos/parametros", { params: { categoria } });
      return unwrapData(data);
    },
    staleTime: 1000 * 60 * 30,
  });

  const ramas = catalogQuery("RAMA_DERECHO").data ?? [];
  const tipos = catalogQuery("TIPO_CASO").data ?? [];
  const estados = catalogQuery("ESTADO_CASO").data ?? [];
  const roles = catalogQuery("ROL_PARTICIPANTE").data ?? [];

  const tercerosQuery = useQuery({
    queryKey: ["terceros", "lookup"],
    // No pasar fetchAllTerceros pelada: react-query inyecta su contexto ({queryKey, signal, ...})
    // como primer argumento y terminaba en el querystring (400 del backend).
    queryFn: () => fetchAllTerceros(),
  });

  const miembrosQuery = useQuery({
    queryKey: ["equipo", "miembros"],
    queryFn: async () => {
      const { data } = await api.get("/equipo/miembros");
      return data?.data ?? [];
    },
    staleTime: 1000 * 60 * 5,
  });

  const casoQuery = useQuery({
    queryKey: ["expedientes", id],
    queryFn: async () => {
      const { data } = await api.get(`/expedientes/${id}`);
      return data?.data ?? data;
    },
    enabled: isEdit,
  });

  const participantesQuery = useQuery({
    queryKey: ["expedientes", id, "participantes"],
    queryFn: () => fetchParticipantesCaso(Number(id)),
    enabled: isEdit,
  });

  const tiposFiltrados = useMemo(
    () => tipos.filter((tipo) => !form.ramaId || Number(tipo.parentId) === Number(form.ramaId)),
    [tipos, form.ramaId]
  );

  // Inicializar participantes si estamos editando
  useEffect(() => {
    if (isEdit && participantesQuery.data) {
      setParticipants(participantesQuery.data);
    }
  }, [isEdit, participantesQuery.data]);

  useEffect(() => {
    if (!casoQuery.data) return;
    const next = mapExpedienteDbToForm(casoQuery.data);
    const tipo = tipos.find((item) => Number(item.id) === Number(next.tipoId));
    setForm({ ...EMPTY_FORM, ...next, ramaId: tipo?.parentId || "" });
  }, [casoQuery.data, tipos]);

  const handleAddParticipant = () => {
    if (!selectedTercero) return;
    if (!selectedRolId) return;

    if (participants.some((p) => Number(p.terceroId) === Number(selectedTercero.id))) {
      enqueueSnackbar("Este tercero ya participa en el expediente", { variant: "warning" });
      return;
    }

    const rol = roles.find((r) => Number(r.id) === Number(selectedRolId));
    const newP = {
      id: `temp-${Date.now()}`,
      terceroId: Number(selectedTercero.id),
      rolId: Number(selectedRolId),
      rolNombre: rol?.nombre || "Participante",
      observaciones: observacionesText.trim() || null,
      tercero: selectedTercero,
      _isNew: true,
    };

    setParticipants([...participants, newP]);
    setSelectedTercero(null);
    setSelectedRolId("");
    setObservacionesText("");
  };

  const handleRemoveParticipant = (pId) => {
    const pToRemove = participants.find((p) => p.id === pId);
    if (pToRemove && !pToRemove._isNew && typeof pToRemove.id === "number") {
      setDeletedParticipantIds((prev) => [...prev, pToRemove.id]);
    }
    setParticipants(participants.filter((p) => p.id !== pId));
  };

  function terceroLabel(tercero) {
    if (!tercero) return "";
    return tercero.razonSocial || [tercero.apellido, tercero.nombre].filter(Boolean).join(", ") || tercero.nombre || `Tercero #${tercero.id}`;
  }

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      let savedCaso;
      if (isEdit) {
        const { data } = await api.put(`/expedientes/${id}`, mapExpedienteFormToDb(payload));
        savedCaso = data?.data ?? data;
      } else {
        const { data } = await api.post("/expedientes", mapExpedienteFormToDb(payload));
        savedCaso = data?.data ?? data;
      }

      const lockCasoId = Number(savedCaso.id ?? id);
      const promises = [];

      if (!isEdit) {
        // Alta: todos los participantes agregados en la lista son nuevos
        for (const p of participants) {
          promises.push(
            addParticipanteCaso(lockCasoId, {
              terceroId: p.terceroId,
              rolId: p.rolId,
              observaciones: p.observaciones,
              rolNombre: p.rolNombre,
            })
          );
        }
      } else {
        // Edición:
        // A. Agregar nuevos
        const newPs = participants.filter((p) => p._isNew);
        for (const p of newPs) {
          promises.push(
            addParticipanteCaso(lockCasoId, {
              terceroId: p.terceroId,
              rolId: p.rolId,
              observaciones: p.observaciones,
              rolNombre: p.rolNombre,
            })
          );
        }

        // B. Eliminar los quitados
        for (const pId of deletedParticipantIds) {
          promises.push(removeParticipanteCaso(lockCasoId, pId));
        }

        // C. Actualizar observaciones o roles de los existentes que cambiaron
        const existingPs = participants.filter((p) => !p._isNew);
        const originalPs = participantesQuery.data ?? [];
        for (const p of existingPs) {
          const original = originalPs.find((o) => Number(o.id) === Number(p.id));
          if (original && (Number(original.rolId) !== Number(p.rolId) || original.observaciones !== p.observaciones)) {
            promises.push(
              updateParticipanteCaso(lockCasoId, p.id, {
                terceroId: p.terceroId,
                rolId: p.rolId,
                observaciones: p.observaciones,
                rolNombre: p.rolNombre,
              })
            );
          }
        }
      }

      if (promises.length > 0) {
        await Promise.all(promises);
      }

      return savedCaso;
    },
    onSuccess: (saved) => {
      enqueueSnackbar(isEdit ? "Expediente actualizado correctamente" : "Expediente creado correctamente", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["expedientes"] });
      queryClient.invalidateQueries({ queryKey: ["expedientes", saved.id ?? id] });
      queryClient.invalidateQueries({ queryKey: ["expedientes", saved.id ?? id, "participantes"] });
      navigate(`/expedientes/${saved.id ?? id}`);
    },
    onError: (error) => enqueueSnackbar(error?.response?.data?.error?.message ?? "No se pudo guardar el expediente", { variant: "error" }),
  });

  function setField(field) {
    return (event) => {
      const value = event.target.value;
      setForm((current) => ({
        ...current,
        [field]: value,
        ...(field === "ramaId" ? { tipoId: "" } : {}),
      }));
      setErrors((current) => ({ ...current, [field]: "" }));
    };
  }

  function validate() {
    const nextErrors = {};
    if (!form.clienteId) nextErrors.clienteId = "Seleccioná un cliente";
    if (!form.caratula.trim()) nextErrors.caratula = "La carátula es obligatoria";
    if (!form.tipoId) nextErrors.tipoId = "Seleccioná un tipo de expediente";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!validate()) return;
    saveMutation.mutate(form);
  }

  const selectedCliente = (clientesQuery.data ?? []).find((cliente) => Number(cliente.id) === Number(form.clienteId)) ?? null;

  if (isEdit && casoQuery.isLoading) {
    return <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}><CircularProgress /></Box>;
  }

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate("/expedientes")} sx={{ alignSelf: "flex-start", fontWeight: 800 }}>Volver a Expedientes</Button>
        <Typography variant="h5" sx={{ fontWeight: 900 }}>{isEdit ? "Editar Expediente" : "Registrar Expediente"}</Typography>
      </Stack>

      <Paper elevation={0} sx={{ borderRadius: "16px", border: "1px solid", borderColor: "divider", p: { xs: 2, md: 3 } }}>
        <Typography variant="subtitle1" sx={{ color: "primary.main", fontWeight: 900, mb: 1 }}>Datos del Expediente</Typography>
        <Divider sx={{ mb: 2.5 }} />
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Autocomplete
              options={clientesQuery.data ?? []}
              value={selectedCliente}
              loading={clientesQuery.isLoading}
              getOptionLabel={clienteLabel}
              onChange={(_, value) => {
                setForm((current) => ({ ...current, clienteId: value?.id ?? "" }));
                setErrors((current) => ({ ...current, clienteId: "" }));
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  size="small"
                  label="Cliente"
                  error={Boolean(errors.clienteId) || clientesQuery.isError}
                  helperText={errors.clienteId || (clientesQuery.isError ? "No se pudieron cargar los clientes" : "")}
                />
              )}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField fullWidth required size="small" label="Carátula" value={form.caratula} onChange={setField("caratula")} error={Boolean(errors.caratula)} helperText={errors.caratula} />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField fullWidth size="small" label="Nro. Expediente" value={form.nroExpte} onChange={setField("nroExpte")} />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <ParamSelect label="Rama del Derecho" value={form.ramaId} onChange={setField("ramaId")} items={ramas} />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <ParamSelect label="Tipo de Expediente" value={form.tipoId} onChange={setField("tipoId")} items={tiposFiltrados} error={errors.tipoId} disabled={!form.ramaId} />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <ParamSelect label="Estado del Expediente" value={form.estadoId} onChange={setField("estadoId")} items={estados} />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <ParamSelect label="Abogado Responsable" value={form.responsableId} onChange={setField("responsableId")} items={miembrosQuery.data ?? []} />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField fullWidth size="small" label="ID Carpeta Google Drive" value={form.driveFolderId} onChange={setField("driveFolderId")} helperText="ID de carpeta opcional para vinculación directa (ej: 1A2b3C...)" />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField fullWidth multiline minRows={4} size="small" label="Descripción" value={form.descripcion} onChange={setField("descripcion")} />
          </Grid>
        </Grid>

        <Typography variant="subtitle1" sx={{ color: "primary.main", fontWeight: 900, mb: 1, mt: 4 }}>Terceros Participantes</Typography>
        <Divider sx={{ mb: 2.5 }} />
        
        <Grid container spacing={2} sx={{ mb: 3, alignItems: "flex-start" }}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Autocomplete
              options={tercerosQuery.data ?? []}
              value={selectedTercero}
              loading={tercerosQuery.isLoading}
              getOptionLabel={(t) => {
                const nombre = t.razonSocial || [t.apellido, t.nombre].filter(Boolean).join(", ") || t.nombre || `Tercero #${t.id}`;
                const identificador = t.dni ? `DNI: ${t.dni}` : t.cuit ? `CUIT: ${t.cuit}` : "";
                return identificador ? `${nombre} (${identificador})` : nombre;
              }}
              onChange={(_, value) => setSelectedTercero(value)}
              renderInput={(params) => (
                <TextField {...params} size="small" label="Seleccionar Tercero" placeholder="Buscar por nombre o DNI/CUIT..." />
              )}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Rol en el Expediente</InputLabel>
              <Select
                label="Rol en el Expediente"
                value={selectedRolId}
                onChange={(e) => setSelectedRolId(e.target.value)}
              >
                <MenuItem value="">Seleccionar rol</MenuItem>
                {roles.map((r) => (
                  <MenuItem key={r.id} value={r.id}>{r.nombre}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <TextField
              fullWidth
              size="small"
              label="Observaciones"
              placeholder="Ej: Abogado contraparte, perito..."
              value={observacionesText}
              onChange={(e) => setObservacionesText(e.target.value)}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<Add />}
              onClick={handleAddParticipant}
              disabled={!selectedTercero || !selectedRolId}
              sx={{ height: "40px", fontWeight: 800, borderRadius: "8px" }}
            >
              Agregar
            </Button>
          </Grid>
        </Grid>

        <Stack spacing={1.5} sx={{ mb: 2 }}>
          {participants.length === 0 ? (
            <Typography variant="body2" sx={{ color: "text.secondary", fontStyle: "italic", py: 1 }}>
              No se han asociado terceros a este expediente todavía.
            </Typography>
          ) : (
            participants.map((p) => {
              const tercero = p.tercero;
              const rolNombre = p.rolNombre || roles.find((r) => Number(r.id) === Number(p.rolId))?.nombre || `Rol #${p.rolId}`;
              const rolUpper = rolNombre.toUpperCase();
              const chipColor = rolUpper.includes("CONTRAPARTE") ? "error" : rolUpper.includes("ABOG") ? "warning" : rolUpper.includes("MEDIADOR") ? "info" : rolUpper.includes("PERITO") ? "success" : "default";

              return (
                <Card
                  key={p.id}
                  elevation={0}
                  sx={{
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: "12px",
                    bgcolor: alpha(theme.palette.background.paper, 0.72),
                  }}
                >
                  <CardContent
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 2,
                      py: "12px !important",
                      px: 2,
                      flexWrap: "wrap",
                    }}
                  >
                    <Avatar sx={{ width: 36, height: 36 }}>{terceroLabel(tercero)[0] ?? "T"}</Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontWeight: 800, fontSize: "0.95rem" }}>{terceroLabel(tercero)}</Typography>
                      <Stack direction="row" spacing={1.5} sx={{ mt: 0.5, flexWrap: "wrap", alignItems: "center" }}>
                        <Chip size="small" color={chipColor} label={rolNombre} sx={{ fontWeight: 900, height: 20, fontSize: "0.75rem" }} />
                        {tercero?.email && <Typography variant="caption" color="text.secondary">{tercero.email}</Typography>}
                        {tercero?.telefono && <Typography variant="caption" color="text.secondary">{tercero.telefono}</Typography>}
                      </Stack>
                      {p.observaciones && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                          Obs: {p.observaciones}
                        </Typography>
                      )}
                    </Box>
                    <IconButton color="error" size="small" onClick={() => handleRemoveParticipant(p.id)}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </CardContent>
                </Card>
              );
            })
          )}
        </Stack>

        <Divider sx={{ my: 3 }} />
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} justifyContent="flex-end">
          <Button variant="outlined" onClick={() => navigate("/expedientes")} disabled={saveMutation.isPending}>Cancelar</Button>
          <Button type="submit" variant="contained" startIcon={!saveMutation.isPending ? <Save /> : null} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <CircularProgress size={20} color="inherit" /> : isEdit ? "Guardar Cambios" : "Crear Expediente"}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}

function ParamSelect({ label, value, onChange, items, error, disabled = false }) {
  return (
    <FormControl fullWidth size="small" disabled={disabled} error={Boolean(error)}>
      <InputLabel>{label}</InputLabel>
      <Select label={label} value={value} onChange={onChange}>
        <MenuItem value="">Sin seleccionar</MenuItem>
        {items.map((item) => <MenuItem key={item.id} value={item.id}>{item.nombre}</MenuItem>)}
      </Select>
      {error && <Typography variant="caption" sx={{ color: "error.main", mt: 0.5, ml: 1.75 }}>{error}</Typography>}
    </FormControl>
  );
}
