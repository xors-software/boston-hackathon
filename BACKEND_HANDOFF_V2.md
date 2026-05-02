# Ember — Backend Handoff v2

Comprehensive, page-by-page backend spec covering everything the frontend currently collects, every route, every API call, and every state field. Supersedes [BACKEND_HANDOFF.md](BACKEND_HANDOFF.md) (which only covered child onboarding).

> Read sections 1–3 once. Treat sections 4–6 as reference — open the section that matches the page/endpoint you're working on.

---

## 1. Product context (mandatory read)

Ember is a **gift-based memory product**. The buyer/initiator is the adult child; the recipient is a parent or loved one. Two distinct flows:

- **Child (giver) flow** — onboard, curate questions, send a gift to a recipient.
- **Parent (recipient) flow** — receive an email with a tokenized link, journal at their own pace (text, voice, photo, AI chat), eventually share the journal back.

**Core ritual:** Child gives → parent fills → parent shares → child receives the archive.

**Brand non-negotiables that affect backend:**
- **No AI avatars. No simulation of the person. Ever.** The summarize/converse endpoints must never speak as the recipient or the giver.
- Privacy-first by default. The parent's journal is private to them until they explicitly share. After share, the journal is **archived (read-only)**.
- Voice is the soul of the input experience — **keep raw audio**, not just transcripts.
- Slowness is the feature. **No engagement loops or push notifications** nudging the parent.

---

## 2. What exists today

### 2.1 Frontend (Next.js 16, app router, Turbopack)

Routes under `web/app/`:

| Tier | Route | Source |
|---|---|---|
| Shared | `/login` | `web/app/login/page.tsx` |
| Child | `/onboarding/*` | `web/app/onboarding/**/page.tsx` |
| Child | `/dashboard` | `web/app/dashboard/page.tsx` |
| Parent | `/r/[token]/*` | `web/app/r/[token]/**/page.tsx` |
| Glue | `/oauth` | `web/app/oauth/route.ts` (XORS callback decrypt) |

