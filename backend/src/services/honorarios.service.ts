import { CasosQueries } from "../db/queries/casos.queries.js";
import { ClientesQueries } from "../db/queries/clientes.queries.js";
import { HonorariosQueries } from "../db/queries/honorarios.queries.js";
import { PlanesQueries } from "../db/queries/planes.queries.js";
import { serializeDates } from "../utils/serialize.js";
import { ValorJusService } from "./valorjus.service.js";
import { PlanesService } from "./planes.service.js";
import type { CreateHonorarioInput, HonorarioQueryInput, UpdateHonorarioInput } from "../schemas/honorarios.schema.js";
import { AuditoriaService, calcDiff } from "./auditoria.service.js";
import { assertMonedaSoportada } from "./moneda.validator.js";

export class HonorariosService {
  static async findAll(estudioId: number, query: HonorarioQueryInput) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const { data, count } = await HonorariosQueries.findHonorarios(
      estudioId,
      {
        clienteId: query.clienteId,
        casoId: query.casoId,
        estadoId: query.estadoId,
        search: query.search,
        from: query.from ? new Date(query.from) : undefined,
        to: query.to ? new Date(query.to) : undefined,
        orderBy: query.orderBy,
        order: query.order,
      },
      { limit, offset }
    );

    return {
      data: {
        items: data.map(normalizeHonorario),
        meta: { total: count, page, limit },
      },
    };
  }

  static async findById(id: number, estudioId: number) {
    const honorario = await HonorariosQueries.findHonorarioById(id, estudioId);
    if (!honorario) throw new Error("HONORARIO_NOT_FOUND");
    return normalizeHonorario(honorario);
  }

  static async create(estudioId: number, userId: number, data: CreateHonorarioInput) {
    await assertMonedaSoportada(data.monedaId);
    await this.ensureRelatedEntities(estudioId, data.clienteId ?? undefined, data.casoId ?? undefined);

    const fechaRegulacion = new Date(data.fechaRegulacion);
    const valorJusRef = await this.resolveValorJusRef(estudioId, fechaRegulacion, data.politicaJusId, data.valorJusRef, data.jus, data.montoPesos);
    const estadoId = data.estadoId ?? await this.getPendingEstadoId();

    const created = await HonorariosQueries.insertHonorario({
      estudioId,
      clienteId: data.clienteId ?? null,
      casoId: data.casoId ?? null,
      conceptoId: data.conceptoId,
      parteId: data.parteId,
      jus: data.jus !== undefined && data.jus !== null ? data.jus.toFixed(4) : null,
      montoPesos: data.montoPesos !== undefined && data.montoPesos !== null ? data.montoPesos.toFixed(2) : null,
      monedaId: data.monedaId ?? null,
      valorJusRef: valorJusRef !== null ? valorJusRef.toFixed(4) : null,
      politicaJusId: data.politicaJusId ?? null,
      fechaRegulacion,
      fechaVencimiento: data.fechaVencimiento ? new Date(data.fechaVencimiento) : null,
      tasaInteresMensual: data.tasaInteresMensual !== undefined && data.tasaInteresMensual !== null ? data.tasaInteresMensual.toFixed(2) : null,
      estadoId,
      createdBy: userId,
    });

    await this.recomputeHonorarioEstadoSaldo(created.id, estudioId);
    const honorario = await this.findById(created.id, estudioId);
    await AuditoriaService.log({
      estudioId,
      usuarioId: userId,
      entidad: "honorario",
      entidadId: created.id,
      accion: "CREATE",
      descripcion: "Honorario creado",
    });
    return honorario;
  }

  static async update(id: number, estudioId: number, userId: number, data: UpdateHonorarioInput) {
    const current = await HonorariosQueries.findHonorarioById(id, estudioId);
    if (!current) throw new Error("HONORARIO_NOT_FOUND");

    if (data.monedaId !== undefined) await assertMonedaSoportada(data.monedaId);
    await this.ensureRelatedEntities(estudioId, data.clienteId ?? undefined, data.casoId ?? undefined);

    const fechaRegulacion = data.fechaRegulacion ? new Date(data.fechaRegulacion) : current.fechaRegulacion;
    const politicaJusId = data.politicaJusId !== undefined ? data.politicaJusId : current.politicaJusId;
    const jusForSnapshot = data.jus ?? (current.jus !== null ? Number(current.jus) : null);
    const pesosForSnapshot = data.montoPesos ?? (current.montoPesos !== null ? Number(current.montoPesos) : null);
    const shouldResolveSnapshot = data.valorJusRef === undefined && (
      data.jus !== undefined ||
      data.montoPesos !== undefined ||
      data.fechaRegulacion !== undefined ||
      data.politicaJusId !== undefined
    );
    const resolvedValorJusRef = shouldResolveSnapshot
      ? await this.resolveValorJusRef(estudioId, fechaRegulacion, politicaJusId, undefined, jusForSnapshot, pesosForSnapshot)
      : data.valorJusRef;

    const updateData: Parameters<typeof HonorariosQueries.updateHonorario>[2] = {
      updatedAt: new Date(),
      updatedBy: userId,
    };

    if (data.clienteId !== undefined) updateData.clienteId = data.clienteId;
    if (data.casoId !== undefined) updateData.casoId = data.casoId;
    if (data.conceptoId !== undefined) updateData.conceptoId = data.conceptoId;
    if (data.parteId !== undefined) updateData.parteId = data.parteId;
    if (data.jus !== undefined) updateData.jus = data.jus !== null ? data.jus.toFixed(4) : null;
    if (data.montoPesos !== undefined) updateData.montoPesos = data.montoPesos !== null ? data.montoPesos.toFixed(2) : null;
    if (data.monedaId !== undefined) updateData.monedaId = data.monedaId;
    if (resolvedValorJusRef !== undefined) updateData.valorJusRef = resolvedValorJusRef !== null ? resolvedValorJusRef.toFixed(4) : null;
    if (data.politicaJusId !== undefined) updateData.politicaJusId = data.politicaJusId;
    if (data.fechaRegulacion !== undefined) updateData.fechaRegulacion = fechaRegulacion;
    if (data.fechaVencimiento !== undefined) updateData.fechaVencimiento = data.fechaVencimiento ? new Date(data.fechaVencimiento) : null;
    if (data.tasaInteresMensual !== undefined) {
      updateData.tasaInteresMensual = data.tasaInteresMensual !== null ? data.tasaInteresMensual.toFixed(2) : null;
    }
    if (data.estadoId !== undefined) updateData.estadoId = data.estadoId;

    const updated = await HonorariosQueries.updateHonorario(id, estudioId, updateData);
    if (!updated) throw new Error("HONORARIO_NOT_FOUND");

    if (data.politicaJusId !== undefined) {
      await PlanesQueries.updatePlanPagoByHonorarioId(id, estudioId, { politicaJusId: data.politicaJusId });
    }

    await this.recomputeHonorarioEstadoSaldo(id, estudioId);
    const honorario = await this.findById(id, estudioId);
    const diff = calcDiff(normalizeHonorario(current) as Record<string, unknown>, honorario as Record<string, unknown>);
    if (diff) {
      await AuditoriaService.log({
        estudioId,
        usuarioId: userId,
        entidad: "honorario",
        entidadId: id,
        accion: "UPDATE",
        descripcion: "Honorario actualizado",
        cambios: diff,
      });
    }
    return honorario;
  }

  static async delete(id: number, estudioId: number, userId: number) {
    const current = await HonorariosQueries.findHonorarioById(id, estudioId);
    if (!current) throw new Error("HONORARIO_NOT_FOUND");

    await PlanesQueries.deletePlanesByHonorarioId(id, estudioId, userId);
    const deleted = await HonorariosQueries.deleteHonorario(id, estudioId, userId);
    if (!deleted) throw new Error("HONORARIO_NOT_FOUND");
    await AuditoriaService.log({
      estudioId,
      usuarioId: userId,
      entidad: "honorario",
      entidadId: id,
      accion: "DELETE",
      descripcion: "Honorario eliminado",
    });
  }

  static computeMontos(input: {
    jus: number | null;
    montoPesos: number | null;
    valorJusRef: number | null;
    fechaVencimiento?: Date | string | null;
    tasaInteresMensual?: number | null;
    estadoCodigo?: string | null;
  }) {
    const { jus, montoPesos, valorJusRef } = input;

    const totalJus = jus && jus > 0
      ? jus
      : montoPesos && montoPesos > 0 && valorJusRef && valorJusRef > 0
        ? montoPesos / valorJusRef
        : null;

    const totalPesosRef = montoPesos && montoPesos > 0
      ? montoPesos
      : jus && jus > 0 && valorJusRef && valorJusRef > 0
        ? jus * valorJusRef
        : null;

    const mora = this.computeInteresesMora({
      montoPesos: totalPesosRef,
      fechaVencimiento: input.fechaVencimiento,
      tasaInteresMensual: input.tasaInteresMensual,
      estadoCodigo: input.estadoCodigo,
    });

    return {
      totalJus,
      totalPesosRef,
      valorJusRef,
      ...mora,
    };
  }

  static async recomputeHonorarioEstadoSaldo(id: number, estudioId: number) {
    const honorario = await HonorariosQueries.findHonorarioById(id, estudioId);
    if (!honorario) return;

    // Si todavia no tiene estado asignado, sembramos PENDIENTE antes de recomputar por saldo.
    if (!honorario.estadoId) {
      const pendienteId = await this.getPendingEstadoId();
      if (pendienteId) await HonorariosQueries.updateHonorario(id, estudioId, { estadoId: pendienteId });
    }

    // Un honorario con plan activo se cobra por sus cuotas; su estado no depende de cobros directos.
    const planActivo = await PlanesQueries.findPlanActivoByHonorarioId(id, estudioId);
    if (planActivo) return;

    await PlanesService.recomputeHonorarioEstado(id, estudioId);
  }

  private static async resolveValorJusRef(
    estudioId: number,
    fechaRegulacion: Date,
    politicaJusId?: number | null,
    valorJusRef?: number | null,
    jus?: number | null,
    montoPesos?: number | null
  ) {
    if (politicaJusId && await this.isPoliticaJusFija(politicaJusId)) {
      return await ValorJusService.getValorJusSnapshot(fechaRegulacion, estudioId);
    }

    if (valorJusRef !== undefined) return valorJusRef;
    if ((jus && jus > 0) || (montoPesos && montoPesos > 0)) {
      return await ValorJusService.getValorJusSnapshot(fechaRegulacion, estudioId);
    }
    return null;
  }

  private static async ensureRelatedEntities(estudioId: number, clienteId?: number, casoId?: number) {
    if (clienteId) {
      const cliente = await ClientesQueries.findById(clienteId, estudioId);
      if (!cliente) throw new Error("CLIENTE_NOT_FOUND");
    }

    if (casoId) {
      const caso = await CasosQueries.findById(casoId, estudioId);
      if (!caso) throw new Error("CASO_NOT_FOUND");
    }
  }

  private static async getPendingEstadoId() {
    const pendiente = await HonorariosQueries.findParametroByCodigo("ESTADO_HONORARIO", "PENDIENTE");
    return pendiente?.id ?? null;
  }

  private static async isPoliticaJusFija(politicaJusId: number) {
    const politica = await HonorariosQueries.findParametroById(politicaJusId);
    if (!politica || politica.categoriaCodigo !== "POLITICA_JUS") return false;

    return politica.codigo === "FECHA_REGULACION" || politica.codigo === "FIJO";
  }

  private static computeInteresesMora(input: {
    montoPesos: number | null;
    fechaVencimiento?: Date | string | null;
    tasaInteresMensual?: number | null;
    estadoCodigo?: string | null;
  }) {
    const empty = {
      diasMora: 0,
      interesAcumulado: null,
      totalConInteres: null,
    };

    if (!input.montoPesos || input.montoPesos <= 0) return empty;
    if (!input.fechaVencimiento) return empty;
    if (!input.tasaInteresMensual || input.tasaInteresMensual <= 0) return empty;
    if (input.estadoCodigo !== "PENDIENTE" && input.estadoCodigo !== "PARCIAL") return empty;

    const vencimiento = input.fechaVencimiento instanceof Date
      ? input.fechaVencimiento
      : new Date(input.fechaVencimiento);

    if (Number.isNaN(vencimiento.getTime())) return empty;

    const msPorDia = 24 * 60 * 60 * 1000;
    const diasMora = Math.max(0, Math.floor((Date.now() - vencimiento.getTime()) / msPorDia));
    if (diasMora <= 0) return { ...empty, interesAcumulado: 0, totalConInteres: input.montoPesos };

    const tasaDiaria = input.tasaInteresMensual / 30 / 100;
    const interesAcumulado = input.montoPesos * tasaDiaria * diasMora;
    const totalConInteres = input.montoPesos + interesAcumulado;

    return {
      diasMora,
      interesAcumulado,
      totalConInteres,
    };
  }
}

