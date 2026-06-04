import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "../src/db/index.js";
import { casos, clientes, eventos, gastos, honorarios, parametros, tareas, usuarios } from "../src/db/schema.js";
import { ClientesService } from "../src/services/clientes.service.js";

const fixtureTag = `rollback-${Date.now()}`;

const [usuarioBase] = await db
  .select({
    estudioId: usuarios.estudioId,
    userId: usuarios.id,
  })
  .from(usuarios)
  .where(and(eq(usuarios.activo, true), isNull(usuarios.deletedAt)))
  .limit(1);

const [parametroBase] = await db
  .select({ parametroId: parametros.id })
  .from(parametros)
  .limit(1);

if (!usuarioBase?.estudioId || !parametroBase) {
  throw new Error("No hay usuario activo con estudio y parametro para correr el test de integracion");
}

const fixtureBase = { ...usuarioBase, parametroId: parametroBase.parametroId };

let clienteId: number | null = null;
let casoId: number | null = null;
const childIds: { tarea?: number; evento?: number; gasto?: number; honorario?: number } = {};

try {
  const [cliente] = await db.insert(clientes).values({
    estudioId: fixtureBase.estudioId,
    tipoPersonaId: fixtureBase.parametroId,
    nombre: "Soft Delete",
    apellido: fixtureTag,
    activo: true,
    createdBy: fixtureBase.userId,
  }).returning({ id: clientes.id });
  clienteId = cliente.id;

  const [caso] = await db.insert(casos).values({
    estudioId: fixtureBase.estudioId,
    clienteId,
    tipoId: fixtureBase.parametroId,
    caratula: `Caso ${fixtureTag}`,
    activo: true,
    createdBy: fixtureBase.userId,
  }).returning({ id: casos.id });
  casoId = caso.id;

  const [tarea] = await db.insert(tareas).values({
    estudioId: fixtureBase.estudioId,
    clienteId,
    casoId,
    titulo: `Tarea ${fixtureTag}`,
    activo: true,
    createdBy: fixtureBase.userId,
  }).returning({ id: tareas.id });
  childIds.tarea = tarea.id;

  const [evento] = await db.insert(eventos).values({
    estudioId: fixtureBase.estudioId,
    clienteId,
    casoId,
    fechaInicio: new Date(),
    tipoId: fixtureBase.parametroId,
    activo: true,
    createdBy: fixtureBase.userId,
  }).returning({ id: eventos.id });
  childIds.evento = evento.id;

  const [gasto] = await db.insert(gastos).values({
    estudioId: fixtureBase.estudioId,
    clienteId,
    casoId,
    fechaGasto: new Date(),
    monto: "100.00",
    activo: true,
    createdBy: fixtureBase.userId,
  }).returning({ id: gastos.id });
  childIds.gasto = gasto.id;

  const [honorario] = await db.insert(honorarios).values({
    estudioId: fixtureBase.estudioId,
    clienteId,
    casoId,
    conceptoId: fixtureBase.parametroId,
    parteId: fixtureBase.parametroId,
    fechaRegulacion: new Date(),
    activo: true,
    createdBy: fixtureBase.userId,
  }).returning({ id: honorarios.id });
  childIds.honorario = honorario.id;

  await db.execute(sql.raw(`
    CREATE OR REPLACE FUNCTION soft_delete_cliente_rollback_test_fail()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF OLD.id = ${clienteId} AND NEW.deleted_at IS NOT NULL THEN
        RAISE EXCEPTION 'forced rollback for soft delete cascade test';
      END IF;
      RETURN NEW;
    END;
    $$;

    DROP TRIGGER IF EXISTS soft_delete_cliente_rollback_test_trigger ON clientes;

    CREATE TRIGGER soft_delete_cliente_rollback_test_trigger
    BEFORE UPDATE ON clientes
    FOR EACH ROW
    EXECUTE FUNCTION soft_delete_cliente_rollback_test_fail();
  `));

  let rejected = false;
  try {
    await ClientesService.softDelete(clienteId, fixtureBase.estudioId, fixtureBase.userId);
  } catch {
    rejected = true;
  }

  if (!rejected) throw new Error("El soft-delete debio fallar por el trigger de prueba");

  const [clienteAfter] = await db.select({ deletedAt: clientes.deletedAt }).from(clientes).where(eq(clientes.id, clienteId));
  const [casoAfter] = await db.select({ deletedAt: casos.deletedAt }).from(casos).where(eq(casos.id, casoId));
  const [tareaAfter] = await db.select({ deletedAt: tareas.deletedAt }).from(tareas).where(eq(tareas.id, childIds.tarea!));
  const [eventoAfter] = await db.select({ deletedAt: eventos.deletedAt }).from(eventos).where(eq(eventos.id, childIds.evento!));
  const [gastoAfter] = await db.select({ deletedAt: gastos.deletedAt }).from(gastos).where(eq(gastos.id, childIds.gasto!));
  const [honorarioAfter] = await db.select({ deletedAt: honorarios.deletedAt }).from(honorarios).where(eq(honorarios.id, childIds.honorario!));

  const leakedDeletes = [
    clienteAfter?.deletedAt,
    casoAfter?.deletedAt,
    tareaAfter?.deletedAt,
    eventoAfter?.deletedAt,
    gastoAfter?.deletedAt,
    honorarioAfter?.deletedAt,
  ].filter(Boolean);

  if (leakedDeletes.length > 0) {
    throw new Error(`Rollback incompleto: ${leakedDeletes.length} filas quedaron soft-deleted`);
  }

  console.log("OK soft-delete cascade rollback transaccional");
} finally {
  await db.execute(sql.raw(`
    DROP TRIGGER IF EXISTS soft_delete_cliente_rollback_test_trigger ON clientes;
    DROP FUNCTION IF EXISTS soft_delete_cliente_rollback_test_fail();
  `));

  if (childIds.honorario) await db.delete(honorarios).where(eq(honorarios.id, childIds.honorario));
  if (childIds.gasto) await db.delete(gastos).where(eq(gastos.id, childIds.gasto));
  if (childIds.evento) await db.delete(eventos).where(eq(eventos.id, childIds.evento));
  if (childIds.tarea) await db.delete(tareas).where(eq(tareas.id, childIds.tarea));
  if (casoId) await db.delete(casos).where(eq(casos.id, casoId));
  if (clienteId) await db.delete(clientes).where(eq(clientes.id, clienteId));
}

process.exit(0);
