# Use the new ManaPals logo across the app
Issue: #32 · PRD refs: §5.2 (mobile experience), US-01 (sign-in), US-23 (link previews, for context only) · Status: Draft

## Problem
ManaPals has no visual identity in the product today:
- The browser tab shows the default Next.js favicon (`src/app/favicon.ico` is the create-next-app file, with 16/32/48/256 px entries; sha256 `2b8ad2d3…775932`).
- There's no `apple-icon` and no web manifest. "Add to Home Screen" on iOS uses a page screenshot, and on Android it uses a generic letter tile.
- The sign-in page uses a 🃏 emoji in a grey box as a stand-in logo (`src/app/(auth)/sign-in/page.tsx`).
- The signed-in shell (`src/app/(main)/layout.tsx`) has no header or brand spot. It only has page content and `BottomNav`.
- `public/` still holds five unused create-next-app SVGs (`next.svg`, `vercel.svg`, `file.svg`, `globe.svg`, `window.svg`). A repo-wide search finds no references to them.

The chosen logo (concept 3: a bold rounded M with an amber mana gem) is already committed in `docs/brand/`.

## Users & scenario
Sam's friend sends him a ManaPals link in iMessage. On his Android phone (Chrome):
1. The link opens `/sign-in`. The tab shows the ManaPals M-and-gem favicon instead of the Next.js triangle. The sign-in card shows the ManaPals mark above the "ManaPals" heading, where the emoji used to be.
2. He signs in with Google and lands on `/collection`. A slim top bar shows the ManaPals lockup (mark and wordmark). Tapping it takes him back to `/collection`.
3. He taps **Add to Home screen**. The home-screen icon is the ManaPals mark, and its label is "ManaPals".
4. Later, on an iPhone, he adds ManaPals to his home screen from Safari. iOS uses the 180×180 ManaPals touch icon.

## Scope
### In scope
- **Favicon.** Replace `src/app/favicon.ico` with an ICO made from `docs/brand/concept-3.svg`, with at least 16×16 and 32×32 entries. Also add an SVG `icon` (a copy of `concept-3.svg`), so browsers that support SVG favicons render it at any size. Both use Next 16 file-based metadata (`app/favicon.ico`, `app/icon.svg`; see `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/app-icons.md`).
- **Apple touch icon.** Add a 180×180 PNG `apple-icon` rendered from `concept-3.svg`.
- **Web manifest.** Add `app/manifest.ts` (or a static `manifest.webmanifest`) with:
  - `name` and `short_name`: "ManaPals"
  - `start_url`: `/collection`
  - `background_color` and `theme_color`: the page color
  - 192×192 and 512×512 PNG icons rendered from `concept-3.svg`
  - `display`: see Q3
- **Icons load when signed out.** Every icon, touch-icon and manifest URL must return the file, not a redirect to `/sign-in`, whether or not the request has cookies. Today the `src/proxy.ts` matcher already skips `favicon.ico`, `.svg` and `.png`, but not `.webmanifest` or extensionless generated routes (such as `/icon?…` or `/manifest`). Browsers fetch the manifest without cookies by default, so it would always be redirected. How to fix this is the architect's call.
- **Sign-in page.** Replace the emoji box with the ManaPals mark (`concept-3.svg`). Keep the visible `<h1>ManaPals</h1>`, the tagline, and the button unchanged (Q2).
- **Signed-in brand spot.** Add a slim top bar to `src/app/(main)/layout.tsx` with the dark lockup (`concept-3-lockup.svg`), linking to `/collection` (Q1).
- **Use the art as given.** The served SVG files are byte-identical copies of the `docs/brand/` sources. Raster files (ICO and PNGs) are renders of `concept-3.svg` with no edits, except for flattening transparent corners (Q4).
- **Cleanup.** Delete the five unused starter SVGs from `public/`.
- **Tests.** E2E checks for the head links, the asset responses, the sign-in logo and the header logo. Vitest checks for asset dimensions. Update the `sign-in.png` screenshot baselines.

