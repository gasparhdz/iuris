import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import api from "../../api/axios";
import { fetchAllPages } from "../../api/pagination";
import { getApiError, isOverdue, unwrapEntity } from "../tareasUtils";
import { eventDate, normalizeCode } from "./dashboardUtils";

export function useDashboardData() {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const tareasQuery = useQuery({
    queryKey: ["dashboard", "tareas"],
    queryFn: () => fetchAllPages("/tareas", { completada: "false" }),
    staleTime: 60_000,
  });

  const eventosQuery = useQuery({
    queryKey: ["dashboard", "eventos"],
    queryFn: () => fetchAllPages("/eventos"),
    staleTime: 60_000,
  });

  const clientesQuery = useQuery({
    queryKey: ["clientes", "lookup"],
    queryFn: () => fetchAllPages("/clientes"),
    staleTime: 1000 * 60 * 5,
  });

  const expedientesQuery = useQuery({
    queryKey: ["expedientes", "lookup"],
    queryFn: () => fetchAllPages("/expedientes"),
    staleTime: 1000 * 60 * 5,
  });

  const catalogQuery = useQuery({
    queryKey: ["dashboard", "catalogos"],
    queryFn: async () => {
      const unwrap = (res) => {
        const raw = res.data?.data ?? res.data;
        return Array.isArray(raw) ? raw : [];
      };
      const [estados, tipos] = await Promise.all([
        api.get("/catalogos/parametros", { params: { categoria: "ESTADO_EVENTO" } }),
        api.get("/catalogos/parametros", { params: { categoria: "TIPO_EVENTO" } }),
      ]);
      return { ESTADO_EVENTO: unwrap(estados), TIPO_EVENTO: unwrap(tipos) };
    },
    staleTime: 300_000,
  });

  function invalidateDashboard() {
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["tareas"] });
    queryClient.invalidateQueries({ queryKey: ["agenda"] });
  }

  const tareas = useMemo(() => tareasQuery.data ?? [], [tareasQuery.data]);
  const eventos = useMemo(() => eventosQuery.data ?? [], [eventosQuery.data]);
  const catalogEstadosEvento = useMemo(() => catalogQuery.data?.ESTADO_EVENTO ?? [], [catalogQuery.data?.ESTADO_EVENTO]);
  const catalogTiposEvento = useMemo(() => catalogQuery.data?.TIPO_EVENTO ?? [], [catalogQuery.data?.TIPO_EVENTO]);

  const tiposEventoById = useMemo(
    () => new Map(catalogTiposEvento.map((t) => [Number(t.id), t])),
    [catalogTiposEvento],
  );
  const clientesById = useMemo(
    () => new Map((clientesQuery.data ?? []).map((c) => [Number(c.id), c])),
    [clientesQuery.data],
  );
  const expedientesById = useMemo(
    () => new Map((expedientesQuery.data ?? []).map((c) => [Number(c.id), c])),
    [expedientesQuery.data],
  );

  const estadoEventoIdByCodigo = useMemo(() => {
    const map = new Map();
    catalogEstadosEvento.forEach((estado) => {
      map.set(normalizeCode(estado.codigo), Number(estado.id));
    });
    return map;
  }, [catalogEstadosEvento]);

  const realizadoEstadoId = estadoEventoIdByCodigo.get("REALIZADO") ?? null;
  const pendienteEstadoId = estadoEventoIdByCodigo.get("PENDIENTE") ?? null;

  const toggleTaskMutation = useMutation({
    mutationFn: async (task) => {
      const { data } = await api.put(`/tareas/${task.id}`, {
        completada: !task.completada,
        completarSubtareas: false,
      });
      return unwrapEntity(data);
    },
    onSuccess: (_, task) => {
      enqueueSnackbar(task.completada ? "Tarea reabierta" : "Tarea completada", { variant: "success" });
      invalidateDashboard();
    },
    onError: (error) => enqueueSnackbar(getApiError(error, "No se pudo actualizar la tarea"), { variant: "error" }),
  });

  const toggleSubtaskMutation = useMutation({
    mutationFn: async ({ taskId, subtaskId }) => {
      const { data } = await api.patch(`/tareas/${taskId}/subtareas/${subtaskId}/toggle`);
      return unwrapEntity(data);
    },
    onSuccess: (_, vars) => {
      enqueueSnackbar("Subtarea actualizada", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "tareas"] });
      queryClient.invalidateQueries({ queryKey: ["tareas"] });
      queryClient.invalidateQueries({ queryKey: ["tareas", String(vars.taskId)] });
      queryClient.invalidateQueries({ queryKey: ["agenda"] });
    },
    onError: (error) => enqueueSnackbar(getApiError(error, "No se pudo actualizar la subtarea"), { variant: "error" }),
  });

  const toggleEventMutation = useMutation({
    mutationFn: async (event) => {
      const isRealizado = realizadoEstadoId != null && Number(event.estadoId) === realizadoEstadoId;
      const nextEstadoId = isRealizado ? pendienteEstadoId : realizadoEstadoId;
      const { data } = await api.put(`/eventos/${event.id}`, { estadoId: nextEstadoId });
      return unwrapEntity(data);
    },
    onSuccess: (_, event) => {
      const wasRealizado = realizadoEstadoId != null && Number(event.estadoId) === realizadoEstadoId;
      enqueueSnackbar(wasRealizado ? "Evento marcado pendiente" : "Evento marcado como realizado", { variant: "success" });
      invalidateDashboard();
      queryClient.invalidateQueries({ queryKey: ["eventos"] });
    },
    onError: (error) => enqueueSnackbar(getApiError(error, "No se pudo actualizar el evento"), { variant: "error" }),
  });

  const pendingTasks = useMemo(() => {
    const fechaValor = (task) => {
      const t = new Date(task.fechaLimite).getTime();
      return Number.isNaN(t) ? Infinity : t;
    };
    return tareas
      .filter((task) => !task.completada)
      .sort((a, b) => {
        const overdueA = isOverdue(a) ? 0 : 1;
        const overdueB = isOverdue(b) ? 0 : 1;
        if (overdueA !== overdueB) return overdueA - overdueB;
        return fechaValor(a) - fechaValor(b);
      });
  }, [tareas]);

  const overdueTasks = useMemo(
    () => pendingTasks.filter((task) => isOverdue(task)),
    [pendingTasks],
  );

  const upcomingTasks = useMemo(
    () => pendingTasks.filter((task) => !isOverdue(task)),
    [pendingTasks],
  );

  const upcomingEvents = useMemo(() => {
    const now = Date.now();
    return eventos
      .filter((event) => {
        const time = new Date(eventDate(event)).getTime();
        if (Number.isNaN(time)) return false;
        if (time >= now) return true;
        const isRealizado = realizadoEstadoId != null && Number(event.estadoId) === realizadoEstadoId;
        return !isRealizado;
      })
      .sort((a, b) => new Date(eventDate(a)).getTime() - new Date(eventDate(b)).getTime());
  }, [eventos, realizadoEstadoId]);

  const futureEvents = useMemo(() => {
    const now = Date.now();
    return upcomingEvents.filter((event) => new Date(eventDate(event)).getTime() >= now);
  }, [upcomingEvents]);

  const pastPendingEvents = useMemo(() => {
    const now = Date.now();
    return upcomingEvents.filter((event) => new Date(eventDate(event)).getTime() < now);
  }, [upcomingEvents]);

  const taskBusy = toggleTaskMutation.isPending || toggleSubtaskMutation.isPending;

  return {
    tareasQuery,
    eventosQuery,
    catalogQuery,
    tareas,
    eventos,
    tiposEventoById,
    clientesById,
    expedientesById,
    realizadoEstadoId,
    pendienteEstadoId,
    pendingTasks,
    overdueTasks,
    upcomingTasks,
    upcomingEvents,
    futureEvents,
    pastPendingEvents,
    toggleTaskMutation,
    toggleSubtaskMutation,
    toggleEventMutation,
    taskBusy,
    eventBusy: toggleEventMutation.isPending,
  };
}
