import { describe, expect, it } from "vitest";
import { buildCuentaCorriente, type CCGasto, type CCHonorario, type CCIngreso } from "../services/cuenta-corriente.js";
import {
  atribuirMontosPorDeudor,
  filtrarIngresosAtribuidosParaDeudor,
  honorarioDeudorEsCliente,
  honorarioDeudorEsTercero,
  ingresoEsCandidatoParaDeudor,
  resolveHonorarioDeudor,
  type DeudorResuelto,
  type HonorarioDeudorRef,
} from "../services/honorario-deudor.js";

const VJ = "100000.0000";
const FECHA = new Date("2026-06-01T12:00:00.000Z");

type HonMeta = CCHonorario & HonorarioDeudorRef & { id: number };
type IngMeta = CCIngreso & {
  id: number;
  clienteId: number | null;
  obligadoClienteId?: number | null;
  obligadoTerceroId?: number | null;
};
type GastoMeta = CCGasto & { clienteId: number | null };

type AppRow = {
  ingresoId: number;
  honorarioId: number | null;
  cuotaId: number | null;
  gastoId: number | null;
  montoCapital: number;
  montoInteres: number;
  activo: boolean;
  deletedAt: Date | null;
};

function hon(partial: Partial<HonMeta> & Pick<HonMeta, "id" | "clienteId">): HonMeta {
  return {
    descripcion: `Hon ${partial.id}`,
    fechaRegulacion: new Date("2026-01-15T00:00:00.000Z"),
    fechaVencimiento: null,
    jus: "10.0000",
    montoPesos: null,
    valorJusRef: VJ,
    politicaCodigo: "AL_COBRO",
    monedaCodigo: "JUS",
    tasaInteresMensualPct: null,
    plan: null,
    aplicaciones: [],
    obligadoClienteId: null,
    obligadoTerceroId: null,
    ...partial,
  };
}

function ing(partial: Partial<IngMeta> & Pick<IngMeta, "id" | "monto">): IngMeta {
  return {
    descripcion: `Ing ${partial.id}`,
    fecha: new Date("2026-03-01T00:00:00.000Z"),
    clienteId: null,
    obligadoClienteId: null,
    obligadoTerceroId: null,
    ...partial,
  };
}

function gasto(partial: Partial<GastoMeta> & Pick<GastoMeta, "id" | "clienteId" | "monto">): GastoMeta {
  return {
    descripcion: `Gasto ${partial.id}`,
    fecha: new Date("2026-02-01T00:00:00.000Z"),
    monedaCodigo: "ARS",
    cotizacionArs: null,
    ...partial,
  };
}

/** Replica en memoria el post-filtrado + build que hace el servicio por deudor. */
function buildCcParaDeudor(params: {
  deudor: DeudorResuelto;
  honorarios: HonMeta[];
  ingresos: IngMeta[];
  gastos: GastoMeta[];
  apps: AppRow[];
  cuotaToHonorario: Map<number, number>;
  gastoClienteById: Map<number, number>;
  fallbackClienteId: number | null;
}) {
  const { deudor } = params;
  const honorariosFiltrados = params.honorarios.filter((h) =>
    deudor.tipo === "cliente"
      ? honorarioDeudorEsCliente(h, deudor.id)
      : honorarioDeudorEsTercero(h, deudor.id),
  );

  const honorarioById = new Map(params.honorarios.map((h) => [h.id, h]));
  const atribucionesByIngreso = new Map<number, Array<{ deudor: DeudorResuelto; monto: number }>>();

  const appsByIngreso = new Map<number, AppRow[]>();
  for (const app of params.apps) {
    if (!app.activo || app.deletedAt) continue;
    const list = appsByIngreso.get(app.ingresoId) ?? [];
    list.push(app);
    appsByIngreso.set(app.ingresoId, list);
  }

  for (const [ingresoId, ingresoApps] of appsByIngreso) {
    const resolved = ingresoApps.map((app) => {
      let honorarioId = app.honorarioId;
      if (!honorarioId && app.cuotaId != null) {
        honorarioId = params.cuotaToHonorario.get(app.cuotaId) ?? null;
      }
      let d: DeudorResuelto | null = null;
      if (honorarioId != null) {
        const h = honorarioById.get(honorarioId);
        if (h) d = resolveHonorarioDeudor(h);
      } else if (app.gastoId != null) {
        const gastoClienteId = params.gastoClienteById.get(app.gastoId);
        if (gastoClienteId != null) d = { tipo: "cliente", id: gastoClienteId };
      }
      return { deudor: d, montoCapital: app.montoCapital, montoInteres: app.montoInteres };
    });
    const atrib = atribuirMontosPorDeudor(resolved);
    if (atrib.length > 0) atribucionesByIngreso.set(ingresoId, atrib);
  }

  const ingresosFiltrados = filtrarIngresosAtribuidosParaDeudor(
    params.ingresos,
    atribucionesByIngreso,
    deudor,
    params.fallbackClienteId,
  );

  const gastosFiltrados = deudor.tipo === "cliente"
    ? params.gastos.filter((g) => g.clienteId === deudor.id)
    : [];

  return buildCuentaCorriente({
    fechaCorte: FECHA,
    valorJusActual: VJ,
    valoresJus: [{ fecha: new Date("2020-01-01T00:00:00.000Z"), valor: VJ }],
    honorarios: honorariosFiltrados,
    gastos: gastosFiltrados,
    ingresos: ingresosFiltrados,
  });
}

