CREATE TABLE IF NOT EXISTS business_counter (key text PRIMARY KEY, value integer NOT NULL);
CREATE OR REPLACE FUNCTION operations_next_code() RETURNS text LANGUAGE plpgsql AS $$
DECLARE d text := to_char(current_timestamp AT TIME ZONE 'America/Sao_Paulo', 'YYYYMMDD'); n integer;
BEGIN
 INSERT INTO business_counter(key,value) VALUES('business:'||d,1) ON CONFLICT(key) DO UPDATE SET value=business_counter.value+1 WHERE business_counter.value<99999 RETURNING value INTO n;
 IF n IS NULL THEN RAISE EXCEPTION 'daily_business_code_exhausted'; END IF;
 RETURN d || lpad(n::text,5,'0');
END $$;
CREATE TABLE IF NOT EXISTS operation_course (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE DEFAULT operations_next_code() CHECK(code ~ '^[0-9]{13}$'),
 title text NOT NULL, module text NOT NULL, created_by_id uuid NOT NULL REFERENCES app_user(id), lessons jsonb NOT NULL, questions jsonb NOT NULL, pass_score integer NOT NULL DEFAULT 70 CHECK(pass_score BETWEEN 1 AND 100),
 published boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS operation_progress (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), course_id uuid NOT NULL REFERENCES operation_course(id), user_id uuid NOT NULL REFERENCES app_user(id),
 completed integer NOT NULL DEFAULT 0 CHECK(completed>=0), score integer CHECK(score BETWEEN 0 AND 100), certificate_code text UNIQUE CHECK(certificate_code ~ '^[0-9]{13}$'), certified_at timestamptz,
 CONSTRAINT operation_progress_user_course UNIQUE(user_id,course_id)
);
CREATE TABLE IF NOT EXISTS operation_ticket (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE DEFAULT operations_next_code() CHECK(code ~ '^[0-9]{13}$'),
 requester_id uuid NOT NULL REFERENCES app_user(id), subject text NOT NULL, severity text NOT NULL CHECK(severity IN ('CRITICAL','HIGH','NORMAL')),
 status text NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','IN_PROGRESS','ESCALATED','RESOLVED')), assignee_id uuid REFERENCES app_user(id), history jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), due_at timestamptz NOT NULL, resolved_at timestamptz, first_response_at timestamptz, rating integer CHECK(rating BETWEEN 1 AND 5)
);
CREATE INDEX IF NOT EXISTS operation_ticket_requester ON operation_ticket(requester_id,created_at);
CREATE TABLE IF NOT EXISTS operation_report (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE DEFAULT operations_next_code() CHECK(code ~ '^[0-9]{13}$'),
 created_by_id uuid NOT NULL REFERENCES app_user(id), period text NOT NULL, request_key text NOT NULL UNIQUE,
 snapshot jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION operations_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO audit_log(actor_type,actor_id,action,entity_type,entity_id,metadata)
 VALUES('USER',coalesce(to_jsonb(NEW)->'history'->-1->>'actor',to_jsonb(NEW)->>'user_id',to_jsonb(NEW)->>'created_by_id'),'OPERATIONS_'||TG_OP,TG_TABLE_NAME,NEW.id::text,
 CASE WHEN TG_TABLE_NAME='operation_ticket' THEN jsonb_build_object('code',to_jsonb(NEW)->>'code','status',to_jsonb(NEW)->>'status','lastEvent',to_jsonb(NEW)->'history'->-1)
 ELSE jsonb_build_object('record',to_jsonb(NEW)-'questions'-'lessons') END);
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS operation_course_audit ON operation_course;
CREATE TRIGGER operation_course_audit AFTER INSERT OR UPDATE ON operation_course FOR EACH ROW EXECUTE FUNCTION operations_audit();
DROP TRIGGER IF EXISTS operation_progress_audit ON operation_progress;
CREATE TRIGGER operation_progress_audit AFTER INSERT OR UPDATE ON operation_progress FOR EACH ROW EXECUTE FUNCTION operations_audit();
DROP TRIGGER IF EXISTS operation_ticket_audit ON operation_ticket;
CREATE TRIGGER operation_ticket_audit AFTER INSERT OR UPDATE ON operation_ticket FOR EACH ROW EXECUTE FUNCTION operations_audit();
DROP TRIGGER IF EXISTS operation_report_audit ON operation_report;
CREATE TRIGGER operation_report_audit AFTER INSERT OR UPDATE ON operation_report FOR EACH ROW EXECUTE FUNCTION operations_audit();
