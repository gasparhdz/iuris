import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { inArray } from "drizzle-orm";
import { db } from "../../db/index.js";
import { casos, clientes, estudios, movimientosJudiciales, tareas } from "../../db/schema.js";
import { MovimientosQueries } from "../../db/queries/movimientos.queries.js";

const TIPO_PERSONA_FISICA = 143;

// La tarea ES el plazo del movimiento (vinculada por movimientoId). findMovimientosByCaso
// debe devolver, por movimiento, la fecha de la tarea-plazo activa para mostrar el chip.
let estudioId: number;
let clienteId: number;
let casoId: number;
let movId: number;
const tareaIds: number[] = [];

const venc = new Date("2026-07-15T00:00:00.000Z");

beforeAll(async () => {
  const [e] = await db.insert(estudios).values({ nombre: "Estudio Plazo (test)" }).returning({ id: estudios.id });
  estudioId = e.id;
  const [c] = await db.insert(clientes).values({ estudioId, tipoPersonaId: TIPO_PERSONA_FISICA, nombre: "C", apellido: "P" }).returning({ id: clientes.id });
  clienteId = c.id;
  const [caso] = await db.insert(casos).values({ estudioId, clienteId, tipoId: TIPO_PERSONA_FISICA }).returning({ id: casos.id });
  casoId = caso.id;
  const [m] = await db.insert(movimientosJudiciales).values({ casoId, estudioId, fecha: new Date(), tipo: "Notificación" }).returning({ id: movimientosJudiciales.id });
  movId = m.id;
});

afterAll(async () => {
  if (tareaIds.length) await db.delete(tareas).where(inArray(tareas.id, tareaIds));
  await db.delete(movimientosJudiciales).where(inArray(movimientosJudiciales.id, [movId]));
  await db.delete(casos).where(inArray(casos.id, [casoId]));
  await db.delete(clientes).where(inArray(clientes.id, [clienteId]));
  await db.delete(estudios).where(inArray(estudios.id, [estudioId]));
});

describe("plazo de movimiento (tarea vinculada por movimientoId)", () => {
  it("sin tarea vinculada, el movimiento no trae vencimiento de tarea", async () => {
    const [mov] = await MovimientosQueries.findMovimientosByCaso(casoId, estudioId);
    expect(mov.tareaId).toBeFalsy();
    expect(mov.tareaVencimiento).toBeFalsy();
  });

  it("con tarea-plazo activa, el movimiento devuelve su id y fechaLimite", async () => {
    const [t] = await db.insert(tareas)
      .values({ estudioId, titulo: "Contestar traslado", casoId, movimientoId: movId, fechaLimite: venc })
      .returning({ id: tareas.id });
    tareaIds.push(t.id);

    const [mov] = await MovimientosQueries.findMovimientosByCaso(casoId, estudioId);
    expect(mov.tareaId).toBe(t.id);
    expect(new Date(mov.tareaVencimiento as unknown as string).toISOString()).toBe(venc.toISOString());
  });

  it("una tarea completada no cuenta como plazo vigente", async () => {
    const [done] = await db.insert(tareas)
      .values({ estudioId, titulo: "Plazo viejo", casoId, movimientoId: movId, fechaLimite: new Date("2026-06-01T00:00:00.000Z"), completada: true })
      .returning({ id: tareas.id });
    tareaIds.push(done.id);

    // Sigue devolviendo la activa (la del primer test), no la completada.
    const [mov] = await MovimientosQueries.findMovimientosByCaso(casoId, estudioId);
    expect(new Date(mov.tareaVencimiento as unknown as string).toISOString()).toBe(venc.toISOString());
  });
});
