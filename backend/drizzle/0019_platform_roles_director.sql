INSERT INTO "roles" ("codigo", "nombre", "activo")
VALUES ('DIRECTOR', 'Director', true)
ON CONFLICT ("codigo")
DO UPDATE SET "nombre" = EXCLUDED."nombre", "activo" = true;

WITH director_role AS (
  SELECT "id" FROM "roles" WHERE "codigo" = 'DIRECTOR'
),
affected_users AS (
  SELECT DISTINCT u."id" AS "usuario_id"
  FROM "usuarios" u
  INNER JOIN "usuario_roles" ur ON ur."usuario_id" = u."id"
  INNER JOIN "roles" r ON r."id" = ur."rol_id"
  WHERE u."estudio_id" <> 1
    AND r."codigo" IN ('ADMIN', 'SUPERADMIN')
)
INSERT INTO "usuario_roles" ("usuario_id", "rol_id")
SELECT au."usuario_id", dr."id"
FROM affected_users au
CROSS JOIN director_role dr
WHERE NOT EXISTS (
  SELECT 1
  FROM "usuario_roles" existing
  WHERE existing."usuario_id" = au."usuario_id"
    AND existing."rol_id" = dr."id"
);

DELETE FROM "usuario_roles" ur
USING "usuarios" u, "roles" r
WHERE ur."usuario_id" = u."id"
  AND ur."rol_id" = r."id"
  AND u."estudio_id" <> 1
  AND r."codigo" IN ('ADMIN', 'SUPERADMIN');

WITH director_role AS (
  SELECT "id" FROM "roles" WHERE "codigo" = 'DIRECTOR'
),
modulos AS (
  SELECT unnest(ARRAY[
    'CLIENTES', 'CASOS', 'TAREAS', 'EVENTOS', 'HONORARIOS',
    'GASTOS', 'INGRESOS', 'PLANTILLAS', 'NOTAS', 'VALORJUS',
    'TERCEROS', 'PLANES', 'ADJUNTOS'
  ]) AS "modulo"
)
INSERT INTO "permisos" ("rol_id", "modulo", "ver", "crear", "editar", "eliminar")
SELECT dr."id", m."modulo", true, true, true, true
FROM director_role dr
CROSS JOIN modulos m
WHERE NOT EXISTS (
  SELECT 1
  FROM "permisos" p
  WHERE p."rol_id" = dr."id"
    AND p."modulo" = m."modulo"
);
