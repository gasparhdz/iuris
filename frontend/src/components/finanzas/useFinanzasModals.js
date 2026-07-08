import { useContext } from "react";
import { FinanzasModalsContext } from "./finanzasModalsContext";

export function useFinanzasModals() {
  const ctx = useContext(FinanzasModalsContext);
  if (!ctx) throw new Error("useFinanzasModals debe usarse dentro de FinanzasModalsProvider");
  return ctx;
}
