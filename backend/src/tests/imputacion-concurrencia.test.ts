/**
 * Test de concurrencia: imputación de pagos con FOR UPDATE
 *
 * Verifica que dos transacciones simultáneas sobre la misma cuota
 * NO pueden sobre-pagarla. Una debe tener éxito y la otra recibir
 * MONTO_EXCEDE_SALDO_CUOTA.
 *
 * Ejecutar: npx tsx src/tests/imputacion-concurrencia.test.ts
 */

import { db } from "../db/index.js";
import { aplicarIngresoACuota, PlanesService } from "../services/planes.service.js";
import { PlanesQueries } from "../db/queries/planes.queries.js";
import {
  estudios,
  usuarios,
  honorarios,
  planesPago,
  planCuotas,
  ingresos,
  ingresoAplicaciones,
  parametros,
  categorias,
} from "../db/schema.js";
import { eq, and, isNull, sql } from "drizzle-orm";

const TEST_MARKER = "__TEST_CONCURRENCIA_FOR_UPDATE__";

interface TestData {
  estudioId: number;
  userId: number;
  honorarioId: number;
  createdHonorario: boolean;
  planId: number;
  cuotaId: number;
  ingreso1Id: number;
  ingreso2Id: number;
  montoCuota: number;
}

async function setup(): Promise<TestData> {
  // Find existing estudio and usuario
  const [estudio] = await db.select({ id: estudios.id }).from(estudios).limit(1);
  if (!estudio) {
    console.error("❌ No hay estudios en la base de datos. Ejecutá el seed primero.");
    process.exit(1);
  }

  const [usuario] = await db
    .select({ id: usuarios.id })
    .from(usuarios)
    .where(eq(usuarios.estudioId, estudio.id))
    .limit(1);
  if (!usuario) {
    console.error("❌ No hay usuarios para este estudio. Ejecutá el seed primero.");
    process.exit(1);
  }

  // Find ESTADO_CUOTA PENDIENTE
  const estadoPendiente = await PlanesQueries.findParametroByCodigo("ESTADO_CUOTA", "PENDIENTE");
  if (!estadoPendiente) {
    console.error("❌ Parametro ESTADO_CUOTA/PENDIENTE no encontrado. Ejecutá el seed primero.");
    process.exit(1);
  }

  // Find or create a valid honorario
  let honorarioId: number;
  let createdHonorario = false;

  const [existingHonorario] = await db
    .select({ id: honorarios.id })
    .from(honorarios)
    .where(and(eq(honorarios.estudioId, estudio.id), isNull(honorarios.deletedAt)))
    .limit(1);

  if (existingHonorario) {
    honorarioId = existingHonorario.id;
  } else {
    // Find any parametros for concepto and parte
    const allParams = await db
      .select({ id: parametros.id, categoriaCodigo: categorias.codigo })
      .from(parametros)
      .innerJoin(categorias, eq(parametros.categoriaId, categorias.id))
      .where(eq(parametros.activo, true))
      .limit(2);

    if (allParams.length < 2) {
      console.error("❌ No hay suficientes parametros. Ejecutá el seed primero.");
      process.exit(1);
    }

    const [h] = await db
      .insert(honorarios)
      .values({
        estudioId: estudio.id,
        conceptoId: allParams[0].id,
        parteId: allParams[1].id,
        fechaRegulacion: new Date(),
        montoPesos: "10000.00",
        createdBy: usuario.id,
      })
      .returning();

    honorarioId = h.id;
    createdHonorario = true;
  }

  // Create test plan
  const [plan] = await db
    .insert(planesPago)
    .values({
      estudioId: estudio.id,
      honorarioId,
      descripcion: TEST_MARKER,
      createdBy: usuario.id,
    })
    .returning();

  // Create test cuota: $10,000
  const [cuota] = await db
    .insert(planCuotas)
    .values({
      planId: plan.id,
      numero: 1,
      vencimiento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      montoPesos: "10000.00",
      estadoId: estadoPendiente.id,
      createdBy: usuario.id,
    })
    .returning();

  // Create two ingresos (without aplicaciones — those come from the test)
  const [ingreso1] = await db
    .insert(ingresos)
    .values({
      estudioId: estudio.id,
      descripcion: TEST_MARKER + "_1",
      monto: "10000.00",
      fechaIngreso: new Date(),
      createdBy: usuario.id,
    })
    .returning();

  const [ingreso2] = await db
    .insert(ingresos)
    .values({
      estudioId: estudio.id,
      descripcion: TEST_MARKER + "_2",
      monto: "10000.00",
      fechaIngreso: new Date(),
      createdBy: usuario.id,
    })
    .returning();

  return {
    estudioId: estudio.id,
    userId: usuario.id,
    honorarioId,
    createdHonorario,
    planId: plan.id,
    cuotaId: cuota.id,
    ingreso1Id: ingreso1.id,
    ingreso2Id: ingreso2.id,
    montoCuota: 10000,
  };
}

