import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import api from "../api/axios";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Collapse,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { Add, ArrowBack, Delete, Edit, ExpandLess, ExpandMore, Save } from "@mui/icons-material";

// Ids de los parámetros TIPO_PERSONA (ver seedParametros.ts): física=143, jurídica=144
const TIPO_PERSONA_FISICA_ID = 143;
const TIPO_PERSONA_JURIDICA_ID = 144;

const EMPTY_FORM = {
  tipo: "fisica",
  tipoPersonaId: TIPO_PERSONA_FISICA_ID,
  nombre: "",
  apellido: "",
  razonSocial: "",
  dni: "",
  cuit: "",
  fechaNacimiento: "",
  email: "",
  telFijo: "",
  telCelular: "",
  dirCalle: "",
  dirNro: "",
  dirPiso: "",
  dirDepto: "",
  codigoPostal: "",
  provinciaId: "",
  localidadId: "",
  observaciones: "",
  activo: true,
};

const EMPTY_CONTACTO = {
  nombre: "",
  rol: "",
  email: "",
  telefono: "",
  observaciones: "",
};

function isPersonaFisicaId(value) {
  return Number(value) === TIPO_PERSONA_FISICA_ID;
}

function nullableString(value) {
  const text = String(value ?? "").trim();
  return text === "" ? null : text;
}

function nullableNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function nullableIsoDateTime(value) {
  const text = nullableString(value);
  if (!text) return null;
  if (text.includes("T")) return text;
  return `${text}T00:00:00.000Z`;
}

function validarCUIT(cuit) {
  const limpio = String(cuit).replace(/[^0-9]/g, "");
  if (limpio.length !== 11) return false;
  const factores = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let suma = 0;
  for (let i = 0; i < 10; i += 1) {
    suma += parseInt(limpio[i], 10) * factores[i];
  }
  const digitoVerificador = 11 - (suma % 11);
  const verificadorCalculado = digitoVerificador === 11 ? 0 : (digitoVerificador === 10 ? 9 : digitoVerificador);
  return verificadorCalculado === parseInt(limpio[10], 10);
}

function formatCuitForApi(value) {
  const limpio = String(value ?? "").replace(/[^0-9]/g, "");
  if (limpio.length !== 11) return nullableString(value);
  return `${limpio.slice(0, 2)}-${limpio.slice(2, 10)}-${limpio.slice(10)}`;
}

function validarDNI(dni) {
  return /^\d{7,8}$/.test(String(dni).trim());
}

function getDateAtStartOfDay(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function calcularEdad(value) {
  const birthDate = getDateAtStartOfDay(value);
  if (!birthDate) return null;
  const today = new Date();
  let edad = today.getFullYear() - birthDate.getFullYear();
  const monthDelta = today.getMonth() - birthDate.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birthDate.getDate())) {
    edad -= 1;
  }
  return edad;
}

