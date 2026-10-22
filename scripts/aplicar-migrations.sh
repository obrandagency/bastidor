#!/usr/bin/env bash
# Aplica no Supabase as migrations de supabase/migrations que ainda não foram aplicadas,
# pela API de gerenciamento (só precisa do token, não da senha do banco).
# Registra cada uma em supabase_migrations.schema_migrations, a mesma tabela do Supabase CLI.
# Uso: SUPABASE_ACCESS_TOKEN=... SUPABASE_PROJECT_REF=... scripts/aplicar-migrations.sh
set -euo pipefail
cd "$(dirname "$0")/.."
: "${SUPABASE_ACCESS_TOKEN:?defina SUPABASE_ACCESS_TOKEN}"
: "${SUPABASE_PROJECT_REF:?defina SUPABASE_PROJECT_REF}"

sql() { # executa SQL (stdin) e imprime o JSON da resposta; falha mostrando a mensagem do banco
  local resposta codigo
  resposta=$(jq -Rs '{query: .}' | curl -sS -w '\n%{http_code}' -X POST \
    "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/database/query" \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" --data-binary @-)
  codigo=$(tail -n1 <<<"$resposta")
  resposta=$(sed '$d' <<<"$resposta")
  if [ "$codigo" -ge 300 ]; then echo "Erro $codigo: $resposta" >&2; return 1; fi
  echo "$resposta"
}

sql <<'SQL' >/dev/null
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);
SQL

aplicadas=$(echo "select coalesce(json_agg(version), '[]') as v from supabase_migrations.schema_migrations" | sql | jq -r '.[0].v[]')

for arquivo in supabase/migrations/*.sql; do
  base=$(basename "$arquivo" .sql)
  versao=${base%%_*}
  nome=${base#*_}
  if grep -qx "$versao" <<<"$aplicadas"; then
    echo "já aplicada: $base"
    continue
  fi
  echo "aplicando:   $base"
  # Migration e registro na mesma transação: ou entra tudo, ou nada
  { echo "begin;"; cat "$arquivo"; echo ";"
    echo "insert into supabase_migrations.schema_migrations (version, name) values ('$versao', '$nome');"
    echo "commit;"; } | sql >/dev/null
done
echo "migrations em dia"
