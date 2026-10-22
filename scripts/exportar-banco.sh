#!/usr/bin/env bash
# Backup semanal: exporta todas as tabelas do Bastidor em JSON pela API do Supabase (service role).
# Uso: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... scripts/exportar-banco.sh <pasta-de-saida>
# As artes (Storage) não entram: ficam no bucket "artes".
set -euo pipefail
: "${SUPABASE_URL:?defina SUPABASE_URL}"
: "${SUPABASE_SERVICE_ROLE_KEY:?defina SUPABASE_SERVICE_ROLE_KEY}"
SAIDA="${1:?informe a pasta de saída}"
mkdir -p "$SAIDA"

TABELAS=(clients profiles convites contracts client_briefs meeting_notes tasks task_assets task_notes task_events stage_defaults app_settings notifications envios_email)
CABECALHOS=(-H "apikey: $SUPABASE_SERVICE_ROLE_KEY")
# Chave antiga (JWT) também vai no Authorization; a nova (sb_secret_) só no apikey
[[ "$SUPABASE_SERVICE_ROLE_KEY" == eyJ* ]] && CABECALHOS+=(-H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY")

for t in "${TABELAS[@]}"; do
  echo "[]" >"$SAIDA/$t.json"
  inicio=0
  while :; do
    pagina=$(curl -sS --fail-with-body "${CABECALHOS[@]}" "$SUPABASE_URL/rest/v1/$t?select=*&offset=$inicio&limit=1000")
    jq -s '.[0] + .[1]' "$SAIDA/$t.json" <(echo "$pagina") >"$SAIDA/$t.tmp" && mv "$SAIDA/$t.tmp" "$SAIDA/$t.json"
    n=$(echo "$pagina" | jq 'length')
    [ "$n" -lt 1000 ] && break
    inicio=$((inicio + 1000))
  done
  echo "$t: $(jq 'length' "$SAIDA/$t.json") linhas"
done
