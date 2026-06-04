export function unwrapPaged(data) {
  const payload = data?.data ?? data;
  const items = payload?.items ?? (Array.isArray(payload) ? payload : []);
  const meta = payload?.meta ?? { total: items.length, page: 1, limit: items.length };
  return { items: Array.isArray(items) ? items : [], meta };
}

export function formatMoneyAr(value) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function formatDateShort(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function clienteLabel(cliente) {
  if (!cliente) return "";
  return (
    cliente.razonSocial
    || [cliente.apellido, cliente.nombre].filter(Boolean).join(", ")
    || cliente.nombre
    || `Cliente #${cliente.id}`
  );
}

export function casoLabel(caso) {
  if (!caso) return "";
  const nro = (caso.nroExpte ?? "").toString().trim();
  const caratula = (caso.caratula ?? "").toString().trim();
  if (nro && caratula) return `${nro} — ${caratula}`;
  return caratula || nro || `Expediente #${caso.id}`;
}

export function conceptoLabel(item, conceptosById) {
  if (item?.concepto?.nombre) return item.concepto.nombre;
  if (item?.descripcion) return item.descripcion;
  const concepto = conceptosById?.get(Number(item?.conceptoId));
  return concepto?.nombre || (item?.conceptoId ? `Concepto #${item.conceptoId}` : "—");
}

export function honorarioMontoBase(item) {
  const calc = item?.calc ?? {};
  return calc.totalConInteres ?? calc.totalPesosRef ?? item?.montoPesos ?? 0;
}

export function honorarioMontoOriginal(item) {
  const calc = item?.calc ?? {};
  return calc.totalPesosRef ?? item?.montoPesos ?? 0;
}

export function isHonorarioPendiente(item) {
  const codigo = (item?.estado?.codigo ?? "").toUpperCase();
  return !codigo || codigo === "PENDIENTE" || codigo === "PARCIAL";
}

export function honorarioEstadoChip(item) {
  const diasMora = Number(item?.calc?.diasMora ?? 0);
  const codigo = (item?.estado?.codigo ?? "").toUpperCase();

  if (diasMora > 0 && isHonorarioPendiente(item)) {
    return { label: "En Mora", color: "error" };
  }
  if (codigo === "COBRADO" || codigo === "PAGADO" || codigo === "CONFIRMADO") {
    return { label: "Cobrado", color: "success" };
  }
  if (codigo === "ANULADO" || codigo === "INCOBRABLE") {
    return { label: item.estado?.nombre || codigo, color: "default" };
  }
  if (!isHonorarioPendiente(item)) {
    return { label: item?.estado?.nombre || "Cobrado", color: "success" };
  }
  return { label: "Pendiente", color: "warning" };
}

export function compareValues(valA, valB) {
  if (valA === valB) return 0;
  if (valA === null || valA === undefined || valA === "") return 1;
  if (valB === null || valB === undefined || valB === "") return -1;
  if (typeof valA === "number" && typeof valB === "number") return valA - valB;
  return String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: "base" });
}

export const denseTableSx = {
  "& td": { py: 0.75, px: 2 },
};

export const ellipsisSx = {
  maxWidth: 220,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  display: "block",
};

export const linkSx = {
  fontWeight: 800,
  textDecoration: "none",
  color: "primary.main",
  "&:hover": { textDecoration: "underline", color: "primary.light" },
};

export function todayInputValue() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function dateInputFromIso(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Convierte YYYY-MM-DD a ISO datetime UTC (inicio del día local). */
export function toIsoDateTimeLocal(dateInput) {
  if (!dateInput) return null;
  const [y, m, d] = String(dateInput).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 12, 0, 0).toISOString();
}

export function findParamByCodigo(list, codigos = []) {
  const wanted = codigos.map((c) => c.toUpperCase());
  return (list ?? []).find((p) => wanted.includes(String(p.codigo ?? "").toUpperCase())) ?? null;
}

