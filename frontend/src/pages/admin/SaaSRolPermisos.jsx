import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { alpha, useTheme } from "@mui/material/styles";
import {
  Box, Button, Checkbox, Paper, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Typography,
} from "@mui/material";
import { ArrowBack, Save } from "@mui/icons-material";
import { fetchAdminRolConPermisos, updateAdminPermisosRol } from "../../api/admin";
import { panelSx } from "./adminUi";

const columns = [
  { key: "ver", label: "Ver" },
  { key: "crear", label: "Crear" },
  { key: "editar", label: "Editar" },
  { key: "eliminar", label: "Eliminar" },
];

function moduleLabel(modulo) {
  const map = {
    CLIENTES: "Clientes",
    CASOS: "Casos",
    TAREAS: "Tareas",
    EVENTOS: "Eventos",
    HONORARIOS: "Honorarios",
    GASTOS: "Gastos",
    INGRESOS: "Ingresos",
    PLANTILLAS: "Plantillas",
    NOTAS: "Notas",
    VALORJUS: "Valor JUS",
    TERCEROS: "Terceros",
    PLANES: "Planes",
    ADJUNTOS: "Adjuntos",
    EQUIPO: "Equipo",
  };
  return map[modulo] || modulo;
}

function apiError(error, fallback) {
  return error?.response?.data?.error?.message ?? error?.response?.data?.message ?? fallback;
}

export default function SaaSRolPermisos() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [permisos, setPermisos] = useState([]);

  const rolQuery = useQuery({
    queryKey: ["admin", "roles", id],
    queryFn: () => fetchAdminRolConPermisos(id),
    staleTime: 60_000,
  });

  useEffect(() => {
    setPermisos(rolQuery.data?.permisos ?? []);
  }, [rolQuery.data?.permisos]);

  const saveMutation = useMutation({
    mutationFn: () => updateAdminPermisosRol(id, permisos),
    onSuccess: () => {
      enqueueSnackbar("Permisos actualizados", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["admin", "roles", id] });
    },
    onError: (error) => enqueueSnackbar(apiError(error, "No se pudieron guardar los permisos"), { variant: "error" }),
  });

  const toggleCell = (modulo, key) => {
    setPermisos((rows) => rows.map((row) => row.modulo === modulo ? { ...row, [key]: !row[key] } : row));
  };

  const toggleColumn = (key) => {
    const allChecked = permisos.every((row) => Boolean(row[key]));
    setPermisos((rows) => rows.map((row) => ({ ...row, [key]: !allChecked })));
  };

  return (
    <Box>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }} spacing={2} sx={{ mb: 3 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Button startIcon={<ArrowBack />} onClick={() => navigate("/admin/roles")} sx={{ borderRadius: "12px", fontWeight: 800 }}>Volver</Button>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>
              Matriz de Permisos - {rolQuery.data?.nombre || "Rol"}
            </Typography>
          </Box>
        </Stack>
        <Button variant="contained" startIcon={<Save />} onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || rolQuery.isLoading} sx={{ borderRadius: "12px", fontWeight: 800 }}>
          {saveMutation.isPending ? "Guardando..." : "Guardar Configuración"}
        </Button>
      </Stack>

      <Paper elevation={0} sx={panelSx(theme, { overflow: "hidden" })}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.08 : 0.05) }}>
                <TableCell sx={{ fontWeight: 800 }}>Módulo del Sistema</TableCell>
                {columns.map((col) => (
                  <TableCell key={col.key} align="center" sx={{ fontWeight: 800 }}>
                    <Stack alignItems="center" spacing={0.5}>
                      <Typography variant="caption" sx={{ fontWeight: 800 }}>{col.label}</Typography>
                      <Checkbox color="warning" checked={permisos.length > 0 && permisos.every((row) => Boolean(row[col.key]))} onChange={() => toggleColumn(col.key)} />
                    </Stack>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {permisos.map((row) => (
                <TableRow key={row.modulo} hover sx={{ "& td": { py: 0.75, px: 2 } }}>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 800 }}>{moduleLabel(row.modulo)}</Typography>
                    <Typography component="code" sx={{ color: "text.secondary", fontFamily: "monospace", fontSize: "0.72rem" }}>{row.modulo}</Typography>
                  </TableCell>
                  {columns.map((col) => (
                    <TableCell key={col.key} align="center">
                      <Checkbox color="warning" checked={Boolean(row[col.key])} onChange={() => toggleCell(row.modulo, col.key)} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
              {!permisos.length && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 5 }}>
                    <Typography variant="body2" sx={{ color: "text.secondary", fontWeight: 800 }}>Cargando matriz...</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}

