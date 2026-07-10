import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "../../db/index.js";
import { clientes, estudios, ingresos } from "../../db/schema.js";
import { PlanesService } from "../../services/planes.service.js";
import { IngresosService } from "../../services/ingresos.service.js";

const TIPO_PERSONA_FISICA = 143;

describe("ingresos — aislamiento cross-tenant de cliente/caso", () => {
  let estudioA: number;
  let estudioB: number;
  let clienteA: number;
  let clienteB: number;
  let ingresoId: number;
  const stamp = Date.now();

  beforeAll(async () => {
    const [a] = await db.insert(estudios).values({ nombre: `Ing A ${stamp}` }).returning({ id: estudios.id });
    const [b] = await db.insert(estudios).values({ nombre: `Ing B ${stamp}` }).returning({ id: estudios.id });
    estudioA = a.id;
    estudioB = b.id;

    const [ca] = await db.insert(clientes).values({
      estudioId: estudioA,
      tipoPersonaId: TIPO_PERSONA_FISICA,
      nombre: "Cliente",
      apellido: "A",
    }).returning({ id: clientes.id });
    const [cb] = await db.insert(clientes).values({
      estudioId: estudioB,
      tipoPersonaId: TIPO_PERSONA_FISICA,
      nombre: "Cliente",
      apellido: "B",
    }).returning({ id: clientes.id });
    clienteA = ca.id;
    clienteB = cb.id;

    const [ing] = await db.insert(ingresos).values({
      estudioId: estudioA,
      clienteId: clienteA,
      monto: "50.00",
      fechaIngreso: new Date(),
      createdBy: null,
    }).returning({ id: ingresos.id });
    ingresoId = ing.id;
  });

  afterAll(async () => {
    await db.delete(ingresos).where(eq(ingresos.id, ingresoId));
    await db.delete(clientes).where(inArray(clientes.id, [clienteA, clienteB]));
    await db.update(estudios).set({ activo: false }).where(inArray(estudios.id, [estudioA, estudioB]));
  });

  it("registrarIngreso con clienteId de otro estudio → CLIENTE_NOT_FOUND", async () => {
    await expect(
      PlanesService.registrarIngreso(estudioA, 1, {
        clienteId: clienteB,
        monto: 100 as unknown as number,
        fechaIngreso: new Date().toISOString(),
      }),
    ).rejects.toThrow("CLIENTE_NOT_FOUND");
  });

  it("update de ingreso no acepta clienteId de otro estudio", async () => {
    await expect(
      IngresosService.update(ingresoId, estudioA, 1, { clienteId: clienteB }),
    ).rejects.toThrow("CLIENTE_NOT_FOUND");
  });
});
