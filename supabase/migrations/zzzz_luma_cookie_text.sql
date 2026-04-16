-- Switch bytea cookie columns to text (base64) — bytea round-tripping via PostgREST mangles the data.
ALTER TABLE luma_sync_config
  ALTER COLUMN luma_session_cookie_enc TYPE TEXT USING NULL,
  ALTER COLUMN luma_session_cookie_iv  TYPE TEXT USING NULL,
  ALTER COLUMN luma_session_cookie_tag TYPE TEXT USING NULL;
UPDATE luma_sync_config
   SET luma_session_cookie_enc = NULL,
       luma_session_cookie_iv  = NULL,
       luma_session_cookie_tag = NULL,
       cookie_last4 = NULL
 WHERE id = 1;
