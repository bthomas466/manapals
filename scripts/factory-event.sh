#!/usr/bin/env bash
# Post one factory event to the dashboard (https://manapals-factory.vercel.app).
#
#   scripts/factory-event.sh <kind> [--run-id ID] [--issue N] [--stage S]
#                            [--agent A] [--model M] [--detail JSON]
#
# kind: run_start | run_end | stage_start | stage_end | agent_start |
#       agent_end | tool | gate | usage | note
#
# Never fails and never blocks for long: telemetry must not break a run.
# Silently does nothing unless FACTORY_DASHBOARD_URL and FACTORY_INGEST_TOKEN
# are set (CI: workflow env; local: read from .env.local).
# Run id: cloud-$GITHUB_RUN_ID in Actions, otherwise --run-id or
# local-$CLAUDE_SESSION_ID. Send metadata only — never prompts or file contents.
set -uo pipefail

repo_root=$(cd "$(dirname "$0")/.." && pwd)
if [[ -z "${FACTORY_DASHBOARD_URL:-}" || -z "${FACTORY_INGEST_TOKEN:-}" ]] && [[ -f "$repo_root/.env.local" ]]; then
  FACTORY_DASHBOARD_URL=${FACTORY_DASHBOARD_URL:-$(grep -E '^FACTORY_DASHBOARD_URL=' "$repo_root/.env.local" | cut -d= -f2-)}
  FACTORY_INGEST_TOKEN=${FACTORY_INGEST_TOKEN:-$(grep -E '^FACTORY_INGEST_TOKEN=' "$repo_root/.env.local" | cut -d= -f2-)}
fi
[[ -z "${FACTORY_DASHBOARD_URL:-}" || -z "${FACTORY_INGEST_TOKEN:-}" ]] && exit 0

kind="${1:-}"; shift || true
run_id="" issue="" stage="" agent="" model="" detail="{}"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --run-id) run_id="$2"; shift 2 ;;
    --issue)  issue="$2";  shift 2 ;;
    --stage)  stage="$2";  shift 2 ;;
    --agent)  agent="$2";  shift 2 ;;
    --model)  model="$2";  shift 2 ;;
    --detail) detail="$2"; shift 2 ;;
    *) shift ;;
  esac
done

if [[ -n "${GITHUB_RUN_ID:-}" ]]; then
  source=cloud
  run_id="cloud-$GITHUB_RUN_ID"
  gh_run_url="${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY:-}/actions/runs/$GITHUB_RUN_ID"
else
  source=local
  run_id="${run_id:-local-${CLAUDE_SESSION_ID:-unknown}}"
  gh_run_url=""
fi

body=$(jq -nc \
  --arg id "$run_id" --arg source "$source" --arg issue "$issue" --arg url "$gh_run_url" \
  --arg kind "$kind" --arg stage "$stage" --arg agent "$agent" --arg model "$model" \
  --argjson detail "$(jq -c 'if type == "object" then . else {} end' <<<"$detail" 2>/dev/null || echo '{}')" \
  '{run: ({id: $id, source: $source}
          + (if $issue != "" then {issue: ($issue | tonumber)} else {} end)
          + (if $url != "" then {ghRunUrl: $url} else {} end)),
    event: ({kind: $kind, detail: $detail}
          + (if $stage != "" then {stage: $stage} else {} end)
          + (if $agent != "" then {agent: $agent} else {} end)
          + (if $model != "" then {model: $model} else {} end))}' 2>/dev/null) || exit 0

curl -s -o /dev/null --max-time 5 -X POST "$FACTORY_DASHBOARD_URL/api/events" \
  -H "Authorization: Bearer $FACTORY_INGEST_TOKEN" -H "Content-Type: application/json" \
  -d "$body" || true
exit 0
