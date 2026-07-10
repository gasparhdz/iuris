import { describe, expect, it } from "vitest";
import {
  buildCobranzaPushCopy,
  buildEventoPushCopy,
  buildTareaPushCopy,
  formatExpedienteLabel,
  formatRelativeDayLabelArgentina,
  formatTimeArgentina,
  NOTIFICATION_PATHS,
} from "../services/notification-copy.js";
import type { CuotaRecordatorio } from "../services/cobranza-recordatorio.js";
import { artLocalToUtc } from "../utils/timezone.js";

function cuota(overrides: Partial<CuotaRecordatorio> = {}): CuotaRecordatorio {
  return {
    cuotaId: 1,
    numero: 1,
    vencimiento: new Date("2026-07-01T03:00:00.000Z"),
    montoPesos: "10000.00",
    montoJus: null,
    montoAplicado: "0.00",
    valorJusRef: null,
    clienteNombre: "Cliente Test",
    casoCaratula: "Pérez c/ Gómez",
    createdBy: 10,
    ...overrides,
  };
}

describe("notification-copy", () => {
  const now = artLocalToUtc("2026-07-10", "12:00");

  it("formatea día relativo ART (hoy / mañana / DD/MM)", () => {
    expect(formatRelativeDayLabelArgentina(artLocalToUtc("2026-07-10", "18:00"), now)).toBe("hoy");
    expect(formatRelativeDayLabelArgentina(artLocalToUtc("2026-07-11", "09:00"), now)).toBe("mañana");
    expect(formatRelativeDayLabelArgentina(artLocalToUtc("2026-07-15", "09:00"), now)).toBe("15/07");
    expect(formatRelativeDayLabelArgentina(artLocalToUtc("2026-07-10", "18:00"), now, { capitalize: true })).toBe("Hoy");
  });

  it("arma push de tarea: título adelante, vencimiento + carátula atrás", () => {
    const copy = buildTareaPushCopy({
      titulo: "Contestar demanda",
      fechaLimite: artLocalToUtc("2026-07-10", "23:59"),
      caso: { caratula: "Albetti c/ Ormaechea", nroExpte: "123/2024" },
      now,
    });
    expect(copy).toEqual({
      title: "Contestar demanda",
      body: "Vence hoy — Albetti c/ Ormaechea",
    });
  });

  it("arma push de evento: descripción adelante, día+hora + carátula", () => {
    const fechaInicio = artLocalToUtc("2026-07-11", "10:30");
    const copy = buildEventoPushCopy({
      descripcion: "Audiencia preliminar",
      fechaInicio,
      caso: { caratula: "Albetti c/ Ormaechea" },
      now,
    });
    expect(copy.title).toBe("Audiencia preliminar");
    expect(copy.body).toBe(`Mañana ${formatTimeArgentina(fechaInicio)} — Albetti c/ Ormaechea`);
  });

  it("arma push de cobranza agrupada con monto y deudor si es una sola", () => {
    const multi = buildCobranzaPushCopy({
      vencidas: [
        cuota({ cuotaId: 1, montoPesos: "5000.00", clienteNombre: "A" }),
        cuota({ cuotaId: 2, montoPesos: "3000.00", clienteNombre: "B" }),
      ],
      porVencer: [cuota({ cuotaId: 3, montoPesos: "1000.00" })],
    });
    expect(multi.title).toBe("Cobranzas: 3 cuotas requieren atención");
    expect(multi.body).toMatch(/^2 vencidas \(\$.*\) · 1 por vencer$/);

    const unica = buildCobranzaPushCopy({
      vencidas: [cuota({ clienteNombre: "García, Ana", montoPesos: "2500.00" })],
      porVencer: [],
    });
    expect(unica.title).toBe("Cobranzas: 1 cuota requiere atención");
    expect(unica.body).toContain("1 vencida");
    expect(unica.body).toContain("García, Ana");
  });

  it("etiqueta de expediente combina carátula y nro", () => {
    expect(formatExpedienteLabel({ caratula: "X c/ Y", nroExpte: "10/20" }))
      .toBe("X c/ Y (Expte. 10/20)");
    expect(formatExpedienteLabel({ caratula: null, nroExpte: "10/20" })).toBe("Expte. 10/20");
  });

  it("deep-links apuntan al ítem / tab correcto", () => {
    expect(NOTIFICATION_PATHS.tarea(42)).toBe("/tareas/42");
    expect(NOTIFICATION_PATHS.evento(7)).toBe("/eventos/7");
    expect(NOTIFICATION_PATHS.cobranza()).toBe("/finanzas?tab=planes");
  });
});
