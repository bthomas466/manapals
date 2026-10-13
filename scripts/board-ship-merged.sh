#!/usr/bin/env bash
# After a production promote, move board items from "Merged" to "Shipped" —
# but only those whose code is in the promoted commit.
#
#   scripts/board-ship-merged.sh <promoted-commit-sha> [--dry-run]
#
# Staged production means a promote releases everything merged up to that
# commit, not just the PR being promoted. Items merged *after* it stay in
# Merged. A PR counts if its merge commit is an ancestor of (or equal to)
# the promoted commit; an issue counts if a PR that closed it does.
# Run from an up-to-date checkout of main (needs the commits locally).
set -euo pipefail

PROJECT_NUMBER=1
export GH_HOST=github.com
gql() { gh api graphql "$@"; }

promoted="${1:?usage: board-ship-merged.sh <promoted-commit-sha> [--dry-run]}"
dry_run=false; [[ "${2:-}" == "--dry-run" ]] && dry_run=true
git cat-file -e "$promoted^{commit}" 2>/dev/null || { echo "Commit $promoted not found locally; run git pull first." >&2; exit 1; }

shipped_in_promote() { # <merge-commit-sha>
  [[ -n "$1" ]] && git cat-file -e "$1^{commit}" 2>/dev/null && git merge-base --is-ancestor "$1" "$promoted"
}

# Project, Status field, and the Shipped option.
read -r project_id field_id shipped_id < <(
  gql -F n="$PROJECT_NUMBER" -f query='
    query($n: Int!) { viewer { projectV2(number: $n) { id
      field(name: "Status") { ... on ProjectV2SingleSelectField { id options { id name } } } } } }' |
    jq -r '.data.viewer.projectV2 | [ .id, .field.id, (.field.options[] | select(.name == "Shipped") | .id) ] | @tsv'
)

# Every item currently in "Merged", with the merge commit(s) that put it there.
# (Paginated: boards can exceed 100 items.)
cursor=""; rows=()
while :; do
  # -F after=null sends JSON null for the first page.
  page=$(gql -F n="$PROJECT_NUMBER" -F after="${cursor:-null}" -f query='
    query($n: Int!, $after: String) { viewer { projectV2(number: $n) {
      items(first: 100, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes { id
          fieldValueByName(name: "Status") { ... on ProjectV2ItemFieldSingleSelectValue { name } }
          content {
            ... on PullRequest { url mergeCommit { oid } }
            ... on Issue { url closedByPullRequestsReferences(first: 10, includeClosedPrs: true) {
              nodes { mergeCommit { oid } } } } } } } } } }')
  while IFS=$'\t' read -r item url shas; do rows+=("$item"$'\t'"$url"$'\t'"$shas"); done < <(
    jq -r '.data.viewer.projectV2.items.nodes[]
      | select(.fieldValueByName.name == "Merged")
      | [ .id, .content.url,
          ([ (.content.mergeCommit.oid // empty),
             (.content.closedByPullRequestsReferences.nodes[]?.mergeCommit.oid // empty) ] | join(" ")) ]
      | @tsv' <<<"$page")
  [[ "$(jq -r '.data.viewer.projectV2.items.pageInfo.hasNextPage' <<<"$page")" == true ]] || break
  cursor=$(jq -r '.data.viewer.projectV2.items.pageInfo.endCursor' <<<"$page")
done

[[ ${#rows[@]} -eq 0 ]] && { echo "Nothing in Merged."; exit 0; }
for row in "${rows[@]}"; do
  IFS=$'\t' read -r item url shas <<<"$row"
  ship=false
  for sha in $shas; do shipped_in_promote "$sha" && { ship=true; break; }; done
  if ! $ship; then
    echo "keep:    $url (merged after ${promoted:0:7}, not live yet)"
  elif $dry_run; then
    echo "would ship: $url"
  else
    gql -f p="$project_id" -f i="$item" -f f="$field_id" -f o="$shipped_id" -f query='
      mutation($p: ID!, $i: ID!, $f: ID!, $o: String!) {
        updateProjectV2ItemFieldValue(input: {projectId: $p, itemId: $i, fieldId: $f,
          value: {singleSelectOptionId: $o}}) { projectV2Item { id } } }' >/dev/null
    echo "shipped: $url"
  fi
done
