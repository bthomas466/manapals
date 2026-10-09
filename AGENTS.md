<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Working in this repo

## Commands
- `npm run lint` / `npm run typecheck` — must pass before opening a PR
- `npm test` — Vitest unit tests (`tests/unit/`, pure logic in `src/lib/`)
- `npm run test:e2e` — Playwright against local dev (or `PLAYWRIGHT_BASE_URL`); mobile viewport
- `npm run test:e2e:update` — regenerate screenshot baselines after an intentional UI change

## Conventions
- Keep business logic in `src/lib/**` as pure functions and unit-test it there; pages and route handlers fetch data and render. Example: trade matching lives in `src/lib/trades/match.ts`, the page only queries and displays.
- Every feature PR adds or updates tests for its acceptance criteria: unit tests for logic, E2E for user flows.
- Screenshot baselines are per-OS (`tests/e2e/__screenshots__/{darwin,linux}/`). CI uses linux; commit baselines from the `linux-screenshots` artifact of the E2E workflow.

## Database safety
- The production Supabase project (`wzjkexompmfvuxnmkzxl`) is live. Never run `supabase db push`, `db reset`, or `migration up` against it. A PreToolUse hook (`.claude/hooks/guard-prod-db.sh`) blocks this.
- Schema changes are new files in `supabase/migrations/`. PRs touching them get the `db-change` label, which applies them to the shared staging project (one at a time). Prod gets them after merge via the approval-gated `Migrate production` workflow.
- Every new table needs RLS policies in the same migration.
