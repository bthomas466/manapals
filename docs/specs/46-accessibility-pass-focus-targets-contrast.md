# Accessibility pass: focus styles, 44px targets, text contrast, danger token
Issue: #46 · PRD refs: §5.2 (touch targets 44px, no horizontal scroll), §4.5 (users can remove friends), US-15, US-16, US-18, US-22 · Status: Draft

## Problem
ManaPals is meant to be used one-handed on a phone at game night (§5.2). Several gaps make it harder to use for keyboard, switch and screen-reader users, and for anyone in a dim room:
- **No consistent focus indicator.** There is no global focus style. Only three elements added in #45 (`not-found.tsx`, `error.tsx`, `ProfileStats.tsx`) carry their own `focus-visible:` classes. Everywhere else, keyboard and switch users get the browser default ring, which is hard to see on the dark surfaces. Two inputs (`ProfileEditForm`, `ProfileStep`) set `outline-none` and show no ring at all.
- **Tap targets under 44px**, which breaks the §5.2 "Touch targets minimum 44px" rule:
  - The wishlist remove ✕ (`WishlistRemoveButton.tsx`) is about 20px (`text-[10px]`). It has no accessible name, so screen readers read it as "multiplication x".
  - The collection color chips and sort select (`CollectionGrid.tsx`) are about 28px. The chips only get `min-h-11` when trade mode is on.
  - The profile "Edit" button, the "← Trades" back link, friend search "Go", the friend and request buttons (`FriendActionButton.tsx`, `FriendRequestActions.tsx`, about 30–36px), the visibility toggle, the profile edit Save/Cancel buttons, and the "Close"/"Cancel" buttons in the Add-to-wishlist and Import sheets are all too small.
- **Low-contrast content text.** `text-text-muted` (about 3:1, fails WCAG AA 4.5:1) is used for real content: @usernames, email, "Request sent", inactive bottom-nav labels, Close/Cancel buttons, summary values, "Showing N of M", and more (about 35 uses in `src/`).
- **Off-system error color.** Eight error messages in seven files use `text-red-500`, a Tailwind palette color outside the design system. Many are at 10–11px, and most lack `role="alert"`, so screen readers don't announce them.
- **One-tap destructive action.** On a friend's page, "Friends ✓ · Remove" is a single button. One stray tap ends the friendship, with no confirmation, and it hides the user's collection access straight away.

## Users & scenario
Sam uses ManaPals on an Android phone with a Bluetooth keyboard and switch access, because of limited hand mobility.

