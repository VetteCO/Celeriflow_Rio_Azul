-- Additive migration. Apply once through the deployment migration runner.
CREATE TABLE IF NOT EXISTS business_counter (key text PRIMARY KEY, value integer NOT NULL);
CREATE OR REPLACE FUNCTION modules_next_code() RETURNS text LANGUAGE plpgsql AS $$
DECLARE d text := to_char(now() AT TIME ZONE 'America/Sao_Paulo','YYYYMMDD'); n integer;
BEGIN
  INSERT INTO business_counter(key,value) VALUES('business:'||d,1)
  ON CONFLICT(key) DO UPDATE SET value=business_counter.value+1 WHERE business_counter.value<99999 RETURNING value INTO n;
  IF n IS NULL THEN RAISE EXCEPTION 'Limite diário de códigos atingido'; END IF;
  RETURN d || lpad(n::text,5,'0');
END $$;
CREATE TABLE IF NOT EXISTS module_record (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL DEFAULT modules_next_code(),
 family text NOT NULL, title text NOT NULL, body text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'RASCUNHO',
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0), department_id uuid REFERENCES department(id),
 owner_id uuid NOT NULL REFERENCES app_user(id), actor_id uuid NOT NULL REFERENCES app_user(id),
 access text NOT NULL DEFAULT 'SETOR' CHECK(access IN ('SETOR','RESTRITO','PUBLICO')),
 participants jsonb NOT NULL DEFAULT '[]', data jsonb NOT NULL DEFAULT '{}',
 action text NOT NULL DEFAULT 'CRIADO', note text NOT NULL DEFAULT '',
 public_key uuid NOT NULL DEFAULT gen_random_uuid(), idempotency_key text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS module_record_code_uq ON module_record(code);
-- External authors are never represented as a municipal employee.
ALTER TABLE module_record ALTER COLUMN owner_id DROP NOT NULL;
ALTER TABLE module_record ALTER COLUMN actor_id DROP NOT NULL;
ALTER TABLE module_record ADD COLUMN IF NOT EXISTS external_owner_uid text;
ALTER TABLE module_record ADD COLUMN IF NOT EXISTS external_owner_email text;
ALTER TABLE module_record ADD COLUMN IF NOT EXISTS external_actor_uid text;
CREATE UNIQUE INDEX IF NOT EXISTS module_external_idempotency_uq ON module_record(external_owner_uid,idempotency_key);
CREATE UNIQUE INDEX IF NOT EXISTS module_record_key_uq ON module_record(public_key);
CREATE UNIQUE INDEX IF NOT EXISTS module_record_idempotency_uq ON module_record(owner_id,idempotency_key);
CREATE INDEX IF NOT EXISTS module_record_family_scope ON module_record(family,department_id,updated_at);
CREATE TABLE IF NOT EXISTS module_version (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), record_id uuid NOT NULL REFERENCES module_record(id),
 revision integer NOT NULL, actor_id uuid NOT NULL REFERENCES app_user(id), action text NOT NULL,
 note text NOT NULL, snapshot jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS module_version_revision_uq ON module_version(record_id,revision);
ALTER TABLE module_version ALTER COLUMN actor_id DROP NOT NULL;
CREATE TABLE IF NOT EXISTS module_file (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), record_id uuid NOT NULL REFERENCES module_record(id),
 actor_id uuid NOT NULL REFERENCES app_user(id), filename text NOT NULL, category text NOT NULL,
 storage_key text NOT NULL, mime_type text NOT NULL, size integer NOT NULL CHECK(size>0),
 sha256 text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE module_file ALTER COLUMN actor_id DROP NOT NULL;
ALTER TABLE module_file ADD COLUMN IF NOT EXISTS external_actor_uid text;
ALTER TABLE module_file ADD COLUMN IF NOT EXISTS external_visible boolean NOT NULL DEFAULT false;
CREATE OR REPLACE FUNCTION modules_guard_record() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Registros não podem ser excluídos'; END IF;
 IF OLD.status='PUBLICADO' THEN RAISE EXCEPTION 'Publicação imutável'; END IF;
 IF NEW.id<>OLD.id OR NEW.code<>OLD.code OR NEW.family<>OLD.family OR NEW.owner_id<>OLD.owner_id OR NEW.public_key<>OLD.public_key OR NEW.created_at<>OLD.created_at THEN
   RAISE EXCEPTION 'Identificação imutável';
 END IF;
 IF NEW.owner_id IS DISTINCT FROM OLD.owner_id OR NEW.external_owner_uid IS DISTINCT FROM OLD.external_owner_uid OR NEW.external_owner_email IS DISTINCT FROM OLD.external_owner_email THEN RAISE EXCEPTION 'Titular imutável'; END IF;
 IF NEW.revision<>OLD.revision+1 THEN RAISE EXCEPTION 'Revisão inválida'; END IF;
 NEW.updated_at=now(); RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS modules_guard ON module_record;
