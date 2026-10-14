# Use the new ManaPals logo across the app
Issue: #32 · PRD refs: §5.2 (mobile experience), US-01 (sign-in), US-23 (link previews, for context only) · Status: Approved

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


## Decisions (spec gate, 2026-10-14)
Owner replied `approve` with no changes. Recommended defaults accepted for Q1–Q7.

## Technical design

Sources read: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/{app-icons,manifest}.md`, `.../03-file-conventions/proxy.md`, `.../02-components/image.md` (SVG handling), and the Next 16.2.12 metadata route code (`dist/lib/metadata/get-metadata-route.js`, `dist/build/webpack/loaders/metadata/discover.js`) to confirm the served URLs.

### How Next serves each asset (verified)
| File | Served at | `<head>` tag emitted by root layout |
|------|-----------|-------------------------------------|
| `src/app/favicon.ico` | `/favicon.ico` | `<link rel="icon" href="/favicon.ico?…" sizes="any">` (always first) |
| `src/app/icon.svg` | `/icon.svg` | `<link rel="icon" href="/icon.svg?…" type="image/svg+xml" sizes="any">` |
| `src/app/apple-icon.png` | `/apple-icon.png` | `<link rel="apple-touch-icon" href="/apple-icon.png?…" type="image/png" sizes="180x180">` |
| `src/app/manifest.ts` | `/manifest.webmanifest` | `<link rel="manifest" href="/manifest.webmanifest">` |
| `public/icons/manapals-192.png`, `-512.png` | `/icons/manapals-{192,512}.png` | none (only referenced from the manifest) |
| `public/brand/concept-3.svg`, `concept-3-lockup.svg` | `/brand/…` | none (used by `<Image>`) |

Static metadata files keep their extension in the URL (`fillMetadataSegment` joins `name + ext`). The only extensionless-looking route is the manifest, which Next always serves as `/manifest.webmanifest`. All files sit at the `app/` root, not in a route group, so no hash suffix is added. Because they are at the root segment, the links come from the root layout and appear on every page, both signed in and signed out (AC-4).

The 192/512 manifest PNGs go in `public/icons/`, not `app/icon1.png`/`icon2.png`. Numbered `icon*` files would add two more `<link rel="icon">` tags to every page, and the manifest needs a stable URL anyway.

### Changes
**Add**
- `src/app/icon.svg`: byte-identical copy of `docs/brand/concept-3.svg`.
- `src/app/apple-icon.png`: 180×180 render of `concept-3.svg`, flattened on `#0c1015` (Q4).
- `src/app/manifest.ts`: returns a `MetadataRoute.Manifest` with `name`/`short_name` "ManaPals", `start_url: "/collection"`, `display: "browser"` (Q3), `background_color`/`theme_color` `#0c1015` (Q7), and icons `{ src: "/icons/manapals-192.png", sizes: "192x192", type: "image/png" }` and the same for 512. There is no `purpose` field (Q6). This is a static, build-time-cached route handler with no request-time APIs.
- `public/icons/manapals-192.png`, `public/icons/manapals-512.png`: renders flattened on `#0c1015`.
- `public/brand/concept-3.svg`, `public/brand/concept-3-lockup.svg`: byte-identical copies of the `docs/brand/` files, used by the sign-in mark and the header.
- `scripts/generate-brand-icons.ts`: a one-off generator, run with `npx tsx scripts/generate-brand-icons.ts`. It is not part of `build`, and its output is committed (see "Raster generation").
- `tests/unit/brand-assets.test.ts`: covers AC-7, AC-8, AC-9, AC-10 and AC-17 (unit part).
- `tests/e2e/brand.spec.ts` (`mobile` project, signed out): covers AC-1, AC-2, AC-3, AC-5, AC-6, AC-11, AC-12 (emoji), AC-17 (404).
- `tests/e2e/authed/brand-header.spec.ts`: covers AC-4, AC-14, AC-15, AC-16.

