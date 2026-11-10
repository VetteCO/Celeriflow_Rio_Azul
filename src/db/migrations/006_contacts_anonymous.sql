-- Additive migration; transaction is owned by the migration runner.
CREATE TABLE IF NOT EXISTS module_anonymous_operation (
 record_id uuid NOT NULL REFERENCES module_record(id), operation_id uuid NOT NULL,
 payload_hash text NOT NULL, result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(record_id,operation_id)
);
CREATE TABLE IF NOT EXISTS module_contact_profile (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, revision integer NOT NULL DEFAULT 1,
 definition jsonb NOT NULL, active boolean NOT NULL DEFAULT true, actor_id uuid NOT NULL REFERENCES app_user(id),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS module_contact_segment (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, description text NOT NULL DEFAULT '',
 revision integer NOT NULL DEFAULT 1, department_id uuid NOT NULL REFERENCES department(id),
 members jsonb NOT NULL DEFAULT '[]', actor_id uuid NOT NULL REFERENCES app_user(id), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS module_contact_legacy (
 contact_id uuid NOT NULL REFERENCES module_record(id), citizen_id uuid PRIMARY KEY REFERENCES citizen(id)
);
CREATE TABLE IF NOT EXISTS module_contact_merge (
 source_id uuid PRIMARY KEY REFERENCES module_record(id), target_id uuid NOT NULL REFERENCES module_record(id),
 actor_id uuid NOT NULL REFERENCES app_user(id), counts jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(source_id<>target_id)
);
CREATE TABLE IF NOT EXISTS module_citizen_alias (source_id uuid PRIMARY KEY REFERENCES citizen(id),target_id uuid NOT NULL REFERENCES citizen(id));
CREATE OR REPLACE FUNCTION modules_contact_config_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND NEW.revision<>OLD.revision+1 THEN RAISE EXCEPTION 'Revisão inválida'; END IF;
 INSERT INTO audit_log(actor_type,actor_id,action,entity_type,entity_id,metadata)
 VALUES('USER',NEW.actor_id::text,'CONTACT_CONFIG',TG_TABLE_NAME,NEW.id::text,
 jsonb_build_object('before',CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE NULL END,'after',to_jsonb(NEW)));
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS contact_profile_audit ON module_contact_profile;
CREATE TRIGGER contact_profile_audit AFTER INSERT OR UPDATE ON module_contact_profile FOR EACH ROW EXECUTE FUNCTION modules_contact_config_audit();
DROP TRIGGER IF EXISTS contact_segment_audit ON module_contact_segment;
CREATE TRIGGER contact_segment_audit AFTER INSERT OR UPDATE ON module_contact_segment FOR EACH ROW EXECUTE FUNCTION modules_contact_config_audit();
DROP TRIGGER IF EXISTS contact_merge_immutable ON module_contact_merge;
CREATE TRIGGER contact_merge_immutable BEFORE UPDATE OR DELETE ON module_contact_merge FOR EACH ROW EXECUTE FUNCTION modules_deny_mutation();
DROP TRIGGER IF EXISTS anonymous_operation_immutable ON module_anonymous_operation;
CREATE TRIGGER anonymous_operation_immutable BEFORE UPDATE OR DELETE ON module_anonymous_operation FOR EACH ROW EXECUTE FUNCTION modules_deny_mutation();

-- Only current, structured references are rewritten. Text and historical snapshots never are.
CREATE OR REPLACE FUNCTION modules_contact_refs(value jsonb, source text, target text, context_key text DEFAULT '') RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE answer jsonb; k text; v jsonb;
BEGIN
 IF jsonb_typeof(value)='object' THEN
  answer='{}';
  FOR k,v IN SELECT * FROM jsonb_each(value) LOOP
   IF k IN ('publication','messages','identity','blocks','evaluation','signatures','acknowledgements') THEN answer=answer||jsonb_build_object(k,v);
    ELSE answer=answer||jsonb_build_object(k,modules_contact_refs(v,source,target,CASE WHEN context_key='refs' AND k IN ('id','recordId','moduleId') THEN 'contactId' ELSE k END)); END IF;
  END LOOP; RETURN answer;
 ELSIF jsonb_typeof(value)='array' THEN
  SELECT coalesce(jsonb_agg(modules_contact_refs(x,source,target,context_key)),'[]') INTO answer FROM jsonb_array_elements(value) x;
  RETURN answer;
 ELSIF value=to_jsonb(source) AND context_key IN
  ('linkedIds','refs','contactIds','contactId','contatoId','contatos','destinatario','outorgante','outorgado','organizacao','proprietario','responsavel','candidato','autor','cadastroPrincipal') THEN RETURN to_jsonb(target);
 END IF;
 RETURN value;
END $$;

CREATE OR REPLACE FUNCTION modules_merge_contacts(source uuid,target uuid,source_revision integer,target_revision integer,actor uuid,sectors jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE s module_record; t module_record; r module_record; n integer:=0; lists integer:=0; requests integer:=0; identities integer:=0; legacy integer:=0; c jsonb; sc uuid; tc uuid;
BEGIN
 -- Serializes contact merges and current-link writers; no partial migration is visible.
 LOCK TABLE module_record IN SHARE ROW EXCLUSIVE MODE;
 LOCK TABLE module_contact_segment IN SHARE ROW EXCLUSIVE MODE;
 LOCK TABLE module_contact_legacy IN SHARE ROW EXCLUSIVE MODE;
 LOCK TABLE external_request IN SHARE ROW EXCLUSIVE MODE;
 LOCK TABLE citizen_identity IN SHARE ROW EXCLUSIVE MODE;
 SELECT * INTO s FROM module_record WHERE id=source FOR UPDATE;
 SELECT * INTO t FROM module_record WHERE id=target FOR UPDATE;
 IF s.id IS NULL OR t.id IS NULL OR source=target OR s.family<>'contatos' OR t.family<>'contatos'
 OR (s.status='UNIFICADO' AND (s.data->'values'->>'cadastroPrincipal' IS DISTINCT FROM target::text OR EXISTS(SELECT 1 FROM module_contact_merge WHERE source_id=source)))
 OR t.status='UNIFICADO' OR s.revision<>source_revision OR t.revision<>target_revision THEN RAISE EXCEPTION 'Contatos ou revisões inválidos'; END IF;
  IF NOT coalesce((s.owner_id=actor OR (s.access<>'RESTRITO' AND (sectors ? s.department_id::text OR s.participants ?| ARRAY(SELECT jsonb_array_elements_text(sectors))))),false)
 OR NOT coalesce((t.owner_id=actor OR (t.access<>'RESTRITO' AND (sectors ? t.department_id::text OR t.participants ?| ARRAY(SELECT jsonb_array_elements_text(sectors))))),false) THEN RAISE EXCEPTION 'Contatos fora do escopo'; END IF;
  FOR r IN SELECT * FROM module_record WHERE id<>source AND status<>'UNIFICADO' AND data IS DISTINCT FROM modules_contact_refs(data,source::text,target::text) ORDER BY id LOOP
  IF r.status='PUBLICADO' THEN RAISE EXCEPTION 'Vínculo em publicação imutável exige tratamento arquivístico'; END IF;
  UPDATE module_record SET data=modules_contact_refs(data,source::text,target::text),revision=revision+1,
   actor_id=actor,external_actor_uid=NULL,action='CONTATO_VINCULO_UNIFICADO',note='Unificação de referência cadastral' WHERE id=r.id;
  n=n+1;
 END LOOP;
 UPDATE module_contact_segment SET members=(SELECT jsonb_agg(DISTINCT CASE WHEN x=source::text THEN target::text ELSE x END) FROM jsonb_array_elements_text(members) x),revision=revision+1,actor_id=actor,updated_at=now() WHERE members ? source::text;
 GET DIAGNOSTICS lists=ROW_COUNT;
 SELECT citizen_id INTO tc FROM module_contact_legacy WHERE contact_id=target ORDER BY citizen_id LIMIT 1;
 IF tc IS NOT NULL THEN
  FOR sc IN SELECT citizen_id FROM module_contact_legacy WHERE contact_id=source LOOP
   IF (SELECT regexp_replace(cpf_cnpj,'\D','','g') FROM citizen WHERE id=sc) IS DISTINCT FROM (SELECT regexp_replace(cpf_cnpj,'\D','','g') FROM citizen WHERE id=tc) THEN RAISE EXCEPTION 'Identidades fiscais legadas distintas não podem ser unificadas'; END IF;
   UPDATE external_request SET citizen_id=tc WHERE citizen_id=sc; GET DIAGNOSTICS legacy=ROW_COUNT; requests=requests+legacy;
   UPDATE citizen_identity SET citizen_id=tc WHERE citizen_id=sc; GET DIAGNOSTICS legacy=ROW_COUNT; identities=identities+legacy;
   INSERT INTO module_citizen_alias(source_id,target_id) VALUES(sc,tc) ON CONFLICT(source_id) DO UPDATE SET target_id=excluded.target_id;
  END LOOP;
 END IF;
 UPDATE module_contact_legacy SET contact_id=target WHERE contact_id=source; GET DIAGNOSTICS legacy=ROW_COUNT;
 UPDATE module_record SET data=jsonb_set(data,'{values}',coalesce(data->'values','{}')||jsonb_build_object('cadastroPrincipal',target::text)),
 status='UNIFICADO',revision=revision+1,actor_id=actor,external_actor_uid=NULL,action='CONTATO_UNIFICADO',note='Cadastro original preservado' WHERE id=source;
 -- Also version the survivor even if no incoming module reference changed it.
 UPDATE module_record SET revision=revision+1,actor_id=actor,external_actor_uid=NULL,action='CONTATO_PRINCIPAL',note='Recebeu vínculos de cadastro unificado' WHERE id=target;
 c=jsonb_build_object('records',n,'segments',lists,'legacyLinks',legacy,'externalRequests',requests,'citizenIdentities',identities);
 INSERT INTO module_contact_merge(source_id,target_id,actor_id,counts) VALUES(source,target,actor,c);
 INSERT INTO audit_log(actor_type,actor_id,action,entity_type,entity_id,metadata) VALUES('USER',actor::text,'CONTACT_MERGED','module_record',source::text,jsonb_build_object('target',target,'counts',c));
 RETURN c;
END $$;

CREATE OR REPLACE FUNCTION modules_contact_canonical_refs() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE m record;
BEGIN
 IF TG_OP='UPDATE' AND OLD.family='contatos' AND OLD.status='UNIFICADO' AND NEW.action<>'CONTATO_UNIFICADO' THEN RAISE EXCEPTION 'Cadastro unificado preservado; edite o principal'; END IF;
 IF NEW.action='UNIFICAR_CONTATO' THEN RAISE EXCEPTION 'Utilize a operação transacional de unificação de contatos'; END IF;
 FOR m IN SELECT source_id,target_id FROM module_contact_merge ORDER BY created_at LOOP
  NEW.data=modules_contact_refs(NEW.data,m.source_id::text,m.target_id::text);
 END LOOP;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS contact_canonical_refs ON module_record;
CREATE TRIGGER contact_canonical_refs BEFORE INSERT OR UPDATE ON module_record FOR EACH ROW EXECUTE FUNCTION modules_contact_canonical_refs();
CREATE OR REPLACE FUNCTION modules_citizen_canonical() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE destination uuid; hops integer:=0;
BEGIN
 LOOP
  SELECT target_id INTO destination FROM module_citizen_alias WHERE source_id=NEW.citizen_id;
  EXIT WHEN destination IS NULL;
  NEW.citizen_id=destination; hops=hops+1;
  IF hops>100 THEN RAISE EXCEPTION 'Ciclo cadastral'; END IF;
 END LOOP; RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS contact_canonical_request ON external_request;
CREATE TRIGGER contact_canonical_request BEFORE INSERT OR UPDATE OF citizen_id ON external_request FOR EACH ROW EXECUTE FUNCTION modules_citizen_canonical();
DROP TRIGGER IF EXISTS contact_canonical_identity ON citizen_identity;
CREATE TRIGGER contact_canonical_identity BEFORE INSERT OR UPDATE OF citizen_id ON citizen_identity FOR EACH ROW EXECUTE FUNCTION modules_citizen_canonical();

CREATE OR REPLACE FUNCTION modules_contact_save(contact uuid, expected integer, actor uuid, sector uuid, sectors jsonb, subject text, content jsonb, profile uuid, profile_revision integer, request_id uuid, fingerprint text) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE r module_record; p module_contact_profile; v jsonb; other module_record;
BEGIN
 LOCK TABLE module_record IN SHARE ROW EXCLUSIVE MODE;
 IF contact IS NULL AND request_id IS NOT NULL THEN
  SELECT * INTO other FROM module_record WHERE owner_id=actor AND idempotency_key=request_id::text;
  IF other.id IS NOT NULL THEN
   IF other.family<>'contatos' OR other.data->>'syncHash' IS DISTINCT FROM fingerprint THEN RAISE EXCEPTION 'Identificador reutilizado com outro conteúdo'; END IF;
   RETURN other.id;
  END IF;
 END IF;
 SELECT * INTO p FROM module_contact_profile WHERE id=profile AND revision=profile_revision AND active FOR SHARE;
 IF p.id IS NULL THEN RAISE EXCEPTION 'Perfil atualizado'; END IF;
 v=content->'values';
 IF coalesce(v->>'cpfCnpj','')='' AND coalesce(v->>'email','')='' AND coalesce(v->>'phone','')='' THEN RAISE EXCEPTION 'Informe ao menos um identificador'; END IF;
 IF EXISTS(SELECT 1 FROM module_record m WHERE family='contatos' AND status<>'UNIFICADO' AND (contact IS NULL OR id<>contact) AND (
 (coalesce(v->>'cpfCnpj','')<>'' AND regexp_replace(m.data->'values'->>'cpfCnpj','\D','','g')=regexp_replace(v->>'cpfCnpj','\D','','g')) OR
 (coalesce(v->>'email','')<>'' AND lower(trim(m.data->'values'->>'email'))=lower(trim(v->>'email'))) OR
 (coalesce(v->>'phone','')<>'' AND regexp_replace(m.data->'values'->>'phone','\D','','g')=regexp_replace(v->>'phone','\D','','g')))) THEN RAISE EXCEPTION 'Contato duplicado; utilize a unificação'; END IF;
 IF contact IS NULL THEN
  INSERT INTO module_record(family,title,owner_id,actor_id,department_id,participants,data,action,idempotency_key)
  VALUES('contatos',subject,actor,actor,sector,CASE WHEN sector IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(sector) END,content||jsonb_build_object('syncHash',fingerprint),'CONTATO_CRIADO',request_id::text) RETURNING id INTO contact;
 ELSE
  SELECT * INTO r FROM module_record WHERE id=contact FOR UPDATE;
  IF r.id IS NULL OR r.family<>'contatos' OR r.status='UNIFICADO' OR r.revision<>expected OR NOT coalesce((r.owner_id=actor OR (r.access<>'RESTRITO' AND (sectors ? r.department_id::text OR r.participants ?| ARRAY(SELECT jsonb_array_elements_text(sectors))))),false) THEN RAISE EXCEPTION 'Contato atualizado ou fora do escopo'; END IF;
  UPDATE module_record SET title=subject,data=content,revision=revision+1,actor_id=actor,external_actor_uid=NULL,action='CONTATO_EDITADO',note='' WHERE id=contact;
 END IF;
 RETURN contact;
END $$;
CREATE OR REPLACE FUNCTION modules_contact_segment_save(segment uuid,expected integer,actor uuid,sectors jsonb,sector uuid,subject text,description_text text,contacts jsonb) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE r module_record; member text;
BEGIN
 LOCK TABLE module_record IN SHARE MODE;
 IF NOT sectors ? sector::text THEN RAISE EXCEPTION 'Setor não autorizado'; END IF;
 FOR member IN SELECT jsonb_array_elements_text(contacts) LOOP
  SELECT * INTO r FROM module_record WHERE id=member::uuid AND family='contatos' AND status<>'UNIFICADO';
   IF r.id IS NULL OR NOT coalesce((r.owner_id=actor OR (r.access<>'RESTRITO' AND (sectors ? r.department_id::text OR r.participants ?| ARRAY(SELECT jsonb_array_elements_text(sectors))))),false) THEN RAISE EXCEPTION 'Contato indisponível'; END IF;
 END LOOP;
 IF segment IS NULL THEN
  INSERT INTO module_contact_segment(name,description,department_id,members,actor_id) VALUES(subject,description_text,sector,contacts,actor) RETURNING id INTO segment;
 ELSE
  UPDATE module_contact_segment SET name=subject,description=description_text,members=contacts,actor_id=actor,revision=revision+1,updated_at=now()
   WHERE id=segment AND revision=expected AND department_id=sector AND sectors ? department_id::text;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lista atualizada ou fora do escopo'; END IF;
 END IF;
 RETURN segment;
END $$;
CREATE OR REPLACE FUNCTION modules_contact_link_legacy(contact uuid,citizen uuid,expected integer,actor uuid,sectors jsonb) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE r module_record; fiscal text;
BEGIN
 SELECT * INTO r FROM module_record WHERE id=contact AND family='contatos' AND status<>'UNIFICADO' AND revision=expected FOR UPDATE;
 IF NOT coalesce((r.owner_id=actor OR (r.access<>'RESTRITO' AND (sectors ? r.department_id::text OR r.participants ?| ARRAY(SELECT jsonb_array_elements_text(sectors))))),false) THEN RAISE EXCEPTION 'Contato fora do escopo'; END IF;
 SELECT regexp_replace(cpf_cnpj,'\D','','g') INTO fiscal FROM citizen c WHERE c.id=citizen FOR SHARE;
 IF r.id IS NULL OR fiscal IS NULL OR fiscal='' OR fiscal IS DISTINCT FROM regexp_replace(r.data->'values'->>'cpfCnpj','\D','','g') THEN RAISE EXCEPTION 'Vínculo exige mesmo CPF/CNPJ e revisão atual'; END IF;
 INSERT INTO module_contact_legacy(contact_id,citizen_id) VALUES(contact,citizen) ON CONFLICT(citizen_id) DO NOTHING;
 IF NOT EXISTS(SELECT 1 FROM module_contact_legacy WHERE citizen_id=citizen AND contact_id=contact) THEN RAISE EXCEPTION 'Cadastro legado já vinculado a outro contato'; END IF;
 UPDATE module_record SET revision=revision+1,actor_id=actor,external_actor_uid=NULL,action='CONTATO_LEGADO_VINCULADO',note='' WHERE id=contact;
 INSERT INTO audit_log(actor_type,actor_id,action,entity_type,entity_id,metadata) VALUES('USER',actor::text,'CONTACT_LEGACY_LINK','module_record',contact::text,jsonb_build_object('citizenId',citizen));
 RETURN true;
END $$;

CREATE OR REPLACE FUNCTION modules_anonymous_write(token text, operation uuid, fingerprint text, expected integer, command text, payload jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r module_record; previous module_anonymous_operation; d jsonb; result jsonb; fid uuid; total bigint;
BEGIN
 SELECT m.* INTO r FROM module_record m JOIN module_anonymous_access a ON a.record_id=m.id
 WHERE a.token_hash=token AND m.family='ouvidoria' AND m.data->'values'->>'modalidade'='Anônima' FOR UPDATE OF m;
 IF r.id IS NULL THEN RAISE EXCEPTION 'Chave inválida'; END IF;
 SELECT * INTO previous FROM module_anonymous_operation WHERE record_id=r.id AND operation_id=operation;
 IF previous.record_id IS NOT NULL THEN
  IF previous.payload_hash<>fingerprint THEN RAISE EXCEPTION 'Identificador reutilizado com outro conteúdo'; END IF;
  RETURN previous.result;
 END IF;
 IF r.revision<>expected THEN RAISE EXCEPTION 'Manifestação atualizada; consulte novamente'; END IF;
 d=r.data;
 IF command='SUBMIT' THEN
  IF r.status<>'RASCUNHO' THEN RAISE EXCEPTION 'Manifestação já protocolada'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(coalesce(d->'workflow'->'requiredFiles','[]')) x WHERE NOT EXISTS(SELECT 1 FROM module_file f WHERE f.record_id=r.id AND f.category=x)) THEN RAISE EXCEPTION 'Envie os anexos obrigatórios'; END IF;
  d=jsonb_set(d,'{dueAt}',payload->'dueAt');
 ELSIF command='REPLY' THEN
  IF r.status<>'EM_ANDAMENTO' THEN RAISE EXCEPTION 'Manifestação encerrada'; END IF;
  d=jsonb_set(d,'{messages}',coalesce(d->'messages','[]')||jsonb_build_array(jsonb_build_object('text',payload->>'text','visibility','EXTERNA','actorId','INTERESSADO','at',now())));
 ELSIF command='EVALUATE' THEN
  IF r.status NOT IN ('CONCLUIDO','DEFERIDO','INDEFERIDO','ARQUIVADO') THEN RAISE EXCEPTION 'Avalie após a conclusão'; END IF;
  IF d->'workflow' IS NOT NULL AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(coalesce(d->'workflow'->'steps'->(coalesce((d->>'step')::integer,0))->'departments','[]')) x WHERE NOT coalesce(d->'completedDepartments','[]') ? x) THEN RAISE EXCEPTION 'Há setores pendentes'; END IF;
  IF (payload->>'score')::integer NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'Nota inválida'; END IF;
  d=jsonb_set(d,'{evaluation}',jsonb_build_object('score',(payload->>'score')::integer,'comment',payload->>'text','at',now(),'cycle',coalesce((d->>'evaluationCycle')::integer,0)));
 ELSIF command='FILE' THEN
  IF r.status NOT IN ('RASCUNHO','EM_ANDAMENTO') THEN RAISE EXCEPTION 'Manifestação encerrada'; END IF;
  SELECT count(*) INTO total FROM module_file WHERE record_id=r.id;
  IF total>=20 THEN RAISE EXCEPTION 'Limite de 20 anexos atingido'; END IF;
  SELECT coalesce(sum(size),0) INTO total FROM module_file WHERE record_id=r.id;
  IF total+(payload->>'size')::integer>52428800 THEN RAISE EXCEPTION 'Limite total de 50 MB atingido'; END IF;
  fid=(payload->>'id')::uuid;
  INSERT INTO module_file(id,record_id,filename,category,storage_key,mime_type,size,sha256,external_visible)
  VALUES(fid,r.id,payload->>'filename',payload->>'category',payload->>'storageKey',payload->>'mimeType',(payload->>'size')::integer,payload->>'sha256',true);
 ELSE RAISE EXCEPTION 'Operação inválida'; END IF;
 UPDATE module_record SET data=d,status=CASE WHEN command='SUBMIT' THEN 'EM_ANDAMENTO' ELSE status END,revision=revision+1,actor_id=NULL,external_actor_uid=NULL,action='ANONIMO_'||command,note='' WHERE id=r.id;
 result=jsonb_build_object('saved',true,'revision',r.revision+1,'fileId',fid);
 INSERT INTO module_anonymous_operation(record_id,operation_id,payload_hash,result) VALUES(r.id,operation,fingerprint,result);
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION modules_anonymous_create(token text, fingerprint text, flow_id uuid, flow_revision integer, subject text, narrative text, initial_data jsonb) RETURNS text LANGUAGE plpgsql AS $$
DECLARE r module_record; f module_record; sectors jsonb;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(token,0));
 SELECT m.* INTO r FROM module_record m JOIN module_anonymous_access a ON a.record_id=m.id WHERE a.token_hash=token;
 IF r.id IS NOT NULL THEN
  IF r.data->>'syncHash'<>fingerprint THEN RAISE EXCEPTION 'Chave já utilizada com outro conteúdo'; END IF;
  RETURN r.code;
 END IF;
 SELECT * INTO f FROM module_record WHERE id=flow_id AND revision=flow_revision AND family='fluxos' AND status='ATIVO'
 AND data->'values'->>'anonymousEnabled'='Sim' AND data->'workflow'->>'family'='ouvidoria' FOR SHARE;
 IF f.id IS NULL THEN RAISE EXCEPTION 'Assunto indisponível'; END IF;
 sectors=f.data->'workflow'->'steps'->0->'departments';
 IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(sectors) x WHERE NOT EXISTS(SELECT 1 FROM department WHERE id=x::uuid AND active)) THEN RAISE EXCEPTION 'Setor indisponível'; END IF;
 sectors=sectors||jsonb_build_array(f.data->'workflow'->>'identityDepartmentId');
 INSERT INTO module_record(family,title,body,status,department_id,participants,data,action)
 VALUES('ouvidoria',subject,narrative,'RASCUNHO',(sectors->>0)::uuid,sectors,initial_data||jsonb_build_object('syncHash',fingerprint),'ANONIMO_RASCUNHO') RETURNING * INTO r;
 INSERT INTO module_anonymous_access(record_id,token_hash) VALUES(r.id,token);
 RETURN r.code;
END $$;
