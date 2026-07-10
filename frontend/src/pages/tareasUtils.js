import { alpha } from "@mui/material/styles";
import {
  APP_TIMEZONE,
  argentinaDateStringOffset,
  sameCalendarDayArgentina,
  toArgentinaDateString,
} from "../utils/timezone";

export const EMPTY_TAREA_FORM = {
  titulo: "",
  descripcion: "",
  fechaLimite: "",
  recordatorio: "",
  prioridadId: "",
  asignadoA: "",
  clienteId: "",
  casoId: "",
  completada: false,
  items: [],
};

export function unwrapItems(data) {
  const raw = Array.isArray(data) ? data : data?.data?.items ?? data?.data ?? [];
  return Array.isArray(raw) ? raw : [];
}

export function unwrapData(data) {
  const raw = data?.data ?? data;
  return Array.isArray(raw) ? raw : [];
}

export function unwrapEntity(data) {
  return data?.data ?? data;
}

export function getApiError(error, fallback) {
  return error?.response?.data?.error?.message ?? error?.response?.data?.message ?? fallback;
}

export function clienteLabel(cliente) {
  if (!cliente) return "";
  return cliente.razonSocial || [cliente.apellido, cliente.nombre].filter(Boolean).join(", ") || cliente.nombre || `Cliente #${cliente.id}`;
}

export function casoLabel(caso) {
  if (!caso) return "";
  return caso.caratula || caso.nroExpte || `Expediente #${caso.id}`;
}

export function nullableNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Convierte valor de datetime-local (hora del navegador) a ISO 8601 UTC para la API. */
export function toIsoOrNull(localValue) {
  if (!localValue) return null;
  const date = new Date(localValue);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

/** ISO 8601 de la API → valor para input datetime-local en hora del navegador. */
export function formatToLocalDatetime(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function sameDay(a, b) {
  return sameCalendarDayArgentina(a, b);
}

/** Vencida si el instante de fechaLimite (ISO UTC de la API) ya pasó. */
export function isOverdue(task) {
  if (task?.completada || !task?.fechaLimite) return false;
  return new Date(task.fechaLimite).getTime() < Date.now();
}

export function isToday(task) {
  if (task?.completada || !task?.fechaLimite) return false;
  return sameCalendarDayArgentina(new Date(task.fechaLimite), new Date());
}

export function formatFriendlyDate(isoString, withTime = true) {
  if (!isoString) return "Sin fecha";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "Fecha inválida";
  const ymd = toArgentinaDateString(date);
  const todayYmd = argentinaDateStringOffset(0);
  const yesterdayYmd = argentinaDateStringOffset(-1);
  const tomorrowYmd = argentinaDateStringOffset(1);
  const time = new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIMEZONE,
  }).format(date);
  if (withTime && ymd === todayYmd) return `Hoy, ${time}`;
  if (ymd === yesterdayYmd) return "Ayer";
  if (ymd === tomorrowYmd) return withTime ? `Mañana, ${time}` : "Mañana";
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: APP_TIMEZONE,
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
}

export function formatDateTime(value) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function normalizeParamCode(param) {
  return String(param?.codigo ?? param?.nombre ?? "SIN_PRIORIDAD")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .toUpperCase();
}

export function priorityStyles(param, theme) {
  const code = normalizeParamCode(param);
  const dark = theme.palette.mode === "dark";
  const map = {
    CRITICA: dark
      ? { bg: "hsl(350, 40%, 12%)", color: "hsl(350, 90%, 65%)", border: "hsl(350, 90%, 65%)" }
      : { bg: "hsl(350, 100%, 96%)", color: "hsl(350, 80%, 45%)", border: "hsl(350, 80%, 45%)" },
    ALTA: dark
      ? { bg: "hsl(24, 40%, 12%)", color: "hsl(24, 90%, 65%)", border: "hsl(24, 90%, 65%)" }
      : { bg: "hsl(24, 100%, 96%)", color: "hsl(24, 85%, 45%)", border: "hsl(24, 85%, 45%)" },
    MEDIA: dark
      ? { bg: "hsl(45, 30%, 12%)", color: "hsl(45, 90%, 60%)", border: "hsl(45, 90%, 60%)" }
      : { bg: "hsl(45, 100%, 95%)", color: "hsl(45, 80%, 40%)", border: "hsl(45, 80%, 40%)" },
    BAJA: dark
      ? { bg: "hsl(150, 30%, 12%)", color: "hsl(150, 85%, 55%)", border: "hsl(150, 85%, 55%)" }
      : { bg: "hsl(150, 100%, 95%)", color: "hsl(150, 80%, 35%)", border: "hsl(150, 80%, 35%)" },
  };
  return map[code] ?? {
    bg: alpha(theme.palette.text.secondary, dark ? 0.12 : 0.08),
    color: theme.palette.text.secondary,
    border: alpha(theme.palette.text.secondary, 0.28),
  };
}

export function checklistStats(task) {
  const items = Array.isArray(task?.items) ? task.items : [];
  const total = items.length;
  const done = items.filter((item) => item.completada).length;
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
}

export function buildTareaPayload(form, { includeItems = false, includeCompleted = false } = {}) {
  const payload = {
    titulo: form.titulo.trim(),
    descripcion: form.descripcion.trim() || null,
    fechaLimite: toIsoOrNull(form.fechaLimite),
    prioridadId: nullableNumber(form.prioridadId),
    asignadoA: nullableNumber(form.asignadoA),
    clienteId: nullableNumber(form.clienteId),
    casoId: nullableNumber(form.casoId),
    recordatorio: toIsoOrNull(form.recordatorio),
  };
  if (includeCompleted) payload.completada = Boolean(form.completada);
  if (includeItems) payload.items = form.items.map((item, index) => ({ titulo: item.titulo, completada: false, orden: index }));
  return payload;
}

export function tareaToForm(task, currentUserId = "") {
  if (!task) return { ...EMPTY_TAREA_FORM, asignadoA: currentUserId || "" };
  return {
    titulo: task.titulo ?? "",
    descripcion: task.descripcion ?? "",
    fechaLimite: formatToLocalDatetime(task.fechaLimite),
    recordatorio: formatToLocalDatetime(task.recordatorio),
    prioridadId: task.prioridadId ?? "",
    asignadoA: task.asignadoA ?? currentUserId ?? "",
    clienteId: task.clienteId ?? "",
    casoId: task.casoId ?? "",
    completada: Boolean(task.completada),
    items: [],
  };
}
