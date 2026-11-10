-- Additive completion of administration and document core. Never rewrite history.
ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE TABLE IF NOT EXISTS user_admin_department (
 user_id uuid NOT NULL REFERENCES app_user(id), department_id uuid NOT NULL REFERENCES department(id),
 PRIMARY KEY(user_id,department_id)
);
-- Preserve the previously managed subtree without granting document membership.
INSERT INTO user_admin_department(user_id,department_id)
 SELECT DISTINCT u.id,u.department_id FROM app_user u JOIN user_role ur ON ur.user_id=u.id JOIN role r ON r.id=ur.role_id
 WHERE r.name='ADMIN_LOCAL' AND u.department_id IS NOT NULL ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS document_access (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), document_id uuid NOT NULL REFERENCES document(id),
 user_id uuid NOT NULL REFERENCES app_user(id), department_id uuid REFERENCES department(id),
 accessed_at timestamp NOT NULL DEFAULT now(), ip text, user_agent text
);
CREATE INDEX IF NOT EXISTS document_access_document_time ON document_access(document_id,accessed_at,id);
