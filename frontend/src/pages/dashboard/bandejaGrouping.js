import { eventDate } from "./dashboardUtils";

/** @typedef {'todo' | 'novedades' | 'tareas' | 'eventos'} BandejaFilter */

/** @typedef {'atrasado' | 'novedades' | 'tareas' | 'eventos'} BandejaGroupId */

function overdueItemDate(item) {
  return new Date(item.kind === "tarea" ? item.data.fechaLimite : eventDate(item.data)).getTime();
}

/**
 * @param {object} params
 * @param {import('../tareasUtils').Task[]} params.overdueTasks
 * @param {import('../tareasUtils').Task[]} params.upcomingTasks
 * @param {object[]} params.novedades
 * @param {number} [params.totalNovedades]
 * @param {object[]} params.pastPendingEvents
 * @param {object[]} params.futureEvents
 * @param {BandejaFilter} params.filter
 */
export function buildBandejaGroups({
  overdueTasks,
  upcomingTasks,
  novedades,
  totalNovedades,
  pastPendingEvents,
  futureEvents,
  filter,
}) {
  const groups = [];

  const showTareas = filter === "todo" || filter === "tareas";
  const showNovedades = filter === "todo" || filter === "novedades";
  const showEventos = filter === "todo" || filter === "eventos";

  const overdueItems = [
    ...(showTareas ? overdueTasks.map((task) => ({ kind: "tarea", data: task, subkind: "atrasada" })) : []),
    ...(showEventos ? pastPendingEvents.map((e) => ({ kind: "evento", data: e, subkind: "atrasado" })) : []),
  ].sort((a, b) => overdueItemDate(a) - overdueItemDate(b));

  if (overdueItems.length > 0) {
    groups.push({
      id: "atrasado",
      label: "Atrasado",
      tone: "#C13A33",
      dot: "#D64038",
      items: overdueItems,
    });
  }

  if (showNovedades && novedades.length > 0) {
    const total = Number(totalNovedades) || novedades.length;
    groups.push({
      id: "novedades",
      label: "Movimientos SISFE sin leer",
      tone: "#1A66C9",
      dot: "#1A66C9",
      showMarkAll: true,
      countLabel: novedades.length < total ? `${novedades.length} de ${total}` : String(novedades.length),
      items: novedades.map((n) => ({ kind: "novedad", data: n })),
    });
  }

  if (showTareas && upcomingTasks.length > 0) {
    groups.push({
      id: "tareas",
      label: "Próximas tareas",
      tone: "#1A66C9",
      dot: "#1A66C9",
      items: upcomingTasks.map((task) => ({ kind: "tarea", data: task, subkind: "proxima" })),
    });
  }

  if (showEventos && (futureEvents.length > 0 || filter === "eventos")) {
    groups.push({
      id: "eventos",
      label: "Próximos eventos",
      tone: "#7C5CFC",
      dot: "#7C5CFC",
      items: futureEvents.map((e) => ({ kind: "evento", data: e, subkind: "proximo" })),
    });
  }

  return groups;
}

/**
 * @param {object} params
 * @param {number} params.totalNovedades
 * @param {number} params.overdueCount
 * @param {number} params.upcomingTaskCount
 * @param {number} params.eventCount
 */
export function bandejaFilterCounts({ totalNovedades, overdueCount, upcomingTaskCount, eventCount }) {
  const tareasCount = overdueCount + upcomingTaskCount;
  return {
    todo: totalNovedades + tareasCount + eventCount,
    novedades: totalNovedades,
    tareas: tareasCount,
    eventos: eventCount,
  };
}