CREATE TRIGGER modules_guard BEFORE UPDATE OR DELETE ON module_record FOR EACH ROW EXECUTE FUNCTION modules_guard_record();
CREATE OR REPLACE FUNCTION modules_capture_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO module_version(record_id,revision,actor_id,action,note,snapshot)
 VALUES(NEW.id,NEW.revision,NEW.actor_id,NEW.action,NEW.note,to_jsonb(NEW));
 INSERT INTO audit_log(actor_type,actor_id,action,entity_type,entity_id,metadata)
 VALUES(CASE WHEN NEW.external_actor_uid IS NULL THEN 'USER' ELSE 'CITIZEN' END,coalesce(NEW.external_actor_uid,NEW.actor_id::text),'MODULE_' || NEW.action,'module_record',NEW.id::text,
   jsonb_build_object('family',NEW.family,'code',NEW.code,'revision',NEW.revision,'departmentId',NEW.department_id));
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS modules_version ON module_record;
CREATE TRIGGER modules_version AFTER INSERT OR UPDATE ON module_record FOR EACH ROW EXECUTE FUNCTION modules_capture_version();
CREATE OR REPLACE FUNCTION modules_deny_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Original e histórico imutáveis'; END $$;
DROP TRIGGER IF EXISTS modules_version_immutable ON module_version;
CREATE TRIGGER modules_version_immutable BEFORE UPDATE OR DELETE ON module_version FOR EACH ROW EXECUTE FUNCTION modules_deny_mutation();
DROP TRIGGER IF EXISTS modules_file_immutable ON module_file;
CREATE TRIGGER modules_file_immutable BEFORE UPDATE OR DELETE ON module_file FOR EACH ROW EXECUTE FUNCTION modules_deny_mutation();
CREATE TABLE IF NOT EXISTS module_mandate (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL DEFAULT modules_next_code() UNIQUE,
 principal_uid text NOT NULL, principal_email text NOT NULL, representative_email text NOT NULL,
 representative_uid text, families jsonb NOT NULL, record_ids jsonb NOT NULL DEFAULT '[]',
 permissions jsonb NOT NULL, consent text NOT NULL, starts_at timestamptz NOT NULL,
 expires_at timestamptz NOT NULL, accepted_at timestamptz, revoked_at timestamptz,
 actor_uid text NOT NULL, revision integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(expires_at>starts_at), CHECK(principal_email<>representative_email)
);
CREATE INDEX IF NOT EXISTS module_mandate_parties ON module_mandate(principal_uid,representative_uid);
CREATE OR REPLACE FUNCTION modules_mandate_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
   IF OLD.revoked_at IS NOT NULL OR NEW.principal_uid<>OLD.principal_uid OR NEW.principal_email<>OLD.principal_email
   OR NEW.representative_email<>OLD.representative_email OR NEW.families<>OLD.families OR NEW.record_ids<>OLD.record_ids
   OR NEW.permissions<>OLD.permissions OR NEW.consent<>OLD.consent OR NEW.starts_at<>OLD.starts_at OR NEW.expires_at<>OLD.expires_at
   OR NEW.revision<>OLD.revision+1 OR (OLD.representative_uid IS NOT NULL AND NEW.representative_uid IS DISTINCT FROM OLD.representative_uid)
   THEN RAISE EXCEPTION 'Mandato imutável; revogue e conceda nova autorização'; END IF;
 END IF;
 INSERT INTO audit_log(actor_type,actor_id,action,entity_type,entity_id,metadata)
 VALUES('CITIZEN',NEW.actor_uid,CASE WHEN NEW.revoked_at IS NOT NULL THEN 'MANDATE_REVOKED' WHEN NEW.accepted_at IS NOT NULL THEN 'MANDATE_ACCEPTED' ELSE 'MANDATE_GRANTED' END,'module_mandate',NEW.id::text,to_jsonb(NEW));
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS modules_mandate_audit ON module_mandate;
CREATE TRIGGER modules_mandate_audit AFTER INSERT OR UPDATE ON module_mandate FOR EACH ROW EXECUTE FUNCTION modules_mandate_event();
DROP TRIGGER IF EXISTS modules_mandate_no_delete ON module_mandate;
CREATE TRIGGER modules_mandate_no_delete BEFORE DELETE ON module_mandate FOR EACH ROW EXECUTE FUNCTION modules_deny_mutation();
