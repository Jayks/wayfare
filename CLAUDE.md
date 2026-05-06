# CLAUDE.md — Wayfare

> This file is the source of truth for Claude Code. Read it fully before any task. It reflects the **actual built state** of the project — not the original spec. When in doubt, ask before assuming.

---

## 1. Project Overview

**Wayfare** is a group expense tracking web app for trips and tours. Multiple people in a group log what they spent, who it was for, and the app computes who owes whom — with the minimum number of transactions. Inspired by Splitwise, but designed specifically for trips.

The name plays on *wayfarer* (a traveler) and *fare* (the cost of a journey).

**Primary use case**: Family/friends travel together. One person pays for dinner, another for the cab, a third for hotel. At the end of the trip, everyone sees a clean settlement with the fewest possible payments.

**Production goal**: Vercel + Supabase, free tier only.

---

## 1a. Brand

**Name**: Wayfare
**Tagline**: *Travel together. Settle easy.*

### Logo & Favicon

- **Compass mark** chosen — compass rose icon (Lucide `Compass`) in a cyan-to-teal gradient badge alongside "Wayfare" wordmark in Fraunces.
- **Favicon**: `app/icon.tsx` — Next.js ImageResponse generating "W" in terracotta on cream, rounded square.

### Design direction

**Glassmorphic**, not warm/editorial. The initial spec called for terracotta/sand/forest tones; this was revised during build to a vibrant **cyan/teal** palette with frosted-glass cards, background gradient blobs, and strong colour gradients on interactive elements.

---

## 2. Tech Stack (LOCKED — do not substitute without asking)

| Layer | Choice | Version | Notes |
|---|---|---|---|
| Framework | **Next.js** (App Router, TypeScript) | 16.x | Scaffolded with create-next-app; upgraded from spec's v15 |
| Styling | **Tailwind CSS v4** | 4.x | CSS-first config, no tailwind.config.ts |
| UI components | **shadcn/ui** | latest | Uses **@base-ui/react** (not Radix) — see gotchas |
| Animation | **Framer Motion** | 12.x | Subtle only |
| Charts | **Recharts** | 3.x | Insights pages only |
| Icons | **lucide-react** | latest | |
| QR codes | **qrcode.react** | latest | Invite QR dialogs |
| AI | **@anthropic-ai/sdk** | 0.94.x | Expense parser + trip narrative (claude-haiku-4-5-20251001) |
| Database | **Supabase Postgres** | — | Free tier |
| Auth | **Supabase Auth** (Google OAuth) | — | @supabase/ssr v0.6 |
| Realtime | **Supabase Realtime** | — | postgres_changes → router.refresh() |
| ORM | **Drizzle** | 0.43.x | drizzle-kit 0.31.x |
| Validation | **Zod** | 3.x | |
| Forms | **react-hook-form** + @hookform/resolvers | 7.x | zodResolver only |
| Toasts | **sonner** | 2.x | |
| Date utils | **date-fns** | 4.x | |
| Deployment | **Vercel** | — | |

**Additional dev tools**: `tsx` (run scripts), `dotenv` (drizzle.config env loading), `vitest` (unit tests).

**Do NOT add**: NextAuth, Prisma, Redux, MUI, Chakra, Bootstrap, styled-components, tRPC, Pusher/Ably.

**TanStack Query** is installed but **not wired for data fetching**. Realtime is handled via `router.refresh()`, not query invalidation. Do not add QueryClientProvider unless explicitly requested.

---

## 3. Critical Gotchas (read before touching UI)

### shadcn/ui uses @base-ui/react, NOT Radix

The shadcn version installed uses `@base-ui/react` primitives. This has important API differences:

- **No `asChild` prop** on Button or DropdownMenuTrigger
- Use the **`render` prop** instead: `<Button render={<Link href="..." />}>`
- When rendering a Button as a `<Link>` (which renders as `<a>`), you MUST add `nativeButton={false}`: `<Button render={<Link href="..." />} nativeButton={false}>`
- **Prefer using plain styled `<Link>` elements** for navigation buttons to avoid the nativeButton complexity entirely

### CoverPhotoPicker — no `<form>` wrapper inside forms

The cover photo picker's search lives inside the parent trip form. The search must use a `<div>` (not `<form>`) with `type="button"` on the search button to prevent event bubbling that submits the parent form.

### DB Singleton pattern (prevents HMR connection exhaustion)

```typescript
// lib/db/client.ts
declare global { var _pgClient: postgres.Sql | undefined; }
const client = globalThis._pgClient ?? postgres(connectionString, { prepare: false, max: 3 });
if (process.env.NODE_ENV !== 'production') globalThis._pgClient = client;
```

