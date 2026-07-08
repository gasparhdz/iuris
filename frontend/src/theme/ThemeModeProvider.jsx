import { useMemo, useState } from "react";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { getThemeIuris } from "./themeIuris";
import { getTheme } from "./theme";
import { getThemeA } from "./themeA";
import { getThemeB } from "./themeB";
import { getThemeC } from "./themeC";
import { ThemeModeContext } from "./theme-mode-context";

const themeBuilders = {
  iuris: getThemeIuris,
  original: getTheme,
  A: getThemeA,
  B: getThemeB,
  C: getThemeC,
};

export function ThemeModeProvider({ children }) {
  const [mode, setMode] = useState(() => {
    const saved = localStorage.getItem("iuris_theme_mode");
    return saved === "dark" || saved === "light" ? saved : "light";
  });

  const [palette, setPaletteState] = useState(() => {
    const saved = localStorage.getItem("iuris_theme_palette");
    return saved && themeBuilders[saved] ? saved : "iuris";
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