### Out of scope
- Open Graph / Twitter preview images. The app doesn't have any today (no `opengraph-image` file, no `openGraph` metadata). Per-profile link previews are US-23 and should be their own issue (Q5).
- Maskable Android icons with safe-zone padding, monochrome or themed icons, and splash screens (Q6).
- Full PWA behavior: service worker, offline support, install prompts, or a `viewport.themeColor` / `<meta name="theme-color">` tag.
- Using `concept-3-lockup-light.svg`. The app is dark-only, so there's no light surface for it. It stays in `docs/brand/` for future use.
- Redesigning or retouching the logo, or adding new color tokens to `globals.css`.
- Logo on other surfaces: email templates, loading or skeleton screens, empty states, 404/error pages, `BottomNav` icons, or the Supabase/Google OAuth consent screen branding.
- The factory dashboard (a separate repo) and `docs/brand/concept-3-factory.svg`.
- Changing page titles or the `metadata.description` copy.

## Acceptance criteria
"E2E" means Playwright (Pixel 7 viewport). "Signed-out" means the `mobile` project or a fresh `request` context with no storage state. "Authed" means `tests/e2e/authed/` as `e2e_player`, which skips without credentials. "Unit" means Vitest reading files from disk.

**Head links**
- **AC-1** *(favicon and SVG icon links)*
  - **Given** a signed-out visitor,
  - **When** they load `/sign-in`,
  - **Then** `<head>` has a `link[rel="icon"]` whose `href` path is `/favicon.ico`,
  - **And** a `link[rel="icon"][type="image/svg+xml"]`.
- **AC-2** *(apple touch icon link)*
  - **Given** the same page,
  - **Then** `<head>` has exactly one `link[rel="apple-touch-icon"]` with `sizes="180x180"`.
- **AC-3** *(manifest link)*
  - **Given** the same page,
  - **Then** `<head>` has exactly one `link[rel="manifest"]`.
- **AC-4** *(links on signed-in pages)*
  - **Given** an authed user,
  - **When** they load `/collection`,
  - **Then** the same icon, apple-touch-icon and manifest links from AC-1 to AC-3 are present. They come from the root layout, not a page.

**Assets resolve when signed out**
- **AC-5** *(no auth redirect)*
  - **Given** a request context with no cookies,
  - **When** it GETs each `href` from AC-1 to AC-3 and each `src` listed in the manifest's `icons`, with `maxRedirects: 0`,
  - **Then** each response is HTTP 200, not a 3xx to `/sign-in`,
  - **And** the `content-type` is `image/x-icon` or `image/vnd.microsoft.icon` for the ICO, `image/svg+xml` for the SVG, `image/png` for the PNGs, and `application/manifest+json` or `application/json` for the manifest.

