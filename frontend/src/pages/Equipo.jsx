import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { alpha, useTheme } from "@mui/material/styles";
import { denseTableSx, tableHeadCellSx } from "../theme/tableStyles";
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
import { Add, ArrowBack, Delete, Edit, Person, Search } from "@mui/icons-material";
import {
  createEquipoUsuario,
  deleteEquipoUsuario,
  fetchEquipoUsuarios,
  toggleEquipoUsuario,
  updateEquipoUsuario,
} from "../api/equipo";
import { useAuth } from "../auth/useAuth";

const MAX_USUARIOS_PLAN = 10;

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

const panelStyle = {
  borderRadius: "16px",
  border: "1px solid",
  borderColor: "divider",
  bgcolor: "background.paper",
};

function normalizeRole(value) {
  return String(value || "ABOGADO").replace(/\s+/g, "_").toUpperCase();
}

function hasDirectorRole(user) {
  const userRol = String(user?.rol ?? "").toUpperCase();
  const userRoles = Array.isArray(user?.roles) ? user.roles.map((role) => String(role).toUpperCase()) : [];
  return userRol === "DIRECTOR" || userRoles.includes("DIRECTOR");
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

function formatLastLogin(value) {
  if (!value) return "Nunca";
  return new Date(value).toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function Equipo() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuth();
  const isDirector = hasDirectorRole(user);
  const currentUserId = Number(user?.id);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_USER);
  const [errors, setErrors] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    if (user && !isDirector) {
      navigate("/", { replace: true });
    }
  }, [user, isDirector, navigate]);

  const usuariosQuery = useQuery({
    queryKey: ["equipo", "usuarios"],
    queryFn: fetchEquipoUsuarios,
    enabled: Boolean(user && isDirector),
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

  const users = useMemo(() => usuariosQuery.data ?? [], [usuariosQuery.data]);
  const activeCount = users.filter((item) => item.activo && !item.deletedAt).length;
  const limitReached = activeCount >= MAX_USUARIOS_PLAN;
  const limitMessage = `Limite de usuarios del plan alcanzado (${MAX_USUARIOS_PLAN}).`;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((item) => {
      const text = [item.nombre, item.apellido, item.email, item.telefono, item.dni, ...(item.roles ?? [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return !q || text.includes(q);
    });
  }, [search, users]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["equipo", "usuarios"] });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { ...form };
      if (editing) delete payload.password;
      return editing ? updateEquipoUsuario(editing.id, payload) : createEquipoUsuario(payload);
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
    mutationFn: (usuarioId) => toggleEquipoUsuario(usuarioId),
    onSuccess: () => {
      enqueueSnackbar("Estado de cuenta actualizado", { variant: "success" });
      invalidate();
    },
    onError: (error) => enqueueSnackbar(apiError(error, "No se pudo actualizar el usuario"), { variant: "error" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (usuarioId) => deleteEquipoUsuario(usuarioId),
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
    if (!form.nombre.trim()) next.nombre = "Indica el nombre";
    if (!form.apellido.trim()) next.apellido = "Indica el apellido";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = "Email invalido";
    if (!editing && !form.password) next.password = "Indica una contrasena inicial";
    if (!editing && form.password && form.password.length < 6) next.password = "Minimo 6 caracteres";
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

  const openEdit = (item) => {
    setEditing(item);
    setShowForm("edit");
  };

  const isSelf = (item) => Number(item?.id) === currentUserId;

  if (user && !isDirector) return null;

  return (
    <Box>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }} spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            Mi Equipo
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", fontWeight: 700, mt: 0.5 }}>
            {activeCount} / {MAX_USUARIOS_PLAN} usuarios activos
          </Typography>
        </Box>
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
        <Paper elevation={0} sx={{ ...panelStyle, p: { xs: 2.5, md: 3 } }}>
          <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }} spacing={2} sx={{ mb: 2.5 }}>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              {editing ? "Editar Usuario" : "Registrar Usuario"}
            </Typography>
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
              <TextField fullWidth size="small" label="Nombre" value={form.nombre} onChange={setField("nombre")} error={Boolean(errors.nombre)} helperText={errors.nombre} required />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField fullWidth size="small" label="Apellido" value={form.apellido} onChange={setField("apellido")} error={Boolean(errors.apellido)} helperText={errors.apellido} required />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField fullWidth size="small" type="email" label="Email" value={form.email} onChange={setField("email")} error={Boolean(errors.email)} helperText={errors.email} required />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField fullWidth size="small" label="DNI / Documento" value={form.dni} onChange={setField("dni")} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField fullWidth size="small" label="Telefono" value={form.telefono} onChange={setField("telefono")} />
            </Grid>
            {!editing && (
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  size="small"
                  type="password"
                  label="Contrasena"
                  value={form.password}
                  onChange={setField("password")}
                  error={Boolean(errors.password)}
                  helperText={errors.password}
                  required
                />
              </Grid>
            )}
            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth size="small">
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
          <Paper elevation={0} sx={{ ...panelStyle, p: 2.2, mb: 2 }}>
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
              {filtered.map((item) => {
                const role = normalizeRole(item.roles?.[0]);
                const self = isSelf(item);
                return (
                  <Paper key={item.id} elevation={0} sx={{ ...panelStyle, p: 2 }}>
                    <Stack spacing={1.5}>
                      <Stack direction="row" spacing={1.25} alignItems="flex-start" sx={{ minWidth: 0 }}>
                        <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.12), color: "primary.main", fontWeight: 800 }}>
                          {initials(item)}
                        </Avatar>
                        <Box sx={{ minWidth: 0 }}>
                          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
                            <Typography variant="body1" sx={{ fontWeight: 800 }} noWrap>
                              {item.nombre} {item.apellido}
                            </Typography>
                            {self && <Chip label="Tu" size="small" color="info" />}
                          </Stack>
                          <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }} noWrap>
                            {item.email}
                          </Typography>
                        </Box>
                      </Stack>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                        <Chip label={roleLabels[role] || role} size="small" sx={roleChipSx(role, theme)} />
                        <Typography variant="caption" sx={{ color: "text.secondary" }}>
                          {item.telefono || "Sin telefono"}
                        </Typography>
                        <Typography variant="caption" sx={{ color: "text.secondary" }}>
                          Ultimo acceso: {formatLastLogin(item.lastLoginAt)}
                        </Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Tooltip title={self ? "No podes modificar tu propia cuenta" : ""}>
                            <Box component="span">
                              <Switch
                                color="primary"
                                checked={Boolean(item.activo)}
                                onChange={() => toggleMutation.mutate(item.id)}
                                disabled={self || toggleMutation.isPending}
                              />
                            </Box>
                          </Tooltip>
                          <Typography variant="caption" sx={{ fontWeight: 800, color: item.activo ? "success.main" : "text.secondary" }}>
                            {item.activo ? "Activo" : "Suspendido"}
                          </Typography>
                        </Stack>
                        <Stack direction="row" spacing={0.5}>
                          <Tooltip title="Editar">
                            <IconButton onClick={() => openEdit(item)}>
                              <Edit />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={self ? "No podes modificar tu propia cuenta" : "Eliminar"}>
                            <Box component="span">
                              <IconButton disabled={self} onClick={() => setDeleteTarget(item)} sx={{ color: self ? "action.disabled" : "error.main" }}>
                                <Delete />
                              </IconButton>
                            </Box>
                          </Tooltip>
                        </Stack>
                      </Stack>
                    </Stack>
                  </Paper>
                );
              })}
              {!filtered.length && (
                <Paper elevation={0} sx={{ ...panelStyle, p: 4, textAlign: "center" }}>
                  <Person sx={{ color: "text.disabled", mb: 1 }} />
                  <Typography variant="body2" sx={{ color: "text.secondary", fontWeight: 800 }}>
                    No hay usuarios registrados en tu equipo.
                  </Typography>
                </Paper>
              )}
            </Stack>
          ) : (
            <Paper elevation={0} sx={{ ...panelStyle, overflow: "hidden" }}>
              <TableContainer>
                <Table size="small" sx={denseTableSx}>
                  <TableHead>
                    <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.08 : 0.05) }}>
                      <TableCell sx={tableHeadCellSx}>Usuario</TableCell>
                      <TableCell sx={tableHeadCellSx}>Email / Contacto</TableCell>
                      <TableCell sx={tableHeadCellSx}>DNI / Documento</TableCell>
                      <TableCell sx={tableHeadCellSx}>Rol Asignado</TableCell>
                      <TableCell sx={tableHeadCellSx}>Ultimo acceso</TableCell>
                      <TableCell sx={tableHeadCellSx}>Estado de Cuenta</TableCell>
                      <TableCell align="right" sx={tableHeadCellSx}>Acciones</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filtered.map((item) => {
                      const role = normalizeRole(item.roles?.[0]);
                      const self = isSelf(item);
                      return (
                        <TableRow key={item.id} hover sx={{ "& td": { py: 0.75, px: 2 } }}>
                          <TableCell>
                            <Stack direction="row" spacing={1.4} alignItems="center">
                              <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.12), color: "primary.main", fontWeight: 800 }}>
                                {initials(item)}
                              </Avatar>
                              <Box>
                                <Stack direction="row" spacing={0.75} alignItems="center">
                                  <Typography variant="body2" sx={{ fontWeight: 800 }}>
                                    {item.nombre} {item.apellido}
                                  </Typography>
                                  {self && <Chip label="Tu" size="small" color="info" />}
                                </Stack>
                                <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
                                  ID #{item.id}
                                </Typography>
                              </Box>
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 800 }}>
                              {item.email}
                            </Typography>
                            <Typography variant="caption" sx={{ color: "text.secondary" }}>
                              {item.telefono || "Sin telefono"}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 800 }}>
                              {item.dni || "Sin informar"}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip label={roleLabels[role] || role} size="small" sx={roleChipSx(role, theme)} />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 800 }}>
                              {formatLastLogin(item.lastLoginAt)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Tooltip title={self ? "No podes modificar tu propia cuenta" : ""}>
                                <Box component="span">
                                  <Switch
                                    color="primary"
                                    checked={Boolean(item.activo)}
                                    onChange={() => toggleMutation.mutate(item.id)}
                                    disabled={self || toggleMutation.isPending}
                                  />
                                </Box>
                              </Tooltip>
                              <Typography variant="caption" sx={{ fontWeight: 800, color: item.activo ? "success.main" : "text.secondary" }}>
                                {item.activo ? "Activo" : "Suspendido"}
                              </Typography>
                            </Stack>
                          </TableCell>
                          <TableCell align="right">
                            <Tooltip title="Editar">
                              <IconButton onClick={() => openEdit(item)}>
                                <Edit />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={self ? "No podes modificar tu propia cuenta" : "Eliminar"}>
                              <Box component="span">
                                <IconButton disabled={self} onClick={() => setDeleteTarget(item)} sx={{ color: self ? "action.disabled" : "error.main" }}>
                                  <Delete />
                                </IconButton>
                              </Box>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {!filtered.length && (
                      <TableRow>
                        <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                          <Person sx={{ color: "text.disabled", mb: 1 }} />
                          <Typography variant="body2" sx={{ color: "text.secondary", fontWeight: 800 }}>
                            No hay usuarios registrados en tu equipo.
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
            Queres eliminar el acceso de {deleteTarget?.nombre} {deleteTarget?.apellido}? Esta accion realiza una baja logica.
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
