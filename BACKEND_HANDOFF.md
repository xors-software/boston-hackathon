# Ember — Backend Handoff

Everything the backend needs to support the onboarding flow we've built, plus the recipient + time-lock mechanics that aren't UI yet but are part of v1.

---

## 1. Product context (load-bearing)

**Ember is a gift-based memory product.** The buyer/initiator is the adult child (~30–50). The recipient is a parent or loved one. The child curates prompts, the parent fills them at their own pace (text / voice / photo), and the completed archive is **time-locked** — released back to the child on a chosen date or milestone.

**Core ritual:** Child gives → parent fills → time-lock holds it → gift returns.

**Brand non-negotiables (these affect backend behavior):**
- **No AI avatars. No simulation of the person. Ever.** Don't generate a parent-voice or summarize *as* the parent.
- Privacy-first by default. Recipient data is private to the giver. Voice/photo never leave our infra except in the final archive returned to the giver.
- Voice is the soul of the input experience — STT must be reliable, raw audio worth keeping (decision below).
- Slowness is the feature. No "engagement loops" or push notifications nudging the parent.

---

## 2. What exists today

### 2.1 Frontend
The full **child-side onboarding flow** is built end-to-end and persists everything to `localStorage` under the key `ember:onboarding:v1`. Frontend lives in `web/app/onboarding/*` and `web/app/dashboard/*`. The flow:

```
welcome → intent → account → recipient → recipient/ai (optional)
        → why → why/ai (optional)
        → world → questions → questions/write → questions/review
        → delivery → send → sent → /dashboard
```

State shape currently in `localStorage` (this is the source of truth for what backend needs to persist):

```ts
{
  step: "welcome" | "intent" | "account" | "recipient" | "why"
      | "world" | "questions" | "delivery" | "send" | "complete",
  data: {
    intent?: "mom" | "dad" | "loved-one" | "undecided",
    email?: string,                 // giver's email (set on auth)
    about?: string,                 // freeform text (also receives AI-distilled summary)
    why?: string,                   // freeform text (also receives AI-distilled summary)
    people?: Array<{
      id: string, name: string, relationship: string,
      age?: string, description: string,
    }>,
    questions?: {
      selectedIds: string[],         // library + custom IDs
      custom: Array<{
        id: string,
        text: string,
        photoDataUrl?: string,       // currently inline data URL — needs S3
        preface?: string,
      }>,
      edits?: Record<string, string>, // libraryId -> overridden text
    },
    delivery?: "email" | "in-person",  // "physical" coming soon, disabled in UI
    recipientName?: string,
    recipientEmail?: string,
    sentAt?: string,                  // ISO timestamp
    // not yet collected in UI but part of v1 spec:
    // timeLockAt?: string,           // ISO date OR { type: "after_passing" }
  }
}
```

### 2.2 Backend (already on `main`)
- **Auth** — Google OAuth via `api.xors.xyz`. `xors_session` httpOnly cookie. `GET /auth/me` returns the current user; `POST /auth/logout` clears the cookie. **In-memory user store** in [`server/src/lib/xors-identity.ts`](server/src/lib/xors-identity.ts) — needs to move to a real DB.
- **Eden** — typed treaty client at [`web/app/lib/api.ts`](web/app/lib/api.ts) using `App` type from server. New endpoints get types for free.
- **Messages routes** — [`server/src/routes/messages.ts`](server/src/routes/messages.ts) — example of authed CRUD shape, also currently in-memory.

### 2.3 Backend additions we built
- **`POST /transcribe`** ([`server/src/routes/transcribe.ts`](server/src/routes/transcribe.ts)) — multipart `audio` file → OpenAI Whisper → `{ text }`. Used by every voice input in the flow. Needs `OPENAI_API_KEY`.
- **`POST /ai/converse`** ([`server/src/routes/ai.ts`](server/src/routes/ai.ts)) — Claude Opus 4.7 chat. Body: `{ topic: "about" | "why", messages: [{role, content}], intent, hint? }` → `{ message }`. Two distinct system prompts (one per topic) baked in.
- **`POST /ai/summarize`** — Distills a chat transcript into 2–4 prose sentences for `data.about` or `data.why`. Body: `{ topic, messages }` → `{ summary }`.
- Both AI endpoints need `ANTHROPIC_API_KEY`. System prompts encode the Ember tone (warm, present-tense, never grief-coded, never simulates the recipient).

