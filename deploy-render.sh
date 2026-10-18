#!/usr/bin/env bash
# Deploy mondo to Render (FREE web service, Frankfurt) from the public GitHub repo, via the Render REST API.
#
#   RENDER_API_KEY=rnd_xxx ./deploy-render.sh            # create or update the "mondo" service, deploy, wait until live
#   ./deploy-render.sh --dry-run                          # check everything and print the requests; changes nothing
#
# Idempotent: if a service named "mondo" already exists in the workspace it is reused – its env vars are
# replaced with the list below and a new deploy is started. Nothing is ever deleted.
# Optional env: RENDER_OWNER_ID (pick a workspace if you have several), SERVICE_NAME, REPO_URL, BRANCH, REGION, PLAN.
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
SERVICE_NAME="${SERVICE_NAME:-mondo}"
REPO_URL="${REPO_URL:-https://github.com/simonpope82/mondo}"
BRANCH="${BRANCH:-main}"
REGION="${REGION:-frankfurt}"
PLAN="${PLAN:-free}"
ADMIN_EMAIL="${ADMIN_EMAIL:-simpope@gmail.com}"
PW_FILE="${PW_FILE:-$DIR/admin-password.txt}"
VAPID_FILE="${VAPID_FILE:-$DIR/vapid-keys.json}"      # kept on the box (gitignored) so phone-alert keys stay the same
API="https://api.render.com/v1"
DRY=0; [[ "${1:-}" == "--dry-run" || "${1:-}" == "-n" ]] && DRY=1

say()  { printf '%s\n' "$*" >&2; }
die()  { say "❌ $*"; exit 1; }
need() { command -v "$1" >/dev/null || die "needs '$1' installed"; }
need curl; need jq; need node

