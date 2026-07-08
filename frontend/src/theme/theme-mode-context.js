import { createContext } from "react";

export const ThemeModeContext = createContext({
  mode: "light",
  palette: "original",
  toggle: () => {},
  setPalette: () => {},
});
