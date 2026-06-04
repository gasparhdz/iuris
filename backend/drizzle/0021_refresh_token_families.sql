ALTER TABLE "refresh_tokens"
ADD COLUMN IF NOT EXISTS "jti_hash" varchar(64),
ADD COLUMN IF NOT EXISTS "family_id" uuid,
ADD COLUMN IF NOT EXISTS "rotated_at" timestamp;

CREATE UNIQUE INDEX IF NOT EXISTS "refresh_tokens_jti_hash_unique"
ON "refresh_tokens" ("jti_hash");

CREATE INDEX IF NOT EXISTS "refresh_tokens_family_id_idx"
ON "refresh_tokens" ("family_id");
