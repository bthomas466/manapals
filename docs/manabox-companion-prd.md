# Product Requirements Document
## ManaPals — MVP

**Version:** 0.2  
**Author:** Brandon Thomas  
**Status:** Draft  
**Last Updated:** July 14, 2026

---

## 1. Overview

### 1.1 Problem Statement

Manabox is the best mobile app for scanning and managing a Magic: The Gathering collection, but it is fundamentally a solo tool. There is no way to see what your friends have, which makes organizing trades or showing off recent pulls a friction-filled process — screenshots, Discord messages, manual list comparisons.

Players already maintain their collections in Manabox. The data is there. What's missing is a shared layer on top of it.

### 1.2 Product Vision

**ManaPals** is a mobile-optimized web app that gives Manabox users a social profile for their collection — so they can add friends, browse each other's cards, and instantly see trade opportunities. No manual list-making. No screenshots. Just: "here's what I have, here's what you need."

### 1.3 Success Metrics (MVP)

- Users can import a Manabox CSV and have a browsable profile in under 2 minutes
- A user with friends connected can identify trade matches without any manual input
- Return visit rate: users re-sync their collection at least once per week after initial import
- NPS from early users skews positive (qualitative signal, not a hard gate)
- Zero monetization friction — every feature is fully accessible to every user

---

## 2. Target Users

### Primary: Enfranchised Players
Regular MTG players who play at least weekly (LGS, Commander nights, kitchen table). They are comfortable with apps, familiar with Manabox, and understand CSV export. They have real collections worth trading and a social circle of players they see in person.

**Core job to be done:** "I want to know what my playgroup has before we sit down at the table, so I can propose trades without going through everyone's binders manually."

### Secondary: Casual Players
Less frequent players who may or may not use Manabox regularly. They are comfortable enough to follow step-by-step instructions but shouldn't need to understand what a CSV is. They care more about showing off a cool pull than optimizing trades.

**Core job to be done:** "I just opened something valuable and I want my friends to see it. And I'd like to know if anyone has that card I need for my deck."

### Out of Scope (MVP)
- Competitive/spike players needing advanced analytics
- Players who don't use Manabox (no manual card entry in v1)
- Buyers/sellers (no marketplace or pricing-as-primary-feature)

---

## 3. User Stories

### Onboarding

| ID | Story | Priority |
|----|-------|----------|
| US-01 | As a new user, I can sign up with Google or Apple so I don't have to create another username/password | Must Have |
| US-02 | As a new user, I am shown clear step-by-step instructions for how to export my collection from Manabox as a CSV | Must Have |
| US-03 | As a new user, I can upload my Manabox CSV and have my collection parsed and displayed within a few seconds | Must Have |
| US-04 | As a user, I can upload a new CSV at any time to refresh my collection | Must Have |
| US-05 | As a user on iOS or Android, I can share my CSV directly from Manabox to this app via the native share sheet | Should Have |

### Profile & Collection

| ID | Story | Priority |
|----|-------|----------|
| US-06 | As a user, I have a public profile URL I can share (e.g. `myapp.com/u/username`) | Must Have |
| US-07 | As a user, I can set a display name and optional avatar | Must Have |
| US-08 | As a visitor, I can browse a user's collection with card images pulled from Scryfall | Must Have |
| US-09 | As a visitor, I can filter a collection by color, set, rarity, card type, and foil status | Must Have |
| US-10 | As a visitor, I can search a collection by card name | Must Have |
| US-11 | As a user, I can mark specific cards as "available to trade" | Should Have |
| US-12 | As a user, I can mark specific cards as "not for trade" (e.g. in a deck) | Should Have |
| US-13 | As a user, I can see the estimated market value of my collection (via Scryfall price data) | Nice to Have |
| US-14 | As a user, I can organize my collection by binder (the binder names are preserved from the Manabox CSV) | Should Have |

### Social / Friends

