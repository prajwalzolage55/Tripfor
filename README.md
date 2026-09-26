# GroupTrip Ledger 🗺️

A group travel coordination and settlement app. Organizers build an editable itinerary, add participants, track shared expenses, and settle debts with the minimum number of payments.

## Features

- **Itinerary Builder** — Add flights, hotels, activities, transfers, dining with participant assignment
- **Expense Tracking** — Link expenses to itinerary items, multiple split types, receipt upload via Cloudinary
- **Smart Settlement** — Simplified debt calculation (minimum payments to settle all debts)
- **Personal Dashboard** — Each member sees only their items, their share, and their settlements
- **Group Dashboard** — Pie/bar charts for cost breakdown by category and member contributions
- **UPI Payment Links** — One-tap payment links for settlements
- **Invite System** — 6-character invite codes for joining trips

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Database + Auth**: Supabase (Postgres + RLS + Auth)
- **Styling**: Tailwind CSS v4
- **Charts**: Recharts
- **Icons**: lucide-react
- **File Upload**: Cloudinary (unsigned preset)

## Setup

### 1. Clone and install

```bash
npm install
```

### 2. Set up Supabase

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run the contents of `supabase-schema.sql`
3. Copy your project URL and anon key from Settings → API

### 3. Environment variables

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your-measurement-id
```

### 5. Run locally

```bash
npm run dev
```

### 6. Run engine tests

```bash
npm test
```

## Deploy on Render

1. Push to GitHub
2. Create a new **Web Service** on Render → connect your repo
3. **Build command**: `npm install && npm run build`
4. **Start command**: `npm run start`
5. **Node version**: 20 (set via `.nvmrc`)
6. Add env vars from Section 4 above

## Calculation Engine

The core engine lives in `src/lib/engine.ts`. Balances are **always derived, never stored as truth**. The pipeline:

1. `computeShares()` — each participant's share of a single expense
2. `computeNetBalances()` — net balance across all expenses
3. `simplifyDebts()` — minimum payments via greedy creditor-debtor matching

### Verified Test Case

| Expense | Amount | Paid By | Split |
|---------|--------|---------|-------|
| Hotel   | ₹3,000 | A       | Equal (A,B,C) |
| Dinner  | ₹900   | B       | Equal (A,B,C) |

**Net Balances**: A = +1700, B = -400, C = -1300 (sum = 0) ✅  
**Settlements**: C → A ₹1300, B → A ₹400 (2 transactions) ✅

## License

MIT
