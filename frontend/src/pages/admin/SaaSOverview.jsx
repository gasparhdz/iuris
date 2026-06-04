import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { alpha, useTheme } from "@mui/material/styles";
import {
  Avatar,
  Box,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import {
  Apartment,
  Groups,
  Paid,
  Workspaces,
} from "@mui/icons-material";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fetchAdminEstudios } from "../../api/admin";
import { formatNumber, panelSx, planMrr } from "./adminUi";

function Kpi({ title, value, caption, icon, tone, loading }) {
  const theme = useTheme();
  const color = theme.palette[tone]?.main ?? theme.palette.primary.main;
  return (
    <Paper elevation={0} sx={panelSx(theme, { p: 2.4, height: "100%" })}>
      <Stack direction="row" spacing={2} alignItems="flex-start" justifyContent="space-between">
        <Box>
          <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {title}
          </Typography>
          <Typography sx={{ fontSize: "2rem", fontWeight: 800, lineHeight: 1.1, mt: 1 }}>
            {loading ? <CircularProgress size={24} /> : value}
          </Typography>
          <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 500 }}>
            {caption}
          </Typography>
        </Box>
        <Avatar sx={{ bgcolor: alpha(color, 0.12), color: `${tone}.main`, border: `1px solid ${alpha(color, 0.24)}` }}>
          {icon}
        </Avatar>
      </Stack>
    </Paper>
  );
}

function GrowthTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <Paper elevation={0} sx={{ p: 1.3, border: "1px solid", borderColor: "divider", borderRadius: "12px", bgcolor: "background.paper", color: "text.primary", boxShadow: "none" }}>
      <Typography variant="caption" sx={{ fontWeight: 700 }}>{label}</Typography>
      <Typography variant="body2" sx={{ fontWeight: 800, mt: 0.5 }}>
        {payload[0].value} nuevos estudios
      </Typography>
    </Paper>
  );
}

export default function SaaSOverview() {
  const theme = useTheme();
  const estudiosQuery = useQuery({
    queryKey: ["admin", "estudios"],
    queryFn: fetchAdminEstudios,
    staleTime: 60_000,
  });
  const estudios = estudiosQuery.data ?? [];

  const metrics = useMemo(() => {
    const activos = estudios.filter((e) => e.activo).length;
    const usuarios = estudios.reduce((sum, e) => sum + Number(e.usuariosActivos || 0), 0);
    const expedientes = estudios.reduce((sum, e) => sum + Number(e.expedientes || 0), 0);
    const mrr = estudios.filter((e) => e.activo).reduce((sum, e) => sum + planMrr(e.plan), 0);
    return { activos, usuarios, expedientes, mrr };
  }, [estudios]);

  const growthData = useMemo(() => {
    const rows = Array.from({ length: 8 }, (_, index) => {
      const d = new Date();
      d.setMonth(d.getMonth() - (7 - index));
      return {
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        mes: d.toLocaleDateString("es-AR", { month: "short" }).replace(".", ""),
        estudios: 0,
      };
    });
    const byKey = new Map(rows.map((row) => [row.key, row]));
    estudios.forEach((estudio) => {
      const d = new Date(estudio.createdAt);
      if (Number.isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const row = byKey.get(key);
      if (row) row.estudios += 1;
    });
    return rows;
  }, [estudios]);

  return (
    <Box>
      <Stack spacing={0.6} sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          Panel de Control Central
        </Typography>
      </Stack>

      <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Kpi title="Estudios activos" value={formatNumber(metrics.activos)} caption={`${formatNumber(estudios.length)} tenants totales`} icon={<Apartment />} tone="primary" loading={estudiosQuery.isLoading} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Kpi title="Usuarios totales" value={formatNumber(metrics.usuarios)} caption="cuentas activas globales" icon={<Groups />} tone="warning" loading={estudiosQuery.isLoading} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Kpi title="Volumen judicial" value={formatNumber(metrics.expedientes)} caption="expedientes alojados" icon={<Workspaces />} tone="success" loading={estudiosQuery.isLoading} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Kpi title="Facturación mensual" value={`$ ${formatNumber(metrics.mrr)}`} caption="MRR estimado por plan" icon={<Paid />} tone="warning" loading={estudiosQuery.isLoading} />
        </Grid>
      </Grid>

      <Paper elevation={0} sx={panelSx(theme, { p: 2.6 })}>
        <Stack spacing={0.5} sx={{ mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            Crecimiento de estudios
          </Typography>
          <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 500 }}>
            Altas mensuales de nuevos inquilinos SaaS
          </Typography>
        </Stack>
        <Box sx={{ height: 360 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={growthData} margin={{ top: 18, right: 20, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="saasGrowth" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={theme.palette.primary.main} stopOpacity={0.28} />
                  <stop offset="95%" stopColor={theme.palette.primary.main} stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fill: theme.palette.text.secondary, fontSize: 12, fontWeight: 800 }} />
              <YAxis axisLine={false} tickLine={false} allowDecimals={false} tick={{ fill: theme.palette.text.secondary, fontSize: 12, fontWeight: 800 }} />
              <RechartsTooltip content={<GrowthTooltip />} />
              <Area type="monotone" dataKey="estudios" stroke={theme.palette.primary.main} strokeWidth={3} fill="url(#saasGrowth)" />
            </AreaChart>
          </ResponsiveContainer>
        </Box>
      </Paper>
    </Box>
  );
}