### 2.4 Known frontend stubs to replace
- **localStorage** — every step writes to localStorage. Migration plan in §10.
- **Question library** — hardcoded in [`web/app/onboarding/questions/_lib/library.ts`](web/app/onboarding/questions/_lib/library.ts). 26 questions across 5 categories with 8 marked `suggested`. Should move to DB and be augmented by AI generation per user.
- **Photo storage** — custom-question photos are currently base64 data URLs in localStorage. Cap at 4MB enforced on frontend. Needs real upload + S3.
- **Send is a no-op** — `submitSend()` in [`web/app/onboarding/send/page.tsx`](web/app/onboarding/send/page.tsx) just writes `sentAt` locally and routes to ack. No email is sent.
- **No recipient flow yet** — UI for the parent side (lands from email link, answers prompts) is unbuilt. Endpoints below assume we build it.

---

## 3. Data model

```
User                 (1) ──< Gift (N)
Gift                 (1) ──< Question (N)
Gift                 (1) ──< Person (N)               // people in recipient's world
Gift                 (1) ──< Recipient (1)            // single recipient per gift in v1
Recipient            (1) ──< Response (N)
Question             (1) ──< Response (N)
```

### 3.1 `User`
Already exists conceptually in [`xors-identity.ts`](server/src/lib/xors-identity.ts) — needs persistence.

| field          | type                 | notes                                          |
|----------------|----------------------|------------------------------------------------|
| `id`           | uuid / `usr_...`     | local PK                                       |
| `xorsUserId`   | string               | from XORS viewer; unique                       |
| `email`        | string               | from XORS                                      |
| `displayName`  | string \| null       | from XORS                                      |
| `createdAt`    | timestamptz          |                                                |

### 3.2 `Gift`
The top-level aggregate. One user can have many gifts (v2), but onboarding currently assumes one in-progress at a time.

| field             | type                          | notes                                         |
|-------------------|-------------------------------|-----------------------------------------------|
| `id`              | uuid / `gft_...`              | PK                                            |
| `userId`          | uuid                          | FK → User                                     |
| `intent`          | enum                          | `mom` \| `dad` \| `loved-one` \| `undecided`  |
| `about`           | text                          | freeform + AI-summary appended                |
| `why`             | text                          | freeform + AI-summary appended                |
| `delivery`        | enum                          | `email` \| `in-person` (physical disabled v1) |
| `recipientName`   | string                        | defaults from intent ("Mom"/"Dad")            |
| `recipientEmail`  | string \| null                | required when delivery=email                  |
| `currentStep`     | enum                          | mirrors `OnboardingStep` for resume           |
| `status`          | enum                          | `draft` \| `sent` \| `archived`               |
| `sentAt`          | timestamptz \| null           | when giver tapped Send                        |
| `timeLockAt`      | timestamptz \| null           | when archive returns to giver — **v1 needs UI for this** |
| `timeLockKind`    | enum \| null                  | `date` \| `milestone` \| `after_passing`      |
| `releasedAt`      | timestamptz \| null           | when archive was actually shipped back        |
| `createdAt`       | timestamptz                   |                                               |
| `updatedAt`       | timestamptz                   |                                               |

### 3.3 `Person` (people in recipient's world)
Captured on the World screen.

| field          | type      | notes                                          |
|----------------|-----------|------------------------------------------------|
| `id`           | uuid      | PK; frontend currently generates `p_...` IDs   |
| `giftId`       | uuid      | FK                                             |
| `name`         | string    |                                                |
| `relationship` | string    | free text (partner / sister / friend / etc.)   |
| `age`          | string    | free text (so "6", "42", "early 30s" all work) |
| `description`  | text      | one-liner; voice-input-able                    |
| `position`     | int       | display order                                  |

### 3.4 `Question`
Both library questions the giver selected AND custom questions. Library catalog also lives here so editorial/AI updates don't require deploys.

Two-table model is cleaner:

