ALTER TABLE document ADD COLUMN circular_reply_mode text NOT NULL DEFAULT 'OPEN'
  CHECK (circular_reply_mode IN ('OPEN','RESTRICTED'));
ALTER TABLE document ADD COLUMN assignee_id uuid REFERENCES app_user(id);

-- Protect the first receipt even from accidental subsequent writes.
CREATE FUNCTION preserve_first_read() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.document_id IS DISTINCT FROM OLD.document_id OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.first_read_at IS DISTINCT FROM OLD.first_read_at THEN
    RAISE EXCEPTION 'first_read_is_immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER document_first_read_immutable BEFORE UPDATE ON document_read_receipt
  FOR EACH ROW EXECUTE FUNCTION preserve_first_read();
