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

PROJECT_NUMBER=1
export GH_HOST=github.com

# Raw GraphQL via `gh api` rather than `gh project`: the latter pre-checks
# for read:org/read:discussion scopes that a `project`-only token lacks,
# while the API itself needs only `project`. `viewer` = the token's account.
gql() { gh api graphql "$@"; }

status="${1:?usage: board-sync.sh <status> <url>... [--with-linked-issues]}"; shift
linked=false
urls=()
for arg in "$@"; do
  if [[ "$arg" == "--with-linked-issues" ]]; then linked=true; else urls+=("$arg"); fi
done

# Resolve the project, its Status field, and the option for $status.
read -r project_id field_id option_id < <(
  gql -F n="$PROJECT_NUMBER" -f query='
    query($n: Int!) { viewer { projectV2(number: $n) { id
      field(name: "Status") { ... on ProjectV2SingleSelectField { id options { id name } } } } } }' |
    jq -r --arg s "$status" '.data.viewer.projectV2 |
      [ .id, .field.id, ((.field.options[] | select(.name == $s) | .id) // "") ] | @tsv'
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
  content_id=$(gql -f url="$url" -f query='
    query($url: URI!) { resource(url: $url) { ... on Issue { id } ... on PullRequest { id } } }' \
    --jq '.data.resource.id')
  # addProjectV2ItemById is idempotent: it returns the existing item if present.
  item_id=$(gql -f p="$project_id" -f c="$content_id" -f query='
    mutation($p: ID!, $c: ID!) { addProjectV2ItemById(input: {projectId: $p, contentId: $c}) { item { id } } }' \
    --jq '.data.addProjectV2ItemById.item.id')
  gql -f p="$project_id" -f i="$item_id" -f f="$field_id" -f o="$option_id" -f query='
    mutation($p: ID!, $i: ID!, $f: ID!, $o: String!) {
      updateProjectV2ItemFieldValue(input: {projectId: $p, itemId: $i, fieldId: $f,
        value: {singleSelectOptionId: $o}}) { projectV2Item { id } } }' >/dev/null
  echo "board: $url → $status"
done