**Modify**
- `src/app/favicon.ico`: replace it with a PNG-in-ICO containing 16, 32 and 48 px entries, rendered from `concept-3.svg` with transparent corners kept (Q4).
- `src/proxy.ts`: matcher only. Add `manifest\\.webmanifest$` to the negative lookahead (see the next section). No logic change.
- `src/app/(auth)/sign-in/page.tsx`: replace the emoji `<div>` with `<Image src="/brand/concept-3.svg" alt="ManaPals logo" width={64} height={64} priority className="mx-auto" />` from `next/image`. Next sets `unoptimized` automatically for `.svg` sources, so no `dangerouslyAllowSVG` change is needed. Drop the old box border, per the Design notes. The `h1`, tagline, button and disclaimer stay unchanged.
- `src/app/(main)/layout.tsx`: before `<main>`, add `<header className="bg-surface border-b border-border pt-[env(safe-area-inset-top)]">` containing `<Link href="/collection" className="flex min-h-12 items-center px-4">` with `<Image src="/brand/concept-3-lockup.svg" alt="ManaPals" width={112} height={28} priority />`. 255×64 scaled to 28px tall is about 112px wide. The header isn't sticky. The layout stays a server component, and its `header` element is the `banner` landmark. `BottomNav` and the `pb-16` padding are unchanged.
- `tests/e2e/auth.spec.ts`: add `/u/e2e_friend` to the protected-routes redirect loop (AC-18).
- `tests/e2e/__screenshots__/linux/auth.spec.ts/sign-in.png` (and the darwin one if refreshed): new baselines from the CI `linux-screenshots` artifact (AC-13).
- `package.json` / `package-lock.json`: add `sharp` `0.34.5` as an explicit devDependency, used only by the generator script. It is already installed as a transitive dependency of `next`, so the lockfile change is small. Pinning it stops the script depending on a hoisted transitive dependency.

**Delete**
- `public/next.svg`, `public/vercel.svg`, `public/file.svg`, `public/globe.svg`, `public/window.svg`.

`globals.css`, `next.config.ts`, the root `layout.tsx` metadata and `BottomNav` are not touched.

### Proxy matcher decision
Current:
```
"/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"
```
New:
```
"/((?!_next/static|_next/image|favicon.ico|manifest\\.webmanifest$|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"
```
- `/favicon.ico` is already excluded. `/icon.svg`, `/apple-icon.png`, `/icons/*.png` and `/brand/*.svg` are already excluded by the extension rule, and the matcher tests the pathname, so the `?hash` query doesn't matter.
- The only gap is `/manifest.webmanifest`. Today it would get a 307 to `/sign-in` for cookieless manifest fetches. The new rule is anchored to that one root path, rather than adding `webmanifest` to the extension list (`.*\.webmanifest$`), so no other path is newly exempted (AC-18).
- Rejected alternative: an `isPublicAsset` check inside `proxy()`. It would still call `supabase.auth.getUser()` (a network round-trip) for each icon request, and it moves allow-list logic into code that runs on every page.
- Next re-runs the matcher at build time from a constant string. The regex must stay a literal, with no variables.

### Raster generation (committed files, not code-generated)
All raster files are committed, so AC-8 stays a Vitest IHDR check and there is no runtime image generation. `scripts/generate-brand-icons.ts` uses `sharp` 0.34.5, which bundles librsvg 2.61. ImageMagick is **not** installed on the runner (`which convert magick` finds nothing), so don't use it.
- For each size `s`, the script runs `sharp(svgBuffer, { density: 72 * s / 64 }).resize(s, s)`. Rendering at the target density keeps edges sharp, rather than scaling up a 64px raster.
- For `apple-icon.png` (180) and `manapals-{192,512}.png`, it adds `.flatten({ background: "#0c1015" }).png()`, which gives opaque corners (Q4).
- For the favicon, it renders 16, 32 and 48 px PNGs with alpha kept, then writes an ICO container by hand: a 6-byte ICONDIR (`0, 1, count`), one 16-byte ICONDIRENTRY per image (width, height, 0, 0, planes=1, bpp=32, byteSize, offset), then the PNG payloads. All target browsers support PNG-in-ICO. This avoids adding a `png-to-ico` dependency.
- A prototype run on this runner rendered the art correctly at 16, 32, 180 and 512, and the flattened outputs have no alpha.
- Re-run the script only if the source art changes. It writes to the paths listed under "Add", plus `src/app/favicon.ico`.

