import { alpha } from "@mui/material/styles";

export const planStyles = {
  SOLO: { tone: "text.secondary", label: "SOLO" },
  FREE: { tone: "text.secondary", label: "FREE" },
  PRO: { tone: "primary.main", label: "PRO" },
  PREMIUM: { tone: "success.main", label: "PREMIUM" },
};

export function panelSx(theme, extra = {}) {
  return {
    border: "1px solid",
    borderColor: "divider",
    backgroundColor: "background.paper",
    boxShadow: "none",
    borderRadius: "16px",
    ...extra,
  };
}

export function planChipSx(plan, theme) {
  const tone = planStyles[plan]?.tone ?? planStyles.FREE.tone;
  const color = tone.split(".").reduce((source, key) => source?.[key], theme.palette) ?? theme.palette.text.secondary;
  return {
    bgcolor: alpha(color, theme.palette.mode === "dark" ? 0.16 : 0.1),
    color: tone,
    border: `1px solid ${alpha(color, theme.palette.mode === "dark" ? 0.32 : 0.24)}`,
    fontWeight: 800,
  };
}

export function formatNumber(value) {
  return new Intl.NumberFormat("es-AR").format(Number(value || 0));
}

export function planMrr(plan) {
  if (plan === "PREMIUM") return 99000;
  if (plan === "PRO") return 49000;
  return 0;
}
