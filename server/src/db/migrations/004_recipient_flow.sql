-- Recipient (parent) flow: journal entries, sharing config, account creds.
-- BACKEND_HANDOFF_V2.md §6.7, §6.8 + §5.1 (recipient login).
--
-- The existing `responses` table (per-question one-shot answers) stays;
-- the parent flow here is a different shape — free-form journaling that
-- may or may not be tied to a giver-curated prompt.

CREATE TYPE entry_source AS ENUM (
  'free-write', 'prompt', 'ai', 'voice', 'photo'
);

CREATE TYPE sharing_mode AS ENUM (
  'when-ready', 'legacy', 'date', 'milestone'
);

CREATE TYPE milestone_preset AS ENUM (
  'future-birthday', 'anniversary', 'in-one-year', 'custom'
);

CREATE TABLE journal_entries (
  id                text PRIMARY KEY,
  recipient_id      text NOT NULL REFERENCES recipients(id) ON DELETE CASCADE,
  gift_id           text NOT NULL REFERENCES gifts(id) ON DELETE CASCADE,
  source            entry_source NOT NULL,
  text              text,
  prompt_id         text,
  prompt_text       text,
  photo_url         text,
  audio_url         text,
  duration_seconds  integer,
  preface           text,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX journal_entries_recipient_idx
  ON journal_entries (recipient_id, created_at DESC);
CREATE INDEX journal_entries_gift_idx ON journal_entries (gift_id);

CREATE TABLE sharing (
  recipient_id                text PRIMARY KEY
                                REFERENCES recipients(id) ON DELETE CASCADE,
  mode                        sharing_mode NOT NULL DEFAULT 'when-ready',
  date                        date,
  milestone_preset            milestone_preset,
  milestone_text              text,
  shared_at                   timestamptz,
  last_shared_snapshot_count  integer
);

-- Recipient account credentials. Set when the parent fills out
-- `/r/:token/account`. Token remains the primary auth surface; the
-- account lets them sign back in on a different device via
-- POST /auth/recipient/login.
ALTER TABLE recipients
  ADD COLUMN IF NOT EXISTS password_hash text;
ALTER TABLE recipients
  ADD COLUMN IF NOT EXISTS account_created_at timestamptz;
CREATE INDEX IF NOT EXISTS recipients_email_idx ON recipients (email);

-- Personal letter the giver can author for the parent's /r/:token/letter
-- page. Frontend renders a generic warm letter when null (no UI to set
-- this yet — see BACKEND_HANDOFF_V2 §13).
ALTER TABLE gifts
  ADD COLUMN IF NOT EXISTS personal_message text;
