import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { Readable } from "node:stream";
import { db } from "../db/index.js";
import { casos, movimientosJudiciales, adjuntos, casoTrazabilidad } from "../db/schema.js";
import { withContext } from "./browser-pool.js";
import { SisfeError, attachDiagnostics, buscarExpedientePorCuij, conReintentos, esTargetCerrado, fetchDetalleExpediente, parseFechaHoraSISFE, parseUbicacionActual } from "./sisfe-scraper.service.js";
import { deleteSession, getSession, saveSessionLastSync, updateSyncStatus, type SisfeSyncStats } from "./sisfe-session.service.js";
import { DriveService } from "./drive.service.js";
import { getStorage } from "../storage/factory.js";
import { AdjuntosQueries } from "../db/queries/adjuntos.queries.js";
import { logger } from "../utils/logger.js";
import { emitirAUsuario } from "../sse/sse.registry.js";

const log = logger.child({ module: "SISFE-Sync" });

export async function ejecutarSync(usuarioId: number, estudioId: number, casoId?: number): Promise<void> {
  try {
    await updateSyncStatus(usuarioId, "running", 0, "Iniciando sincronización...");

    const sesion = await getSession(usuarioId, estudioId);
    if (!sesion) {
      await updateSyncStatus(usuarioId, "error", 0, "No hay sesión activa. Conectate al SISFE primero.");
      return;
    }

    await withContext(sesion.cookieName, sesion.cookieValue, async (context) => {
    const queryConditions = [
      eq(casos.estudioId, estudioId),
      isNotNull(casos.nroExpte),
      isNull(casos.deletedAt),
    ];
    if (casoId !== undefined && casoId !== null) {
      queryConditions.push(eq(casos.id, casoId));
    }

    const casosConExpte = await db.select({
      id: casos.id,
      nroExpte: casos.nroExpte,
      caratula: casos.caratula,
      sisfeExpteId: casos.sisfeExpteId,
      sisfeFechaUltimaActualizacion: casos.sisfeFechaUltimaActualizacion,
      sisfeExpedienteDigitalAt: casos.sisfeExpedienteDigitalAt,
    })
      .from(casos)
      .where(and(...queryConditions));

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
      
      // Verificar si el usuario canceló la sincronización desde el frontend
      const sesionActual = await getSession(usuarioId, estudioId);
      if (!sesionActual || sesionActual.syncStatus !== "running") {
        log.info("[SISFE Sync] Sincronizacion cancelada por el usuario.");
        return; // El finally cerrará el navegador automáticamente
      }

      const progress = 5 + Math.round((i / casosConExpte.length) * 90);
      const cuijBusqueda = caso.nroExpte?.split("(")[0]?.trim() ?? "";
      if (!cuijBusqueda) continue;

      await updateSyncStatus(
        usuarioId,
        "running",
        progress,
        `Buscando en SISFE: ${(caso.caratula || cuijBusqueda).substring(0, 50)}...`,
      );

      // Página nueva por expediente: acota la memoria del renderer (cada detalle carga
      // una página pesada + descarga PDF + reCAPTCHA) y permite recuperar una page colgada
      // sin arrastrar el problema al resto de los casos.
      const page = await context.newPage();
      attachDiagnostics(page);

      try {
        const resultadoBusqueda = await conReintentos(
          () => buscarExpedientePorCuij(page, cuijBusqueda),
          `buscar expediente ${cuijBusqueda}`,
        );
        if (!resultadoBusqueda) {
          stats.noEncontradosEnSisfe++;
          // TODO FASE 2: crear o asociar expedientes no encontrados queda deshabilitado.
          continue;
        }

        // Obtener nombres de adjuntos existentes para reemplazar correctamente el expediente digital consolidado
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
            // Sólo se actualiza cuando esta corrida obtuvo un PDF válido; si se omitió la
            // descarga (sin novedades) se conserva el valor previo para no perder el gate.
            ...(detalle.expedienteDigital
              ? { sisfeExpedienteDigitalAt: parseFechaHoraSISFE(detalle.ultimaActualizacion) ?? new Date() }
              : {}),
            updatedAt: new Date(),
            updatedBy: usuarioId,
          })
          .where(eq(casos.id, caso.id));

        if (ubicacionActual.ubicacion && ubicacionActual.fechaDesde) {
          const trazabilidadExistente = await db.select({ id: casoTrazabilidad.id })
            .from(casoTrazabilidad)
            .where(and(
              eq(casoTrazabilidad.casoId, caso.id),
              eq(casoTrazabilidad.ubicacion, ubicacionActual.ubicacion),
              eq(casoTrazabilidad.fechaDesde, ubicacionActual.fechaDesde),
            ))
            .limit(1);

          if (trazabilidadExistente.length === 0) {
            await db.insert(casoTrazabilidad).values({
              casoId: caso.id,
              estudioId,
              ubicacion: ubicacionActual.ubicacion,
              fechaDesde: ubicacionActual.fechaDesde,
            });
          }
        }

        if (detalle.expedienteDigitalFallido) {
          stats.pdfsNoDescargados++;
        }

        // Si se descargó el expediente digital completo, subirlo a Drive e indexarlo en la tabla de adjuntos
        if (detalle.expedienteDigital) {
          await reemplazarDocumentoADrive(
            caso.id,
            estudioId,
            usuarioId,
            nombresExistentes,
            detalle.expedienteDigital.buffer,
            detalle.expedienteDigital.filename,
            detalle.expedienteDigital.mimeType
          );
        }

        for (const mov of detalle.movimientos) {
          // El lookup se acota al expediente (caso.id): sisfeMovId es un id global del
          // portal, asi que filtrar solo por sisfeMovId mezclaria movimientos entre
          // estudios que sigan el mismo expediente publico.
          const [existe] = await db.select({
            id: movimientosJudiciales.id,
            novedad: movimientosJudiciales.novedad,
          })
            .from(movimientosJudiciales)
            .where(and(
              eq(movimientosJudiciales.casoId, caso.id),
              eq(movimientosJudiciales.sisfeMovId, mov.sisfeMovId),
            ))
            .limit(1);

          if (!existe) {
            // onConflictDoNothing cierra la carrera SELECT->INSERT entre dos sync
            // concurrentes del mismo estudio (el unique index garantiza no duplicar).
            const inserted = await db.insert(movimientosJudiciales).values({
              casoId: caso.id,
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
          } else if (!existe.novedad && mov.novedad) {
            await db.update(movimientosJudiciales)
              .set({
                novedad: mov.novedad,
                descripcion: mov.observacion || null,
              })
              .where(eq(movimientosJudiciales.id, existe.id));
          }
        }

        stats.actualizados++;
        await page.waitForTimeout(2000);
      } catch (error: unknown) {
        if (error instanceof SisfeError && error.code === "SESION_EXPIRADA") {
          await deleteSession(usuarioId);
          await updateSyncStatus(usuarioId, "error", progress, mensajeSisfeError(error));
          return;
        }

        if (error instanceof SisfeError) {
          if (error.code === "DOM_CHANGED") {
            log.error({ err: error, alert: "SISFE_DOM_CHANGED", casoId: caso.id }, "[SISFE Sync] Alerta interna: cambio de DOM en SISFE");
          } else {
            log.error({ err: error, casoId: caso.id }, `[SISFE Sync] Error SISFE ${error.code} al sincronizar caso ${caso.id}`);
          }
          await updateSyncStatus(usuarioId, "error", progress, mensajeSisfeError(error));
          return;
        }

        // El navegador/contexto se cerró (crash de Chrome): abortar toda la sincronización.
        // Continuar con el resto de los casos solo encadenaría más errores de "Target closed".
        if (esTargetCerrado(error)) {
          log.error({ err: error, casoId: caso.id }, "[SISFE Sync] El navegador se cerró durante la sincronización; abortando.");
          await updateSyncStatus(usuarioId, "error", progress, "Se interrumpió la conexión con el navegador durante la sincronización. Volvé a intentar en unos minutos.");
          return;
        }

        log.error({ err: error }, `[SISFE Sync] Error al sincronizar caso ${caso.id}`);
      } finally {
        await page.close().catch(() => {});
      }
    }

    const mensajeFinal = stats.pdfsNoDescargados > 0
      ? `Sincronización completada. ${stats.pdfsNoDescargados} expediente(s) digital(es) no se pudieron descargar (los movimientos sí se actualizaron).`
      : "Sincronización completada.";
    await updateSyncStatus(usuarioId, "done", 100, mensajeFinal, stats);
    await saveSessionLastSync(usuarioId);

    // Empujar novedades en tiempo real a la campanita del usuario que sincronizó.
    if (stats.movimientosNuevos > 0) {
      emitirAUsuario(usuarioId, "novedades", {
        tipo: "sisfe_novedades",
        nuevos: stats.movimientosNuevos,
        expedientes: stats.actualizados,
      });
    }
    });
  } catch (error: unknown) {
    if (error instanceof SisfeError) {
      if (error.code === "SESION_EXPIRADA") {
        await deleteSession(usuarioId);
      }
      if (error.code === "DOM_CHANGED") {
        log.error({ err: error, alert: "SISFE_DOM_CHANGED" }, "[SISFE Sync] Alerta interna: cambio de DOM en SISFE");
      }
      await updateSyncStatus(usuarioId, "error", 0, mensajeSisfeError(error));
      return;
    }
    await updateSyncStatus(usuarioId, "error", 0, `Error inesperado: ${error instanceof Error ? error.message : "desconocido"}`);
  }
}

