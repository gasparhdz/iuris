# Storage

Iuris usa una abstraccion `StorageProvider` para que la logica de negocio no dependa de Google Drive.

## Arquitectura

- `src/storage/types.ts`: contratos neutrales (`StorageKey`, `StoredObject`, `StorageProvider`).
- `src/storage/factory.ts`: resuelve el provider por `estudioId` y lo cachea. Hoy usa `STORAGE_DRIVER`.
- `src/storage/providers/drive.provider.ts`: adapter de Google Drive. Es el unico lugar que importa `utils/drive.ts`.
- `src/storage/providers/s3.provider.ts`: provider S3 compatible, probado para AWS S3 y preparado para MinIO con endpoint custom y path-style.
- `src/storage/rate-limit.ts`: cola y retry para llamadas a storage. Reintenta 403 de cuota, 429 y 5xx.

Las columnas nuevas de `adjuntos` son `storage_key`, `storage_folder_key`, `storage_driver` y `etag`. En Drizzle se mantienen temporalmente los aliases `driveFileId` y `driveFolderId` para no romper contratos existentes del frontend.

## Agregar un provider

1. Implementar `StorageProvider`.
2. Usar `StorageKey` como identificador opaco.
3. No exponer campos especificos del proveedor en services ni controllers.
4. Registrar el provider en `src/storage/factory.ts`.
5. Si soporta subida directa, implementar `createPresignedUpload` y `confirmUpload`.
6. Si soporta webhooks, implementar `watchFolder` y `stopWatch`.

## Credenciales por estudio

La factory recibe siempre `estudioId`. El provider actual de Drive conserva el mecanismo existente (`credentials.json` o OAuth global) para no romper instalaciones. El punto de extension para credenciales por estudio es `getStorage(estudioId)`: ahi se puede resolver una configuracion de DB por estudio y construir el provider con credenciales especificas.

## Subidas

- Google Drive: `POST /adjuntos/upload` sube por stream multipart hacia Drive.
- S3/MinIO: el frontend usa `POST /adjuntos/presign`, subida directa al bucket y `POST /adjuntos/confirm`. El backend valida extension, tamano, scope multi-tenant y prefijo `estudios/{estudioId}/`.

## Sincronizacion

`POST /webhooks/drive` responde 200 inmediato, valida el token HMAC del canal, ignora el handshake `sync` y agenda una reconciliacion async por estudio usando `DriveService.indexarFolder`. Un cron renueva watches proximos a vencer y otro ejecuta reconciliacion nocturna.
