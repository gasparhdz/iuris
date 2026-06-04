import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { alpha, useTheme } from "@mui/material/styles";
import {
  Avatar,
  Box,
  Button,
  Chip,
  LinearProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { Groups, Search } from "@mui/icons-material";
import { fetchAdminEstudios } from "../../api/admin";
import { formatNumber, panelSx, planChipSx } from "./adminUi";

export default function SaaSUsuarios() {
  const theme = useTheme();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const estudiosQuery = useQuery({
    queryKey: ["admin", "estudios"],
    queryFn: fetchAdminEstudios,
    staleTime: 60_000,
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (estudiosQuery.data ?? []).filter((estudio) => {
      const text = [estudio.nombre, estudio.emailAdmin, estudio.plan].filter(Boolean).join(" ").toLowerCase();
      return !q || text.includes(q);
    });
  }, [estudiosQuery.data, search]);

  return (
    <Box>
      <Stack spacing={0.6} sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          Usuarios
        </Typography>
      </Stack>

      <Paper elevation={0} sx={panelSx(theme, { p: 2.2, mb: 2.5 })}>
        <TextField
          fullWidth
          size="small"
          placeholder="Buscar estudio, administrador o plan..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          InputProps={{ startAdornment: <Search sx={{ color: "text.disabled", mr: 1 }} /> }}
        />
      </Paper>

      <Grid container spacing={2.5}>
        {rows.map((estudio) => {
          const maxUsuarios = Number(estudio.maxUsuarios || 0);
          const usuariosActivos = Number(estudio.usuariosActivos || 0);
          const usage = maxUsuarios ? (usuariosActivos / maxUsuarios) * 100 : 0;
          return (
            <Grid key={estudio.id} size={{ xs: 12, md: 6, xl: 4 }}>
              <Paper elevation={0} sx={panelSx(theme, { p: 2.4, height: "100%" })}>
                <Stack direction="row" spacing={1.5} alignItems="flex-start" justifyContent="space-between">
                  <Stack direction="row" spacing={1.4} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
                    <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.12), color: "primary.main" }}>
                      <Groups />
                    </Avatar>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body1" sx={{ fontWeight: 800 }} noWrap>
                        {estudio.nombre}
                      </Typography>
                      <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }} noWrap>
                        {estudio.emailAdmin || estudio.emailContacto || "Sin administrador"}
                      </Typography>
                    </Box>
                  </Stack>
                  <Chip label={estudio.plan || "FREE"} size="small" sx={planChipSx(estudio.plan, theme)} />
                </Stack>

                <Box sx={{ mt: 2 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800 }}>
                      Licencias usadas
                    </Typography>
                    <Typography variant="caption" sx={{ fontWeight: 800 }}>
                      {formatNumber(usuariosActivos)} / {formatNumber(maxUsuarios)}
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

                <Button
                  fullWidth
                  variant="contained"
                  onClick={() => navigate(`/admin/estudios/${estudio.id}/usuarios`)}
                  sx={{ mt: 2.2, borderRadius: "12px", fontWeight: 800 }}
                >
                  Gestionar Usuarios
                </Button>
              </Paper>
            </Grid>
          );
        })}
        {!rows.length && (
          <Grid size={{ xs: 12 }}>
            <Paper elevation={0} sx={panelSx(theme, { p: 5, textAlign: "center" })}>
              <Typography variant="body2" sx={{ color: "text.secondary", fontWeight: 800 }}>
                No hay estudios para mostrar.
              </Typography>
            </Paper>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}

