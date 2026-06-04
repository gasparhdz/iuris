import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  IconButton,
  LinearProgress,
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
  Add,
  Apartment,
  Edit,
  Groups,
  Login,
  Search,
  WarningAmber,
} from "@mui/icons-material";
import { fetchAdminEstudios, toggleAdminEstudio } from "../../api/admin";
import { formatNumber, panelSx, planChipSx } from "./adminUi";

export default function SaaSEstudios() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [search, setSearch] = useState("");
  const [suspendTarget, setSuspendTarget] = useState(null);

  const estudiosQuery = useQuery({
    queryKey: ["admin", "estudios"],
    queryFn: fetchAdminEstudios,
    staleTime: 60_000,
  });

  const toggleMutation = useMutation({
    mutationFn: toggleAdminEstudio,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "estudios"] });
      enqueueSnackbar("Estado del estudio actualizado", { variant: "success" });
    },
    onError: () => enqueueSnackbar("No se pudo actualizar el estudio", { variant: "error" }),
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (estudiosQuery.data ?? []).filter((estudio) => {
      const text = [estudio.nombre, estudio.emailAdmin, estudio.plan].filter(Boolean).join(" ").toLowerCase();
      return !q || text.includes(q);
    });
  }, [estudiosQuery.data, search]);

  const handleToggle = (estudio) => {
    if (estudio.activo) {
      setSuspendTarget(estudio);
      return;
    }
    toggleMutation.mutate(estudio.id);
  };

  const handleImpersonate = (estudio) => {
    localStorage.setItem("impersonatedEstudioId", String(estudio.id));
    enqueueSnackbar(`Modo soporte sobre ${estudio.nombre} activado`, { variant: "info" });
  };

  return (
    <Box>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }} spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            Estudios
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => navigate("/admin/estudios/nuevo")}
          sx={{ borderRadius: "12px", fontWeight: 800 }}
        >
          Registrar Nuevo Estudio
        </Button>
      </Stack>

      <Paper elevation={0} sx={panelSx(theme, { p: 2.2, mb: 2 })}>
        <TextField
          fullWidth
          size="small"
          placeholder="Buscar por estudio, administrador o plan..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{ startAdornment: <Search sx={{ color: "text.disabled", mr: 1 }} /> }}
        />
      </Paper>

      {isMobile ? (
        <Stack spacing={1.5}>
          {rows.map((estudio) => {
            const usage = Number(estudio.maxUsuarios || 0)
              ? (Number(estudio.usuariosActivos || 0) / Number(estudio.maxUsuarios || 1)) * 100
              : 0;
            return (
              <Paper key={estudio.id} elevation={0} sx={panelSx(theme, { p: 2 })}>
                <Stack spacing={1.5}>
                  <Stack direction="row" spacing={1.25} alignItems="flex-start" justifyContent="space-between">
                    <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
                      <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.12), color: "primary.main" }}>
                        <Apartment />
                      </Avatar>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body1" sx={{ fontWeight: 800 }} noWrap>
                          {estudio.nombre}
                        </Typography>
                        <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }} noWrap>
                          {estudio.emailAdmin || "Sin email"}
                        </Typography>
                      </Box>
                    </Stack>
                    <Stack spacing={0.5} alignItems="flex-end">
                      <Chip label={estudio.plan || "FREE"} size="small" sx={planChipSx(estudio.plan, theme)} />
                      <Chip
                        label={estudio.driveFolderId ? "Drive Propio" : "Drive Sistema"}
                        size="small"
                        color={estudio.driveFolderId ? "success" : "default"}
                        variant="outlined"
                        sx={{ fontWeight: 800, mt: 0.5, fontSize: "0.68rem", height: 20 }}
                      />
                    </Stack>
                  </Stack>

                  <Box>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
                        Licencias
                      </Typography>
                      <Typography variant="caption" sx={{ fontWeight: 800 }}>
                        {formatNumber(estudio.usuariosActivos)} / {formatNumber(estudio.maxUsuarios)}
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(100, usage)}
                      sx={{
                        mt: 0.8,
                        height: 6,
                        borderRadius: 999,
                        bgcolor: alpha(theme.palette.text.secondary, 0.12),
                        "& .MuiLinearProgress-bar": { borderRadius: 999 },
                      }}
                    />
                  </Box>

                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Switch color="primary" checked={Boolean(estudio.activo)} onChange={() => handleToggle(estudio)} disabled={toggleMutation.isPending} />
                      <Typography variant="caption" sx={{ fontWeight: 700, color: estudio.activo ? "success.main" : "text.secondary" }}>
                        {estudio.activo ? "Activo" : "Suspendido"}
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={0.5}>
                      <Tooltip title="Editar">
                        <IconButton onClick={() => navigate(`/admin/estudios/editar/${estudio.id}`)}>
                          <Edit />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Gestionar Usuarios">
                        <IconButton onClick={() => navigate(`/admin/estudios/${estudio.id}/usuarios`)} sx={{ color: "primary.main" }}>
                          <Groups />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Impersonar para soporte">
                        <IconButton onClick={() => handleImpersonate(estudio)} sx={{ color: "warning.main" }}>
                          <Login />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Stack>
                </Stack>
              </Paper>
            );
          })}
          {!rows.length && (
            <Paper elevation={0} sx={panelSx(theme, { p: 4, textAlign: "center" })}>
              <Typography variant="body2" sx={{ color: "text.secondary", fontWeight: 600 }}>
                No hay estudios para mostrar.
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
                  <TableCell sx={{ fontWeight: 800 }}>Estudio</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Administrador</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Plan Activo</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Licencias</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Estado</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800 }}>Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((estudio) => {
                  const usage = Number(estudio.maxUsuarios || 0)
                    ? (Number(estudio.usuariosActivos || 0) / Number(estudio.maxUsuarios || 1)) * 100
                    : 0;
                  return (
                    <TableRow key={estudio.id} hover sx={{ "& td": { py: 0.75, px: 2 } }}>
                    <TableCell>
                      <Stack direction="row" spacing={1.4} alignItems="center">
                        <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.12), color: "primary.main" }}>
                          <Apartment />
                        </Avatar>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 800 }}>
                            {estudio.nombre}
                          </Typography>
                          <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
                            CUIT/CUIL {estudio.cuit || "Sin informar"}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 800 }}>
                        {estudio.emailAdmin || "Sin email"}
                      </Typography>
                      <Typography variant="caption" sx={{ color: "text.secondary" }}>
                        {estudio.telefono || "Sin teléfono"}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip label={estudio.plan || "FREE"} size="small" sx={planChipSx(estudio.plan, theme)} />
                        <Chip
                          label={estudio.driveFolderId ? "Drive Propio" : "Drive Sistema"}
                          size="small"
                          color={estudio.driveFolderId ? "success" : "default"}
                          variant="outlined"
                          sx={{ fontWeight: 800 }}
                        />
                      </Stack>
                    </TableCell>
                    <TableCell sx={{ minWidth: 150 }}>
                      <Typography variant="caption" sx={{ fontWeight: 800 }}>
                        {formatNumber(estudio.usuariosActivos)} / {formatNumber(estudio.maxUsuarios)} usuarios
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(100, usage)}
                        sx={{
                          mt: 0.8,
                          height: 5,
                          borderRadius: 999,
                          bgcolor: alpha(theme.palette.text.secondary, 0.12),
                          "& .MuiLinearProgress-bar": { borderRadius: 999 },
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Switch color="primary" checked={Boolean(estudio.activo)} onChange={() => handleToggle(estudio)} disabled={toggleMutation.isPending} />
                        <Typography variant="caption" sx={{ fontWeight: 600, color: estudio.activo ? "success.main" : "text.secondary" }}>
                          {estudio.activo ? "Activo" : "Suspendido"}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Editar">
                        <IconButton onClick={() => navigate(`/admin/estudios/editar/${estudio.id}`)}>
                          <Edit />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Gestionar Usuarios">
                        <IconButton onClick={() => navigate(`/admin/estudios/${estudio.id}/usuarios`)} sx={{ color: "primary.main" }}>
                          <Groups />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Impersonar para soporte">
                        <IconButton onClick={() => handleImpersonate(estudio)} sx={{ color: "warning.main" }}>
                          <Login />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                    </TableRow>
                  );
                })}
                {!rows.length && (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                      <Typography variant="body2" sx={{ color: "text.secondary", fontWeight: 600 }}>
                        No hay estudios para mostrar.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      <Dialog open={Boolean(suspendTarget)} onClose={() => setSuspendTarget(null)} PaperProps={{ sx: { borderRadius: "16px", width: "100%", maxWidth: 420, boxShadow: "none" } }}>
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Avatar sx={{ bgcolor: alpha(theme.palette.warning.main, 0.12), color: "warning.main" }}>
            <WarningAmber />
          </Avatar>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>Suspender estudio</Typography>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            ¿Suspender el acceso de {suspendTarget?.nombre}? Podés reactivarlo desde este listado cuando sea necesario.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setSuspendTarget(null)} sx={{ borderRadius: "12px", fontWeight: 800 }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="warning"
            disabled={toggleMutation.isPending}
            onClick={() => {
              if (!suspendTarget) return;
              toggleMutation.mutate(suspendTarget.id);
              setSuspendTarget(null);
            }}
            sx={{ borderRadius: "12px", fontWeight: 800 }}
          >
            Suspender
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