function emptyStats(): SisfeSyncStats {
  return { actualizados: 0, movimientosNuevos: 0, noEncontradosEnSisfe: 0, pdfsNoDescargados: 0 };
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
  const [dia, mes, anio] = fechaStr.split("/");
  const parsed = new Date(`${anio}-${mes}-${dia}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

async function reemplazarDocumentoADrive(
  casoId: number,
  estudioId: number,
  usuarioId: number,
  nombresExistentes: Set<string>,
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<void> {
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

  const storage = getStorage(estudioId);
  for (const existente of existentes) {
    await storage.deleteObject(existente.driveFileId).catch((error) => {
      log.error({ err: error }, "[SISFE Sync] No se pudo mover a papelera un documento anterior");
    });
    await AdjuntosQueries.softDeleteAdjunto(existente.id, estudioId);
  }

  nombresExistentes.delete(filename.toLowerCase());
  await subirDocumentoADrive(casoId, estudioId, usuarioId, buffer, filename, mimeType);
  nombresExistentes.add(filename.toLowerCase());
}

async function subirDocumentoADrive(
  casoId: number,
  estudioId: number,
  usuarioId: number,
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<void> {
  try {
    // 1. Obtener el caso para ver si ya tiene carpeta vinculada
    const [caso] = await db.select({
      driveFolderId: casos.driveFolderId,
    })
      .from(casos)
      .where(eq(casos.id, casoId))
      .limit(1);

    if (!caso) return;

    let folderId = caso.driveFolderId;

    // 2. Si no tiene carpeta de Drive, crearla usando el DriveService de Iuris
    if (!folderId) {
      try {
        log.info(`[SISFE Sync] Creando carpeta de Google Drive para caso ${casoId}...`);
        const updatedCaso = await DriveService.crearCarpetaCaso(casoId, estudioId);
        folderId = updatedCaso.driveFolderId;
      } catch (driveErr) {
        log.error({ err: driveErr }, "[SISFE Sync] Error al crear carpeta de Drive para el caso");
      }
    }

    // 3. Subir el archivo de buffer si ya tenemos un folderId válido
    if (folderId) {
      log.info(`[SISFE Sync] Subiendo documento a Google Drive para caso ${casoId}.`);
      const storage = getStorage(estudioId);
      const driveFile = await storage.uploadStream({
        body: Readable.from(buffer),
        name: filename,
        mimeType,
        folderKey: folderId,
        size: buffer.length,
      });

      // 4. Indexar el archivo en la tabla de adjuntos en base de datos
      await AdjuntosQueries.insertAdjunto({
        scope: "CASO",
        scopeId: casoId,
        nombre: filename,
        mime: mimeType,
        driveFileId: driveFile.key,
        driveFolderId: folderId,
      }, estudioId);
      log.info("[SISFE Sync] Documento subido a Google Drive e indexado en Iuris con exito.");
    }
  } catch (err) {
    log.error({ err }, `[SISFE Sync] Error al subir documento a Drive para caso ${casoId}`);
  }
}
