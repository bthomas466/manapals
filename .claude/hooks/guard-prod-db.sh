#!/usr/bin/env bash
# PreToolUse hook: block Supabase commands that write to the linked remote DB
# while the repo is linked to the production project. Prod migrations go
# through the gated `Migrate production` GitHub workflow instead.
set -euo pipefail

PROD_REF="wzjkexompmfvuxnmkzxl"
command=$(jq -r '.tool_input.command // ""')

# Only match real invocations: supabase at the start of a line or after a
# shell separator, optionally via npx/bunx — not mentions inside text.
if ! grep -Eq '(^|[;&|(][[:space:]]*)((npx|bunx|pnpm[[:space:]]+dlx)[[:space:]]+)?supabase[[:space:]]+([^;&|]*[[:space:]])?(db[[:space:]]+(push|reset)|migration[[:space:]]+(up|repair))' <<<"$command"; then
  exit 0
fi

# Local-only commands are fine.
if grep -Eq -- '--local' <<<"$command"; then
  exit 0
fi

ref_file="${CLAUDE_PROJECT_DIR:-.}/supabase/.temp/project-ref"
linked_ref=$(cat "$ref_file" 2>/dev/null || true)

if [[ "$linked_ref" == "$PROD_REF" || "$command" == *"$PROD_REF"* ]]; then
  echo "Blocked: this would modify the PRODUCTION Supabase database. Link the staging project (supabase link --project-ref <staging-ref>) or ship the migration through the 'Migrate production' workflow." >&2
  exit 2
fi
