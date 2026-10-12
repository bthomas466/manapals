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
- `npm run seed:staging` — reset the staging test users (`e2e_player` ↔ `e2e_friend`), their collections and wishlists; refuses to run against prod

## Conventions
- Keep business logic in `src/lib/**` as pure functions and unit-test it there; pages and route handlers fetch data and render. Example: trade matching lives in `src/lib/trades/match.ts`, the page only queries and displays.
- Every feature PR adds or updates tests for its acceptance criteria: unit tests for logic, E2E for user flows.
- Screenshot baselines are per-OS (`tests/e2e/__screenshots__/{darwin,linux}/`). CI uses linux; commit baselines from the `linux-screenshots` artifact of the E2E workflow.

## Database safety
- **Staging** (`rycuhmeorqdymbdotpys`) is what local dev (`.env.local`), Vercel Preview/Development, and the local Supabase CLI link point at. Use it freely.
- **Production** (`wzjkexompmfvuxnmkzxl`) is live. Never run `supabase db push`, `db reset`, or `migration up` against it. A PreToolUse hook (`.claude/hooks/guard-prod-db.sh`) blocks this.
- Schema changes are new files in `supabase/migrations/`. PRs touching them get the `db-change` label, which applies them to the shared staging project (one at a time). Prod gets them after merge via the approval-gated `Migrate production` workflow.
- Every new table needs RLS policies in the same migration.

# AI factory
- `/feature <idea>` files a `factory`-labeled GitHub issue. `/factory-run <issue#> [--review-spec]` runs it end to end in a git worktree (`../manapals-worktrees/<n>-<slug>`): spec → mockup → technical design → build → tests → verify → review → PR → QA. `/promote <pr#>` ships a reviewed PR to production.
- Agents live in `.claude/agents/`; each has a narrow job and returns a report to the orchestrator. Specs and mockups go in `docs/specs/<n>-<slug>.md` and `docs/specs/<n>-<slug>/`.
- The factory stops at a Vercel preview. Merging, prod migrations (`db-production` approval), and promotion always need the human.
- Production is **staged**: Vercel's auto-assign of production domains is off, so a merge to `main` builds a production deployment that isn't live until `vercel promote`. Release order: merge → approve prod migration → promote. Roll back with `vercel rollback`.
- Use `GH_HOST=github.com gh … --repo bthomas466/manapals` for GitHub commands; the machine's default gh host is a different GitHub.
- E2E in CI waits for the commit's `Migrate staging` run when it changes migrations (the PR needs `db-change`), then re-seeds staging (`SUPABASE_STAGING_SERVICE_ROLE_KEY` secret) before testing. Never seed or migrate staging by hand for a PR.
- Signed-in E2E: `tests/e2e/authed/*.spec.ts` run as the seeded `e2e_player` (needs `E2E_EMAIL`/`E2E_PASSWORD` in `.env.local` locally; the `E2E_PASSWORD` repo secret in CI). Without them, these specs skip.
