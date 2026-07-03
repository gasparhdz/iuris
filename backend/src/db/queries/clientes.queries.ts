import { and, asc, desc, eq, getTableColumns, ilike, isNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../index.js";
import { casos, clientes, contactosClientes, eventos, gastos, honorarios, ingresoAplicaciones, ingresos, notasCliente, parametros, planesPago, tareas } from "../schema.js";

type NewCliente = typeof clientes.$inferInsert;
type NewContactoCliente = typeof contactosClientes.$inferInsert;

const TIPO_PERSONA_FISICA_ID = 143;
const TIPO_PERSONA_JURIDICA_ID = 144;

const CASOS_ACTIVOS_EXPR = sql<number>`(SELECT COUNT(*) FROM casos WHERE casos.cliente_id = clientes.id AND casos.deleted_at IS NULL AND casos.estudio_id = clientes.estudio_id)`;

type ClienteListFilters = {
  search?: string;
  tipo?: "fisica" | "juridica";
  estado?: "activo" | "inactivo";
  orderBy?: "nombre" | "identificacion" | "telCelular" | "email" | "casosActivos" | "activo" | "tipo";
  order?: "asc" | "desc";
};

export class ClientesQueries {
  static async findAll(
    estudioId: number,
    limit: number,
    offset: number,
    filters: ClienteListFilters = {},
  ) {
    const { search, tipo, estado, orderBy = "nombre", order = "asc" } = filters;
    let whereCondition = and(
      eq(clientes.estudioId, estudioId),
      isNull(clientes.deletedAt)
    );

    if (search?.trim()) {
      const term = `%${search.trim()}%`;
      whereCondition = and(
        whereCondition,
        or(
          ilike(clientes.nombre, term),
          ilike(clientes.apellido, term),
          ilike(clientes.razonSocial, term),
          ilike(clientes.dni, term),
          ilike(clientes.cuit, term),
          ilike(clientes.email, term),
          ilike(clientes.telCelular, term),
          ilike(clientes.telFijo, term),
        )
      );
    }

    if (tipo === "fisica") {
      whereCondition = and(whereCondition, eq(clientes.tipoPersonaId, TIPO_PERSONA_FISICA_ID));
    } else if (tipo === "juridica") {
      whereCondition = and(whereCondition, eq(clientes.tipoPersonaId, TIPO_PERSONA_JURIDICA_ID));
    }

    if (estado === "activo") {
      whereCondition = and(whereCondition, eq(clientes.activo, true));
    } else if (estado === "inactivo") {
      whereCondition = and(whereCondition, eq(clientes.activo, false));
    }

    const sortDir = order === "desc" ? desc : asc;
    const orderExpr = (() => {
      switch (orderBy) {
        case "identificacion":
          return sortDir(sql`COALESCE(${clientes.cuit}, ${clientes.dni}, '')`);
        case "telCelular":
          return sortDir(clientes.telCelular);
        case "email":
          return sortDir(clientes.email);
        case "casosActivos":
          return sortDir(CASOS_ACTIVOS_EXPR);
        case "activo":
          return sortDir(clientes.activo);
        case "tipo":
          return sortDir(clientes.tipoPersonaId);
        case "nombre":
        default:
          return sortDir(sql`COALESCE(${clientes.razonSocial}, CONCAT_WS(' ', ${clientes.nombre}, ${clientes.apellido}), '')`);
      }
    })();

    const data = await db
      .select({
        ...getTableColumns(clientes),
        casosActivos: CASOS_ACTIVOS_EXPR.mapWith(Number),
      })
      .from(clientes)
      .where(whereCondition)
      .limit(limit)
      .offset(offset)
      .orderBy(orderExpr, asc(clientes.id));

    const [{ count }] = await db
      .select({ count: sql`count(*)`.mapWith(Number) })
      .from(clientes)
      .where(whereCondition);

    return { data, count };
  }

  static async findById(id: number, estudioId: number) {
    const [cliente] = await db
      .select()
      .from(clientes)
      .where(and(eq(clientes.id, id), eq(clientes.estudioId, estudioId), isNull(clientes.deletedAt)))
      .limit(1);

    return cliente ?? null;
  }

  static async findDuplicateByDniOrCuit(estudioId: number, dni?: string | null, cuit?: string | null) {
    const duplicateConditions = [
      dni ? eq(clientes.dni, dni) : undefined,
      cuit ? eq(clientes.cuit, cuit) : undefined,
    ].filter(Boolean);

    if (duplicateConditions.length === 0) return null;

    const [cliente] = await db
      .select()
      .from(clientes)
      .where(
        and(
          eq(clientes.estudioId, estudioId),
          isNull(clientes.deletedAt),
          or(...duplicateConditions)
        )
      )
      .limit(1);

    return cliente ?? null;
  }

  static async insert(values: NewCliente) {
    const [row] = await db.insert(clientes).values(values).returning();
    return row;
  }

  static async update(id: number, estudioId: number, values: Partial<NewCliente>) {
    const [row] = await db
      .update(clientes)
      .set(values)
      .where(and(eq(clientes.id, id), eq(clientes.estudioId, estudioId)))
      .returning();
    return row;
  }

  static async softDelete(id: number, estudioId: number, userId: number) {
    const [row] = await db
      .update(clientes)
      .set({ deletedAt: new Date(), deletedBy: userId, activo: false })
      .where(and(eq(clientes.id, id), eq(clientes.estudioId, estudioId)))
      .returning();
    return row;
  }

  static async findContactos(clienteId: number, estudioId: number) {
    return await db
      .select({
        id: contactosClientes.id,
        clienteId: contactosClientes.clienteId,
        nombre: contactosClientes.nombre,
        rol: contactosClientes.rol,
        email: contactosClientes.email,
        telefono: contactosClientes.telefono,
        observaciones: contactosClientes.observaciones,
        activo: contactosClientes.activo,
        createdAt: contactosClientes.createdAt,
        createdBy: contactosClientes.createdBy,
        updatedAt: contactosClientes.updatedAt,
        updatedBy: contactosClientes.updatedBy,
        deletedAt: contactosClientes.deletedAt,
        deletedBy: contactosClientes.deletedBy,
      })
      .from(contactosClientes)
      .innerJoin(clientes, eq(contactosClientes.clienteId, clientes.id))
      .where(
        and(
          eq(contactosClientes.clienteId, clienteId),
          eq(clientes.estudioId, estudioId),
          isNull(clientes.deletedAt),
          isNull(contactosClientes.deletedAt)
        )
      )
      .orderBy(desc(contactosClientes.createdAt), desc(contactosClientes.id));
  }

  static async insertContacto(clienteId: number, estudioId: number, values: Omit<NewContactoCliente, "clienteId">) {
    const [row] = await db
      .insert(contactosClientes)
      .values({ ...values, clienteId })
      .returning();

    return row;
  }

  static async updateContacto(contactoId: number, clienteId: number, estudioId: number, values: Partial<NewContactoCliente>) {
    const [row] = await db
      .update(contactosClientes)
      .set(values)
      .where(
        and(
          eq(contactosClientes.id, contactoId),
          eq(contactosClientes.clienteId, clienteId),
          isNull(contactosClientes.deletedAt),
          sql`exists (
            select 1 from ${clientes}
            where ${clientes.id} = ${contactosClientes.clienteId}
              and ${clientes.estudioId} = ${estudioId}
              and ${clientes.deletedAt} is null
          )`
        )
      )
      .returning();

    return row ?? null;
  }

  static async deleteContacto(contactoId: number, clienteId: number, estudioId: number, userId: number) {
    const [row] = await db
      .update(contactosClientes)
      .set({ deletedAt: new Date(), deletedBy: userId, activo: false })
      .where(
        and(
          eq(contactosClientes.id, contactoId),
          eq(contactosClientes.clienteId, clienteId),
          isNull(contactosClientes.deletedAt),
          sql`exists (
            select 1 from ${clientes}
            where ${clientes.id} = ${contactosClientes.clienteId}
              and ${clientes.estudioId} = ${estudioId}
              and ${clientes.deletedAt} is null
          )`
        )
      )
      .returning();

    return row ?? null;
  }

  static async findCasosByCliente(clienteId: number, estudioId: number) {
    return await db
      .select()
      .from(casos)
      .where(and(eq(casos.clienteId, clienteId), eq(casos.estudioId, estudioId), isNull(casos.deletedAt)))
      .orderBy(desc(casos.createdAt), desc(casos.id));
  }

  static async findTareasByCliente(clienteId: number, estudioId: number) {
    return await db
      .select()
      .from(tareas)
      .where(and(eq(tareas.clienteId, clienteId), eq(tareas.estudioId, estudioId), isNull(tareas.deletedAt)))
      .orderBy(sql`${tareas.completada} ASC, ${tareas.fechaLimite} ASC NULLS LAST`);
  }

  static async findEventosByCliente(clienteId: number, estudioId: number) {
    return await db
      .select()
      .from(eventos)
      .where(and(eq(eventos.clienteId, clienteId), eq(eventos.estudioId, estudioId), isNull(eventos.deletedAt)))
      .orderBy(desc(eventos.fechaInicio), desc(eventos.id));
  }

  static async findHonorariosByCliente(clienteId: number, estudioId: number) {
    const concepto = alias(parametros, "cliente_honorario_concepto");
    const estado = alias(parametros, "cliente_honorario_estado");

    return await db
      .select({
        id: honorarios.id,
        estudioId: honorarios.estudioId,
        clienteId: honorarios.clienteId,
        casoId: honorarios.casoId,
        conceptoId: honorarios.conceptoId,
        parteId: honorarios.parteId,
        jus: honorarios.jus,
        montoPesos: honorarios.montoPesos,
        monedaId: honorarios.monedaId,
        valorJusRef: honorarios.valorJusRef,
        politicaJusId: honorarios.politicaJusId,
        fechaRegulacion: honorarios.fechaRegulacion,
        fechaVencimiento: honorarios.fechaVencimiento,
        tasaInteresMensual: honorarios.tasaInteresMensual,
        estadoId: honorarios.estadoId,
        // Capital cobrado por cobro directo (aplicaciones activas con honorario_id) y si tiene
        // plan activo. Necesarios para que el detalle del cliente calcule el saldo real del
        // honorario (bruto - cobrado), igual que la grilla principal de honorarios.
        montoCobrado: sql<string>`coalesce((
          select sum(${ingresoAplicaciones.montoCapital})
          from ${ingresoAplicaciones}
          inner join ${ingresos} on ${ingresos.id} = ${ingresoAplicaciones.ingresoId}
          where ${ingresoAplicaciones.honorarioId} = ${honorarios.id}
            and ${ingresoAplicaciones.activo} = true
            and ${ingresoAplicaciones.deletedAt} is null
            and ${ingresos.deletedAt} is null
        ), 0)`,
        tienePlan: sql<boolean>`exists (
          select 1 from ${planesPago}
          where ${planesPago.honorarioId} = ${honorarios.id}
            and ${planesPago.activo} = true
            and ${planesPago.deletedAt} is null
        )`,
        activo: honorarios.activo,
        createdAt: honorarios.createdAt,
        createdBy: honorarios.createdBy,
        updatedAt: honorarios.updatedAt,
        updatedBy: honorarios.updatedBy,
        deletedAt: honorarios.deletedAt,
        deletedBy: honorarios.deletedBy,
        concepto: {
          id: concepto.id,
          codigo: concepto.codigo,
          nombre: concepto.nombre,
        },
        estado: {
          id: estado.id,
          codigo: estado.codigo,
          nombre: estado.nombre,
        },
      })
      .from(honorarios)
      .leftJoin(concepto, eq(honorarios.conceptoId, concepto.id))
      .leftJoin(estado, eq(honorarios.estadoId, estado.id))
      .where(and(eq(honorarios.clienteId, clienteId), eq(honorarios.estudioId, estudioId), isNull(honorarios.deletedAt)))
      .orderBy(desc(honorarios.fechaRegulacion), desc(honorarios.id));
  }

  static async findGastosByCliente(clienteId: number, estudioId: number) {
    return await db
      .select()
      .from(gastos)
      .where(and(eq(gastos.clienteId, clienteId), eq(gastos.estudioId, estudioId), eq(gastos.activo, true)))
      .orderBy(desc(gastos.fechaGasto), desc(gastos.id));
  }

  static async findIngresosByCliente(clienteId: number, estudioId: number) {
    return await db
      .select({
        id: ingresos.id,
        estudioId: ingresos.estudioId,
        clienteId: ingresos.clienteId,
        casoId: ingresos.casoId,
        cuotaId: ingresos.cuotaId,
        descripcion: ingresos.descripcion,
        monto: ingresos.monto,
        monedaId: ingresos.monedaId,
        cotizacionArs: ingresos.cotizacionArs,
        valorJusAlCobro: ingresos.valorJusAlCobro,
        fechaIngreso: ingresos.fechaIngreso,
        tipoId: ingresos.tipoId,
        estadoId: ingresos.estadoId,
        activo: ingresos.activo,
        createdAt: ingresos.createdAt,
        createdBy: ingresos.createdBy,
        updatedAt: ingresos.updatedAt,
        updatedBy: ingresos.updatedBy,
        deletedAt: ingresos.deletedAt,
        deletedBy: ingresos.deletedBy,
        jusAplicados: sql<number>`coalesce(sum(${ingresoAplicaciones.montoCapital} / nullif(${ingresoAplicaciones.valorJusAlCobro}, 0)), 0)`.mapWith(Number),
        montoAplicadoJusPesos: sql<number>`coalesce(sum(case when ${ingresoAplicaciones.valorJusAlCobro} is not null then ${ingresoAplicaciones.montoCapital} else 0 end), 0)`.mapWith(Number),
        montoAplicadoGastoPesos: sql<number>`coalesce(sum(case when ${ingresoAplicaciones.gastoId} is not null then ${ingresoAplicaciones.montoCapital} else 0 end), 0)`.mapWith(Number),
      })
      .from(ingresos)
      .leftJoin(ingresoAplicaciones, and(eq(ingresoAplicaciones.ingresoId, ingresos.id), eq(ingresoAplicaciones.activo, true), isNull(ingresoAplicaciones.deletedAt)))
      .where(and(eq(ingresos.clienteId, clienteId), eq(ingresos.estudioId, estudioId), eq(ingresos.activo, true)))
      .groupBy(ingresos.id)
      .orderBy(desc(ingresos.fechaIngreso), desc(ingresos.id));
  }

  static async findNotasByCliente(clienteId: number, estudioId: number) {
    return await db
      .select()
      .from(notasCliente)
      .where(and(eq(notasCliente.clienteId, clienteId), eq(notasCliente.estudioId, estudioId)))
      .orderBy(desc(notasCliente.createdAt), desc(notasCliente.id));
  }
}
