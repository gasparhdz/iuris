-- Deduplica movimientos SISFE preexistentes (creados por el SELECT+INSERT sin unique)
-- conservando la fila de id mas bajo por (caso_id, sisfe_mov_id). Las filas borradas
-- arrastran en cascada sus movimientos_vistos (FK on delete cascade), lo cual es correcto
-- porque eran duplicados del mismo movimiento.
DELETE FROM "movimientos_judiciales" m
USING "movimientos_judiciales" dup
WHERE m.sisfe_mov_id IS NOT NULL
  AND m.sisfe_mov_id = dup.sisfe_mov_id
  AND m.caso_id = dup.caso_id
  AND m.id > dup.id;
--> statement-breakpoint
CREATE UNIQUE INDEX "movimientos_judiciales_caso_sisfe_mov_unique"
  ON "movimientos_judiciales" ("caso_id", "sisfe_mov_id");
