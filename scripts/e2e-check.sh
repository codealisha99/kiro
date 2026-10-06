#!/usr/bin/env bash
# Kiro E2E + leakage check — runs the golden path and the tenant/ACL matrix
# against a LIVE backend. Requires: compose stack up (default = Spring Boot).
# Usage: API_URL=http://localhost:3001 bash scripts/e2e-check.sh
set -u
API="${API_URL:-http://localhost:3001}"
PASS=0; FAIL=0; SKIP=0
ok()   { PASS=$((PASS+1)); echo "PASS: $1"; }
bad()  { FAIL=$((FAIL+1)); echo "FAIL: $1"; }
skip() { SKIP=$((SKIP+1)); echo "SKIP: $1"; }

api() { # method path [token] [body]
  local m="$1" p="$2" t="${3:-}" b="${4:-}"
  if [ -n "$t" ]; then
    curl -s -w '\n%{http_code}' -X "$m" "$API$p" -H 'Content-Type: application/json' \
      -H "Authorization: Bearer $t" ${b:+-d "$b"}
  else
    curl -s -w '\n%{http_code}' -X "$m" "$API$p" -H 'Content-Type: application/json' \
      ${b:+-d "$b"}
  fi
}
code_of() { tail -n1 <<<"$1"; }
body_of() { sed '$d' <<<"$1"; }

echo "== health =="
H=$(api GET /health); [ "$(code_of "$H")" = "200" ] && ok "GET /health" || bad "GET /health"
AI_OK=$(body_of "$H" | python3 -c "import json,sys; print(json.load(sys.stdin)['checks']['ai']['status'])" 2>/dev/null)

echo "== register two tenants =="
RA=$(api POST /auth/register '' '{"tenantName":"Acme","email":"e2e-a@example.com","password":"password123"}')
TA=$(body_of "$RA" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['tokens']['accessToken'])")
[ "$(code_of "$RA")" = "201" ] && ok "register tenant A" || bad "register tenant A"
RB=$(api POST /auth/register '' '{"tenantName":"Globex","email":"e2e-b@example.com","password":"password123"}')
TB=$(body_of "$RB" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['tokens']['accessToken'])")
[ "$(code_of "$RB")" = "201" ] && ok "register tenant B" || bad "register tenant B"

echo "== seed demo (tenant A) =="
S=$(api POST /documents/demo "$TA")
[ "$(code_of "$S")" = "201" ] && ok "seed demo" || bad "seed demo"
VIEWER_EMAIL=$(body_of "$S" | python3 -c "import json,sys; print(json.load(sys.stdin).get('viewer',{}).get('email',''))" 2>/dev/null)

echo "== tenant isolation =="
LB=$(api GET /documents "$TB")
if [ "$(code_of "$LB")" = "200" ] && [ "$(body_of "$LB" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))")" = "0" ]; then
  ok "tenant B sees 0 docs"
else bad "tenant B sees 0 docs"; fi
AID=$(api GET /documents "$TA" | sed '$d' | python3 -c "import json,sys; print(json.load(sys.stdin)[0]['id'])")
GB=$(api GET /documents/"$AID" "$TB")
[ "$(code_of "$GB")" = "404" ] && ok "cross-tenant doc read -> 404" || bad "cross-tenant doc read -> 404"

echo "== restricted doc invisible to outsiders =="
CR=$(api POST /documents "$TA" '{"title":"Secret Plan","content":"Project Midnight budget is 9M.","classification":"restricted"}')
[ "$(code_of "$CR")" = "201" ] && ok "create restricted doc" || bad "create restricted doc"
SID=$(body_of "$CR" | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])")
QB=$(api POST /brain/query "$TB" '{"query":"What is Project Midnight budget?"}')
QB_BODY=$(body_of "$QB")
if [ "$(code_of "$QB")" = "200" ] && ! grep -qi "midnight\|9M" <<<"$QB_BODY"; then
  ok "tenant B query leaks nothing"
else bad "tenant B query leaks nothing"; fi

echo "== revoke + delete =="
[ -n "$VIEWER_EMAIL" ] && {
  RV=$(api POST /documents/"$SID"/revoke "$TA" '{"principalType":"user","principalId":"nobody"}')
  [ "$(code_of "$RV")" = "200" ] && ok "revoke endpoint" || bad "revoke endpoint"
}
DL=$(api DELETE /documents/"$SID" "$TA")
[ "$(code_of "$DL")" = "200" ] && ok "soft delete" || bad "soft delete"
GD=$(api GET /documents/"$SID" "$TA")
[ "$(code_of "$GD")" = "404" ] && ok "deleted doc -> 404" || bad "deleted doc -> 404"

echo "== RAG golden path (tenant A) =="
if [ "$AI_OK" = "ok" ]; then
  Q=$(api POST /brain/query "$TA" '{"query":"What is our refund policy?"}')
  QB2=$(body_of "$Q")
  if [ "$(code_of "$Q")" = "200" ] && grep -qi "30 days" <<<"$QB2" && grep -q '"sources":\[[^]]' <<<"$QB2"; then
    ok "query answers with citations"
  else bad "query answers with citations"; fi
else skip "LLM query (AI unconfigured — expect extractive partial only)"; fi

echo "== conversations + feedback =="
C=$(api GET /conversations "$TA"); [ "$(code_of "$C")" = "200" ] && ok "conversations" || bad "conversations"
RID=$(api POST /brain/query "$TA" '{"query":"ping?"}' | sed '$d' | python3 -c "import json,sys; print(json.load(sys.stdin).get('requestId',''))" 2>/dev/null)
[ -n "$RID" ] && {
  F=$(api POST /feedback "$TA" "{\"requestId\":\"$RID\",\"helpful\":true}")
  [ "$(code_of "$F")" = "200" ] && ok "feedback" || bad "feedback"
}

echo "== guards =="
M=$(api GET /metrics); [ "$(code_of "$M")" = "401" ] && ok "anon /metrics -> 401" || bad "anon /metrics -> 401"
[ -n "$VIEWER_EMAIL" ] && {
  VL=$(api POST /auth/login '' "{\"email\":\"$VIEWER_EMAIL\",\"password\":\"northwind-viewer\"}")
  VT=$(body_of "$VL" | python3 -c "import json,sys; print(json.load(sys.stdin)['tokens']['accessToken'])" 2>/dev/null)
  AM=$(api GET /admin/metrics "$VT")
  [ "$(code_of "$AM")" = "403" ] && ok "employee /admin/metrics -> 403" || bad "employee /admin/metrics -> 403"
}
EV=$(api GET /evals/retrieval "$TA")
[ "$(code_of "$EV")" = "200" ] && ok "evals retrieval $(body_of "$EV" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['hits'],\"/\",d['total'])" 2>/dev/null)" \
  || bad "evals retrieval"

echo; echo "PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
[ "$FAIL" = "0" ]
