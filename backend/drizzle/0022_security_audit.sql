CREATE TABLE IF NOT EXISTS "security_audit" (
  "id" serial PRIMARY KEY,
  "estudio_id" integer NOT NULL DEFAULT 0,
  "usuario_id" integer REFERENCES "usuarios"("id") ON DELETE SET NULL,
  "evento" varchar(80) NOT NULL,
  "metodo" varchar(10),
  "path" varchar(500),
  "ip" varchar(100),
  "user_agent" varchar(500),
  "status_code" integer,
  "target_estudio_id" integer,
  "metadata" json,
  "previous_hash" varchar(64),
  "row_hash" varchar(64) NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "security_audit_estudio_created_idx"
ON "security_audit" ("estudio_id", "created_at");

CREATE INDEX IF NOT EXISTS "security_audit_usuario_evento_idx"
ON "security_audit" ("usuario_id", "evento");

CREATE OR REPLACE FUNCTION prevent_security_audit_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'security_audit is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS security_audit_append_only ON "security_audit";
CREATE TRIGGER security_audit_append_only
BEFORE UPDATE OR DELETE ON "security_audit"
FOR EACH ROW EXECUTE FUNCTION prevent_security_audit_mutation();

-- Extra hardening for production deployments:
--   REVOKE UPDATE, DELETE ON TABLE "security_audit" FROM iuris_app;
-- The row_hash/previous_hash chain provides tamper evidence for out-of-band verification.
