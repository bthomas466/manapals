# New user onboarding wizard
Issue: #34 · PRD refs: US-02, US-03, US-04, US-06, US-07, §1.3, §4.2, §5.2, §5.3 · Status: Draft

## Problem
A new user signs in with Google and lands on `/collection`, which says "No cards yet" and nothing else. The app never explains how to get data out of Manabox (US-02). Users are also never asked to choose an identity: the `handle_new_user` trigger (`supabase/migrations/20260803150034_friend_graph.sql`) quietly gives them a username taken from their email prefix (for example `jsmith1987` or `player_42`). The only place to change it is a small "Edit" link on `/profile`. As a result, the profile URL a new user would share with friends (US-06, `/u/<username>`) is one they never chose and may not know about.

PRD §1.3 sets the goal "import a Manabox CSV and have a browsable profile in under 2 minutes". Without guidance, new users are much less likely to reach that point.

**Important:** "no username" can't be used to detect a new user. Every profile gets a username at signup, from the trigger or from `ensureProfile` (`src/lib/profile/ensure.ts`). "No collection" doesn't work either: it would also catch existing users who never imported, and the issue says existing users must not see the wizard. So this feature needs an explicit, stored "onboarding finished" marker (see Data & privacy).

## Users & scenario
Sam's friend Maya texts him a ManaPals link. On his phone (390px wide) he taps it and chooses **Continue with Google**.

1. Instead of an empty Collection page, Sam sees **Welcome to ManaPals · Step 1 of 2: Your profile**. The fields are already filled in: display name "Sam Rivera" (from Google) and username `samrivera88` (generated at signup). Under the username, a live preview shows his profile link, `/u/samrivera88`. His Google photo appears as his avatar, with a **Remove photo** option. One line explains that only friends can see his collection.
2. He changes the username to `samr`, which is taken. The message "That username is taken." appears. He tries `sam_rivera` and taps **Continue**.
3. **Step 2 of 2: Import your collection** shows numbered steps for exporting a CSV from the Manabox app, then a **Choose CSV file** button. He switches to Manabox, exports, comes back, and picks the file.
4. He sees "Found 1,204 cards in this file" and taps **Import cards**. A moment later: "Imported 1,198 cards", followed by a list of 6 cards that couldn't be matched. He taps **Go to my collection** and lands on `/collection` with his cards.
5. The next day he opens ManaPals again and goes straight to `/collection`. The wizard never comes back.

Alternate path: Sam is at the shop and doesn't have time to export. On step 2 he taps **Skip for now** and lands on the usual "No cards yet" state. That evening he taps **Import Collection**, opens **How to export from Manabox**, and sees the same steps as in the wizard.