Without this, each Next.js hot-reload creates a new connection pool, exhausting Supabase free-tier connection slots.

### proxy.ts (Next.js 16 convention)

Next.js 16 renamed `middleware.ts` → `proxy.ts` with a `proxy` function export (not `middleware`). The session refresh lives in `proxy.ts`.

### Supabase publishable key format

The project uses the new Supabase `sb_publishable_*` key format for `NEXT_PUBLIC_SUPABASE_ANON_KEY`. This is equivalent to the old `anon` JWT format — @supabase/ssr handles both.

### Drizzle config needs dotenv

`drizzle.config.ts` must explicitly call `config({ path: ".env.local" })` from `dotenv` because drizzle-kit does not always auto-load `.env.local` on Windows. Install dotenv as a dev dep.

### Settlement formula (corrected from spec)

The CLAUDE.md originally had the signs wrong. **Correct formula:**
```
net = totalPaid - totalOwed + settlementsSent - settlementsReceived
```
- `settlementsSent`: you paid someone → reduces your debt → **adds** to net
- `settlementsReceived`: someone paid you → your receivable shrinks → **subtracts** from net

### Anthropic SDK — instantiate inside the function, not at module level

```typescript
// ✅ correct — key resolved at call time
export async function myAction() {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  ...
}

// ❌ wrong — module evaluated before env vars are available in Next.js server action runtime
const client = new Anthropic();
export async function myAction() { ... }
```

Also: strip markdown code fences from responses before `JSON.parse` — Haiku wraps JSON in ` ```json ``` ` despite instructions:
```typescript
const jsonText = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
```

### Trip member count on cards

The `getTrips()` query joins tripMembers with a WHERE on the current user. The COUNT must use a **correlated subquery** to count all members, not just the current user's row:
```typescript
memberCount: sql<number>`(select count(*) from trip_members where trip_members.trip_id = ${trips.id})`
```

---

## 4. Architecture Principles

1. **Server-first**: React Server Components by default. `"use client"` only for state, effects, browser APIs, or chart libraries.
2. **Server Actions for mutations**: `app/actions/*.ts`. No REST API routes for internal CRUD.
3. **Drizzle is the only DB layer**: Auth and Realtime subscriptions use Supabase JS. All reads/writes use Drizzle.
4. **RLS everywhere**: All 5 tables have RLS. `drizzle/policies.sql` is the source of truth. Apply via Supabase SQL Editor.
5. **Pure functions for math**: `lib/splits/compute.ts` and `lib/settle/optimize.ts` are pure, unit-tested, never touch DB.
6. **Zod schemas shared**: Same schema validates the form (zodResolver), server action input, and DB insert.
7. **Optimistic UI via useState**: Optimistic deletes use local `removedIds: Set<string>` state, not TanStack Query. Rolls back on server error.
8. **Realtime via router.refresh()**: `useTripRealtime(tripId)` subscribes to Supabase channels and calls `router.refresh()` on any change. Injected via `app/(app)/trips/[id]/layout.tsx` covering all trip sub-pages.
9. **Auth checks in every query**: Each `lib/db/queries/*.ts` function verifies the current user and their membership before returning data. No function trusts the caller to have checked.

---

## 5. Database Schema (Drizzle)

Schema files in `lib/db/schema/`. RLS policies in `drizzle/policies.sql`.

### trips
```
id: uuid pk default gen_random_uuid()
name: text not null
description: text
cover_photo_url: text
default_currency: text not null default 'INR'
start_date: date
end_date: date
budget: numeric(12,2)           -- optional trip budget
itinerary: text                 -- optional trip plan; used by AI narrative + adherence analysis
is_archived: boolean not null default false
created_by: uuid not null       -- auth.users.id
share_token: uuid not null unique default gen_random_uuid()
created_at: timestamptz default now()
```

### trip_members
```
id: uuid pk
trip_id: uuid fk -> trips (cascade)
user_id: uuid nullable          -- auth.users.id (real user)
guest_name: text nullable       -- guest without an account
display_name: text nullable     -- populated from Google full_name at join time
role: enum('admin','member') default 'member'
joined_at: timestamptz default now()
CHECK: exactly one of (user_id, guest_name) must be set
UNIQUE: (trip_id, user_id)
```

### expenses
```
id: uuid pk
trip_id: uuid fk -> trips (cascade)
paid_by_member_id: uuid fk -> trip_members
description: text not null
category: enum('food','accommodation','transport','sightseeing','shopping','activities','groceries','other')
amount: numeric(12,2) not null
currency: text not null
expense_date: date not null
notes: text
created_by_user_id: uuid not null
created_at, updated_at: timestamptz
```