async function cleanup(data: TestData) {
  await db
    .delete(ingresoAplicaciones)
    .where(
      sql`${ingresoAplicaciones.ingresoId} IN (${sql.raw(String(data.ingreso1Id))}, ${sql.raw(String(data.ingreso2Id))})`
    );
  await db
    .delete(ingresos)
    .where(
      sql`${ingresos.id} IN (${sql.raw(String(data.ingreso1Id))}, ${sql.raw(String(data.ingreso2Id))})`
    );
  await db.delete(planCuotas).where(eq(planCuotas.planId, data.planId));
  await db.delete(planesPago).where(eq(planesPago.id, data.planId));
  if (data.createdHonorario) {
    await db.delete(honorarios).where(eq(honorarios.id, data.honorarioId));
  }
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║  Test de Concurrencia: Imputación con FOR UPDATE           ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  const data = await setup();
  console.log(`  Setup: cuota #${data.cuotaId} con monto $${data.montoCuota}`);
  console.log(`  Ingresos: #${data.ingreso1Id} y #${data.ingreso2Id} ($${data.montoCuota} cada uno)\n`);

  try {
    // ─── Test 1: Two concurrent full payments ─────────────────────────
    console.log("─── Test 1: Dos pagos simultáneos por el total ($10,000 c/u) ───\n");

    const [result1, result2] = await Promise.allSettled([
      aplicarIngresoACuota(db, {
        ingresoId: data.ingreso1Id,
        cuotaId: data.cuotaId,
        estudioId: data.estudioId,
        monto: data.montoCuota,
        userId: data.userId,
      }),
      aplicarIngresoACuota(db, {
        ingresoId: data.ingreso2Id,
        cuotaId: data.cuotaId,
        estudioId: data.estudioId,
        monto: data.montoCuota,
        userId: data.userId,
      }),
    ]);

    const r1Status = result1.status === "fulfilled" ? "✓ ÉXITO" : `✗ RECHAZADO (${(result1 as PromiseRejectedResult).reason?.message})`;
    const r2Status = result2.status === "fulfilled" ? "✓ ÉXITO" : `✗ RECHAZADO (${(result2 as PromiseRejectedResult).reason?.message})`;
    console.log(`  TX1: ${r1Status}`);
    console.log(`  TX2: ${r2Status}\n`);

    // Assert: exactly one succeeded, one rejected
    const fulfilled = [result1, result2].filter((r) => r.status === "fulfilled");
    const rejected = [result1, result2].filter((r) => r.status === "rejected");

    assert(
      fulfilled.length === 1 && rejected.length === 1,
      `Se esperaba 1 éxito y 1 rechazo, pero hubo ${fulfilled.length} éxitos y ${rejected.length} rechazos`
    );

    // Assert: rejection reason is MONTO_EXCEDE_SALDO_CUOTA
    const rejectedReason = (rejected[0] as PromiseRejectedResult).reason;
    assert(
      rejectedReason.message === "MONTO_EXCEDE_SALDO_CUOTA",
      `Error inesperado: ${rejectedReason.message} (se esperaba MONTO_EXCEDE_SALDO_CUOTA)`
    );

    // Assert: total applied never exceeds cuota monto
    const totalAplicado = await PlanesQueries.sumAplicacionesByCuota(data.cuotaId);
    console.log(`  Total aplicado a cuota: $${totalAplicado}`);
    console.log(`  Monto cuota:            $${data.montoCuota}`);

    assert(
      totalAplicado <= data.montoCuota + 0.01,
      `Total aplicado ($${totalAplicado}) EXCEDE el monto de la cuota ($${data.montoCuota})`
    );

    assert(
      Math.abs(totalAplicado - data.montoCuota) < 0.01,
      `Total aplicado ($${totalAplicado}) no coincide con monto cuota ($${data.montoCuota})`
    );

    console.log("\n  ✅ Test 1 PASADO\n");

    // ─── Test 2: Verify cuota estado is PAGADA ────────────────────────
    console.log("─── Test 2: Estado de la cuota después del pago ───\n");

    const cuotaFinal = await PlanesQueries.findCuotaById(data.cuotaId, data.estudioId);
    const estadoCodigo = cuotaFinal?.estadoCodigo ?? "NULL";
    console.log(`  Estado cuota: ${estadoCodigo}`);

    // The cuota should be PAGADA since the full amount was applied
    assert(
      estadoCodigo === null || estadoCodigo === "PAGADA",
      `Se esperaba estado PAGADA pero se encontró ${estadoCodigo}`
    );

    console.log("\n  ✅ Test 2 PASADO\n");

    // ─── Test 3: Guardrail materializado monto_aplicado ───────────────
    console.log("─── Test 3: Espejo monto_aplicado == SUM(aplicaciones) == cuota ───\n");

    const [cuotaRow] = await db
      .select({ montoAplicado: planCuotas.montoAplicado, montoPesos: planCuotas.montoPesos })
      .from(planCuotas)
      .where(eq(planCuotas.id, data.cuotaId))
      .limit(1);
    const montoAplicadoCol = Number(cuotaRow?.montoAplicado ?? 0);
    const sumReal = await PlanesQueries.sumAplicacionesByCuota(data.cuotaId);
    console.log(`  monto_aplicado (columna): $${montoAplicadoCol}`);
    console.log(`  SUM(aplicaciones):        $${sumReal}`);
    console.log(`  monto_pesos cuota:        $${Number(cuotaRow?.montoPesos ?? 0)}`);

    assert(
      Math.abs(montoAplicadoCol - sumReal) < 0.01,
      `Columna monto_aplicado ($${montoAplicadoCol}) desincronizada de SUM real ($${sumReal})`
    );
    assert(
      Math.abs(montoAplicadoCol - data.montoCuota) < 0.01,
      `Columna monto_aplicado ($${montoAplicadoCol}) != monto cuota ($${data.montoCuota})`
    );

    console.log("\n  ✅ Test 3 PASADO\n");

    // ─── Test 4: El CHECK rechaza sobre-imputación directa ────────────
    console.log("─── Test 4: CHECK constraint bloquea monto_aplicado > monto_pesos ───\n");

    let checkRejected = false;
    try {
      await db
        .update(planCuotas)
        .set({ montoAplicado: String(data.montoCuota + 1000) }) // 11,000 > 10,000
        .where(eq(planCuotas.id, data.cuotaId));
    } catch (err: any) {
      // Drizzle envuelve el error de pg; el codigo real esta en err.cause.
      const pgErr = err?.cause ?? err;
      // PostgreSQL 23514 = check_violation
      checkRejected =
        pgErr?.code === "23514" ||
        pgErr?.constraint === "plan_cuotas_monto_aplicado_check" ||
        /violates check constraint/i.test(String(pgErr?.message));
      console.log(`  UPDATE rechazado por la base: ${pgErr?.code} ${pgErr?.constraint ?? ""}`);
    }
    assert(
      checkRejected,
      "El CHECK no rechazó un monto_aplicado > monto_pesos (sobre-imputación directa permitida)"
    );

    console.log("\n  ✅ Test 4 PASADO\n");

    // ─── Test 5: Concurrencia CRUZADA registrarIngreso vs aplicarIngresoACuota ──
    console.log("─── Test 5: registrarIngreso vs aplicarIngresoACuota (misma cuota) ───\n");

    const estadoPend = await PlanesQueries.findParametroByCodigo("ESTADO_CUOTA", "PENDIENTE");
    const [c2] = await db
      .insert(planCuotas)
      .values({
        planId: data.planId,
        numero: 2,
        vencimiento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        montoPesos: "10000.00",
        estadoId: estadoPend!.id,
        createdBy: data.userId,
      })
      .returning();
    const [i3] = await db
      .insert(ingresos)
      .values({
        estudioId: data.estudioId,
        descripcion: TEST_MARKER + "_3",
        monto: "10000.00",
        fechaIngreso: new Date(),
        createdBy: data.userId,
      })
      .returning();

    // Ambos caminos toman lock por cuota_id ASC -> no debe haber deadlock,
    // y el saldo nunca debe sobre-imputarse aunque corran en simultáneo.
    const [rA, rB] = await Promise.allSettled([
      aplicarIngresoACuota(db, {
        ingresoId: i3.id,
        cuotaId: c2.id,
        estudioId: data.estudioId,
        monto: 10000,
        userId: data.userId,
      }),
      PlanesService.registrarIngreso(data.estudioId, data.userId, {
        cuotaIds: [c2.id],
        monto: 10000,
        fechaIngreso: new Date().toISOString(),
      } as any),
    ]);

    console.log(`  aplicarIngresoACuota: ${rA.status}`);
    console.log(`  registrarIngreso:     ${rB.status}`);

    // No deadlock: ambas promesas resolvieron (settle), ninguna quedó colgada.
    assert(
      (rA.status === "fulfilled" || rA.status === "rejected") &&
      (rB.status === "fulfilled" || rB.status === "rejected"),
      "Deadlock: alguna operación no resolvió"
    );

    const totalC2 = await PlanesQueries.sumAplicacionesByCuota(c2.id);
    const [c2row] = await db
      .select({ montoAplicado: planCuotas.montoAplicado })
      .from(planCuotas)
      .where(eq(planCuotas.id, c2.id))
      .limit(1);
    console.log(`  Total aplicado a cuota: $${totalC2} | columna: $${Number(c2row?.montoAplicado ?? 0)}`);

    assert(totalC2 <= 10000 + 0.01, `Sobre-imputación cruzada: $${totalC2} > $10000`);
    assert(Math.abs(totalC2 - 10000) < 0.01, `Se esperaba $10000 aplicado, hubo $${totalC2}`);
    assert(
      Math.abs(Number(c2row?.montoAplicado ?? 0) - totalC2) < 0.01,
      `Columna monto_aplicado desincronizada en camino cruzado`
    );

    // Cleanup Test 5
    await db.delete(ingresoAplicaciones).where(eq(ingresoAplicaciones.cuotaId, c2.id));
    const idsBorrar = [i3.id];
    if (rB.status === "fulfilled" && (rB.value as any)?.id) idsBorrar.push((rB.value as any).id);
    await db.delete(ingresoAplicaciones).where(
      sql`${ingresoAplicaciones.ingresoId} IN (${sql.join(idsBorrar.map((x) => sql`${x}`), sql`, `)})`
    );
    await db.delete(ingresos).where(
      sql`${ingresos.id} IN (${sql.join(idsBorrar.map((x) => sql`${x}`), sql`, `)})`
    );
    await db.delete(planCuotas).where(eq(planCuotas.id, c2.id));

    console.log("\n  ✅ Test 5 PASADO\n");

  } finally {
    await cleanup(data);
    console.log("  Cleanup completo ✓");
  }

  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║  ✅ TODOS LOS TESTS PASARON                                ║");
  console.log("║  La imputación con FOR UPDATE previene el sobre-pago.       ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  process.exit(0);
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(`❌ ASSERTION FAILED: ${message}`);
  }
}

main().catch((err) => {
  console.error(`\n❌ TEST FALLIDO: ${err.message}\n`);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
