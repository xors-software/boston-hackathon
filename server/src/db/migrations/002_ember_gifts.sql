-- Adds the Ember gift aggregate (BACKEND_HANDOFF.md §3).
-- Existing tables (`users`, `messages`) from `001_init` are untouched.

CREATE TYPE gift_intent AS ENUM ('mom', 'dad', 'loved-one', 'undecided');
CREATE TYPE gift_delivery AS ENUM ('email', 'in-person');
CREATE TYPE gift_status AS ENUM ('draft', 'sent', 'archived');
CREATE TYPE onboarding_step AS ENUM (
  'welcome', 'intent', 'account', 'recipient', 'why', 'world',
  'questions', 'delivery', 'send', 'complete'
);
CREATE TYPE question_source AS ENUM ('library', 'custom', 'ai');
CREATE TYPE response_kind AS ENUM ('text', 'voice', 'photo');

CREATE TABLE gifts (
  id              text PRIMARY KEY,
  xors_user_id    text NOT NULL REFERENCES users(xors_user_id) ON DELETE CASCADE,
  intent          gift_intent NOT NULL DEFAULT 'undecided',
  about           text NOT NULL DEFAULT '',
  why             text NOT NULL DEFAULT '',
  delivery        gift_delivery NOT NULL DEFAULT 'email',
  recipient_name  text NOT NULL DEFAULT 'Them',
  recipient_email text,
  current_step    onboarding_step NOT NULL DEFAULT 'intent',
  status          gift_status NOT NULL DEFAULT 'draft',
  sent_at         timestamptz,
  time_lock_at    timestamptz,
  released_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX gifts_xors_user_id_idx ON gifts (xors_user_id);

CREATE TABLE people (
  id            text PRIMARY KEY,
  gift_id       text NOT NULL REFERENCES gifts(id) ON DELETE CASCADE,
  name          text NOT NULL,
  relationship  text NOT NULL,
  age           text NOT NULL DEFAULT '',
  description   text NOT NULL DEFAULT '',
  position      integer NOT NULL DEFAULT 0
);
CREATE INDEX people_gift_id_idx ON people (gift_id);

CREATE TABLE questions (
  id              text PRIMARY KEY,
  gift_id         text NOT NULL REFERENCES gifts(id) ON DELETE CASCADE,
  source          question_source NOT NULL,
  template_id     text,
  text            text NOT NULL,
  photo_data_url  text,
  preface         text,
  position        integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX questions_gift_id_idx ON questions (gift_id);

CREATE TABLE recipients (
  id              text PRIMARY KEY,
  gift_id         text NOT NULL REFERENCES gifts(id) ON DELETE CASCADE,
  access_token    text NOT NULL,
  email           text NOT NULL DEFAULT '',
  name            text NOT NULL DEFAULT '',
  first_seen_at   timestamptz,
  last_active_at  timestamptz
);
CREATE UNIQUE INDEX recipients_gift_id_uniq ON recipients (gift_id);
CREATE UNIQUE INDEX recipients_access_token_uniq ON recipients (access_token);

CREATE TABLE responses (
  id            text PRIMARY KEY,
  gift_id       text NOT NULL REFERENCES gifts(id) ON DELETE CASCADE,
  recipient_id  text NOT NULL REFERENCES recipients(id) ON DELETE CASCADE,
  question_id   text NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  kind          response_kind NOT NULL,
  text          text,
  audio_url     text,
  photo_url     text,
  recorded_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX responses_gift_id_idx ON responses (gift_id);
CREATE INDEX responses_question_id_idx ON responses (question_id);
