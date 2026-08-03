# ManaPals

A mobile-optimized web app that turns your [Manabox](https://manabox.app) Magic: The Gathering collection into a social profile — add friends, browse each other's cards, and spot trade opportunities without screenshots or manual list comparisons.

> [!NOTE]
> ManaPals is not affiliated with Manabox or SkillDevs SC. It reads a CSV you export yourself; it does not access Manabox's servers.

## What it is

Manabox is great at scanning and tracking a collection, but it's a solo tool — there's no way to see what your friends have. ManaPals adds that missing shared layer: import the CSV you already export from Manabox, get a browsable profile with real card data (via [Scryfall](https://scryfall.com)), and connect with your playgroup to see who has what you're after.

See [`docs/manabox-companion-prd.md`](docs/manabox-companion-prd.md) for the full product spec.

## Features

**Available today**

- Google sign-in via Supabase Auth (Apple sign-in pending — button removed until it's wired up)
- Manabox CSV import, enriched with live card data (images, rarity, colors, prices) from Scryfall
- Collection browsing with search, color/foil filters, and sort by name, set, rarity, or price
- Friend requests (send, accept, decline, remove) and friends-only profile visibility
- Public profile pages at `/u/[username]`, with collections gated to accepted friends

**Coming soon**

- Trade Match view — see what you have that a friend wants, and vice versa
- Wishlist, so trade matching has something to match against
- Email/in-app notifications for friend requests and wishlist hits
- Opt-in public collection visibility and Open Graph link previews
- Public discovery, alternate CSV formats, collection analytics

## Getting started

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project (free tier is enough)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env.local` and fill in the values from your Supabase project's **Settings → API** page:

```bash
cp .env.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

> [!WARNING]
> `SUPABASE_SERVICE_ROLE_KEY` bypasses Row Level Security. Keep it server-side only — never expose it to the client or commit it.

You'll also need the Google OAuth provider enabled under **Authentication → Providers** in Supabase, with the redirect URL set to `<your-app-url>/api/auth/callback`. (Apple sign-in isn't wired up yet.)

### 3. Apply the database schema

Migrations live in [`supabase/migrations`](supabase/migrations). Link the CLI to your project and push them:

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

(Or run against a local stack with `npx supabase start` + `npx supabase db reset` if you have Docker installed.)

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to sign in.

### Other scripts

```bash
npm run build   # production build
npm run start   # run the production build
npm run lint    # eslint
```

## Tech stack

Next.js (App Router) · React · Tailwind CSS · Supabase (Postgres, Auth) · Scryfall API · PapaParse
