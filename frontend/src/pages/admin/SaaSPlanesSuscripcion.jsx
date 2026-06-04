import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { alpha, useTheme } from "@mui/material/styles";
import {
  Add,
  Edit,
  Payments,
  PeopleAltOutlined,
  Save,
  Search,
  StorageOutlined,
} from "@mui/icons-material";
import {
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Paper,
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
  useMediaQuery,
} from "@mui/material";
import {
  createAdminPlanSuscripcion,
  fetchAdminPlanesSuscripcion,
  toggleAdminPlanSuscripcion,
  updateAdminPlanSuscripcion,
} from "../../api/admin";
import { formatNumber, panelSx, planChipSx } from "./adminUi";

const EMPTY_FORM = {
  codigo: "",
  nombre: "",
  maxUsuarios: "1",
  almacenamientoGb: "5",
  precioMensualArs: "0.00",
  activo: true,
};

function formatMoney(value) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 }).format(Number(value || 0));
}

function normalizeDecimal(value) {
  return String(value ?? "").replace(",", ".").trim();
}

export default function SaaSPlanesSuscripcion() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});

  const planesQuery = useQuery({
    queryKey: ["admin", "planes-suscripcion"],
    queryFn: fetchAdminPlanesSuscripcion,
    staleTime: 60_000,
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        codigo: form.codigo.trim().toUpperCase(),
        nombre: form.nombre.trim(),
        maxUsuarios: Number(form.maxUsuarios),
        almacenamientoGb: Number(form.almacenamientoGb),
        precioMensualArs: normalizeDecimal(form.precioMensualArs),
        activo: Boolean(form.activo),
      };
      return editing ? updateAdminPlanSuscripcion(editing.id, payload) : createAdminPlanSuscripcion(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "planes-suscripcion"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "estudios"] });
      enqueueSnackbar(editing ? "Plan actualizado" : "Plan creado", { variant: "success" });
      closeDialog();
    },
    onError: (error) => enqueueSnackbar(error.response?.data?.error?.message || "No se pudo guardar el plan", { variant: "error" }),
  });

  const toggleMutation = useMutation({
    mutationFn: toggleAdminPlanSuscripcion,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "planes-suscripcion"] });
      enqueueSnackbar("Estado del plan actualizado", { variant: "success" });
    },
    onError: () => enqueueSnackbar("No se pudo actualizar el estado", { variant: "error" }),
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (planesQuery.data ?? []).filter((plan) => {
      const text = [plan.codigo, plan.nombre].filter(Boolean).join(" ").toLowerCase();
      return !q || text.includes(q);
    });
  }, [planesQuery.data, search]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setDialogOpen(true);
  };

  const openEdit = (plan) => {
    setEditing(plan);
    setForm({
      codigo: plan.codigo ?? "",
      nombre: plan.nombre ?? "",
      maxUsuarios: String(plan.maxUsuarios ?? 1),
      almacenamientoGb: String(plan.almacenamientoGb ?? 5),
      precioMensualArs: String(plan.precioMensualArs ?? "0.00"),
      activo: Boolean(plan.activo),
    });
    setErrors({});
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setDialogOpen(false);
  };

  const setField = (field) => (event) => {
    const value = field === "activo" ? event.target.checked : event.target.value;
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const validate = () => {
    const next = {};
    if (!form.codigo.trim()) next.codigo = "Indicá un código";
    if (!form.nombre.trim()) next.nombre = "Indicá un nombre";
    if (Number(form.maxUsuarios) <= 0) next.maxUsuarios = "Debe ser mayor a 0";
    if (Number(form.almacenamientoGb) <= 0) next.almacenamientoGb = "Debe ser mayor a 0";
    if (!Number.isFinite(Number(normalizeDecimal(form.precioMensualArs)))) next.precioMensualArs = "Monto inválido";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!validate()) return;
    saveMutation.mutate();
  };

  return (
    <Box>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }} spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            Planes de Suscripción
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
            Montos comerciales y límites por defecto para altas de estudios.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={openCreate} sx={{ borderRadius: "12px", fontWeight: 800 }}>
          Nuevo Plan
        </Button>
      </Stack>

      <Paper elevation={0} sx={panelSx(theme, { p: 2.2, mb: 2 })}>
        <TextField
          fullWidth
          size="small"
          placeholder="Buscar por código o nombre..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          InputProps={{ startAdornment: <Search sx={{ color: "text.disabled", mr: 1 }} /> }}
        />
      </Paper>

      {isMobile ? (
        <Stack spacing={1.5}>
          {rows.map((plan) => (
            <PlanCard key={plan.id} plan={plan} theme={theme} onEdit={openEdit} onToggle={toggleMutation.mutate} toggling={toggleMutation.isPending} />
          ))}
        </Stack>
      ) : (
        <Paper elevation={0} sx={panelSx(theme, { overflow: "hidden" })}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.08 : 0.05) }}>
                  <TableCell sx={{ fontWeight: 800 }}>Plan</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Precio mensual</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Usuarios</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Almacenamiento</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Estado</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800 }}>Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((plan) => (
                  <TableRow key={plan.id} hover sx={{ "& td": { py: 0.9, px: 2 } }}>
                    <TableCell>
                      <Stack direction="row" spacing={1.4} alignItems="center">
                        <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.12), color: "primary.main" }}>
                          <Payments />
                        </Avatar>
                        <Box>
                          <Chip label={plan.codigo} size="small" sx={planChipSx(plan.codigo, theme)} />
                          <Typography variant="body2" sx={{ fontWeight: 800, mt: 0.7 }}>{plan.nombre}</Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 900 }}>{formatMoney(plan.precioMensualArs)}</Typography>
                    </TableCell>
                    <TableCell>{formatNumber(plan.maxUsuarios)}</TableCell>
                    <TableCell>{formatNumber(plan.almacenamientoGb)} GB</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Switch checked={Boolean(plan.activo)} onChange={() => toggleMutation.mutate(plan.id)} disabled={toggleMutation.isPending} />
                        <Typography variant="caption" sx={{ fontWeight: 700, color: plan.activo ? "success.main" : "text.secondary" }}>
                          {plan.activo ? "Activo" : "Inactivo"}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Editar">
                        <IconButton onClick={() => openEdit(plan)}>
                          <Edit />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                {!rows.length && (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                      <Typography variant="body2" sx={{ color: "text.secondary", fontWeight: 600 }}>
                        No hay planes para mostrar.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="md" PaperProps={{ sx: { borderRadius: "16px", boxShadow: "none" } }}>
        <Box component="form" onSubmit={handleSubmit}>
          <DialogTitle sx={{ fontWeight: 900 }}>{editing ? "Editar Plan" : "Nuevo Plan"}</DialogTitle>
          <DialogContent>
            <Stack spacing={2.2} sx={{ pt: 1 }}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField label="Código" value={form.codigo} onChange={setField("codigo")} error={Boolean(errors.codigo)} helperText={errors.codigo} fullWidth />
                <TextField label="Nombre comercial" value={form.nombre} onChange={setField("nombre")} error={Boolean(errors.nombre)} helperText={errors.nombre} fullWidth />
              </Stack>
              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField type="number" label="Usuarios incluidos" value={form.maxUsuarios} onChange={setField("maxUsuarios")} error={Boolean(errors.maxUsuarios)} helperText={errors.maxUsuarios} inputProps={{ min: 1 }} fullWidth InputProps={{ startAdornment: <InputAdornment position="start"><PeopleAltOutlined fontSize="small" /></InputAdornment> }} />
                <TextField type="number" label="Almacenamiento" value={form.almacenamientoGb} onChange={setField("almacenamientoGb")} error={Boolean(errors.almacenamientoGb)} helperText={errors.almacenamientoGb} inputProps={{ min: 1 }} fullWidth InputProps={{ startAdornment: <InputAdornment position="start"><StorageOutlined fontSize="small" /></InputAdornment>, endAdornment: <InputAdornment position="end">GB</InputAdornment> }} />
              </Stack>
              <TextField label="Precio mensual ARS" value={form.precioMensualArs} onChange={setField("precioMensualArs")} error={Boolean(errors.precioMensualArs)} helperText={errors.precioMensualArs} fullWidth InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }} />
              <Stack direction="row" spacing={1} alignItems="center">
                <Switch checked={Boolean(form.activo)} onChange={setField("activo")} />
                <Typography variant="body2" sx={{ fontWeight: 800 }}>Plan activo para nuevas altas</Typography>
              </Stack>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button onClick={closeDialog} sx={{ borderRadius: "12px", fontWeight: 800 }}>Cancelar</Button>
            <Button type="submit" variant="contained" startIcon={<Save />} disabled={saveMutation.isPending} sx={{ borderRadius: "12px", fontWeight: 800 }}>
              {saveMutation.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}

function PlanCard({ plan, theme, onEdit, onToggle, toggling }) {
  return (
    <Paper elevation={0} sx={panelSx(theme, { p: 2 })}>
      <Stack spacing={1.5}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
          <Box>
            <Chip label={plan.codigo} size="small" sx={planChipSx(plan.codigo, theme)} />
            <Typography variant="body1" sx={{ fontWeight: 900, mt: 1 }}>{plan.nombre}</Typography>
          </Box>
          <IconButton onClick={() => onEdit(plan)}><Edit /></IconButton>
        </Stack>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip label={`${formatNumber(plan.maxUsuarios)} usuarios`} size="small" />
          <Chip label={`${formatNumber(plan.almacenamientoGb)} GB`} size="small" />
        </Stack>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="body2" sx={{ fontWeight: 900 }}>{formatMoney(plan.precioMensualArs)}</Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Switch checked={Boolean(plan.activo)} onChange={() => onToggle(plan.id)} disabled={toggling} />
            <Typography variant="caption" sx={{ fontWeight: 700, color: plan.activo ? "success.main" : "text.secondary" }}>
              {plan.activo ? "Activo" : "Inactivo"}
            </Typography>
          </Stack>
        </Stack>
      </Stack>
    </Paper>
  );
}