describe("carga acotada de cuenta corriente por deudor", () => {
  // Clientes: 10 (propio), 20 (otro). Tercero: 55.
  const honorarios: HonMeta[] = [
    hon({ id: 1, clienteId: 10, obligadoClienteId: 10, jus: "5.0000", descripcion: "Cliente propio" }),
    hon({
      id: 2,
      clienteId: 10,
      obligadoClienteId: 20,
      jus: "8.0000",
      descripcion: "Obligado otro cliente",
      plan: {
        tasaInteresMensual: null,
        regimenMora: "SIMPLE",
        politicaCodigo: "AL_COBRO",
        valorJusRef: VJ,
        cuotas: [{
          id: 100,
          numero: 1,
          vencimiento: new Date("2026-04-01T00:00:00.000Z"),
          montoJus: "8.0000",
          montoPesos: null,
          valorJusRef: VJ,
          aplicaciones: [{
            fecha: new Date("2026-03-15T00:00:00.000Z"),
            montoCapital: "400000.00",
            montoInteres: "0.00",
            valorJusAlCobro: VJ,
          }],
        }],
      },
    }),
    hon({
      id: 3,
      clienteId: 10,
      obligadoTerceroId: 55,
      jus: "3.0000",
      descripcion: "Obligado tercero",
      aplicaciones: [{
        fecha: new Date("2026-03-20T00:00:00.000Z"),
        montoCapital: "100000.00",
        montoInteres: "0.00",
        valorJusAlCobro: VJ,
      }],
    }),
    hon({
      id: 4,
      clienteId: 10,
      obligadoClienteId: null,
      obligadoTerceroId: null,
      jus: "2.0000",
      descripcion: "Legacy sin obligados",
    }),
    hon({ id: 5, clienteId: 20, obligadoClienteId: 20, jus: "50.0000", descripcion: "Ajeno total" }),
  ];

  const gastos: GastoMeta[] = [
    gasto({ id: 1, clienteId: 10, monto: "15000.00" }),
    gasto({ id: 2, clienteId: 20, monto: "99999.00" }),
  ];

  const ingresos: IngMeta[] = [
    // Aplicado a cuota del honorario 2 (deudor cliente 20)
    ing({ id: 1, monto: "400000.00", clienteId: 10, obligadoClienteId: 20 }),
    // Aplicado directo al honorario 3 (tercero 55)
    ing({ id: 2, monto: "100000.00", clienteId: 10, obligadoTerceroId: 55 }),
    // Obligado propio cliente 10, sin apps
    ing({ id: 3, monto: "25000.00", clienteId: 10, obligadoClienteId: 10 }),
    // Legacy: sin obligados, cliente 10
    ing({ id: 4, monto: "5000.00", clienteId: 10 }),
    // Aplicado a gasto del cliente 10
    ing({ id: 5, monto: "15000.00", clienteId: 20, obligadoClienteId: 20 }),
    // Ruido: solo del cliente 20
    ing({ id: 6, monto: "77777.00", clienteId: 20, obligadoClienteId: 20 }),
    // Sobrante a favor del tercero tras app parcial
    ing({ id: 7, monto: "200000.00", clienteId: 10, obligadoTerceroId: 55 }),
  ];

  const apps: AppRow[] = [
    {
      ingresoId: 1, honorarioId: null, cuotaId: 100, gastoId: null,
      montoCapital: 400000, montoInteres: 0, activo: true, deletedAt: null,
    },
    {
      ingresoId: 2, honorarioId: 3, cuotaId: null, gastoId: null,
      montoCapital: 100000, montoInteres: 0, activo: true, deletedAt: null,
    },
    {
      ingresoId: 5, honorarioId: null, cuotaId: null, gastoId: 1,
      montoCapital: 15000, montoInteres: 0, activo: true, deletedAt: null,
    },
    {
      ingresoId: 7, honorarioId: 3, cuotaId: null, gastoId: null,
      montoCapital: 50000, montoInteres: 0, activo: true, deletedAt: null,
    },
    // App muerta (no debe contar)
    {
      ingresoId: 6, honorarioId: 1, cuotaId: null, gastoId: null,
      montoCapital: 1, montoInteres: 0, activo: false, deletedAt: null,
    },
  ];

  const cuotaToHonorario = new Map([[100, 2]]);
  const gastoClienteById = new Map([[1, 10], [2, 20]]);
  const honorarioById = new Map(honorarios.map((h) => [h.id, h]));
  const candidatoCtx = { apps, honorarioById, cuotaToHonorario, gastoClienteById };

  function cargaAcotada(deudor: DeudorResuelto) {
    const honorariosAcotados = honorarios.filter((h) =>
      deudor.tipo === "cliente"
        ? honorarioDeudorEsCliente(h, deudor.id)
        : honorarioDeudorEsTercero(h, deudor.id),
    );
    const ingresosAcotados = ingresos.filter((i) => ingresoEsCandidatoParaDeudor(i, deudor, candidatoCtx));
    const gastosAcotados = deudor.tipo === "cliente"
      ? gastos.filter((g) => g.clienteId === deudor.id)
      : [];
    return { honorariosAcotados, ingresosAcotados, gastosAcotados };
  }

  it("filtro SQL de honorarios ≡ resolveHonorarioDeudor para cada caso del dataset", () => {
    const casos: Array<{ h: HonMeta; cliente10: boolean; cliente20: boolean; tercero55: boolean }> = [
      { h: honorarios[0], cliente10: true, cliente20: false, tercero55: false },
      { h: honorarios[1], cliente10: false, cliente20: true, tercero55: false },
      { h: honorarios[2], cliente10: false, cliente20: false, tercero55: true },
      { h: honorarios[3], cliente10: true, cliente20: false, tercero55: false },
      { h: honorarios[4], cliente10: false, cliente20: true, tercero55: false },
    ];
    for (const c of casos) {
      expect(honorarioDeudorEsCliente(c.h, 10)).toBe(c.cliente10);
      expect(honorarioDeudorEsCliente(c.h, 20)).toBe(c.cliente20);
      expect(honorarioDeudorEsTercero(c.h, 55)).toBe(c.tercero55);
    }
  });

  it("el filtro candidato de ingresos es un superset de los que atribuyen monto al deudor", () => {
    for (const deudor of [
      { tipo: "cliente" as const, id: 10 },
      { tipo: "cliente" as const, id: 20 },
      { tipo: "tercero" as const, id: 55 },
    ]) {
      const full = buildCcParaDeudor({
        deudor,
        honorarios,
        ingresos,
        gastos,
        apps,
        cuotaToHonorario,
        gastoClienteById,
        fallbackClienteId: deudor.tipo === "cliente" ? deudor.id : null,
      });

      const { ingresosAcotados } = cargaAcotada(deudor);
      const idsCandidatos = new Set(ingresosAcotados.map((i) => i.id));
      for (const fila of full.rows) {
        // Las filas de ingreso del libro deben venir de candidatos SQL.
        if (fila.tipo === "INGRESO") {
          const match = ingresos.find((i) => i.descripcion === fila.descripcion || `Ing ${i.id}` === fila.descripcion);
          if (match) expect(idsCandidatos.has(match.id)).toBe(true);
        }
      }

      // Todo ingreso con monto atribuido > 0 debe ser candidato.
      const atribuidos = filtrarIngresosAtribuidosParaDeudor(
        ingresos,
        (() => {
          const map = new Map<number, Array<{ deudor: DeudorResuelto; monto: number }>>();
          const honorarioMap = new Map(honorarios.map((h) => [h.id, h]));
          const byIng = new Map<number, AppRow[]>();
          for (const app of apps) {
            if (!app.activo || app.deletedAt) continue;
            const list = byIng.get(app.ingresoId) ?? [];
            list.push(app);
            byIng.set(app.ingresoId, list);
          }
          for (const [ingresoId, ingresoApps] of byIng) {
            const resolved = ingresoApps.map((app) => {
              let honorarioId = app.honorarioId;
              if (!honorarioId && app.cuotaId != null) {
                honorarioId = cuotaToHonorario.get(app.cuotaId) ?? null;
              }
              let d: DeudorResuelto | null = null;
              if (honorarioId != null) {
                const h = honorarioMap.get(honorarioId);
                if (h) d = resolveHonorarioDeudor(h);
              } else if (app.gastoId != null) {
                const gc = gastoClienteById.get(app.gastoId);
                if (gc != null) d = { tipo: "cliente", id: gc };
              }
              return { deudor: d, montoCapital: app.montoCapital, montoInteres: app.montoInteres };
            });
            const atrib = atribuirMontosPorDeudor(resolved);
            if (atrib.length > 0) map.set(ingresoId, atrib);
          }
          return map;
        })(),
        deudor,
        deudor.tipo === "cliente" ? deudor.id : null,
      );
      for (const i of atribuidos) {
        expect(idsCandidatos.has(i.id), `ingreso ${i.id} atribuido a ${deudor.tipo}:${deudor.id} debe ser candidato`).toBe(true);
      }
    }
  });

  it("buildCuentaCorriente sobre carga acotada ≡ carga completa filtrada en memoria", () => {
    for (const deudor of [
      { tipo: "cliente" as const, id: 10 },
      { tipo: "cliente" as const, id: 20 },
      { tipo: "tercero" as const, id: 55 },
    ]) {
      const fallback = deudor.tipo === "cliente" ? deudor.id : null;
      const completo = buildCcParaDeudor({
        deudor,
        honorarios,
        ingresos,
        gastos,
        apps,
        cuotaToHonorario,
        gastoClienteById,
        fallbackClienteId: fallback,
      });

      const { honorariosAcotados, ingresosAcotados, gastosAcotados } = cargaAcotada(deudor);
      expect(honorariosAcotados.length).toBeLessThan(honorarios.length);
      expect(ingresosAcotados.length).toBeLessThanOrEqual(ingresos.length);

      const acotado = buildCcParaDeudor({
        deudor,
        honorarios: honorariosAcotados,
        ingresos: ingresosAcotados,
        gastos: gastosAcotados,
        apps,
        cuotaToHonorario,
        gastoClienteById,
        fallbackClienteId: fallback,
      });

      expect(acotado.totales, `totales deudor ${deudor.tipo}:${deudor.id}`).toEqual(completo.totales);
      expect(acotado.rows, `filas deudor ${deudor.tipo}:${deudor.id}`).toEqual(completo.rows);
    }
  });

  it("la carga acotada excluye honorarios/gastos/ingresos ajenos obvios", () => {
    const { honorariosAcotados, ingresosAcotados, gastosAcotados } = cargaAcotada({ tipo: "cliente", id: 10 });
    expect(honorariosAcotados.map((h) => h.id).sort()).toEqual([1, 4]);
    expect(gastosAcotados.map((g) => g.id)).toEqual([1]);
    expect(ingresosAcotados.map((i) => i.id).sort()).toEqual([3, 4, 5]);
    expect(ingresosAcotados.find((i) => i.id === 6)).toBeUndefined();
    expect(honorariosAcotados.find((h) => h.id === 5)).toBeUndefined();
  });
});
