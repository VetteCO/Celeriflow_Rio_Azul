-- 006/007 are applied and immutable. Transaction belongs to the migration runner.
CREATE TABLE IF NOT EXISTS module_contact_account (
 uid text PRIMARY KEY, citizen_id uuid NOT NULL UNIQUE REFERENCES citizen(id),
 contact_id uuid NOT NULL UNIQUE REFERENCES module_record(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION modules_contact_account_merge() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a module_contact_account; destination uuid; candidate uuid; email text;
BEGIN
 IF (SELECT count(*) FROM module_contact_account WHERE contact_id IN(NEW.source_id,NEW.target_id))>1 THEN RAISE EXCEPTION 'Contas titulares distintas exigem conciliação de identidade'; END IF;
 SELECT * INTO a FROM module_contact_account WHERE contact_id=NEW.source_id FOR UPDATE;
 IF a.uid IS NULL THEN RETURN NEW; END IF;
 SELECT c.email INTO email FROM citizen c WHERE id=a.citizen_id;
 IF EXISTS(SELECT 1 FROM module_record WHERE id=NEW.target_id AND external_owner_uid IS NOT NULL AND external_owner_uid<>a.uid) THEN RAISE EXCEPTION 'Titular da conta incompatível com o principal'; END IF;
 destination=a.citizen_id;
 LOOP SELECT target_id INTO candidate FROM module_citizen_alias WHERE source_id=destination; EXIT WHEN candidate IS NULL; destination=candidate; END LOOP;
 IF lower(email) IS DISTINCT FROM (SELECT lower(c.email) FROM citizen c WHERE id=destination) THEN RAISE EXCEPTION 'E-mail do titular incompatível'; END IF;
 UPDATE module_contact_account SET contact_id=NEW.target_id,citizen_id=destination WHERE uid=a.uid;
 INSERT INTO audit_log(actor_type,actor_id,action,entity_type,entity_id,metadata) VALUES('USER',NEW.actor_id::text,'CONTACT_ACCOUNT_MERGED','module_record',NEW.target_id::text,jsonb_build_object('source',NEW.source_id,'citizenId',destination));
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS contact_account_merge ON module_contact_merge;
CREATE TRIGGER contact_account_merge AFTER INSERT ON module_contact_merge FOR EACH ROW EXECUTE FUNCTION modules_contact_account_merge();

-- Session UID/e-mail are supplied only by the verified Firebase session, never request JSON.
CREATE OR REPLACE FUNCTION modules_external_contact_save(account_uid text, verified_email text, profile uuid, profile_revision integer, expected integer, person_name text, submitted jsonb, address_data jsonb) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE p module_contact_profile; c citizen; r module_record; binding module_contact_account; cid uuid; rid uuid; intake uuid; fiscal text; current_fiscal text; count_matches integer;
BEGIN
 PERFORM pg_advisory_xact_lock(20261110,42);
 LOCK TABLE module_record IN SHARE ROW EXCLUSIVE MODE;
 SELECT * INTO p FROM module_contact_profile WHERE id=profile AND revision=profile_revision AND active FOR SHARE;
 IF p.id IS NULL THEN RAISE EXCEPTION 'Perfil atualizado ou indisponível'; END IF;
 SELECT * INTO binding FROM module_contact_account WHERE uid=account_uid FOR UPDATE;
 IF binding.uid IS NOT NULL THEN
  SELECT * INTO c FROM citizen WHERE id=binding.citizen_id FOR UPDATE;
  IF lower(c.email)<>lower(verified_email) THEN RAISE EXCEPTION 'Titularidade cadastral exige conciliação'; END IF;
  rid=binding.contact_id;
 ELSE
  SELECT count(*) INTO count_matches FROM citizen WHERE lower(email)=lower(verified_email) AND NOT EXISTS(SELECT 1 FROM module_citizen_alias WHERE source_id=citizen.id);
  IF count_matches>1 THEN RAISE EXCEPTION 'Cadastros legados exigem conciliação'; END IF;
  SELECT * INTO c FROM citizen WHERE lower(email)=lower(verified_email) AND NOT EXISTS(SELECT 1 FROM module_citizen_alias WHERE source_id=citizen.id) FOR UPDATE;
  IF c.id IS NOT NULL THEN
   IF EXISTS(SELECT 1 FROM module_contact_account WHERE citizen_id=c.id AND uid<>account_uid) THEN RAISE EXCEPTION 'Cadastro pertence a outra conta'; END IF;
   SELECT contact_id INTO rid FROM module_contact_legacy WHERE citizen_id=c.id;
  END IF;
 END IF;
 fiscal=regexp_replace(coalesce(submitted->>'cpfCnpj',''),'[^0-9]','','g');
 current_fiscal=regexp_replace(coalesce(c.cpf_cnpj,''),'[^0-9]','','g');
 IF c.id IS NOT NULL AND (c.name<>person_name OR (current_fiscal<>'' AND fiscal<>current_fiscal)) THEN RAISE EXCEPTION 'Nome e identificação fiscal existentes são preservados'; END IF;
 IF fiscal<>'' AND (EXISTS(SELECT 1 FROM citizen WHERE regexp_replace(cpf_cnpj,'[^0-9]','','g')=fiscal AND lower(email)<>lower(verified_email)) OR EXISTS(SELECT 1 FROM citizen_identity WHERE cpf_cnpj=fiscal AND (c.id IS NULL OR citizen_id<>c.id))) THEN RAISE EXCEPTION 'Identificação fiscal exige confirmação cadastral'; END IF;
 IF rid IS NOT NULL THEN
  SELECT * INTO r FROM module_record WHERE id=rid FOR UPDATE;
  IF r.family<>'contatos' OR r.status='UNIFICADO' OR r.revision<>expected OR (r.external_owner_uid IS NOT NULL AND r.external_owner_uid<>account_uid) THEN RAISE EXCEPTION 'Cadastro atualizado ou titular incompatível'; END IF;
  IF regexp_replace(coalesce(r.data->'values'->>'cpfCnpj',''),'[^0-9]','','g')<>current_fiscal OR lower(coalesce(r.data->'values'->>'email',verified_email))<>lower(verified_email) THEN RAISE EXCEPTION 'Vínculo fiscal divergente'; END IF;
 ELSE
  IF expected<>0 THEN RAISE EXCEPTION 'Cadastro atualizado'; END IF;
 END IF;
 IF EXISTS(SELECT 1 FROM module_record m WHERE family='contatos' AND status<>'UNIFICADO' AND (rid IS NULL OR id<>rid) AND (
  (fiscal<>'' AND regexp_replace(coalesce(data->'values'->>'cpfCnpj',''),'[^0-9]','','g')=fiscal) OR lower(data->'values'->>'email')=lower(verified_email)
  OR (coalesce(submitted->>'phone','')<>'' AND regexp_replace(data->'values'->>'phone','[^0-9]','','g')=regexp_replace(submitted->>'phone','[^0-9]','','g')))) THEN RAISE EXCEPTION 'Contato existente exige vínculo cadastral autorizado'; END IF;
 IF c.id IS NULL THEN
  INSERT INTO citizen(name,cpf_cnpj,email) VALUES(person_name,fiscal,lower(verified_email)) RETURNING * INTO c;
 END IF;
 cid=c.id;
 UPDATE citizen SET cpf_cnpj=CASE WHEN current_fiscal='' THEN fiscal ELSE cpf_cnpj END,
  phone=coalesce(submitted->>'phone',phone),cep=coalesce(submitted->>'cep',cep),
  street=coalesce(submitted->>'endereco',address_data->>'street',street),number=coalesce(address_data->>'number',number),complement=coalesce(address_data->>'complement',complement),district=coalesce(address_data->>'district',district),city=coalesce(address_data->>'city',city),state=coalesce(address_data->>'state',state) WHERE id=cid;
 IF fiscal<>'' THEN INSERT INTO citizen_identity(cpf_cnpj,citizen_id) VALUES(fiscal,cid) ON CONFLICT(cpf_cnpj) DO NOTHING;
  IF NOT EXISTS(SELECT 1 FROM citizen_identity WHERE cpf_cnpj=fiscal AND citizen_id=cid) THEN RAISE EXCEPTION 'Identificação fiscal divergente'; END IF;
 END IF;
 IF rid IS NULL THEN
  SELECT d.id INTO intake FROM department d JOIN app_user u ON u.department_id=d.id WHERE u.id=p.actor_id AND d.active FOR SHARE OF d;
  IF intake IS NULL THEN RAISE EXCEPTION 'Configure o perfil por servidor com setor ativo para receber contatos'; END IF;
  INSERT INTO module_record(family,title,status,access,department_id,participants,external_owner_uid,external_owner_email,external_actor_uid,data,action)
  VALUES('contatos',person_name,'ATIVO','SETOR',intake,jsonb_build_array(intake),account_uid,lower(verified_email),account_uid,jsonb_build_object('values',submitted),'CONTATO_EXTERNO_CRIADO') RETURNING id INTO rid;
 ELSE
  UPDATE module_record SET data=jsonb_set(data,'{values}',coalesce(data->'values','{}')||submitted),revision=revision+1,actor_id=NULL,external_actor_uid=account_uid,action='CONTATO_EXTERNO_EDITADO',note='' WHERE id=rid;
 END IF;
 IF fiscal<>'' THEN
  INSERT INTO module_contact_legacy(contact_id,citizen_id) VALUES(rid,cid) ON CONFLICT(citizen_id) DO NOTHING;
  IF NOT EXISTS(SELECT 1 FROM module_contact_legacy WHERE citizen_id=cid AND contact_id=rid) THEN RAISE EXCEPTION 'Associação fiscal divergente'; END IF;
 END IF;
 INSERT INTO module_contact_account(uid,citizen_id,contact_id) VALUES(account_uid,cid,rid) ON CONFLICT(uid) DO NOTHING;
 IF NOT EXISTS(SELECT 1 FROM module_contact_account WHERE uid=account_uid AND citizen_id=cid AND contact_id=rid) THEN RAISE EXCEPTION 'Conta já vinculada a outro titular'; END IF;
 INSERT INTO audit_log(actor_type,actor_id,action,entity_type,entity_id,metadata) VALUES('CITIZEN',account_uid,'CONTACT_EXTERNAL_ACCOUNT_SAVED','module_record',rid::text,jsonb_build_object('citizenId',cid,'profileId',profile,'fiscalRegistryMatched',fiscal<>'','authentication','FIREBASE_VERIFIED_EMAIL'));
 RETURN rid;
END $$;
