import { CasosQueries } from "../db/queries/casos.queries.js";
import { ClientesQueries } from "../db/queries/clientes.queries.js";
import { GastosQueries } from "../db/queries/gastos.queries.js";
import { PlanesQueries } from "../db/queries/planes.queries.js";
import { CatalogosQueries } from "../db/queries/catalogos.queries.js";
import { serializeDates } from "../utils/serialize.js";
import type { CreateGastoInput, GastoQueryInput, UpdateGastoInput } from "../schemas/gastos.schema.js";
import { AuditoriaService, calcDiff } from "./auditoria.service.js";
import { assertMonedaSoportada } from "./moneda.validator.js";
import { ValorJusService } from "./valorjus.service.js";

/** Campos financieros: no editables si el gasto tiene reintegros aplicados. */
export const GASTO_CAMPOS_FINANCIEROS = [
  "clienteId",
  "casoId",
  "monto",
  "monedaId",
  "cotizacionArs",
  "fechaGasto",
  "estadoId",
] as const;

export function gastoCambioFinanciero(data: UpdateGastoInput): boolean {
  return GASTO_CAMPOS_FINANCIEROS.some((campo) => data[campo] !== undefined);
}

/**
 * Reglas moneda/cotización de gastos:
 * - ARS: no debe llevar cotizacionArs
 * - distinta de ARS: requiere cotizacionArs, salvo JUS con valor resoluble en la fecha
 */
export function assertGastoMonedaCotizacion(input: {
  monedaCodigo: string | null;
  cotizacionArs: number | null | undefined;
  valorJusResoluble: boolean;
}): void {
  const codigo = String(input.monedaCodigo ?? "ARS").toUpperCase();
  const isArs = codigo === "ARS" || codigo === "";
  const tieneCotizacion = input.cotizacionArs !== null && input.cotizacionArs !== undefined;

  if (isArs) {
    if (tieneCotizacion) throw new Error("GASTO_COTIZACION_INVALIDA");
    return;
  }

  if (tieneCotizacion) return;

  if (codigo === "JUS" && input.valorJusResoluble) return;

  throw new Error("GASTO_COTIZACION_REQUERIDA");
}

export class GastosService {
  static async findAll(estudioId: number, query: GastoQueryInput) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const { data, count } = await GastosQueries.findGastos(
      estudioId,
      {
        clienteId: query.clienteId,
        casoId: query.casoId,
        from: query.from ? new Date(query.from) : undefined,
        to: query.to ? new Date(query.to) : undefined,
        search: query.search,
        orderBy: query.orderBy,
        order: query.order,
      },
      { limit, offset }
    );

