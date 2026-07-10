import { beforeEach, describe, expect, it, vi } from "vitest";

const selectLimit = vi.fn();
const softDeleteAdjunto = vi.fn();
const insertAdjunto = vi.fn();
const uploadStream = vi.fn();
const deleteObject = vi.fn();

vi.mock("../db/index.js", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: (..._args: unknown[]) => {
          // Cadena usada tanto por adjuntos (thenable) como por casos (.limit).
          const chain = {
            limit: selectLimit,
            then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
              Promise.resolve([{ id: 99, driveFileId: "old-file" }]).then(resolve, reject),
          };
          return chain;
        },
      }),
    }),
  },
}));

vi.mock("../db/queries/adjuntos.queries.js", () => ({
  AdjuntosQueries: {
    softDeleteAdjunto: (...args: unknown[]) => softDeleteAdjunto(...args),
    insertAdjunto: (...args: unknown[]) => insertAdjunto(...args),
  },
}));

vi.mock("../storage/factory.js", () => ({
  getStorage: () => ({
    uploadStream: (...args: unknown[]) => uploadStream(...args),
    deleteObject: (...args: unknown[]) => deleteObject(...args),
  }),
}));

vi.mock("../services/drive.service.js", () => ({
  DriveService: {
    crearCarpetaCaso: vi.fn(),
  },
}));

vi.mock("../utils/logger.js", () => ({
  logger: { child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) },
}));

vi.mock("../sse/sse.registry.js", () => ({
  emitirAUsuario: vi.fn(),
}));

vi.mock("../env.js", () => ({
  env: { SISFE_SYNC_MODE: "api" },
}));

vi.mock("../services/browser-pool.js", () => ({
  withContext: vi.fn(),
}));

describe("SISFE Drive rechaza → próximo sync reintenta", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectLimit.mockResolvedValue([{ driveFolderId: "folder-1" }]);
  });

  it("subirDocumentoADrive devuelve ok:false si Drive rechaza y no inserta adjunto", async () => {
    uploadStream.mockRejectedValue(new Error("Drive rejected"));

    const { subirDocumentoADrive } = await import("../services/sisfe-sync.service.js");
    const result = await subirDocumentoADrive(1, 10, 5, Buffer.from("%PDF"), "exp.pdf", "application/pdf");

    expect(result).toEqual({ ok: false, reason: "DRIVE_UPLOAD_FAILED" });
    expect(insertAdjunto).not.toHaveBeenCalled();
  });

  it("reemplazarDocumentoADrive no soft-deletea el anterior si la subida falla", async () => {
    uploadStream.mockRejectedValue(new Error("Drive rejected"));

    const { reemplazarDocumentoADrive } = await import("../services/sisfe-sync.service.js");
    const result = await reemplazarDocumentoADrive(
      1,
      10,
      5,
      new Set(["exp.pdf"]),
      Buffer.from("%PDF"),
      "exp.pdf",
      "application/pdf",
    );

    expect(result.ok).toBe(false);
    expect(softDeleteAdjunto).not.toHaveBeenCalled();
    expect(deleteObject).not.toHaveBeenCalled();
  });

  it("sin marca de PDF descargado el próximo sync no omite la descarga", async () => {
    const { debeOmitirDescargaExpediente } = await import("../services/sisfe-scraper.service.js");
    const omitir = debeOmitirDescargaExpediente("10/07/2026 12:00", {
      fechaUltimaActualizacionPrevia: null,
      expedienteDigitalDescargadoPreviamente: false,
    });
    expect(omitir).toBe(false);
  });
});
