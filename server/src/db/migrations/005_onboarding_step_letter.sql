-- New `letter` step for the giver flow's personal-letter authoring page,
-- between `delivery` and `send`. The parent renders this on
-- /r/:token/letter (column gifts.personal_message exists since 004).

ALTER TYPE onboarding_step ADD VALUE IF NOT EXISTS 'letter' BEFORE 'send';
