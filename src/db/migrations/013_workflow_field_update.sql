-- Additive operation; existing anonymous history and write functions are untouched.
CREATE FUNCTION modules_anonymous_fields(token text, operation uuid, fingerprint text, expected integer, values_input jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r module_record; previous module_anonymous_operation; result jsonb; entry record; definition jsonb;
BEGIN
 SELECT m.* INTO r FROM module_record m JOIN module_anonymous_access a ON a.record_id=m.id
 WHERE a.token_hash=token AND m.family='ouvidoria' AND m.data->'values'->>'modalidade'='Anônima' FOR UPDATE OF m;
 IF r.id IS NULL THEN RAISE EXCEPTION 'Chave inválida'; END IF;
 SELECT * INTO previous FROM module_anonymous_operation WHERE record_id=r.id AND operation_id=operation;
 IF previous.record_id IS NOT NULL THEN
  IF previous.payload_hash<>fingerprint THEN RAISE EXCEPTION 'Identificador reutilizado com outro conteúdo'; END IF;
  RETURN previous.result;
 END IF;
 IF r.revision<>expected OR r.status NOT IN ('RASCUNHO','EM_ANDAMENTO') THEN RAISE EXCEPTION 'Manifestação atualizada ou encerrada'; END IF;
 IF jsonb_typeof(values_input) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(values_input))>100 THEN RAISE EXCEPTION 'Formulário inválido'; END IF;
 FOR entry IN SELECT key FROM jsonb_each(coalesce(r.data->'values','{}') || values_input) LOOP
  IF jsonb_typeof(values_input->entry.key) IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Valor inválido ou removido'; END IF;
  IF r.data->'values'->entry.key IS NOT DISTINCT FROM values_input->entry.key THEN CONTINUE; END IF;
  SELECT f INTO definition FROM jsonb_array_elements(r.data->'workflow'->'fields') f WHERE f->>'key'=entry.key;
  IF definition IS NULL OR definition->>'type' IN ('heading','paragraph') OR definition->>'visibility'='INTERNO' THEN RAISE EXCEPTION 'Campo fora do escopo'; END IF;
  IF definition->'calculation' IS NULL THEN
   IF coalesce((definition->>'locked')::boolean,false) OR (r.status<>'RASCUNHO' AND coalesce(definition->>'editAfterProtocol','NENHUM') NOT IN ('EXTERNO','AMBOS')) THEN RAISE EXCEPTION 'Campo bloqueado'; END IF;
  END IF;
 END LOOP;
 UPDATE module_record SET data=jsonb_set(data,'{values}',values_input),revision=revision+1,actor_id=NULL,external_actor_uid=NULL,action='ANONIMO_FIELDS',note='' WHERE id=r.id;
 result=jsonb_build_object('saved',true,'revision',r.revision+1);
 INSERT INTO module_anonymous_operation(record_id,operation_id,payload_hash,result) VALUES(r.id,operation,fingerprint,result);
 RETURN result;
END $$;
