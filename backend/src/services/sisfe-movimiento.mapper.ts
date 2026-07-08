export type CamposTipoMovimiento = {
  tabla: string;
  tipoActuacion: number | null;
  actuacionTipoFirma: number | null;
};

export function mapaTipoMovimiento({
  tabla,
  tipoActuacion,
  actuacionTipoFirma,
}: CamposTipoMovimiento): string {
  if (tabla === "CARGO") return "Escrito";
  if (tabla === "ACTUACION") {
    if (tipoActuacion === 1) return "Resolución/Sentencia";
    if (tipoActuacion === 3 && actuacionTipoFirma === 1) return "Notificación con firma digital";
    return "Trámite";
  }
  return "Trámite";
}
