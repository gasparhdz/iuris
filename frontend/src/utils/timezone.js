/** Zona horaria de negocio del producto (Argentina continental, sin DST). */
export const APP_TIMEZONE = "America/Argentina/Cordoba";

/**
 * Medianoche ART = 03:00 UTC (offset fijo -03 desde 2009).
 */
const ART_OFFSET_ISO = "T03:00:00.000Z";

/** YYYY-MM-DD del calendario en America/Argentina/Cordoba. */
export function toArgentinaDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE }).format(date);
}

/** Inicio del día calendario en Cordoba (00:00 ART). */
export function startOfDayArgentina(date = new Date()) {
  return new Date(`${toArgentinaDateString(date)}${ART_OFFSET_ISO}`);
}

/** Fin del día calendario en Cordoba (23:59:59.999 ART). */
export function endOfDayArgentina(date = new Date()) {
  return new Date(startOfDayArgentina(date).getTime() + 24 * 60 * 60 * 1000 - 1);
}

/** Partes de calendario/hora en America/Argentina/Cordoba. */
export function getArgentinaDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    hour: "numeric",
    hour12: false,
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).formatToParts(date);
  const get = (type) => Number(parts.find((p) => p.type === type)?.value ?? NaN);
  let hour = get("hour");
  // Algunos motores reportan 24:00 como hora 24.
  if (hour === 24) hour = 0;
  return {
    hour,
    day: get("day"),
    month: get("month"),
    year: get("year"),
  };
}

/** ¿Dos instantes caen el mismo día calendario en Cordoba? */
export function sameCalendarDayArgentina(a, b) {
  return toArgentinaDateString(a) === toArgentinaDateString(b);
}

/** YYYY-MM-DD en Cordoba desplazado N días desde `date`. */
export function argentinaDateStringOffset(days, date = new Date()) {
  const start = startOfDayArgentina(date);
  return toArgentinaDateString(new Date(start.getTime() + days * 24 * 60 * 60 * 1000));
}
