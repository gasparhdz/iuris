import { db } from "./index.js";
import { clientes, planesPago, honorarios, gastos, ingresos } from "./schema.js";
import { eq } from "drizzle-orm";

async function main() {
  const planId = 2;
  const [plan] = await db.select().from(planesPago).where(eq(planesPago.id, planId)).limit(1);
  if (!plan) {
    console.log("Plan 2 not found");
    return;
  }
  console.log("=== PLAN PAGO 2 ===");
  console.log({ id: plan.id, estudioId: plan.estudioId, clienteId: plan.clienteId, casoId: plan.casoId });

  if (plan.clienteId) {
    const [cliente] = await db.select().from(clientes).where(eq(clientes.id, plan.clienteId)).limit(1);
    console.log("=== CLIENTE ===");
    console.log({ found: Boolean(cliente), id: cliente?.id, estudioId: cliente?.estudioId });

    const hList = await db.select().from(honorarios).where(eq(honorarios.clienteId, plan.clienteId));
    console.log("=== HONORARIOS ===");
    console.log({ count: hList.length });

    const gList = await db.select().from(gastos).where(eq(gastos.clienteId, plan.clienteId));
    console.log("=== GASTOS ===");
    console.log({ count: gList.length });

    const iList = await db.select().from(ingresos).where(eq(ingresos.clienteId, plan.clienteId));
    console.log("=== INGRESOS ===");
    console.log({ count: iList.length });
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
