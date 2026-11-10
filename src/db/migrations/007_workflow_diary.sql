-- Additive migration. Transaction managed by the migration runner.
CREATE TABLE IF NOT EXISTS module_business_hours (
 department_id uuid PRIMARY KEY REFERENCES department(id), revision integer NOT NULL CHECK(revision>0),
 active boolean NOT NULL, shifts jsonb NOT NULL CHECK(jsonb_typeof(shifts)='array'),
 actor_id uuid NOT NULL REFERENCES app_user(id), note text NOT NULL
);
CREATE TABLE IF NOT EXISTS module_diary_catalog (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), parent_id uuid REFERENCES module_diary_catalog(id),
 kind text NOT NULL CHECK(kind IN ('CADERNO','SECAO','SUBSECAO')), name text NOT NULL,
 position integer NOT NULL CHECK(position>=0), active boolean NOT NULL DEFAULT true,
 revision integer NOT NULL CHECK(revision>0), actor_id uuid NOT NULL REFERENCES app_user(id), note text NOT NULL
);
CREATE OR REPLACE FUNCTION module_configuration_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO audit_log(actor_type,actor_id,action,entity_type,entity_id,metadata)
 VALUES('USER',NEW.actor_id::text,TG_OP,TG_TABLE_NAME,coalesce(to_jsonb(NEW)->>'id',to_jsonb(NEW)->>'department_id'),
 jsonb_build_object('before',CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE NULL END,'after',to_jsonb(NEW)));
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS module_business_hours_audit ON module_business_hours;
CREATE TRIGGER module_business_hours_audit AFTER INSERT OR UPDATE ON module_business_hours FOR EACH ROW EXECUTE FUNCTION module_configuration_audit();
DROP TRIGGER IF EXISTS module_diary_catalog_audit ON module_diary_catalog;
CREATE TRIGGER module_diary_catalog_audit AFTER INSERT OR UPDATE ON module_diary_catalog FOR EACH ROW EXECUTE FUNCTION module_configuration_audit();
CREATE OR REPLACE FUNCTION module_diary_catalog_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent module_diary_catalog;
BEGIN
 -- Serialize all hierarchy writes, including concurrent reparenting.
 PERFORM pg_advisory_xact_lock(707007);
 IF TG_OP='UPDATE' AND NEW.kind<>OLD.kind THEN RAISE EXCEPTION 'Tipo hierárquico imutável'; END IF;
 IF NEW.kind='CADERNO' THEN
   IF NEW.parent_id IS NOT NULL THEN RAISE EXCEPTION 'Caderno não admite pai'; END IF;
 ELSE
   SELECT * INTO parent FROM module_diary_catalog WHERE id=NEW.parent_id FOR SHARE;
   IF parent.id IS NULL OR (NEW.kind='SECAO' AND parent.kind<>'CADERNO') OR (NEW.kind='SUBSECAO' AND parent.kind<>'SECAO') THEN RAISE EXCEPTION 'Hierarquia inválida'; END IF;
   IF NEW.active AND NOT parent.active THEN RAISE EXCEPTION 'Ative o pai primeiro'; END IF;
 END IF;
 IF NOT NEW.active AND EXISTS(SELECT 1 FROM module_diary_catalog WHERE parent_id=NEW.id AND active) THEN RAISE EXCEPTION 'Inative os descendentes primeiro'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS module_diary_catalog_guard ON module_diary_catalog;
CREATE TRIGGER module_diary_catalog_guard BEFORE INSERT OR UPDATE ON module_diary_catalog FOR EACH ROW EXECUTE FUNCTION module_diary_catalog_guard();
CREATE OR REPLACE FUNCTION module_diary_publication_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE act jsonb; node jsonb; previous_id text; expected text; current_node module_diary_catalog;
BEGIN
 IF NEW.family<>'diario' OR NEW.status<>'PUBLICADO' OR OLD.status='PUBLICADO' THEN RETURN NEW; END IF;
 PERFORM pg_advisory_xact_lock(707007);
 FOR act IN SELECT value FROM jsonb_array_elements(NEW.data->'publication') LOOP
  IF coalesce((act->>'withdrawn')::boolean,false) THEN CONTINUE; END IF;
  IF jsonb_typeof(act->'catalogPath') IS DISTINCT FROM 'array' OR jsonb_array_length(act->'catalogPath') NOT BETWEEN 1 AND 3 THEN RAISE EXCEPTION 'Classifique todos os atos no catálogo antes da publicação'; END IF;
  previous_id:=NULL; expected:='CADERNO';
  FOR node IN SELECT value FROM jsonb_array_elements(act->'catalogPath') LOOP
   SELECT * INTO current_node FROM module_diary_catalog WHERE id=(node->>'id')::uuid FOR SHARE;
   IF current_node.id IS NULL OR NOT current_node.active OR current_node.kind<>expected OR current_node.kind IS DISTINCT FROM node->>'kind' OR current_node.parent_id::text IS DISTINCT FROM previous_id OR current_node.parent_id::text IS DISTINCT FROM node->>'parentId' OR current_node.name IS DISTINCT FROM node->>'name' OR current_node.position IS DISTINCT FROM (node->>'position')::integer OR current_node.revision IS DISTINCT FROM (node->>'revision')::integer THEN RAISE EXCEPTION 'Catálogo alterado: reclassifique o ato antes de publicar'; END IF;
   previous_id:=current_node.id::text; expected:=CASE expected WHEN 'CADERNO' THEN 'SECAO' ELSE 'SUBSECAO' END;
  END LOOP;
  IF act->>'section' IS DISTINCT FROM concat_ws(' / ',act->'catalogPath'->0->>'name',act->'catalogPath'->1->>'name') OR coalesce(act->>'subsection','') IS DISTINCT FROM coalesce(act->'catalogPath'->2->>'name','') THEN RAISE EXCEPTION 'Rótulos divergentes do snapshot do catálogo'; END IF;
 END LOOP;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS module_diary_publication_guard ON module_record;
CREATE TRIGGER module_diary_publication_guard BEFORE UPDATE ON module_record FOR EACH ROW EXECUTE FUNCTION module_diary_publication_guard();
