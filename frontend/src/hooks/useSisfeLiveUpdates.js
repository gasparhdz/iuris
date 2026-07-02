import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { abrirCanalNotificaciones } from "../api/notificaciones.api";
import { getSisfeStatus } from "../api/sisfe.api";
import { invalidateSisfeQueries } from "../utils/sisfeInvalidation";

/**
 * Mantiene la UI al día durante y después de una sincronización SISFE:
 * - SSE global (novedades + progreso por expediente)
 * - Refresco periódico mientras el sync está en curso
 */
export function useSisfeLiveUpdates(enabled = true) {
  const queryClient = useQueryClient();
  const prevSyncStatus = useRef(undefined);

  const statusQuery = useQuery({
    queryKey: ["sisfe", "status"],
    queryFn: getSisfeStatus,
    enabled,
    staleTime: 10_000,
    refetchInterval: (query) => (query.state.data?.syncStatus === "running" ? 2000 : false),
  });

  useEffect(() => {
    if (!enabled) return undefined;

    const source = abrirCanalNotificaciones({
      onNovedades: () => invalidateSisfeQueries(queryClient),
      onSisfeSync: (payload) => invalidateSisfeQueries(queryClient, { casoId: payload?.casoId }),
    });

    return () => source?.close();
  }, [enabled, queryClient]);

  // Mientras corre el sync, refrescar listados y detalle sin esperar al cierre del navegador.
  useEffect(() => {
    if (!enabled) return;
    if (statusQuery.data?.syncStatus !== "running") return undefined;

    invalidateSisfeQueries(queryClient);
    const id = setInterval(() => invalidateSisfeQueries(queryClient), 4000);
    return () => clearInterval(id);
  }, [enabled, queryClient, statusQuery.data?.syncStatus]);

  // Al terminar (done/error), un último refresco por si el SSE no llegó a tiempo.
  useEffect(() => {
    if (!enabled) return;
    const current = statusQuery.data?.syncStatus;
    if (prevSyncStatus.current === "running" && (current === "done" || current === "error")) {
      invalidateSisfeQueries(queryClient);
    }
    prevSyncStatus.current = current;
  }, [enabled, queryClient, statusQuery.data?.syncStatus]);
}
