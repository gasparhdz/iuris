import { describe, expect, it } from "vitest";
import {
  EMAIL_BRAND_COLOR,
  renderRecordatorioCobranza,
  renderRecordatorioEvento,
  renderRecordatorioTarea,
  renderRecuperarPassword,
} from "../services/email.service.js";
import { artLocalToUtc } from "../utils/timezone.js";

describe("email-templates", () => {
  it("usa el azul primario Iuris (sin violeta)", () => {
    expect(EMAIL_BRAND_COLOR).toBe("#1A66C9");
    const rendered = renderRecordatorioTarea({
      id: 1,
      titulo: "Contestar demanda",
      fechaLimite: artLocalToUtc("2026-07-10", "18:00"),
      caso: { caratula: "Albetti c/ Ormaechea", nroExpte: "123/2024" },
    });
    expect(rendered.html).toContain("#1A66C9");
    expect(rendered.html).not.toContain("#6366f1");
    expect(rendered.html).not.toContain("#6366F1");
  });

  it("renderiza tarea con wordmark, deep-link al detalle y multipart texto", () => {
    const rendered = renderRecordatorioTarea({
      id: 99,
      titulo: "Contestar demanda",
      descripcion: "Plazo de traslado",
      fechaLimite: artLocalToUtc("2026-07-10", "18:00"),
      caso: { caratula: "Albetti c/ Ormaechea", nroExpte: "123/2024" },
      subtareas: [{ titulo: "Armar escrito", completada: false }],
    });

    expect(rendered.subject).toContain("Contestar demanda");
    expect(rendered.html).toContain(">Iuris</div>");
    expect(rendered.html).toContain("Ver tarea");
    expect(rendered.html).toContain("/tareas/99");
    expect(rendered.html).toContain("Albetti c/ Ormaechea");
    expect(rendered.html).toContain("123/2024");
    expect(rendered.html).toContain("Si el botón no funciona");
    expect(rendered.html).toContain("Recibís este email porque tenés recordatorios activos en Iuris.");
    expect(rendered.text).toContain("Ver tarea:");
    expect(rendered.text).toContain("/tareas/99");
    expect(rendered.text).toContain("Contestar demanda");
  });

  it("renderiza evento con carátula/nro y deep-link /eventos/{id}", () => {
    const rendered = renderRecordatorioEvento({
      id: 15,
      descripcion: "Audiencia preliminar",
      fechaInicio: artLocalToUtc("2026-07-11", "10:30"),
      caso: { caratula: "Albetti c/ Ormaechea", nroExpte: "123/2024" },
    });

    expect(rendered.html).toContain("/eventos/15");
    expect(rendered.html).toContain("Ver evento");
    expect(rendered.html).toContain("Albetti c/ Ormaechea");
    expect(rendered.html).toContain("Expte. 123/2024");
    expect(rendered.text).toContain("/eventos/15");
  });

  it("renderiza cobranza con CTA a planes y copy de cuotas", () => {
    const rendered = renderRecordatorioCobranza({
      vencidas: [{
        numero: 1,
        vencimiento: artLocalToUtc("2026-07-01", "00:00"),
        clienteNombre: "García, Ana",
        casoCaratula: "García c/ López",
        montoPesos: "5000.00",
        montoJus: null,
        montoAplicado: "0.00",
        valorJusRef: null,
      }],
      porVencer: [],
    });

    expect(rendered.html).toContain("Ver cuotas pendientes");
    expect(rendered.html).toContain("/finanzas?tab=planes");
    expect(rendered.html).toContain("García, Ana");
    expect(rendered.text).toContain("Ver cuotas pendientes:");
  });

  it("renderiza recuperar contraseña con el mismo template base", () => {
    const resetUrl = "http://localhost:5173/reset-password?token=abc&email=a%40b.com";
    const rendered = renderRecuperarPassword({
      nombre: "Gaspar",
      resetUrl,
    });

    expect(rendered.subject).toContain("Recuperar contraseña");
    expect(rendered.html).toContain("#1A66C9");
    expect(rendered.html).toContain("Restablecer contraseña");
    expect(rendered.html).toContain(resetUrl);
    expect(rendered.html).toContain("Si no solicitaste este cambio");
    expect(rendered.text).toContain(resetUrl);
  });
});
