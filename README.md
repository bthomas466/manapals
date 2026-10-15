<img src="public/brand/concept-3.svg" alt="ManaPals logo" width="96" height="96" align="right">

# ManaPals

Your Magic: The Gathering collection, shared with your playgroup. Add friends, browse each other's cards, and spot trades without screenshots or manual list comparisons.

**[Try it at manapals.vercel.app](https://manapals.vercel.app)**

> [!NOTE]
> ManaPals is not affiliated with Manabox or SkillDevs SC. It reads a CSV you export yourself; it does not access Manabox's servers.

## What it is

Manabox is great at scanning and tracking a collection, but it's a solo tool — there's no way to see what your friends have. ManaPals adds that missing shared layer: import the CSV you already export from Manabox, get a browsable profile with real card data (via [Scryfall](https://scryfall.com)), and connect with your playgroup to see who has what you're after.

See [`docs/manabox-companion-prd.md`](docs/manabox-companion-prd.md) for the full product spec.

## Features

### Available today

- Sign in with Google
- Guided onboarding for new users: import your collection and set up your profile step by step
- Import your Manabox CSV, enriched with card data (images, rarity, colors, prices) from Scryfall
- Browse your collection with search, color/foil filters, and sort by name, set, rarity, or price, including collections of more than 1,000 cards
- A collection summary with total cards and estimated value
- Mark cards and whole binders as available to trade
- A wishlist of the cards you want
- Trade Match with a friend: see what you have that they want, and vice versa
- Friend requests (send, accept, decline, remove)
- Collections are friends-only by default, with an opt-in public setting
- Profile pages at `/u/<username>`
- A layout that works on phones, tablets, and desktops

### Not yet

- Apple sign-in
- Email or in-app notifications (for example, for friend requests)
- Link previews when you share a profile (Open Graph)
- A "last synced" display on profiles
- Shareable links to individual cards
- Public discovery, other CSV formats, and collection analytics

## Suggest an idea or report a problem

1. **Suggest it.** [Open a suggestion](https://github.com/bthomas466/manapals/issues/new?template=1-suggestion.yml) and tell us what you'd like, or what isn't working.
2. **It gets reviewed.** The maintainer ([@bthomas466](https://github.com/bthomas466)) reads every suggestion.
3. **It may get built.** If it's a good fit, it may get built, and the issue is updated along the way.

Not every suggestion will be built, and there's no promised timeline. Issues are public, so please don't include your email address or other contact details.

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
npm run build       # production build
npm run start       # run the production build
npm run lint        # eslint
npm run typecheck   # TypeScript check
npm test            # unit tests
npm run test:e2e    # end-to-end tests (Playwright)
```

## Tech stack

Next.js (App Router) · React · Tailwind CSS · Supabase (Postgres, Auth) · Scryfall API · PapaParse
