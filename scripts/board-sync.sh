#!/usr/bin/env bash
# Move issues/PRs on the "ManaPals Factory" project board.
#
#   scripts/board-sync.sh <status> <issue-or-pr-url>... [--with-linked-issues]
#
# Adds each item to the board if needed (idempotent) and sets its Status.
# --with-linked-issues also moves the issues a PR closes ("Closes #n").
# Needs a gh token with project scope: GH_TOKEN in CI (PROJECTS_TOKEN
# secret), or a local `gh auth` login with -s project.
set -euo pipefail

# "@me" = the token's own account (bthomas466). Naming the user instead makes gh
# look up the owner type, which a project-only token can't ("unknown owner type").
OWNER=@me
PROJECT_NUMBER=1
export GH_HOST=github.com

status="${1:?usage: board-sync.sh <status> <url>... [--with-linked-issues]}"; shift
linked=false
urls=()
for arg in "$@"; do
  if [[ "$arg" == "--with-linked-issues" ]]; then linked=true; else urls+=("$arg"); fi
done

# Resolve project, Status field, and the option for $status.
read -r project_id field_id option_id < <(
  gh project field-list "$PROJECT_NUMBER" --owner "$OWNER" --format json |
    jq -r --arg s "$status" '.fields[] | select(.name == "Status") |
      [ .id, (.options[] | select(.name == $s) | .id) ] | @tsv' |
    { read -r fid oid; pid=$(gh project view "$PROJECT_NUMBER" --owner "$OWNER" --format json -q .id); echo "$pid $fid $oid"; }
)
if [[ -z "${option_id:-}" ]]; then
  echo "Unknown status '$status'" >&2; exit 1
fi

if $linked; then
  for url in "${urls[@]}"; do
    if [[ "$url" =~ github\.com/([^/]+)/([^/]+)/pull/([0-9]+) ]]; then
      while read -r issue_url; do
        [[ -n "$issue_url" ]] && urls+=("$issue_url")
      done < <(gh api graphql -F owner="${BASH_REMATCH[1]}" -F repo="${BASH_REMATCH[2]}" -F n="${BASH_REMATCH[3]}" -f query='
        query($owner: String!, $repo: String!, $n: Int!) {
          repository(owner: $owner, name: $repo) { pullRequest(number: $n) {
            closingIssuesReferences(first: 10) { nodes { url } } } } }' \
        --jq '.data.repository.pullRequest.closingIssuesReferences.nodes[].url')
    fi
  done
fi

for url in "${urls[@]}"; do
  item_id=$(gh project item-add "$PROJECT_NUMBER" --owner "$OWNER" --url "$url" --format json -q .id)
  gh project item-edit --id "$item_id" --project-id "$project_id" \
    --field-id "$field_id" --single-select-option-id "$option_id" >/dev/null
  echo "board: $url → $status"
done
