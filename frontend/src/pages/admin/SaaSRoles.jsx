import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { alpha, useTheme } from "@mui/material/styles";
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton,
  Paper, Stack, Switch, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TextField, Tooltip, Typography, useMediaQuery,
} from "@mui/material";
import { Add, Delete, Edit, Security } from "@mui/icons-material";
import {
  createAdminRol,
  deleteAdminRol,
  fetchAdminRoles,
  toggleAdminRol,
  updateAdminRol,
} from "../../api/admin";
import { panelSx } from "./adminUi";

const EMPTY = { nombre: "", codigo: "" };
const criticalRoles = ["SUPERADMIN", "ADMIN", "DIRECTOR"];

function isCritical(role) {
  return criticalRoles.includes(String(role?.codigo || "").toUpperCase());
}

function apiError(error, fallback) {
  return error?.response?.data?.error?.message ?? error?.response?.data?.message ?? fallback;
}

export default function SaaSRoles() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});

  const rolesQuery = useQuery({ queryKey: ["admin", "roles"], queryFn: fetchAdminRoles, staleTime: 60_000 });
  const roles = useMemo(() => rolesQuery.data ?? [], [rolesQuery.data]);

  useEffect(() => {
    if (!open) return;
    setForm(editing ? { nombre: editing.nombre ?? "", codigo: editing.codigo ?? "" } : EMPTY);
    setErrors({});
  }, [editing, open]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin", "roles"] });

  const saveMutation = useMutation({
    mutationFn: () => editing ? updateAdminRol(editing.id, form) : createAdminRol(form),
    onSuccess: () => {
      enqueueSnackbar(editing ? "Rol actualizado" : "Rol creado", { variant: "success" });
      setOpen(false);
      setEditing(null);
      invalidate();
    },
    onError: (error) => enqueueSnackbar(apiError(error, "No se pudo guardar el rol"), { variant: "error" }),
  });

  const toggleMutation = useMutation({
    mutationFn: (id) => toggleAdminRol(id),
    onSuccess: () => {
      enqueueSnackbar("Estado del rol actualizado", { variant: "success" });
      invalidate();
    },
    onError: (error) => enqueueSnackbar(apiError(error, "No se pudo cambiar el estado"), { variant: "error" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteAdminRol(id),
    onSuccess: () => {
      enqueueSnackbar("Rol eliminado", { variant: "success" });
      invalidate();
    },
    onError: (error) => enqueueSnackbar(apiError(error, "No se pudo eliminar el rol"), { variant: "error" }),
  });

  const validate = () => {
    const next = {};
    if (!form.nombre.trim()) next.nombre = "Indicá el nombre";
    if (!form.codigo.trim()) next.codigo = "Indicá el código";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    saveMutation.mutate();
  };

  const openCreate = () => {
    setEditing(null);
    setOpen(true);
  };

  const openEdit = (role) => {
    setEditing(role);
    setOpen(true);
  };

  return (
    <Box>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }} spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Roles y Permisos</Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={openCreate} sx={{ borderRadius: "12px", fontWeight: 800 }}>
          Crear Nuevo Rol
        </Button>
      </Stack>

      {isMobile ? (
        <Stack spacing={1.5}>
          {roles.map((role) => {
            const protectedRole = isCritical(role);
            return (
              <Paper key={role.id} elevation={0} sx={panelSx(theme, { p: 2 })}>
                <Stack spacing={1.5}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body1" sx={{ fontWeight: 800 }} noWrap>
                        {role.nombre}
                      </Typography>
                      <Typography component="code" sx={{ display: "block", color: "primary.main", fontFamily: "monospace", fontWeight: 800, mt: 0.5 }}>
                        {role.codigo}
                      </Typography>
                    </Box>
                    <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700, whiteSpace: "nowrap" }}>
                      {role.usuariosCount ?? 0} usuarios
                    </Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Tooltip title={protectedRole ? "Este es un rol protegido del sistema" : ""}>
                      <span>
                        <Switch color="primary" checked={Boolean(role.activo)} disabled={protectedRole || toggleMutation.isPending} onChange={() => toggleMutation.mutate(role.id)} />
                      </span>
                    </Tooltip>
                    <Stack direction="row" spacing={0.5}>
                      <Tooltip title={protectedRole ? "Este es un rol protegido del sistema" : "Editar metadatos"}>
                        <span>
                          <IconButton disabled={protectedRole} onClick={() => openEdit(role)}><Edit /></IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Ver Matriz de Permisos">
                        <IconButton onClick={() => navigate(`/admin/roles/${role.id}/permisos`)} sx={{ color: "warning.main" }}><Security /></IconButton>
                      </Tooltip>
                      <Tooltip title={protectedRole ? "Este es un rol protegido del sistema" : "Eliminar"}>
                        <span>
                          <IconButton disabled={protectedRole} onClick={() => deleteMutation.mutate(role.id)} sx={{ color: "error.main" }}><Delete /></IconButton>
                        </span>
                      </Tooltip>
                    </Stack>
                  </Stack>
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      ) : (
        <Paper elevation={0} sx={panelSx(theme, { overflow: "hidden" })}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.08 : 0.05) }}>
                  <TableCell sx={{ fontWeight: 800 }}>Nombre del Rol</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Código Técnico</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Usuarios Activos</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Estado</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800 }}>Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {roles.map((role) => {
                  const protectedRole = isCritical(role);
                  return (
                    <TableRow key={role.id} hover sx={{ "& td": { py: 0.75, px: 2 } }}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 800 }}>{role.nombre}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography component="code" sx={{ fontFamily: "monospace", fontWeight: 800, color: "primary.main" }}>
                        {role.codigo}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 800 }}>{role.usuariosCount ?? 0}</Typography>
                    </TableCell>
                    <TableCell>
                      <Tooltip title={protectedRole ? "Este es un rol protegido del sistema" : ""}>
                        <span>
                          <Switch color="primary" checked={Boolean(role.activo)} disabled={protectedRole || toggleMutation.isPending} onChange={() => toggleMutation.mutate(role.id)} />
                        </span>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title={protectedRole ? "Este es un rol protegido del sistema" : "Editar metadatos"}>
                        <span>
                          <IconButton disabled={protectedRole} onClick={() => openEdit(role)}><Edit /></IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Ver Matriz de Permisos">
                        <IconButton onClick={() => navigate(`/admin/roles/${role.id}/permisos`)} sx={{ color: "warning.main" }}><Security /></IconButton>
                      </Tooltip>
                      <Tooltip title={protectedRole ? "Este es un rol protegido del sistema" : "Eliminar"}>
                        <span>
                          <IconButton disabled={protectedRole} onClick={() => deleteMutation.mutate(role.id)} sx={{ color: "error.main" }}><Delete /></IconButton>
                        </span>
                      </Tooltip>
                    </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: "16px", width: "100%", maxWidth: 420, boxShadow: "none" } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>{editing ? "Editar Rol" : "Crear Rol"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField label="Nombre del Rol" value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} error={Boolean(errors.nombre)} helperText={errors.nombre} required />
            <TextField label="Código Técnico" value={form.codigo} onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value.toUpperCase().replace(/\s+/g, "_") }))} error={Boolean(errors.codigo)} helperText={errors.codigo} required />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setOpen(false)} sx={{ borderRadius: "12px", fontWeight: 800 }}>Cancelar</Button>
          <Button variant="contained" onClick={handleSave} disabled={saveMutation.isPending} sx={{ borderRadius: "12px", fontWeight: 800 }}>
            {saveMutation.isPending ? "Guardando..." : "Guardar"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

