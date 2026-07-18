import { CasosQueries } from "../db/queries/casos.queries.js";
import { ClientesQueries } from "../db/queries/clientes.queries.js";
import { HonorariosQueries } from "../db/queries/honorarios.queries.js";
import { PlanesQueries } from "../db/queries/planes.queries.js";
import { TercerosQueries } from "../db/queries/terceros.queries.js";
import { serializeDates } from "../utils/serialize.js";
import { ValorJusService } from "./valorjus.service.js";
import { PlanesService } from "./planes.service.js";
import { decideDeudorUpdate } from "./honorario-deudor.js";
import {
  calcularSaldosHonorario,
  type CCAplicacion,
  type CCHonorario,
} from "./cuenta-corriente.js";
import type { CreateHonorarioInput, HonorarioQueryInput, UpdateHonorarioInput } from "../schemas/honorarios.schema.js";
import { AuditoriaService, calcDiff } from "./auditoria.service.js";
import { assertMonedaSoportada } from "./moneda.validator.js";
import { fetchAllRows } from "../utils/fetch-all-rows.js";

type HonorarioRow = NonNullable<Awaited<ReturnType<typeof HonorariosQueries.findHonorarioById>>>;

export class HonorariosService {
  static async findAll(estudioId: number, query: HonorarioQueryInput) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;
    const needsSaldoSort = query.orderBy === "saldo" || query.orderBy === "interes";

    const filters = {
      clienteId: query.clienteId,
      casoId: query.casoId,
      estadoId: query.estadoId,
      search: query.search,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      // Saldo/interés se ordenan en memoria con el motor de CC.
      orderBy: needsSaldoSort ? "fecha" as const : query.orderBy,
      order: query.order,
    };

    let data: Awaited<ReturnType<typeof HonorariosQueries.findHonorarios>>["data"];
    let count: number;

    if (needsSaldoSort) {
      data = await fetchAllRows((p) => HonorariosQueries.findHonorarios(estudioId, filters, p));
      count = data.length;
    } else {
      const pageResult = await HonorariosQueries.findHonorarios(estudioId, filters, { limit, offset });
      data = pageResult.data;
      count = pageResult.count;
    }

    let items = await this.enrichHonorarios(estudioId, data);

    if (needsSaldoSort) {
      const dir = query.order === "asc" ? 1 : -1;
      items.sort((a, b) => {
        if (!a || !b) return 0;
        const va = query.orderBy === "interes"
          ? Number(a.calc?.interesDevengadoPesos ?? 0)
          : Number(a.calc?.saldoPesos ?? 0);
        const vb = query.orderBy === "interes"
          ? Number(b.calc?.interesDevengadoPesos ?? 0)
          : Number(b.calc?.saldoPesos ?? 0);
        if (va !== vb) return (va - vb) * dir;
        return Number(a.id) - Number(b.id);
      });
      items = items.slice(offset, offset + limit);
    }