State currently lives in `localStorage`:
- `ember:onboarding:v1` — child's gift-in-progress
- `ember:parent:{token}:v1` — recipient's journal state, scoped per token
- `ember:parent:recent-token` — last token this browser saw (used by `/login` to recover the parent's journal)

### 2.2 Backend (Elysia + Bun)

Already on `main`:
- `GET /auth/me`, `POST /auth/logout` — XORS-backed identity ([server/src/routes/auth.ts](server/src/routes/auth.ts), [server/src/lib/xors-identity.ts](server/src/lib/xors-identity.ts)). **In-memory user store** — must move to a real DB.
- `POST /messages/*` — example CRUD shape (in-memory).
- Eden client wired in [web/app/lib/api.ts](web/app/lib/api.ts) with `treaty<App>`.

Added in this PR:
- `POST /transcribe` — multipart `audio` → OpenAI Whisper → `{ text }` ([server/src/routes/transcribe.ts](server/src/routes/transcribe.ts)). Needs `OPENAI_API_KEY`.
- `POST /ai/converse` — Claude Opus 4.7 chat. Three topics with different system prompts: `about`, `why`, `parent-reflect` ([server/src/routes/ai.ts](server/src/routes/ai.ts)). Needs `ANTHROPIC_API_KEY`.
- `POST /ai/summarize` — distills a chat into prose appropriate to the topic.

### 2.3 Stubs to replace

- **All persistence** — every page writes to `localStorage`. See §7 for migration plan.
- **Question library (child)** — hardcoded in [web/app/onboarding/questions/_lib/library.ts](web/app/onboarding/questions/_lib/library.ts) (26 questions, 5 categories, 8 marked `suggested`).
- **Prompt library (parent)** — hardcoded in [web/app/r/[token]/_lib/prompts.ts](web/app/r/[token]/_lib/prompts.ts) (12 prompts).
- **Photos** — child custom-question photos and parent photo entries are inline data URLs (4MB cap on the child side, 4MB cap on the parent side). Needs S3 + multipart upload.
- **Audio** — voice recordings on the parent side currently transcribe-and-discard. The voice page persists only the transcript and a `durationSeconds` value. **Backend must keep raw audio.**
- **Send (child)** — `POST /onboarding/send` is a no-op locally; stamps `sentAt` in localStorage and shows the ack screen. No email is sent, no recipient row is created.
- **Recipient lookup by token** — currently mocked. The token in the URL is purely cosmetic; mock data is hardcoded for `Sofia` / `Mom`.
- **Login (parent)** — `/login` recipient form doesn't validate against any backend; it just routes to `/r/{recent-token}/journal`.

---

## 3. Architecture diagram

```
┌──────────────────┐                                    ┌──────────────────┐
│   CHILD (giver)  │  ─── XORS Google OAuth ────────▶  │  XORS identity   │
│                  │                                    │  (api.xors.xyz)  │
│  /login          │  ◀── xors_session cookie ────────  │                  │
│  /onboarding/*   │                                    └──────────────────┘
│  /dashboard      │                                              │
└────────┬─────────┘                                              │
         │                                                        │
         │ POST /gifts/:id/send                                  │
         ▼                                                        │
┌──────────────────┐  email invitation  ┌──────────────────┐    │
│   API SERVER     │ ─────────────────▶ │   PARENT inbox   │    │
│   (Elysia/Bun)   │                    │                  │    │
│                  │                    │  link contains   │    │
│  /transcribe     │ ◀────────────────  │  access token    │    │
│  /ai/*           │                    └────────┬─────────┘    │
│  /gifts/*        │                             │              │
│  /r/:token/*     │                             ▼              │
│  /auth/*         │                    ┌──────────────────┐    │
└────────┬─────────┘                    │  PARENT (web)    │    │
         │                              │                  │    │
         │ writes/reads                 │  /r/[token]/*    │ ◀──┘ same auth
         ▼                              │  /login (parent) │       optional
┌──────────────────┐                    └──────────────────┘
│   PERSISTENCE    │
│   - Postgres     │
│   - S3 (audio +  │
│     photos)      │
│   - email        │
│     provider     │
└──────────────────┘
```

---

## 4. Page-by-page breakdown

For every page: **route**, **purpose**, **what frontend reads/writes**, **API endpoints needed**, **edge cases**. Pages are listed in user-flow order, then alphabetically by section.

### 4A. Shared

#### `/login`
- **Purpose:** unified login that routes giver vs recipient.
- **Frontend:** `useUser()` (giver session), localStorage check for `ember:onboarding:v1` to auto-redirect signed-in givers (`→ /dashboard` if `sentAt`, else `→ /onboarding/account`). Recipient form posts email + password.
- **Endpoints needed:**
  - `GET /auth/me` (already exists) — for giver session check.
  - `POST /auth/recipient/login` — body `{ email, password }`, returns `{ token, redirectTo }`. Sets a recipient session cookie or returns a token to drop in the URL. **Not built.**
  - Giver path triggers XORS OAuth (already wired).
- **Edge cases:** if a giver is signed in but the user picks "I received a gift", we should still let them in (don't auto-redirect).

---

### 4B. Child (giver) flow

State key: `ember:onboarding:v1`. Steps tracked in `currentStep` field; pages always update it on entry so resume-from-where-you-left-off works.

#### `/onboarding`  →  step `welcome`
- **Purpose:** warm welcome card.
- **Collects:** nothing.
- **Endpoint:** `POST /gifts` to create a draft and store the gift ID. (Currently localStorage-only.)
- **Edge:** if a draft already exists, just continue.

#### `/onboarding/intent`  →  step `intent`
- **Purpose:** "Who are you here for?"
- **Collects:** `intent: "mom" | "dad" | "loved-one" | "undecided"`.
- **Endpoint:** `PATCH /gifts/:id { intent }`.

#### `/onboarding/account`  →  step `account`
- **Purpose:** Google sign-in via XORS. Persists user email to gift state. After sign-in, if `sentAt` is set, redirects to `/dashboard`.
- **Collects:** `email` (from `useUser()`).
- **Endpoint:** existing `GET /auth/me`. After successful sign-in, `PATCH /gifts/:id { ownerUserId }` if not already linked.

#### `/onboarding/recipient`  →  step `recipient`
- **Purpose:** "Tell us a little about them." 500-char textarea + voice input.
- **Collects:** `about: string` (≤ 500 chars).
- **Endpoints:**
  - `POST /transcribe` (multipart audio) — already exists.
  - `PATCH /gifts/:id { about }`.
- **Edge:** voice transcript is appended (with a space) to existing text; capped at 500.

#### `/onboarding/recipient/ai`  →  step stays `recipient`, intermediate
- **Purpose:** "Let's talk about her/him/them." Multi-turn AI chat that distills into the `about` field.
- **Collects:** `about` (overwritten/merged with the AI summary).
- **Endpoints:**
  - `POST /ai/converse` with `{ topic: "about", messages, intent, hint: priorAbout }` — already exists.
  - `POST /ai/summarize` with `{ topic: "about", messages }` — already exists.
  - `PATCH /gifts/:id { about }`.
- **Edge:** AI initiates with the first question on mount (empty `messages` array). Voice button on chat input (Whisper). On "End conversation", merges summary with prior `about`, capped at 2000.

#### `/onboarding/why`  →  step `why`
- **Purpose:** "Why do you want to make this for them?" 800-char textarea + voice.
- **Collects:** `why: string` (≤ 800 chars).
- **Endpoints:** same as `/onboarding/recipient` but for `why`.

#### `/onboarding/why/ai`  →  step stays `why`, intermediate
- **Purpose:** "Why this gift, why now?" AI chat. Distills into `why`.
- **Collects:** `why` (merged with AI summary).
- **Endpoints:** `POST /ai/converse` and `POST /ai/summarize` with `topic: "why"`.

#### `/onboarding/world`  →  step `world`
- **Purpose:** "Who's in her/his/their world?" Add/edit/remove people.
- **Collects:** `people: Person[]` where `Person = { id, name, relationship, age?, description }`.
- **Endpoints:**
  - `POST /gifts/:id/people` — single create.
  - `PATCH /gifts/:id/people/:pid` — update.
  - `DELETE /gifts/:id/people/:pid`.
  - `PUT /gifts/:id/people` (full replace) — easier for the frontend's "save the array" pattern.
  - `POST /transcribe` for the description voice button.
- **Edge:** description voice transcript appended (240 char cap on description).

#### `/onboarding/questions`  →  step `questions`
- **Purpose:** browse + select questions. Search, category filters (Suggested / Childhood / Love / Wisdom / Everyday / Their story), tap-to-toggle. Footer counter "N selected · 3 minimum" + Review.
- **Collects:** `questions.selectedIds: string[]`.
- **Endpoints:**
  - `GET /question-templates?category=&q=` — list/search the curated catalog. Catalog lives in DB; seed from [web/app/onboarding/questions/_lib/library.ts](web/app/onboarding/questions/_lib/library.ts).
  - `POST /gifts/:id/questions` — add a library question by `templateId`.
  - `DELETE /gifts/:id/questions/:qid` — remove.
  - **(Optional)** `POST /gifts/:id/suggest-questions` — AI-personalized suggestions based on `about` + `why` + `people`. Sketched in §5.
- **Edge:** "Suggested" tab shows hand-curated `suggested: true` templates plus all custom questions. Search filters all questions globally.

#### `/onboarding/questions/write`  →  step stays `questions`, intermediate
- **Purpose:** custom question. Text (280 char) + optional photo (4MB cap) + optional preface.
- **Collects:** appends to `questions.custom: CustomQuestion[]` and auto-selects the new ID.
- **Endpoints:**
  - `POST /gifts/:id/questions` with `{ source: "custom", text, preface? }` returns `{ id }`.
  - `POST /gifts/:id/questions/:qid/photo` (multipart `photo`) — uploads to S3, returns `{ photoUrl }`.

#### `/onboarding/questions/review`  →  step stays `questions`, intermediate
- **Purpose:** review selected, inline edit text, remove, add more.
- **Collects:**
  - `questions.edits: Record<string, string>` — overrides for library question text (preserves the original template).
  - `questions.custom[i].text` — direct edit for custom.
  - `questions.selectedIds` — removal pulls IDs out.
- **Endpoints:**
  - `PATCH /gifts/:id/questions/:qid { text }` — works for both library and custom; backend stores the override on the per-gift `Question` row regardless of source.
  - `DELETE /gifts/:id/questions/:qid`.

#### `/onboarding/delivery`  →  step `delivery`
- **Purpose:** "How would you like to give this gift?" Three options. Email default; Physical letter shows "Coming soon"; In person selectable.
- **Collects:** `delivery: "email" | "in-person"` (`"physical"` enum reserved but disabled).
- **Endpoint:** `PATCH /gifts/:id { delivery }`.

#### `/onboarding/send`  →  step `send`
- **Purpose:** "Ready to send." Email-style preview + summary rows (For / Delivery / Questions). Inline edit recipient name + email. Confirmation modal.
- **Collects:** `recipientName`, `recipientEmail` (required when delivery = email).
- **Endpoints:**
  - `PATCH /gifts/:id { recipientName, recipientEmail }`.
  - `POST /gifts/:id/send` — validates (≥1 question selected, recipientEmail valid if delivery = email), creates `Recipient` row + access token, queues invitation email, returns `{ sentAt, recipient: { accessToken } }`. **Not built.**
- **Idempotency:** the send endpoint must be idempotent on `sentAt`. If already sent, return current state.

#### `/onboarding/sent`  →  step `complete`
- **Purpose:** "It's on its way." Acknowledgement. "Go to dashboard" link.
- **Endpoints:** none.

#### `/dashboard`
- **Purpose:** post-send dashboard. "For {recipientName}." with sent date + delivery + status + question count + "+ Add a question" + Settings/Help links.
- **Collects:** displays `sentAt`, `delivery`, `recipientName`, `questions.selectedIds.length`.
- **Endpoints:** `GET /gifts/:id` to load full state.
- **Edge:** redirects to `/onboarding` if no `sentAt` is in state.

---

### 4C. Parent (recipient) flow

State key: `ember:parent:{token}:v1`. Steps: `welcome → letter → how-it-works → account → home`.

The recipient never authenticates against XORS. The token is the auth surface; an optional email/password account is collected on the `account` step so they can return on any device.

#### `/r/[token]`  →  step `welcome`
- **Purpose:** "Take your time." Cream eyebrow `A GIFT FROM {giverName}` + message.
- **Reads from backend:** `giverName`, `giverPronoun`, recipient's name (for the avatar initial later).
- **Endpoint:** `GET /r/:token` — returns the gift envelope (giver name, recipient name, personal letter, prompts, share state, account flag).
- **Edge:** if `step !== "welcome"` (returning visit), `router.replace()`s to wherever they left off. If `accountCreated` and journal exists, lands on `/r/[token]/journal` (the future direction of this redirect — see §10 open questions).

#### `/r/[token]/letter`  →  step `letter`
- **Purpose:** the personal letter from the giver. Serif typography, paginated footer.
- **Reads:** `personalMessage` (string, optional). If null, frontend renders a generic warm letter.
- **Endpoint:** `GET /r/:token` — already covers this. Backend should optionally provide `personalMessage` if the giver wrote one (currently no UI for the giver to author one — see §10 open questions).

#### `/r/[token]/start`  →  step `how-it-works`
- **Purpose:** "Three things to know." Static explainer.
- **Endpoints:** none.

#### `/r/[token]/account`  →  step `account`
- **Purpose:** "Save your space." Email (pre-filled from invitation) + password.
- **Collects:** `email`, `accountCreated: true`.
- **Endpoint:** `POST /r/:token/account { email, password }` — creates a recipient login. Backend hashes the password server-side; frontend never persists it. **Not built.**
- **Edge:** the email field shows "Pre-filled from the invitation" — backend must seed it from the recipient row that was created at gift-send time.

#### `/r/[token]/home`  →  step `home` (Today tab)
- **Purpose:** "What do you feel like writing today?" with the **EntryComposer** + three starting points (Pick a prompt / Talk it through / Record voice). Avatar menu (sign out) in top right.
- **Collects:** appends to `entries: JournalEntry[]` via the composer.
- **Endpoint:** `POST /r/:token/entries` — see §5.5.
- **Archived view:** if `sharing.sharedAt` is set, the headline becomes "Your journal is shared." and the composer + starting points are replaced by an archived card linking to the journal.

#### `/r/[token]/journal` (Journal tab)
- **Purpose:** three sub-views: List (grouped by month), Calendar (interactive — tap day to filter), Media (photo + audio entries). FAB "+ New entry".
- **Reads:** all `entries`.
- **Endpoint:** `GET /r/:token/entries` — list, sorted desc by `createdAt`.
- **Archived view:** banner at top showing "Archived · Shared on {date}". FAB hidden.

#### `/r/[token]/journal/new`
- **Purpose:** dedicated composer screen (FAB target + prompt-tap target).
- **Optional query param:** `?promptId=p1` — pre-fills the prompt context.
- **Collects:** new `JournalEntry` (text + optional photo + optional `promptId`/`promptText`).
- **Endpoint:** `POST /r/:token/entries`.
- **Archived:** redirects to `/r/[token]/journal`.

#### `/r/[token]/prompts` (Prompts tab)
- **Purpose:** prompt list with two filters (All / Used). Used prompts greyed out at the bottom. Tapping an unused prompt → `/r/[token]/journal/new?promptId=…`.
- **Reads:** prompt library + entries (to determine "used").
- **Endpoints:**
  - `GET /r/:token/prompts` — returns the prompts the giver curated for this gift (from the giver's `Question` rows on the gift).
  - "Used" derived client-side from `entries` where `promptId` matches.
- **Archived:** all prompts disabled, banner at top.

#### `/r/[token]/ai`
- **Purpose:** chat with Ember (parent-reflect tone). "Save as journal entry" distills the conversation into a journal entry.
- **Collects:** appends to `entries` with `source: "ai"` and `text` = the summary.
- **Endpoints:**
  - `POST /ai/converse` `{ topic: "parent-reflect", messages, intent: "n/a" }` — already exists.
  - `POST /ai/summarize` `{ topic: "parent-reflect", messages }` — already exists.
  - `POST /r/:token/entries` `{ source: "ai", text }`.
- **Archived:** "Save" button disabled.

#### `/r/[token]/voice`
- **Purpose:** dedicated voice note screen. Big record button → live timer → Whisper → transcript review (editable) → save.
- **Collects:** `JournalEntry` with `source: "voice"`, `text` = transcript, `durationSeconds`.
- **Endpoints:**
  - `POST /transcribe` (already exists).
  - `POST /r/:token/entries` `{ source: "voice", text, audioBlobId, durationSeconds }`. **Backend must accept and store the raw audio file** — see §6.
- **Archived:** redirects to `/r/[token]/journal`.

#### `/r/[token]/share` (Share tab)
- **Purpose:** sharing settings + "Share what I've written so far" button. Sharing is **one-time → archives**.
- **Reads/Writes:** `sharing: SharingState`.
- **Endpoints:**
  - `GET /r/:token/sharing` (could be folded into `GET /r/:token`).
  - `POST /r/:token/share` — performs the actual share. Sets `sharedAt`, snapshots `entries`, queues an email notification to the giver, locks the recipient's journal as archived. **Not built.**
- **Archived view:** "Currently set to" + change/share buttons replaced by a single "Archived · Shared with {giver} on {date} · {N} entries sent." card.

#### `/r/[token]/share/when`
- **Purpose:** "How and when to share." Picker with 4 modes: `when-ready`, `legacy`, `date`, `milestone`. Date and milestone require a specific calendar date (milestone "In one year" auto-fills).
- **Collects:** `sharing.mode`, `sharing.date?`, `sharing.milestonePreset?`, `sharing.milestoneText?`.
- **Endpoint:** `PATCH /r/:token/sharing { mode, date?, milestonePreset?, milestoneText? }`.

#### `/r/[token]/share/done`
- **Purpose:** "It's on its way. {Subject} has it." Success ack.
- **Endpoints:** none.

---

## 5. API endpoint reference

All endpoints require auth except `/r/:token/*` (token-authenticated) and the public OAuth flow.

### 5.1 Auth

Already exists. For completeness:

| Method | Path | Body | Returns | Notes |
|---|---|---|---|---|
| GET | `/auth/me` | — | `{ user }` or 401 | Reads `xors_session` cookie. |
| POST | `/auth/logout` | — | `{ ok: true }` | Clears cookie. |

To add for the unified `/login` and parent account:

| Method | Path | Body | Returns | Notes |
|---|---|---|---|---|
| POST | `/auth/recipient/login` | `{ email, password }` | `{ token, redirectTo }` | Looks up by email, sets recipient session cookie. |
| POST | `/r/:token/account` | `{ email, password }` | `{ ok: true }` | Creates the recipient login at the account-creation step. Hash password server-side. |
| POST | `/auth/recipient/logout` | — | `{ ok: true }` | Optional — cookie clear. |

### 5.2 Gifts (giver-side)

All require giver auth. Scope every query by `userId`.

| Method | Path | Body | Returns | Notes |
|---|---|---|---|---|
| POST | `/gifts` | `{ intent? }` | `Gift` | Creates draft. |
| GET | `/gifts` | — | `Gift[]` | List user's gifts. |
| GET | `/gifts/:id` | — | `Gift` (with people, questions) | Full read. |
| PATCH | `/gifts/:id` | partial Gift fields | `Gift` | Update intent/about/why/delivery/recipient/currentStep/timeLock. |
| DELETE | `/gifts/:id` | — | 204 | Hard delete if `status="draft"`, soft archive otherwise. |
| POST | `/gifts/:id/send` | — | `{ sentAt, recipient: { accessToken } }` | Idempotent on `sentAt`. Validates: ≥1 question selected, recipientEmail valid if delivery=email. Creates `Recipient` row, queues invitation email. |

### 5.3 People (per-gift)

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/gifts/:id/people` | — | `Person[]` |
| POST | `/gifts/:id/people` | `{ name, relationship, age?, description }` | `Person` |
| PATCH | `/gifts/:id/people/:pid` | partial fields | `Person` |
| DELETE | `/gifts/:id/people/:pid` | — | 204 |
| PUT | `/gifts/:id/people` | `Person[]` | `Person[]` (full replace, easier for frontend bulk-save) |

### 5.4 Questions (per-gift)

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/gifts/:id/questions` | — | `Question[]` ordered by `position` |
| POST | `/gifts/:id/questions` | `{ source: "library", templateId } \| { source: "custom", text, preface? }` | `Question` |
| PATCH | `/gifts/:id/questions/:qid` | `{ text?, preface?, position? }` | `Question` |
| DELETE | `/gifts/:id/questions/:qid` | — | 204 |
| POST | `/gifts/:id/questions/:qid/photo` | multipart `photo` | `{ photoUrl }` |
| DELETE | `/gifts/:id/questions/:qid/photo` | — | 204 |
| GET | `/question-templates?category=&q=` | — | `QuestionTemplate[]` (catalog) |

### 5.5 Recipient (parent-side, token-authenticated)

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/r/:token` | — | `{ giver: {name, pronoun}, recipient: {name, email}, personalMessage?, prompts: ParentPrompt[], sharing: SharingState, accountCreated }` |
| GET | `/r/:token/entries` | — | `JournalEntry[]` (most recent first) |
| GET | `/r/:token/entries/:eid` | — | `JournalEntry` (full) |
| POST | `/r/:token/entries` | `{ source, text?, promptId?, preface? }` | `JournalEntry` |
| PATCH | `/r/:token/entries/:eid` | partial fields | `JournalEntry` |
| DELETE | `/r/:token/entries/:eid` | — | 204 |
| POST | `/r/:token/entries/:eid/photo` | multipart `photo` | `{ photoUrl }` |
| POST | `/r/:token/entries/:eid/audio` | multipart `audio` | `{ audioUrl, durationSeconds }` |
| GET | `/r/:token/prompts` | — | `ParentPrompt[]` (the questions the giver curated, exposed as recipient prompts) |
| GET | `/r/:token/sharing` | — | `SharingState` (or include in `GET /r/:token`) |
| PATCH | `/r/:token/sharing` | `{ mode, date?, milestonePreset?, milestoneText? }` | `SharingState` |
| POST | `/r/:token/share` | — | `SharingState` (with `sharedAt` set). One-time; subsequent calls return current state. Snapshots `entries.length` and notifies giver via email. |

### 5.6 AI (already built)

| Method | Path | Body | Returns | Notes |
|---|---|---|---|---|
| POST | `/transcribe` | multipart `audio` | `{ text }` | OpenAI Whisper. ≤25 MB. |
| POST | `/ai/converse` | `{ topic: "about" \| "why" \| "parent-reflect", messages, intent, hint? }` | `{ message }` | Claude Opus 4.7. Three system prompts in [server/src/routes/ai.ts](server/src/routes/ai.ts). |
| POST | `/ai/summarize` | `{ topic, messages }` | `{ summary }` | Distills conversation into prose appropriate to the topic. |

To add (optional, mentioned in v1 spec):

| POST | `/gifts/:id/suggest-questions` | — | `{ suggestions: { id, text }[] }` | Reads gift's `intent` + `about` + `why` + `people`, calls Claude with the curated library as context, returns 6–10 personalized template-shaped suggestions. |

---

## 6. Data model

```
User                 (1) ──< Gift (N)
Gift                 (1) ──< Question (N)
Gift                 (1) ──< Person (N)
Gift                 (1) ──< Recipient (1)        // single recipient per gift in v1
Recipient            (1) ──< JournalEntry (N)
Recipient            (1) ──< Sharing (1)
QuestionTemplate     (catalog, workspace-wide; not per-user)
```

### 6.1 `User`

| field | type | notes |
|---|---|---|
| id | uuid / `usr_...` | PK |
| xorsUserId | string | from XORS viewer; unique |
| email | string | from XORS |
| displayName | string \| null | from XORS |
| pronoun | jsonb \| null | `{ subject, possessive, object }` — **not yet collected during onboarding**, see §10. Used by parent UI for "Read what {she} wrote." |
| createdAt | timestamptz | |

### 6.2 `Gift`

| field | type | notes |
|---|---|---|
| id | uuid / `gft_...` | PK |
| userId | uuid | FK → User (the giver) |
| intent | enum | `mom` \| `dad` \| `loved-one` \| `undecided` |
| about | text | freeform; AI summary may be merged in |
| why | text | freeform; AI summary may be merged in |
| delivery | enum | `email` \| `in-person` (`physical` reserved, disabled in UI) |
| recipientName | string | defaults from intent ("Mom"/"Dad"/"Them") |
| recipientEmail | string \| null | required when delivery=email at send time |
| personalMessage | text \| null | giver-authored letter to the parent — **no UI yet** to collect, parent renders a generic letter when null |
| currentStep | enum | mirrors `OnboardingStep` for resume |
| status | enum | `draft` \| `sent` \| `archived` |
| sentAt | timestamptz \| null | |
| createdAt | timestamptz | |
| updatedAt | timestamptz | |

### 6.3 `Person` (people in recipient's world)

| field | type | notes |
|---|---|---|
| id | uuid | PK |
| giftId | uuid | FK |
| name | string | |
| relationship | string | free text |
| age | string | free text ("6", "early 30s", etc.) |
| description | text | ≤ 240 chars |
| position | int | display order |

### 6.4 `QuestionTemplate` (catalog)

| field | type | notes |
|---|---|---|
| id | string | e.g. `tpl_ch1`; stable for AI re-suggestion |
| text | text | |
| categories | string[] | `childhood` / `love` / `wisdom` / `everyday` / `their-story` |
| suggested | bool | hand-curated default suggestion flag |
| createdAt | timestamptz | |

Seed from [web/app/onboarding/questions/_lib/library.ts](web/app/onboarding/questions/_lib/library.ts).

### 6.5 `Question` (per-gift selection)

| field | type | notes |
|---|---|---|
| id | uuid | PK |
| giftId | uuid | FK |
| source | enum | `library` \| `custom` |
| templateId | string \| null | FK → QuestionTemplate when source=library |
| text | text | the actual text shown to the recipient (overrides template if edited on the review screen) |
| photoUrl | string \| null | S3 URL |
| preface | text \| null | optional intro line for photo questions |
| position | int | display order |
| createdAt | timestamptz | |

The frontend's three-bucket shape (`selectedIds + custom + edits`) collapses to a single sorted `Question[]` per gift on the backend.

### 6.6 `Recipient`

| field | type | notes |
|---|---|---|
| id | uuid | PK |
| giftId | uuid | FK; **unique** (one recipient per gift in v1) |
| accessToken | string | opaque, unguessable; in the email link |
| email | string | mirror of Gift.recipientEmail at send time |
| name | string | mirror of Gift.recipientName |
| passwordHash | string \| null | populated when they create an account on `/r/:token/account` |
| accountCreatedAt | timestamptz \| null | |
| firstSeenAt | timestamptz \| null | first time they hit `/r/:token` |
| lastActiveAt | timestamptz \| null | |

### 6.7 `JournalEntry`

| field | type | notes |
|---|---|---|
| id | uuid | PK |
| recipientId | uuid | FK |
| giftId | uuid | FK (denormalized for query convenience) |
| source | enum | `free-write` \| `prompt` \| `ai` \| `voice` \| `photo` |
| text | text \| null | body (or transcript for voice/ai) |
| promptId | string \| null | references the giver's `Question.id` (or one of the pre-seeded prompts the giver didn't author) |
| promptText | text \| null | snapshot of the prompt at write time (in case the giver edits it later) |
| photoUrl | string \| null | S3 |
| audioUrl | string \| null | S3 — **raw audio, kept** |
| durationSeconds | int \| null | for voice |
| preface | text \| null | mirrors the giver's question preface if applicable |
| createdAt | timestamptz | |

### 6.8 `Sharing` (one per Recipient)

| field | type | notes |
|---|---|---|
| recipientId | uuid | PK |
| mode | enum | `when-ready` \| `legacy` \| `date` \| `milestone` |
| date | date \| null | required when `mode=date` or `mode=milestone` |
| milestonePreset | enum \| null | `future-birthday` \| `anniversary` \| `in-one-year` \| `custom` |
| milestoneText | text \| null | for `milestonePreset=custom` |
| sharedAt | timestamptz \| null | when share was performed; immutable once set |
| lastSharedSnapshotCount | int \| null | entries.length at the moment of share |

**Sharing is one-time in v1.** Once `sharedAt` is set, the recipient's journal becomes read-only and the giver receives an archive notification.

### 6.9 Enum reference

```ts
type OnboardingStep =
  | "welcome" | "intent" | "account" | "recipient"
  | "why" | "world" | "questions" | "delivery"
  | "send" | "complete"

type ParentStep =
  | "welcome" | "letter" | "how-it-works" | "account" | "home"

type SharingMode = "when-ready" | "legacy" | "date" | "milestone"
type MilestonePreset = "future-birthday" | "anniversary" | "in-one-year" | "custom"
type EntrySource = "free-write" | "prompt" | "ai" | "voice" | "photo"
type DeliveryMethod = "email" | "in-person"   // "physical" reserved, disabled
type Intent = "mom" | "dad" | "loved-one" | "undecided"
```

---

## 7. File storage

S3 (or R2 / GCS — pick one). Three logical prefixes:

| Prefix | Content | Retention |
|---|---|---|
| `s3://ember/q-photos/` | Custom-question photos (giver-uploaded) | Lifetime of gift |
| `s3://ember/r-photos/` | Recipient photo entries | Lifetime of journal |
| `s3://ember/r-audio/` | Recipient voice notes (raw) | Lifetime of journal |

**Audio decision:** keep the raw audio alongside the transcript. The voice in the parent's voice IS the product — losing it to keep only text would gut the experience. Transcripts exist for preview, search, and accessibility.

**Pre-signed URL pattern** for uploads on the recipient side, since voice notes can be large and we don't want to proxy them through the API.

**Format constraints:**
- Images cap at ~10 MB. Convert to a normalized format (WebP) on save; keep originals + normalized.
- Audio cap at the Whisper limit (~25 MB). Browser MediaRecorder produces `audio/webm` (Chrome/Firefox) or `audio/mp4` (Safari). Whisper accepts both. Keep both raw and transcript.

---

## 8. Email

Pick one provider (Resend / Postmark / SendGrid).

### 8.1 Invitation (sent on `POST /gifts/:id/send`)
- **To:** `Gift.recipientEmail`.
- **From:** `gifts@ember.app` (or whatever).
- **Subject:** something warm, not transactional. Example: `{giverName} sent you something to take your time with.`
- **Body:** designed HTML; reads like a personal letter, not a notification. Includes the email preview line shown on the giver's send screen: `"{recipientName} — I made you something. Open when you have a quiet minute."` Single CTA button to `https://ember.app/r/{accessToken}`.
- **Plain-text fallback** with the same warm tone.

### 8.2 Share notification (sent on `POST /r/:token/share`)
- **To:** giver's email.
- **Subject:** `{recipientName} shared their journal with you.`
- **Body:** "She/he/they wrote to you. Here's what they shared." Link to a giver-authed archive view (read-only — the giver-side of the parent's shared journal).

**No other emails.** No "your gift hasn't been opened" nudges, no "new entry written" notifications. Slowness is the feature.

---

## 9. Sharing & archival logic (one-time)

This is the operational heart of v1's parent side.

**`POST /r/:token/share` flow:**
1. Read `Sharing.sharedAt`. If non-null → return current state (idempotent).
2. Set `sharedAt = NOW()`.
3. Snapshot `lastSharedSnapshotCount = COUNT(entries WHERE recipientId = ?)`.
4. Compile the archive (server-side render — HTML "book" of all entries ordered by `createdAt`, audio playable inline). Optionally generate PDF/EPUB.
5. Email the giver with the archive link.
6. Mark the recipient's journal as archived (read-only — enforced at write endpoints).

**Write enforcement:**
- `POST /r/:token/entries` and the photo/audio endpoints must return 409 once `sharedAt` is set.
- The frontend already hides write affordances when archived, but server enforcement is required.

**Time-lock modes (`mode != "when-ready"`):**
- `date` / `milestone`: a scheduled job checks `WHERE date <= today AND sharedAt IS NULL` and triggers the share automatically.
  - **Implementation:** cron tick every hour, or scheduled queue jobs (BullMQ / Cloud Tasks / SQS Delay) enqueued at the chosen date.
- `legacy`: out of scope for v1 implementation — needs a verification mechanism (executor confirmation, "still alive" check-in cadence, etc.). For v1, accept the value but don't auto-trigger.
- `when-ready`: never auto-triggers; only manual.

---

## 10. Migration plan: localStorage → API

Frontend currently writes to `localStorage` on every `update()`. To migrate without rewriting the UI:

### Giver side
1. Add a `useGift()` hook with the same shape as `useOnboardingState()` but backed by the API.
2. On Welcome → Begin, `POST /gifts` to create a draft and store the `giftId` in localStorage (only the ID — everything else moves server-side).
3. Each `update()` becomes a debounced `PATCH /gifts/:id` (300ms is fine).
4. On every page mount, `GET /gifts/:id` to hydrate.
5. Photos: replace data-URL storage in `questions/write` with `POST /gifts/:id/questions/:qid/photo` once the question row exists.

### Parent side
1. Add a `useParentJournal(token)` hook backed by `GET /r/:token` + `GET /r/:token/entries`.
2. Replace each composer save with `POST /r/:token/entries`.
3. Photos: same multipart pattern.
4. Voice: upload audio via multipart `POST /r/:token/entries/:eid/audio`; backend transcribes server-side instead of (or in addition to) client-side `/transcribe`.
5. Sharing state: backed by `GET /r/:token/sharing` + `PATCH /r/:token/sharing`.

Drop the localStorage layer once API parity is reached. Keep the resume-mid-flow guarantee — `currentStep` on the gift / parent-step on the recipient row plus a generic "land on `/onboarding/{step}` or `/r/[token]/{step}`" router rule handles this.

---

## 11. Environment variables

Currently in [.env.example](.env.example):

```
# XORS auth (required for child-side OAuth — without these /oauth fails)
API_AES_KEY=
API_IV_KEY=
NEXT_PUBLIC_XORS_OAUTH_DOMAIN=REDIRECT_BOSTON
XORS_AUTH_SOURCE=boston-hackathon.local

# Server
PORT=3001
CORS_ORIGIN=http://localhost:3000

# AI (added in this work)
OPENAI_API_KEY=sk-...           # Whisper (transcription on every voice surface)
ANTHROPIC_API_KEY=sk-ant-...    # Claude Opus 4.7 (converse + summarize)
```

To add for the full backend:

```
DATABASE_URL=postgresql://...
S3_BUCKET=ember-prod
S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
EMAIL_PROVIDER_API_KEY=         # Resend / Postmark / etc.
EMAIL_FROM=gifts@ember.app
APP_BASE_URL=https://ember.app  # invitation links + archive links
SCHEDULED_SHARE_CRON=0 * * * *  # if cron-tick model; or skip if using delayed queue
```

**Local-dev OAuth:** the production-registered XORS domain (`REDIRECT_BOSTON`) redirects to the prod URL. For local dev sign-in, ask whoever runs `api.xors.xyz` to register `REDIRECT_BOSTON_LOCAL` → `http://localhost:3000/oauth`, then set `NEXT_PUBLIC_XORS_OAUTH_DOMAIN=REDIRECT_BOSTON_LOCAL` in your local `.env`. As a workaround until then, manually edit the host in the redirect URL from `boston-hackathon.up.railway.app` to `localhost:3000` (the same `API_AES_KEY` / `API_IV_KEY` will decrypt locally).

---

## 12. AI prompts (stable text — keep in sync with [server/src/routes/ai.ts](server/src/routes/ai.ts))

Three topics, three system prompts. All target **Claude Opus 4.7** (`claude-opus-4-7`).

- `about` — used on `/onboarding/recipient/ai`. Goal: gather 4–6 small concrete details about the recipient.
- `why` — used on `/onboarding/why/ai`. Goal: help the giver articulate why they want to make this gift.
- `parent-reflect` — used on `/r/:token/ai`. Goal: keep the parent company while they think out loud.

Summarize prompts mirror each topic. The `parent-reflect` summarizer writes in **first-person from the parent's voice** for direct insertion as a journal entry.

The conversation system prompts are well under Opus 4.7's 4K-token caching minimum, so prompt caching is currently a no-op. If they grow, place stable content (the persona block) before any volatile content (intent + hint) so the cache prefix stays valid.

---

## 13. Open questions for product

- **Personal letter UI (giver).** No screen exists yet for the giver to author the letter the parent reads on `/r/[token]/letter`. The parent-side renders a generic warm letter when `personalMessage` is null. Where should this live in the giver flow? Suggest: between Send-confirm and Sent.
- **Giver pronoun.** The parent side says "Read what {she/he/they} wrote." We never collect the giver's pronoun. Quickest fix: a single "How should they refer to you?" radio on the giver `/onboarding/account` step.
- **Time-lock UX (giver).** No screen exists for the giver to set a time-lock date / milestone. (The original v1 spec mentions this; the parent now sets it on their side via `/r/:token/share/when`.) Decide if the time-lock is giver-driven, parent-driven, or both.
- **Re-login routing.** Currently `/login` (recipient path) routes to `/r/{recent-token}/journal`. After backend lookup, it should resolve `email + password → token → journal`. Plus, on `/r/[token]` for a returning visitor, we currently redirect by `step`; should it always go to `/journal` if the parent has any entries? (Implementation detail in [r/[token]/page.tsx](web/app/r/[token]/page.tsx).)
- **Multi-recipient.** Spec says one recipient per gift in v1. Confirm before designing schema flexibility.
- **Edit after send.** Dashboard says "add more questions anytime." Add: yes. Remove a question after the recipient has answered it: probably no (would discard their entries). Confirm.
- **`legacy` time-lock.** Out of scope for v1 implementation; needs a verification flow.
- **Personalized AI question generation.** v1 spec mentions "AI quietly personalizes prompt suggestions based on what the child shared during setup." Sketched as `POST /gifts/:id/suggest-questions`; the prompt design and how suggestions interact with the curated library needs a product call.

---

## 14. Suggested build order

1. **Postgres + Prisma (or whatever).** Replace the in-memory user store. Schema for `User`, `Gift`, `Person`, `QuestionTemplate`, `Question`, `Recipient`, `JournalEntry`, `Sharing`. Seed `QuestionTemplate` from the frontend library.
2. **Gift CRUD + People + Questions endpoints** (§5.2–5.4). Wire the giver frontend to PATCH on every `update()`. Drop `ember:onboarding:v1` from localStorage.
3. **S3 + photo upload** for custom questions (giver) and photo entries (parent).
4. **Send endpoint + invitation email** + `Recipient` row + tokenized URL.
5. **Recipient endpoints (§5.5)** + parent frontend wired to API. Audio upload + Whisper.
6. **Sharing + archive flow** (§9). Includes `POST /r/:token/share`, server-rendered archive view for the giver, share notification email.
7. **Time-lock cron** for `date` / `milestone` modes.
8. **AI question suggestions** (`POST /gifts/:id/suggest-questions`) + UI integration on the questions browse screen.
9. **Personal letter authoring** for the giver (after product call).
10. **Pronoun collection** (after product call).

Steps 1–5 unblock the giver-side end-to-end and give the parent a working journal. Step 6 closes the loop. Steps 7–10 are polish/extras.