### expense_splits
```
id: uuid pk
expense_id: uuid fk -> expenses (cascade)
member_id: uuid fk -> trip_members
share_amount: numeric(12,2) not null    -- computed amount
split_type: enum('equal','exact','percentage','shares')
split_value: numeric(12,4)              -- raw input (null for equal)
UNIQUE: (expense_id, member_id)
```

### settlements
```
id: uuid pk
trip_id: uuid fk -> trips (cascade)
from_member_id: uuid fk -> trip_members
to_member_id: uuid fk -> trip_members
amount: numeric(12,2) not null
currency: text not null
note: text
settled_at: timestamptz default now()
CHECK: from_member_id <> to_member_id
```

### Realtime — enable on all tables

Run in Supabase SQL Editor after creating tables:
```sql
alter publication supabase_realtime add table expenses;
alter publication supabase_realtime add table expense_splits;
alter publication supabase_realtime add table settlements;
alter publication supabase_realtime add table trip_members;
```

### display_name backfill (run once after adding column)

```sql
update trip_members
set display_name = (
  select raw_user_meta_data->>'full_name'
  from auth.users
  where auth.users.id = trip_members.user_id
)
where user_id is not null and display_name is null;
```

---

## 6. Design System

### Palette (actual — replaces original terracotta/forest spec)

```css
/* Core palette */
--color-cyan-500:   #06B6D4;   /* primary buttons, active states */
--color-teal-500:   #14B8A6;   /* gradient end */
--color-slate-800:  #1E293B;   /* headings */
--color-slate-600:  #475569;   /* body text */
--color-slate-400:  #94A3B8;   /* muted text */

/* Semantic (shadcn tokens) */
--primary:          #0891B2;   /* cyan-600 */
--background:       #EFF6FF;   /* blue-50 gradient start */
--card:             #FFFFFF;

/* Category hex (for charts) — in lib/categories.ts */
food: #EA580C, accommodation: #2563EB, transport: #9333EA,
sightseeing: #0D9488, shopping: #DB2777, activities: #16A34A,
groceries: #65A30D, other: #64748B
```

### Body background

Multi-stop fixed gradient + decorative blur blobs in `app/layout.tsx`:
```css
body { background: linear-gradient(135deg, #EFF6FF 0%, #ECFEFF 35%, #F0FDFA 70%, #ECFDF5 100%); background-attachment: fixed; }
```

### Glass utilities (in globals.css)

```css
.glass     { background: rgba(255,255,255,0.6); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.75); }
.glass-sm  { background: rgba(255,255,255,0.5); backdrop-filter: blur(12px); }
.glass-nav { background: rgba(255,255,255,0.72); backdrop-filter: blur(24px); border-bottom: 1px solid rgba(255,255,255,0.8); }
```

### Typography

- **Headings**: Fraunces (variable axes: opsz, SOFT, WONK). Applied via CSS variable `--font-fraunces` and inline `style={{ fontFamily: "var(--font-fraunces)" }}` (NOT via Tailwind class — apply directly).
- **Body**: Inter via `--font-inter`.
- **Numbers**: Always `tabular` class or `font-variant-numeric: tabular-nums`.

### Buttons (gradient pattern)

Primary action buttons use Tailwind gradient utilities directly (NOT a CSS class):
```tsx
className="bg-gradient-to-br from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white"
```
Never use `bg-primary` on gradient buttons — it conflicts. Use the gradient utilities or a plain `<Link>` element styled directly.

### Motion rules

- Card entrance: `opacity: 0 → 1, y: 8 → 0` over 200ms, stagger 30–50ms per item via `AnimatedList`
- Balance numbers: count up from 0 via `CountUp` component (Framer Motion animate)
- Collapsible panels: height + opacity via `AnimatePresence` + `motion.div`
- No bouncy springs. No parallax. No animated gradients.

### Navigation

- **Desktop**: Sticky top nav with logo, Trips + Insights links (active state: cyan pill), avatar dropdown
- **Mobile**: Fixed bottom nav (`MobileNav`) with Trips + Insights icons. Content gets `pb-24` on mobile.

---

## 7. Key Algorithms

### Split computation (`lib/splits/compute.ts`)

Four modes — all return `SplitResult[]` with `shareAmount` (computed) and `splitValue` (raw input):

| Mode | Input | Validation |
|---|---|---|
| `equal` | member IDs | none |
| `exact` | amount per member | sum must equal total |
| `percentage` | % per member | must sum to 100 |
| `shares` | share count per member | total shares > 0 |

Rounding: `Math.round(n * 100) / 100`. Distribute remainder to first row.
22 Vitest tests — all must pass before any split-related change.

