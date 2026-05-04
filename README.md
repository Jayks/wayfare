# Wayfare

**Travel together. Settle easy.**

Wayfare is a group expense tracking app built for trips. Log what each person paid, choose how to split it, and let Wayfare compute who owes whom — with the minimum number of payments. No spreadsheets, no awkward IOUs.

---

## Features

### Trips
- Create trips with a cover photo (Unsplash search), dates, currency, and optional budget
- Invite members via shareable link or QR code
- Add guest members who don't have an account
- Budget tracking with progress bar (green → amber → over budget red)
- Archive completed trips

### Expenses
- Log expenses with 4 split modes: **equal**, **exact amount**, **percentage**, **shares**
- 8 expense categories with icons and colour coding
- Edit or duplicate any expense
- Filter by category, payer, date range — search by description
- Sort by date or amount
- Expenses disappear instantly on delete (optimistic UI, rolls back on error)

### Settlement
- Per-member net balances with animated count-up
- Minimum-transaction algorithm — at most `n-1` payments for `n` members
- "Mark as paid" records a settlement and updates balances
- Full settlement history
- "How is this calculated?" — 3-step breakdown explaining the math
- Per-member debt view: who owes whom, down to the rupee

### Insights
- **Per-trip**: total spend, per-person average, daily average, expense count, spend-by-category donut, daily spend bar, member contribution chart, 7 smart insight cards
- **All trips**: portfolio view — total spend, companion count, category habits, spend-per-trip comparison

### Collaboration
- Supabase Realtime — changes by one member appear for all others without refresh
- Member avatars with deterministic colour initials
- Real names from Google OAuth stored at join time

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript) |
| Styling | Tailwind CSS v4 |
| UI | shadcn/ui (@base-ui/react) |
| Animation | Framer Motion |
| Charts | Recharts |
| Database | Supabase Postgres + Drizzle ORM |
| Auth | Supabase Auth (Google OAuth) |
| Realtime | Supabase Realtime |
| Validation | Zod + react-hook-form |
| Deployment | Vercel (free tier) |

---

## Getting Started

### Prerequisites

- Node.js ≥ 20
- pnpm (`npm install -g pnpm`)
- A Supabase project (free tier works)
- A Google Cloud Console OAuth app (free)
- An Unsplash developer account (free)

### 1. Clone and install

```bash
git clone <your-repo-url> wayfare
cd wayfare
pnpm install
```

### 2. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
DATABASE_URL=postgresql://postgres:your-password@db.your-project.supabase.co:5432/postgres
UNSPLASH_ACCESS_KEY=your_access_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=Wayfare
```

> **Note**: URL-encode special characters in the DATABASE_URL password: `#` → `%23`, `@` → `%40`

### 3. Set up the database

Push the Drizzle schema to Supabase:

```bash
pnpm db:push
```

Apply Row-Level Security policies in the **Supabase SQL Editor** — copy and run the contents of `drizzle/policies.sql`.

Enable Realtime on the required tables (also in SQL Editor):

```sql
alter publication supabase_realtime add table expenses;
alter publication supabase_realtime add table expense_splits;
alter publication supabase_realtime add table settlements;
alter publication supabase_realtime add table trip_members;
```

### 4. Configure Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials
2. Create an OAuth 2.0 Client ID (Web application)
3. Add Authorized redirect URI: `https://<your-supabase-project>.supabase.co/auth/v1/callback`
4. Copy Client ID + Secret into Supabase → Authentication → Providers → Google

### 5. Start the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Development Commands

```bash
pnpm dev          # start dev server
pnpm build        # production build
pnpm typecheck    # TypeScript check
pnpm test         # Vitest unit tests (watch)
pnpm test --run   # single test run
pnpm db:push      # sync schema to Supabase
pnpm db:studio    # Drizzle Studio (visual DB browser)
pnpm seed         # seed a test trip (10 members, 30 expenses)
```

---

## Project Structure

```
app/              Next.js App Router pages and server actions
components/       React components (ui, expense, trip, settlement, insights, shared)
hooks/            Client-side hooks (realtime, form warnings)
lib/              Business logic, DB queries, schemas, algorithms, utilities
scripts/          Seed and verify scripts
drizzle/          RLS policies SQL
```

See `CLAUDE.md` for the full detailed structure and all architectural decisions.

---

## Testing

22 unit tests covering the split computation and settlement optimizer:

```bash
pnpm test --run
```

Seed a realistic test trip for manual testing:

```bash
pnpm seed
# Creates "Goa Summer 2025" — 10 members, 30 expenses across all split modes
```

---

## Deployment

### Vercel (recommended)

1. Push to a Git repo
2. Import the repo in [Vercel](https://vercel.com)
3. Add all environment variables from `.env.local.example` (production values)
4. Set `NEXT_PUBLIC_APP_URL` to your production domain
5. Deploy

### Production Supabase

Create a **separate** Supabase project for production — don't share the dev database. Repeat the schema push and SQL setup steps against the production project.

---

## Architecture Notes

- **Server-first**: React Server Components handle all data fetching. Client components handle interactivity only.
- **No REST API routes**: All mutations go through Next.js Server Actions (`app/actions/`).
- **Drizzle only**: All database reads/writes use Drizzle ORM. The Supabase JS client is only used for auth and realtime subscriptions.
- **RLS everywhere**: Database enforces access control. All 5 tables have Row-Level Security enabled.
- **Realtime via router.refresh()**: Supabase Realtime triggers `router.refresh()` — Next.js re-runs server components and returns fresh data. No client-side cache management needed.

For complete architectural decisions, gotchas, and conventions, see [CLAUDE.md](./CLAUDE.md).

---

## License

MIT