export function invalidateFinanzasQueries(queryClient, extra = []) {
  const keys = [
    ["honorarios"],
    ["gastos"],
    ["ingresos"],
    ["liquidacion"],
    ["planes"],
    ["clientes"],
    ["expedientes"],
    ...extra,
  ];
  keys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
  queryClient.invalidateQueries({ predicate: (q) => {
    const k = q.queryKey?.[0];
    return k === "clientes" || k === "expedientes";
  } });
}

export const finanzasDialogPaperSx = {
  borderRadius: "16px",
  border: "1px solid",
  borderColor: "divider",
  backgroundImage: "none",
};

export const TIPOS_MOVIMIENTO = ["honorario", "gasto", "ingreso", "convenio"];

export function normalizeTipoMovimiento(value) {
  const t = String(value ?? "honorario").toLowerCase();
  if (t === "gastos" || t === "gasto") return "gasto";
  if (t === "ingresos" || t === "ingreso") return "ingreso";
  if (t === "convenio" || t === "plan" || t === "planes") return "convenio";
  return "honorario";
}

export function finanzasNuevoUrl(params = {}) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== null && val !== undefined && val !== "") q.set(key, String(val));
  });
  const query = q.toString();
  return `/finanzas/nuevo${query ? `?${query}` : ""}`;
}

export function finanzasEditarUrl(tipo, id) {
  return `/finanzas/editar/${normalizeTipoMovimiento(tipo)}/${id}`;
}

export const ESTADO_HONORARIO_UI = [
  { key: "pendiente", label: "Pendiente", codigos: ["PENDIENTE"] },
  { key: "parcial", label: "Parcial", codigos: ["PARCIAL"] },
  { key: "cobrado", label: "Cobrado", codigos: ["COBRADO", "PAGADO", "PAGADA", "CONFIRMADO"] },
];

export function resolveEstadoHonorarioId(estados, uiKey) {
  const ui = ESTADO_HONORARIO_UI.find((e) => e.key === uiKey);
  if (!ui) return findParamByCodigo(estados, ["PENDIENTE"])?.id ?? null;
  return findParamByCodigo(estados, ui.codigos)?.id ?? findParamByCodigo(estados, ["PENDIENTE"])?.id ?? null;
}

export function estadoUiFromHonorario(item, estados) {
  const codigo = (item?.estado?.codigo ?? "").toUpperCase();
  const match = ESTADO_HONORARIO_UI.find((ui) => ui.codigos.some((c) => c === codigo));
  return match?.key ?? "pendiente";
}

