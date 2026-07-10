import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { Readable } from "node:stream";
import { db } from "../db/index.js";
import { casos, movimientosJudiciales, adjuntos, casoTrazabilidad } from "../db/schema.js";
import { withContext } from "./browser-pool.js";
import {
  SisfeError,
  attachDiagnostics,
  buscarExpedientePorCuij,
  conReintentos,
  debeOmitirDescargaExpediente,
  descargarExpedienteDigitalEnDetalle,
  esTargetCerrado,
  fetchDetalleExpediente,
  normalizarCuj,
  parseFechaHoraSISFE,
  parseUbicacionActual,
  type MovimientoSisfe,
  type OpcionesDetalleExpediente,
} from "./sisfe-scraper.service.js";
import {
  deleteSession,
  extractJwtFromSession,
  getSession,
  saveSessionLastSync,
  updateSyncStatus,
  type SisfeSyncStats,
} from "./sisfe-session.service.js";
import { createSisfeApiClient, type SisfeExpedienteDetalle, type SisfeExpedienteListItem, type SisfeNovedadItem } from "./sisfe-api.client.js";
import { mapaTipoMovimiento } from "./sisfe-movimiento.mapper.js";
import { DriveService } from "./drive.service.js";
import { getStorage } from "../storage/factory.js";
import { AdjuntosQueries } from "../db/queries/adjuntos.queries.js";
import { logger } from "../utils/logger.js";
import { emitirAUsuario } from "../sse/sse.registry.js";
import { env } from "../env.js";
import { parseFechaSisfeArgentina } from "../utils/timezone.js";

const log = logger.child({ module: "SISFE-Sync" });

type SesionSync = {
  cookieName: string;
  cookieValue: string;
};

type CasoSyncRow = {
  id: number;
  nroExpte: string | null;
  caratula: string | null;
  sisfeExpteId: string | null;
  sisfeFechaUltimaActualizacion: Date | null;
  sisfeExpedienteDigitalAt: Date | null;
};

export type DriveUploadResult = { ok: true } | { ok: false; reason: string };

// Extrae el CUIJ limpio del campo nroExpte, que puede venir con basura cargada a mano
// (ej: "21-27884151-8 Nro. Expediente", "21-23847992-1(762/2018)"). Sin esto, la búsqueda
// por CUIJ en SISFE no matchea nada.
function extraerCuij(nroExpte: string | null | undefined): string {
  const base = (nroExpte ?? "").split("(")[0] ?? "";
  const match = base.match(/\d{2}-\d{6,10}-\d/);
  return match ? match[0] : base.trim();
}

export async function ejecutarSync(usuarioId: number, estudioId: number, casoId?: number): Promise<void> {
  if (env.SISFE_SYNC_MODE === "api") {
    return ejecutarSyncApi(usuarioId, estudioId, casoId);
  }
  return ejecutarSyncBrowser(usuarioId, estudioId, casoId);
}

