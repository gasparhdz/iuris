import { createTheme } from "@mui/material/styles";

export const getTheme = (mode = "light") => {
  const isDark = mode === "dark";

  return createTheme({
    palette: {
      mode,
      primary: {
        main: "#6366F1",
        light: "#818CF8",
        dark: "#4F46E5",
        contrastText: "#FFFFFF",
      },
      secondary: {
        main: "#14B8A6",
        light: "#2DD4BF",
        dark: "#0F766E",
        contrastText: "#FFFFFF",
      },
      background: {
        default: isDark ? "#08090C" : "#F6F7FA",
        paper: isDark ? "#11131A" : "#FFFFFF",
      },
      text: {
        primary: isDark ? "#F8FAFC" : "#0F172A",
        secondary: isDark ? "#94A3B8" : "#475569",
        disabled: isDark ? "#64748B" : "#94A3B8",
      },
      divider: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.08)",
      action: {
        hover: isDark ? "rgba(99,102,241,0.08)" : "rgba(99,102,241,0.06)",
        selected: isDark ? "rgba(99,102,241,0.16)" : "rgba(99,102,241,0.10)",
      },
    },
    typography: {
      fontFamily: '"Plus Jakarta Sans", "Outfit", "Inter", "Helvetica", "Arial", sans-serif',
      h1: { fontSize: "2.5rem", fontWeight: 800, letterSpacing: "-0.05em" },
      h2: { fontSize: "2rem", fontWeight: 700, letterSpacing: "-0.03em" },
      h3: { fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.02em" },
      h4: { fontSize: "1.25rem", fontWeight: 600 },
      h5: { fontSize: "1.1rem", fontWeight: 600 },
      h6: { fontSize: "0.95rem", fontWeight: 600 },
      body1: { fontSize: "0.95rem", lineHeight: 1.6 },
      body2: { fontSize: "0.85rem", lineHeight: 1.5 },
      button: { textTransform: "none", fontWeight: 600 },
    },
    shape: { borderRadius: 12 },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: isDark ? "#08090C" : "#F6F7FA",
            color: isDark ? "#F8FAFC" : "#0F172A",
            scrollbarWidth: "thin",
            "&::-webkit-scrollbar": { width: "6px", height: "6px" },
            "&::-webkit-scrollbar-track": { background: isDark ? "#08090C" : "#F1F5F9" },
            "&::-webkit-scrollbar-thumb": {
              background: isDark ? "#222530" : "#CBD5E1",
              borderRadius: "3px",
            },
            "&::-webkit-scrollbar-thumb:hover": { background: "#6366F1" },
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
              boxShadow: "0 4px 12px rgba(99,102,241,0.25)",
            },
          },
          containedPrimary: {
            background: "linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)",
          },
          containedSecondary: {
            background: "linear-gradient(135deg, #14B8A6 0%, #0F766E 100%)",
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundColor: isDark ? "#11131A" : "#FFFFFF",
            backgroundImage: "none",
            border: isDark
              ? "1px solid rgba(255,255,255,0.05)"
              : "1px solid rgba(99,102,241,0.10)",
            borderRadius: "12px",
            boxShadow: isDark
              ? "0 8px 32px 0 rgba(0,0,0,0.37)"
              : "0 4px 24px 0 rgba(99,102,241,0.08)",
            transition: "all 0.3s ease",
            "&:hover": {
              borderColor: isDark
                ? "rgba(99,102,241,0.2)"
                : "rgba(99,102,241,0.25)",
              boxShadow: isDark
                ? "0 8px 32px 0 rgba(99,102,241,0.05)"
                : "0 8px 32px 0 rgba(99,102,241,0.12)",
            },
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            "& .MuiOutlinedInput-root": {
              borderRadius: "8px",
              backgroundColor: isDark ? "rgba(8,9,12,0.5)" : "rgba(241,245,249,0.7)",
              transition: "all 0.2s",
              // Usamos notchedOutline para preservar el hueco del label (notch)
              "& .MuiOutlinedInput-notchedOutline": {
                borderColor: isDark
                  ? "rgba(255,255,255,0.08)"
                  : "rgba(99,102,241,0.20)",
                transition: "border-color 0.2s",
              },
              "&:hover .MuiOutlinedInput-notchedOutline": {
                borderColor: isDark
                  ? "rgba(99,102,241,0.35)"
                  : "rgba(99,102,241,0.45)",
              },
              "&.Mui-focused": {
                boxShadow: "0 0 0 2px rgba(99,102,241,0.2)",
              },
              "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                borderColor: "#6366F1",
                borderWidth: "1px",
              },
            },
          },
        },
      },
    },
  });
};
