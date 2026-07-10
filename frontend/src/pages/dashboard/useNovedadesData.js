import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale/es";
import {
  getNovedades,
  marcarNovedadesLeidas,
} from "../../api/notificaciones.api";
import { getSisfeStatus } from "../../api/sisfe.api";

const NOVEDADES_PAGE_SIZE = 50;

function frescuraSync(lastSyncAt, sisfeError) {
  if (sisfeError) {
    return {
      tono: "#EF5350",
      texto: "No se pudo consultar el estado de SISFE",
      stale: true,
      horas: Infinity,
      connectivityError: true,
    };
  }
  if (!lastSyncAt) {
    return { tono: "#EF5350", texto: "Nunca sincronizado", stale: true, horas: Infinity, connectivityError: false };
  }
  const horas = dayjs().diff(dayjs(lastSyncAt), "hour");
  const texto = `Sincronizado ${formatDistanceToNow(new Date(lastSyncAt), { locale: es, addSuffix: true })}`;
  if (horas < 24) return { tono: "#2EBD85", texto, stale: false, horas, connectivityError: false };
  if (horas < 72) return { tono: "#FFA726", texto, stale: true, horas, connectivityError: false };
  return { tono: "#EF5350", texto, stale: true, horas, connectivityError: false };
}

export function useNovedadesData() {
  const queryClient = useQueryClient();

  const novedadesQuery = useInfiniteQuery({
    queryKey: ["novedades-expedientes"],
    queryFn: ({ pageParam = 0 }) => getNovedades({ limit: NOVEDADES_PAGE_SIZE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce((sum, page) => sum + (page?.data?.novedades?.length ?? 0), 0);
      const total = lastPage?.data?.total ?? 0;
      return loaded < total ? loaded : undefined;
    },
    refetchOnWindowFocus: "always",
  });

  const sisfeQuery = useQuery({
    queryKey: ["sisfe", "status"],
    queryFn: getSisfeStatus,
    staleTime: 15_000,
  });

  const novedades = novedadesQuery.data?.pages.flatMap((page) => page?.data?.novedades ?? []) ?? [];
  const totalNovedades = novedadesQuery.data?.pages[0]?.data?.total
    ?? novedadesQuery.data?.pages.at(-1)?.data?.total
    ?? 0;
  const lastSyncAt = sisfeQuery.isError ? null : (sisfeQuery.data?.lastSyncAt ?? null);
  const frescura = frescuraSync(lastSyncAt, sisfeQuery.isError ? sisfeQuery.error : null);

  const marcarTodo = useMutation({
    mutationFn: (ids) => {
      const movimientoIds = Array.isArray(ids) ? ids.filter((id) => Number.isFinite(id) && id > 0) : [];
      return marcarNovedadesLeidas(movimientoIds);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["novedades-expedientes"] }),
  });

  const marcarUno = useMutation({
    mutationFn: (id) => marcarNovedadesLeidas([id]),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["novedades-expedientes"] }),
  });

  return {
    novedadesQuery,
    sisfeQuery,
    sisfeError: sisfeQuery.isError ? sisfeQuery.error : null,
    novedades,
    totalNovedades,
    hasMoreNovedades: Boolean(novedadesQuery.hasNextPage),
    loadMoreNovedades: () => novedadesQuery.fetchNextPage(),
    loadingMoreNovedades: novedadesQuery.isFetchingNextPage,
    lastSyncAt,
    frescura,
    marcarTodo,
    marcarUno,
    isLoading: novedadesQuery.isLoading,
  };
}