### Settlement optimizer (`lib/settle/optimize.ts`)

Greedy min-transactions algorithm:
1. For each member: `net = paid - owed + sent - received`
2. Split into creditors (net > 0) and debtors (net < 0), sort by absolute value desc
3. Greedily match top creditor with top debtor, transfer `min(creditor, |debtor|)`
4. Emit transaction, update balances, advance pointers

Produces at most `n-1` transactions. 6 Vitest fixtures.

### Balance formula

```typescript
net = totalPaid - totalOwed + settlementsSent - settlementsReceived
```

**Not** `totalPaid - totalOwed - settlementsSent + settlementsReceived` — the signs were corrected during build.

---

## 8. Project Structure (actual)

```
wayfare/
├── app/
│   ├── icon.tsx                    # favicon via ImageResponse
│   ├── error.tsx                   # global error boundary
│   ├── not-found.tsx               # custom 404
│   ├── layout.tsx                  # root layout: fonts, blobs, Toaster
│   ├── page.tsx                    # redirects → /trips or /login
│   ├── globals.css                 # Tailwind v4, design tokens, glass utils
│   ├── (auth)/login/
│   │   ├── page.tsx
│   │   └── login-form.tsx          # "use client" — Google OAuth button
│   ├── auth/callback/route.ts      # Supabase code exchange
│   ├── (app)/
│   │   ├── layout.tsx              # auth check + MobileNav
│   │   ├── error.tsx               # app-level error boundary
│   │   ├── app-nav.tsx             # "use client" — top nav with active states
│   │   ├── insights/
│   │   │   ├── page.tsx            # all-trips insights
│   │   │   └── loading.tsx
│   │   └── trips/
│   │       ├── page.tsx            # trips list (active + archived)
│   │       ├── loading.tsx
│   │       ├── new/
│   │       │   ├── page.tsx
│   │       │   └── create-trip-form.tsx
│   │       └── [id]/
│   │           ├── layout.tsx      # injects RealtimeRefresh
│   │           ├── page.tsx        # trip dashboard
│   │           ├── edit/
│   │           │   ├── page.tsx
│   │           │   └── edit-trip-form.tsx
│   │           ├── expenses/
│   │           │   ├── page.tsx    # expense list with filters
│   │           │   ├── loading.tsx
│   │           │   └── new/
│   │           │       ├── page.tsx
│   │           │       └── add-expense-form.tsx
│   │           │   └── [expenseId]/edit/
│   │           │       ├── page.tsx
│   │           │       └── edit-expense-form.tsx
│   │           ├── members/
│   │           │   ├── page.tsx
│   │           │   ├── add-guest-form.tsx
│   │           │   ├── remove-member-button.tsx
│   │           │   └── regenerate-token-button.tsx
│   │           ├── settle/
│   │           │   ├── page.tsx
│   │           │   ├── loading.tsx
│   │           │   ├── mark-paid-button.tsx
│   │           │   └── upi-pay-button.tsx  # "use client" — UPI deep link (shown only when current user owes)
│   │           └── insights/
│   │               ├── page.tsx
│   │               └── loading.tsx
│   ├── join/[token]/
│   │   ├── page.tsx
│   │   └── join-button.tsx
│   ├── summary/[token]/
│   │   ├── page.tsx            # public shareable trip summary (no auth required)
│   │   └── opengraph-image.tsx # OG image 1200×630
│   ├── api/
│   │   └── trips/[id]/export/route.ts  # GET → CSV download (auth-guarded)
│   └── actions/
│       ├── trips.ts        # createTrip, updateTrip, deleteTrip, archiveTrip, regenerateShareToken
│       ├── expenses.ts     # addExpense, updateExpense, deleteExpense, duplicateExpense
│       ├── members.ts      # addGuestMember, removeMember, joinTrip
│       ├── settlements.ts  # recordSettlement, deleteSettlement
│       ├── unsplash.ts     # searchUnsplash (server action wrapping the API)
│       ├── parse-expense.ts  # parseExpenseWithAI — Claude Haiku expense parser
│       ├── narrative.ts      # generateTripNarrative — Claude Haiku trip story generator
│       ├── trip-adherence.ts # analyzeTripAdherence — plan vs reality comparison
│       └── parse-chat.ts     # parseChatExpenses — bulk extract expenses from chat text
├── components/
│   ├── ui/                 # shadcn primitives (base-ui)
│   ├── expense/
│   │   ├── expense-card.tsx
│   │   ├── expense-filters.tsx     # "use client" — search/filter/sort
│   │   ├── split-editor.tsx        # "use client" — 4-mode splitter
│   │   ├── quick-add-bar.tsx       # "use client" — AI/rule-based/voice quick-add parser
│   │   ├── chat-import-dialog.tsx  # "use client" — paste chat → bulk extract & add expenses
│   │   ├── category-icon.tsx
│   │   ├── delete-expense-button.tsx
│   │   └── duplicate-expense-button.tsx
│   ├── trip/
│   │   ├── trip-card.tsx           # server — cover links to trip; footer has share buttons
│   │   ├── trip-card-share-buttons.tsx  # "use client" — Web Share API + QR dialog
│   │   ├── cover-photo-picker.tsx  # "use client" — Unsplash dialog
│   │   ├── budget-bar.tsx          # spend vs budget progress
│   │   ├── qr-invite.tsx           # "use client" — QR code dialog + copy link
│   │   ├── summary-share-button.tsx # "use client" — Web Share API share button
│   │   ├── narrative-section.tsx   # "use client" — AI trip story generator
│   │   └── adherence-card.tsx      # "use client" — plan vs reality insight card
│   ├── settlement/
│   │   ├── settlement-breakdown.tsx    # "How is this calculated?" collapsible
│   │   └── member-debt-breakdown.tsx   # "use client" — per-member debt view
│   ├── insights/
│   │   ├── kpi-card.tsx            # animated via CountUp
│   │   ├── smart-insight-card.tsx
│   │   ├── category-donut.tsx      # "use client" — Recharts
│   │   ├── daily-spend-bar.tsx     # "use client" — Recharts
│   │   ├── member-contributions.tsx # "use client" — Recharts
│   │   └── trips-spend-bar.tsx     # "use client" — Recharts
│   └── shared/
│       ├── skeleton.tsx
│       ├── animated-list.tsx       # "use client" — Framer Motion stagger
│       ├── count-up.tsx            # "use client" — animated number
│       ├── confirm-dialog.tsx      # "use client" — replaces browser confirm()
│       ├── member-avatar.tsx       # deterministic gradient initials
│       ├── mobile-nav.tsx          # "use client" — bottom nav
│       └── realtime-refresh.tsx    # "use client" — mounts useTripRealtime
├── hooks/
│   ├── use-trip-realtime.ts        # Supabase Realtime → router.refresh()
│   ├── use-warn-before-leave.ts    # beforeunload on dirty forms
│   └── use-speech-recognition.ts  # Web Speech API — mic input for quick-add bar
├── lib/
│   ├── db/
│   │   ├── client.ts               # Drizzle + globalThis singleton
│   │   ├── schema/
│   │   │   ├── trips.ts
│   │   │   ├── trip-members.ts
│   │   │   ├── expenses.ts
│   │   │   ├── expense-splits.ts
│   │   │   └── settlements.ts
│   │   └── queries/
│   │       ├── trips.ts            # getTrips, getArchivedTrips, getTripWithMembers, getTripByToken
│   │       ├── expenses.ts         # getExpenses, getExpenseWithSplits, getTripExpensesWithSplits
│   │       ├── balances.ts         # getBalances (net per member), getSettlements
│   │       ├── insights.ts         # getAllTripsInsightsData
│   │       └── meta.ts             # getTripName (React.cache for generateMetadata)
│   ├── supabase/
│   │   ├── server.ts               # createServerClient (RSC / server actions)
│   │   ├── client.ts               # createBrowserClient
│   │   └── admin.ts                # service-role client (for admin tasks)
│   ├── parser/
│   │   └── parse-expense.ts        # parseExpenseText — pure rule-based parser + ParsedExpense type
│   ├── splits/
│   │   ├── compute.ts
│   │   └── compute.test.ts         # 16 tests
│   ├── settle/
│   │   ├── optimize.ts
│   │   └── optimize.test.ts        # 6 tests
│   ├── insights/
│   │   ├── trip-insights.ts        # computeTripInsights (pure)
│   │   └── all-trips-insights.ts   # computeAllTripsInsights (pure)
│   ├── validations/
│   │   ├── trip.ts                 # createTripSchema (includes budget)
│   │   └── expense.ts              # addExpenseSchema
│   ├── categories.ts               # CATEGORIES array + CATEGORY_HEX for charts
│   ├── unsplash.ts                 # searchPhotos
│   └── utils.ts                    # cn(), formatCurrency(), formatDate(), getMemberName()
├── scripts/
│   ├── seed-test.ts                # pnpm seed — creates Goa trip, 10 members, 30 expenses
│   ├── seed-temple-tour.ts         # pnpm seed:temple — South India temple circuit, 20 members, 24 expenses
│   └── verify-seed.ts              # verifies seed data integrity
├── drizzle/
│   └── policies.sql                # all RLS policies for all 5 tables
├── drizzle.config.ts               # uses dotenv to load .env.local
├── proxy.ts                        # Next.js 16 proxy (was middleware.ts in v15)
└── CLAUDE.md
```

