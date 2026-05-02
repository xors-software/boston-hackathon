-- Bootstrap tables for users + messages. Mirrors what's already on the
-- deployed Railway DB; this file exists so a fresh local Postgres
-- (and CI) can stand up the same schema in one run.

CREATE TABLE IF NOT EXISTS users (
  xors_user_id  text PRIMARY KEY,
  email         text NOT NULL DEFAULT '',
  display_name  text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);

CREATE TABLE IF NOT EXISTS messages (
  id                  text PRIMARY KEY,
  from_xors_user_id   text NOT NULL REFERENCES users(xors_user_id) ON DELETE CASCADE,
  to_xors_user_id     text NOT NULL REFERENCES users(xors_user_id) ON DELETE CASCADE,
  content             text NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS messages_from_idx ON messages(from_xors_user_id, created_at);
CREATE INDEX IF NOT EXISTS messages_to_idx ON messages(to_xors_user_id, created_at);
