/** @typedef {'todo' | 'novedades' | 'tareas' | 'eventos'} BandejaFilter */

/** @typedef {'atrasado' | 'novedades' | 'tareas' | 'eventos'} BandejaGroupId */

/**
 * @param {object} params
 * @param {import('../tareasUtils').Task[]} params.overdueTasks
 * @param {import('../tareasUtils').Task[]} params.upcomingTasks
 * @param {object[]} params.novedades
 * @param {object[]} params.pastPendingEvents
 * @param {object[]} params.futureEvents
 * @param {BandejaFilter} params.filter
 */
export function buildBandejaGroups({
  overdueTasks,
  upcomingTasks,
  novedades,
  pastPendingEvents,
  futureEvents,
  filter,
}) {
  const groups = [];

  const showTareas = filter === "todo" || filter === "tareas";
  const showNovedades = filter === "todo" || filter === "novedades";
  const showEventos = filter === "todo" || filter === "eventos";

  if (showTareas && overdueTasks.length > 0) {
    groups.push({
      id: "atrasado",
      label: "Atrasado",
      tone: "#C13A33",
      dot: "#D64038",
      items: overdueTasks.map((task) => ({ kind: "tarea", data: task, subkind: "atrasada" })),
    });
  }

  if (showNovedades && novedades.length > 0) {
    groups.push({
      id: "novedades",
      label: "Novedades sin leer",
      tone: "#1A66C9",
      dot: "#1A66C9",
      showMarkAll: true,
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

  if (showEventos) {
    const eventItems = [
      ...pastPendingEvents.map((e) => ({ kind: "evento", data: e, subkind: "atrasado" })),
      ...futureEvents.map((e) => ({ kind: "evento", data: e, subkind: "proximo" })),
    ];
    groups.push({
      id: "eventos",
      label: pastPendingEvents.length > 0 ? "Eventos pendientes" : "Próximos eventos",
      tone: "#7C5CFC",
      dot: "#7C5CFC",
      items: eventItems,
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
