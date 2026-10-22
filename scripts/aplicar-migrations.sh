#!/usr/bin/env bash
# Aplica no Supabase as migrations de supabase/migrations que ainda não foram aplicadas,
# pela API de gerenciamento (só precisa do token, não da senha do banco).
# O Supabase registra cada uma em supabase_migrations.schema_migrations; comparamos pelo nome do arquivo.
# Uso: SUPABASE_ACCESS_TOKEN=... SUPABASE_PROJECT_REF=... scripts/aplicar-migrations.sh
set -euo pipefail
cd "$(dirname "$0")/.."
: "${SUPABASE_ACCESS_TOKEN:?defina SUPABASE_ACCESS_TOKEN}"
: "${SUPABASE_PROJECT_REF:?defina SUPABASE_PROJECT_REF}"
API="https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/database/migrations"

chamar() { # chamar MÉTODO [corpo-json-no-stdin]; imprime a resposta, falha com a mensagem da API
  local resposta codigo
  if [ "$1" = GET ]; then
    resposta=$(curl -sS -w '\n%{http_code}' "$API" -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN")
  else
    resposta=$(curl -sS -w '\n%{http_code}' -X "$1" "$API" -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
      -H "Content-Type: application/json" --data-binary @-)
  fi
  codigo=$(tail -n1 <<<"$resposta")
  resposta=$(sed '$d' <<<"$resposta")
  if [ "$codigo" -ge 300 ]; then echo "Erro $codigo: $resposta" >&2; return 1; fi
  echo "$resposta"
}

aplicadas=$(chamar GET | jq -r '.[].name // empty')

for arquivo in supabase/migrations/*.sql; do
  nome=$(basename "$arquivo" .sql)
  if grep -qxF "$nome" <<<"$aplicadas"; then
    echo "já aplicada: $nome"
    continue
  fi
  echo "aplicando:   $nome"
  jq -Rs --arg nome "$nome" '{query: ., name: $nome}' <"$arquivo" | chamar POST >/dev/null
done
echo "migrations em dia"