---

## 9. Auth Flow

1. User visits `/login` → "Continue with Google" button
2. Supabase redirects to Google → back to `/auth/callback`
3. Callback: `supabase.auth.exchangeCodeForSession(code)` → redirects to `/trips`
4. `proxy.ts` refreshes the session on every request; redirects unauthenticated requests to `/login`
5. `(app)/layout.tsx` reads session server-side via `createClient()` from `lib/supabase/server.ts`

Use `@supabase/ssr` v0.6+. NOT `@supabase/auth-helpers-nextjs`.
Cookie handling: `getAll()` + `setAll()` pattern — see `lib/supabase/server.ts`.

---

## 10. Realtime

`hooks/use-trip-realtime.ts` subscribes to four Supabase Realtime channels for a trip:
- `expenses` filtered by `trip_id`
- `settlements` filtered by `trip_id`
- `trip_members` filtered by `trip_id`
- `expense_splits` (table-wide — no direct trip_id column)

On any change event: calls `router.refresh()` → Next.js re-renders all server components in the current route with fresh data.

The `RealtimeRefresh` client component (renders nothing) is placed in `app/(app)/trips/[id]/layout.tsx` so all trip sub-pages get realtime automatically.

**Important**: Tables must be added to the `supabase_realtime` publication:
```sql
alter publication supabase_realtime add table expenses;
alter publication supabase_realtime add table expense_splits;
alter publication supabase_realtime add table settlements;
alter publication supabase_realtime add table trip_members;
```

