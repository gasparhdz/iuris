import { createTheme } from "@mui/material/styles";

// Tema A — Azul Institucional Moderno
export const getThemeA = (mode = "light") => {
  const isDark = mode === "dark";
  const p = "#1D4ED8"; // Blue 700
  const pLight = "#3B82F6"; // Blue 500
  const pDark = "#1E3A8A"; // Blue 900

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
        main: "#0EA5E9",   // Sky 500
        light: "#38BDF8",  // Sky 400
        dark: "#0369A1",   // Sky 700
        contrastText: "#FFFFFF",
      },
      background: {
        default: isDark ? "#0A0F1E" : "#F0F4FF",
        paper:   isDark ? "#111827" : "#FFFFFF",
      },
      text: {
        primary:   isDark ? "#F1F5F9" : "#0F172A",
        secondary: isDark ? "#A8B8CC" : "#475569",
        disabled:  isDark ? "#64748B" : "#94A3B8",
      },
      divider: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)",
      action: {
        hover:    isDark ? "rgba(29,78,216,0.10)" : "rgba(29,78,216,0.06)",
        selected: isDark ? "rgba(29,78,216,0.18)" : "rgba(29,78,216,0.10)",
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
            backgroundColor: isDark ? "#0A0F1E" : "#F0F4FF",
            color: isDark ? "#F1F5F9" : "#0F172A",
            scrollbarWidth: "thin",
            "&::-webkit-scrollbar": { width: "6px", height: "6px" },
            "&::-webkit-scrollbar-track": { background: isDark ? "#0A0F1E" : "#E0E7FF" },
            "&::-webkit-scrollbar-thumb": {
              background: isDark ? "#1E3A8A" : "#BFDBFE",
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
              boxShadow: "0 4px 12px rgba(29,78,216,0.30)",
            },
          },
          containedPrimary: {
            background: `linear-gradient(135deg, ${pLight} 0%, ${p} 100%)`,
          },
          containedSecondary: {
            background: "linear-gradient(135deg, #38BDF8 0%, #0369A1 100%)",
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundColor: isDark ? "#111827" : "#FFFFFF",
            backgroundImage: "none",
            border: isDark
              ? "1px solid rgba(255,255,255,0.06)"
              : `1px solid rgba(29,78,216,0.10)`,
            borderRadius: "12px",
            boxShadow: isDark
              ? "0 8px 32px 0 rgba(0,0,0,0.40)"
              : "0 4px 24px 0 rgba(29,78,216,0.08)",
            transition: "all 0.3s ease",
            "&:hover": {
              borderColor: isDark ? "rgba(29,78,216,0.25)" : "rgba(29,78,216,0.25)",
              boxShadow: isDark
                ? "0 8px 32px 0 rgba(29,78,216,0.08)"
                : "0 8px 32px 0 rgba(29,78,216,0.14)",
            },
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            "& .MuiOutlinedInput-root": {
              borderRadius: "8px",
              backgroundColor: isDark ? "rgba(10,15,30,0.6)" : "rgba(224,231,255,0.5)",
              transition: "all 0.2s",
              "& .MuiOutlinedInput-notchedOutline": {
                borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(29,78,216,0.20)",
                transition: "border-color 0.2s",
              },
              "&:hover .MuiOutlinedInput-notchedOutline": {
                borderColor: isDark ? "rgba(29,78,216,0.40)" : "rgba(29,78,216,0.50)",
              },
              "&.Mui-focused": {
                boxShadow: "0 0 0 2px rgba(29,78,216,0.20)",
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
