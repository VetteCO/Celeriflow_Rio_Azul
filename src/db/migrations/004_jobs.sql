-- Apply after core and 002_modules.sql. No binaries are needed for migration/build.
CREATE TABLE IF NOT EXISTS business_counter (key text PRIMARY KEY, value integer NOT NULL);
CREATE OR REPLACE FUNCTION jobs_next_code() RETURNS text LANGUAGE plpgsql AS $$
DECLARE d text := to_char(now() AT TIME ZONE 'America/Sao_Paulo','YYYYMMDD'); n integer;
BEGIN
 INSERT INTO business_counter(key,value) VALUES('business:'||d,1)
 ON CONFLICT(key) DO UPDATE SET value=business_counter.value+1 WHERE business_counter.value<99999 RETURNING value INTO n;
 IF n IS NULL THEN RAISE EXCEPTION 'Limite diário de códigos atingido'; END IF;
 RETURN d||lpad(n::text,5,'0');
END $$;
CREATE TABLE IF NOT EXISTS document_job (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE DEFAULT jobs_next_code() CHECK(code ~ '^[0-9]{13}$'),
 owner_id uuid NOT NULL REFERENCES app_user(id), assignee_id uuid REFERENCES app_user(id),
 kind text NOT NULL CHECK(kind IN ('PDF','PDFA','OCR','ZIP')),
 status text NOT NULL DEFAULT 'QUEUED' CHECK(status IN ('QUEUED','RUNNING','RETRY','BLOCKED','SUCCEEDED','FAILED','EXPIRED')),
 idempotency_key text NOT NULL, request_hash text NOT NULL, payload jsonb NOT NULL,
 attempts integer NOT NULL DEFAULT 0, max_attempts integer NOT NULL DEFAULT 3 CHECK(max_attempts BETWEEN 1 AND 10),
 available_at timestamptz NOT NULL DEFAULT now(), lease_token uuid, lease_until timestamptz, error text,
 output_key text, output_type text, output_hash text, output_size integer, output_name text, expires_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(owner_id,idempotency_key)
);
CREATE INDEX IF NOT EXISTS document_job_queue_idx ON document_job(status,available_at,created_at);
ALTER TABLE document_job ADD COLUMN IF NOT EXISTS validation jsonb;
CREATE INDEX IF NOT EXISTS document_job_expiry_idx ON document_job(expires_at) WHERE output_key IS NOT NULL;
CREATE TABLE IF NOT EXISTS document_job_text (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), job_id uuid NOT NULL REFERENCES document_job(id) ON DELETE CASCADE,
 file_id uuid NOT NULL, source_id uuid NOT NULL, text text NOT NULL, UNIQUE(job_id,file_id)
);
CREATE INDEX IF NOT EXISTS document_job_text_search_idx ON document_job_text USING gin(to_tsvector('portuguese',text));
-- Register each attempted object before upload, so even a killed worker leaves a collectable object.
CREATE TABLE IF NOT EXISTS document_job_blob (
 pathname text PRIMARY KEY, job_id uuid NOT NULL REFERENCES document_job(id), expires_at timestamptz NOT NULL
);
