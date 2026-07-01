import { createTheme } from "@mui/material/styles";

// Tema Iuris — Dirección "Clave"
// Identidad de marca oficial. Azul de confianza + turquesa de acento.
// Tokens tomados del manual de marca (Claude Design).
export const getThemeIuris = (mode = "light") => {
  const isDark = mode === "dark";

  // Azul primario (escala 50–900). main = 500.
  const blue = {
    50: "#EAF2FD",
    100: "#CFE0FA",
    200: "#A6C6F4",
    300: "#6FA3EC",
    400: "#3D81E0",
    500: "#1A66C9",
    600: "#1557B0",
    700: "#114793",
    800: "#0D3873",
    900: "#0A2B59",
  };

  // En modo oscuro el primario se aclara para mantener contraste sobre fondos oscuros.
  const primaryMain = isDark ? "#5B9BF0" : blue[500];
  const primaryLight = isDark ? "#6FA3EC" : blue[400];
  const primaryDark = isDark ? "#3D81E0" : blue[700];
  const primaryContrast = isDark ? "#0A2B59" : "#FFFFFF";

  return createTheme({
    palette: {
      mode,
      primary: {
        main: primaryMain,
        light: primaryLight,
        dark: primaryDark,
        contrastText: primaryContrast,
      },
      secondary: {
        main: "#00B8A9", // Turquesa de acento
        light: "#4DD0C5",
        dark: "#009488",
        contrastText: "#FFFFFF",
      },
      success: { main: "#1E9E6A", contrastText: "#FFFFFF" },
      warning: { main: "#E0A106", contrastText: "#FFFFFF" },
      error:   { main: "#D64038", contrastText: "#FFFFFF" },
      info:    { main: isDark ? "#5B9BF0" : "#2E80E0", contrastText: "#FFFFFF" },
      background: {
        default: isDark ? "#0E141C" : "#F6F8FA",
        paper:   isDark ? "#161E28" : "#FFFFFF",
      },
      text: {
        primary:   isDark ? "#E6ECF3" : "#0C1015",
        secondary: isDark ? "#9AA8B8" : "#6B7789",
        disabled:  isDark ? "#6B7789" : "#9AA6B5",
      },
      divider: isDark ? "#2A3744" : "#DDE3EA",
      action: {
        hover:    isDark ? "rgba(91,155,240,0.10)" : "rgba(26,102,201,0.06)",
        selected: isDark ? "rgba(91,155,240,0.18)" : "rgba(26,102,201,0.10)",
      },
    },
    typography: {
      // Inter para la UI; Libre Franklin para títulos/marca.
      fontFamily: '"Inter", "Helvetica", "Arial", sans-serif',
      h1: { fontFamily: '"Libre Franklin", "Inter", sans-serif', fontSize: "2.5rem",  fontWeight: 700, letterSpacing: "-0.03em" },
      h2: { fontFamily: '"Libre Franklin", "Inter", sans-serif', fontSize: "2rem",    fontWeight: 700, letterSpacing: "-0.025em" },
      h3: { fontFamily: '"Libre Franklin", "Inter", sans-serif', fontSize: "1.5rem",  fontWeight: 600, letterSpacing: "-0.02em" },
      h4: { fontFamily: '"Libre Franklin", "Inter", sans-serif', fontSize: "1.25rem", fontWeight: 600, letterSpacing: "-0.015em" },
      h5: { fontSize: "1.1rem",  fontWeight: 600 },
      h6: { fontSize: "0.95rem", fontWeight: 600 },
      body1:  { fontSize: "0.95rem", lineHeight: 1.6 },
      body2:  { fontSize: "0.85rem", lineHeight: 1.5 },
      button: { textTransform: "none", fontWeight: 600 },
    },
    shape: { borderRadius: 10 },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: isDark ? "#0E141C" : "#F6F8FA",
            color: isDark ? "#E6ECF3" : "#0C1015",
            scrollbarWidth: "thin",
            "&::-webkit-scrollbar": { width: "6px", height: "6px" },
            "&::-webkit-scrollbar-track": { background: isDark ? "#0E141C" : "#EDF1F5" },
            "&::-webkit-scrollbar-thumb": {
              background: isDark ? "#2A3744" : "#C2CBD6",
              borderRadius: "3px",
            },
            "&::-webkit-scrollbar-thumb:hover": { background: primaryMain },
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
              boxShadow: isDark
                ? "0 4px 12px rgba(0,0,0,0.45)"
                : "0 4px 12px rgba(26,102,201,0.25)",
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundColor: isDark ? "#161E28" : "#FFFFFF",
            backgroundImage: "none",
            border: isDark ? "1px solid #2A3744" : "1px solid #EDF1F5",
            borderRadius: "11px",
            boxShadow: isDark
              ? "0 8px 32px 0 rgba(0,0,0,0.40)"
              : "0 4px 24px 0 rgba(12,16,21,0.06)",
            transition: "all 0.3s ease",
            "&:hover": {
              borderColor: isDark ? "#36404E" : "#DDE3EA",
              boxShadow: isDark
                ? "0 8px 32px 0 rgba(0,0,0,0.50)"
                : "0 8px 32px 0 rgba(12,16,21,0.10)",
            },
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            "& .MuiOutlinedInput-root": {
              borderRadius: "8px",
              backgroundColor: isDark ? "rgba(14,20,28,0.6)" : "rgba(246,248,250,0.8)",
              transition: "all 0.2s",
              "& .MuiOutlinedInput-notchedOutline": {
                borderColor: isDark ? "#2A3744" : "#DDE3EA",
                transition: "border-color 0.2s",
              },
              "&:hover .MuiOutlinedInput-notchedOutline": {
                borderColor: isDark ? "#36404E" : "#C2CBD6",
              },
              "&.Mui-focused": {
                boxShadow: `0 0 0 2px ${isDark ? "rgba(91,155,240,0.25)" : "rgba(26,102,201,0.20)"}`,
              },
              "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                borderColor: primaryMain,
                borderWidth: "1px",
              },
            },
          },
        },
      },
    },
  });
};
