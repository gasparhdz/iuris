import { createContext, useContext, useMemo, useState } from "react";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { getTheme } from "./theme";
import { getThemeA } from "./themeA";
import { getThemeB } from "./themeB";
import { getThemeC } from "./themeC";

export const PALETTE_OPTIONS = [
  { key: "original", label: "Original",    accent: "#6366F1", desc: "Índigo + Teal"      },
  { key: "A",        label: "Institucional", accent: "#1D4ED8", desc: "Azul + Sky"         },
  { key: "B",        label: "Jurídico",    accent: "#D97706", desc: "Slate + Dorado"     },
  { key: "C",        label: "Judicial",    accent: "#10B981", desc: "Verde Esmeralda"    },
];

const themeBuilders = {
  original: getTheme,
  A: getThemeA,
  B: getThemeB,
  C: getThemeC,
};

const ThemeModeContext = createContext({
  mode: "light",
  palette: "original",
  toggle: () => {},
  setPalette: () => {},
});

export function ThemeModeProvider({ children }) {
  const [mode, setMode] = useState(() => {
    const saved = localStorage.getItem("iuris_theme_mode");
    return saved === "dark" || saved === "light" ? saved : "light";
  });

  const [palette, setPaletteState] = useState(() => {
    const saved = localStorage.getItem("iuris_theme_palette");
    return saved && themeBuilders[saved] ? saved : "A";
  });

  const toggle = () => {
    setMode((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("iuris_theme_mode", next);
      return next;
    });
  };

  const setPalette = (key) => {
    if (!themeBuilders[key]) return;
    localStorage.setItem("iuris_theme_palette", key);
    setPaletteState(key);
  };

  const theme = useMemo(
    () => themeBuilders[palette](mode),
    [mode, palette]
  );

  const value = useMemo(
    () => ({ mode, palette, toggle, setPalette }),
    [mode, palette]
  );

  return (
    <ThemeModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
}

export const useThemeMode = () => useContext(ThemeModeContext);
