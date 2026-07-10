import {
  startOfDayArgentina,
  toArgentinaDateString,
  APP_TIMEZONE,
} from "../utils/timezone.js";
import { formatSaldoCuota, type CuotaRecordatorio } from "./cobranza-recordatorio.js";

/** Paths relativos (el cliente antepone APP_URL / origen). */
export const NOTIFICATION_PATHS = {
  tarea: (id: number) => `/tareas/${id}`,
  evento: (id: number) => `/eventos/${id}`,
  /** Tab de planes/cuotas en Finanzas (no existe `convenios`). */
  cobranza: () => `/finanzas?tab=planes`,
} as const;

export type CasoResumenNotificacion = {
  caratula?: string | null;
  nroExpte?: string | null;
};

/** Etiqueta de día relativo en calendario Argentina: hoy | mañana | DD/MM. */
export function formatRelativeDayLabelArgentina(
  date: Date,
  now: Date = new Date(),
  opts: { capitalize?: boolean } = {},
): string {
  const target = toArgentinaDateString(date);
  const today = toArgentinaDateString(now);
  const tomorrow = toArgentinaDateString(
    new Date(startOfDayArgentina(now).getTime() + 24 * 60 * 60 * 1000),
  );

  let label: string;
  if (target === today) label = "hoy";
  else if (target === tomorrow) label = "mañana";
  else {
    const [, month, day] = target.split("-");
    label = `${day}/${month}`;
  }

  if (opts.capitalize && (label === "hoy" || label === "mañana")) {
    return label === "hoy" ? "Hoy" : "Mañana";
  }
  return label;
}

/** HH:mm en zona Argentina. */
export function formatTimeArgentina(date: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: APP_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatDateTimeMediumArgentina(date?: Date | null): string {
  if (!date) return "Sin fecha";
  return date.toLocaleString("es-AR", {
    timeZone: APP_TIMEZONE,
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function formatExpedienteLabel(caso?: CasoResumenNotificacion | null): string | null {
  if (!caso) return null;
  const caratula = caso.caratula?.trim() || null;
  const nro = caso.nroExpte?.trim() || null;
  if (caratula && nro) return `${caratula} (Expte. ${nro})`;
  if (caratula) return caratula;
  if (nro) return `Expte. ${nro}`;
  return null;
}

export function buildTareaPushCopy(input: {
  titulo: string;
  fechaLimite?: Date | null;
  caso?: CasoResumenNotificacion | null;
  now?: Date;
}): { title: string; body: string } {
  const day = input.fechaLimite
    ? formatRelativeDayLabelArgentina(input.fechaLimite, input.now)
    : null;
  const vencimiento = day ? `Vence ${day}` : "Sin fecha límite";
  const caratula = input.caso?.caratula?.trim();
  const body = caratula ? `${vencimiento} — ${caratula}` : vencimiento;
  return { title: input.titulo, body };
}

export function buildEventoPushCopy(input: {
  descripcion?: string | null;
  fechaInicio: Date;
  caso?: CasoResumenNotificacion | null;
  now?: Date;
}): { title: string; body: string } {
  const day = formatRelativeDayLabelArgentina(input.fechaInicio, input.now, { capitalize: true });
  const time = formatTimeArgentina(input.fechaInicio);
  const when = `${day} ${time}`;
  const caratula = input.caso?.caratula?.trim();
  const body = caratula ? `${when} — ${caratula}` : when;
  return {
    title: input.descripcion?.trim() || "Evento próximo",
    body,
  };
}

function sumSaldoPesos(cuotas: CuotaRecordatorio[]): number | null {
  let total = 0;
  for (const cuota of cuotas) {
    if (cuota.montoJus !== null && Number(cuota.montoJus) > 0) return null;
    total += Math.max(0, Number(cuota.montoPesos ?? 0) - Number(cuota.montoAplicado));
  }
  return total;
}

function formatPesosArs(amount: number): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(amount);
}

/**
 * Push de cobranza agrupada.
 * Título: "Cobranzas: N cuotas requieren atención"
 * Cuerpo: "N vencidas ($X) · N por vencer" (+ deudor si es una sola cuota).
 */
export function buildCobranzaPushCopy(input: {
  vencidas: CuotaRecordatorio[];
  porVencer: CuotaRecordatorio[];
}): { title: string; body: string } {
  const total = input.vencidas.length + input.porVencer.length;
  const title = total === 1
    ? "Cobranzas: 1 cuota requiere atención"
    : `Cobranzas: ${total} cuotas requieren atención`;

  const parts: string[] = [];
  if (input.vencidas.length > 0) {
    const sum = sumSaldoPesos(input.vencidas);
    const monto = sum !== null
      ? formatPesosArs(sum)
      : input.vencidas.length === 1
        ? formatSaldoCuota(input.vencidas[0])
        : null;
    const label = `${input.vencidas.length} vencida${input.vencidas.length === 1 ? "" : "s"}`;
    parts.push(monto ? `${label} (${monto})` : label);
  }
  if (input.porVencer.length > 0) {
    parts.push(`${input.porVencer.length} por vencer`);
  }

  let body = parts.join(" · ") || "Cobranzas pendientes";
  if (total === 1) {
    const unica = input.vencidas[0] ?? input.porVencer[0];
    const deudor = unica?.clienteNombre?.trim();
    if (deudor) body = `${body} — ${deudor}`;
  }

  return { title, body };
}

/** @deprecated Usar buildCobranzaPushCopy. Conservado por compat de tests previos. */
export function buildCobranzaPushBody(vencidasCount: number, porVencerCount: number): string {
  const parts: string[] = [];
  if (vencidasCount > 0) {
    parts.push(`${vencidasCount} cuota${vencidasCount === 1 ? "" : "s"} vencida${vencidasCount === 1 ? "" : "s"}`);
  }
  if (porVencerCount > 0) {
    parts.push(`${porVencerCount} por vencer`);
  }
  if (parts.length === 0) return "Cobranzas pendientes";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} y ${parts[1]}`;
}
