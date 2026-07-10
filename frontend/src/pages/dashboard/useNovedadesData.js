import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale/es";
import {
  getNovedades,
  marcarNovedadesLeidas,
} from "../../api/notificaciones.api";
import { getSisfeStatus } from "../../api/sisfe.api";

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

  const novedadesQuery = useQuery({
    queryKey: ["novedades-expedientes"],
    queryFn: getNovedades,
    refetchOnWindowFocus: true,
  });

  const sisfeQuery = useQuery({
    queryKey: ["sisfe", "status"],
    queryFn: getSisfeStatus,
    staleTime: 15_000,
  });

  const novedades = novedadesQuery.data?.data?.novedades ?? [];
  const totalNovedades = novedadesQuery.data?.data?.total ?? 0;
  const lastSyncAt = sisfeQuery.isError ? null : (sisfeQuery.data?.lastSyncAt ?? null);
  const frescura = frescuraSync(lastSyncAt, sisfeQuery.isError ? sisfeQuery.error : null);

  const marcarTodo = useMutation({
    mutationFn: () => marcarNovedadesLeidas(),
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
    lastSyncAt,
    frescura,
    marcarTodo,
    marcarUno,
    isLoading: novedadesQuery.isLoading,
  };
}
