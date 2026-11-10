CREATE TABLE IF NOT EXISTS operation_report_job (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES app_user(id),
 request_key text NOT NULL, filters jsonb NOT NULL, format text NOT NULL CHECK(format IN('csv','pdf','xlsx')),
 status text NOT NULL DEFAULT 'QUEUED' CHECK(status IN('QUEUED','RUNNING','READY','FAILED','EXPIRED')),
 attempts integer NOT NULL DEFAULT 0, lease_token uuid, lease_until timestamptz,
 snapshot jsonb, output_key text, output_hash text, output_size bigint, error text,
 created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz, expires_at timestamptz,
 notified_at timestamptz, UNIQUE(owner_id,request_key),
 CHECK(status<>'READY' OR(snapshot IS NOT NULL AND output_key IS NOT NULL AND output_hash IS NOT NULL AND completed_at IS NOT NULL AND expires_at IS NOT NULL AND expires_at<=completed_at+interval '7 days'))
);
CREATE INDEX IF NOT EXISTS operation_report_job_queue ON operation_report_job(status,created_at);
CREATE INDEX IF NOT EXISTS operation_report_job_owner ON operation_report_job(owner_id,completed_at DESC);
CREATE TABLE IF NOT EXISTS operation_participation_history (
 id bigserial PRIMARY KEY, document_id uuid NOT NULL REFERENCES document(id), department_id uuid NOT NULL REFERENCES department(id),
 state text NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(), origin text NOT NULL
);
CREATE INDEX IF NOT EXISTS operation_participation_history_lookup ON operation_participation_history(document_id,department_id,recorded_at DESC,id DESC);
-- The initial observation is dated at migration time, never backdated to updated_at.
INSERT INTO operation_participation_history(document_id,department_id,state,origin)
 SELECT p.document_id,p.department_id,p.state,'INITIAL_OBSERVATION' FROM document_participation p
 WHERE NOT EXISTS(SELECT 1 FROM operation_participation_history h WHERE h.document_id=p.document_id AND h.department_id=p.department_id);
CREATE OR REPLACE FUNCTION operations_capture_participation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO operation_participation_history(document_id,department_id,state,origin) VALUES(NEW.document_id,NEW.department_id,NEW.state,'CHANGE');
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS operations_participation_insert ON document_participation;
CREATE TRIGGER operations_participation_insert AFTER INSERT ON document_participation FOR EACH ROW EXECUTE FUNCTION operations_capture_participation();
DROP TRIGGER IF EXISTS operations_participation_update ON document_participation;
CREATE TRIGGER operations_participation_update AFTER UPDATE OF state ON document_participation FOR EACH ROW WHEN(OLD.state IS DISTINCT FROM NEW.state) EXECUTE FUNCTION operations_capture_participation();
CREATE OR REPLACE FUNCTION operations_history_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Histórico operacional imutável'; END $$;
DROP TRIGGER IF EXISTS operation_participation_history_immutable ON operation_participation_history;
CREATE TRIGGER operation_participation_history_immutable BEFORE UPDATE OR DELETE ON operation_participation_history FOR EACH ROW EXECUTE FUNCTION operations_history_immutable();
CREATE TABLE IF NOT EXISTS operation_page_metric (
 source_type text NOT NULL CHECK(source_type IN('attachment','module_file','document_job')),
 source_id uuid NOT NULL, storage_key text NOT NULL, source_hash text NOT NULL DEFAULT '',
 content_hash text, pages integer CHECK(pages>0), bytes bigint, status text NOT NULL CHECK(status IN('KNOWN','UNREADABLE','UNSUPPORTED')),
 measured_at timestamptz NOT NULL DEFAULT now(), detail text,
 PRIMARY KEY(source_type,source_id,storage_key,source_hash),
 CHECK((status='KNOWN' AND pages IS NOT NULL AND pages>0 AND content_hash IS NOT NULL) OR(status<>'KNOWN' AND pages IS NULL))
);
CREATE OR REPLACE FUNCTION operations_report_job_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.owner_id<>OLD.owner_id OR NEW.request_key<>OLD.request_key OR NEW.filters<>OLD.filters OR NEW.format<>OLD.format OR NEW.created_at<>OLD.created_at THEN RAISE EXCEPTION 'Identidade do relatório imutável'; END IF;
 IF OLD.snapshot IS NOT NULL AND NEW.snapshot IS DISTINCT FROM OLD.snapshot THEN RAISE EXCEPTION 'Snapshot de relatório imutável'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS operation_report_job_guard ON operation_report_job;
CREATE TRIGGER operation_report_job_guard BEFORE UPDATE ON operation_report_job FOR EACH ROW EXECUTE FUNCTION operations_report_job_guard();