**Manifest contents**
- **AC-6**
  - **Given** the manifest fetched in AC-5,
  - **When** it's parsed as JSON,
  - **Then** `name` is "ManaPals", `short_name` is "ManaPals", and `start_url` is `/collection`,
  - **And** `background_color` and `theme_color` are `#0c1015` (the mark's background, which matches `--color-page`; see Q7),
  - **And** `icons` contains one `image/png` entry with `sizes: "192x192"` and one with `sizes: "512x512"`.

**Asset dimensions and identity (unit)**
- **AC-7** *(favicon replaced)*
  - **Given** `src/app/favicon.ico` on disk,
  - **When** a Vitest test parses its ICONDIR header,
  - **Then** it has entries for 16×16 and 32×32,
  - **And** its sha256 isn't `2b8ad2d33455a8f736fc3a8ebf8f0bdea8848ad4c0db48a2833bd0f9cd775932` (the Next.js starter favicon).
- **AC-8** *(raster sizes)*
  - The apple-icon PNG's IHDR is 180×180.
  - The two manifest icon PNGs' IHDRs are 192×192 and 512×512.
  - If any of these are generated in code instead of committed files, the architect replaces this AC with an E2E that fetches each one and reads the same IHDR bytes.
- **AC-9** *(SVGs are the source art, unmodified)*
  - The SVG served as the app icon is byte-identical to `docs/brand/concept-3.svg`.
  - The SVG(s) rendered on the sign-in page and in the header are byte-identical to `docs/brand/concept-3.svg` and `docs/brand/concept-3-lockup.svg` respectively.
  - Checked by a Vitest file comparison, or by an E2E that fetches the served URL and compares it with the source file.
- **AC-10** *(no new tokens)*
  - The `@theme` block in `src/app/globals.css` is unchanged. A Vitest check confirms the set of `--color-*` names equals today's 10 names.

**Sign-in page**
- **AC-11** *(logo renders)*
  - **Given** a signed-out visitor,
  - **When** they load `/sign-in`,
  - **Then** an `img` with accessible name "ManaPals logo" is visible,
  - **And** its `naturalWidth` is greater than 0 (it actually loaded).
- **AC-12** *(emoji placeholder gone, heading kept)*
  - The page contains no 🃏 character.
  - `getByRole("heading", { name: "ManaPals" })` and the "Continue with Google" button are still visible, so the existing `auth.spec.ts` assertions still pass.
- **AC-13** *(visual)*
  - The `sign-in.png` screenshot test passes against updated linux baselines (and darwin baselines if refreshed), committed from the CI `linux-screenshots` artifact.

**Signed-in brand spot**
- **AC-14** *(header logo)*
  - **Given** an authed user,
  - **When** they load `/collection`, `/trades`, `/wishlist` or `/profile`,
  - **Then** a `banner` landmark contains a link to `/collection` with accessible name "ManaPals",
  - **And** that link contains a visible `img` with `naturalWidth` greater than 0.
- **AC-15** *(header navigates home)*
  - **Given** an authed user on `/wishlist`,
  - **When** they tap the header logo,
  - **Then** the URL is `/collection`.
- **AC-16** *(no layout regression)*
  - **Given** an authed user on `/collection` at the Pixel 7 viewport,
  - **Then** `document.documentElement.scrollWidth` is at most `window.innerWidth` (§5.2, no horizontal scroll),
  - **And** the header link's bounding box is at least 44px tall (touch target, §5.2).

**Cleanup**
- **AC-17**
  - `public/next.svg`, `public/vercel.svg`, `public/file.svg`, `public/globe.svg` and `public/window.svg` don't exist.
  - A Vitest check confirms no file under `src/` or `tests/` mentions any of those five names.
  - **Given** a signed-out request, `GET /next.svg` returns 404.

**Privacy (regression)**
- **AC-18**
  - **Given** a signed-out visitor,
  - **When** they request `/collection`, `/wishlist`, `/trades` and `/u/e2e_friend`,
  - **Then** they're still redirected to `/sign-in`, as the existing `auth.spec.ts` checks, extended with `/u/e2e_friend`. Any change to the proxy matcher for AC-5 must only exempt the icon and manifest paths.

## Data & privacy
- **No schema, RLS or migration change.** Nothing new is stored.
- **What's newly public.** Static brand assets (icons and the manifest) become reachable without a session. They have no user data. The manifest only has app-level constants (name, start URL, colors, icon URLs).
- **What stays private.** Collections, wishlists, trade pages and profiles keep their current visibility (friends-only by default, PRD §5.3). The proxy change for AC-5 must not widen the signed-out allow-list beyond these asset paths (AC-18).
- **No third parties.** The logo is served from our own origin. No external font or icon CDN is added.

## UX notes
- **Screens touched:**
  - `/sign-in`: the mark replaces the emoji box, at the same 64×64 size and position. The heading, tagline, button and footer disclaimer are unchanged.
  - Every `(main)` page gets a slim top bar with the lockup on `bg-page` or `bg-surface` and a bottom `border-border`, using existing tokens only.
    - Suggested size: the lockup about 28px tall, inside a bar at least 44px tall, with `env(safe-area-inset-top)` padding for standalone iOS.
    - Page content and `h1` titles stay below the bar. The bar isn't sticky (Q1).
  - Browser tab and home-screen icon (outside the page).
- **Loading:** the logo is a static same-origin SVG, so there's no skeleton or spinner. Give the `img` explicit `width`/`height` so there's no layout shift.
- **Empty:** not applicable. The logo shows in every state, including the collection empty state and the `CollectionLoadError` state.
- **Error:** if a logo image fails to load, the accessible name ("ManaPals logo" / "ManaPals") is still there and the sign-in heading text still shows. No custom fallback UI.
- **Accessibility:**
  - On sign-in, the mark has `alt="ManaPals logo"`. The visible `h1` carries the name.
  - The header link's accessible name is "ManaPals". The lockup's wordmark is drawn as paths, so the `img` alt must give the name.

## Open questions
1. **Signed-in brand spot: add a header bar, or skip it?**
   - The `(main)` layout has no header today. Each page starts with its own `h1`, and the PRD doesn't call for one.
   - The issue asks for the logo in the "app header/brand spot", so something has to be added.
   - **Recommended:** a slim, non-sticky top bar in `(main)/layout.tsx` with the dark lockup, linking to `/collection` (AC-14 to AC-16). It costs about 44–48px of vertical space on every page.
   - Alternative: skip the header and brand only the sign-in page. In that case, drop AC-14 to AC-16.
2. **Sign-in: mark plus text heading, or the full lockup?**
   - **Recommended:** the square mark in place of the emoji, keeping the live-text `h1` "ManaPals". This keeps the existing heading test and screen-reader name, and shows the mark at hero size.
   - Alternative: replace the mark, heading and text with the lockup inside the `h1` (`alt="ManaPals"`). AC-12's heading assertion would still pass, but the visible wordmark would no longer be live text.
3. **Manifest `display` mode.**
   - `standalone` hides the browser chrome. On iOS, that can break or complicate the Google OAuth redirect, which leaves the standalone window, and the PRD treats native-app-like behavior as out of scope (§6).
   - **Recommended:** `display: "browser"` for now. Users still get the right icon and name on the home screen. Standalone can be a follow-up once OAuth is checked in that mode.
4. **Transparent corners on raster icons.**
   - `concept-3.svg` is a rounded square (`rx=15`) with transparent corners. iOS fills transparency with black and applies its own mask, which can leave a thin dark rim.
   - **Recommended:** render the apple-icon and manifest PNGs from the SVG as-is on a `#0c1015` background, so the corners are flattened to the mark's own fill. This is a rasterization choice, not a redesign.
   - Keep the favicon ICO's corners transparent, as given.
5. **Open Graph image.**
   - The issue says to add it "if the app has one". It doesn't. US-23 (per-profile preview cards) isn't built, and signed-out crawlers are redirected to `/sign-in` anyway.
   - **Recommended:** out of scope. File a follow-up for US-23 that includes a branded default `opengraph-image`.
6. **Maskable Android icon.**
   - Without a `purpose: "maskable"` icon, some Android launchers show the mark inside a white circle.
   - **Recommended:** out of scope for this issue, because it needs a padded variant of the art, which is close to a redesign. Follow up if the white-circle look is a problem on test devices.
7. **Manifest colors as hex.**
   - Tokens are written in `oklch`, and manifest color support for `oklch` is inconsistent.
   - **Recommended:** use `#0c1015`, the mark's background from the brand SVG, as a literal in the manifest. The issue says it matches `--color-page`, and this adds no token. If the architect finds a visible mismatch with `oklch(13% 0.01 260)`, use the hex conversion of the token instead and note it in the PR.

## Design
Mockup: [mockup.html](32-new-manapals-logo/mockup.html) · Screenshot: [mockup.png](32-new-manapals-logo/mockup.png) (390px wide). Uses the `docs/brand/` SVGs as given and existing tokens only.

| # | Screen / state | ACs |
|---|----------------|-----|
| 1 | `/sign-in` default: 64x64 mark replaces the emoji box; `h1`, tagline, button, disclaimer unchanged | AC-11, AC-12, AC-13 |
| 2 | `/sign-in` with the logo failed to load: alt text in the same 64x64 box; heading and button remain, no shift | AC-11, AC-12 |
| 3 | `(main)` top bar on `/collection`: `bg-surface`, `border-b border-border`, min 48px tall, dark lockup 28px tall, 44px link hit area, not sticky, safe-area top padding | AC-14, AC-15, AC-16 |
| 4 | Top bar over the collection empty / load-error state (same bar on every state and page) | AC-14 |
| 5 | Browser tab favicon at 16px, 32px and scalable SVG | AC-1, AC-7 |
| 6 | Home-screen icons: iOS 180px, Android 192/512 (circle-crop worst case), labelled "ManaPals" | AC-2, AC-6, AC-8 |

Design choices (no new open questions): the bar uses `bg-surface` rather than `bg-page` so it reads as chrome above the page; the lockup is left-aligned; the sign-in mark drops the old border because the SVG has its own stroke. Q1 to Q4 recommendations are the ones drawn.