---

## 11. Features Built (complete list)

### Core
- Google OAuth login (Supabase Auth)
- Create/edit/archive trips with cover photo (Unsplash), dates, currency, budget, optional itinerary/plan
- Invite members via shareable link + QR code
- Add guest members (no account needed)
- 4-mode expense splitting: equal, exact, percentage, shares
- Expense categories with icons (8 categories)
- Add/edit/delete/duplicate expenses
- Expense filters: search, category pills, payer, date range, sort
- Balance computation: min-transaction settlement algorithm
- Settle up: suggested payments, "mark paid", settlement history
- Settlement breakdown: "How is this calculated?" 3-step explainer
- Member-level debt breakdown: who owes whom per person

### Analytics
- Per-trip insights: KPI cards (animated), category donut, daily spend bar, member contribution bar, 7 smart insight cards
- All-trips portfolio: total spend, companion count, category habits, trip comparison
- Group roles per member: Trip Banker, Tab Master, High Roller, Fair Splitter, The Balancer, Traveler
- Payment fairness score bar per member (green → amber → red)
- Smarter insights: cross-trip comparisons, spend trajectory, budget forecast
- Plan vs Reality adherence card (insights page): compares written itinerary against actual expenses via Claude Haiku — coverage %, covered/missed/surprise activities; only shown when trip has an itinerary

### Sharing & Export
- Shareable public trip summary page (`/summary/[shareToken]`) — no auth required, OG image
- AI-generated trip narrative on summary page (Claude Haiku, on-demand); uses day-by-day expense timeline + itinerary as backbone
- Web Share API on trip cards + trip detail page (falls back to clipboard copy)
- QR code dialogs with copy-link fallback
- CSV export of all trip expenses (`/api/trips/[id]/export`)

### AI (requires `ANTHROPIC_API_KEY`)
- Quick-add expense parser: type or **speak** `dinner 2400 raj yesterday split 4` → pre-fills the form
  - AI mode (Claude Haiku): understands natural language, member names, positional splits ("1st 2", "last 3"), relative dates
  - Rule-based fallback: always works without AI key
  - Mode badge: `✨ AI` or `⚡ Basic`
- Voice input (Phase 18): mic button in quick-add bar; Web Speech API transcribes speech → AI parser; auto-triggers on final result; hidden on unsupported browsers; `lang: en-IN`
- Chat import: paste a WhatsApp/group chat snippet → Claude extracts all expenses at once; preview table with inline editing; bulk-add with per-row status
- Trip narrative generator on the summary page (day-by-day timeline + itinerary → travel story)
- Plan vs Reality adherence analysis on the insights page

### Settlement
- UPI payment deep link (`upi://pay?...`) on the settle page — only shown on rows where the current user is the payer; inline UPI ID input → opens PhonePe/GPay/Paytm pre-filled