| ID | Story | Priority |
|----|-------|----------|
| US-15 | As a user, I can add a friend by sharing my profile URL or searching by username | Must Have |
| US-16 | As a user, I can see a list of all my connected friends and visit their profiles | Must Have |
| US-17 | As a user, I can see a "Trade Matches" view with a friend — cards they have that I want, and cards I have that they want | Must Have |
| US-18 | As a user, I can add cards to a personal wishlist so the trade match engine can use them | Should Have |
| US-19 | As a user, I can see when a friend last synced their collection | Should Have |
| US-20 | As a user, I receive a notification (email or in-app) when a friend syncs a collection that includes a card on my wishlist | Nice to Have |

### Sharing / Flex

| ID | Story | Priority |
|----|-------|----------|
| US-21 | As a user, I can share a link to a specific card in my collection | Should Have |
| US-22 | As a user, I can change my collection visibility from friends only to public in settings | Should Have |
| US-23 | As a user, I can share my full collection profile link anywhere (Discord, iMessage, etc.) and it renders a preview card (Open Graph meta) | Should Have |

---

## 4. Functional Requirements

### 4.1 Authentication
- Google OAuth and Apple Sign In supported at launch
- No email/password auth in MVP (reduces support burden)
- Session persists across browser close (refresh token / cookie)

### 4.2 CSV Import & Parsing

**Supported columns from Manabox export:**

```
Name | Set Code | Set Name | Collector Number | Foil | Rarity | 
Quantity | ManaBox ID | Scryfall ID | Purchase Price | 
Condition | Language | Binder/List Name
```

- Parser must handle Manabox's full collection export and per-binder exports
- Scryfall ID is the canonical identifier used for all downstream card lookups
- If Scryfall ID is present, use it. Fall back to Name + Set Code if not.
- Duplicate rows (same card, same binder) should be merged by quantity
- Parser must surface a clear error state for malformed files, with actionable guidance
- Import replaces the user's current collection (not additive) — warn the user before replacing

### 4.3 Scryfall Integration

- Card metadata (name, type, image URI, color identity, rarity, set) fetched via `/cards/collection` endpoint (batch, up to 75 per request)
- Prices fetched from Scryfall card objects (`prices.usd`, `prices.usd_foil`)
- Card images served via Scryfall `image_uris.normal` or `image_uris.small` for list views
- Cache Scryfall data aggressively (card metadata changes rarely; prices update daily)
- Respect Scryfall's rate limit: max 10 requests/second, include descriptive User-Agent header

### 4.4 Collection Display

- Default view: card grid with images
- List view option for users with large collections (name, set, quantity, condition, foil)
- Filters: color (WUBRG + colorless + multicolor), set, rarity (common/uncommon/rare/mythic), card type, foil/non-foil/etched
- Search: client-side fuzzy match on card name
- Sort: by name, set, rarity, color, price (asc/desc)
- Quantity > 1 shown as a badge on the card image
- Foil cards visually distinguished (e.g. a shimmer indicator or badge)

### 4.5 Friend Graph

- Friendship is mutual: both users must connect (no one-sided follows in MVP)
- Connection flow: User A shares their profile URL → User B visits and clicks "Add Friend" → User A receives a notification and approves → connection established
- Alternative: shareable friend invite link that pre-approves the connection
- Users can remove friends at any time
- Collections of connected friends are visible; non-connected users can only see public profiles

### 4.6 Trade Match Engine

- Computes the intersection of: User A's "available to trade" cards vs. User B's wishlist, and vice versa
- If no explicit trade flags are set, defaults to: User A's full collection vs. User B's full collection (opt-in to explicit marking later)
- **No minimum collection size required** — results are shown regardless of how many cards either user has imported
- Empty state (zero matches) is handled gracefully with an explanation and a prompt to add wishlist items or mark cards for trade
- Results grouped by: "You have what they want" / "They have what you want" / "You both have extras"
- Each match shows: card image, quantity available, estimated value, condition
- No in-app trade confirmation or tracking in MVP (out of scope; users arrange trades themselves)

