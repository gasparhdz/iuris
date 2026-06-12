-- Alta del modulo de permisos EQUIPO (gestion de usuarios del estudio) para instalaciones
-- existentes. Por defecto solo los roles de acceso total (SUPERADMIN/ADMIN/DIRECTOR) lo
-- reciben, preservando el comportamiento previo (gestion de equipo restringida al Director).
-- Idempotente: no duplica si la fila ya existe.
INSERT INTO "permisos" ("rol_id", "modulo", "ver", "crear", "editar", "eliminar")
SELECT
  r.id,
  'EQUIPO',
  r.codigo IN ('SUPERADMIN', 'ADMIN', 'DIRECTOR'),
  r.codigo IN ('SUPERADMIN', 'ADMIN', 'DIRECTOR'),
  r.codigo IN ('SUPERADMIN', 'ADMIN', 'DIRECTOR'),
  r.codigo IN ('SUPERADMIN', 'ADMIN', 'DIRECTOR')
FROM "roles" r
WHERE NOT EXISTS (
  SELECT 1 FROM "permisos" p WHERE p.rol_id = r.id AND p.modulo = 'EQUIPO'
);
