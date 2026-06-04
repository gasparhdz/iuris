import {
  Box,
  Tooltip,
  Typography,
  Popover,
  IconButton,
  Stack,
} from "@mui/material";
import PaletteIcon from "@mui/icons-material/Palette";
import CheckIcon from "@mui/icons-material/Check";
import { useState } from "react";
import { useThemeMode, PALETTE_OPTIONS } from "./ThemeModeProvider";

export function PaletteSelector() {
  const { palette, setPalette } = useThemeMode();
  const [anchor, setAnchor] = useState(null);

  return (
    <>
      <Tooltip title="Cambiar paleta de colores">
        <IconButton size="small" onClick={(e) => setAnchor(e.currentTarget)}>
          <PaletteIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        PaperProps={{
          sx: {
            p: 2,
            borderRadius: "12px",
            border: "1px solid",
            borderColor: "divider",
            minWidth: 200,
          },
        }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: "block", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Paleta de colores
        </Typography>

        <Stack spacing={0.75}>
          {PALETTE_OPTIONS.map((opt) => {
            const isActive = palette === opt.key;
            return (
              <Box
                key={opt.key}
                onClick={() => { setPalette(opt.key); setAnchor(null); }}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  p: "8px 10px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  border: "1px solid",
                  borderColor: isActive ? "primary.main" : "transparent",
                  bgcolor: isActive ? "action.selected" : "transparent",
                  "&:hover": { bgcolor: "action.hover" },
                  transition: "all 0.15s",
                }}
              >
                {/* Swatch de color */}
                <Box
                  sx={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    bgcolor: opt.accent,
                    flexShrink: 0,
                    boxShadow: `0 0 0 2px ${opt.accent}40`,
                  }}
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={isActive ? 700 : 500} noWrap>
                    {opt.label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {opt.desc}
                  </Typography>
                </Box>
                {isActive && (
                  <CheckIcon sx={{ fontSize: 16, color: "primary.main", flexShrink: 0 }} />
                )}
              </Box>
            );
          })}
        </Stack>
      </Popover>
    </>
  );
}