function fechaEsFutura(value) {
  const date = getDateAtStartOfDay(value);
  if (!date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date > today;
}

function anioNoRazonable(value, limiteInferior) {
  const date = getDateAtStartOfDay(value);
  if (!date) return false;
  return date.getFullYear() < limiteInferior;
}

function mapDbToForm(cliente) {
  const isFisica = isPersonaFisicaId(cliente.tipoPersonaId);

  return {
    ...EMPTY_FORM,
    tipo: isFisica ? "fisica" : "juridica",
    tipoPersonaId: cliente.tipoPersonaId ?? (isFisica ? TIPO_PERSONA_FISICA_ID : TIPO_PERSONA_JURIDICA_ID),
    nombre: cliente.nombre ?? "",
    apellido: cliente.apellido ?? "",
    razonSocial: cliente.razonSocial ?? "",
    dni: cliente.dni ?? "",
    cuit: cliente.cuit ?? "",
    fechaNacimiento: cliente.fechaNacimiento ? String(cliente.fechaNacimiento).slice(0, 10) : "",
    email: cliente.email ?? "",
    telFijo: cliente.telFijo ?? "",
    telCelular: cliente.telCelular ?? "",
    dirCalle: cliente.dirCalle ?? "",
    dirNro: cliente.dirNro ?? "",
    dirPiso: cliente.dirPiso ?? "",
    dirDepto: cliente.dirDepto ?? "",
    codigoPostal: cliente.codigoPostal ?? "",
    provinciaId: cliente.provinciaId ?? "",
    localidadId: cliente.localidadId ?? "",
    observaciones: cliente.observaciones ?? "",
    activo: cliente.activo ?? true,
  };
}

function mapFrontendToDb(form) {
  const isFisica = form.tipo === "fisica" || isPersonaFisicaId(form.tipoPersonaId);
  let nombre = nullableString(form.nombre);
  let apellido = nullableString(form.apellido);

  if (isFisica && nombre && !apellido) {
    const parts = nombre.split(/\s+/).filter(Boolean);
    if (parts.length > 1) {
      nombre = parts[0];
      apellido = parts.slice(1).join(" ");
    } else {
      apellido = ".";
    }
  }

  return {
    tipoPersonaId: Number(form.tipoPersonaId),
    nombre: isFisica ? nombre : null,
    apellido: isFisica ? apellido : null,
    razonSocial: isFisica ? null : nullableString(form.razonSocial),
    dni: isFisica ? nullableString(form.dni) : null,
    cuit: formatCuitForApi(form.cuit),
    fechaNacimiento: nullableIsoDateTime(form.fechaNacimiento),
    email: nullableString(form.email),
    telFijo: nullableString(form.telFijo),
    telCelular: nullableString(form.telCelular),
    dirCalle: nullableString(form.dirCalle),
    dirNro: nullableString(form.dirNro),
    dirPiso: nullableString(form.dirPiso),
    dirDepto: nullableString(form.dirDepto),
    codigoPostal: nullableString(form.codigoPostal),
    provinciaId: nullableNumber(form.provinciaId),
    localidadId: nullableNumber(form.localidadId),
    observaciones: nullableString(form.observaciones),
    activo: form.activo ?? true,
  };
}

function mapContactoToDb(contacto) {
  return {
    nombre: nullableString(contacto.nombre),
    rol: nullableString(contacto.rol),
    email: nullableString(contacto.email),
    telefono: nullableString(contacto.telefono),
    observaciones: nullableString(contacto.observaciones),
    activo: contacto.activo ?? true,
  };
}

function getClienteTitle(form) {
  return form.tipo === "juridica"
    ? form.razonSocial
    : [form.nombre, form.apellido].filter(Boolean).join(" ");
}

export default function ClienteForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [localContactos, setLocalContactos] = useState([]);
  const [contactoForm, setContactoForm] = useState(EMPTY_CONTACTO);
  const [contactoErrors, setContactoErrors] = useState({});
  const [editingContacto, setEditingContacto] = useState(null);
  const [contactosSaving, setContactosSaving] = useState(false);
  const [contactosOpen, setContactosOpen] = useState(false);

  const { data: tiposPersona = [] } = useQuery({
    queryKey: ["catalogos", "parametros", "TIPO_PERSONA"],
    queryFn: async () => {
      const { data } = await api.get("/catalogos/parametros", { params: { categoria: "TIPO_PERSONA" } });
      return Array.isArray(data?.data) ? data.data : [];
    },
    staleTime: 1000 * 60 * 30,
  });

  const { data: provincias = [] } = useQuery({
    queryKey: ["catalogos", "provincias"],
    queryFn: async () => {
      const { data } = await api.get("/catalogos/provincias");
      return Array.isArray(data?.data) ? data.data : [];
    },
    staleTime: 1000 * 60 * 30,
  });

  const { data: localidades = [] } = useQuery({
    queryKey: ["catalogos", "localidades", form.provinciaId || "all"],
    queryFn: async () => {
      const { data } = await api.get("/catalogos/localidades", {
        params: form.provinciaId ? { provinciaId: form.provinciaId } : {},
      });
      return Array.isArray(data?.data) ? data.data : [];
    },
    staleTime: 1000 * 60 * 30,
  });

  const tipoPersonaIds = useMemo(() => {
    const fisica = tiposPersona.find((tipo) => tipo.codigo === "PERSONA_FISICA")?.id ?? TIPO_PERSONA_FISICA_ID;
    const juridica = tiposPersona.find((tipo) => tipo.codigo === "PERSONA_JURIDICA")?.id ?? TIPO_PERSONA_JURIDICA_ID;
    return { fisica, juridica };
  }, [tiposPersona]);

  useEffect(() => {
    if (isEdit || !tiposPersona.length) return;
    const expectedId = form.tipo === "juridica" ? tipoPersonaIds.juridica : tipoPersonaIds.fisica;
    const validIds = [tipoPersonaIds.fisica, tipoPersonaIds.juridica].map(Number);
    if (!validIds.includes(Number(form.tipoPersonaId))) {
      setForm((current) => ({ ...current, tipoPersonaId: expectedId }));
    }
  }, [form.tipo, form.tipoPersonaId, isEdit, tipoPersonaIds.fisica, tipoPersonaIds.juridica, tiposPersona.length]);

  const isFisica = Number(form.tipoPersonaId) === Number(tipoPersonaIds.fisica) || isPersonaFisicaId(form.tipoPersonaId);
  const edadCliente = isFisica ? calcularEdad(form.fechaNacimiento) : null;
  const showMinorWarning = isFisica && edadCliente !== null && edadCliente < 18;

  const { data: cliente, isLoading, isError } = useQuery({
    queryKey: ["clientes", id],
    queryFn: async () => {
      const { data } = await api.get(`/clientes/${id}/detalle`);
      const detalle = data?.data ?? data;
      return detalle?.cliente ?? detalle;
    },
    enabled: isEdit,
  });

  useEffect(() => {
    if (cliente) {
      setForm(mapDbToForm(cliente));
      setLocalContactos(Array.isArray(cliente.contactos) ? cliente.contactos : []);
    }
  }, [cliente]);

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      if (isEdit) {
        const { data } = await api.put(`/clientes/${id}`, mapFrontendToDb(payload));
        return { mode: "edit", cliente: data?.data ?? data };
      }
      const { data } = await api.post("/clientes", mapFrontendToDb(payload));
      const nuevoCliente = data?.data ?? data;
      let contactosFallidos = 0;
      for (const contacto of localContactos) {
        try {
          await api.post(`/clientes/${nuevoCliente.id}/contactos`, mapContactoToDb(contacto));
        } catch {
          contactosFallidos += 1;
        }
      }
      return { mode: "create", cliente: nuevoCliente, contactosFallidos };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      if (result.mode === "edit") {
        enqueueSnackbar("Cliente actualizado correctamente", { variant: "success" });
        queryClient.invalidateQueries({ queryKey: ["clientes", id] });
        navigate("/clientes");
        return;
      }
      if (result.contactosFallidos > 0) {
        enqueueSnackbar(
          `Cliente creado, pero no se pudieron guardar ${result.contactosFallidos} contactos — agregalos desde el detalle`,
          { variant: "warning" },
        );
      } else {
        enqueueSnackbar("Cliente creado correctamente", { variant: "success" });
      }
      navigate(`/clientes/${result.cliente.id}`);
    },
    onError: (error) => {
      enqueueSnackbar(error?.response?.data?.error?.message ?? "No se pudo guardar el cliente", { variant: "error" });
    },
  });

  function setField(field) {
    return (event) => {
      const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
      setForm((current) => ({
        ...current,
        [field]: value,
        ...(field === "tipoPersonaId"
          ? {
              tipo: Number(value) === Number(tipoPersonaIds.fisica) ? "fisica" : "juridica",
              nombre: "",
              apellido: "",
              razonSocial: "",
              dni: "",
              cuit: "",
            }
          : {}),
        ...(field === "provinciaId" ? { localidadId: "", codigoPostal: "" } : {}),
      }));
      setErrors((current) => ({ ...current, [field]: "" }));
    };
  }

  function normalizeEmail() {
    setForm((current) => ({
      ...current,
      email: current.email.trim().toLowerCase(),
    }));
  }

  function setContactoField(field) {
    return (event) => {
      const value = event.target.value;
      setContactoForm((current) => ({ ...current, [field]: value }));
      setContactoErrors((current) => ({ ...current, [field]: "" }));
    };
  }

  function normalizeContactoEmail() {
    setContactoForm((current) => ({
      ...current,
      email: current.email.trim().toLowerCase(),
    }));
  }

  function validateContacto() {
    const nextErrors = {};
    if (!contactoForm.nombre.trim()) nextErrors.nombre = "El nombre del contacto es obligatorio";
    if (contactoForm.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactoForm.email.trim())) {
      nextErrors.email = "Ingresá un email válido";
    }
    setContactoErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleGuardarContacto() {
    if (!validateContacto()) return;
    setContactosSaving(true);
    try {
      if (isEdit) {
        if (editingContacto?.id) {
          const { data } = await api.put(`/clientes/${id}/contactos/${editingContacto.id}`, mapContactoToDb(contactoForm));
          const updated = data?.data ?? data;
          setLocalContactos((current) => current.map((contacto) => (contacto.id === updated.id ? updated : contacto)));
          enqueueSnackbar("Contacto actualizado", { variant: "success" });
        } else {
          const { data } = await api.post(`/clientes/${id}/contactos`, mapContactoToDb(contactoForm));
          setLocalContactos((current) => [data?.data ?? data, ...current]);
          enqueueSnackbar("Contacto agregado", { variant: "success" });
        }
        queryClient.invalidateQueries({ queryKey: ["clientes", id] });
      } else if (editingContacto?.localId) {
        setLocalContactos((current) => current.map((contacto) => (contacto.localId === editingContacto.localId ? { ...contactoForm, localId: editingContacto.localId } : contacto)));
      } else {
        setLocalContactos((current) => [{ ...contactoForm, localId: crypto.randomUUID() }, ...current]);
      }
      setContactoForm(EMPTY_CONTACTO);
      setEditingContacto(null);
    } catch (error) {
      enqueueSnackbar(error?.response?.data?.error?.message ?? "No se pudo guardar el contacto", { variant: "error" });
    } finally {
      setContactosSaving(false);
    }
  }

  async function handleEliminarContacto(contacto) {
    if (!window.confirm(`¿Eliminar el contacto ${contacto.nombre}?`)) return;
    if (!isEdit || contacto.localId) {
      setLocalContactos((current) => current.filter((item) => item.localId !== contacto.localId));
      if (editingContacto?.localId === contacto.localId) {
        setEditingContacto(null);
        setContactoForm(EMPTY_CONTACTO);
      }
      return;
    }

    setContactosSaving(true);
    try {
      await api.delete(`/clientes/${id}/contactos/${contacto.id}`);
      setLocalContactos((current) => current.filter((item) => item.id !== contacto.id));
      enqueueSnackbar("Contacto eliminado", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["clientes", id] });
    } catch (error) {
      enqueueSnackbar(error?.response?.data?.error?.message ?? "No se pudo eliminar el contacto", { variant: "error" });
    } finally {
      setContactosSaving(false);
    }
  }

  function handleEditarContacto(contacto) {
    setEditingContacto(contacto);
    setContactoForm({
      nombre: contacto.nombre ?? "",
      rol: contacto.rol ?? "",
      email: contacto.email ?? "",
      telefono: contacto.telefono ?? "",
      observaciones: contacto.observaciones ?? "",
    });
  }

  function validate() {
    const nextErrors = {};

    if (isFisica) {
      if (!form.nombre.trim()) nextErrors.nombre = "El nombre es obligatorio";
      if (!form.apellido.trim()) nextErrors.apellido = "El apellido es obligatorio";
      if (form.dni.trim() && !validarDNI(form.dni)) {
        nextErrors.dni = "El DNI debe tener entre 7 y 8 números";
      }
    } else {
      if (!form.razonSocial.trim()) nextErrors.razonSocial = "La razón social es obligatoria";
      if (!form.cuit.trim()) nextErrors.cuit = "El CUIT es obligatorio";
    }

    if (form.cuit.trim() && !validarCUIT(form.cuit)) {
      nextErrors.cuit = "El CUIT/CUIL ingresado es inválido (dígito verificador incorrecto)";
    }

    if (form.fechaNacimiento) {
      if (fechaEsFutura(form.fechaNacimiento)) {
        nextErrors.fechaNacimiento = "La fecha no puede ser en el futuro";
      } else if (anioNoRazonable(form.fechaNacimiento, isFisica ? 1900 : 1800)) {
        nextErrors.fechaNacimiento = "Año ingresado no razonable";
      }
    }

    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      nextErrors.email = "Ingresá un email válido";
    }

    if (form.codigoPostal.trim() && !/^([A-Z]\d{4}[A-Z]{3}|\d{4})$/i.test(form.codigoPostal.trim())) {
      nextErrors.codigoPostal = "Formato de Código Postal inválido (4 números o formato CPA)";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!validate()) return;
    saveMutation.mutate(form);
  }

  if (isEdit && isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isEdit && (isError || !cliente)) {
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
        <Typography variant="h6" sx={{ fontWeight: 900 }}>No pudimos cargar el cliente</Typography>
        <Button onClick={() => navigate("/clientes")} sx={{ mt: 2 }}>Volver</Button>
      </Paper>
    );
  }

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", md: "center" }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Button startIcon={<ArrowBack />} onClick={() => navigate("/clientes")} sx={{ justifyContent: "flex-start", fontWeight: 800 }}>
          Volver a Clientes
        </Button>
        <Typography variant="h5" sx={{ fontWeight: 900, textAlign: { xs: "left", md: "right" } }}>
          {isEdit ? `Editar Cliente${getClienteTitle(form) ? ` - ${getClienteTitle(form)}` : ""}` : "Registrar Nuevo Cliente"}
        </Typography>
      </Stack>

      <Paper
        elevation={0}
        sx={{
          borderRadius: "16px",
          border: "1px solid",
          borderColor: "divider",
          p: { xs: 2, md: 3 },
          bgcolor: "background.paper",
        }}
      >
        <Section title="Información Básica" />
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, md: 4 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Tipo de Cliente</InputLabel>
              <Select label="Tipo de Cliente" value={form.tipoPersonaId} onChange={setField("tipoPersonaId")}>
                <MenuItem value={tipoPersonaIds.fisica}>Persona Física</MenuItem>
                <MenuItem value={tipoPersonaIds.juridica}>Persona Jurídica</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {isFisica ? (
            <>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField fullWidth required size="small" label="Nombre" value={form.nombre} onChange={setField("nombre")} error={Boolean(errors.nombre)} helperText={errors.nombre} />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField fullWidth required size="small" label="Apellido" value={form.apellido} onChange={setField("apellido")} error={Boolean(errors.apellido)} helperText={errors.apellido} />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField fullWidth size="small" label="DNI" value={form.dni} onChange={setField("dni")} error={Boolean(errors.dni)} helperText={errors.dni} />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField fullWidth size="small" label="CUIL / CUIT" value={form.cuit} onChange={setField("cuit")} error={Boolean(errors.cuit)} helperText={errors.cuit} />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField fullWidth size="small" type="date" label="Fecha de Nacimiento" value={form.fechaNacimiento} onChange={setField("fechaNacimiento")} error={Boolean(errors.fechaNacimiento)} helperText={errors.fechaNacimiento} slotProps={{ inputLabel: { shrink: true } }} />
                {showMinorWarning && (
                  <Alert severity="warning" variant="outlined" sx={{ mt: 1, py: 0.5, borderRadius: "8px" }}>
                    El cliente es menor de edad. Recordá asociar su representante legal.
                  </Alert>
                )}
              </Grid>
            </>
          ) : (
            <>
              <Grid size={{ xs: 12, md: 8 }}>
                <TextField fullWidth required size="small" label="Razón Social" value={form.razonSocial} onChange={setField("razonSocial")} error={Boolean(errors.razonSocial)} helperText={errors.razonSocial} />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField fullWidth required size="small" label="CUIT" value={form.cuit} onChange={setField("cuit")} error={Boolean(errors.cuit)} helperText={errors.cuit} />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField fullWidth size="small" type="date" label="Fecha de Constitución" value={form.fechaNacimiento} onChange={setField("fechaNacimiento")} error={Boolean(errors.fechaNacimiento)} helperText={errors.fechaNacimiento} slotProps={{ inputLabel: { shrink: true } }} />
              </Grid>
            </>
          )}
        </Grid>

        <Section title="Datos de Contacto" />
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField fullWidth size="small" type="email" label="Correo Electrónico" value={form.email} onChange={setField("email")} onBlur={normalizeEmail} error={Boolean(errors.email)} helperText={errors.email} />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField fullWidth size="small" label="Teléfono Celular" value={form.telCelular} onChange={setField("telCelular")} />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField fullWidth size="small" label="Teléfono Fijo" value={form.telFijo} onChange={setField("telFijo")} />
          </Grid>
        </Grid>

        <Section title="Domicilio" />
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField fullWidth size="small" label="Calle" value={form.dirCalle} onChange={setField("dirCalle")} />
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <TextField fullWidth size="small" label="Altura / Nro" value={form.dirNro} onChange={setField("dirNro")} />
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <TextField fullWidth size="small" label="Piso" value={form.dirPiso} onChange={setField("dirPiso")} />
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <TextField fullWidth size="small" label="Depto / Oficina" value={form.dirDepto} onChange={setField("dirDepto")} />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Provincia</InputLabel>
              <Select label="Provincia" value={form.provinciaId} onChange={setField("provinciaId")}>
                <MenuItem value="">Sin provincia</MenuItem>
                {provincias.map((provincia) => (
                  <MenuItem key={provincia.id} value={provincia.id}>
                    {provincia.nombre}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <FormControl fullWidth size="small" disabled={!form.provinciaId}>
              <InputLabel>Localidad</InputLabel>
              <Select
                label="Localidad"
                value={form.localidadId}
                onChange={(event) => {
                  const value = event.target.value;
                  const selected = localidades.find((loc) => loc.id === value);
                  setForm((current) => ({
                    ...current,
                    localidadId: value,
                    codigoPostal: selected?.codigoPostal ?? "",
                  }));
                  setErrors((current) => ({ ...current, localidadId: "", codigoPostal: "" }));
                }}
              >
                <MenuItem value="">Sin localidad</MenuItem>
                {localidades.map((localidad) => (
                  <MenuItem key={localidad.id} value={localidad.id}>
                    {localidad.nombre}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              size="small"
              label="Código Postal"
              value={form.codigoPostal}
              InputProps={{ readOnly: true }}
              error={Boolean(errors.codigoPostal)}
              helperText={errors.codigoPostal || "Se completa automáticamente según la localidad"}
            />
          </Grid>
        </Grid>

        <Section title="Entrevista inicial" />
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12 }}>
            <TextField fullWidth multiline minRows={3} size="small" label="Entrevista inicial" value={form.observaciones} onChange={setField("observaciones")} />
          </Grid>
        </Grid>

        <Box sx={{ mt: 3, mb: 2 }}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            onClick={() => setContactosOpen((current) => !current)}
            sx={{ cursor: "pointer" }}
          >
            <Typography variant="subtitle1" sx={{ color: "primary.main", fontWeight: 900 }}>
              Contactos Secundarios
            </Typography>
            <IconButton size="small">
              {contactosOpen ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          </Stack>
          <Divider />
        </Box>
        <Collapse in={contactosOpen} unmountOnExit>
          <Paper elevation={0} sx={{ p: 2, borderRadius: "16px", border: "1px solid", borderColor: "divider", bgcolor: "background.default" }}>
            <Grid container spacing={1.5} alignItems="flex-start">
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField fullWidth size="small" label="Nombre" value={contactoForm.nombre} onChange={setContactoField("nombre")} error={Boolean(contactoErrors.nombre)} helperText={contactoErrors.nombre} />
              </Grid>
              <Grid size={{ xs: 12, md: 2 }}>
                <TextField fullWidth size="small" label="Rol" value={contactoForm.rol} onChange={setContactoField("rol")} />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField fullWidth size="small" label="Email" value={contactoForm.email} onChange={setContactoField("email")} onBlur={normalizeContactoEmail} error={Boolean(contactoErrors.email)} helperText={contactoErrors.email} />
              </Grid>
              <Grid size={{ xs: 12, md: 2 }}>
                <TextField fullWidth size="small" label="Teléfono" value={contactoForm.telefono} onChange={setContactoField("telefono")} />
              </Grid>
              <Grid size={{ xs: 12, md: 2 }}>
                <Button fullWidth variant="contained" startIcon={<Add />} onClick={handleGuardarContacto} disabled={contactosSaving} sx={{ borderRadius: "10px", fontWeight: 900, minHeight: 40 }}>
                  {editingContacto ? "Guardar" : "Añadir"}
                </Button>
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField fullWidth size="small" multiline minRows={2} label="Observaciones del contacto" value={contactoForm.observaciones} onChange={setContactoField("observaciones")} />
              </Grid>
            </Grid>

            {editingContacto && (
              <Button size="small" onClick={() => { setEditingContacto(null); setContactoForm(EMPTY_CONTACTO); }} sx={{ mt: 1, fontWeight: 800 }}>
                Cancelar edición de contacto
              </Button>
            )}

            {localContactos.length === 0 ? (
              <Typography variant="body2" sx={{ color: "text.secondary", mt: 2 }}>
                Todavía no hay contactos secundarios cargados.
              </Typography>
            ) : (
              <>
                {/* Desktop */}
                <TableContainer sx={{ mt: 2, display: { xs: "none", md: "block" } }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 900 }}>Nombre</TableCell>
                        <TableCell sx={{ fontWeight: 900 }}>Rol</TableCell>
                        <TableCell sx={{ fontWeight: 900 }}>Email</TableCell>
                        <TableCell sx={{ fontWeight: 900 }}>Teléfono</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 900 }}>Acciones</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {localContactos.map((contacto) => (
                        <TableRow key={contacto.id ?? contacto.localId}>
                          <TableCell>{contacto.nombre}</TableCell>
                          <TableCell>{contacto.rol || "Sin rol"}</TableCell>
                          <TableCell>{contacto.email || "Sin email"}</TableCell>
                          <TableCell>{contacto.telefono || "Sin teléfono"}</TableCell>
                          <TableCell align="right">
                            <Tooltip title="Editar contacto">
                              <IconButton size="small" color="primary" onClick={() => handleEditarContacto(contacto)}>
                                <Edit fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Eliminar contacto">
                              <IconButton size="small" color="error" onClick={() => handleEliminarContacto(contacto)}>
                                <Delete fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                {/* Mobile */}
                <Stack spacing={1} sx={{ mt: 2, display: { xs: "flex", md: "none" } }}>
                  {localContactos.map((contacto) => (
                    <Paper key={contacto.id ?? contacto.localId} elevation={0} sx={{ p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: "10px" }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 900 }}>{contacto.nombre}</Typography>
                          {contacto.rol && <Typography variant="caption" color="text.secondary">{contacto.rol}</Typography>}
                          <Stack direction="row" spacing={1.5} sx={{ mt: 0.5, flexWrap: "wrap", gap: 0.5 }}>
                            {contacto.email && <Typography variant="caption">{contacto.email}</Typography>}
                            {contacto.telefono && <Typography variant="caption">{contacto.telefono}</Typography>}
                          </Stack>
                        </Box>
                        <Stack direction="row">
                          <IconButton size="small" color="primary" onClick={() => handleEditarContacto(contacto)}>
                            <Edit fontSize="small" />
                          </IconButton>
                          <IconButton size="small" color="error" onClick={() => handleEliminarContacto(contacto)}>
                            <Delete fontSize="small" />
                          </IconButton>
                        </Stack>
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              </>
            )}
          </Paper>
        </Collapse>

        {isEdit && (
          <Box sx={{ mt: 3 }}>
            <FormControlLabel control={<Switch checked={Boolean(form.activo)} onChange={setField("activo")} />} label="Cliente Activo" />
          </Box>
        )}

        <Divider sx={{ my: 3 }} />
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} justifyContent="flex-end">
          <Button variant="outlined" onClick={() => navigate("/clientes")} disabled={saveMutation.isPending} sx={{ borderRadius: "10px", fontWeight: 800 }}>
            Cancelar
          </Button>
          <Button type="submit" variant="contained" startIcon={!saveMutation.isPending ? <Save /> : null} disabled={saveMutation.isPending} sx={{ borderRadius: "10px", fontWeight: 900, minWidth: 170 }}>
            {saveMutation.isPending ? <CircularProgress size={20} color="inherit" /> : isEdit ? "Guardar Cambios" : "Crear Cliente"}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}

function Section({ title }) {
  return (
    <Box sx={{ mt: 3, mb: 2, "&:first-of-type": { mt: 0 } }}>
      <Typography variant="subtitle1" sx={{ color: "primary.main", fontWeight: 900, mb: 1 }}>
        {title}
      </Typography>
      <Divider />
    </Box>
  );
}