    return {
      data: {
        items: data.map(normalizeGasto),
        meta: { total: count, page, limit },
      },
    };
  }

  static async create(estudioId: number, userId: number, data: CreateGastoInput) {
    await assertMonedaSoportada(data.monedaId);
    const { clienteId, casoId } = await this.resolveClienteCaso(
      estudioId,
      data.clienteId,
      data.casoId ?? null,
    );
    await this.assertMonedaCotizacion(estudioId, data.monedaId ?? null, data.cotizacionArs, data.fechaGasto);

    const gasto = await GastosQueries.insertGasto({
      estudioId,
      clienteId,
      casoId,
      conceptoId: data.conceptoId ?? null,
      descripcion: data.descripcion ?? null,
      fechaGasto: new Date(data.fechaGasto),
      monto: data.monto.toFixed(2),
      monedaId: data.monedaId ?? null,
      cotizacionArs: data.cotizacionArs !== undefined && data.cotizacionArs !== null ? data.cotizacionArs.toFixed(4) : null,
      estadoId: data.estadoId ?? null,
      createdBy: userId,
    });

    await AuditoriaService.log({
      estudioId,
      usuarioId: userId,
      entidad: "gasto",
      entidadId: gasto.id,
      accion: "CREATE",
      descripcion: "Gasto creado",
    });
    return normalizeGasto(gasto);
  }

  static async update(id: number, estudioId: number, userId: number, data: UpdateGastoInput) {
    const current = await GastosQueries.findGastoById(id, estudioId);
    if (!current) throw new Error("GASTO_NOT_FOUND");

    if (gastoCambioFinanciero(data)) {
      const aplicaciones = await PlanesQueries.findAplicacionesByGastoActivas(id);
      if (aplicaciones.length > 0) throw new Error("GASTO_IMPUTADO_NO_EDITABLE");
    }

    if (data.monedaId !== undefined) await assertMonedaSoportada(data.monedaId);

    const nextClienteId = data.clienteId !== undefined ? data.clienteId : current.clienteId;
    const nextCasoId = data.casoId !== undefined ? data.casoId : current.casoId;
    const resolved = await this.resolveClienteCaso(estudioId, nextClienteId, nextCasoId);

    const nextMonedaId = data.monedaId !== undefined ? data.monedaId : current.monedaId;
    const nextCotizacion = data.cotizacionArs !== undefined
      ? data.cotizacionArs
      : (current.cotizacionArs !== null ? Number(current.cotizacionArs) : null);
    const nextFecha = data.fechaGasto ?? current.fechaGasto.toISOString();
    await this.assertMonedaCotizacion(estudioId, nextMonedaId, nextCotizacion, nextFecha);

    const updateData: Parameters<typeof GastosQueries.updateGasto>[2] = { updatedAt: new Date(), updatedBy: userId };
    if (data.clienteId !== undefined || data.casoId !== undefined) {
      updateData.clienteId = resolved.clienteId;
      updateData.casoId = resolved.casoId;
    }
    if (data.conceptoId !== undefined) updateData.conceptoId = data.conceptoId;
    if (data.descripcion !== undefined) updateData.descripcion = data.descripcion;
    if (data.fechaGasto !== undefined) updateData.fechaGasto = new Date(data.fechaGasto);
    if (data.monto !== undefined) updateData.monto = data.monto.toFixed(2);
    if (data.monedaId !== undefined) updateData.monedaId = data.monedaId;
    if (data.cotizacionArs !== undefined) updateData.cotizacionArs = data.cotizacionArs !== null ? data.cotizacionArs.toFixed(4) : null;
    if (data.estadoId !== undefined) updateData.estadoId = data.estadoId;

    const gasto = await GastosQueries.updateGasto(id, estudioId, updateData);
    if (!gasto) throw new Error("GASTO_NOT_FOUND");
    const diff = calcDiff(normalizeGasto(current) as Record<string, unknown>, normalizeGasto(gasto) as Record<string, unknown>);
    if (diff) {
      await AuditoriaService.log({
        estudioId,
        usuarioId: userId,
        entidad: "gasto",
        entidadId: id,
        accion: "UPDATE",
        descripcion: "Gasto actualizado",
        cambios: diff,
      });
    }
    return normalizeGasto(gasto);
  }

  static async delete(id: number, estudioId: number, userId: number) {
    const current = await GastosQueries.findGastoById(id, estudioId);
    if (!current) throw new Error("GASTO_NOT_FOUND");

    const aplicaciones = await PlanesQueries.findAplicacionesByGastoActivas(id);
    if (aplicaciones.length > 0) throw new Error("GASTO_IMPUTADO_NO_ELIMINABLE");

    const deleted = await GastosQueries.deleteGasto(id, estudioId, userId);
    if (!deleted) throw new Error("GASTO_NOT_FOUND");
    await AuditoriaService.log({
      estudioId,
      usuarioId: userId,
      entidad: "gasto",
      entidadId: id,
      accion: "DELETE",
      descripcion: "Gasto eliminado",
    });
  }

  private static async resolveClienteCaso(
    estudioId: number,
    clienteId: number | null,
    casoId: number | null,
  ): Promise<{ clienteId: number; casoId: number | null }> {
    if (clienteId == null) throw new Error("CLIENTE_NOT_FOUND");

    const cliente = await ClientesQueries.findById(clienteId, estudioId);
    if (!cliente) throw new Error("CLIENTE_NOT_FOUND");

    if (!casoId) return { clienteId, casoId: null };

    const caso = await CasosQueries.findById(casoId, estudioId);
    if (!caso) throw new Error("CASO_NOT_FOUND");
    if (clienteId !== caso.clienteId) throw new Error("CLIENTE_CASO_MISMATCH");
    return { clienteId: caso.clienteId, casoId };
  }

  private static async assertMonedaCotizacion(
    estudioId: number,
    monedaId: number | null,
    cotizacionArs: number | null | undefined,
    fechaGasto: string | Date,
  ) {
    let monedaCodigo: string | null = "ARS";
    if (monedaId != null) {
      const moneda = await CatalogosQueries.findActiveParametroByIdAndCategoria(monedaId, "MONEDA");
      if (!moneda) throw new Error("MONEDA_NO_SOPORTADA");
      monedaCodigo = moneda.codigo;
    }

    let valorJusResoluble = false;
    if (String(monedaCodigo).toUpperCase() === "JUS" && (cotizacionArs === null || cotizacionArs === undefined)) {
      const fecha = typeof fechaGasto === "string" ? new Date(fechaGasto) : fechaGasto;
      const snapshot = await ValorJusService.getValorJusSnapshot(fecha, estudioId);
      valorJusResoluble = snapshot !== null;
    }

    assertGastoMonedaCotizacion({ monedaCodigo, cotizacionArs, valorJusResoluble });
  }
}

export function normalizeGasto<T extends { monto: string; cotizacionArs: string | null }>(gasto: T) {
  return serializeDates({
    ...gasto,
    monto: Number(gasto.monto),
    cotizacionArs: gasto.cotizacionArs !== null ? Number(gasto.cotizacionArs) : null,
  });
}
