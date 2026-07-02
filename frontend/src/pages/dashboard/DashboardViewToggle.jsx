import { IconButton, Stack, Tooltip, Typography } from "@mui/material";
import { DashboardCustomize, ViewAgenda } from "@mui/icons-material";

export default function DashboardViewToggle({ view, onSwitch }) {
  return (
    <Stack direction="row" alignItems="center" spacing={0.25} sx={{ flexShrink: 0, mt: { xs: 0.25, sm: 0 } }}>
      <Typography variant="caption" sx={{ color: "text.disabled", fontWeight: 600, display: { xs: "none", sm: "block" }, mr: 0.25 }}>
        Vista
      </Typography>
      <Tooltip title="Bandeja unificada">
        <IconButton
          size="small"
          onClick={() => onSwitch("bandeja")}
          color={view === "bandeja" ? "primary" : "default"}
          aria-label="Vista bandeja"
        >
          <ViewAgenda fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Dashboard clásico">
        <IconButton
          size="small"
          onClick={() => onSwitch("classic")}
          color={view === "classic" ? "primary" : "default"}
          aria-label="Vista clásica"
        >
          <DashboardCustomize fontSize="small" />
        </IconButton>
      </Tooltip>
    </Stack>
  );
}
