-- Deshabilita el estado de expediente "Finalizado" (se usa "Con sentencia" en su lugar).
-- Ejecutar en pgAdmin4 sobre la base de iuris.

BEGIN;

-- 1) Ver si hay expedientes usando "Finalizado" antes de deshabilitarlo
SELECT c.id, c.caratula, p.nombre AS estado
FROM casos c
JOIN parametros p ON p.id = c.estado_id
WHERE p.categoria_id = 3 AND p.codigo = 'FINALIZADO';

-- 2) (Opcional) Migrar esos expedientes a "Con sentencia".
--    Descomentar si el paso 1 devolvió filas:
-- UPDATE casos
-- SET estado_id = (SELECT id FROM parametros WHERE categoria_id = 3 AND codigo = 'CON_SENTENCIA')
-- WHERE estado_id = (SELECT id FROM parametros WHERE categoria_id = 3 AND codigo = 'FINALIZADO');

-- 3) Deshabilitar el parámetro
UPDATE parametros
SET activo = false
WHERE categoria_id = 3 AND codigo = 'FINALIZADO';

-- 4) Verificación: listado de estados de expediente
SELECT id, codigo, nombre, orden, activo
FROM parametros
WHERE categoria_id = 3
ORDER BY orden;

COMMIT;