### UX
- Glassmorphic design: frosted cards, gradient blobs, cyan/teal palette
- Mobile bottom nav + desktop top nav with active states
- Loading skeletons (Next.js `loading.tsx`) on all major pages
- Error boundaries (`error.tsx`) at global and app level
- Custom 404 page
- Dynamic page titles (`generateMetadata`) on all trip sub-pages
- Staggered card animations (`AnimatedList`)
- Count-up animations on balance/KPI numbers (`CountUp`)
- Modal confirmation dialogs (replaces browser `confirm()`)
- Unsaved form warning (`useWarnBeforeLeave`)
- Optimistic expense delete (instant UI, rollback on error)
- Real user display names (from Google `full_name`, stored in `display_name` column)
- Member avatars with deterministic colour initials (`MemberAvatar`)
- `inputMode="decimal"` on all amount fields (mobile number pad)
- Trip ordering: upcoming first, then past, then undated
- Trip archiving (admin only)
- Budget tracking with progress bar (green → amber → red)

---

## 12. Coding Conventions

- **TypeScript strict mode**. No `any`. Use `unknown` and narrow.
- **Server actions** return `{ ok: true, data }` or `{ ok: false, error }` as const. Never throw to the client.
- **Form validation**: react-hook-form + zodResolver. Field-level errors shown inline. Toasts only for async outcomes.
- **Money**: store as `numeric(12,2)`. TS: `number`. Format with `formatCurrency()` from `lib/utils.ts` (uses `Intl.NumberFormat`).
- **Dates**: store as `date` (no time) for `expense_date`. Format with `formatDate()` from `lib/utils.ts`.
- **Member names**: always use `getMemberName(member)` from `lib/utils.ts` — handles `displayName ?? guestName ?? "Member"` fallback chain.
- **IDs**: UUIDs generated in DB via `gen_random_uuid()`.
- **File names**: kebab-case. `expense-card.tsx`, `use-trip-realtime.ts`.
- **No barrel files** (`index.ts` re-exports). Import from the actual file.
- **Comments**: explain *why*, not *what*.
- **Fraunces font**: apply via `style={{ fontFamily: "var(--font-fraunces)" }}` — NOT a Tailwind class.
- **Expense date defaults**: use `smartDefaultDate(trip.startDate, trip.endDate)` from `lib/utils.ts` — never hardcode `new Date().toISOString().split("T")[0]`. Logic: ongoing trip → today; trip not started or finished → start date.
- **revalidatePath after mutations**: always use `revalidatePath('/trips/${tripId}', 'layout')` — not a page-specific path. Expenses affect settle, insights, and the dashboard; the layout variant invalidates the whole subtree at once.

---

## 13. Testing

```bash
pnpm test        # run Vitest
pnpm test --run  # single run (no watch)
pnpm typecheck   # tsc --noEmit
```

- **22 unit tests** across `lib/splits/compute.test.ts` (16) and `lib/settle/optimize.test.ts` (6)
- All must pass before any split or settlement change
- No component tests in v1

**Seed script** (`pnpm seed`):
- Creates "Goa Summer 2025" — 10 members, 30 expenses, all split modes, all categories
- Verify: `pnpm exec tsx --env-file=.env.local scripts/verify-seed.ts`
- Confirms: all splits reconcile to paisa, net balance = 0, optimizer uses n-1 transactions

---

## 14. Environment Variables

`.env.local.example` is committed. `.env.local` is gitignored.

```
NEXT_PUBLIC_SUPABASE_URL=            # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=       # Supabase publishable key (sb_publishable_...)
SUPABASE_SERVICE_ROLE_KEY=           # Service role JWT — server-only
DATABASE_URL=                        # Direct Postgres URI for Drizzle (port 5432, URL-encode special chars)
UNSPLASH_ACCESS_KEY=                 # Unsplash API access key
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=Wayfare
ANTHROPIC_API_KEY=                   # optional — enables AI expense parser + trip narrative
```

**ANTHROPIC_API_KEY**: Without it, the quick-add bar falls back to rule-based parsing and the narrative section shows a config error. The key must be present when the dev server **starts** — restart `pnpm dev` after adding it.

**DATABASE_URL note**: URL-encode special characters in the password:
- `#` → `%23`, `@` → `%40`, `[` → `%5B`, `]` → `%5D`

---

## 15. Key Scripts

```bash
pnpm dev              # start dev server
pnpm build            # production build
pnpm typecheck        # TypeScript check
pnpm test             # Vitest (watch)
pnpm test --run       # Vitest (single run)
pnpm db:push          # push Drizzle schema to Supabase
pnpm db:studio        # Drizzle Studio (DB browser)
pnpm seed             # seed test data (Goa trip, 10 members, 30 expenses)
pnpm seed:temple      # seed South India temple tour (20 members, 24 expenses, current user as admin)
```

