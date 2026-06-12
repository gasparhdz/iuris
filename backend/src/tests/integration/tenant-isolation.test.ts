import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "../../db/index.js";
import { clientes, estudios, honorarios } from "../../db/schema.js";
import { ClientesQueries } from "../../db/queries/clientes.queries.js";
import { HonorariosQueries } from "../../db/queries/honorarios.queries.js";

const TIPO_PERSONA_FISICA = 143;

// Dos estudios distintos. El seed crea el estudio 1; creamos un segundo estudio "ajeno" para
// verificar que ninguna query deja cruzar datos entre tenants (clase IDOR / OWASP A01).
let estudioA: number;
let estudioB: number;
let clienteA: number;
let clienteB: number;
const honorarioIds: number[] = [];

beforeAll(async () => {
  const [a] = await db.insert(estudios).values({ nombre: "Estudio A (test)" }).returning({ id: estudios.id });
  const [b] = await db.insert(estudios).values({ nombre: "Estudio B (test)" }).returning({ id: estudios.id });
  estudioA = a.id;
  estudioB = b.id;

  const [ca] = await db.insert(clientes).values({ estudioId: estudioA, tipoPersonaId: TIPO_PERSONA_FISICA, nombre: "Cliente", apellido: "A" }).returning({ id: clientes.id });
  const [cb] = await db.insert(clientes).values({ estudioId: estudioB, tipoPersonaId: TIPO_PERSONA_FISICA, nombre: "Cliente", apellido: "B" }).returning({ id: clientes.id });
  clienteA = ca.id;
  clienteB = cb.id;
});

afterAll(async () => {
  if (honorarioIds.length) await db.delete(honorarios).where(inArray(honorarios.id, honorarioIds));
  await db.delete(clientes).where(inArray(clientes.id, [clienteA, clienteB]));
  await db.delete(estudios).where(inArray(estudios.id, [estudioA, estudioB]));
});

describe("aislamiento entre estudios (IDOR / tenant isolation)", () => {
  it("findById de un cliente solo lo devuelve dentro de su propio estudio", async () => {
    await expect(ClientesQueries.findById(clienteA, estudioA)).resolves.toMatchObject({ id: clienteA });
    // El mismo id, pedido desde OTRO estudio, no debe devolver nada.
    await expect(ClientesQueries.findById(clienteA, estudioB)).resolves.toBeFalsy();
    await expect(ClientesQueries.findById(clienteB, estudioA)).resolves.toBeFalsy();
  });

  it("findAll solo lista clientes del estudio consultado", async () => {
    const { data: aRows } = await ClientesQueries.findAll(estudioA, 100, 0);
    const { data: bRows } = await ClientesQueries.findAll(estudioB, 100, 0);
    expect(aRows.some((c) => c.id === clienteA)).toBe(true);
    expect(aRows.some((c) => c.id === clienteB)).toBe(false);
    expect(bRows.some((c) => c.id === clienteB)).toBe(true);
    expect(bRows.some((c) => c.id === clienteA)).toBe(false);
  });

  it("update de un cliente ajeno no afecta ninguna fila", async () => {
    const updated = await ClientesQueries.update(clienteA, estudioB, { apellido: "HACKEADO" });
    expect(updated).toBeFalsy();
    // El cliente real sigue intacto.
    const real = await ClientesQueries.findById(clienteA, estudioA);
    expect(real?.apellido).toBe("A");
  });

  it("un honorario creado en un estudio no es visible desde otro", async () => {
    const created = await HonorariosQueries.insertHonorario({
      estudioId: estudioA,
      clienteId: clienteA,
      conceptoId: TIPO_PERSONA_FISICA, // cualquier parámetro válido; sólo probamos el scoping por estudio
      parteId: TIPO_PERSONA_FISICA,
      montoPesos: "1000.00",
      fechaRegulacion: new Date(),
    });
    honorarioIds.push(created.id);

    await expect(HonorariosQueries.findHonorarioById(created.id, estudioA)).resolves.toMatchObject({ id: created.id });
    await expect(HonorariosQueries.findHonorarioById(created.id, estudioB)).resolves.toBeFalsy();
  });
});