## Scope
### In scope
- **New route for the wizard**, for example `/welcome`. The architect picks the final path. It has two steps with a "Step N of 2" indicator and no bottom nav.
- **Onboarding marker** stored on the user's profile. It's unset for users created after this ships. A migration sets it for every profile that already exists, so current users never see the wizard.
- **Gate:** a signed-in user without the marker who requests any `(main)` page (`/`, `/collection`, `/trades`, `/trades/*`, `/wishlist`, `/profile`, `/u/*`) is redirected to the wizard. A user with the marker who opens the wizard URL is redirected to `/collection`. `/api/*` and `/sign-in` are not gated.
- **Step 1: Profile (required, can't be skipped).**
  - Display name and username are pre-filled from the current profile row.
  - A live profile-URL preview shows `/u/<username>`.
  - Validation and error copy are the same as today's `updateProfile` in `src/lib/friends/actions.ts`:
    - Username: 3–20 characters, lowercase letters, digits and `_`. Input is lower-cased as you type.
    - Display name: required after trimming.
    - A username that's already taken shows "That username is taken."
  - **Avatar:** if the profile has an `avatar_url` (the Google photo), show it with a **Remove photo** option. If removed, `avatar_url` is saved as null. With no photo, show the existing placeholder and no avatar control. Uploading a photo is out of scope (Q2).
  - A one-line privacy note: "Only friends can see your collection. You can change this in Profile."
  - **Continue** saves the profile, then shows step 2.
- **Step 2: Import (can be skipped).**
  - A numbered list of Manabox export steps (US-02).
  - The upload flow reuses the existing parse, confirm and import flow (`parseManaboxCsv` in `src/lib/csv/manabox.ts`, `POST /api/collection/import`), including its error and unmatched-card states (US-03).
  - **Back** returns to step 1.
  - **Skip for now** sets the marker and goes to `/collection`.
  - A successful import sets the marker as soon as it succeeds. **Go to my collection** then goes to `/collection`.
- **A way back to the instructions later:** a "How to export from Manabox" disclosure on the pick step of the existing `ImportCollectionModal`. It shows the same instructions component as the wizard. That covers the empty state and re-imports (US-04).
- **Pure logic in `src/lib/**`, with unit tests:**
  - Profile input validation. Extract it from `updateProfile` so the wizard and `/profile` share one function.
  - The "needs onboarding" decision.
  - The Manabox instruction steps, as data so the wizard and the modal render the same text.

### Out of scope
- Uploading or cropping a custom avatar. That needs a Storage bucket and its policies (Q2).
- Adding friends, friend suggestions, or invite links in the wizard (excluded by the issue).
- Starting a wishlist in the wizard (excluded by the issue).
- A collection-visibility toggle in the wizard. Only the informational line is included; the toggle stays on `/profile`.
- Returning the user to the deep link they originally opened, such as Maya's `/u/maya`, after the wizard. Today the proxy drops the original path when it redirects to `/sign-in`, so this needs separate work (Q5).
- Share-sheet import from Manabox (US-05).
- Screenshots or images of the Manabox app in the instructions. They'd go stale and raise trademark concerns. Text only.
- A real-time "username available" check while typing. The error appears on Continue.
- Remembering progress between steps. While the marker is unset, the wizard always opens at step 1, pre-filled with whatever was saved last (Q4).
- Changing the "No cards yet" empty state, or the `/profile` edit form beyond sharing the validation function.
- Analytics or funnel tracking for the wizard.
- Letting existing users run the wizard again.

## Acceptance criteria
Unit = Vitest on pure functions in `src/lib/**`. E2E = Playwright at mobile viewport, signed in as a seeded user whose onboarding marker the test clears and restores. RLS = node Supabase client signed in as a seeded user.

**Gate**
- **AC-1** *(new user is sent to the wizard)*
  - **Given** I'm signed in and my onboarding marker is unset,
  - **When** I open `/collection`,
  - **Then** the URL becomes the wizard route and "Step 1 of 2" is visible.
- **AC-2** *(every main page is gated)*
  - **Given** my marker is unset,
  - **When** I open each of `/`, `/trades`, `/wishlist`, `/profile` and `/u/e2e_friend`,
  - **Then** each one ends on the wizard route.
- **AC-3** *(existing and finished users never see it)*
  - **Given** my marker is set,
  - **When** I open `/collection`, **Then** I stay on `/collection` and no "Step 1 of 2" text is present.
  - **When** I open the wizard route, **Then** I'm redirected to `/collection`.
- **AC-4** *(backfill)*
  - **Given** the migration has run,
  - **When** `profiles` is queried for rows created before the migration timestamp that have no marker,
  - **Then** zero rows come back. The seeded `e2e_player` reaches `/collection` without being redirected.
- **AC-5** *(signed out)*
  - **Given** I'm signed out,
  - **When** I open the wizard route,
  - **Then** I'm redirected to `/sign-in`.
- **AC-6** *(gate logic, Unit)*
  - `needsOnboarding(profile)` returns true when the marker is null.
  - It returns false when the marker is set.
  - It returns false when the profile is null. If the profile can't be loaded, the gate fails open instead of looping.

**Step 1: Profile**
- **AC-7** *(pre-fill and preview)*
  - **Given** my profile has display name "E2E Player" and username `e2e_player`,
  - **When** step 1 loads,
  - **Then** the inputs hold those values and the text `/u/e2e_player` is visible.
  - **When** I change the username to `new_name`, **Then** the preview reads `/u/new_name` without a save.
- **AC-8** *(can't be skipped)*
  - **Given** I'm on step 1,
  - **Then** no control labelled "Skip" is present,
  - **And** if I open `/collection` directly, I'm redirected back to step 1.
- **AC-9** *(invalid username)*
  - **Given** I'm on step 1,
  - **When** I enter `ab` and tap Continue,
  - **Then** "Username must be 3-20 characters: lowercase letters, numbers, underscores." is visible, I stay on step 1, and my `profiles.username` is unchanged.
  - **And When** I type `Sam_R`, **Then** the input shows `sam_r`.
- **AC-10** *(taken username)*
  - **Given** another user holds `e2e_friend`,
  - **When** I enter `e2e_friend` and tap Continue,
  - **Then** "That username is taken." is visible and I stay on step 1.
- **AC-11** *(empty display name)*
  - **When** I clear the display name, or enter only spaces, and tap Continue,
  - **Then** "Display name is required." is visible and I stay on step 1.
- **AC-12** *(save)*
  - **Given** valid inputs,
  - **When** I tap Continue,
  - **Then** "Step 2 of 2" is visible,
  - **And** my `profiles` row has the new username and the trimmed display name,
  - **And** my onboarding marker is still unset.
- **AC-13** *(remove photo)*
  - **Given** my profile has a non-null `avatar_url`,
  - **Then** step 1 shows that image and a "Remove photo" control.
  - **When** I tap Remove photo and then Continue, **Then** `avatar_url` is null.
  - **And Given** `avatar_url` is null, **Then** the placeholder shows and there's no "Remove photo" control.
- **AC-14** *(save error)*
  - **Given** the profile save request fails (the test intercepts it with a 500),
  - **When** I tap Continue,
  - **Then** "Couldn't update profile." is visible, I stay on step 1, and my typed values are still in the inputs.
- **AC-15** *(privacy note)*
  - Step 1 contains the text "Only friends can see your collection".
- **AC-16** *(validation logic, Unit)*
  - The shared validation function accepts `abc`, `a_b_1` and a 20-character name.
  - It rejects `ab`, a 21-character name, `a-b`, `a b` and an empty string, each with the AC-9 message.
  - It rejects a blank or whitespace-only display name with the AC-11 message.
  - It returns the trimmed display name and the lower-cased username.
  - `/profile`'s `updateProfile` uses the same function: its existing behaviour stays the same, and the Unit test calls both paths.

**Step 2: Import**
- **AC-17** *(instructions)*
  - **Given** I'm on step 2,
  - **Then** an ordered list with at least 3 items is visible, and its text includes "Manabox", "Export" and "CSV",
  - **And** the buttons "Choose CSV file", "Skip for now" and "Back" are visible.
- **AC-18** *(successful import)*
  - **Given** my collection is empty,
  - **When** I choose the valid fixture CSV,
  - **Then** text "Found N cards" appears (N is the fixture's merged row count), and no text containing "replace" is shown.
  - **When** I tap "Import cards", **Then** "Imported M cards" and a "Go to my collection" button appear.
  - **When** I tap it, **Then** I'm on `/collection` and at least one card tile is visible.
- **AC-19** *(marked as soon as the import succeeds)*
  - **Given** the import in AC-18 has succeeded,
  - **When** I reload `/collection` without tapping "Go to my collection",
  - **Then** I am not redirected to the wizard.
- **AC-20** *(malformed file)*
  - **Given** I'm on step 2,
  - **When** I choose a CSV with no usable rows,
  - **Then** the parser's error message (for example "No usable rows found in this file.") and a "Try another file" button are visible,
  - **And** my marker is still unset and my collection has 0 rows.
- **AC-21** *(server error)*
  - **Given** `POST /api/collection/import` is intercepted to return 500 `{ "error": "Import failed." }`,
  - **When** I confirm an import,
  - **Then** "Import failed." and "Try another file" are visible, and my marker is still unset.
- **AC-22** *(unmatched cards)*
  - **Given** the fixture contains one row that doesn't match Scryfall,
  - **When** the import finishes,
  - **Then** the text "1 card couldn't be matched" and that card's name are visible.
- **AC-23** *(existing rows still warn)*
  - **Given** my marker is unset but I already have collection rows (for example, I imported and then cleared the marker in the test),
  - **When** I choose a valid file on step 2,
  - **Then** the confirm text contains "replace your current collection" (PRD §4.2).
- **AC-24** *(skip)*
  - **Given** I'm on step 2 with an empty collection,
  - **When** I tap "Skip for now",
  - **Then** I'm on `/collection` and "No cards yet" is visible,
  - **And** after a reload I'm still on `/collection`.
- **AC-25** *(back)*
  - **Given** I saved username `sam_rivera` on step 1,
  - **When** I tap "Back" on step 2,
  - **Then** "Step 1 of 2" is visible and the username input holds `sam_rivera`.
- **AC-26** *(instructions later)*
  - **Given** I've finished or skipped onboarding,
  - **When** I open the Import Collection modal on `/collection` and tap "How to export from Manabox",
  - **Then** the same ordered list as AC-17 is visible, with the same item text.

**Mobile (PRD §5.2)**
- **AC-27** *(no horizontal scroll)*
  - **Given** viewport widths of 375px and 390px,
  - **When** I view step 1, step 1 with an error, step 2, step 2 with a parse error, and the import-done state,
  - **Then** `document.documentElement.scrollWidth` is at most the viewport width in each case.
- **AC-28** *(touch targets)*
  - **Given** steps 1 and 2,
  - **Then** every visible `button`, `input` and `a` in the wizard has a bounding-box height of at least 44px. Inline links of body text in the instructions are exempt only if the architect records why.
- **AC-29** *(no bottom nav)*
  - **Given** I'm on the wizard route,
  - **Then** the bottom navigation (the `nav` with "Collection", "Trades", "Wishlist" and "Profile" links) isn't rendered.

**Data and privacy (RLS)**
- **AC-30** *(only the owner can write the marker)*
  - **Given** I'm signed in as `e2e_player`,
  - **When** I try to set or clear `e2e_friend`'s onboarding marker,
  - **Then** 0 rows are affected and their marker is unchanged.
- **AC-31** *(visibility untouched)*
  - **Given** my `collection_visibility` is `friends` before the wizard,
  - **When** I finish the wizard by import or by skip,
  - **Then** `collection_visibility` is still `friends`.
- **AC-32** *(new signups start unset)*
  - **Given** a new auth user is created after the migration (the integration test creates one with the admin client),
  - **Then** their auto-created profile has a null marker.

## Data & privacy
- **What's stored:** one new nullable column on `public.profiles` recording that onboarding is finished. The architect decides between a timestamp such as `onboarded_at` and a boolean.
  - **Default for new rows:** null. Both `handle_new_user` and `ensureProfile` insert profiles; see Q3 for the `ensureProfile` case.
  - **Backfill:** set the marker on every existing profile in the same migration (AC-4).
  - **When it's set:** by the owner, when step 2 ends with a successful import or "Skip for now".
- **Profile fields:** `username`, `display_name` and `avatar_url` are unchanged in shape. The wizard writes them through the same validation as `/profile`. `avatar_url` can only be kept as it is or cleared. The wizard never accepts an arbitrary URL from the client.
- **Who can read:** `profiles` is already readable by every authenticated user (`profiles_select_authenticated`). That makes the marker visible to other signed-in users, who could tell whether someone has finished onboarding. This is low-sensitivity. If a timestamp is used, it also shows roughly when the user finished. The architect may prefer a boolean or a column the select policy can't expose; note the decision.
- **Who can write:** only the owner, through the existing `profiles_update_own` policy. No new policies are needed. A user who sets their own marker directly only skips their own wizard, which is harmless.
- **Collection visibility:** unchanged. It stays friends-only by default (PRD §5.3, OQ-04). The wizard displays the setting but doesn't change it.
- **Import:** same data path and rules as today. Purchase prices aren't stored (§5.3). The import replaces the collection, with the warning whenever rows already exist (§4.2, AC-23).
- **Test data:** `scripts/seed-staging.ts` must set the marker on the seeded users. Otherwise freshly created staging users would be gated and break every existing authed E2E spec. The wizard E2E specs clear and restore `e2e_player`'s marker, profile fields and collection, following the serial snapshot/restore pattern from #6.

## UX notes
- **New wizard route** (outside the bottom-nav layout, or with the nav hidden):
  - **Header:** ManaPals wordmark and "Step N of 2", with a progress indicator that doesn't rely on colour alone.
  - **Step 1:**
    - Avatar (Google photo or placeholder) with "Remove photo" when a photo exists.
    - Display name input, plus a username input with an `@` prefix as on `/profile`.
    - Preview line `/u/<username>`, privacy note, and a full-width **Continue** button.
    - States:
      - *Saving:* button disabled with a "Saving…" label.
      - *Field error:* inline under the form; values are kept.
      - *Save error:* "Couldn't update profile."
  - **Step 2:**
    - Title "Import your collection".
    - Numbered instructions, then the existing flow's states, rendered inline on the page instead of in a bottom sheet:
      - *Pick* (Choose CSV file)
      - *Parse error* (Try another file)
      - *Confirm* ("Found N cards", **Import cards**; replace wording only if rows exist)
      - *Importing* ("Importing and fetching card data from Scryfall…")
      - *Done* ("Imported M cards", unmatched list, **Go to my collection**)
    - **Back** (secondary) and **Skip for now** (text button, still 44px tall) are shown in the pick and error states. While importing they're hidden or disabled.
  - **Loading:** the step 1 page is server-rendered with prefilled values. No skeleton is needed beyond the button states.
- **`ImportCollectionModal`:** the pick step gets a "How to export from Manabox" disclosure that expands the shared instructions. Nothing else in the modal changes.
- **Draft instruction copy** (Q1: verify against the current Manabox app):
  1. Open Manabox and go to your **Collection**.
  2. Tap the **⋯** menu and choose **Export**.
  3. Choose **CSV** as the format.
  4. Save the file to your phone (Files on iPhone, Downloads on Android) or share it to yourself.
  5. Come back here and tap **Choose CSV file**.
  - Tip line: "Only want to share one binder? Open that binder in Manabox and export from there." (per-binder exports are supported, §4.2)
- **Unchanged:** `/collection` empty state, `/profile`, `/u/[username]`, `/trades`, `/wishlist`, `/sign-in`.

## Open questions
1. **Manabox export instructions copy.** The steps above are from memory of the Manabox UI and may not match the current iOS and Android versions.
   - **Recommended:** before building, the product owner checks the menu labels in the current Manabox app on both platforms. Keep the copy as data in `src/lib/**` so it's a one-line fix later.
2. **What "optional avatar" means (US-07).** No avatar upload exists today. `avatar_url` only ever holds the Google photo. A real upload needs a Supabase Storage bucket, its RLS policies, size and type limits, and moderation thinking.
   - **Recommended:** v1 offers keep or remove for the Google photo only. Upload is a follow-up issue that also covers `/profile`.
   - Side effect: there's no UI to restore a removed Google photo. Accept for v1.
3. **Profiles created lazily by `ensureProfile`.** These belong to accounts from before the signup trigger, which today only get a profile when they visit `/profile`.
   - **Recommended:** treat them as existing users and set the marker when `ensureProfile` provisions the row. The issue says existing users must not see the wizard.
   - Alternative: leave the marker null and show them the wizard.
4. **Resuming mid-wizard.** If a user saves step 1 and closes the app before finishing step 2, they'll see step 1 again next time, already filled in, so it's one tap.
   - **Recommended:** accept this for v1 instead of storing a step number.
   - Alternative: open at step 2 when `profiles.updated_at` is later than `created_at`. Cheap, but indirect.
5. **Deep link from a friend's invite.** In the scenario, Sam came from Maya's `/u/maya` link and ends up on `/collection`. That loses the "add Maya" moment (PRD §4.5).
   - **Recommended:** out of scope here (the proxy already drops the path at sign-in). File a follow-up to carry a safe, same-origin `next` path through sign-in and the wizard.
6. **Is skipping the import "onboarded"?** The issue says the import can be skipped "with a way to return later".
   - **Recommended:** Skip sets the marker, and the way back is the existing Import button plus the new "How to export from Manabox" disclosure (AC-26). The wizard doesn't nag again.
   - Alternative: keep showing step 2 at each sign-in until the collection is non-empty. Rejected, because it nags users who can't export yet.
7. **Replace warning for a brand-new user.** PRD §4.2 requires a warning before *replacing* a collection. With 0 rows there's nothing to replace.
   - **Recommended:** the wizard drops the replace wording when the user has 0 rows (AC-18) and keeps it when rows exist (AC-23).
   - The modal on `/collection` is unchanged.
8. **Display name length.** Today there's no maximum, so a 500-character name breaks layouts and §5.2's no-horizontal-scroll rule.
   - **Recommended:** add a 50-character maximum in the shared validation function, used by both the wizard and `/profile`. Error copy: "Display name must be 50 characters or fewer." This is a small behaviour change to `/profile`; please confirm.
   - Alternative: leave it unbounded and only truncate in the UI.
9. **Where to put the gate check.** It can run in `src/proxy.ts` (one extra profile read per request) or in the `(main)` layout or pages.
   - **Recommended:** the architect's call. The ACs only require the redirects in AC-1–AC-3 and AC-5, and that `/api/*` keeps working for not-yet-onboarded users, because the wizard calls `/api/collection/import`.

## Design
Mockup: [mockup.html](34-new-user-onboarding-wizard/mockup.html) · Screenshot: [mockup.png](34-new-user-onboarding-wizard/mockup.png). Frames are 375px wide; no bottom nav (AC-29); all controls 44px or taller (AC-28).

| State | Acceptance criteria |
|---|---|
| S1 Step 1 default, Google photo, Remove photo, privacy note, URL preview | AC-7, 13, 15 |
| S2 Step 1 field error (taken username), values kept | AC-9, 10, 11 |
| S3 Step 1 saving label, no-photo placeholder, save error | AC-13, 14 |
| S4 Step 2 pick: numbered instructions, Choose CSV file, Back, Skip for now | AC-17, 24, 25 |
| S5 Step 2 parse/server error with Try another file | AC-20, 21 |
| S6 Step 2 confirm (no replace wording; replace variant noted) | AC-18, 23 |
| S7 Step 2 importing (Back/Skip hidden) | AC-18 |
| S8 Step 2 done with unmatched list, Go to my collection | AC-18, 19, 22 |
| S9 ImportCollectionModal with "How to export from Manabox" disclosure | AC-26 |

Design choices: progress is a two-segment bar plus "Step N of 2" text (not colour alone). Step 2 confirm adds a "Choose a different file" secondary button. The done state shows a "You're all set" heading above the imported count.
