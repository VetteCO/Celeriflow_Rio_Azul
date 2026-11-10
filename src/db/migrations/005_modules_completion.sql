-- Additive completion; transaction belongs to the migration runner.
CREATE TABLE IF NOT EXISTS module_edit_lease (
 record_id uuid PRIMARY KEY REFERENCES module_record(id), actor_id uuid NOT NULL REFERENCES app_user(id),
 token_hash text NOT NULL, expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS module_anonymous_access (
 record_id uuid PRIMARY KEY REFERENCES module_record(id), token_hash text NOT NULL UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS module_sector_tag (
 record_id uuid REFERENCES module_record(id), department_id uuid REFERENCES department(id),
 label text NOT NULL CHECK(length(label) BETWEEN 1 AND 60), actor_id uuid NOT NULL REFERENCES app_user(id),
 PRIMARY KEY(record_id,department_id,label)
);
CREATE TABLE IF NOT EXISTS module_passcode (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), record_id uuid NOT NULL REFERENCES module_record(id),
 issuer_id uuid NOT NULL REFERENCES app_user(id), recipient_id uuid NOT NULL REFERENCES app_user(id),
 token_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL, used_at timestamptz, cancelled_at timestamptz
);
CREATE OR REPLACE FUNCTION modules_completion_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.action='EDITAR' AND NOT EXISTS (
 SELECT 1 FROM module_edit_lease WHERE record_id=NEW.id AND actor_id=NEW.actor_id AND expires_at>now() FOR SHARE
 ) THEN RAISE EXCEPTION 'Reserva de edição ausente ou vencida'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS modules_completion_edit_guard ON module_record;
CREATE TRIGGER modules_completion_edit_guard BEFORE UPDATE ON module_record FOR EACH ROW EXECUTE FUNCTION modules_completion_guard();
CREATE OR REPLACE FUNCTION modules_core_link_event() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE linked text;
BEGIN
 FOR linked IN SELECT jsonb_array_elements_text(coalesce(NEW.data->'coreDocumentIds','[]')) LOOP
 IF TG_OP='INSERT' OR NOT coalesce(OLD.data->'coreDocumentIds','[]') @> jsonb_build_array(linked) THEN
 INSERT INTO audit_log(actor_type,actor_id,action,entity_type,entity_id,metadata)
 VALUES('USER',NEW.actor_id::text,'MODULE_LINKED','document',linked,jsonb_build_object('moduleId',NEW.id,'revision',NEW.revision));
 INSERT INTO document_movement(document_id,action,note,visibility,actor_user_id)
 VALUES(linked::uuid,'MODULE_LINKED','Referência documental: /gestao/registros/'||NEW.id::text||'. Acesso sujeito à autorização do módulo.','INTERNAL',NEW.actor_id);
 END IF;
 END LOOP;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS modules_core_link_audit ON module_record;
CREATE TRIGGER modules_core_link_audit AFTER INSERT OR UPDATE ON module_record FOR EACH ROW EXECUTE FUNCTION modules_core_link_event();
CREATE OR REPLACE FUNCTION modules_capture_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO module_version(record_id,revision,actor_id,action,note,snapshot)
 VALUES(NEW.id,NEW.revision,NEW.actor_id,NEW.action,NEW.note,to_jsonb(NEW));
 INSERT INTO audit_log(actor_type,actor_id,action,entity_type,entity_id,metadata)
 VALUES(CASE WHEN NEW.external_actor_uid IS NOT NULL THEN 'CITIZEN' WHEN NEW.actor_id IS NOT NULL THEN 'USER' ELSE 'ANONYMOUS' END,
 coalesce(NEW.external_actor_uid,NEW.actor_id::text),'MODULE_'||NEW.action,'module_record',NEW.id::text,
 jsonb_build_object('family',NEW.family,'code',NEW.code,'revision',NEW.revision,'departmentId',NEW.department_id));
 RETURN NEW;
END $$;
