import { describe, expect, it } from "vitest";
import {
  artLocalToUtc,
  endOfDayArgentina,
  isSameCalendarDayArgentina,
  isVencido,
  parseFechaHoraSisfeArgentina,
  parseFechaSisfeArgentina,
  startOfDayArgentina,
  toArgentinaDateString,
} from "../utils/timezone.js";

describe("timezone Argentina/Cordoba", () => {
  it("evento a las 00:30 ART cae en el día local correcto", () => {
    // 00:30 del 10/07 en Cordoba = 03:30 UTC del mismo día calendario.
    const evento = artLocalToUtc("2026-07-10", "00:30");
    expect(evento.toISOString()).toBe("2026-07-10T03:30:00.000Z");
    expect(toArgentinaDateString(evento)).toBe("2026-07-10");
    expect(isSameCalendarDayArgentina(evento, "2026-07-10")).toBe(true);
    expect(isSameCalendarDayArgentina(evento, "2026-07-09")).toBe(false);
  });

  it("cómputo de vencido en el límite de medianoche ART", () => {
    const medianoche10 = startOfDayArgentina(new Date("2026-07-10T12:00:00.000Z"));
    expect(medianoche10.toISOString()).toBe("2026-07-10T03:00:00.000Z");

    const finDia9 = endOfDayArgentina(new Date("2026-07-09T12:00:00.000Z"));
    expect(isVencido(finDia9, medianoche10)).toBe(true);

    const inicioDia10 = artLocalToUtc("2026-07-10", "00:00");
    expect(isVencido(inicioDia10, medianoche10)).toBe(false);

    const unMsAntes = new Date(medianoche10.getTime() - 1);
    expect(isVencido(unMsAntes, medianoche10)).toBe(true);
  });

  it("recordatorio y fecha límite del mismo día ART respetan orden de instantes", () => {
    const fechaLimite = artLocalToUtc("2026-07-10", "18:00");
    const recordatorio = artLocalToUtc("2026-07-10", "09:00");

    expect(toArgentinaDateString(fechaLimite)).toBe("2026-07-10");
    expect(toArgentinaDateString(recordatorio)).toBe("2026-07-10");
    expect(recordatorio.getTime()).toBeLessThan(fechaLimite.getTime());

    // A las 10:00 ART el recordatorio ya venció; la tarea aún no.
    const ahora = artLocalToUtc("2026-07-10", "10:00");
    expect(isVencido(recordatorio, ahora)).toBe(true);
    expect(isVencido(fechaLimite, ahora)).toBe(false);
  });

  it("parseFechaSisfeArgentina usa Cordoba, no el timezone del proceso", () => {
    const parsed = parseFechaSisfeArgentina("10/07/2026");
    expect(parsed.toISOString()).toBe("2026-07-10T03:00:00.000Z");
  });

  it("parseFechaHoraSisfeArgentina interpreta hora local ART", () => {
    const parsed = parseFechaHoraSisfeArgentina("10/07/2026 00:30");
    expect(parsed?.toISOString()).toBe("2026-07-10T03:30:00.000Z");
  });
});
