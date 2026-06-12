import { EventosQueries } from "../db/queries/eventos.queries.js";
import { TareasQueries } from "../db/queries/tareas.queries.js";

type AgendaPermisos = { verEventos: boolean; verTareas: boolean };

export class AgendaService {
  static async getOverview(estudioId: number, from: string, to: string, permisos: AgendaPermisos) {
    const fromDate = new Date(from);
    const toDate = new Date(to);

    // Cada parte de la agenda se incluye solo si el usuario tiene permiso de lectura del
    // modulo correspondiente; asi la vista unificada no filtra datos por la puerta de atras.
    const listaEventos = permisos.verEventos ? await EventosQueries.findInRange(estudioId, fromDate, toDate) : [];
    const listaTareas = permisos.verTareas ? await TareasQueries.findInRange(estudioId, fromDate, toDate) : [];

    const agenda = [
      ...listaEventos.map((e) => ({
        id: e.id,
        tipo: "EVENTO" as const,
        titulo: e.descripcion,
        fecha: e.fechaInicio?.toISOString() ?? null,
        fechaFin: e.fechaFin?.toISOString() ?? null,
        allDay: e.allDay,
        subtipoId: e.tipoId,
        estadoId: e.estadoId,
        color: "#3b82f6",
        link: `/expedientes/${e.casoId}`,
      })),
      ...listaTareas.map((t) => ({
        id: t.id,
        tipo: "TAREA" as const,
        titulo: t.titulo,
        fecha: t.fechaLimite?.toISOString() ?? null,
        fechaFin: null,
        allDay: true,
        subtipoId: t.prioridadId,
        estadoId: t.completada ? 1 : 0,
        color: t.prioridadId === 3 ? "#ef4444" : "#10b981",
        link: `/tareas/${t.id}`,
      })),
    ];

    return agenda.sort((a, b) => {
      if (!a.fecha) return 1;
      if (!b.fecha) return -1;
      return new Date(a.fecha).getTime() - new Date(b.fecha).getTime();
    });
  }
}
