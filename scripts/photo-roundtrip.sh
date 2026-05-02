#!/usr/bin/env bash
# Giver-side photo round-trip: POST /gifts/:id/questions/:qid/photo (multipart),
# verify questions.photo_url is set, send the gift, then confirm the recipient
# view returns the photo URL on the matching question.
#
# Standalone — does not depend on /tmp/ember-e2e.sh state.
set -euo pipefail
BASE=${BASE:-http://localhost:3201}

note() { printf "\n==> %s\n" "$*"; }

note "Generate a 1×1 transparent PNG"
echo "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==" \
  | base64 -d > /tmp/ember-photo-curl.png
ls -la /tmp/ember-photo-curl.png

note "Create gift"
GIFT=$(curl -fsS -X POST "$BASE/gifts" -H 'content-type: application/json' -d '{"intent":"mom"}')
GID=$(echo "$GIFT" | jq -r .gift.id)
echo "GID=$GID"

note "Set recipient (required for /send)"
curl -fsS -X PATCH "$BASE/gifts/$GID" -H 'content-type: application/json' \
  -d '{"recipientName":"Test","recipientEmail":"test@example.com"}' \
  | jq '.gift | {recipientName, recipientEmail}'

note "Add a custom question"
CUSTOM=$(curl -fsS -X POST "$BASE/gifts/$GID/questions" -H 'content-type: application/json' \
  -d '{"source":"custom","text":"What does this photo bring back?"}')
QID=$(echo "$CUSTOM" | jq -r .question.id)
echo "QID=$QID"

note "Upload PNG to giver photo endpoint"
PHOTO_RES=$(curl -fsS -X POST "$BASE/gifts/$GID/questions/$QID/photo" \
  -F "photo=@/tmp/ember-photo-curl.png;type=image/png")
echo "$PHOTO_RES" | jq '.question | {id, photoUrl, hasPhoto: (.photoUrl != null)}'
HAS_PHOTO_URL=$(echo "$PHOTO_RES" | jq -r '.question.photoUrl != null')
[ "$HAS_PHOTO_URL" = "true" ] || { echo "FAIL: photoUrl not set after upload"; exit 1; }

note "GET /gifts/:id confirms photo URL persisted"
curl -fsS "$BASE/gifts/$GID" | jq --arg qid "$QID" '
  .questions[] | select(.id == $qid) | {id, text, photoUrl, hasPhoto: (.photoUrl != null)}
'

note "Send gift to get recipient token"
SEND=$(curl -fsS -X POST "$BASE/gifts/$GID/send")
TOKEN=$(echo "$SEND" | jq -r .recipient.accessToken)
echo "TOKEN=$TOKEN"

note "Recipient sees photoUrl on the matching question"
RECIPIENT_VIEW=$(curl -fsS "$BASE/r/$TOKEN")
echo "$RECIPIENT_VIEW" | jq --arg qid "$QID" '
  .questions[] | select(.id == $qid) | {id, text, photoUrl}
'
RECIPIENT_HAS=$(echo "$RECIPIENT_VIEW" | jq -r --arg qid "$QID" '.questions[] | select(.id == $qid) | .photoUrl != null')
[ "$RECIPIENT_HAS" = "true" ] || { echo "FAIL: recipient view missing photoUrl"; exit 1; }

note "Reject non-image upload as 400"
echo "not an image" > /tmp/ember-photo-curl.txt
HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  "$BASE/gifts/$GID/questions/$QID/photo" \
  -F "photo=@/tmp/ember-photo-curl.txt;type=text/plain")
[ "$HTTP" = "400" ] || { echo "FAIL: non-image expected 400, got $HTTP"; exit 1; }
echo "HTTP=$HTTP (correctly rejected)"

echo
echo "PHOTO ROUND-TRIP PASSED"
