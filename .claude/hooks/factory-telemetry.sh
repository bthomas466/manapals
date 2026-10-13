#!/usr/bin/env bash
# Reports subagent start/finish (name, model, duration) to the factory
# dashboard via scripts/factory-event.sh.
#   PreToolUse on Agent → agent_start (agent from tool_input.subagent_type)
#   SubagentStop        → agent_end   (agent from agent_type)
# SubagentStop fires when the subagent really finishes, both for foreground
# runs (Actions) and background runs (interactive sessions), unlike
# PostToolUse, which returns immediately for async launches.
# Always exits 0 — telemetry must never block or fail anything.
set -uo pipefail
input=$(cat)
root="${CLAUDE_PROJECT_DIR:-$(pwd)}"

event=$(jq -r '.hook_event_name // empty' <<<"$input")
session=$(jq -r '.session_id // empty' <<<"$input")
case "$event" in
  PreToolUse)   agent=$(jq -r '.tool_input.subagent_type // empty' <<<"$input") ;;
  SubagentStop) agent=$(jq -r '.agent_type // empty' <<<"$input") ;;
  *) exit 0 ;;
esac
[[ -z "$agent" || "$agent" == "null" ]] && exit 0

model=""
[[ -f "$root/.claude/agents/$agent.md" ]] && model=$(sed -n 's/^model: *//p' "$root/.claude/agents/$agent.md" | head -1)
stamp="${TMPDIR:-/tmp}/factory-telemetry-${session}-${agent}"

if [[ "$event" == PreToolUse ]]; then
  date +%s > "$stamp" 2>/dev/null
  "$root/scripts/factory-event.sh" agent_start --run-id "local-$session" --agent "$agent" --model "$model"
else
  detail='{}'
  if [[ -f "$stamp" ]]; then
    detail=$(jq -nc --argjson s "$(( $(date +%s) - $(cat "$stamp") ))" '{durationSec: $s}')
    rm -f "$stamp"
  fi
  "$root/scripts/factory-event.sh" agent_end --run-id "local-$session" --agent "$agent" --model "$model" --detail "$detail"
fi
exit 0
