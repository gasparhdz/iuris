import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { useTheme } from "@mui/material/styles";
import {
  Box,
  Button,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { ArrowBack, Save } from "@mui/icons-material";
import {
  createAdminEstudio,
  fetchAdminEstudio,
  fetchAdminPlanesSuscripcion,
  updateAdminEstudio,
} from "../../api/admin";
import { panelSx } from "./adminUi";

const EMPTY_FORM = {
  nombre: "",
  cuit: "",
  emailAdmin: "",
  telefono: "",
  plan: "SOLO",
  maxUsuarios: "1",
  almacenamientoGb: "5",
  nombreUsuario: "",
  apellidoUsuario: "",
  emailUsuario: "",
  password: "",
  driveFolderId: "",
};

export default function SaaSEstudioForm() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const isEdit = Boolean(id);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});

  const estudioQuery = useQuery({
    queryKey: ["admin", "estudios", id],
    queryFn: () => fetchAdminEstudio(id),
    enabled: isEdit,
    staleTime: 60_000,
  });

  const planesQuery = useQuery({
    queryKey: ["admin", "planes-suscripcion"],
    queryFn: fetchAdminPlanesSuscripcion,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!estudioQuery.data) return;
    setForm({
      nombre: estudioQuery.data.nombre ?? "",
      cuit: estudioQuery.data.cuit ?? "",
      emailAdmin: estudioQuery.data.emailAdmin ?? "",
      telefono: estudioQuery.data.telefono ?? "",
      plan: estudioQuery.data.plan ?? "SOLO",
      maxUsuarios: String(estudioQuery.data.maxUsuarios ?? 1),
      almacenamientoGb: String(estudioQuery.data.almacenamientoGb ?? 5),
      nombreUsuario: "",
      apellidoUsuario: "",
      emailUsuario: "",
      password: "",
      driveFolderId: estudioQuery.data.driveFolderId ?? "",
    });
  }, [estudioQuery.data]);

  const title = useMemo(() => isEdit ? "Editar Estudio" : "Registrar Nuevo Estudio", [isEdit]);

  const setField = (field) => (event) => {
    const value = event.target.value;
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handlePlanChange = (event) => {
    const planCode = event.target.value;
    const selected = (planesQuery.data ?? []).find((plan) => plan.codigo === planCode);
    setForm((current) => ({
      ...current,
      plan: planCode,
      maxUsuarios: selected ? String(selected.maxUsuarios) : current.maxUsuarios,
      almacenamientoGb: selected ? String(selected.almacenamientoGb) : current.almacenamientoGb,
    }));
  };

  const validate = () => {
    const next = {};
    if (!form.nombre.trim()) next.nombre = "El nombre comercial es requerido";
    if (!form.emailAdmin.trim()) next.emailAdmin = "El email administrativo es requerido";
    if (Number(form.maxUsuarios) <= 0) next.maxUsuarios = "Indicá un límite válido";
    if (Number(form.almacenamientoGb) <= 0) next.almacenamientoGb = "Indicá almacenamiento válido";
    if (!isEdit) {
      if (!form.nombreUsuario.trim()) next.nombreUsuario = "El nombre del administrador es requerido";
      if (!form.apellidoUsuario.trim()) next.apellidoUsuario = "El apellido del administrador es requerido";
      if (!form.emailUsuario.trim()) next.emailUsuario = "El email de acceso es requerido";
      if (!form.password || form.password.length < 6) next.password = "La contraseña debe tener al menos 6 caracteres";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        nombre: form.nombre.trim(),
        emailAdmin: form.emailAdmin.trim(),
        cuit: form.cuit.trim() || null,
        telefono: form.telefono.trim() || null,
        maxUsuarios: Number(form.maxUsuarios),
        almacenamientoGb: Number(form.almacenamientoGb),
        driveFolderId: form.driveFolderId.trim() || null,
      };
      if (!isEdit) {
        payload.nombreUsuario = form.nombreUsuario.trim();
        payload.apellidoUsuario = form.apellidoUsuario.trim();
        payload.emailUsuario = form.emailUsuario.trim();
        payload.password = form.password;
      }
      return isEdit ? updateAdminEstudio(id, payload) : createAdminEstudio(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "estudios"] });
      enqueueSnackbar(isEdit ? "Configuración guardada" : "Estudio registrado", { variant: "success" });
      navigate("/admin/estudios");
    },
    onError: () => enqueueSnackbar("No se pudo guardar el estudio", { variant: "error" }),
  });

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!validate()) return;
    saveMutation.mutate();
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 3 }}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate("/admin/estudios")} sx={{ borderRadius: "12px", fontWeight: 800 }}>
          Volver
        </Button>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            {title}
          </Typography>
        </Box>
      </Stack>

      <Paper elevation={0} sx={panelSx(theme, { p: { xs: 2.5, md: 3 } })}>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>
          Datos del Estudio
        </Typography>
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField fullWidth label="Nombre comercial" value={form.nombre} onChange={setField("nombre")} error={Boolean(errors.nombre)} helperText={errors.nombre} required />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField fullWidth label="CUIT/CUIL" value={form.cuit} onChange={setField("cuit")} />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              type="email"
              label="Email administrativo de facturación"
              value={form.emailAdmin}
              onChange={(event) => {
                const value = event.target.value;
                setForm((current) => ({
                  ...current,
                  emailAdmin: value,
                  emailUsuario: !isEdit && !current.emailUsuario ? value : current.emailUsuario,
                }));
                setErrors((current) => ({ ...current, emailAdmin: undefined }));
              }}
              error={Boolean(errors.emailAdmin)}
              helperText={errors.emailAdmin}
              required
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField fullWidth label="Teléfono de contacto" value={form.telefono} onChange={setField("telefono")} />
          </Grid>

          <Grid size={{ xs: 12 }}>
            <Typography variant="h6" sx={{ fontWeight: 800, mt: 1 }}>
              Almacenamiento y Google Drive
            </Typography>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField
              fullWidth
              size="small"
              label="ID Carpeta de Google Drive (Personalizado)"
              value={form.driveFolderId}
              onChange={setField("driveFolderId")}
              helperText="Dejar vacío para crear automáticamente una subcarpeta en el Google Drive central del sistema. Pegar un ID de carpeta propia si el estudio usará su propio Drive (debe estar compartido con la Cuenta de Servicio)."
            />
          </Grid>

          <Grid size={{ xs: 12 }}>
            <Typography variant="h6" sx={{ fontWeight: 800, mt: 1 }}>
              Configuración de Plan
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <FormControl fullWidth>
              <InputLabel>Plan</InputLabel>
              <Select label="Plan" value={form.plan} onChange={handlePlanChange}>
                {(planesQuery.data ?? []).map((plan) => (
                  <MenuItem key={plan.id} value={plan.codigo}>
                    {plan.codigo} - {plan.nombre}
                  </MenuItem>
                ))}
                {planesQuery.isLoading && <MenuItem value={form.plan}>{form.plan}</MenuItem>}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              type="number"
              label="Cantidad máxima de usuarios"
              value={form.maxUsuarios}
              onChange={setField("maxUsuarios")}
              error={Boolean(errors.maxUsuarios)}
              helperText={errors.maxUsuarios}
              inputProps={{ min: 1 }}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              type="number"
              label="Almacenamiento"
              value={form.almacenamientoGb}
              onChange={setField("almacenamientoGb")}
              error={Boolean(errors.almacenamientoGb)}
              helperText={errors.almacenamientoGb}
              inputProps={{ min: 1 }}
              InputProps={{ endAdornment: <InputAdornment position="end">GB</InputAdornment> }}
            />
          </Grid>
          {!isEdit && (
            <>
              <Grid size={{ xs: 12 }}>
                <Typography variant="h6" sx={{ fontWeight: 800, mt: 1 }}>
                  Usuario Administrador Inicial
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField fullWidth label="Nombre del director" value={form.nombreUsuario} onChange={setField("nombreUsuario")} error={Boolean(errors.nombreUsuario)} helperText={errors.nombreUsuario} required />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField fullWidth label="Apellido del director" value={form.apellidoUsuario} onChange={setField("apellidoUsuario")} error={Boolean(errors.apellidoUsuario)} helperText={errors.apellidoUsuario} required />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField fullWidth type="email" label="Email de acceso" value={form.emailUsuario} onChange={setField("emailUsuario")} error={Boolean(errors.emailUsuario)} helperText={errors.emailUsuario} required />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField fullWidth type="password" label="Contraseña inicial" value={form.password} onChange={setField("password")} error={Boolean(errors.password)} helperText={errors.password} required />
              </Grid>
            </>
          )}
        </Grid>

        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="flex-end" spacing={1.2} sx={{ mt: 3 }}>
          <Button variant="outlined" onClick={() => navigate("/admin/estudios")} sx={{ borderRadius: "12px", fontWeight: 800 }}>
            Cancelar
          </Button>
          <Button type="submit" variant="contained" startIcon={<Save />} disabled={saveMutation.isPending} sx={{ borderRadius: "12px", fontWeight: 800 }}>
            {saveMutation.isPending ? "Guardando..." : isEdit ? "Guardar Configuración" : "Registrar Estudio"}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}

