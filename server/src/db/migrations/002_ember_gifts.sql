-- 002_ember_gifts.sql
-- Ember domain tables. The actual data layer is still in-memory (see
-- server/src/lib/ember-store.ts). This file is the canonical schema
-- for when the Postgres swap lands; it matches BACKEND_HANDOFF.md §3.

CREATE TYPE gift_status AS ENUM ('draft', 'sent', 'archived');
CREATE TYPE gift_intent AS ENUM ('mom', 'dad', 'loved-one', 'undecided');
CREATE TYPE gift_delivery AS ENUM ('email', 'in-person');
CREATE TYPE gift_time_lock_kind AS ENUM ('date', 'milestone', 'after_passing');
CREATE TYPE question_source AS ENUM ('library', 'custom');
CREATE TYPE response_kind AS ENUM ('text', 'voice', 'photo');

CREATE TABLE gifts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  intent          gift_intent NOT NULL DEFAULT 'undecided',
  about           text NOT NULL DEFAULT '',
  why             text NOT NULL DEFAULT '',
  delivery        gift_delivery,
  recipient_name  text,
  recipient_email text,
  current_step    text NOT NULL DEFAULT 'welcome',
  status          gift_status NOT NULL DEFAULT 'draft',
  sent_at         timestamptz,
  time_lock_at    timestamptz,
  time_lock_kind  gift_time_lock_kind,
  released_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX gifts_user_id_idx ON gifts (user_id);

CREATE TABLE people (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_id       uuid NOT NULL REFERENCES gifts(id) ON DELETE CASCADE,
  name          text NOT NULL,
  relationship  text NOT NULL,
  age           text,
  description   text NOT NULL DEFAULT '',
  position      int NOT NULL DEFAULT 0
);
CREATE INDEX people_gift_id_idx ON people (gift_id);

CREATE TABLE question_templates (
  id          text PRIMARY KEY,
  text        text NOT NULL,
  categories  text[] NOT NULL DEFAULT '{}',
  suggested   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE questions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_id      uuid NOT NULL REFERENCES gifts(id) ON DELETE CASCADE,
  source       question_source NOT NULL,
  template_id  text REFERENCES question_templates(id),
  text         text NOT NULL,
  photo_url    text,
  preface      text,
  position     int NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT questions_template_required_when_library
    CHECK (source <> 'library' OR template_id IS NOT NULL)
);
CREATE INDEX questions_gift_id_idx ON questions (gift_id);

CREATE TABLE recipients (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_id         uuid NOT NULL UNIQUE REFERENCES gifts(id) ON DELETE CASCADE,
  access_token    text NOT NULL UNIQUE,
  email           text NOT NULL,
  name            text NOT NULL,
  first_seen_at   timestamptz,
  last_active_at  timestamptz
);
CREATE INDEX recipients_access_token_idx ON recipients (access_token);

CREATE TABLE responses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_id       uuid NOT NULL REFERENCES gifts(id) ON DELETE CASCADE,
  recipient_id  uuid NOT NULL REFERENCES recipients(id) ON DELETE CASCADE,
  question_id   uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  kind          response_kind NOT NULL,
  text          text,
  audio_url     text,
  photo_url     text,
  recorded_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX responses_gift_id_idx ON responses (gift_id);
CREATE INDEX responses_question_id_idx ON responses (question_id);
