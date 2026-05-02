-- Custom-question photos move from base64-in-Postgres (photo_data_url)
-- to S3 URL references (photo_url). The giver upload route now POSTs
-- multipart → storage → URL, instead of stuffing a 4MB data URL into
-- a TEXT column on every PATCH.
--
-- We drop photo_data_url rather than backfilling: the old base64 path
-- only ever wrote to localStorage in the frontend, so no production
-- rows actually carry image bytes today.

ALTER TABLE questions DROP COLUMN IF EXISTS photo_data_url;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS photo_url text;