---

## 16. Build Phases (actual — all completed)

| Phase | What was built | Status |
|---|---|---|
| 1 | Auth (Google OAuth), nav, glassmorphic design system, login page, empty trips page | ✅ Done |
| 2 | Trips CRUD, members, invite link, Unsplash cover picker, join page | ✅ Done |
| 3 | Expenses (4-mode split editor), categories, add/edit/delete | ✅ Done |
| 4 | Balances, min-transaction settlement, mark paid, history, settlement breakdown | ✅ Done |
| 5 | Deep insights: per-trip (Recharts charts + smart insights) + all-trips portfolio | ✅ Done |
| 6 | Polish: mobile nav, active nav states, loading skeletons, error boundaries, custom 404, favicon, dynamic titles, trip editing | ✅ Done |
| 7 | UX essentials: real user names, member avatars, decimal inputMode, modal confirms, count-up balances, trip ordering, unsaved form warning | ✅ Done |
| 8 | Expense intelligence: search, category filter, payer filter, date range, sort, running filtered total | ✅ Done |
| 9 | Realtime (useTripRealtime + router.refresh()), optimistic expense delete with rollback | ✅ Done |
| 10 | Member debt breakdown, QR invite, expense duplication, budget tracking, trip archiving | ✅ Done |
| 11 | Deploy to Vercel — live at https://wayfare-sigma.vercel.app | ✅ Done |
| 12 | Platform admin dashboard (admin-only, guarded by PLATFORM_ADMIN_EMAIL env var) | ✅ Done |
| 13 | Shareable trip summary card — public `/summary/[shareToken]` page + OG image | ✅ Done |
| 14 | Group roles (Trip Banker, Tab Master, etc.) + payment fairness score on per-trip insights | ✅ Done |
| 15 | Smarter insights — cross-trip comparisons, spend trajectory, budget forecast | ✅ Done |
| 16 | AI quick-add expense parser — natural language → pre-filled form (Claude Haiku + rule-based fallback) | ✅ Done |
| 17 | CSV export + AI trip narrative (Claude Haiku generates a travel story on the summary page) | ✅ Done |
| 18 | Voice input (Web Speech API → AI parser); trip plan/itinerary field; richer narrative (day-by-day timeline); Plan vs Reality adherence card on insights page | ✅ Done |

---

## 17. Deployment

**Production URL**: https://wayfare-sigma.vercel.app
**Git repo**: https://github.com/Jayks/wayfare.git (branch: main)
**Supabase**: dev project in use for production (separate prod project deferred)

### Vercel env vars required
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL          ← must use Session Pooler URL, not direct connection
UNSPLASH_ACCESS_KEY
NEXT_PUBLIC_APP_URL=https://wayfare-sigma.vercel.app
NEXT_PUBLIC_APP_NAME=Wayfare
ANTHROPIC_API_KEY     ← optional; AI features degrade gracefully without it
PLATFORM_ADMIN_EMAIL  ← comma-separated admin emails for /admin dashboard
```

**DATABASE_URL on Vercel**: must use the Session Pooler endpoint — Vercel cannot reach `db.[ref].supabase.co:5432` directly without the Supabase IPv4 add-on:
```
postgresql://postgres.[ref]:[password]@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres
```

### Supabase setup (run once on a new project)
1. `pnpm db:push` — push Drizzle schema
2. Run `drizzle/policies.sql` in SQL Editor (RLS)
3. Run the Realtime publication SQL (see section 10)
4. Add Google OAuth callback: `https://wayfare-sigma.vercel.app/auth/callback`

---

## 18. What is OUT of scope (v1)

- Email/push notifications
- Receipt photo uploads (Phase 18 — planned)
- Voice input (Phase 18 — planned)
- PDF export (CSV export is done; PDF is not)
- Multi-currency FX within a trip
- PWA / offline mode
- Mobile app
- Dark mode
- Activity/audit log
- Comments on expenses
- Claim guest profile (v2 — schema already supports it via user_id on trip_members)
- TanStack Query for data fetching (installed but not wired)

---

## 19. Working Style

- **Ask before scope creep**. New dependency, new feature area, or skipping a section — surface it first.
- **Run `pnpm typecheck && pnpm test` before declaring done**.
- **Prefer reading existing code**. Check `lib/utils.ts`, existing components, and existing queries before writing new ones.
- **No silent failures**. Every error path has a toast, error boundary, or visible feedback.
- **Keep this file updated**. When a decision changes, update CLAUDE.md immediately.
