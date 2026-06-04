INSERT INTO "valores_jus" ("estudio_id", "valor", "fecha", "activo", "created_by")
VALUES (1, '135000.0000', '2026-05-02 00:00:00', true, NULL)
ON CONFLICT ("estudio_id", "fecha")
DO UPDATE SET "valor" = EXCLUDED."valor", "activo" = true, "deleted_at" = NULL;
