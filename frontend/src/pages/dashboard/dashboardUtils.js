import { Description, Gavel, InsertDriveFile, MarkEmailRead, Shield } from "@mui/icons-material";
import {
  argentinaDateStringOffset,
  getArgentinaDateParts,
  APP_TIMEZONE,
} from "../../utils/timezone";

export const CARD_TONES = {
  blue: "#5B7CFA",
  orange: "#FFA726",
  green: "#2EBD85",
  red: "#EF5350",
  violet: "#8B5CF6",
  cyan: "#29B6F6",
};

export const BANDEJA_TONES = {
  overdue: "#C13A33",
  novedad: "#1A66C9",
  evento: "#7C5CFC",
  tarea: "#D64038",
  success: "#1E9E6A",
};

// Mapeo de tipos de movimiento SISFE (ver sisfe-scraper.service.ts) a ícono/color,
// consistente con getTipoMovimientoColor de ExpedienteDetalle.
const TIPO_MOVIMIENTO_ICONS = [
  { match: /escrito/i, Icon: Description, color: CARD_TONES.blue },
  { match: /resoluci|sentencia/i, Icon: Gavel, color: CARD_TONES.green },
  { match: /notificaci/i, Icon: MarkEmailRead, color: CARD_TONES.red },
  { match: /tr[aá]mite/i, Icon: Shield, color: BANDEJA_TONES.novedad },
];

export function tipoMovimientoInfo(tipo) {
  const found = TIPO_MOVIMIENTO_ICONS.find((t) => t.match.test(tipo || ""));
  return {
    label: tipo || "Movimiento",
    Icon: found?.Icon || InsertDriveFile,
    color: found?.color || BANDEJA_TONES.novedad,
  };
}

export const PRIORITY_TONES = {
  CRITICA: "#EF5350",
  CRITICA_: "#EF5350",
  ALTA: "#FFA726",
  MEDIA: "#29B6F6",
  BAJA: "#66BB6A",
  DEFAULT: "#8EA0B8",
};

export const panelSx = {
  border: "1px solid",
  borderColor: "divider",
  backgroundColor: "background.paper",
  boxShadow: "none",
  borderRadius: "16px",
};

export function normalizeCode(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .toUpperCase();
}

export function readUserName(user) {
  const raw = user?.nombre || user?.name || user?.usuario?.nombre || user?.email || "";
  const clean = String(raw).split("@")[0].trim();
  return clean ? clean.split(/\s+/)[0] : "";
}

/** Franja horaria en America/Argentina/Cordoba para el saludo. */
function greetingSlot() {
  const { hour } = getArgentinaDateParts();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 20) return "afternoon";
  return "evening";
}

/** Índice estable por día calendario en Cordoba — rota el tono sin cambiar en cada render. */
function dailyVariantIndex(count) {
  if (count <= 0) return 0;
  const { day, month } = getArgentinaDateParts();
  return (day + month * 31) % count;
}

const BANDEJA_GREETING_TEXT = {
  morning: [
    (n) => (n ? `¡Buenos días, ${n}!` : "¡Buenos días!"),
    (n) => (n ? `Buenos días, ${n} — ¡muy buen día!` : "Buenos días — ¡muy buen día!"),
    (n) => (n ? `¡Buenos días, ${n}!` : "¡Buenos días!"),
  ],
  afternoon: [
    (n) => (n ? `¡Buenas tardes, ${n}!` : "¡Buenas tardes!"),
    (n) => (n ? `Buenas tardes, ${n} — ¡vamos!` : "Buenas tardes — ¡vamos!"),
    (n) => (n ? `¡Buenas tardes, ${n}!` : "¡Buenas tardes!"),
  ],
  evening: [
    (n) => (n ? `¡Buenas noches, ${n}!` : "¡Buenas noches!"),
    (n) => (n ? `Buenas noches, ${n} — ¡buen descanso!` : "Buenas noches — ¡buen descanso!"),
    (n) => (n ? `¡Buenas noches, ${n}!` : "¡Buenas noches!"),
  ],
};

/** Saludo según hora en America/Argentina/Cordoba. */
export function timeGreeting() {
  const slot = greetingSlot();
  if (slot === "morning") return "Buenos días";
  if (slot === "afternoon") return "Buenas tardes";
  return "Buenas noches";
}

/**
 * Saludo cálido para la vista bandeja.
 * @returns {{ text: string, slot: 'morning' | 'afternoon' | 'evening' }}
 */
export function bandejaGreeting(user) {
  const firstName = readUserName(user);
  const slot = greetingSlot();
  const variants = BANDEJA_GREETING_TEXT[slot];
  const text = variants[dailyVariantIndex(variants.length)](firstName);
  return { text, slot };
}

export function displayDate() {
  const value = new Intl.DateTimeFormat("es-AR", {
    timeZone: APP_TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function eventDate(event) {
  return event?.fechaInicio || event?.fecha || event?.inicio || event?.start;
}

export function priorityColor(priority) {
  const code = normalizeCode(priority?.codigo || priority?.nombre || priority);
  return PRIORITY_TONES[code] || PRIORITY_TONES.DEFAULT;
}

export function priorityLabel(task) {
  return task?.prioridad?.nombre || task?.prioridadNombre || "Sin prioridad";
}

/** Re-export para callers que necesiten offsets de calendario Cordoba. */
export { argentinaDateStringOffset };
