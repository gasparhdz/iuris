import { CatalogosQueries } from "../db/queries/catalogos.queries.js";

/**
 * Defensa en profundidad: aunque el front ya no ofrezca monedas no soportadas
 * (USD/EUR desactivados en el catálogo), un request crafteado o un front con
 * caché vieja podría mandar un monedaId inactivo. Rechazamos cualquier monedaId
 * que no sea un parámetro MONEDA activo. Es genérico: si se reactiva una moneda
 * en el catálogo, vuelve a aceptarse sin tocar este código.
 *
 * Lanza "MONEDA_NO_SOPORTADA" (mapeada a 422 en el error handler).
 */
export async function assertMonedaSoportada(monedaId: number | null | undefined): Promise<void> {
  if (monedaId === null || monedaId === undefined) return;
  const moneda = await CatalogosQueries.findActiveParametroByIdAndCategoria(monedaId, "MONEDA");
  if (!moneda) throw new Error("MONEDA_NO_SOPORTADA");
}
