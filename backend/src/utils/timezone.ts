/** Zona horaria de negocio del producto (Argentina continental, sin DST). */
export const APP_TIMEZONE = "America/Argentina/Cordoba";

/**
 * Medianoche ART = 03:00 UTC (offset fijo -03 desde 2009).
 * Usamos este ancla en vez de setHours del servidor.
 */
const ART_OFFSET_ISO = "T03:00:00.000Z";

/** YYYY-MM-DD del calendario en America/Argentina/Cordoba. */
export function toArgentinaDateString(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE }).format(date);
}

/** Inicio del día calendario en Cordoba (00:00 ART). */
export function startOfDayArgentina(date: Date): Date {
  return new Date(`${toArgentinaDateString(date)}${ART_OFFSET_ISO}`);
}

/** Fin del día calendario en Cordoba (23:59:59.999 ART). */
export function endOfDayArgentina(date: Date): Date {
  const start = startOfDayArgentina(date);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
}

/** ¿El instante cae en el día calendario `yyyy-mm-dd` (Cordoba)? */
export function isSameCalendarDayArgentina(date: Date, ymd: string): boolean {
  return toArgentinaDateString(date) === ymd;
}

/** Vencido: la fecha límite ya pasó respecto de `now` (comparación de instantes). */
export function isVencido(fechaLimite: Date, now: Date = new Date()): boolean {
  return fechaLimite.getTime() < now.getTime();
}

/**
 * Construye un instante a partir de fecha+hora locales ART.
 * Ej: artLocalToUtc("2026-07-10", "00:30") → 2026-07-10T03:30:00.000Z
 */
export function artLocalToUtc(ymd: string, hm: string): Date {
  const [h = "0", m = "0", s = "0"] = hm.split(":");
  const hours = Number(h);
  const minutes = Number(m);
  const seconds = Number(s);
  // 00:00 ART = 03:00 UTC → sumar horas locales al ancla de medianoche.
  const start = new Date(`${ymd}${ART_OFFSET_ISO}`);
  return new Date(start.getTime() + ((hours * 60 + minutes) * 60 + seconds) * 1000);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Parsea fecha SISFE `DD/MM/YYYY` como medianoche en America/Argentina/Cordoba.
 * Nunca usa el timezone del proceso Node.
 */
export function parseFechaSisfeArgentina(fechaStr: string): Date {
  const [dia, mes, anio] = fechaStr.trim().split("/");
  const y = Number(anio);
  const m = Number(mes);
  const d = Number(dia);
  if (!y || !m || !d) return new Date();
  const parsed = artLocalToUtc(`${y}-${pad2(m)}-${pad2(d)}`, "00:00");
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * Parsea fecha/hora SISFE `DD/MM/YYYY` o `DD/MM/YYYY HH:mm` en America/Argentina/Cordoba.
 */
export function parseFechaHoraSisfeArgentina(fechaHoraStr: string): Date | null {
  const match = fechaHoraStr.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?$/);
  if (!match) return null;

  const [, dia, mes, anio, hora = "0", minuto = "0"] = match;
  const ymd = `${anio}-${pad2(Number(mes))}-${pad2(Number(dia))}`;
  const hm = `${pad2(Number(hora))}:${pad2(Number(minuto))}`;
  const parsed = artLocalToUtc(ymd, hm);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