### Schema
None. There's no migration, no RLS change and no backfill.

### Data flow
- Everything is static. The icons and SVGs are files served by Next or Vercel's CDN. `manifest.ts` is a static route handler prerendered at build. No Supabase queries are added.
- The sign-in page stays a client component. `next/image` works there, and the SVG is a plain same-origin `<img>`.
- `(main)/layout.tsx` stays a server component with no data fetching. The header is static markup, and `Link` handles client navigation to `/collection`.

### Logic placement
There's no business logic. The ICO/PNG header parsing used by tests lives in the test file (`tests/unit/brand-assets.test.ts`), because it is test-only tooling, not app logic. The generator script is a dev tool in `scripts/`. Nothing goes in `src/lib/**`.

### Test plan
| AC | Test | What it checks |
|----|------|----------------|
| AC-1 | E2E `brand.spec.ts` | On `/sign-in`, `link[rel="icon"]` has an href whose `new URL(href, base).pathname === "/favicon.ico"`, and `link[rel="icon"][type="image/svg+xml"]` has count 1 |
| AC-2 | E2E `brand.spec.ts` | `link[rel="apple-touch-icon"]` has count 1 with `sizes="180x180"` |
| AC-3 | E2E `brand.spec.ts` | `link[rel="manifest"]` has count 1 |
| AC-4 | E2E `authed/brand-header.spec.ts` | The same three assertions on `/collection` (shared helper `expectBrandHeadLinks(page)` in the spec, or exported from `tests/e2e/helpers.ts`) |
| AC-5 | E2E `brand.spec.ts` | Uses `playwright.request.newContext({ baseURL, extraHTTPHeaders: bypass header if set })` with no storage state. Collects the hrefs from the AC-1 to AC-3 links plus the manifest `icons[].src`. For each one, `get(url, { maxRedirects: 0 })` returns status 200 with the expected `content-type` prefix (`image/x-icon` or `image/vnd.microsoft.icon`, `image/svg+xml`, `image/png`, `application/manifest+json` or `application/json`) |
| AC-6 | E2E `brand.spec.ts` | Parses the manifest JSON and asserts `name`, `short_name`, `start_url`, both colors equal `#0c1015`, and that `icons` has PNG entries with `sizes` "192x192" and "512x512" |
| AC-7 | Unit `brand-assets.test.ts` | Reads `src/app/favicon.ico` and parses the ICONDIR (`type === 1`; each entry's width byte, where 0 means 256), expecting 16 and 32 to be present. The sha256 must not equal `2b8ad2d3…775932` |
| AC-8 | Unit | Reads the PNG IHDR (bytes 16–23, big-endian width and height) of `src/app/apple-icon.png` (180), `public/icons/manapals-192.png` and `-512.png`. Also checks the PNG signature |
| AC-9 | Unit, plus an E2E sub-check | Unit: `src/app/icon.svg`, `public/brand/concept-3.svg` and `public/brand/concept-3-lockup.svg` are `Buffer.equals` to their `docs/brand/` sources. E2E: the sign-in logo `img`'s `currentSrc` and the header `img`'s `currentSrc` are fetched and compared byte-for-byte with the `docs/brand` files (Playwright runs in Node, so it can `readFileSync`) |
| AC-10 | Unit | Regex over the `@theme { … }` block of `globals.css`. The `--color-*` names must equal exactly the 10 names: page, surface, elevated, border, border-strong, amber, success, text-primary, text-secondary, text-muted |
| AC-11 | E2E `brand.spec.ts` | `getByRole("img", { name: "ManaPals logo" })` is visible, and `evaluate(img => img.naturalWidth) > 0` |
| AC-12 | E2E `brand.spec.ts` + existing `auth.spec.ts` | `page.content()` doesn't contain `🃏`. The existing heading and button test stays unchanged |
| AC-13 | E2E `auth.spec.ts` "sign-in page visual" | New baselines committed from the CI `linux-screenshots` artifact. The PR expects one failing visual run before the baseline commit |
| AC-14 | E2E `authed/brand-header.spec.ts` | For `/collection`, `/trades`, `/wishlist` and `/profile`: `getByRole("banner").getByRole("link", { name: "ManaPals" })` has `href="/collection"`, and its `img` is visible with `naturalWidth > 0` |
| AC-15 | E2E authed | `goto("/wishlist")`, tap the header link, then `toHaveURL(/\/collection$/)` |
| AC-16 | E2E authed | On `/collection`: `scrollWidth <= innerWidth`, and the header link's `boundingBox().height >= 44` |
| AC-17 | Unit + E2E | Unit: the five `public/*.svg` files don't exist (`existsSync`), and a recursive scan of `src/` and `tests/` text files finds none of the names. Build the names at runtime (for example `["next","vercel","file","globe","window"].map(n => n + ".svg")`) and skip the test file itself, or the test matches its own source. E2E: a signed-out `GET /next.svg` returns 404 |
| AC-18 | E2E `auth.spec.ts` (modified) | `/u/e2e_friend` added to the redirect loop. `brand.spec.ts` also asserts that `GET /collection` with `maxRedirects: 0` in a cookieless context returns 307 to `/sign-in`, so the matcher is pinned on both sides |

Seed data: none. AC-18 uses the existing seeded `e2e_friend`. The authed specs are read-only, so they belong in the parallel `authed` project (not `.serial`).

### Risks
- **Proxy allow-list widening (privacy).** The new exemption is anchored to the single path `/manifest.webmanifest`, which returns only constants. The existing extension rule already means any path ending in `.svg` or `.png` skips the proxy, for example `/u/foo.png`. That is not new, and every `(main)` page also calls `supabase.auth.getUser()` and `redirect("/sign-in")` itself (`/u/[username]` does, at line 23). AC-18 plus the cookieless 307 assertion guard against regressions. Don't "simplify" the change to `.*\\.webmanifest$` or add `ico`/`json` to the extension list.
- **`theme_color` mismatch with the token.** The spec's Q7 assumption is slightly off. `oklch(13% 0.01 260)` converts to about `#05070b`, not `#0c1015`. The approved AC-6 fixes `#0c1015`, which matches the mark's own fill, and with `display: "browser"` theme and background colors barely show. Keep `#0c1015` as approved and note the difference in the PR, per Q7. If the owner prefers the token value, change both the manifest and AC-6 together.
- **Visual baseline churn.** `sign-in.png` changes by design. The CI E2E run fails its screenshot step until the linux baseline from the artifact is committed. Don't regenerate baselines locally on darwin and commit them as linux.
- **Header shifts the authed pages down by about 48px.** Any existing authed screenshot or `boundingBox` assertions could move. Today there are no authed screenshot baselines, and the existing authed specs use role and text queries, so the risk is low. `env(safe-area-inset-top)` is 0 unless `viewport-fit=cover` is set, which it isn't, so the padding is harmless now and correct later.
- **Favicon caching.** Browsers cache favicons aggressively. Next appends a content hash query to the icon hrefs, so new visits pick up the change, but testers on old tabs may still see the Next triangle. This affects manual QA only.
- **Dev vs prod content-type.** `next dev` (Turbopack) and Vercel serve `favicon.ico` as `image/x-icon` and the manifest as `application/manifest+json`. AC-5 accepts both ICO MIME types and both JSON types, so either server passes.
- **Performance.** There are two extra small same-origin SVG requests (each under 3 KB) on page load, marked `priority`, and the manifest is static. There are no collection-size effects.
- **Migration safety.** No migration.
