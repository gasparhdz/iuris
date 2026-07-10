export { unwrapPaged } from "../api/pagination";

/** Zona horaria de negocio (Argentina continental, sin DST). */
export const APP_TIMEZONE = "America/Argentina/Cordoba";
const ART_OFFSET_ISO = "T03:00:00.000Z";

// Evita el "-$0,00": valores que redondean a cero (incluido -0) se normalizan a 0
// para que Intl no les agregue el signo menos.
function normalizeMoney(value) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return 0;
  return Math.abs(amount) < 0.005 ? 0 : amount;
}

export function formatMoneyAr(value) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(normalizeMoney(value));
}

/** YYYY-MM-DD del calendario en America/Argentina/Cordoba. */
export function toArgentinaDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE }).format(date);
}

/** Inicio del día calendario en Cordoba (00:00 ART = 03:00 UTC). */
export function startOfDayArgentina(date = new Date()) {
  return new Date(`${toArgentinaDateString(date)}${ART_OFFSET_ISO}`);
}

/** Fin del día calendario en Cordoba (23:59:59.999 ART). */
export function endOfDayArgentina(date = new Date()) {
  return new Date(startOfDayArgentina(date).getTime() + 24 * 60 * 60 * 1000 - 1);
}

export function formatDateShort(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: APP_TIMEZONE,
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

/** Clave estable del deudor de un honorario o plan (cliente:id | tercero:id). */
export function deudorKeyFromItem(item) {
  if (!item) return null;
  if (item.tipoDeudor === "tercero" || item.obligadoTerceroId != null) {
    const id = item.obligadoTerceroId;
    return id != null ? `tercero:${id}` : null;
  }
  const clienteId = item.obligadoClienteId ?? item.clienteId ?? null;
  return clienteId != null ? `cliente:${clienteId}` : null;
}

export function deudorNombreFromItem(item, fallbackCliente = null) {
  if (!item) return fallbackCliente ? clienteLabel(fallbackCliente) : "—";
  if (item.deudorNombre) return item.deudorNombre;
  if (item.obligadoNombre) return item.obligadoNombre;
  if (item.cliente) return clienteLabel(item.cliente);
  return fallbackCliente ? clienteLabel(fallbackCliente) : "—";
}

export function isDeudorTercero(item) {
  return Boolean(item?.tipoDeudor === "tercero" || item?.obligadoTerceroId != null);
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

export { denseTableSx } from "../theme/tableStyles";

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

// Mapea las filas del endpoint backend /clientes/:id/cuenta-corriente al shape
// que renderiza CuentaCorrienteLedger. El cálculo vive en el backend (Decimal);
// acá no se hace aritmética.
const CC_TIPO_LABEL = {
  HONORARIO: "Honorario",
  GASTO: "Gasto",
  INGRESO: "Ingreso",
  INTERES: "Interés",
  AJUSTE: "Ajuste JUS",
};

export function mapCuentaCorrienteApiRows(rows = []) {
  return rows.map((row, index) => ({
    id: `${row.tipo}-${row.refId ?? "x"}-${index}`,
    fecha: row.fecha,
    tipo: CC_TIPO_LABEL[row.tipo] ?? row.tipo,
    descripcion: row.descripcion,
    moneda: row.moneda ?? "ARS",
    cantidadJus: row.cantidadJus != null ? Number(row.cantidadJus) : null,
    valorJusAplicado: row.valorJusAplicado != null ? Number(row.valorJusAplicado) : null,
    debe: Number(row.debe ?? 0),
    haber: Number(row.haber ?? 0),
    saldo: Number(row.saldo ?? 0),
    note: row.esEstimado ? "Valuado al JUS vigente (estimado)" : undefined,
  }));
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

export function estadoUiFromHonorario(item) {
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
    }).format(normalizeMoney(amount));
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

  // Preferir saldo calculado por el motor de CC del backend (intereses + JUS AL_COBRO).
  const backendSaldo = item?.calc?.saldoPesos;
  const backendInteres = item?.calc?.interesDevengadoPesos;
  const totalPesosRef = item?.calc?.totalPesosRef ?? item?.montoPesos ?? null;

  if (backendSaldo != null && Number.isFinite(Number(backendSaldo))) {
    const originalVal = Number(totalPesosRef ?? 0);
    const interes = Number(backendInteres ?? 0);
    const updatedVal = originalVal + interes;
    let originalRef = "";
    let updatedRef = "";
    if (isJus) {
      const quantityJus = Number(item.jus ?? 0);
      const fmt = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
      originalRef = `(${fmt.format(quantityJus)} JUS)`;
      updatedRef = originalRef;
    } else if (!isUsd && valorJusActual > 0) {
      const fmt = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
      originalRef = `(${fmt.format(originalVal / valorJusActual)} JUS)`;
      updatedRef = `(${fmt.format(updatedVal / valorJusActual)} JUS)`;
    }
    return { currency, originalVal, updatedVal, originalRef, updatedRef, saldoPesos: Number(backendSaldo) };
  }

  const fechaBase = item.fechaVencimiento || item.fechaRegulacion;
  const appliesInterest = !!item.tasaInteresMensual && Number(item.tasaInteresMensual) > 0;
  const tasaMensual = Number(item.tasaInteresMensual || 0);

  let originalVal = 0;
  let updatedVal = 0;
  let originalRef = "";
  let updatedRef = "";

  if (isUsd) {
    originalVal = Number(item.montoPesos ?? 0);
    let interest = 0;
    if (appliesInterest && fechaBase) {
      const days = getDaysBetween(fechaBase, new Date());
      interest = originalVal * (tasaMensual / 100) * (days / 30);
    }
    updatedVal = originalVal + interest;
  } else if (isJus) {
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
      if (appliesInterest && fechaBase) {
        const days = getDaysBetween(fechaBase, new Date());
        interestJus = quantityJus * (tasaMensual / 100) * (days / 30);
      }
      const updatedJus = quantityJus + interestJus;
      updatedVal = updatedJus * valorJusRef;

      originalRef = `(${new Intl.NumberFormat("es-AR", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(quantityJus)} JUS)`;
      updatedRef = `(${new Intl.NumberFormat("es-AR", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(updatedJus)} JUS)`;
    }
  } else {
    originalVal = Number(item.montoPesos ?? 0);
    let interest = 0;
    if (appliesInterest && fechaBase) {
      const days = getDaysBetween(fechaBase, new Date());
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