### 4.7 Wishlist

- Manual card search (powered by Scryfall `/cards/search` or autocomplete endpoint)
- Users can add specific printings (set + collector number) or accept any printing
- Wishlist is visible on the user's profile to friends

---

## 5. Non-Functional Requirements

### 5.1 Performance
- Collection page with 500+ cards must load in under 3 seconds on a mid-range Android device on LTE
- CSV import and parsing must complete in under 5 seconds for collections up to 5,000 cards
- Scryfall enrichment can be async — show collection with partial data while images load

### 5.2 Mobile Experience
- Fully functional on iOS Safari and Android Chrome (primary use contexts)
- No horizontal scroll on any viewport above 375px
- Touch targets minimum 44px
- Card images must be legible at mobile scale

### 5.3 Privacy
- User collections are **friends only by default** — only connected friends can browse a user's collection
- Users can optionally set their collection to public visibility in settings (opt-in)
- No collection data is sold or shared with third parties
- Manabox purchase prices in the CSV are stripped and not stored or displayed
- App footer must include: "ManaPals is not affiliated with Manabox or SkillDevs SC"

### 5.4 Reliability
- CSV data is the source of truth — no data loss on re-import (old data preserved until new import explicitly confirmed)
- Scryfall outages degrade gracefully: show collection with text-only fallback if image fetch fails

---

## 6. Out of Scope for MVP

These are explicitly deferred. Not "maybe" — they are not being built in v1.

- Native iOS or Android app
- In-app trade negotiation or confirmation workflow
- Messaging or chat between users
- Price alert notifications
- Integration with TCGPlayer, Cardmarket, or other marketplaces
- Manual card entry (users must use Manabox to build their collection)
- Support for non-Manabox CSV formats (Dragon Shield, Deckbox, etc.) — evaluate post-launch
- Deck builder or deck sharing
- Collection analytics / charts
- Public discovery (finding strangers to trade with; this is friend-first only)

---

## 7. Open Questions

All open questions from v0.1 have been resolved.

| # | Question | Decision |
|---|----------|----------|
| OQ-01 | App name | **ManaPals** |
| OQ-02 | Pricing at launch | **Completely free, no plans to charge** |
| OQ-03 | Trade match minimum collection size | **No minimum — even one card is useful** |
| OQ-04 | Default collection visibility | **Friends only — only connected friends can see your collection** |
| OQ-05 | Manabox ToS compatibility | **Clear to proceed.** ManaPals does not scrape, reverse engineer, or access Manabox's servers. The CSV is a file users export themselves from their own data. ManaPals is not a competing product. A "not affiliated with Manabox or SkillDevs" disclaimer must appear in the app footer. |

---

## 8. Phased Roadmap

### Phase 1 — MVP (Build Target)
Auth → CSV import → Collection profile → Friend connections → Trade match view

### Phase 2 — Engagement
Wishlist → Notifications (email) → "Friends only" privacy setting → OG link previews → Share extension (iOS/Android)

### Phase 3 — Growth
Public discovery opt-in → Support for other CSV formats → Collection analytics → Mobile-optimized PWA behaviors (add to home screen)

---

## 9. Technical Stack (Recommended Starting Point)

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Frontend | Next.js (React) | SSR for profile pages (SEO + OG previews), React for interactive UI |
| Styling | Tailwind CSS | Fast to build mobile-first layouts |
| Backend | Next.js API routes or separate Node/Express | Keep it simple in MVP; split if needed |
| Database | Supabase (Postgres) | Handles auth, relational data, and file storage; generous free tier |
| Auth | Supabase Auth (Google + Apple OAuth) | Native integration with the DB layer |
| Card Data | Scryfall REST API | Free, no key, comprehensive |
| Hosting | Vercel | Zero-config Next.js deployment |
| CSV Parsing | PapaParse (client-side) | Fast, well-maintained, handles Manabox edge cases |

---

*This document is a living spec. Sections will be updated as design decisions are made and open questions are resolved.*