**`QuestionTemplate`** (catalog — workspace-wide, not per-user)
| field          | type     | notes                                          |
|----------------|----------|------------------------------------------------|
| `id`           | string   | e.g. `tpl_ch1`; stable for AI re-suggestion    |
| `text`         | text     |                                                |
| `categories`   | string[] | `childhood` / `love` / `wisdom` / `everyday` / `their-story` |
| `suggested`    | boolean  | hand-curated default suggestion flag           |
| `createdAt`    | timestamptz |                                             |

**`Question`** (per-gift selection — what's actually being sent)
| field          | type                | notes                                          |
|----------------|---------------------|------------------------------------------------|
| `id`           | uuid                | PK                                             |
| `giftId`       | uuid                | FK                                             |
| `source`       | enum                | `library` \| `custom`                          |
| `templateId`   | string \| null      | FK → QuestionTemplate when `source=library`    |
| `text`         | text                | the actual text (overrides template if edited) |
| `photoUrl`     | string \| null      | S3 URL for custom-question photos              |
| `preface`      | text \| null        | optional intro line shown above the photo      |
| `position`     | int                 | display order in the final delivered set       |
| `createdAt`    | timestamptz         |                                                |

The frontend currently splits state into `selectedIds[] + custom[] + edits{}` for localStorage convenience. The backend should flatten this into a single `Question` table per gift; the frontend's three-bucket shape can collapse to a single sorted list of `Question` rows.

### 3.5 `Recipient`
The parent's side of the gift. One per gift in v1.

| field          | type                | notes                                                 |
|----------------|---------------------|-------------------------------------------------------|
| `id`           | uuid                | PK                                                    |
| `giftId`       | uuid                | FK; **unique**                                        |
| `accessToken`  | string              | opaque, unguessable; used in the email/QR link        |
| `email`        | string              | mirror of `Gift.recipientEmail` at send time          |
| `name`         | string              | mirror of `Gift.recipientName` at send time           |
| `firstSeenAt`  | timestamptz \| null | first time they opened the link                       |
| `lastActiveAt` | timestamptz \| null |                                                       |

### 3.6 `Response`
What the parent submits per question.

| field             | type             | notes                                          |
|-------------------|------------------|------------------------------------------------|
| `id`              | uuid             | PK                                             |
| `giftId`          | uuid             | FK                                             |
| `recipientId`     | uuid             | FK                                             |
| `questionId`      | uuid             | FK                                             |
| `kind`            | enum             | `text` \| `voice` \| `photo`                   |
| `text`            | text \| null     | for `text`; or transcript of `voice`            |
| `audioUrl`        | string \| null   | S3 URL for `voice` (keep raw — see §6)         |
| `photoUrl`        | string \| null   | S3 URL for `photo`                             |
| `recordedAt`      | timestamptz      |                                                |

---

## 4. Endpoints — giver side

All endpoints below require an authenticated user (`xors_session` cookie). All gift IDs are scoped to the authed user — return 404 if a gift belongs to someone else (don't 403; don't leak existence).

### 4.1 Gift CRUD

| method | path                          | body / params                      | returns / behavior                                      |
|--------|-------------------------------|-------------------------------------|---------------------------------------------------------|
| POST   | `/gifts`                      | `{ intent? }`                       | Creates `draft` gift, returns full `Gift`               |
| GET    | `/gifts`                      | —                                   | List user's gifts (most-recent-first)                   |
| GET    | `/gifts/:id`                  | —                                   | Full gift incl. people + questions                      |
| PATCH  | `/gifts/:id`                  | partial Gift fields                 | Update intent / about / why / delivery / recipient* / currentStep / timeLock* |
| DELETE | `/gifts/:id`                  | —                                   | Hard delete if `status=draft`, soft archive otherwise   |
| POST   | `/gifts/:id/send`             | —                                   | Validates (≥3 questions, email if delivery=email), sets `sentAt`, creates `Recipient`, queues invitation email, returns `Gift` with `recipient.accessToken` for the success screen |

**Idempotency:** `POST /gifts/:id/send` should be idempotent on `sentAt`. If already sent, return the current state, don't re-send.

### 4.2 People (World)

| method | path                                      | body                                  | returns           |
|--------|-------------------------------------------|---------------------------------------|-------------------|
| POST   | `/gifts/:id/people`                       | `{ name, relationship, age?, description }` | created `Person` |
| PATCH  | `/gifts/:id/people/:pid`                  | partial fields                        | `Person`          |
| DELETE | `/gifts/:id/people/:pid`                  | —                                     | 204               |
| PUT    | `/gifts/:id/people`                       | `Person[]` (full replace)             | `Person[]` — easier for the frontend's bulk-save pattern |

### 4.3 Question templates (library)

| method | path                          | query                       | returns                                           |
|--------|-------------------------------|-----------------------------|---------------------------------------------------|
| GET    | `/question-templates`         | `?category=childhood&q=foo` | filtered + searched template list                 |

### 4.4 Questions (per gift)

| method | path                                              | body                                | returns           |
|--------|---------------------------------------------------|-------------------------------------|-------------------|
| GET    | `/gifts/:id/questions`                            | —                                   | ordered `Question[]` |
| POST   | `/gifts/:id/questions`                            | `{ source: "library", templateId } \| { source: "custom", text, preface? }` | `Question` |
| PATCH  | `/gifts/:id/questions/:qid`                       | `{ text?, preface?, position? }`    | `Question`        |
| DELETE | `/gifts/:id/questions/:qid`                       | —                                   | 204               |
| POST   | `/gifts/:id/questions/:qid/photo`                 | multipart `photo`                    | `{ photoUrl }`    |
| DELETE | `/gifts/:id/questions/:qid/photo`                 | —                                   | 204               |

### 4.5 AI personalization (already built — needs one more endpoint)

| method | path                          | body                                                                   | returns / behavior                                                                                                          |
|--------|-------------------------------|------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------|
| POST   | `/ai/converse`                | `{ topic: "about" \| "why", messages, intent, hint? }`                 | **already built** — Claude Opus 4.7. Returns next assistant message.                                                        |
| POST   | `/ai/summarize`               | `{ topic, messages }`                                                   | **already built** — Claude Opus 4.7. Returns `{ summary }` to merge into `about` / `why`.                                   |
| POST   | `/transcribe`                 | multipart `audio`                                                       | **already built** — Whisper. Returns `{ text }`.                                                                            |
| POST   | `/gifts/:id/suggest-questions`| —                                                                       | **NEEDS BUILDING.** Reads gift's `intent` + `about` + `why` + `people`, calls Claude with the question library as context, returns 6–10 personalized template-shaped suggestions (`{ id, text, source: "ai" }[]`). Persist in a new `AiSuggestion` table or just stream them back. |

System prompts for `/ai/converse` and `/ai/summarize` are in [`server/src/routes/ai.ts`](server/src/routes/ai.ts). They encode tone rules — keep these stable and **above** any per-request volatile content if you add prompt caching (currently below the 4K cache minimum, so caching is a no-op).

---

## 5. Endpoints — recipient side (NOT YET BUILT in UI)

The recipient never authenticates. They land via a tokenized link in the invitation email. The token is the auth.

| method | path                             | body                                       | returns / behavior                                                                |
|--------|----------------------------------|--------------------------------------------|-----------------------------------------------------------------------------------|
| GET    | `/r/:token`                      | —                                          | Returns the gift letter (giver's name, recipient name, ordered questions, any saved answers). Bumps `firstSeenAt` / `lastActiveAt`. |
| GET    | `/r/:token/questions/:qid`       | —                                          | Single question + previously-saved response (so they can resume mid-answer)        |
| POST   | `/r/:token/questions/:qid/text`  | `{ text }`                                 | Save text response                                                                |
| POST   | `/r/:token/questions/:qid/voice` | multipart `audio`                          | Upload to S3 → call Whisper → store both `audioUrl` + transcript. Both are kept (audio is the soul; transcript enables search/preview). |
| POST   | `/r/:token/questions/:qid/photo` | multipart `photo` + optional `{ caption }` | Upload, store URL, optional caption                                               |
| DELETE | `/r/:token/responses/:rid`       | —                                          | Recipient revoked an answer                                                       |

**No login. No "create account." No app download.** Per the spec, the parent never has to learn a system. The token is single-recipient single-gift.

---

## 6. File storage

S3 (or R2 / GCS — pick one). Three buckets / prefixes:

| prefix                      | content                                       | retention                                                  |
|-----------------------------|-----------------------------------------------|------------------------------------------------------------|
| `s3://ember/q-photos/`      | Custom-question photos (giver-uploaded)        | Lifetime of gift                                            |
| `s3://ember/r-photos/`      | Recipient photo answers                        | Lifetime of gift; included in time-lock release archive    |
| `s3://ember/r-audio/`       | Recipient voice answers (raw)                  | Lifetime of gift; included in time-lock release archive    |

**Audio decision:** keep the raw audio file alongside the transcript. The voice in the parent's voice is the product — losing it to keep only text would gut the experience. Transcripts exist for preview + search + accessibility.

**Pre-signed URL pattern** for uploads on the recipient side, since responses can be large and we don't want to proxy them through the API.

**Format constraints:** images cap at ~10MB. Audio cap at the Whisper limit (25MB). Convert to a single normalized format on the server (audio: m4a / opus; image: WebP) before storing the canonical version. Keep both originals and normalized for the archive.

---

## 7. Email

Pick one provider (Resend / Postmark / SendGrid). **Two transactional emails to start:**

### 7.1 Invitation (sent on `POST /gifts/:id/send`)
- **To:** `Gift.recipientEmail`
- **From:** `gifts@ember.app` (or whatever)
- **Subject:** `{giverName} sent you a Ember gift` (warm, not transactional-sounding)
- **Body:** Designed HTML — feels like a personal letter, not a notification. Includes the child's note (auto-generated for v1 with the line we use as the email preview: `"{recipientName} — I made you something. Open when you have a quiet minute."`). Single CTA: button to `https://ember.app/r/{accessToken}`.
- Plain-text fallback that uses the same warm tone.

### 7.2 Time-lock release (sent on the scheduled `timeLockAt`)
- **To:** giver's email
- **Subject:** `It's time. Your gift from {recipientName} has returned.`
- **Body:** Link to the assembled archive (web view). Optionally an attached PDF/EPUB for keepsake.

**Don't add other emails.** No "your gift hasn't been opened in 3 days" nudges, no "your parent answered a new question" notifications. Slowness is the feature.

---

## 8. Time-lock job

This is the operational part of the ritual. It's the most important non-UI piece of v1.

**Trigger:** when `now() >= Gift.timeLockAt AND Gift.releasedAt IS NULL AND Gift.status = 'sent'`.

**Implementation options (in order of preference for hackathon scope):**
1. **Cron tick + DB query.** A scheduled job (every 1h is fine — granularity isn't critical for "release on a date") scans for due gifts and triggers release. Simplest, no infrastructure beyond the DB.
2. **Scheduled queue jobs.** When the giver picks a `timeLockAt`, enqueue a job at that timestamp (BullMQ / Cloud Tasks / SQS Delay). More precise, requires a queue.

**Release flow:**
1. Mark `releasedAt`.
2. Compile the archive — server renders an HTML "book" of all `Response` rows, ordered by question, with audio playable inline. Optionally generate a PDF.
3. Email the giver the link (and PDF attachment if generated).
4. The archive lives behind a giver-authed URL: `GET /gifts/:id/archive` (only the giver, only after `releasedAt`).

**Special timeLockKind: `after_passing`.** Out of scope for v1 backend — needs a verification mechanism (a designated executor confirms, or a "still alive" check-in cadence). For v1, support `date` and stub `after_passing` as "not yet supported."

---

## 9. Auth + identity (recap of what's already there)

- Google OAuth via `api.xors.xyz`. Frontend hits `buildXorsSignInUrl(nextHint)`, XORS handles Google, redirects back to `/oauth?key=<encrypted>` on our domain. The Next.js route at [`web/app/oauth/route.ts`](web/app/oauth/route.ts) decrypts with `API_AES_KEY` / `API_IV_KEY` and sets the `xors_session` cookie.
- Server reads the cookie via [`server/src/lib/xors-identity.ts`](server/src/lib/xors-identity.ts), calls XORS `viewer` endpoint, derives `currentUser`. **In-memory user store** — first thing to migrate to Postgres.
- All gift endpoints should derive `userId` from `currentUser` and scope every query.

---

## 10. Migration plan from localStorage → API

Frontend currently writes to `localStorage` on every `update()`. To migrate without rewriting the UI:

1. **Add a `useGift()` hook** that wraps the same shape as `useOnboardingState()` but is backed by the API.
2. On first onboarding step (Welcome → Begin), `POST /gifts` to create a draft and store the `giftId` in localStorage.
3. Each `update()` becomes a debounced `PATCH /gifts/:id` (300ms is fine — the UI shouldn't block on saves).
4. On every page mount, `GET /gifts/:id` to hydrate (replacing the localStorage read).
5. Photos: replace data-URL storage in `questions/write` with `POST /gifts/:id/questions/:qid/photo` after the question is created.
6. Voice: `/transcribe` already returns text; nothing changes there for the **giver-side** voice fields. For the **recipient side**, voice uploads are full responses, not transient.

Drop the localStorage layer once API parity is reached. Keep the resume-mid-flow guarantee — if a user closes the tab on the Why screen, reopening should restore them there. The `currentStep` field on `Gift` plus a generic "land on `/onboarding/{step}`" router rule handles this.

---

## 11. Environment variables

Already in [`.env.example`](.env.example):

```
# XORS auth (required — without these /oauth fails)
API_AES_KEY=
API_IV_KEY=
NEXT_PUBLIC_XORS_OAUTH_DOMAIN=REDIRECT_BOSTON
XORS_AUTH_SOURCE=boston-hackathon.local

# Server
PORT=3001
CORS_ORIGIN=http://localhost:3000

# AI (we added)
OPENAI_API_KEY=sk-...           # Whisper STT
ANTHROPIC_API_KEY=sk-ant-...    # Claude conversations + summarize
```

**To add for full backend:**

```
DATABASE_URL=postgresql://...
S3_BUCKET=ember-prod
S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
EMAIL_PROVIDER_API_KEY=         # Resend / Postmark / etc.
EMAIL_FROM=gifts@ember.app
TIME_LOCK_BASE_URL=https://ember.app   # for invitation + release links
```

---

## 12. Open questions

- **Time-lock UX.** No screen exists yet for the giver to set the time-lock date / milestone. Where in the flow? Best guess: between Delivery and Send.
- **Multi-recipient.** Spec says one recipient per gift in v1. Confirm before designing schema flexibility.
- **Edit after send.** Dashboard says "add more questions anytime" — what's the policy? Can questions be removed after the recipient has answered them? My guess: add yes, remove no (would discard their answer).
- **Recipient identity drift.** If the recipient forwards their link, anyone with the URL can answer. Token rotation? Email-confirmation step? V1 likely accepts this risk.
- **Personalized AI question generation.** The v1 spec mentions "AI quietly personalizes prompt suggestions based on what the child shared during setup." Sketched as `POST /gifts/:id/suggest-questions` but the prompt design (and how suggestions interact with the curated library) needs a product call.
- **`after_passing` time-lock.** Out of scope for v1 implementation; product needs to design the verification flow.

---

## 13. Suggested build order

1. **Postgres + Prisma (or whatever).** Replace the in-memory user store. Schema for `User`, `Gift`, `Person`, `QuestionTemplate`, `Question`. Seed `QuestionTemplate` from [`web/app/onboarding/questions/_lib/library.ts`](web/app/onboarding/questions/_lib/library.ts).
2. **Gift CRUD + People + Questions endpoints** (§4). Wire the frontend to PATCH on every `update()`. Drop localStorage.
3. **S3 + photo upload** for custom questions.
4. **Send endpoint + invitation email** + `Recipient` row + tokenized URL.
5. **Recipient flow UI + endpoints** (§5). Voice upload + Whisper.
6. **Time-lock job** (§8) + release endpoint + archive view.
7. **AI question suggestions** (`/gifts/:id/suggest-questions`) + UI integration on the questions browse screen.

Steps 1–4 unblock the giver-side end-to-end. Step 5 unblocks the parent. Steps 6–7 close the loop.
