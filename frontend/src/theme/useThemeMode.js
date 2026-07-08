import { useContext } from "react";
import { ThemeModeContext } from "./theme-mode-context";

export function useThemeMode() {
  return useContext(ThemeModeContext);
}
