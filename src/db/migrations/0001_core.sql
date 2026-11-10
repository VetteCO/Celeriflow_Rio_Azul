-- Additive migration. Execute against a backed-up target, never drizzle push/seed.
ALTER TABLE document ADD COLUMN IF NOT EXISTS business_code text UNIQUE;
ALTER TABLE document_movement ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'INTERNAL';
ALTER TABLE attachment ADD COLUMN IF NOT EXISTS citizen_visible boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS business_counter (key text PRIMARY KEY, value integer NOT NULL);
CREATE TABLE IF NOT EXISTS user_department (user_id uuid NOT NULL REFERENCES app_user(id), department_id uuid NOT NULL REFERENCES department(id));
CREATE UNIQUE INDEX IF NOT EXISTS user_department_unique ON user_department(user_id, department_id);
CREATE TABLE IF NOT EXISTS document_participation (document_id uuid NOT NULL REFERENCES document(id), department_id uuid NOT NULL REFERENCES department(id), state text NOT NULL DEFAULT 'PENDING', updated_at timestamp NOT NULL DEFAULT now());
CREATE UNIQUE INDEX IF NOT EXISTS document_participation_unique ON document_participation(document_id, department_id);
CREATE TABLE IF NOT EXISTS user_profile (user_id uuid PRIMARY KEY REFERENCES app_user(id), registration text, position text, preferences jsonb, leave_start timestamp, leave_end timestamp, last_access_at timestamp);
ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS phone text;
CREATE TABLE IF NOT EXISTS calendar_holiday (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), date text NOT NULL UNIQUE, title text NOT NULL);
INSERT INTO role(name) VALUES ('ADMIN_LOCAL'), ('NIVEL_1'), ('NIVEL_2'), ('AUDITOR') ON CONFLICT(name) DO NOTHING;
-- Preserve participation history; latest destination is pending/current, prior origins retained.
INSERT INTO document_participation(document_id, department_id, state)
SELECT id, origin_department_id, 'OPEN' FROM document WHERE origin_department_id IS NOT NULL
ON CONFLICT DO NOTHING;
INSERT INTO document_participation(document_id, department_id, state)
SELECT DISTINCT document_id, to_department_id, 'OPEN' FROM document_movement WHERE to_department_id IS NOT NULL
ON CONFLICT DO NOTHING;
INSERT INTO document_participation(document_id, department_id, state)
SELECT DISTINCT document_id, department_id, 'OPEN' FROM document_recipient WHERE department_id IS NOT NULL
ON CONFLICT DO NOTHING;
-- Infer the last known state only on initial migration; origin never becomes the current sector again by accident.
UPDATE document_participation p SET state = CASE
  WHEN d.status='ARCHIVED' THEN 'ARCHIVED'
  WHEN d.status='CONCLUDED' THEN 'CONCLUDED'
  WHEN (SELECT m.action FROM document_movement m WHERE m.document_id=p.document_id AND (m.from_department_id=p.department_id OR m.to_department_id=p.department_id) ORDER BY m.created_at DESC,m.id DESC LIMIT 1)='FORWARDED'
    AND (SELECT m.from_department_id FROM document_movement m WHERE m.document_id=p.document_id AND (m.from_department_id=p.department_id OR m.to_department_id=p.department_id) ORDER BY m.created_at DESC,m.id DESC LIMIT 1)=p.department_id THEN 'FORWARDED'
  ELSE p.state END
FROM document d WHERE d.id=p.document_id AND d.business_code IS NULL;
CREATE INDEX IF NOT EXISTS movement_document_order ON document_movement(document_id, created_at, id);
CREATE INDEX IF NOT EXISTS participation_department ON document_participation(department_id, document_id);
CREATE TABLE IF NOT EXISTS citizen_identity (cpf_cnpj text PRIMARY KEY, citizen_id uuid NOT NULL REFERENCES citizen(id));
INSERT INTO citizen_identity(cpf_cnpj,citizen_id)
SELECT DISTINCT ON (regexp_replace(cpf_cnpj, '\D', '', 'g')) regexp_replace(cpf_cnpj, '\D', '', 'g'), id FROM citizen ORDER BY regexp_replace(cpf_cnpj, '\D', '', 'g'), id
ON CONFLICT DO NOTHING;
