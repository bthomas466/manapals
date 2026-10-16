# Coding standards

Read by the `reviewer` agent (and anyone reviewing a diff). These are judgement calls that no linter or type check enforces; anything `npm run lint` / `npm run typecheck` already catches doesn't belong here. When a rule turns out to be mechanical, replace it with a check (ESLint rule, unit test, CI job) and delete it from this file.

`AGENTS.md` holds the hard rules (database safety, migrations with RLS, logic in `src/lib/**`). This file is the reviewer's checklist on top of those. Factory retros add to it; keep each rule one line of rule plus one line of why.

## ManaPals rules

- **Authorize every server action and route handler first.** Call `supabase.auth.getUser()` and return early when there's no user, before touching data. *Why: server actions are public endpoints.*
- **Scope user writes twice.** Filter updates and deletes by `user_id = user.id` even though RLS also enforces it. *Why: defense in depth; RLS mistakes are silent.*
- **Validate action inputs at the boundary.** Server actions take `unknown`-ish client input; check types and ranges before querying (see `src/lib/trades/actions.ts`). *Why: TypeScript types don't exist at runtime.*
- **Return results, don't throw, from server actions.** Use the `{ ok, error? }` shape with a user-safe message; never return raw Supabase errors. *Why: the UI is optimistic and needs a failure value to roll back; raw errors leak schema details.*
- **The admin client is a last resort.** `createAdminClient()` only in server code, only with an explicit authorization check before it, and with a comment saying why RLS can't do the job. *Why: it bypasses RLS entirely.*
- **Friends-only by default.** New data a user owns is visible to accepted friends at most, unless the spec says otherwise; nothing new reaches the public `/u/[username]` page without the spec asking for it. *Why: the PRD's privacy default.*
- **Think in large collections.** Queries over `collection_items` must page or aggregate in SQL; don't load a whole collection to count or filter it in JS. *Why: real collections are tens of thousands of rows (see #16, #21).*
- **Comment the non-obvious "why", not the "what".** Match the surrounding comment density. *Why: the code is read by agents with no other context.*

## Smell baseline

Always judgement calls, never blockers on their own: report as "possible <smell>" with the hunk. A ManaPals rule above, or a documented decision in the spec, wins over the baseline.

- **Mysterious Name**: a name that doesn't reveal what it does or holds. → Rename; if no honest name comes, the design's murky.
- **Duplicated Code**: the same logic shape in more than one place in the change, or copying an existing `src/lib` helper. → Extract or reuse.
- **Feature Envy**: a function that reaches into another module's data more than its own. → Move it next to the data.
- **Data Clumps**: the same few fields or params travelling together. → Bundle them into one type.
- **Primitive Obsession**: a string or number standing in for a domain concept (trade status, card condition). → Give it a type, like `TradeStatus`.
- **Repeated Switches**: the same `switch`/`if` cascade on the same value in several places. → One map or function both sites share.
- **Shotgun Surgery**: one logical change scattered across many files. → Gather what changes together.
- **Divergent Change**: one file edited for several unrelated reasons. → Split it.
- **Speculative Generality**: options, hooks, or abstractions the spec doesn't need. → Delete; inline until a real need shows.
- **Message Chains**: long `a.b().c().d()` navigation the caller shouldn't depend on. → Hide the walk behind one function.
- **Middle Man**: a function or component that only forwards to another. → Call the target directly.