async function ejecutarSyncApi(usuarioId: number, estudioId: number, casoId?: number): Promise<void> {
  try {
    await updateSyncStatus(usuarioId, "running", 0, "Iniciando sincronización (API)...");

    const sesion = await getSession(usuarioId, estudioId);
    if (!sesion) {
      await updateSyncStatus(usuarioId, "error", 0, "No hay sesión activa. Conectate al SISFE primero.");
      return;
    }

    const token = extractJwtFromSession(sesion.cookieValue);
    if (!token) {
      await updateSyncStatus(usuarioId, "error", 0, "No se encontró el token JWT en la sesión SISFE. Volvé a conectarte.");
      return;
    }

    const api = createSisfeApiClient(token);
    const casosConExpte = await cargarCasosParaSync(estudioId, casoId);
    if (casosConExpte.length === 0) {
      const msg = casoId !== undefined && casoId !== null
        ? "El expediente seleccionado no está configurado para sincronizar o no existe."
        : "No hay expedientes cargados con número para sincronizar.";
      await updateSyncStatus(usuarioId, "done", 100, msg, emptyStats());
      return;
    }

    const stats: SisfeSyncStats = emptyStats();
    let progress = 5;

    await updateSyncStatus(
      usuarioId,
      "running",
      progress,
      casoId != null
        ? "Sincronizando expediente seleccionado vía API SISFE..."
        : `${casosConExpte.length} expedientes para sincronizar vía API SISFE...`,
    );

    if (casoId != null) {
      const caso = casosConExpte[0];
      const cuijBusqueda = extraerCuij(caso.nroExpte);
      if (!cuijBusqueda) {
        await updateSyncStatus(usuarioId, "done", 100, "El expediente no tiene número CUJ válido.", stats);
        return;
      }

      try {
        await sincronizarCasoApi({
          api,
          sesion: { cookieName: sesion.cookieName, cookieValue: sesion.cookieValue },
          caso,
          cuijBusqueda,
          idExpediente: caso.sisfeExpteId ? Number(caso.sisfeExpteId) : null,
          usuarioId,
          estudioId,
          stats,
        });
      } catch (error: unknown) {
        if (await manejarErrorSync(error, usuarioId, 50, stats)) return;
        log.error({ err: error, casoId: caso.id }, `[SISFE Sync] Error API al sincronizar caso ${caso.id}`);
      }

      const mensajeFinal = construirMensajeFinalSync(stats, stats.noEncontradosEnSisfe > 0
        ? "No se encontró el expediente en SISFE."
        : undefined);
      await updateSyncStatus(usuarioId, "done", 100, mensajeFinal, stats);
      await saveSessionLastSync(usuarioId);

      if (stats.movimientosNuevos > 0) {
        emitirAUsuario(usuarioId, "novedades", {
          tipo: "sisfe_novedades",
          nuevos: stats.movimientosNuevos,
          expedientes: stats.actualizados,
        });
      }
      return;
    }

    for (let i = 0; i < casosConExpte.length; i++) {
      const sesionActual = await getSession(usuarioId, estudioId);
      if (!sesionActual || sesionActual.syncStatus !== "running") {
        log.info("[SISFE Sync] Sincronizacion cancelada por el usuario.");
        return;
      }

      const caso = casosConExpte[i];
      const cuijBusqueda = extraerCuij(caso.nroExpte);
      if (!cuijBusqueda) continue;

      progress = 5 + Math.round((i / casosConExpte.length) * 90);
      await updateSyncStatus(
        usuarioId,
        "running",
        progress,
        `Sincronizando vía API: ${(caso.caratula || cuijBusqueda).substring(0, 50)}...`,
      );

      try {
        await sincronizarCasoApi({
          api,
          sesion: { cookieName: sesion.cookieName, cookieValue: sesion.cookieValue },
          caso,
          cuijBusqueda,
          idExpediente: caso.sisfeExpteId ? Number(caso.sisfeExpteId) : null,
          usuarioId,
          estudioId,
          stats,
        });
      } catch (error: unknown) {
        if (await manejarErrorSync(error, usuarioId, progress, stats)) return;
        log.error({ err: error, casoId: caso.id }, `[SISFE Sync] Error API al sincronizar caso ${caso.id}`);
      }

      if (i < casosConExpte.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }

    await updateSyncStatus(usuarioId, "done", 100, construirMensajeFinalSync(stats), stats);
    await saveSessionLastSync(usuarioId);

    if (stats.movimientosNuevos > 0) {
      emitirAUsuario(usuarioId, "novedades", {
        tipo: "sisfe_novedades",
        nuevos: stats.movimientosNuevos,
        expedientes: stats.actualizados,
      });
    }
  } catch (error: unknown) {
    await manejarErrorSync(error, usuarioId, 0);
  }
}

async function sincronizarCasoApi(params: {
  api: ReturnType<typeof createSisfeApiClient>;
  sesion: SesionSync;
  caso: CasoSyncRow;
  cuijBusqueda: string;
  idExpediente: number | null;
  usuarioId: number;
  estudioId: number;
  stats: SisfeSyncStats;
}): Promise<void> {
  const {
    api,
    sesion,
    caso,
    cuijBusqueda,
    usuarioId,
    estudioId,
    stats,
  } = params;

  let idExpediente = params.idExpediente;

  if (idExpediente != null && !Number.isNaN(idExpediente)) {
    const detallePrev = await api.findById(idExpediente);
    if (!expedienteCoincideConCuij(detallePrev, cuijBusqueda)) {
      log.warn(
        { casoId: caso.id, sisfeExpteId: idExpediente, cuijBusqueda, cuijSufijo: detallePrev.cuijSufijo },
        "[SISFE Sync] sisfeExpteId no coincide con CUIJ local; se limpia y re-busca",
      );
      await db.update(casos)
        .set({ sisfeExpteId: null, updatedAt: new Date(), updatedBy: usuarioId })
        .where(and(
          eq(casos.id, caso.id),
          eq(casos.estudioId, estudioId),
          isNull(casos.deletedAt),
        ));
      idExpediente = null;
    }
  }

  if (idExpediente == null || Number.isNaN(idExpediente)) {
    const encontrado = await buscarExpedienteEnFiltro(api, cuijBusqueda);
    if (!encontrado) {
      log.info({ casoId: caso.id, cuijBusqueda }, "[SISFE Sync] Expediente no encontrado en SISFE por CUIJ");
      stats.noEncontradosEnSisfe++;
      return;
    }
    idExpediente = encontrado.id;
  }

  const detalle = await api.findById(idExpediente);
  const ubicacionActual = parseUbicacionActual(detalle.expUbicacion || "");
  const fechaUltimaActualizacionPrevia = caso.sisfeFechaUltimaActualizacion;
  const expedienteDigitalDescargadoPreviamente = caso.sisfeExpedienteDigitalAt != null;

  const novedades = await api.fetchAllNovedadesById(idExpediente);
  const movimientos = novedades
    .map((n) => mapearNovedadApiAMovimiento(n, cuijBusqueda))
    .filter((mov): mov is MovimientoSisfe => mov != null);

  const movimientosNuevosAntes = stats.movimientosNuevos;
  await persistirMovimientos(caso.id, estudioId, usuarioId, movimientos, stats);
  const movimientosNuevosEnCaso = stats.movimientosNuevos - movimientosNuevosAntes;

  const opcionesDescarga: OpcionesDetalleExpediente = {
    fechaUltimaActualizacionPrevia,
    expedienteDigitalDescargadoPreviamente,
    forzarDescarga: movimientosNuevosEnCaso > 0,
  };
  const debeDescargarPdf = movimientosNuevosEnCaso > 0
    || !debeOmitirDescargaExpediente(detalle.ultimaActualizacionDelExpediente, opcionesDescarga);

  let pdfPersistido = false;

  if (debeDescargarPdf) {
    const adjuntosCaso = await db.select({ nombre: adjuntos.nombre })
      .from(adjuntos)
      .where(and(
        eq(adjuntos.scopeId, caso.id),
        eq(adjuntos.scope, "CASO"),
        isNull(adjuntos.eliminadoEn),
      ));
    const nombresExistentes = new Set(adjuntosCaso.map((a) => a.nombre.toLowerCase()));

    await withContext(sesion.cookieName, sesion.cookieValue, async (context) => {
      const page = await context.newPage();
      attachDiagnostics(page);
      try {
        const resultadoPdf = await conReintentos(
          () => descargarExpedienteDigitalEnDetalle(
            page,
            String(idExpediente),
            opcionesDescarga,
            detalle.ultimaActualizacionDelExpediente,
          ),
          `descargar expediente digital ${cuijBusqueda}`,
        );

        if (resultadoPdf.expedienteDigitalFallido) {
          stats.pdfsNoDescargados++;
        }

        if (resultadoPdf.expedienteDigital) {
          const upload = await reemplazarDocumentoADrive(
            caso.id,
            estudioId,
            usuarioId,
            nombresExistentes,
            resultadoPdf.expedienteDigital.buffer,
            resultadoPdf.expedienteDigital.filename,
            resultadoPdf.expedienteDigital.mimeType,
          );
          if (upload.ok) {
            pdfPersistido = true;
          } else {
            stats.pdfsNoDescargados++;
            log.warn(
              { casoId: caso.id, reason: upload.reason },
              "[SISFE Sync] Drive rechazó la subida; el PDF no se marca como descargado (próximo sync reintenta)",
            );
          }
        }
      } finally {
        await page.close().catch(() => {});
      }
    });
  }

  // Metadatos + lastSyncAt solo al final exitoso del expediente.
  await db.update(casos)
    .set({
      sisfeExpteId: String(idExpediente),
      sisfeLastSyncAt: new Date(),
      sisfeSyncedBy: usuarioId,
      sisfeRadicadoEn: detalle.radicado || null,
      sisfeLocalidad: detalle.localidad || null,
      sisfeFechaIngresoMeu: detalle.fechaIngresoMEU ? parseFechaSISFE(detalle.fechaIngresoMEU) : null,
      sisfeUbicacionActual: ubicacionActual.ubicacion || null,
      sisfeFechaUbicacionActual: ubicacionActual.fechaDesde,
      sisfeSoloDigital: detalle.expDigital === 1,
      sisfeFechaUltimaActualizacion: parseFechaHoraSISFE(detalle.ultimaActualizacionDelExpediente),
      ...(pdfPersistido
        ? { sisfeExpedienteDigitalAt: parseFechaHoraSISFE(detalle.ultimaActualizacionDelExpediente) ?? new Date() }
        : {}),
      updatedAt: new Date(),
      updatedBy: usuarioId,
    })
    .where(and(
      eq(casos.id, caso.id),
      eq(casos.estudioId, estudioId),
      isNull(casos.deletedAt),
    ));

  if (ubicacionActual.ubicacion && ubicacionActual.fechaDesde) {
    await upsertTrazabilidad(caso.id, estudioId, ubicacionActual.ubicacion, ubicacionActual.fechaDesde);
  }

  stats.actualizados++;
  emitirAUsuario(usuarioId, "sisfe_sync", {
    casoId: caso.id,
    movimientosNuevos: stats.movimientosNuevos,
  });
}

/** Verifica que el detalle SISFE corresponda al CUIJ/nroExpte local. */
export function expedienteCoincideConCuij(detalle: SisfeExpedienteDetalle, cuijLocal: string): boolean {
  const local = normalizarCuj(cuijLocal);
  if (!local) return true;

  const sufijo = normalizarCuj(detalle.cuijSufijo ?? "");
  if (!sufijo) return true;

  return local === sufijo || local.endsWith(sufijo) || local.includes(sufijo) || sufijo.includes(local);
}

async function buscarExpedienteEnFiltro(
  api: ReturnType<typeof createSisfeApiClient>,
  cuijBusqueda: string,
): Promise<SisfeExpedienteListItem | null> {
  return api.findByCuij(cuijBusqueda);
}

function mapearNovedadApiAMovimiento(novedad: SisfeNovedadItem, cuij: string): MovimientoSisfe | null {
  const fecha = (novedad.fecha ?? "").trim();
  const novedadTexto = (novedad.novedad ?? "").trim();
  if (!fecha || !novedadTexto) return null;

  const observacion = (novedad.observacion ?? "").replace(/<br>/gi, "\n").trim();
  const sisfeMovId = `${normalizarCuj(cuij)}_${fecha}_${novedadTexto}`.toLowerCase().replace(/[\s/-]/g, "_").substring(0, 490);

  return {
    fecha,
    tipo: mapaTipoMovimiento({
      tabla: novedad.tabla,
      tipoActuacion: novedad.tipoActuacion,
      actuacionTipoFirma: novedad.actuacionTipoFirma,
    }),
    novedad: novedadTexto,
    observacion,
    sisfeMovId,
    documento: null,
    documentos: [],
  };
}

async function ejecutarSyncBrowser(usuarioId: number, estudioId: number, casoId?: number): Promise<void> {
  try {
    await updateSyncStatus(usuarioId, "running", 0, "Iniciando sincronización...");

    const sesion = await getSession(usuarioId, estudioId);
    if (!sesion) {
      await updateSyncStatus(usuarioId, "error", 0, "No hay sesión activa. Conectate al SISFE primero.");
      return;
    }

    await withContext(sesion.cookieName, sesion.cookieValue, async (context) => {
    const casosConExpte = await cargarCasosParaSync(estudioId, casoId);

    if (casosConExpte.length === 0) {
      const msg = casoId !== undefined && casoId !== null
        ? "El expediente seleccionado no está configurado para sincronizar o no existe."
        : "No hay expedientes cargados con número para sincronizar.";
      await updateSyncStatus(usuarioId, "done", 100, msg, emptyStats());
      return;
    }

    const progressMsg = casoId !== undefined && casoId !== null
      ? "Sincronizando expediente seleccionado. Buscando en SISFE..."
      : `${casosConExpte.length} expedientes para sincronizar. Buscando en SISFE...`;
    await updateSyncStatus(usuarioId, "running", 5, progressMsg);

    const stats: SisfeSyncStats = emptyStats();
    for (let i = 0; i < casosConExpte.length; i++) {
      const caso = casosConExpte[i];
      
      const sesionActual = await getSession(usuarioId, estudioId);
      if (!sesionActual || sesionActual.syncStatus !== "running") {
        log.info("[SISFE Sync] Sincronizacion cancelada por el usuario.");
        return;
      }

      const progress = 5 + Math.round((i / casosConExpte.length) * 90);
      const cuijBusqueda = extraerCuij(caso.nroExpte);
      if (!cuijBusqueda) continue;

      await updateSyncStatus(
        usuarioId,
        "running",
        progress,
        `Buscando en SISFE: ${(caso.caratula || cuijBusqueda).substring(0, 50)}...`,
      );

      const page = await context.newPage();
      attachDiagnostics(page);

      try {
        const resultadoBusqueda = await conReintentos(
          () => buscarExpedientePorCuij(page, cuijBusqueda),
          `buscar expediente ${cuijBusqueda}`,
        );
        if (!resultadoBusqueda) {
          stats.noEncontradosEnSisfe++;
          continue;
        }

        const adjuntosCaso = await db.select({ nombre: adjuntos.nombre })
          .from(adjuntos)
          .where(and(
            eq(adjuntos.scopeId, caso.id),
            eq(adjuntos.scope, "CASO"),
            isNull(adjuntos.eliminadoEn)
          ));
        const nombresExistentes = new Set(adjuntosCaso.map(a => a.nombre.toLowerCase()));

        const detalle = await conReintentos(
          () => fetchDetalleExpediente(page, resultadoBusqueda.sisfeId, cuijBusqueda, {
            fechaUltimaActualizacionPrevia: caso.sisfeFechaUltimaActualizacion,
            expedienteDigitalDescargadoPreviamente: caso.sisfeExpedienteDigitalAt != null,
          }),
          `detalle expediente ${cuijBusqueda}`,
        );
        const ubicacionActual = parseUbicacionActual(detalle.ubicacionActual);

        let pdfPersistido = false;
        if (detalle.expedienteDigitalFallido) {
          stats.pdfsNoDescargados++;
        }

        if (detalle.expedienteDigital) {
          const upload = await reemplazarDocumentoADrive(
            caso.id,
            estudioId,
            usuarioId,
            nombresExistentes,
            detalle.expedienteDigital.buffer,
            detalle.expedienteDigital.filename,
            detalle.expedienteDigital.mimeType,
          );
          if (upload.ok) {
            pdfPersistido = true;
          } else {
            stats.pdfsNoDescargados++;
            log.warn(
              { casoId: caso.id, reason: upload.reason },
              "[SISFE Sync] Drive rechazó la subida; el PDF no se marca como descargado (próximo sync reintenta)",
            );
          }
        }

        await persistirMovimientos(caso.id, estudioId, usuarioId, detalle.movimientos, stats);

        // Metadatos + lastSyncAt solo al final exitoso del expediente.
        await db.update(casos)
          .set({
            sisfeExpteId: resultadoBusqueda.sisfeId,
            sisfeLastSyncAt: new Date(),
            sisfeSyncedBy: usuarioId,
            sisfeRadicadoEn: detalle.radicadoEn || null,
            sisfeLocalidad: detalle.localidad || null,
            sisfeFechaIngresoMeu: detalle.fechaIngreso ? parseFechaSISFE(detalle.fechaIngreso) : null,
            sisfeUbicacionActual: ubicacionActual.ubicacion || null,
            sisfeFechaUbicacionActual: ubicacionActual.fechaDesde,
            sisfeSoloDigital: detalle.soloDigital,
            sisfeFechaUltimaActualizacion: parseFechaHoraSISFE(detalle.ultimaActualizacion),
            ...(pdfPersistido
              ? { sisfeExpedienteDigitalAt: parseFechaHoraSISFE(detalle.ultimaActualizacion) ?? new Date() }
              : {}),
            updatedAt: new Date(),
            updatedBy: usuarioId,
          })
          .where(and(
            eq(casos.id, caso.id),
            eq(casos.estudioId, estudioId),
            isNull(casos.deletedAt),
          ));

        if (ubicacionActual.ubicacion && ubicacionActual.fechaDesde) {
          await upsertTrazabilidad(caso.id, estudioId, ubicacionActual.ubicacion, ubicacionActual.fechaDesde);
        }

        stats.actualizados++;
        emitirAUsuario(usuarioId, "sisfe_sync", {
          casoId: caso.id,
          movimientosNuevos: stats.movimientosNuevos,
        });
        await page.waitForTimeout(2000);
      } catch (error: unknown) {
        if (await manejarErrorSync(error, usuarioId, progress, stats)) return;
        log.error({ err: error }, `[SISFE Sync] Error al sincronizar caso ${caso.id}`);
      } finally {
        await page.close().catch(() => {});
      }
    }

    const mensajeFinal = construirMensajeFinalSync(stats);
    await updateSyncStatus(usuarioId, "done", 100, mensajeFinal, stats);
    await saveSessionLastSync(usuarioId);

    if (stats.movimientosNuevos > 0) {
      emitirAUsuario(usuarioId, "novedades", {
        tipo: "sisfe_novedades",
        nuevos: stats.movimientosNuevos,
        expedientes: stats.actualizados,
      });
    }
    });
  } catch (error: unknown) {
    await manejarErrorSync(error, usuarioId, 0);
  }
}

async function cargarCasosParaSync(estudioId: number, casoId?: number): Promise<CasoSyncRow[]> {
  const queryConditions = [
    eq(casos.estudioId, estudioId),
    isNotNull(casos.nroExpte),
    isNull(casos.deletedAt),
  ];
  if (casoId !== undefined && casoId !== null) {
    queryConditions.push(eq(casos.id, casoId));
  }

  return db.select({
    id: casos.id,
    nroExpte: casos.nroExpte,
    caratula: casos.caratula,
    sisfeExpteId: casos.sisfeExpteId,
    sisfeFechaUltimaActualizacion: casos.sisfeFechaUltimaActualizacion,
    sisfeExpedienteDigitalAt: casos.sisfeExpedienteDigitalAt,
  })
    .from(casos)
    .where(and(...queryConditions));
}

async function upsertTrazabilidad(
  casoId: number,
  estudioId: number,
  ubicacion: string,
  fechaDesde: Date,
): Promise<void> {
  const trazabilidadExistente = await db.select({ id: casoTrazabilidad.id })
    .from(casoTrazabilidad)
    .where(and(
      eq(casoTrazabilidad.casoId, casoId),
      eq(casoTrazabilidad.ubicacion, ubicacion),
      eq(casoTrazabilidad.fechaDesde, fechaDesde),
    ))
    .limit(1);

  if (trazabilidadExistente.length === 0) {
    await db.insert(casoTrazabilidad).values({
      casoId,
      estudioId,
      ubicacion,
      fechaDesde,
    });
  }
}

async function persistirMovimientos(
  casoId: number,
  estudioId: number,
  usuarioId: number,
  movimientos: MovimientoSisfe[],
  stats: SisfeSyncStats,
): Promise<void> {
  for (const mov of movimientos) {
    const [existe] = await db.select({
      id: movimientosJudiciales.id,
      novedad: movimientosJudiciales.novedad,
      descripcion: movimientosJudiciales.descripcion,
    })
      .from(movimientosJudiciales)
      .where(and(
        eq(movimientosJudiciales.casoId, casoId),
        eq(movimientosJudiciales.sisfeMovId, mov.sisfeMovId),
      ))
      .limit(1);

    if (!existe) {
      const inserted = await db.insert(movimientosJudiciales).values({
        casoId,
        estudioId,
        fecha: parseFechaSISFE(mov.fecha),
        tipo: mov.tipo.substring(0, 100),
        novedad: mov.novedad || null,
        descripcion: mov.observacion || null,
        sisfeMovId: mov.sisfeMovId,
        origenSisfe: true,
        createdBy: usuarioId,
      })
        .onConflictDoNothing({ target: [movimientosJudiciales.casoId, movimientosJudiciales.sisfeMovId] })
        .returning({ id: movimientosJudiciales.id });
      if (inserted.length > 0) stats.movimientosNuevos++;
    } else {
      // Reconciliación mínima: si texto/observación cambió en SISFE, actualizar.
      // Limitación conocida: no detectamos movimientos eliminados en SISFE (no soft-deleteamos
      // locales ausentes del feed); solo insertamos/actualizamos lo que SISFE sigue enviando.
      const novedadNueva = mov.novedad || null;
      const observacionNueva = mov.observacion || null;
      const novedadCambio = (existe.novedad ?? null) !== novedadNueva;
      const observacionCambio = (existe.descripcion ?? null) !== observacionNueva;
      if (novedadCambio || observacionCambio) {
        await db.update(movimientosJudiciales)
          .set({
            novedad: novedadNueva,
            descripcion: observacionNueva,
          })
          .where(eq(movimientosJudiciales.id, existe.id));
      }
    }
  }
}

/**
 * Distingue errores globales (abortan el sync) de errores por expediente (se registran
 * como fallidos y se continúa). Retorna true si el sync debe abortarse.
 */
async function manejarErrorSync(
  error: unknown,
  usuarioId: number,
  progress: number,
  stats?: SisfeSyncStats,
): Promise<boolean> {
  if (esTargetCerrado(error)) {
    log.error({ err: error }, "[SISFE Sync] El navegador se cerró; abortando sincronización.");
    await updateSyncStatus(
      usuarioId,
      "error",
      progress,
      "Se interrumpió la conexión con el navegador durante la sincronización. Volvé a intentar en unos minutos.",
    );
    return true;
  }

  if (error instanceof SisfeError) {
    if (error.code === "SESION_EXPIRADA") {
      await deleteSession(usuarioId);
      await updateSyncStatus(usuarioId, "error", progress, mensajeSisfeError(error));
      return true;
    }

    if (error.code === "DOM_CHANGED") {
      log.error({ err: error, alert: "SISFE_DOM_CHANGED" }, "[SISFE Sync] Alerta interna: cambio de DOM en SISFE");
    }

    // Error de un expediente: registrar y continuar con el resto.
    if (stats) {
      stats.fallidos++;
      log.warn({ err: error, code: error.code }, "[SISFE Sync] Error de expediente; se continúa con el resto");
      return false;
    }

    await updateSyncStatus(usuarioId, "error", progress, mensajeSisfeError(error));
    return true;
  }

  if (stats) {
    stats.fallidos++;
    log.warn({ err: error }, "[SISFE Sync] Error de expediente; se continúa con el resto");
    return false;
  }

  if (error instanceof Error) {
    await updateSyncStatus(usuarioId, "error", progress, `Error inesperado: ${error.message}`);
    return true;
  }

  await updateSyncStatus(usuarioId, "error", progress, "Error inesperado: desconocido");
  return true;
}

function construirMensajeFinalSync(stats: SisfeSyncStats, mensajeAlternativo?: string): string {
  if (mensajeAlternativo) return mensajeAlternativo;

  const partes: string[] = ["Sincronización completada."];
  if (stats.actualizados > 0 || stats.fallidos > 0) {
    partes.push(`Procesados: ${stats.actualizados}. Fallidos: ${stats.fallidos}.`);
  }
  if (stats.pdfsNoDescargados > 0) {
    partes.push(`${stats.pdfsNoDescargados} expediente(s) digital(es) no se pudieron descargar (los movimientos sí se actualizaron).`);
  }
  return partes.join(" ");
}

function emptyStats(): SisfeSyncStats {
  return { actualizados: 0, movimientosNuevos: 0, noEncontradosEnSisfe: 0, pdfsNoDescargados: 0, fallidos: 0 };
}

function mensajeSisfeError(error: SisfeError): string {
  switch (error.code) {
    case "SESION_EXPIRADA":
      return "Sesión SISFE expirada durante la sincronización. Volvé a conectarte.";
    case "PORTAL_CAIDO":
      return "El portal SISFE no respondió a tiempo. Intentá nuevamente en unos minutos.";
    case "TIMEOUT_DESCARGA":
      return "No se pudo descargar el expediente digital a tiempo. La sincronización de movimientos puede reintentarse.";
    case "DOM_CHANGED":
      return "No pudimos leer SISFE porque el portal cambió su estructura. Ya quedó registrado para revisión técnica.";
    case "RECAPTCHA_BLOQUEO":
      return "SISFE bloqueó la descarga o lectura con reCAPTCHA. Volvé a conectar la sesión y reintentá.";
  }
}

export function parseFechaSISFE(fechaStr: string): Date {
  return parseFechaSisfeArgentina(fechaStr);
}

/**
 * Sube el PDF nuevo primero; solo si quedó persistido, soft-deletea el anterior.
 * Si la subida falla, el adjunto viejo queda intacto.
 */
export async function reemplazarDocumentoADrive(
  casoId: number,
  estudioId: number,
  usuarioId: number,
  nombresExistentes: Set<string>,
  buffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<DriveUploadResult> {
  const existentes = await db.select({
    id: adjuntos.id,
    driveFileId: adjuntos.driveFileId,
  })
    .from(adjuntos)
    .where(and(
      eq(adjuntos.estudioId, estudioId),
      eq(adjuntos.scope, "CASO"),
      eq(adjuntos.scopeId, casoId),
      eq(adjuntos.nombre, filename),
      isNull(adjuntos.eliminadoEn),
    ));

  const upload = await subirDocumentoADrive(casoId, estudioId, usuarioId, buffer, filename, mimeType);
  if (!upload.ok) {
    return upload;
  }

  const storage = getStorage(estudioId);
  for (const existente of existentes) {
    await storage.deleteObject(existente.driveFileId).catch((error) => {
      log.error({ err: error }, "[SISFE Sync] No se pudo mover a papelera un documento anterior");
    });
    await AdjuntosQueries.softDeleteAdjunto(existente.id, estudioId);
  }

  nombresExistentes.delete(filename.toLowerCase());
  nombresExistentes.add(filename.toLowerCase());
  return { ok: true };
}

export async function subirDocumentoADrive(
  casoId: number,
  estudioId: number,
  _usuarioId: number,
  buffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<DriveUploadResult> {
  try {
    const [caso] = await db.select({
      driveFolderId: casos.driveFolderId,
    })
      .from(casos)
      .where(and(
        eq(casos.id, casoId),
        eq(casos.estudioId, estudioId),
        isNull(casos.deletedAt),
      ))
      .limit(1);

    if (!caso) {
      return { ok: false, reason: "CASO_NO_ENCONTRADO" };
    }

    let folderId = caso.driveFolderId;

    if (!folderId) {
      try {
        log.info(`[SISFE Sync] Creando carpeta de Google Drive para caso ${casoId}...`);
        const updatedCaso = await DriveService.crearCarpetaCaso(casoId, estudioId);
        folderId = updatedCaso.driveFolderId;
      } catch (driveErr) {
        log.error({ err: driveErr }, "[SISFE Sync] Error al crear carpeta de Drive para el caso");
        return { ok: false, reason: "DRIVE_FOLDER_CREATE_FAILED" };
      }
    }

    if (!folderId) {
      return { ok: false, reason: "DRIVE_FOLDER_MISSING" };
    }

    log.info(`[SISFE Sync] Subiendo documento a Google Drive para caso ${casoId}.`);
    const storage = getStorage(estudioId);
    const driveFile = await storage.uploadStream({
      body: Readable.from(buffer),
      name: filename,
      mimeType,
      folderKey: folderId,
      size: buffer.length,
    });

    await AdjuntosQueries.insertAdjunto({
      scope: "CASO",
      scopeId: casoId,
      nombre: filename,
      mime: mimeType,
      driveFileId: driveFile.key,
      driveFolderId: folderId,
    }, estudioId);
    log.info("[SISFE Sync] Documento subido a Google Drive e indexado en Iuris con exito.");
    return { ok: true };
  } catch (err) {
    log.error({ err }, `[SISFE Sync] Error al subir documento a Drive para caso ${casoId}`);
    return { ok: false, reason: "DRIVE_UPLOAD_FAILED" };
  }
}
