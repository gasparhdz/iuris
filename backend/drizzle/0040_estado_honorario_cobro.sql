-- Estados de cobro para honorarios (antes solo existian PENDIENTE/ANULADO/INCOBRABLE).
-- Necesarios para reflejar el cobro directo parcial/total de un honorario sin plan.
INSERT INTO "parametros" ("categoria_id", "codigo", "nombre", "orden")
SELECT c.id, 'PARCIAL', 'Parcial', 4
FROM "categorias" c
WHERE c.codigo = 'ESTADO_HONORARIO'
  AND NOT EXISTS (
    SELECT 1 FROM "parametros" p WHERE p.categoria_id = c.id AND p.codigo = 'PARCIAL'
  );
--> statement-breakpoint
INSERT INTO "parametros" ("categoria_id", "codigo", "nombre", "orden")
SELECT c.id, 'COBRADO', 'Cobrado', 5
FROM "categorias" c
WHERE c.codigo = 'ESTADO_HONORARIO'
  AND NOT EXISTS (
    SELECT 1 FROM "parametros" p WHERE p.categoria_id = c.id AND p.codigo = 'COBRADO'
  );
