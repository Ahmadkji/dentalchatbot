#!/usr/bin/env bash
set -euo pipefail

: "${SUPABASE_URL:?Missing SUPABASE_URL}"
: "${SUPABASE_ANON_KEY:?Missing SUPABASE_ANON_KEY}"
: "${CLINIC_A_JWT:?Missing CLINIC_A_JWT}"
: "${CLINIC_B_ID:?Missing CLINIC_B_ID}"
: "${CLINIC_B_LEAD_ID:?Missing CLINIC_B_LEAD_ID}"

echo "1. Read leads as clinic A user"
curl -sS \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $CLINIC_A_JWT" \
  "$SUPABASE_URL/rest/v1/leads?select=id,clinic_id,status" \
  | tee /tmp/rls-leads-read.json

echo
echo "2. Try to update a clinic B lead as clinic A user"
curl -sS \
  -X PATCH \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $CLINIC_A_JWT" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{\"clinic_id\":\"$CLINIC_B_ID\"}" \
  "$SUPABASE_URL/rest/v1/leads?id=eq.$CLINIC_B_LEAD_ID&select=id,clinic_id" \
  | tee /tmp/rls-leads-patch.json

echo
echo "3. Try to call dashboard RPC for clinic B"
curl -sS \
  -X POST \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $CLINIC_A_JWT" \
  -H "Content-Type: application/json" \
  -d "{\"p_clinic_id\":\"$CLINIC_B_ID\"}" \
  "$SUPABASE_URL/rest/v1/rpc/get_dashboard_kpis" \
  | tee /tmp/rls-dashboard.json

echo
echo "Expected:"
echo "- read output shows only clinic A rows"
echo "- patch output is [] or a permission error"
echo "- dashboard output is [] or permission denied"
