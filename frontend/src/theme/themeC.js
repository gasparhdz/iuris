import { createTheme } from "@mui/material/styles";

// Tema C — Verde Oscuro Judicial
export const getThemeC = (mode = "light") => {
  const isDark = mode === "dark";
  const p = "#065F46";      // Emerald 900
  const pLight = "#10B981"; // Emerald 500
  const pDark = "#064E3B";  // Emerald 950

  return createTheme({
    palette: {
      mode,
      primary: {
        main: pLight,         // usamos el 500 como main para que el contraste funcione en light
        light: "#34D399",     // Emerald 400
        dark: p,
        contrastText: "#FFFFFF",
      },
      secondary: {
        main: "#0891B2",   // Cyan 600
        light: "#22D3EE",
        dark: "#0E7490",
        contrastText: "#FFFFFF",
      },
      background: {
        default: isDark ? "#0A1410" : "#F0FDF4",
        paper:   isDark ? "#111C17" : "#FFFFFF",
      },
      text: {
        primary:   isDark ? "#ECFDF5" : "#052E16",
        secondary: isDark ? "#86EFAC" : "#166534",
        disabled:  isDark ? "#4ADE80" : "#6EE7B7",
      },
      divider: isDark ? "rgba(255,255,255,0.06)" : "rgba(6,95,70,0.10)",
      action: {
        hover:    isDark ? "rgba(16,185,129,0.10)" : "rgba(16,185,129,0.06)",
        selected: isDark ? "rgba(16,185,129,0.18)" : "rgba(16,185,129,0.12)",
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
            backgroundColor: isDark ? "#0A1410" : "#F0FDF4",
            color: isDark ? "#ECFDF5" : "#052E16",
            scrollbarWidth: "thin",
            "&::-webkit-scrollbar": { width: "6px", height: "6px" },
            "&::-webkit-scrollbar-track": { background: isDark ? "#0A1410" : "#DCFCE7" },
            "&::-webkit-scrollbar-thumb": {
              background: isDark ? "#14532D" : "#A7F3D0",
              borderRadius: "3px",
            },
            "&::-webkit-scrollbar-thumb:hover": { background: pLight },
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
              boxShadow: "0 4px 12px rgba(16,185,129,0.30)",
            },
          },
          containedPrimary: {
            background: `linear-gradient(135deg, #34D399 0%, ${pLight} 100%)`,
            color: "#052E16",
          },
          containedSecondary: {
            background: "linear-gradient(135deg, #22D3EE 0%, #0E7490 100%)",
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundColor: isDark ? "#111C17" : "#FFFFFF",
            backgroundImage: "none",
            border: isDark
              ? "1px solid rgba(255,255,255,0.06)"
              : `1px solid rgba(16,185,129,0.12)`,
            borderRadius: "12px",
            boxShadow: isDark
              ? "0 8px 32px 0 rgba(0,0,0,0.45)"
              : "0 4px 24px 0 rgba(16,185,129,0.08)",
            transition: "all 0.3s ease",
            "&:hover": {
              borderColor: isDark ? "rgba(16,185,129,0.25)" : "rgba(16,185,129,0.25)",
              boxShadow: isDark
                ? "0 8px 32px 0 rgba(16,185,129,0.07)"
                : "0 8px 32px 0 rgba(16,185,129,0.14)",
            },
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            "& .MuiOutlinedInput-root": {
              borderRadius: "8px",
              backgroundColor: isDark ? "rgba(10,20,16,0.6)" : "rgba(240,253,244,0.8)",
              transition: "all 0.2s",
              "& .MuiOutlinedInput-notchedOutline": {
                borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(16,185,129,0.20)",
                transition: "border-color 0.2s",
              },
              "&:hover .MuiOutlinedInput-notchedOutline": {
                borderColor: isDark ? "rgba(16,185,129,0.40)" : "rgba(16,185,129,0.50)",
              },
              "&.Mui-focused": {
                boxShadow: "0 0 0 2px rgba(16,185,129,0.20)",
              },
              "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                borderColor: pLight,
                borderWidth: "1px",
              },
            },
          },
        },
      },
    },
  });
};