1. Sam opens **Wishlist** and presses Tab. A 2px amber ring moves clearly from the bottom-nav tabs to "Add card" and then to each card's remove button. TalkBack reads "Remove Swords to Plowshares from wishlist, button". Before this change it read "multiplication x".
2. Sam's friend Priya uses the phone with one thumb. On **Collection** she taps the "Blue" chip, and it hits first time because the chip is now 44px tall. The sort select beside it is 44px too.
3. On **Profile**, Priya taps **Edit**, clears her display name by accident and taps **Save**. A red message, "Display name is required" (or the app's existing wording), appears in 14px danger red. TalkBack announces it right away.
4. Priya opens **/u/jonnymtg**. The header shows a non-tappable **Friends ✓** chip and, separately, a **Remove friend** button. She brushes **Remove friend** while scrolling. A sheet asks **"Remove Jonny as a friend?"** with **Cancel** and **Remove**. She taps **Cancel**. Nothing changes, and focus goes back to the Remove friend button.
5. When she taps a button with her finger, no amber ring appears. The ring only shows for keyboard or switch focus.

## Scope
### In scope
**1. Global focus ring** (`src/app/globals.css`)
- Add a global rule: `:focus-visible { outline: 2px solid var(--color-amber); outline-offset: 2px; }`. It must win over utility classes such as `outline-none`, so that no focusable element can lose its ring by accident.
- The per-element `focus-visible:outline-*` classes added in #45 may stay or be removed. They must not produce a different ring.
- Inputs inside a bordered wrapper (`ProfileEditForm` username, `ProfileStep` username) still show a visible amber ring when focused. The ring can be on the input or on the wrapper, which is up to the designer.

**2. Danger token and `<FieldError>`**
- Add `--color-danger` to `@theme`, in the same oklch family as the other tokens. Start from `oklch(68% 0.18 25)` and adjust if needed so it has at least 4.5:1 contrast on `page`, `surface` and `elevated`. The owner has already decided to add this token.
- Add a shared `<FieldError>` component (for example `src/components/ui/FieldError.tsx`) that renders `<p role="alert" className="text-sm text-danger">{message}</p>` and renders nothing when there is no message.
- Replace all eight `text-red-500` error lines with `<FieldError>`. They are in `AddCardSearch`, `FriendActionButton`, `FriendRequestActions` (×2), `ProfileStep`, `ImportStep`, `ProfileEditForm` and `VisibilityToggle`. Error text grows to 14px (`text-sm`) everywhere.
- Replace the remaining Tailwind palette colors in `src/`. These are the `bg-black/50` and `bg-black/60` sheet backdrops in `AddCardSearch`, `CardTradeSheet`, `FirstAvailableConfirm`, `TradeSettingsSheet` and `ImportCollectionModal`. They become a token-based scrim (see Q2).
- Update the design-system notes in `.claude/agents/ui-designer.md` and `.claude/agents/whimsy-injector.md`:
  - list `danger` as an allowed color, for error messages only;
  - state the muted-text rule from section 4;
  - state the global focus ring.
- **Guard:** add an automated check (see Q3) that fails if any Tailwind palette color class (`red-500`, `black`, `white`, `slate-…` and so on, with any color prefix such as `text-`, `bg-`, `border-`, `ring-`, `outline-`, `fill-`, `stroke-` or `placeholder:`) appears in `src/**`.

**3. 44px minimum hit area**
Each control below has a hit area of at least 44×44px: `min-h-11`, plus `min-w-11` where the label is short. A small visual can sit inside an invisible 44px button. The visual size can stay small, but the element that receives the tap must be 44px.
- **Wishlist remove** (`WishlistRemoveButton`): the button is 44×44px with the small ✕ visual inside it. The ✕ glyph is `aria-hidden`. The button gets `aria-label="Remove <card name> from wishlist"`, so `WishlistGrid` passes the card name in.
- **Collection** (`CollectionGrid`): the color chips are `min-h-11` whether trade mode is on or off. The sort `<select>` is `min-h-11`.
- **Profile:**
  - the "Edit" button (`ProfileEditForm`);
  - Save and Cancel in the edit form;
  - both visibility toggle options;
  - friend search "Go";
  - incoming request Accept and Decline, and outgoing request Cancel (`FriendRequestActions`).
- **Friend page** (`/u/[username]`, `FriendActionButton`): Add Friend, "Request Sent · Cancel", Accept Request, Decline, and the new Remove friend button.
- **Trade Match:** the "← Trades" back link.
- **Sheets:** "Close" in Add to wishlist (`AddCardSearch`) and "Cancel" in Import Collection (`ImportCollectionModal`). `CardTradeSheet` and `TradeSettingsSheet` Close buttons are already `min-h-11` and stay that way.
- The larger targets must not cause horizontal scroll at 375px (§5.2).

**4. Content text contrast**
- Switch every content use of `text-text-muted` to `text-text-secondary`. This covers:
  - @usernames;
  - email;
  - "Request sent";
  - inactive bottom-nav labels and icons;
  - the "← Trades" link;
  - Close and Cancel buttons;
  - `CollectionSummary` values and notes;
  - "Showing N of M" and "No cards match your filters.";
  - "Loading printings...";
  - the Manabox export tip;
  - the `/u/<username>` preview in onboarding;
  - the "@" prefix in username inputs;
  - "N cards couldn't be matched";
  - `TradeSettingsSheet` counts;
  - "No ManaPal with that username."
- `text-text-muted` stays only for:
  - input placeholders (`placeholder:text-text-muted`);
  - the two legal footer lines ("ManaPals is not affiliated with Manabox or SkillDevs SC." on `/profile` and `/sign-in`).
- Remove the `aria-label="Close"` from the Import sheet's visible "Cancel" button. Its accessible name should match its visible text (WCAG 2.5.3).

**5. Confirm before removing a friend** (`/u/[username]`, `FriendActionButton`)
- In the "friends" state, show a non-interactive **"Friends ✓"** chip (a plain element, not a button) and, separately, a secondary **"Remove friend"** button. Together they replace the single "Friends ✓ · Remove" button.
- Tapping **Remove friend** opens a confirm dialog (`role="alertdialog"`, `aria-modal`):
  - Title: **"Remove <display name> as a friend?"**
  - Body: **"You'll stop seeing each other's collections, wishlists and trade matches. You can send a new request later."**
  - Buttons: **Cancel** and **Remove**, each at least 44px.
- Focus moves into the dialog when it opens. Cancel, Escape and a backdrop tap close it without any change, and focus returns to the Remove friend button.
- **Remove** calls the existing `removeFriendship(friendshipId)`, and the button is disabled while the request is pending.
  - On success the dialog closes and the page refreshes into the "Add Friend" state.
  - On error the dialog stays open and shows the error in `<FieldError>` ("Couldn't remove.").
- Reuse `FirstAvailableConfirm`'s layout. Generalising it into a shared confirm dialog is the architect's call.

### Out of scope
- A full WCAG audit or screen-reader pass of every screen, such as heading order, landmarks, labels on every input, or the sort `<select>` label (see Q6).
- Focus trapping inside the existing bottom sheets (`CardTradeSheet`, `TradeSettingsSheet`, `AddCardSearch`, `ImportCollectionModal`). The new confirm dialog moves focus in and back out, but a full trap for the old sheets is a follow-up.
- Changing the "Request Sent · Cancel" combined button into a chip plus a button. It only gets the 44px target.
- Confirm steps for other actions: wishlist remove, declining a request, cancelling a request, or sign out.
- Using `danger` for destructive buttons. The token is for error messages only (owner decision). The confirm "Remove" button uses the existing amber confirm style (see Q4).
- Fixing the Tailwind 3 `rounded-[--radius-*]` syntax issue noted in `ui-designer.md`.
- Changing token values other than adding `danger`. `text-secondary`, `text-muted` and `amber` keep their current values.
- Undo after removing a friend, or notifying the removed friend.
- A custom ESLint plugin, if Q3 resolves to the Vitest guard.
- Changing `success` usage or any non-error status colors.

## Acceptance criteria
"Unit" means Vitest. "E2E" means Playwright on the Pixel 7 mobile project, signed in as the seeded `e2e_player` (`tests/e2e/authed/`), unless stated otherwise. Seed facts used here: `e2e_player` is friends with `e2e_friend` ("E2E Friend"), not with `e2e_stranger`, and their wishlist is Swords to Plowshares and Path to Exile.

**Focus**
- **AC-1** *(keyboard focus ring, E2E)*
  - **Given** I'm on `/profile`, `/collection`, `/wishlist` or `/u/e2e_friend`,
  - **When** I press Tab to move through every focusable element on the page, including the bottom nav,
  - **Then** each focused element has computed `outline-style: solid`, `outline-width: 2px`, `outline-offset: 2px` and an `outline-color` equal to the computed `--color-amber`,
  - **And** on `/profile`, after tapping Edit, the username input inside the "@" wrapper shows an amber 2px ring on either the input or the wrapper when it is focused by keyboard.
- **AC-2** *(no ring on tap, E2E)*
  - **Given** I'm on `/profile`,
  - **When** I tap the "Public" visibility option with a pointer (not the keyboard),
  - **Then** that button's computed `outline-style` is `none`.

**Tokens and errors**
- **AC-3** *(token contrast, Unit)*
  - **Given** the `@theme` values in `src/app/globals.css`, converted from oklch to sRGB by a pure helper in `src/lib/`,
  - **Then** `--color-danger` and `--color-text-secondary` each have a WCAG contrast ratio of at least 4.5:1 against `--color-page`, `--color-surface` and `--color-elevated`,
  - **And** `--color-amber` has at least 3:1 against all three (the focus ring is a non-text indicator, WCAG 1.4.11),
  - **And** the helper gives about 21:1 for `#fff` on `#000`.
- **AC-4** *(`FieldError`, Unit)*
  - **Given** `<FieldError message="Couldn't remove." />`,
  - **Then** the markup is a `<p>` with `role="alert"` and the classes `text-sm` and `text-danger`, and contains the text,
  - **And Given** `message` is `null` or `""`, **Then** it renders nothing.
- **AC-5** *(no palette colors, Unit guard)*
  - **Given** every `.ts`, `.tsx` and `.css` file under `src/`,
  - **Then** none of them contains a Tailwind palette color class (any color prefix followed by `black`, `white`, or a palette name plus shade such as `red-500`, optionally with an opacity such as `/60`),
  - **And** none contains `text-red-500`,
  - **And** each of the seven files that used `text-red-500` renders its errors through `FieldError`.
- **AC-6** *(error rendered in danger, E2E)*
  - **Given** I'm on `/profile` and have tapped Edit,
  - **When** I clear the display name and tap Save,
  - **Then** an element with `role="alert"` becomes visible with the display-name validation message,
  - **And** its computed `color` equals the computed `--color-danger` and its `font-size` is `14px`.
  - No profile data changes, because validation fails before any write.

**Hit areas**
- **AC-7** *(44px targets on seeded screens, E2E)*
  - **Given** the Pixel 7 viewport,
  - **Then** each of these elements has a `boundingBox()` of at least 44 wide and 44 tall:
    - on `/wishlist`, every wishlist remove button;
    - on `/collection`, every color chip with trade mode off, and the sort select;
    - on `/profile`, Edit, "Friends only", "Public" and "Go", plus Save and Cancel after tapping Edit;
    - on `/trades/e2e_friend`, the "← Trades" link;
    - on `/u/e2e_friend`, "Remove friend";
    - on `/u/e2e_stranger`, "Add Friend";
    - on `/wishlist`, the "Close" button of the Add to wishlist sheet once it is open.
- **AC-8** *(44px targets in unseeded states, Unit render)*
  - **Given** `IncomingRequestActions`, `OutgoingRequestActions`, `FriendActionButton` (with status `incoming` and `outgoing`) and `ImportCollectionModal` are rendered,
  - **Then** every `<button>` in their markup has `min-h-11`,
  - **And** buttons with one-word labels (Accept, Decline, Cancel) also have `min-w-11`.
- **AC-9** *(wishlist remove has an accessible name, E2E)*
  - **Given** I'm on `/wishlist`,
  - **Then** `getByRole("button", { name: "Remove Swords to Plowshares from wishlist" })` and `getByRole("button", { name: "Remove Path to Exile from wishlist" })` are each visible,
  - **And** no button has the accessible name "✕".

**Contrast**
- **AC-10** *(muted text only where allowed, Unit guard)*
  - **Given** every `.tsx` file under `src/`,
  - **Then** every `text-text-muted` occurrence is either part of `placeholder:text-text-muted` or on the legal-footer line in `src/app/(main)/profile/page.tsx` or `src/app/(auth)/sign-in/page.tsx`. That is at most one non-placeholder use per file, and only in those two files.
- **AC-11** *(content text is secondary, E2E)*
  - **Given** I'm on `/profile`, the computed `color` of "@e2e_friend" in the Friends list equals the computed `--color-text-secondary`,
  - **And** on `/u/e2e_friend`, "@e2e_friend" equals `--color-text-secondary`,
  - **And** the inactive bottom-nav label "Collection" equals `--color-text-secondary`,
  - **And** the legal footer "ManaPals is not affiliated…" on `/profile` still equals `--color-text-muted`.
- **AC-12** *(no horizontal scroll, E2E)*
  - **Given** a 375×800 viewport,
  - **When** I open `/profile`, `/collection`, `/wishlist` and `/u/e2e_friend`,
  - **Then** `document.documentElement.scrollWidth <= 375` on each.

**Remove friend**
- **AC-13** *(Friends chip and separate remove, E2E)*
  - **Given** I'm on `/u/e2e_friend`,
  - **Then** the text "Friends ✓" is visible and is not a button. `getByRole("button", { name: /^Friends/ })` has count 0.
  - **And** a button named "Remove friend" is visible,
  - **And** the text "Friends ✓ · Remove" does not appear.
- **AC-14** *(confirm dialog and cancel, E2E, non-mutating)*
  - **Given** I'm on `/u/e2e_friend`,
  - **When** I tap "Remove friend",
  - **Then** an `alertdialog` titled "Remove E2E Friend as a friend?" is visible, with "Cancel" and "Remove" buttons each at least 44px tall, and focus is inside the dialog.
  - **When** I tap Cancel, **Then** the dialog closes, the focused element is the "Remove friend" button, "Friends ✓" is still visible, and after a reload I'm still friends ("Friends ✓" visible).
  - **And** opening it again and pressing Escape also closes it with no change.
- **AC-15** *(confirm logic, Unit, jsdom)*
  - **Given** `FriendActionButton` with status `friends` and `friendshipId = 7`, with `removeFriendship` and `router.refresh` mocked,
  - **When** I click "Remove friend", **Then** `removeFriendship` has not been called.
  - **When** I then click "Remove" in the dialog, **Then** `removeFriendship` is called exactly once with `7`, and `router.refresh` is called on success.
  - **And Given** `removeFriendship` resolves `{ error: "Couldn't remove." }`, **Then** the dialog stays open and shows a `role="alert"` with "Couldn't remove.", and `router.refresh` is not called.

## Data & privacy
- **Stored:** nothing new. There are no migrations, tables, columns or RLS changes, so the PR does not need `db-change`.
- **Remove friend** still calls the existing `removeFriendship` server action, which deletes the `friendships` row under the existing `friendships_delete_participant` RLS policy. Only the change in the UI (the confirm step) is new.
- **Visibility after removal** is unchanged and still enforced server-side. Collections stay friends-only by default (§5.3), and wishlists are friends-only (§4.7). After a confirmed removal, the friend's friends-only collection and wishlist are no longer shown on refresh. The dialog body tells the user this.
- **Accessible names:** the wishlist remove label uses the card name, which is already shown on the tile. No other user's data is exposed.
- **Error text:** `FieldError` shows only the messages the server actions already return. It never shows raw database errors.

## UX notes
- **Screens touched:** Collection (chips, sort, summary text), Wishlist (remove buttons, Add-card sheet), Profile (Edit, edit form, visibility, search, requests, friends list, email), Friend page `/u/[username]` (handle, friend actions, new confirm dialog), Trade Match (back link, handle), Trades list (handles), Onboarding (`ProfileStep`, `ImportStep`, Manabox tip), Import sheet, Trade settings sheet, Card trade sheet backdrop, bottom nav, and the global stylesheet.
- **Focus ring:** amber, 2px, 2px offset, keyboard and switch only (`:focus-visible`). On amber-filled buttons the offset keeps the ring visible against the page.
- **Wishlist ✕:** keep the small round visual in the bottom-right corner of the tile, inside a 44×44px transparent button anchored to that corner. The card tile is about 105px wide at 375px, so the button fits without covering the "Any" badge (top-left).
- **Chips and select:** a 44px height on the chip row makes the Collection toolbar slightly taller, and it matches trade mode. The row still scrolls sideways, not the page.
- **Friends chip:** use the existing chip shape (`rounded-chip`, `border-border`, `bg-elevated`, `text-text-secondary`) with "Friends ✓". Put "Remove friend" next to it or below it as a secondary 44px button. It must not look like a primary action.
- **Confirm dialog states:**
  - *Idle:* Cancel and Remove are enabled.
  - *Pending:* Remove is disabled and shows "Removing…".
  - *Error:* a `FieldError` sits above the buttons, and Remove is enabled again.
  - The dialog sits above the bottom nav. `FirstAvailableConfirm` already uses `z-[70]`.
- **Errors:** every inline error is now 14px danger red with `role="alert"`. Spacing may need a small adjustment where 10–11px errors used to sit (request rows).
- **Empty, loading and error states:** no new ones beyond the dialog's pending and error states. Existing states only get recolored or resized.
- **Screenshots:** the only baseline, `sign-in.png`, should not change (the legal footer stays muted and nothing is focused). If it does, regenerate it from the CI `linux-screenshots` artifact.

## Open questions
1. **The issue says `focus-visible` appears 0 times in `src/`, but #45 has since added three per-element `focus-visible:` classes.**
   - **Recommended:** keep the global rule as the single source and remove the three per-element classes so there's one way to do it. Keeping them is harmless if they produce the same ring.
2. **The sheet backdrops use `bg-black/50` and `bg-black/60`.** These are Tailwind palette colors, so AC-2 and AC-6 of the issue ("no other Tailwind palette color") catch them too.
   - **Recommended:** replace them with `bg-page/70`, which is near-black and comes from the system, and keep the guard strict with no exceptions for `black` or `white`.
   - Alternative: add a `--color-scrim` token.
3. **Lint check (issue AC-6, "consider").**
   - **Recommended:** a Vitest guard test in `tests/unit/` (the same pattern as `collection-readers-wiring.test.ts`) that scans `src/**` for palette classes (AC-5) and non-allowed `text-text-muted` (AC-10). It runs in `npm test` on every PR and needs no new dependency.
   - Alternative: a custom ESLint rule, or `eslint-plugin-tailwindcss`. That is more setup and may not support Tailwind 4 `@theme`.
4. **Style of the confirm "Remove" button.** It is destructive, but the owner limited `danger` to error messages.
   - **Recommended:** use the existing amber confirm style from `FirstAvailableConfirm`, labelled "Remove". The title already says what will happen.
   - Alternative: let `danger` also style destructive confirm buttons, which would extend the owner's decision.
5. **E2E for the confirmed-remove path.** Confirming would delete the seeded `e2e_player` ↔ `e2e_friend` friendship. Restoring it needs the friend to accept, or the service role, and other authed specs depend on that friendship.
   - **Recommended:** E2E covers opening the dialog plus Cancel and Escape (AC-14, non-mutating). The confirm path is a jsdom unit test with mocked actions (AC-15).
   - Alternative: a serial spec that re-creates the friendship with the service-role key in `afterAll`.
6. **The sort `<select>` has no accessible name** (TalkBack reads only the current value).
   - **Recommended:** add `aria-label="Sort cards"` in this PR. It's one attribute on an element already being touched. If the owner prefers strict scope, move it to a follow-up.
7. **Which "muted" text counts as decorative?** The issue keeps muted for "placeholders, the legal footer and purely decorative text". The "@" prefix in username inputs is arguably decorative.
   - **Recommended:** keep muted only for placeholders and the two legal footer lines, and switch everything else, including "@", to secondary. That gives a simple, guardable rule (AC-10).
8. **Split into the slices below?**
   - **Default: no.** There are 15 ACs, but there is no migration, and most of the change is mechanical class swaps across many files. The only new flow is the small remove-friend dialog. One PR stays reviewable. Choose "split" if you want the remove-friend change reviewed on its own.

## Slices
Only used if Q8 is answered "split". Each slice can be built and shown on its own.

- **S1 Focus ring, danger token, `FieldError` and the palette guard.** Covers AC-1, AC-2, AC-3, AC-4, AC-5, AC-6. Blocked by: none.
- **S2 44px targets and content-text contrast.** Covers AC-7, AC-8, AC-9, AC-10, AC-11, AC-12. Blocked by: none. AC-7's "Remove friend" check moves to S3 if S3 hasn't landed yet.
- **S3 Confirm before removing a friend.** Covers AC-13, AC-14, AC-15. Blocked by: S1 (uses `FieldError`).

## Design
Mockup: [46-accessibility-pass-focus-targets-contrast/mockup.html](46-accessibility-pass-focus-targets-contrast/mockup.html) · Screenshot: [mockup.png](46-accessibility-pass-focus-targets-contrast/mockup.png) (390px wide).

| State | What it shows | AC |
|---|---|---|
| 1 Wishlist remove + focus ring | Small round ✕ inside a 44x44 transparent corner button (dashed outline marks the hit area); amber 2px ring with 2px offset on focus; bottom nav with secondary inactive labels and a focused tab | AC-1, 7, 9, 11 |
| 2 Collection toolbar | 44px color chips and sort select, "Showing N of M" in secondary | AC-7, 11 |
| 3 Profile edit | Edit/Save/Cancel/visibility at 44px, ring on the bordered username wrapper, `FieldError` in danger at 14px | AC-1, 2, 6, 7 |
| 4 Muted vs secondary | Before/after handle text; placeholder and legal footer stay muted | AC-10, 11 |
| 5 Friend page | Non-interactive "Friends ✓" chip beside a secondary 44px "Remove friend" button | AC-13, 7 |
| 6a/6b/6c Confirm dialog | Idle (focus on Cancel), pending ("Removing…", Remove disabled), error (`FieldError` above buttons) | AC-14, 15 |

Design decisions (resolving open questions):
- The ring sits on the wrapper for bordered inputs (Q1 area, scope item 1).
- Initial focus in the confirm dialog goes to Cancel, the safe choice.
- The "Remove" confirm button uses the amber confirm style, not danger (Q4).
- The chip and "Remove friend" sit side by side, centered under the name.

## Delight
Proposed by whimsy-injector. In scope unless the owner drops them at the spec gate. This is an accessibility pass, so the touches are quiet and functional. Nothing touches the remove-friend wording, errors or privacy copy beyond a short fade. All motion uses `motion-safe:`, transform/opacity only, 150ms or less.

| ID | Where (screen/state, AC-n) | What (exact copy or interaction) | Why it helps | Reduced-motion fallback |
|---|---|---|---|---|
| D-1 | Wishlist remove button (AC-7, AC-9) | The round ✕ visual gets `motion-safe:transition-transform motion-safe:duration-100 motion-safe:active:scale-90`. The 44px button itself does not move. | The tap visibly lands on a small visual with a large hidden target. | No scale; the button still works the same. |
| D-2 | Collection color chips and sort select (AC-7) | `motion-safe:transition-transform motion-safe:duration-100 motion-safe:active:scale-[0.97]` on the chips. | Press feedback on controls that are now taller. | No scale. |
| D-3 | Collection, no results state (AC-11) | Copy: "No cards match your filters. Try clearing a color." (was "No cards match your filters."). Turns a dead end into the next step. | Tells the user what to do next. | Static text. |
| D-4 | Remove-friend confirm dialog entrance (AC-14) | Panel: `motion-safe:animate-[dlgin_150ms_ease-out]` (opacity 0 to 1, scale 0.96 to 1). Scrim fades in. Copy stays exactly as in scope item 5. | The dialog feels attached to the button that opened it. | Appears instantly. |
| D-5 | `FieldError` (AC-4, AC-6) | `motion-safe:animate-[errin_150ms_ease-out]` (opacity 0 to 1, 2px drop). The text and `role="alert"` are unchanged. | A new error is noticed at 14px without being alarming. | Appears instantly. |

Builder notes: D-3 changes an existing string, so check that no test asserts the old text. Keyframes `dlgin` and `errin` go in `globals.css` (about 6 lines).

Left out: a "Friends ✓" flourish, any joke in the remove-friend dialog, and any celebratory touch on focus. Possible follow-up for Open questions: friendly empty-state copy for the wishlist once the last card is removed (needs UX review, outside this pass).