export function getDaysBetween(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0;
  
  // Calculate difference at UTC midnight to avoid DST issues
  const sUtc = Date.UTC(s.getFullYear(), s.getMonth(), s.getDate());
  const eUtc = Date.UTC(e.getFullYear(), e.getMonth(), e.getDate());
  
  const diffTime = eUtc - sUtc;
  if (diffTime <= 0) return 0;
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

export function getItemCurrencyGeneral(item, catalogMonedas) {
  if (item.moneda?.codigo) {
    const c = String(item.moneda.codigo).toUpperCase();
    if (c === "JUS") return "JUS";
    if (c === "USD" || c === "DOLAR" || c === "DÓLAR") return "USD";
    return "ARS";
  }
  if (Number(item.jus) > 0) return "JUS";
  if (catalogMonedas && item.monedaId) {
    const m = catalogMonedas.find((x) => Number(x.id) === Number(item.monedaId));
    if (m) {
      const c = String(m.codigo || "").toUpperCase();
      if (c === "JUS") return "JUS";
      if (c === "USD" || c === "DOLAR" || c === "DÓLAR") return "USD";
    }
  }
  return "ARS";
}

export function formatCurrency(value, currency) {
  const amount = Number(value ?? 0);
  if (currency === "USD") {
    const formatted = new Intl.NumberFormat("es-AR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
    return `USD ${formatted}`;
  }
  return formatMoneyAr(amount);
}

export function cuotaMonto(cuota) {
  return cuota?.montoPesos ?? (cuota?.montoJus && cuota?.valorJusRef ? Number(cuota.montoJus) * Number(cuota.valorJusRef) : null);
}

export function cuotaMontoDisplay(cuota) {
  const estado = String(cuota?.estadoCodigo ?? "").toUpperCase();
  const saldo = Number(cuota?.saldoPesos ?? cuota?.saldo ?? 0);
  const cobrado = Number(cuota?.montoCobrado ?? 0);
  if ((estado === "PAGADA" || saldo <= 0.01) && cobrado > 0) return cobrado;
  return cuotaMonto(cuota);
}

export function planMontoCuota(plan) {
  return plan?.montoCuotaPesos ?? (plan?.montoCuotaJus && plan?.valorJusRef ? Number(plan.montoCuotaJus) * Number(plan.valorJusRef) : null);
}

export function cuotaEstadoChip(cuota) {
  const estado = cuota?.estadoCodigo?.toLowerCase() ?? "";
  if (estado === "pagada") return { label: "Pagada", color: "success" };
  if (estado === "vencida") return { label: "Vencida", color: "error" };
  if (estado === "parcial") return { label: "Parcial", color: "warning" };
  if (estado === "condonada") return { label: "Condonada", color: "default" };
  return { label: "Pendiente", color: "default" };
}

export function cuotaTotalAPagar(cuota) {
  return cuota?.totalAPagarPesos ?? cuota?.saldoPesos ?? null;
}

export function formatJusConPesos(jus, ars) {
  if (jus == null) return formatCurrency(ars);
  const jusStr = `${Number(jus).toFixed(2)} JUS`;
  if (ars == null) return jusStr;
  return `${jusStr} (${formatCurrency(ars)})`;
}

export function movementCurrencyNote(item, currency) {
  const amount = Number(item?.montoPesos ?? item?.monto ?? 0);
  const cotizacion = Number(item?.cotizacionArs ?? 0);
  if (currency === "JUS") {
    const quantity = Number(item?.cantidadOriginal ?? item?.jus ?? (cotizacion > 0 ? amount / cotizacion : item?.monto) ?? 0);
    const formatted = new Intl.NumberFormat("es-AR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(Number.isFinite(quantity) ? quantity : 0);
    return `${formatted} JUS`;
  }
  if (currency === "USD") {
    const value = Number(item?.cantidadOriginal ?? item?.monto ?? item?.montoPesos ?? 0);
    return `USD ${new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`;
  }
  return "";
}

export function movementAmountPesos(item, tipo, valorJusActual = 0, catalogMonedas = []) {
  const currency = item?.monedaOriginal || getItemCurrencyGeneral(item, catalogMonedas);
  if (tipo === "honorario") {
    if (item?.montoPesos != null && !Number(item?.jus)) return Number(item.montoPesos);
    if (currency === "JUS" || Number(item?.jus) > 0) {
      const cotizacion = Number(item?.cotizacionArs ?? item?.valorJusRef ?? valorJusActual);
      return Number(item?.cantidadOriginal ?? item?.jus ?? 0) * cotizacion;
    }
    return Number(item?.montoPesos ?? 0);
  }
  if (tipo === "gasto") {
    if (item?.montoPesos != null) return Number(item.montoPesos);
    if (currency === "JUS") {
      const cotizacion = Number(item?.cotizacionArs ?? valorJusActual);
      return Number(item?.cantidadOriginal ?? item?.monto ?? 0) * cotizacion;
    }
    return Number(item?.monto ?? 0);
  }
  return Number(item?.montoPesos ?? item?.monto ?? 0);
}

export function simulateCuentaCorriente({
  honorarios = [],
  gastos = [],
  ingresos = [],
  valorJusActual = 0,
  valorJusHistorial = [],
  catalogMonedas = [],
  catalogPoliticas = [],
  today = new Date(),
}) {
  const events = [];

  honorarios.forEach((item) => {
    const currency = item.monedaOriginal || getItemCurrencyGeneral(item, catalogMonedas);
    const appliesInterest = !!item.tasaInteresMensual && Number(item.tasaInteresMensual) > 0;
    const interestRate = appliesInterest ? Number(item.tasaInteresMensual) : 0;
    const isJus = currency === "JUS";
    const isUsd = currency === "USD";

    let principal = 0;
    if (isJus) {
      principal = Number(item.cantidadOriginal ?? item.jus ?? 0);
    } else if (isUsd) {
      principal = Number(item.cantidadOriginal ?? item.montoPesos ?? item.monto ?? 0);
    } else {
      principal = Number(item.montoPesos ?? item.monto ?? 0);
    }

    events.push({
      id: `honorario-${item.id}`,
      type: "debe",
      tipoMov: "Honorario",
      date: new Date(item.fecha ?? item.fechaRegulacion),
      currency,
      principal,
      interestRate,
      source: item,
      descripcion: item.descripcion || item.concepto?.nombre || "Honorario",
    });
  });

  gastos.forEach((item) => {
    const currency = item.monedaOriginal || getItemCurrencyGeneral(item, catalogMonedas);
    const isJus = currency === "JUS";
    const isUsd = currency === "USD";

    let principal = 0;
    if (isJus) {
      principal = Number(item.cantidadOriginal ?? item.monto ?? 0);
    } else if (isUsd) {
      principal = Number(item.cantidadOriginal ?? item.monto ?? 0);
    } else {
      principal = Number(item.montoPesos ?? item.monto ?? 0);
    }

    events.push({
      id: `gasto-${item.id}`,
      type: "debe",
      tipoMov: "Gasto",
      date: new Date(item.fecha ?? item.fechaGasto),
      currency,
      principal,
      interestRate: 0,
      source: item,
      descripcion: item.descripcion || "Gasto",
    });
  });

  ingresos.forEach((item) => {
    const jusAplicados = Number(item.jusAplicados ?? 0);
    const montoAplicadoJusPesos = Number(item.montoAplicadoJusPesos ?? 0);
    if (jusAplicados > 0 && montoAplicadoJusPesos > 0) {
      events.push({
        id: `ingreso-${item.id}-jus`,
        type: "haber",
        tipoMov: "Ingreso",
        date: new Date(item.fecha ?? item.fechaIngreso),
        currency: "JUS",
        amount: jusAplicados,
        amountPesos: montoAplicadoJusPesos,
        source: { ...item, cotizacionArs: montoAplicadoJusPesos / jusAplicados },
        descripcion: item.descripcion || "Ingreso",
      });
    }

    const montoTotalPesos = Number(item.montoPesos ?? item.monto ?? 0);
    if (jusAplicados > 0 && montoTotalPesos - montoAplicadoJusPesos <= 0.01) return;

    const residualItem = jusAplicados > 0
      ? { ...item, monto: Math.max(0, montoTotalPesos - montoAplicadoJusPesos), montoPesos: Math.max(0, montoTotalPesos - montoAplicadoJusPesos), cotizacionArs: null }
      : item;
    const cotizacion = Number(item.cotizacionArs || 0);
    const currency = jusAplicados > 0 ? "ARS" : (cotizacion > 0 ? "JUS" : (item.monedaOriginal || getItemCurrencyGeneral(item, catalogMonedas)));
    const isJus = currency === "JUS";
    const isUsd = currency === "USD";

    let amount = 0;
    if (isJus) {
      amount = Number(residualItem.cantidadOriginal ?? (cotizacion > 0 ? Number(residualItem.monto ?? residualItem.montoPesos ?? 0) / cotizacion : 0));
    } else if (isUsd) {
      amount = Number(residualItem.cantidadOriginal ?? residualItem.monto ?? residualItem.montoPesos ?? 0);
    } else {
      amount = Number(residualItem.montoPesos ?? residualItem.monto ?? 0);
    }

    if (amount <= 0.01) return;
    events.push({
      id: `ingreso-${item.id}`,
      type: "haber",
      tipoMov: "Ingreso",
      date: new Date(item.fecha ?? item.fechaIngreso),
      currency,
      amount,
      source: item,
      descripcion: item.descripcion || "Ingreso",
    });
  });

  valorJusHistorial.forEach((item) => {
    const valor = Number(item?.valor ?? 0);
    const date = new Date(item?.fecha);
    if (valor > 0 && !Number.isNaN(date.getTime())) {
      events.push({
        id: `valor-jus-${item.id ?? date.toISOString()}`,
        type: "valorJus",
        tipoMov: "Valor JUS",
        date,
        currency: "JUS",
        valor,
        source: item,
        descripcion: "Actualización JUS",
      });
    }
  });

  // Ordenamos cronológicamente. Si caen el mismo día, van los Debes primero.
  events.sort((a, b) => {
    const tA = a.date.getTime();
    const tB = b.date.getTime();
    if (tA !== tB) return tA - tB;
    const priority = { valorJus: 0, debe: 1, haber: 2 };
    return (priority[a.type] ?? 9) - (priority[b.type] ?? 9);
  });

  const activeDebts = [];
  const rows = [];

  let totalHonorariosPesos = 0;
  let totalGastosPesos = 0;
  let totalIngresosPesos = 0;

  let runningJus = 0;
  let runningSaldo = 0;
  let lastJusRate = 0;

  events.forEach((event) => {
    const eventDate = event.date;

    // 1. Determinar cotización JUS en este evento si es transacción en JUS
    let eventJusRate = 0;
    if (event.type === "valorJus") {
      eventJusRate = Number(event.valor || 0);
    } else if (event.currency === "JUS") {
      if (event.type === "debe") {
        eventJusRate = Number(event.source?.valorJusRef || event.source?.cotizacionArs || valorJusActual);
      } else {
        eventJusRate = Number(event.source?.cotizacionArs || valorJusActual);
      }
    }

    // 2. Si la cotización JUS cambió entre eventos, generar fila de Ajuste
    if (eventJusRate > 0) {
      if (runningJus > 0 && lastJusRate > 0 && eventJusRate !== lastJusRate) {
        const adjustment = runningJus * (eventJusRate - lastJusRate);
        if (Math.abs(adjustment) > 0.01) {
          runningSaldo += adjustment;
          rows.push({
            id: `ajuste-jus-${event.id}`,
            tipo: "Ajuste",
            fecha: event.date,
            descripcion: `Ajuste por Actualización JUS (${new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(runningJus)} JUS adeudados)`,
            debe: adjustment > 0 ? adjustment : 0,
            haber: adjustment < 0 ? -adjustment : 0,
            currency: "ARS",
            saldo: runningSaldo,
            note: "",
          });
        }
      }
      lastJusRate = eventJusRate;
    }

    if (event.type === "valorJus") return;

    // 3. Avanzar tiempo para calcular intereses devengados de las deudas activas
    activeDebts.forEach((debt) => {
      if (debt.principal > 0 && debt.interestRate > 0) {
        const days = getDaysBetween(debt.lastInterestCalcDate, eventDate);
        if (days > 0) {
          const interest = debt.principal * (debt.interestRate / 100) * (days / 30);
          debt.accumulatedInterest += interest;
          debt.lastInterestCalcDate = eventDate;
          
          runningSaldo += interest;
          rows.push({
            id: `interes-evento-${debt.id}-${event.id}`,
            tipo: "Interés",
            fecha: event.date,
            descripcion: `Intereses devengados sobre saldo principal (${debt.tipo})`,
            debe: interest,
            haber: 0,
            currency: debt.currency,
            saldo: runningSaldo,
            note: "",
          });
        }
      } else {
        debt.lastInterestCalcDate = eventDate;
      }
    });

    // 4. Procesar el evento
    if (event.type === "debe") {
      const newDebt = {
        id: event.id,
        tipo: event.tipoMov,
        currency: event.currency,
        principal: event.principal,
        interestRate: event.interestRate,
        lastInterestCalcDate: eventDate,
        fechaRegulacion: eventDate,
        accumulatedInterest: 0,
      };
      activeDebts.push(newDebt);

      let debeValue = 0;
      if (event.currency === "JUS") {
        debeValue = event.principal * eventJusRate;
        runningJus += event.principal;
      } else {
        debeValue = event.principal;
      }

      if (event.tipoMov === "Honorario") {
        totalHonorariosPesos += debeValue;
      } else {
        totalGastosPesos += debeValue;
      }

      runningSaldo += debeValue;

      rows.push({
        id: event.id,
        source: event.source,
        tipo: event.tipoMov,
        fecha: event.date,
        descripcion: event.descripcion,
        debe: debeValue,
        haber: 0,
        currency: event.currency,
        note: movementCurrencyNote(event.source, event.currency),
        saldo: runningSaldo,
      });

    } else if (event.type === "haber") {
      let remainingPayment = event.amount;
      const paymentCurrency = event.currency;
      let paidJusCapital = 0;

      // Primero, pagar intereses acumulados en esa moneda
      for (const debt of activeDebts) {
        if (debt.currency === paymentCurrency && debt.accumulatedInterest > 0) {
          const pay = Math.min(remainingPayment, debt.accumulatedInterest);
          debt.accumulatedInterest -= pay;
          remainingPayment -= pay;
          if (remainingPayment <= 0) break;
        }
      }

      // Luego, pagar capital en esa moneda
      if (remainingPayment > 0) {
        for (const debt of activeDebts) {
          if (debt.currency === paymentCurrency && debt.principal > 0) {
            const pay = Math.min(remainingPayment, debt.principal);
            debt.principal -= pay;
            remainingPayment -= pay;
            if (paymentCurrency === "JUS") paidJusCapital += pay;
            if (remainingPayment <= 0) break;
          }
        }
      }

      let haberValue = 0;
      if (event.currency === "JUS") {
        haberValue = Number(event.amountPesos ?? event.amount * eventJusRate);
        runningJus = Math.max(0, runningJus - paidJusCapital);
      } else {
        haberValue = event.amount;
      }
      totalIngresosPesos += haberValue;

      runningSaldo -= haberValue;

      rows.push({
        id: event.id,
        source: event.source,
        tipo: event.tipoMov,
        fecha: event.date,
        descripcion: event.descripcion,
        debe: 0,
        haber: haberValue,
        currency: event.currency,
        note: movementCurrencyNote(event.source, event.currency),
        saldo: runningSaldo,
      });
    }
  });

  // 5. Generar ajuste JUS final si la cotización JUS de hoy es diferente a lastJusRate
  if (runningJus > 0 && lastJusRate > 0 && valorJusActual > 0 && valorJusActual !== lastJusRate) {
    const adjustment = runningJus * (valorJusActual - lastJusRate);
    if (Math.abs(adjustment) > 0.01) {
      runningSaldo += adjustment;
      rows.push({
        id: `ajuste-jus-final`,
        tipo: "Ajuste",
        fecha: today,
        descripcion: `Ajuste por Actualización JUS (${new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(runningJus)} JUS adeudados)`,
        debe: adjustment > 0 ? adjustment : 0,
        haber: adjustment < 0 ? -adjustment : 0,
        currency: "ARS",
        saldo: runningSaldo,
        note: "",
      });
    }
  }

  // 6. Calcular intereses restantes acumulados hasta hoy
  let finalSaldoPendiente = runningSaldo;
  activeDebts.forEach((debt) => {
    if (debt.principal > 0 && debt.interestRate > 0) {
      const days = getDaysBetween(debt.lastInterestCalcDate, today);
      if (days > 0) {
        const interest = debt.principal * (debt.interestRate / 100) * (days / 30);
        debt.accumulatedInterest += interest;
        debt.lastInterestCalcDate = today;
        
        finalSaldoPendiente += interest;
        rows.push({
          id: `interes-final-${debt.id}`,
          tipo: "Interés",
          fecha: today,
          descripcion: `Intereses devengados sobre capital restante (${debt.tipo === "HONORARIO" || debt.tipo === "Honorario" ? "Honorarios" : "Gastos"})`,
          debe: interest,
          haber: 0,
          currency: debt.currency,
          saldo: finalSaldoPendiente,
          note: "",
        });
      }
    }
  });

  let finalTotalHonorarios = 0;
  let finalTotalGastos = 0;

  rows.forEach((row) => {
    const debeVal = Number(row.debe || 0);
    const haberVal = Number(row.haber || 0);
    const tipo = row.tipo;
    const desc = (row.descripcion || "").toLowerCase();

    if (tipo === "Honorario" || tipo === "Ajuste") {
      finalTotalHonorarios += debeVal - haberVal;
    } else if (tipo === "Gasto") {
      finalTotalGastos += debeVal - haberVal;
    } else if (tipo === "Interés") {
      if (desc.includes("honorario")) {
        finalTotalHonorarios += debeVal - haberVal;
      } else {
        finalTotalGastos += debeVal - haberVal;
      }
    }
  });

  let pendingHonorariosPesos = 0;
  let pendingGastosPesos = 0;

  activeDebts.forEach((debt) => {
    let pendingPesos = 0;
    if (debt.currency === "JUS") {
      pendingPesos = debt.principal * valorJusActual;
    } else {
      pendingPesos = debt.principal;
    }
    
    if (debt.accumulatedInterest > 0) {
      if (debt.currency === "JUS") {
        pendingPesos += debt.accumulatedInterest * valorJusActual;
      } else {
        pendingPesos += debt.accumulatedInterest;
      }
    }

    if (debt.tipo === "Honorario") {
      pendingHonorariosPesos += pendingPesos;
    } else {
      pendingGastosPesos += pendingPesos;
    }
  });

  return {
    rows,
    totalHonorariosPesos: finalTotalHonorarios,
    totalGastosPesos: finalTotalGastos,
    totalIngresosPesos,
    saldoPendientePesos: finalSaldoPendiente,
    pendingHonorariosPesos,
    pendingGastosPesos,
  };
}

export function buildCuentaCorrienteRows({
  honorarios = [],
  gastos = [],
  ingresos = [],
  valorJusActual = 0,
  catalogMonedas = [],
  catalogPoliticas = [],
}) {
  // Detectamos si son elementos precalculados LiquidacionDetalle del backend
  const isBackendLiquidacion = [...honorarios, ...gastos, ...ingresos].some(
    (item) => item && item.tipo !== undefined && item.montoPesos !== undefined
  );

  if (isBackendLiquidacion) {
    const rows = [
      ...honorarios.map((item) => {
        const currency = item.monedaOriginal;
        const isAjuste = item.tipo === "AJUSTE";
        const isInteres = item.tipo === "INTERES";
        let label = "Honorario";
        if (isAjuste) label = "Ajuste";
        if (isInteres) label = "Interés";

        const debe = item.debe !== undefined ? Number(item.debe || 0) : (item.tipo === "INGRESO" ? 0 : Number(item.montoPesos || 0));
        const haber = item.haber !== undefined ? Number(item.haber || 0) : (item.tipo === "INGRESO" ? Number(item.montoPesos || 0) : 0);

        return {
          id: isAjuste ? `ajuste-${item.id}` : isInteres ? `interes-${item.id}` : `honorario-${item.id}`,
          source: item,
          tipo: label,
          fecha: new Date(item.fecha),
          descripcion: item.descripcion,
          debe,
          haber,
          currency,
          note: movementCurrencyNote(item, currency),
        };
      }),
      ...gastos.map((item) => {
        const currency = item.monedaOriginal;
        const debe = item.debe !== undefined ? Number(item.debe || 0) : Number(item.montoPesos || 0);
        const haber = item.haber !== undefined ? Number(item.haber || 0) : 0;
        return {
          id: `gasto-${item.id}`,
          source: item,
          tipo: "Gasto",
          fecha: new Date(item.fecha),
          descripcion: item.descripcion,
          debe,
          haber,
          currency,
          note: movementCurrencyNote(item, currency),
        };
      }),
      ...ingresos.map((item) => {
        const currency = item.monedaOriginal;
        const debe = item.debe !== undefined ? Number(item.debe || 0) : 0;
        const haber = item.haber !== undefined ? Number(item.haber || 0) : Number(item.montoPesos || 0);
        return {
          id: `ingreso-${item.id}`,
          source: item,
          tipo: "Ingreso",
          fecha: new Date(item.fecha),
          descripcion: item.descripcion,
          debe,
          haber,
          currency,
          note: movementCurrencyNote(item, currency),
        };
      }),
    ].sort((a, b) => a.fecha.getTime() - b.fecha.getTime());

    let saldo = 0;
    return rows.map((row) => {
      saldo += row.debe - row.haber;
      return { ...row, saldo };
    });
  }

  const result = simulateCuentaCorriente({
    honorarios,
    gastos,
    ingresos,
    valorJusActual,
    catalogMonedas,
    catalogPoliticas,
  });
  return result.rows;
}



export function computeGastoAmounts(item, catalogMonedas) {
  const currency = getItemCurrencyGeneral(item, catalogMonedas);
  const isJus = currency === "JUS";
  const isUsd = currency === "USD";
  const monto = Number(item.monto || 0);
  const cotizacion = Number(item.cotizacionArs || 0);
  let formattedVal = "";

  if (isJus) {
    const jusStr = new Intl.NumberFormat("es-AR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(monto);
    formattedVal = cotizacion > 0
      ? `${jusStr} JUS (≈ ${formatMoneyAr(monto * cotizacion)})`
      : `${jusStr} JUS`;
  } else if (isUsd) {
    formattedVal = `USD ${new Intl.NumberFormat("es-AR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(monto)}`;
  } else {
    formattedVal = formatMoneyAr(monto);
  }

  return {
    currency,
    monto,
    cotizacion,
    formattedVal,
  };
}

export function computeHonorarioAmounts(item, valorJusActual, catalogMonedas, catalogPoliticas) {
  const currency = getItemCurrencyGeneral(item, catalogMonedas);
  const isJus = currency === "JUS";
  const isUsd = currency === "USD";

  const fechaReg = item.fechaRegulacion;
  const appliesInterest = !!item.tasaInteresMensual && Number(item.tasaInteresMensual) > 0;
  const tasaMensual = Number(item.tasaInteresMensual || 0);

  let originalVal = 0;
  let updatedVal = 0;
  let originalRef = "";
  let updatedRef = "";

  if (isUsd) {
    // USD
    originalVal = Number(item.montoPesos ?? 0);
    let interest = 0;
    if (appliesInterest && fechaReg) {
      const days = getDaysBetween(fechaReg, new Date());
      interest = originalVal * (tasaMensual / 100) * (days / 30);
    }
    updatedVal = originalVal + interest;
  } else if (isJus) {
    // JUS
    const quantityJus = Number(item.jus ?? 0);
    const valorJusRef = Number(item.valorJusRef ?? 0);

    const selectedPolitica = (catalogPoliticas ?? []).find(
      (p) => Number(p.id) === Number(item.politicaJusId)
    );
    const isAlCobro = !selectedPolitica || selectedPolitica.codigo === "AL_COBRO";

    if (isAlCobro) {
      originalVal = quantityJus * valorJusRef;
      updatedVal = quantityJus * valorJusActual;
      originalRef = `(${new Intl.NumberFormat("es-AR", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(quantityJus)} JUS)`;
      updatedRef = `(${new Intl.NumberFormat("es-AR", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(quantityJus)} JUS)`;
    } else {
      originalVal = quantityJus * valorJusRef;
      let interestJus = 0;
      if (appliesInterest && fechaReg) {
        const days = getDaysBetween(fechaReg, new Date());
        interestJus = quantityJus * (tasaMensual / 100) * (days / 30);
      }
      const updatedJus = quantityJus + interestJus;
      updatedVal = updatedJus * valorJusRef;

      originalRef = `(${new Intl.NumberFormat("es-AR", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(quantityJus)} JUS)`;
      updatedRef = `(${new Intl.NumberFormat("es-AR", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(updatedJus)} JUS)`;
    }
  } else {
    // ARS
    originalVal = Number(item.montoPesos ?? 0);
    let interest = 0;
    if (appliesInterest && fechaReg) {
      const days = getDaysBetween(fechaReg, new Date());
      interest = originalVal * (tasaMensual / 100) * (days / 30);
    }
    updatedVal = originalVal + interest;

    if (valorJusActual > 0) {
      const origJus = originalVal / valorJusActual;
      const updJus = updatedVal / valorJusActual;
      originalRef = `(${new Intl.NumberFormat("es-AR", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(origJus)} JUS)`;
      updatedRef = `(${new Intl.NumberFormat("es-AR", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(updJus)} JUS)`;
    } else {
      originalRef = "(0,000 JUS)";
      updatedRef = "(0,000 JUS)";
    }
  }

  return {
    currency,
    originalVal,
    updatedVal,
    originalRef,
    updatedRef,
  };
}