    return {
      data: {
        items,
        meta: { total: count, page, limit },
      },
    };
  }

  static async findById(id: number, estudioId: number) {
    const honorario = await HonorariosQueries.findHonorarioById(id, estudioId);
    if (!honorario) throw new Error("HONORARIO_NOT_FOUND");
    const [enriched] = await this.enrichHonorarios(estudioId, [honorario]);
    return enriched;
  }

  static async create(estudioId: number, userId: number, data: CreateHonorarioInput) {
    await assertMonedaSoportada(data.monedaId);
    const { clienteId, casoId } = await this.resolveClienteCaso(
      estudioId,
      data.clienteId ?? null,
      data.casoId ?? null,
    );
    await this.ensureRelatedEntities(estudioId, clienteId ?? undefined, casoId ?? undefined);
    await this.ensureObligado(
      estudioId,
      casoId,
      clienteId,
      data.obligadoClienteId ?? null,
      data.obligadoTerceroId ?? null,
      true,
    );

    const fechaRegulacion = new Date(data.fechaRegulacion);
    const valorJusRef = await this.resolveValorJusRef(
      estudioId,
      fechaRegulacion,
      data.politicaJusId,
      data.valorJusRef,
      data.jus,
      data.montoPesos,
    );
    this.assertValorJusDisponible(valorJusRef, data.valorJusRef, data.jus);
    const estadoId = data.estadoId ?? await this.getPendingEstadoId();

    const created = await HonorariosQueries.insertHonorario({
      estudioId,
      clienteId,
      casoId,
      conceptoId: data.conceptoId,
      parteId: data.parteId,
      obligadoClienteId: data.obligadoClienteId ?? null,
      obligadoTerceroId: data.obligadoTerceroId ?? null,
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

    const nextCasoId = data.casoId !== undefined ? data.casoId : current.casoId;
    let nextClienteId = data.clienteId !== undefined ? data.clienteId : current.clienteId;
    const nextObligadoClienteId = data.obligadoClienteId !== undefined
      ? data.obligadoClienteId
      : (data.obligadoTerceroId !== undefined ? null : current.obligadoClienteId);
    const nextObligadoTerceroId = data.obligadoTerceroId !== undefined
      ? data.obligadoTerceroId
      : (data.obligadoClienteId !== undefined ? null : current.obligadoTerceroId);

    const deudorFieldsChanging =
      (data.obligadoClienteId !== undefined && data.obligadoClienteId !== current.obligadoClienteId)
      || (data.obligadoTerceroId !== undefined && data.obligadoTerceroId !== current.obligadoTerceroId)
      || (data.clienteId !== undefined && data.clienteId !== current.clienteId)
      || (data.casoId !== undefined && data.casoId !== current.casoId);

    if (deudorFieldsChanging) {
      const hasPagos = await HonorariosQueries.hasPagosImputados(id, estudioId);
      const planActivo = await PlanesQueries.findPlanActivoByHonorarioId(id, estudioId);
      const decision = decideDeudorUpdate({
        fieldsChanging: true,
        hasPagosImputados: hasPagos,
        inPlan: Boolean(planActivo),
        honorariosDelPlan: [{
          clienteId: nextClienteId,
          obligadoClienteId: nextObligadoClienteId,
          obligadoTerceroId: nextObligadoTerceroId,
        }],
      });

      if (decision === "sync_plan" && planActivo) {
        const resolved = await this.resolveClienteCaso(estudioId, nextClienteId, nextCasoId);
        nextClienteId = resolved.clienteId;
        await PlanesQueries.updatePlanPagoByHonorarioId(id, estudioId, {
          clienteId: resolved.clienteId,
          casoId: resolved.casoId,
        });
      }
    }

    let resolvedCasoId = nextCasoId;
    if (data.clienteId !== undefined || data.casoId !== undefined) {
      const resolvedIds = await this.resolveClienteCaso(estudioId, nextClienteId, nextCasoId);
      nextClienteId = resolvedIds.clienteId;
      resolvedCasoId = resolvedIds.casoId;
    }

    await this.ensureRelatedEntities(estudioId, nextClienteId ?? undefined, resolvedCasoId ?? undefined);

    if (data.obligadoClienteId !== undefined || data.obligadoTerceroId !== undefined || data.casoId !== undefined || data.clienteId !== undefined) {
      await this.ensureObligado(
        estudioId,
        resolvedCasoId,
        nextClienteId,
        nextObligadoClienteId,
        nextObligadoTerceroId,
        false,
      );
    }

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

    if (shouldResolveSnapshot || data.valorJusRef !== undefined) {
      this.assertValorJusDisponible(
        resolvedValorJusRef ?? null,
        data.valorJusRef,
        jusForSnapshot,
      );
    }

    const updateData: Parameters<typeof HonorariosQueries.updateHonorario>[2] = {
      updatedAt: new Date(),
      updatedBy: userId,
    };

    if (data.clienteId !== undefined || data.casoId !== undefined) {
      updateData.clienteId = nextClienteId;
      updateData.casoId = resolvedCasoId;
    }
    if (data.conceptoId !== undefined) updateData.conceptoId = data.conceptoId;
    if (data.parteId !== undefined) updateData.parteId = data.parteId;
    if (data.obligadoClienteId !== undefined || data.obligadoTerceroId !== undefined) {
      updateData.obligadoClienteId = nextObligadoClienteId;
      updateData.obligadoTerceroId = nextObligadoTerceroId;
    }
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

    // Con o sin plan: recomputeHonorarioEstado contempla aplicaciones directas y de cuotas.
    await PlanesService.recomputeHonorarioEstado(id, estudioId);
  }

  private static async enrichHonorarios(estudioId: number, rows: HonorarioRow[]) {
    if (rows.length === 0) return [];

    const fechaCorte = new Date();
    const valorJusActual = await ValorJusService.getValorJusSnapshot(fechaCorte, estudioId);
    const planes = await PlanesQueries.findPlanes(estudioId, {});
    const planByHonorario = new Map(planes.map((p) => [p.honorarioId, p]));

    const parametroCache = new Map<number, Awaited<ReturnType<typeof HonorariosQueries.findParametroById>>>();
    const getParametroCodigo = async (id: number | null | undefined): Promise<string | null> => {
      if (!id) return null;
      if (!parametroCache.has(id)) parametroCache.set(id, await HonorariosQueries.findParametroById(id));
      return parametroCache.get(id)?.codigo ?? null;
    };

    return Promise.all(rows.map(async (row) => {
      const tienePagosImputados = await HonorariosQueries.hasPagosImputados(row.id, estudioId);
      const plan = planByHonorario.get(row.id) ?? null;

      let ccPlan: CCHonorario["plan"] = null;
      if (plan) {
        const [cuotas, aplicacionesPlan] = await Promise.all([
          PlanesQueries.findCuotasByPlan(plan.id, estudioId),
          PlanesQueries.findAplicacionesByPlanCuotas(plan.id),
        ]);
        const aplicacionesByCuota = new Map<number, CCAplicacion[]>();
        for (const app of aplicacionesPlan) {
          if (app.cuotaId === null) continue;
          const list = aplicacionesByCuota.get(app.cuotaId) ?? [];
          list.push({
            fecha: app.fechaIngreso,
            montoCapital: app.montoCapital,
            montoInteres: app.montoInteres,
            valorJusAlCobro: app.valorJusAlCobro,
          });
          aplicacionesByCuota.set(app.cuotaId, list);
        }
        ccPlan = {
          tasaInteresMensual: plan.tasaInteresMensual,
          regimenMora: plan.regimenMora,
          politicaCodigo: await getParametroCodigo(plan.politicaJusId),
          valorJusRef: plan.valorJusRef,
          cuotas: cuotas.map((cuota) => ({
            id: cuota.id,
            numero: cuota.numero,
            vencimiento: cuota.vencimiento,
            montoJus: cuota.montoJus,
            montoPesos: cuota.montoPesos,
            valorJusRef: cuota.valorJusRef,
            aplicaciones: aplicacionesByCuota.get(cuota.id) ?? [],
          })),
        };
      }

      const aplicacionesDirectas = ccPlan
        ? []
        : (await PlanesQueries.findAplicacionesByHonorarioActivas(row.id)).map((app) => ({
            fecha: app.fechaIngreso,
            montoCapital: app.montoCapital,
            montoInteres: app.montoInteres,
            valorJusAlCobro: app.valorJusAlCobro,
          }));

      const ccHonorario: CCHonorario = {
        id: row.id,
        descripcion: row.concepto?.nombre ?? "Honorario",
        fechaRegulacion: row.fechaRegulacion,
        fechaVencimiento: row.fechaVencimiento,
        jus: row.jus,
        montoPesos: row.montoPesos,
        valorJusRef: row.valorJusRef,
        politicaCodigo: await getParametroCodigo(row.politicaJusId),
        monedaCodigo: row.moneda?.codigo ?? null,
        tasaInteresMensualPct: row.tasaInteresMensual,
        plan: ccPlan,
        aplicaciones: aplicacionesDirectas,
      };

      const saldos = calcularSaldosHonorario(ccHonorario, valorJusActual ?? 0, fechaCorte);
      return normalizeHonorario(row, { ...saldos, tienePagosImputados });
    }));
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

  /** Rechaza honorarios en JUS sin valor de referencia disponible. */
  private static assertValorJusDisponible(
    resolved: number | null,
    valorJusRefExplicit: number | null | undefined,
    jus: number | null | undefined,
  ) {
    if (!(jus != null && jus > 0)) return;
    if (resolved != null) return;
    if (valorJusRefExplicit != null) return;
    throw new Error("VALOR_JUS_NOT_FOUND");
  }

  /** Si hay casoId, deriva clienteId del caso (o rechaza si difiere). */
  private static async resolveClienteCaso(
    estudioId: number,
    clienteId: number | null,
    casoId: number | null,
  ): Promise<{ clienteId: number | null; casoId: number | null }> {
    if (!casoId) return { clienteId, casoId };
    const caso = await CasosQueries.findById(casoId, estudioId);
    if (!caso) throw new Error("CASO_NOT_FOUND");
    if (clienteId != null && clienteId !== caso.clienteId) {
      throw new Error("CLIENTE_CASO_MISMATCH");
    }
    return { clienteId: caso.clienteId, casoId };
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

  private static async ensureObligado(
    estudioId: number,
    casoId: number | null,
    clienteId: number | null,
    obligadoClienteId: number | null,
    obligadoTerceroId: number | null,
    required: boolean,
  ) {
    if (obligadoClienteId && obligadoTerceroId) throw new Error("OBLIGADO_INVALID");
    if (!obligadoClienteId && !obligadoTerceroId) {
      if (required) throw new Error("OBLIGADO_REQUIRED");
      return;
    }

    if (obligadoClienteId) {
      const cliente = await ClientesQueries.findById(obligadoClienteId, estudioId);
      if (!cliente) throw new Error("OBLIGADO_NOT_FOUND");

      if (casoId) {
        const caso = await CasosQueries.findById(casoId, estudioId);
        if (!caso) throw new Error("CASO_NOT_FOUND");
        if (caso.clienteId !== obligadoClienteId) throw new Error("OBLIGADO_NOT_IN_CASO");
      } else if (clienteId && obligadoClienteId !== clienteId) {
        throw new Error("OBLIGADO_NOT_IN_CASO");
      }
      return;
    }

    if (obligadoTerceroId) {
      const tercero = await TercerosQueries.findById(obligadoTerceroId, estudioId);
      if (!tercero) throw new Error("OBLIGADO_NOT_FOUND");
      if (!casoId) throw new Error("OBLIGADO_REQUIRES_CASO");
      const participantes = await CasosQueries.findParticipantes(casoId, estudioId);
      const match = participantes.find((p) => p.terceroId === obligadoTerceroId);
      if (!match) throw new Error("OBLIGADO_NOT_IN_CASO");
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

function normalizeHonorario(
  honorario: HonorarioRow | null,
  extras?: {
    saldoCapitalPesos?: number;
    interesPesos?: number;
    saldoPesos?: number;
    saldoJus?: number;
    tienePagosImputados?: boolean;
  },
) {
  if (!honorario) return honorario;

  const normalized = {
    ...honorario,
    jus: honorario.jus !== null ? Number(honorario.jus) : null,
    montoCobrado: honorario.montoCobrado !== undefined && honorario.montoCobrado !== null ? Number(honorario.montoCobrado) : 0,
    tienePlan: Boolean(honorario.tienePlan),
    tienePagosImputados: Boolean(extras?.tienePagosImputados),
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

  const baseCalc = HonorariosService.computeMontos({
    jus: normalized.jus,
    montoPesos: normalized.montoPesos,
    valorJusRef: normalized.valorJusRef,
    fechaVencimiento: normalized.fechaVencimiento,
    tasaInteresMensual: normalized.tasaInteresMensual,
    estadoCodigo: normalized.estado?.codigo ?? null,
  });

  return serializeDates({
    ...normalized,
    calc: {
      ...baseCalc,
      saldoCapitalPesos: extras?.saldoCapitalPesos ?? null,
      interesDevengadoPesos: extras?.interesPesos ?? null,
      saldoPesos: extras?.saldoPesos ?? null,
      saldoJus: extras?.saldoJus ?? null,
    },
  });
}
