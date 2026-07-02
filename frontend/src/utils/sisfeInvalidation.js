/** Invalida las queries de React Query afectadas por una sincronización SISFE. */
export function invalidateSisfeQueries(queryClient, { casoId } = {}) {
  queryClient.invalidateQueries({ queryKey: ["novedades-expedientes"] });
  queryClient.invalidateQueries({ queryKey: ["expedientes"] });
  queryClient.invalidateQueries({ queryKey: ["dashboard", "expedientes"] });

  if (casoId != null) {
    const id = Number(casoId);
    queryClient.invalidateQueries({ queryKey: ["expedientes", id] });
    queryClient.invalidateQueries({ queryKey: ["expedientes", id, "movimientos"] });
    queryClient.invalidateQueries({ queryKey: ["adjuntos", "CASO", id] });
  }
}
