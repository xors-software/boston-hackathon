-- Gifts core schema. Greenfield, so photo_url lands in questions/responses
-- as part of the initial cut rather than a follow-up migration.

CREATE TABLE IF NOT EXISTS gifts (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  intent text NOT NULL,
  about text,
  why text,
  recipient_name text,
  recipient_email text,
  delivery text,
  current_step text,
  status text NOT NULL DEFAULT 'draft',
  sent_at timestamptz,
  time_lock_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gifts_user_id_idx ON gifts(user_id);

CREATE TABLE IF NOT EXISTS people (
  id text PRIMARY KEY,
  gift_id text NOT NULL REFERENCES gifts(id) ON DELETE CASCADE,
  name text NOT NULL,
  relationship text,
  age text,
  description text,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS people_gift_id_idx ON people(gift_id);

CREATE TABLE IF NOT EXISTS questions (
  id text PRIMARY KEY,
  gift_id text NOT NULL REFERENCES gifts(id) ON DELETE CASCADE,
  source text NOT NULL,
  template_id text,
  text text NOT NULL,
  preface text,
  photo_url text,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS questions_gift_id_idx ON questions(gift_id);

CREATE TABLE IF NOT EXISTS recipients (
  id text PRIMARY KEY,
  gift_id text NOT NULL UNIQUE REFERENCES gifts(id) ON DELETE CASCADE,
  name text,
  email text,
  access_token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recipients_token_idx ON recipients(access_token);

CREATE TABLE IF NOT EXISTS responses (
  id text PRIMARY KEY,
  question_id text NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  recipient_id text NOT NULL REFERENCES recipients(id) ON DELETE CASCADE,
  kind text NOT NULL,
  text text,
  audio_url text,
  photo_url text,
  caption text,
  transcript text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS responses_question_id_idx ON responses(question_id);
CREATE INDEX IF NOT EXISTS responses_recipient_id_idx ON responses(recipient_id);
