import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { alpha, useTheme } from "@mui/material/styles";
import {
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
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
  useMediaQuery,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import {
  Add,
  ArrowBack,
  Delete,
  Edit,
  Person,
  Search,
} from "@mui/icons-material";
import {
  createAdminUsuarioEstudio,
  deleteAdminUsuarioEstudio,
  fetchAdminEstudio,
  fetchAdminUsuariosEstudio,
  toggleAdminUsuarioEstudio,
  updateAdminUsuarioEstudio,
} from "../../api/admin";
import { panelSx } from "./adminUi";

const EMPTY_USER = {
  nombre: "",
  apellido: "",
  email: "",
  dni: "",
  telefono: "",
  password: "",
  rol: "ABOGADO",
};

const roleLabels = {
  DIRECTOR: "Director",
  ABOGADO: "Abogado",
  ASISTENTE: "Asistente",
  ASESOR_FINANCIERO: "Asesor Financiero",
};

const roleColors = {
  DIRECTOR: "warning",
  ABOGADO: "primary",
  ASISTENTE: "primary",
  ASESOR_FINANCIERO: "success",
};

function normalizeRole(value) {
  return String(value || "ABOGADO").replace(/\s+/g, "_").toUpperCase();
}

function roleChipSx(role, theme) {
  const code = normalizeRole(role);
  const tone = roleColors[code] ?? "text";
  const color = tone === "text" ? theme.palette.text.secondary : theme.palette[tone].main;
  return {
    bgcolor: alpha(color, theme.palette.mode === "dark" ? 0.16 : 0.1),
    color: tone === "text" ? "text.secondary" : `${tone}.main`,
    border: `1px solid ${alpha(color, theme.palette.mode === "dark" ? 0.32 : 0.24)}`,
    fontWeight: 800,
  };
}

function initials(user) {
  return `${user?.nombre?.[0] ?? ""}${user?.apellido?.[0] ?? ""}`.toUpperCase() || "U";
}

function apiError(error, fallback) {
  return error?.response?.data?.error?.message ?? error?.response?.data?.message ?? fallback;
}

export default function SaaSEstudioUsuarios() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const { id: estudioId } = useParams();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_USER);
  const [errors, setErrors] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);

  const estudioQuery = useQuery({
    queryKey: ["admin", "estudios", estudioId],
    queryFn: () => fetchAdminEstudio(estudioId),
    staleTime: 60_000,
  });

  const usuariosQuery = useQuery({
    queryKey: ["admin", "usuarios", estudioId],
    queryFn: () => fetchAdminUsuariosEstudio(estudioId),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!showForm) return;
    if (!editing) {
      setForm(EMPTY_USER);
      setErrors({});
      return;
    }
    setForm({
      nombre: editing.nombre ?? "",
      apellido: editing.apellido ?? "",
      email: editing.email ?? "",
      dni: editing.dni ?? "",
      telefono: editing.telefono ?? "",
      password: "",
      rol: normalizeRole(editing.roles?.[0] || "ABOGADO"),
    });
    setErrors({});
  }, [editing, showForm]);

  const users = usuariosQuery.data ?? [];
  const maxUsuarios = Number(estudioQuery.data?.maxUsuarios || 0);
  const limitReached = maxUsuarios > 0 && users.length >= maxUsuarios;
  const limitMessage = maxUsuarios ? `Límite de usuarios del plan alcanzado (${maxUsuarios}).` : "";
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((user) => {
      const text = [user.nombre, user.apellido, user.email, user.telefono, ...(user.roles ?? [])].filter(Boolean).join(" ").toLowerCase();
      return !q || text.includes(q);
    });
  }, [search, users]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin", "usuarios", estudioId] });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { ...form };
      if (editing && !payload.password) delete payload.password;
      return editing
        ? updateAdminUsuarioEstudio(estudioId, editing.id, payload)
        : createAdminUsuarioEstudio(estudioId, payload);
    },
    onSuccess: () => {
      enqueueSnackbar(editing ? "Usuario actualizado" : "Usuario registrado", { variant: "success" });
      setShowForm(false);
      setEditing(null);
      invalidate();
    },
    onError: (error) => enqueueSnackbar(apiError(error, "No se pudo guardar el usuario"), { variant: "error" }),
  });

  const toggleMutation = useMutation({
    mutationFn: (usuarioId) => toggleAdminUsuarioEstudio(estudioId, usuarioId),
    onSuccess: () => {
      enqueueSnackbar("Estado de cuenta actualizado", { variant: "success" });
      invalidate();
    },
    onError: (error) => enqueueSnackbar(apiError(error, "No se pudo actualizar el usuario"), { variant: "error" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (usuarioId) => deleteAdminUsuarioEstudio(estudioId, usuarioId),
    onSuccess: () => {
      enqueueSnackbar("Usuario eliminado", { variant: "success" });
      setDeleteTarget(null);
      invalidate();
    },
    onError: (error) => enqueueSnackbar(apiError(error, "No se pudo eliminar el usuario"), { variant: "error" }),
  });

  const setField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const validate = () => {
    const next = {};
    if (!form.nombre.trim()) next.nombre = "Indicá el nombre";
    if (!form.apellido.trim()) next.apellido = "Indicá el apellido";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = "Email inválido";
    if (!editing && !form.password) next.password = "Indicá una contraseña inicial";
    if (form.password && form.password.length < 6) next.password = "Mínimo 6 caracteres";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    saveMutation.mutate();
  };

  const openCreate = () => {
    if (limitReached) return;
    setEditing(null);
    setShowForm("create");
  };

  const openEdit = (user) => {
    setEditing(user);
    setShowForm("edit");
  };

  return (
    <Box>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }} spacing={2} sx={{ mb: 3 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Button startIcon={<ArrowBack />} onClick={() => navigate("/admin/estudios")} sx={{ borderRadius: "12px", fontWeight: 800 }}>
            Volver
          </Button>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>
              Gestionar Usuarios
            </Typography>
          </Box>
        </Stack>
        {!showForm && (
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }} sx={{ width: { xs: "100%", sm: "auto" } }}>
            {limitReached && (
              <Typography variant="caption" sx={{ color: "warning.main", fontWeight: 700 }}>
                {limitMessage}
              </Typography>
            )}
            <Tooltip title={limitReached ? limitMessage : ""}>
              <Box component="span" sx={{ display: { xs: "block", sm: "inline-block" }, width: { xs: "100%", sm: "auto" } }}>
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={openCreate}
                  disabled={limitReached}
                  sx={{ borderRadius: "12px", fontWeight: 800, width: { xs: "100%", sm: "auto" } }}
                >
                  Registrar Nuevo Usuario
                </Button>
              </Box>
            </Tooltip>
          </Stack>
        )}
      </Stack>

      {showForm ? (
        <Paper elevation={0} sx={panelSx(theme, { p: { xs: 2.5, md: 3 } })}>
          <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }} spacing={2} sx={{ mb: 2.5 }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                {editing ? "Editar Usuario" : "Registrar Usuario"}
              </Typography>
            </Box>
            <Button
              startIcon={<ArrowBack />}
              onClick={() => {
                setShowForm(false);
                setEditing(null);
              }}
              sx={{ borderRadius: "12px", fontWeight: 800 }}
            >
              Volver
            </Button>
          </Stack>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField fullWidth label="Nombre" value={form.nombre} onChange={setField("nombre")} error={Boolean(errors.nombre)} helperText={errors.nombre} required />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField fullWidth label="Apellido" value={form.apellido} onChange={setField("apellido")} error={Boolean(errors.apellido)} helperText={errors.apellido} required />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField fullWidth type="email" label="Email" value={form.email} onChange={setField("email")} error={Boolean(errors.email)} helperText={errors.email} required />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField fullWidth label="DNI / CUIL" value={form.dni} onChange={setField("dni")} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField fullWidth label="Teléfono" value={form.telefono} onChange={setField("telefono")} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField fullWidth type="password" label={editing ? "Nueva contraseña (opcional)" : "Contraseña"} value={form.password} onChange={setField("password")} error={Boolean(errors.password)} helperText={errors.password} required={!editing} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Rol</InputLabel>
                <Select label="Rol" value={form.rol} onChange={setField("rol")}>
                  <MenuItem value="DIRECTOR">Director</MenuItem>
                  <MenuItem value="ABOGADO">Abogado</MenuItem>
                  <MenuItem value="ASISTENTE">Asistente</MenuItem>
                  <MenuItem value="ASESOR_FINANCIERO">Asesor Financiero</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
          <Stack direction={{ xs: "column", sm: "row" }} justifyContent="flex-end" spacing={1.2} sx={{ mt: 3 }}>
            <Button
              variant="outlined"
              onClick={() => {
                setShowForm(false);
                setEditing(null);
              }}
              sx={{ borderRadius: "12px", fontWeight: 800 }}
            >
              Cancelar
            </Button>
            <Button variant="contained" onClick={handleSave} disabled={saveMutation.isPending} sx={{ borderRadius: "12px", fontWeight: 800 }}>
              {saveMutation.isPending ? "Guardando..." : editing ? "Guardar Cambios" : "Registrar"}
            </Button>
          </Stack>
        </Paper>
      ) : (
        <>
          <Paper elevation={0} sx={panelSx(theme, { p: 2.2, mb: 2 })}>
            <TextField
              fullWidth
              size="small"
              placeholder="Buscar por nombre, email o rol..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              InputProps={{ startAdornment: <Search sx={{ color: "text.disabled", mr: 1 }} /> }}
            />
          </Paper>

          {isMobile ? (
            <Stack spacing={1.5}>
              {filtered.map((user) => {
                const role = normalizeRole(user.roles?.[0]);
                return (
                  <Paper key={user.id} elevation={0} sx={panelSx(theme, { p: 2 })}>
                    <Stack spacing={1.5}>
                      <Stack direction="row" spacing={1.25} alignItems="flex-start" sx={{ minWidth: 0 }}>
                        <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.12), color: "primary.main", fontWeight: 800 }}>
                          {initials(user)}
                        </Avatar>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body1" sx={{ fontWeight: 800 }} noWrap>
                            {user.nombre} {user.apellido}
                          </Typography>
                          <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }} noWrap>
                            {user.email}
                          </Typography>
                        </Box>
                      </Stack>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                        <Chip label={roleLabels[role] || role} size="small" sx={roleChipSx(role, theme)} />
                        <Typography variant="caption" sx={{ color: "text.secondary" }}>
                          {user.telefono || "Sin teléfono"}
                        </Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Switch color="primary" checked={Boolean(user.activo)} onChange={() => toggleMutation.mutate(user.id)} disabled={toggleMutation.isPending} />
                          <Typography variant="caption" sx={{ fontWeight: 800, color: user.activo ? "success.main" : "text.secondary" }}>
                            {user.activo ? "Activo" : "Suspendido"}
                          </Typography>
                        </Stack>
                        <Stack direction="row" spacing={0.5}>
                          <Tooltip title="Editar">
                            <IconButton onClick={() => openEdit(user)}>
                              <Edit />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Eliminar">
                            <IconButton onClick={() => setDeleteTarget(user)} sx={{ color: "error.main" }}>
                              <Delete />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </Stack>
                    </Stack>
                  </Paper>
                );
              })}
              {!filtered.length && (
                <Paper elevation={0} sx={panelSx(theme, { p: 4, textAlign: "center" })}>
                  <Person sx={{ color: "text.disabled", mb: 1 }} />
                  <Typography variant="body2" sx={{ color: "text.secondary", fontWeight: 800 }}>
                    No hay usuarios registrados para este estudio.
                  </Typography>
                </Paper>
              )}
            </Stack>
          ) : (
            <Paper elevation={0} sx={panelSx(theme, { overflow: "hidden" })}>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.08 : 0.05) }}>
                      <TableCell sx={{ fontWeight: 800 }}>Usuario</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>Email / Contacto</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>DNI / Documento</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>Rol Asignado</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>Estado de Cuenta</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800 }}>Acciones</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filtered.map((user) => {
                      const role = normalizeRole(user.roles?.[0]);
                      return (
                        <TableRow key={user.id} hover sx={{ "& td": { py: 0.75, px: 2 } }}>
                        <TableCell>
                          <Stack direction="row" spacing={1.4} alignItems="center">
                            <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.12), color: "primary.main", fontWeight: 800 }}>
                              {initials(user)}
                            </Avatar>
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 800 }}>
                                {user.nombre} {user.apellido}
                              </Typography>
                              <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
                                ID #{user.id}
                              </Typography>
                            </Box>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 800 }}>
                            {user.email}
                          </Typography>
                          <Typography variant="caption" sx={{ color: "text.secondary" }}>
                            {user.telefono || "Sin teléfono"}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 800 }}>
                            {user.dni || "Sin informar"}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip label={roleLabels[role] || role} size="small" sx={roleChipSx(role, theme)} />
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Switch color="primary" checked={Boolean(user.activo)} onChange={() => toggleMutation.mutate(user.id)} disabled={toggleMutation.isPending} />
                            <Typography variant="caption" sx={{ fontWeight: 800, color: user.activo ? "success.main" : "text.secondary" }}>
                              {user.activo ? "Activo" : "Suspendido"}
                            </Typography>
                          </Stack>
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title="Editar">
                            <IconButton onClick={() => openEdit(user)}>
                              <Edit />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Eliminar">
                            <IconButton onClick={() => setDeleteTarget(user)} sx={{ color: "error.main" }}>
                              <Delete />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                        </TableRow>
                      );
                    })}
                    {!filtered.length && (
                      <TableRow>
                        <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                          <Person sx={{ color: "text.disabled", mb: 1 }} />
                          <Typography variant="body2" sx={{ color: "text.secondary", fontWeight: 800 }}>
                            No hay usuarios registrados para este estudio.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}
        </>
      )}

      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} PaperProps={{ sx: { borderRadius: "16px", width: "100%", maxWidth: 420, boxShadow: "none" } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>Eliminar usuario</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            ¿Querés eliminar el acceso de {deleteTarget?.nombre} {deleteTarget?.apellido}? Esta acción realiza una baja lógica.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setDeleteTarget(null)} sx={{ borderRadius: "12px", fontWeight: 800 }}>
            Cancelar
          </Button>
          <Button color="error" variant="contained" onClick={() => deleteMutation.mutate(deleteTarget.id)} disabled={deleteMutation.isPending} sx={{ borderRadius: "12px", fontWeight: 800 }}>
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