function normalizeHonorario(honorario: Awaited<ReturnType<typeof HonorariosQueries.findHonorarioById>>) {
  if (!honorario) return honorario;

  const normalized = {
    ...honorario,
    jus: honorario.jus !== null ? Number(honorario.jus) : null,
    montoCobrado: honorario.montoCobrado !== undefined && honorario.montoCobrado !== null ? Number(honorario.montoCobrado) : 0,
    tienePlan: Boolean(honorario.tienePlan),
    montoPesos: honorario.montoPesos !== null ? Number(honorario.montoPesos) : null,
    valorJusRef: honorario.valorJusRef !== null ? Number(honorario.valorJusRef) : null,
    tasaInteresMensual: honorario.tasaInteresMensual !== null ? Number(honorario.tasaInteresMensual) : null,
    cliente: honorario.cliente?.id ? honorario.cliente : null,
    caso: honorario.caso?.id ? honorario.caso : null,
    concepto: honorario.concepto?.id ? honorario.concepto : null,
    parte: honorario.parte?.id ? honorario.parte : null,
    estado: honorario.estado?.id ? honorario.estado : null,
    moneda: honorario.moneda?.id ? honorario.moneda : null,
  };

  return serializeDates({
    ...normalized,
    calc: HonorariosService.computeMontos({
      jus: normalized.jus,
      montoPesos: normalized.montoPesos,
      valorJusRef: normalized.valorJusRef,
      fechaVencimiento: normalized.fechaVencimiento,
      tasaInteresMensual: normalized.tasaInteresMensual,
      estadoCodigo: normalized.estado?.codigo ?? null,
    }),
  });
}