# ---- inputs ----
[[ -r "$PW_FILE" ]] || die "cannot read $PW_FILE"
ADMIN_PASSWORD="$(sed -n 's/^password:[[:space:]]*//p' "$PW_FILE" | head -1)"
[[ ${#ADMIN_PASSWORD} -ge 10 ]] || die "no password (min 10 chars) found in $PW_FILE (expected a line 'password: …')"

if [[ ! -s "$VAPID_FILE" ]]; then
  if [[ $DRY -eq 1 ]]; then say "ℹ️  would create VAPID keys in $VAPID_FILE"; VAPID_PUB="<generated>"; VAPID_PRIV="<generated>"
  else
    (cd "$DIR/app" && node -e "process.stdout.write(JSON.stringify(require('web-push').generateVAPIDKeys()))") > "$VAPID_FILE.tmp"
    chmod 600 "$VAPID_FILE.tmp"; mv "$VAPID_FILE.tmp" "$VAPID_FILE"; say "🔑 created VAPID keys in $VAPID_FILE"
  fi
fi
if [[ -s "$VAPID_FILE" ]]; then VAPID_PUB="$(jq -r .publicKey "$VAPID_FILE")"; VAPID_PRIV="$(jq -r .privateKey "$VAPID_FILE")"; fi

ENV_VARS="$(jq -n --arg pw "$ADMIN_PASSWORD" --arg email "$ADMIN_EMAIL" --arg pub "$VAPID_PUB" --arg priv "$VAPID_PRIV" '[
  {key:"NODE_VERSION", value:"20"},
  {key:"DATA_DIR", value:"/tmp/mondo-data"},
  {key:"HOST", value:"0.0.0.0"},
  {key:"TRUST_PROXY", value:"1"},
  {key:"COOKIE_SECURE", value:"1"},
  {key:"PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD", value:"1"},
  {key:"SEED_DEMO", value:"1"},
  {key:"ADMIN_EMAIL", value:$email},
  {key:"ADMIN_NAME", value:"Simon"},
  {key:"ADMIN_PASSWORD", value:$pw},
  {key:"GEOCODE_CONTACT", value:$email},
  {key:"VAPID_SUBJECT", value:("mailto:" + $email)},
  {key:"VAPID_PUBLIC_KEY", value:$pub},
  {key:"VAPID_PRIVATE_KEY", value:$priv}
]')"
mask() { jq '(.. | objects | select(has("key") and (.key|test("PASSWORD|PRIVATE"))) | .value) |= "***"'; }

# ---- API helper: api METHOD PATH [JSON] → prints body, fails on HTTP >= 400 ----
api() {
  local method="$1" path="$2" data="${3:-}" out code
  out="$(mktemp)"
  code="$(curl -sS -o "$out" -w '%{http_code}' -X "$method" "$API$path" \
    -H "Authorization: Bearer $RENDER_API_KEY" -H "Accept: application/json" \
    ${data:+-H "Content-Type: application/json" --data "$data"})" || { rm -f "$out"; die "network error on $method $path"; }
  if [[ "$code" -ge 400 ]]; then say "❌ $method $path → HTTP $code"; cat "$out" >&2; echo >&2; rm -f "$out"; exit 1; fi
  cat "$out"; rm -f "$out"
}

if [[ -z "${RENDER_API_KEY:-}" ]]; then
  if [[ $DRY -eq 1 ]]; then
    say "🧪 DRY RUN (no RENDER_API_KEY, so no calls to Render at all)"
    say "repo: $REPO_URL ($BRANCH)  service: $SERVICE_NAME  plan: $PLAN  region: $REGION"
    say "would: GET /owners → GET /services?name=$SERVICE_NAME → POST /services (or PUT env-vars + POST deploys) → poll deploy"
    say "env vars:"; echo "$ENV_VARS" | mask >&2
    git -C "$DIR" ls-remote --exit-code "$REPO_URL" "refs/heads/$BRANCH" >/dev/null 2>&1 \
      && say "✅ repo branch reachable" || say "⚠️  repo/branch not reachable (yet?) – $REPO_URL"
    say "✅ script checks passed"; exit 0
  fi
  die "RENDER_API_KEY is not set. Get one at https://dashboard.render.com/u/settings#api-keys, then: RENDER_API_KEY=rnd_… $0"
fi

# ---- owner (workspace) ----
OWNERS="$(api GET "/owners?limit=20")"
if [[ -n "${RENDER_OWNER_ID:-}" ]]; then OWNER_ID="$RENDER_OWNER_ID"
else
  N="$(echo "$OWNERS" | jq length)"; [[ "$N" -ge 1 ]] || die "no workspaces found for this API key"
  OWNER_ID="$(echo "$OWNERS" | jq -r '.[0].owner.id')"
  [[ "$N" -gt 1 ]] && { say "ℹ️  $N workspaces – using the first. Set RENDER_OWNER_ID to choose:"; echo "$OWNERS" | jq -r '.[].owner | "   \(.id)  \(.name)  \(.email // "")"' >&2; }
fi
say "🏢 workspace: $(echo "$OWNERS" | jq -r --arg id "$OWNER_ID" '.[] | select(.owner.id==$id) | .owner.name') ($OWNER_ID)"

# ---- find or create the service ----
SVC="$(api GET "/services?name=$SERVICE_NAME&ownerId=$OWNER_ID&limit=20" | jq -c --arg n "$SERVICE_NAME" '[.[].service | select(.name==$n)][0] // empty')"
BODY="$(jq -n --arg name "$SERVICE_NAME" --arg owner "$OWNER_ID" --arg repo "$REPO_URL" --arg branch "$BRANCH" \
  --arg region "$REGION" --arg plan "$PLAN" --argjson env "$ENV_VARS" '{
  type:"web_service", name:$name, ownerId:$owner, repo:$repo, branch:$branch, rootDir:"app",
  autoDeployTrigger:"commit", envVars:$env,
  serviceDetails:{ runtime:"node", plan:$plan, region:$region, healthCheckPath:"/api/health",
    envSpecificDetails:{ buildCommand:"npm ci --include=dev && npm run build", startCommand:"npm start" } } }')"

if [[ $DRY -eq 1 ]]; then
  say "🧪 DRY RUN with API key: read-only calls done, nothing changed."
  if [[ -n "$SVC" ]]; then say "would reuse service $(echo "$SVC" | jq -r .id), replace its env vars and start a deploy"
  else say "would POST /services with:"; echo "$BODY" | mask >&2; fi
  exit 0
fi

if [[ -n "$SVC" ]]; then
  SID="$(echo "$SVC" | jq -r .id)"
  say "♻️  reusing service $SERVICE_NAME ($SID) – updating env vars and deploying"
  api PUT "/services/$SID/env-vars" "$ENV_VARS" >/dev/null
  DEPLOY_ID="$(api POST "/services/$SID/deploys" '{"clearCache":"do_not_clear"}' | jq -r .id)"
else
  say "🆕 creating free web service $SERVICE_NAME in $REGION from $REPO_URL"
  RES="$(api POST "/services" "$BODY")"
  SID="$(echo "$RES" | jq -r .service.id)"; DEPLOY_ID="$(echo "$RES" | jq -r '.deployId // empty')"
  if [[ -z "$DEPLOY_ID" ]]; then sleep 5; DEPLOY_ID="$(api GET "/services/$SID/deploys?limit=1" | jq -r '.[0].deploy.id')"; fi
fi
URL="$(api GET "/services/$SID" | jq -r '.serviceDetails.url // empty')"
say "🚀 deploy $DEPLOY_ID started – usually 2–5 minutes on the free plan"

# ---- poll until live ----
for i in $(seq 1 120); do   # up to ~20 minutes
  ST="$(api GET "/services/$SID/deploys/$DEPLOY_ID" | jq -r .status)"
  case "$ST" in
    live) say "✅ deploy is live"; break ;;
    build_failed|update_failed|pre_deploy_failed|canceled|deactivated)
      die "deploy ended with status '$ST' – see logs: https://dashboard.render.com/web/$SID" ;;
    *) printf '\r⏳ %-25s (%ds)' "$ST" $((i*10)) >&2; sleep 10 ;;
  esac
done
[[ "${ST:-}" == "live" ]] || die "timed out waiting – check https://dashboard.render.com/web/$SID"

if [[ -n "$URL" ]]; then
  curl -fsS --max-time 60 "$URL/api/health" >/dev/null && say "💚 health check OK" || say "⚠️  health check did not answer yet (free services can take ~1 min to wake)"
fi
say "Login: $ADMIN_EMAIL with the password in $PW_FILE"
echo "${URL:-https://$SERVICE_NAME.onrender.com (check dashboard)}"
