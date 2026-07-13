export function digitsOnly(value) {
  return String(value ?? "").replace(/\D/g, "");
}

/** DNI: XX.XXX.XXX */
export function formatDni(value) {
  const digits = digitsOnly(value);
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** CUIT: XX-XX.XXX.XXX-X */
export function formatCuit(value) {
  const digits = digitsOnly(value);
  if (digits.length !== 11) {
    const raw = String(value ?? "").trim();
    return raw;
  }
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}.${digits.slice(4, 7)}.${digits.slice(7, 10)}-${digits.slice(10)}`;
}

/**
 * Prefiere CUIT completo; si no, DNI.
 * Ej: "20-12.345.678-9" | "12.345.678"
 */
export function formatPersonaIdentificacion({ cuit, dni } = {}) {
  const cuitDigits = digitsOnly(cuit);
  if (cuitDigits.length === 11) return formatCuit(cuitDigits);
  const dniFormatted = formatDni(dni);
  if (dniFormatted) return dniFormatted;
  if (String(cuit ?? "").trim()) return String(cuit).trim();
  return "";
}
