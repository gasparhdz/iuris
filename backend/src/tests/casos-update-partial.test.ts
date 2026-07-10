import { describe, expect, it } from "vitest";

/**
 * Regresión: el update de expedientes no debe tocar campos omitidos (undefined).
 * Solo null explícito limpia (p. ej. radicacionId cargado por SISFE).
 */
function buildCasoUpdatePayload(
  data: Record<string, unknown>,
  meta: { updatedAt: Date; updatedBy: number },
) {
  const updateData: Record<string, unknown> = { ...meta };
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      updateData[key] = value;
    }
  }
  return updateData;
}

describe("casos update parcial (radicación)", () => {
  it("no incluye campos undefined — null explícito sí limpia", () => {
    const payload = buildCasoUpdatePayload(
      {
        caratula: "Nueva carátula",
        radicacionId: undefined,
        estadoRadicacionId: null,
      },
      { updatedAt: new Date("2026-01-01T00:00:00Z"), updatedBy: 1 },
    );

    expect(payload).toEqual({
      updatedAt: new Date("2026-01-01T00:00:00Z"),
      updatedBy: 1,
      caratula: "Nueva carátula",
      estadoRadicacionId: null,
    });
    expect("radicacionId" in payload).toBe(false);
  });

  it("editar sin tocar radicación no la modifica (campos omitidos)", () => {
    const payload = buildCasoUpdatePayload(
      { caratula: "Solo carátula" },
      { updatedAt: new Date("2026-01-01T00:00:00Z"), updatedBy: 1 },
    );

    expect(payload.radicacionId).toBeUndefined();
    expect(payload.estadoRadicacionId).toBeUndefined();
    expect(payload.caratula).toBe("Solo carátula");
  });
});
