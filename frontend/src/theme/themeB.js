import { createTheme } from "@mui/material/styles";

// Tema B — Slate Neutro + Accent Dorado (Jurídico clásico)
export const getThemeB = (mode = "light") => {
  const isDark = mode === "dark";
  const p = "#D97706";      // Amber 600
  const pLight = "#F59E0B"; // Amber 400
  const pDark = "#92400E";  // Amber 800

  return createTheme({
    palette: {
      mode,
      primary: {
        main: p,
        light: pLight,
        dark: pDark,
        contrastText: "#FFFFFF",
      },
      secondary: {
        main: "#2563EB",   // Blue 600 — links, acciones secundarias
        light: "#3B82F6",
        dark: "#1D4ED8",
        contrastText: "#FFFFFF",
      },
      background: {
        default: isDark ? "#0C1117" : "#F8F9FB",
        paper:   isDark ? "#151D2A" : "#FFFFFF",
      },
      text: {
        primary:   isDark ? "#F1F5F9" : "#0F172A",
        secondary: isDark ? "#94A3B8" : "#475569",
        disabled:  isDark ? "#64748B" : "#94A3B8",
      },
      divider: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)",
      action: {
        hover:    isDark ? "rgba(217,119,6,0.10)" : "rgba(217,119,6,0.06)",
        selected: isDark ? "rgba(217,119,6,0.18)" : "rgba(217,119,6,0.10)",
      },
    },
    typography: {
      fontFamily: '"Plus Jakarta Sans", "Outfit", "Inter", "Helvetica", "Arial", sans-serif',
      h1: { fontSize: "2.5rem", fontWeight: 800, letterSpacing: "-0.05em" },
      h2: { fontSize: "2rem",   fontWeight: 700, letterSpacing: "-0.03em" },
      h3: { fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.02em" },
      h4: { fontSize: "1.25rem", fontWeight: 600 },
      h5: { fontSize: "1.1rem",  fontWeight: 600 },
      h6: { fontSize: "0.95rem", fontWeight: 600 },
      body1:  { fontSize: "0.95rem", lineHeight: 1.6 },
      body2:  { fontSize: "0.85rem", lineHeight: 1.5 },
      button: { textTransform: "none", fontWeight: 600 },
    },
    shape: { borderRadius: 12 },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: isDark ? "#0C1117" : "#F8F9FB",
            color: isDark ? "#F1F5F9" : "#0F172A",
            scrollbarWidth: "thin",
            "&::-webkit-scrollbar": { width: "6px", height: "6px" },
            "&::-webkit-scrollbar-track": { background: isDark ? "#0C1117" : "#F1F5F9" },
            "&::-webkit-scrollbar-thumb": {
              background: isDark ? "#1E293B" : "#CBD5E1",
              borderRadius: "3px",
            },
            "&::-webkit-scrollbar-thumb:hover": { background: p },
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: "8px",
            padding: "8px 16px",
            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            "&:hover": {
              transform: "translateY(-1px)",
              boxShadow: "0 4px 12px rgba(217,119,6,0.35)",
            },
          },
          containedPrimary: {
            background: `linear-gradient(135deg, ${pLight} 0%, ${p} 100%)`,
            color: "#FFFFFF",
          },
          containedSecondary: {
            background: "linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)",
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundColor: isDark ? "#151D2A" : "#FFFFFF",
            backgroundImage: "none",
            border: isDark
              ? "1px solid rgba(255,255,255,0.06)"
              : "1px solid rgba(0,0,0,0.07)",
            borderRadius: "12px",
            boxShadow: isDark
              ? "0 8px 32px 0 rgba(0,0,0,0.45)"
              : "0 2px 16px 0 rgba(0,0,0,0.06)",
            transition: "all 0.3s ease",
            "&:hover": {
              borderColor: isDark ? "rgba(217,119,6,0.25)" : "rgba(217,119,6,0.20)",
              boxShadow: isDark
                ? "0 8px 32px 0 rgba(217,119,6,0.06)"
                : "0 8px 32px 0 rgba(217,119,6,0.10)",
            },
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            "& .MuiOutlinedInput-root": {
              borderRadius: "8px",
              backgroundColor: isDark ? "rgba(12,17,23,0.6)" : "rgba(248,249,251,0.8)",
              transition: "all 0.2s",
              "& .MuiOutlinedInput-notchedOutline": {
                borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.15)",
                transition: "border-color 0.2s",
              },
              "&:hover .MuiOutlinedInput-notchedOutline": {
                borderColor: isDark ? "rgba(217,119,6,0.40)" : "rgba(217,119,6,0.50)",
              },
              "&.Mui-focused": {
                boxShadow: "0 0 0 2px rgba(217,119,6,0.20)",
              },
              "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                borderColor: p,
                borderWidth: "1px",
              },
            },
          },
        },
      },
    },
  });
};
