-- Current contact references may move; sealed signature inputs and history never do.
CREATE OR REPLACE FUNCTION modules_contact_refs(value jsonb, source text, target text, context_key text DEFAULT '') RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE answer jsonb; k text; v jsonb;
BEGIN
 IF jsonb_typeof(value)='object' THEN
  answer='{}';
  FOR k,v IN SELECT * FROM jsonb_each(value) LOOP
   IF k IN ('publication','messages','identity','blocks','evaluation','signatures','signatureEnvelope','acknowledgements') THEN answer=answer||jsonb_build_object(k,v);
   ELSE answer=answer||jsonb_build_object(k,modules_contact_refs(v,source,target,CASE WHEN context_key='refs' AND k IN ('id','recordId','moduleId') THEN 'contactId' ELSE k END)); END IF;
  END LOOP;
  RETURN answer;
 ELSIF jsonb_typeof(value)='array' THEN
  SELECT coalesce(jsonb_agg(modules_contact_refs(x,source,target,context_key)),'[]') INTO answer FROM jsonb_array_elements(value) x;
  RETURN answer;
 ELSIF value=to_jsonb(source) AND context_key IN ('linkedIds','refs','contactIds','contactId','contatoId','recipientContactId','contatos','destinatario','outorgante','outorgado','organizacao','proprietario','responsavel','candidato','autor','cadastroPrincipal') THEN RETURN to_jsonb(target);
 END IF;
 RETURN value;
END $$;

CREATE OR REPLACE FUNCTION modules_signature_envelope_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE envelope jsonb; expected_files jsonb;
BEGIN
 IF NEW.action='SOLICITAR_ASSINATURA' THEN
  IF OLD.family NOT IN ('ged','parecer','oficio','intimacao','pauta','atos') OR OLD.status NOT IN ('EM_ANDAMENTO','CONCLUIDO','CIENTE','DEFERIDO') OR EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(OLD.data->'signatures','[]')) s WHERE s->>'status'='PENDENTE') THEN RAISE EXCEPTION 'Documento indisponível ou fila de assinatura pendente'; END IF;
  envelope=NEW.data->'signatureEnvelope';
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'filename',filename,'mimeType',mime_type,'size',size,'sha256',sha256) ORDER BY id),'[]') INTO expected_files FROM module_file WHERE record_id=OLD.id;
  IF envelope IS NULL OR coalesce(envelope->>'hash','') !~ '^[a-f0-9]{64}$' OR NEW.data->>'sealedHash' IS DISTINCT FROM envelope->>'hash'
   OR envelope->>'revision' IS DISTINCT FROM OLD.revision::text OR envelope->>'requestedBy' IS DISTINCT FROM NEW.actor_id::text
   OR envelope->'snapshot' IS DISTINCT FROM jsonb_build_object('title',OLD.title,'body',OLD.body,'data',OLD.data-'signatures'-'signatureEnvelope'-'sealedHash','files',expected_files)
  THEN RAISE EXCEPTION 'Conteúdo de assinatura não corresponde à revisão e aos originais'; END IF;
 ELSIF OLD.data ? 'signatureEnvelope' AND (NEW.data->'signatureEnvelope' IS DISTINCT FROM OLD.data->'signatureEnvelope' OR NEW.data->>'sealedHash' IS DISTINCT FROM OLD.data->>'sealedHash') THEN
  RAISE EXCEPTION 'O conteúdo preservado para assinatura é imutável';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS modules_signature_envelope_immutable ON module_record;
CREATE TRIGGER modules_signature_envelope_immutable BEFORE UPDATE ON module_record FOR EACH ROW EXECUTE FUNCTION modules_signature_envelope_guard();
