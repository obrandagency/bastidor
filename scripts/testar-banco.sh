#!/usr/bin/env bash
# Cria um banco vazio, aplica a imitação do Supabase + migrations e roda os testes de RLS.
# Uso: PGHOST=... PGPORT=... PGUSER=postgres scripts/testar-banco.sh
set -euo pipefail
cd "$(dirname "$0")/.."
BANCO="bastidor_teste_$$"
psql -q -d postgres -c "create database $BANCO"
trap 'psql -q -d postgres -c "drop database if exists $BANCO" >/dev/null' EXIT
psql -q -v ON_ERROR_STOP=1 -d "$BANCO" -f supabase/tests/stub-supabase.sql
for f in supabase/migrations/*.sql; do
  psql -q -v ON_ERROR_STOP=1 -d "$BANCO" -f "$f"
done
psql -v ON_ERROR_STOP=1 -d "$BANCO" -f supabase/tests/rls.sql 2>&1 | sed -n 's/^.*NOTICE:  //p; /FALHOU\|ERROR/p'
test "${PIPESTATUS[0]}" -eq 0
