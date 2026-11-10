-- Base estrutural anterior à 0001. Exclusiva para banco vazio.
-- Sem dados pessoais, contas, documentos ou credenciais.
CREATE TYPE document_type AS ENUM ('MEMORANDUM','OFICIO','CIRCULAR','EXTERNAL_REQUEST','DISPATCH','OTHER');
CREATE TYPE document_status AS ENUM ('DRAFT','OPEN','IN_TRANSIT','CONCLUDED','ARCHIVED');
CREATE TYPE email_direction AS ENUM ('OUTBOUND','INBOUND');
CREATE TABLE organization (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, cnpj text);
CREATE TABLE department (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), parent_id uuid, name text NOT NULL, acronym text, active boolean NOT NULL DEFAULT true);
CREATE TABLE app_user (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, cpf text, email text NOT NULL UNIQUE, firebase_uid text UNIQUE, external_auth_id text, department_id uuid REFERENCES department(id), active boolean NOT NULL DEFAULT true);
CREATE TABLE role (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL UNIQUE);
INSERT INTO role(name) VALUES ('ADMIN_GERAL'), ('NIVEL_3_VISUALIZACAO');
CREATE TABLE permission (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE);
CREATE TABLE user_role (user_id uuid NOT NULL REFERENCES app_user(id), role_id uuid NOT NULL REFERENCES role(id));
CREATE TABLE citizen (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, cpf_cnpj text NOT NULL, email text NOT NULL, phone text, cep text, street text, number text, complement text, district text, city text, state text);
CREATE TABLE document (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), type document_type NOT NULL, number integer NOT NULL,
 year integer NOT NULL, subject text NOT NULL, body text NOT NULL DEFAULT '', status document_status NOT NULL DEFAULT 'DRAFT',
 access_level text NOT NULL DEFAULT 'INTERNAL', origin_department_id uuid REFERENCES department(id),
 created_by_id uuid REFERENCES app_user(id), urgency text, public_key text NOT NULL UNIQUE, created_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX document_type_year_number_unique ON document(type,year,number);
CREATE TABLE document_deadline (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), document_id uuid NOT NULL REFERENCES document(id), title text NOT NULL, due_at timestamp NOT NULL, status text NOT NULL DEFAULT 'PENDING');
CREATE TABLE document_recipient (document_id uuid NOT NULL REFERENCES document(id), department_id uuid REFERENCES department(id), user_id uuid REFERENCES app_user(id), recipient_type text NOT NULL DEFAULT 'TO');
CREATE TABLE document_read_receipt (document_id uuid NOT NULL REFERENCES document(id), user_id uuid NOT NULL REFERENCES app_user(id), first_read_at timestamp NOT NULL DEFAULT now(), last_read_at timestamp);
CREATE UNIQUE INDEX read_receipt_doc_user_unique ON document_read_receipt(document_id,user_id);
CREATE TABLE document_movement (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), document_id uuid NOT NULL REFERENCES document(id), from_department_id uuid REFERENCES department(id), to_department_id uuid REFERENCES department(id), action text NOT NULL, note text, actor_user_id uuid REFERENCES app_user(id), created_at timestamp NOT NULL DEFAULT now());
CREATE TABLE attachment (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), document_id uuid NOT NULL REFERENCES document(id), filename text NOT NULL, mime_type text, storage_key text NOT NULL, size integer, created_at timestamp NOT NULL DEFAULT now());
CREATE TABLE external_request (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), citizen_id uuid NOT NULL REFERENCES citizen(id), document_id uuid NOT NULL REFERENCES document(id), protocol_number text NOT NULL UNIQUE, public_key text NOT NULL UNIQUE, request_type text, created_at timestamp NOT NULL DEFAULT now());
CREATE TABLE email_message (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), document_id uuid REFERENCES document(id), direction email_direction NOT NULL, provider_message_id text UNIQUE, from_addr text NOT NULL, to_addr text NOT NULL, subject text, body_text text, body_html text, reply_token text UNIQUE, status text NOT NULL DEFAULT 'PENDING', sent_at timestamp, received_at timestamp);
CREATE TABLE audit_log (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_type text NOT NULL, actor_id text, action text NOT NULL, entity_type text NOT NULL, entity_id text, metadata jsonb, created_at timestamp NOT NULL DEFAULT now());
