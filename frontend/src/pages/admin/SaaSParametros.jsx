import { alpha, useTheme } from "@mui/material/styles";
import {
  Avatar,
  Box,
  Chip,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { Settings, Tune } from "@mui/icons-material";
import { panelSx } from "./adminUi";

const groups = [
  { title: "Catálogos jurídicos", detail: "Prioridades, estados, tipos de evento y conceptos operativos.", count: 14 },
  { title: "Parámetros financieros", detail: "Monedas, políticas JUS, estados y conceptos contables.", count: 9 },
  { title: "Configuración SaaS", detail: "Planes, límites, permisos globales y banderas de producto.", count: 6 },
];

export default function SaaSParametros() {
  const theme = useTheme();
  return (
    <Box>
      <Stack spacing={0.6} sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          Parámetros Globales
        </Typography>
      </Stack>

      <Grid container spacing={2.5}>
        {groups.map((group) => (
          <Grid key={group.title} size={{ xs: 12, md: 4 }}>
            <Paper elevation={0} sx={panelSx(theme, { p: 2.6, height: "100%" })}>
              <Stack direction="row" spacing={1.5} alignItems="flex-start">
                <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.12), color: "primary.main", fontWeight: 800 }}>
                  <Tune />
                </Avatar>
                <Box>
                  <Typography variant="body1" sx={{ fontWeight: 800 }}>
                    {group.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.7 }}>
                    {group.detail}
                  </Typography>
                  <Chip
                    icon={<Settings sx={{ fontSize: "14px !important" }} />}
                    label={`${group.count} categorías`}
                    size="small"
                    sx={{ mt: 1.5, fontWeight: 800, bgcolor: alpha(theme.palette.primary.main, 0.1), color: "primary.main" }}
                  />
                </Box>
              </Stack>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

