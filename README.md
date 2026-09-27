# 🧭 TriFork

<p align="center">
  <img src="https://img.shields.io/badge/TriFork-Group%20Travel%20Platform-000000?style=for-the-badge" />
</p>

<h3 align="center">Plan Together. Explore Together. Settle Smarter.</h3>

<p align="center">
  A premium group travel coordination platform combining interactive 3D itineraries, smart expense management, scenario simulation, and simplified debt settlement.
</p>

<p align="center">
  <a href="https://tripfor.vercel.app/">
    <img src="https://img.shields.io/badge/🌐_Live_Website-000000?style=for-the-badge" />
  </a>
  &nbsp;
  <a href="https://drive.google.com/file/d/1QdzKhRj0es53_jh1lPdCF0Efs_-tyKZr/view?usp=sharing">
    <img src="https://img.shields.io/badge/▶️_Demo_Video-FF0000?style=for-the-badge" />
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js" />
  <img src="https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=flat-square&logo=supabase" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?style=flat-square&logo=tailwindcss" />
  <img src="https://img.shields.io/badge/Cesium-3D_Globe-6CADDF?style=flat-square" />
  <img src="https://img.shields.io/badge/UPI-Payments-5F259F?style=flat-square" />
</p>

---

## ✨ Overview

**TriFork** is an all-in-one platform for planning and managing group trips.

It combines itinerary planning, interactive 3D destination visualization, shared expense tracking, intelligent debt settlement, and what-if scenario simulation into a single collaborative experience.

Instead of switching between spreadsheets, messaging apps, maps, calculators, and payment applications, TriFork provides one centralized workspace for the entire trip.

### The core workflow

```text
Plan → Explore → Track → Simulate → Settle
```

---

## 🚀 Key Features

### 🌍 Interactive 3D Globe & Weather

Explore your trip destinations through an interactive **Cesium 3D Globe**.

* Interactive destination visualization
* Trip locations displayed on a 3D globe
* Real-time weather information
* OpenWeather integration
* Visual geographic exploration

---

### 🗓️ Smart Itinerary Builder

Create and manage a complete trip itinerary.

Supports:

* ✈️ Flights
* 🏨 Hotels
* 🎯 Activities
* 🚗 Transfers
* 🍽️ Dining
* 👥 Participant assignment

Each itinerary item can be associated with relevant participants and trip information.

---

### 💰 Smart Debt Engine

TriFork automatically calculates shared expenses and determines who owes whom.

The engine handles:

* Individual expenses
* Equal expense splitting
* Participant-based sharing
* Net balance calculation
* Creditor/debtor matching
* Simplified settlements
* Minimum-payment transaction planning

The goal is to reduce unnecessary payment transactions while maintaining mathematically correct balances.

---

### 🔗 Dependency & Settlement Graph

Visualize the financial relationships between participants using a directed graph.

The graph can represent:

* Who owes whom
* Debt dependencies
* Transfers
* Participant relationships
* Settlement networks

This makes complex group finances easier to understand visually.

---

### 🔮 What-If Scenario Simulator

Explore hypothetical changes to the trip before making decisions.

For example:

* Cancel a hotel
* Add a refund
* Reallocate an expense
* Change participant contributions
* Modify trip costs
* Compare different financial scenarios

The simulator allows users to understand how changes affect the final settlement.

---

### 📊 Personal & Group Dashboards

Dedicated dashboards provide a clear overview of trip finances.

#### Personal Dashboard

* Personal expenses
* Amount paid
* Amount owed
* Amount to receive
* Settlement status

#### Group Dashboard

* Total trip spending
* Participant balances
* Expense distribution
* Settlement overview
* Interactive charts

---

### 📲 UPI Payment Links

TriFork provides one-tap UPI payment links for faster settlements.

Designed for convenient mobile payments in India.

Users can initiate a payment directly from the settlement interface without manually entering payment details.

---

### 🔐 Invite System

Bring participants into a trip using a simple invite system.

* 6-character invite codes
* Direct sharing
* Easy onboarding
* Group-based access

---

# 🧠 Smart Settlement Engine

The financial engine is one of TriFork's core components.

Balances are **derived from expense data rather than stored as the source of truth**.

### Calculation Pipeline

```text
                    EXPENSE
                       │
                       ▼
              ┌─────────────────┐
              │ computeShares() │
              └────────┬────────┘
                       │
                       ▼
           ┌──────────────────────┐
           │ computeNetBalances() │
           └──────────┬───────────┘
                      │
                      ▼
                NET BALANCES
                      │
                      ▼
             ┌────────────────┐
             │ simplifyDebts()│
             └───────┬────────┘
                     │
                     ▼
            MINIMUM SETTLEMENTS
```

### 1. `computeShares()`

Calculates each participant's share of an individual expense.

### 2. `computeNetBalances()`

Combines all expenses and calculates each participant's overall net balance.

### 3. `simplifyDebts()`

Matches creditors and debtors to produce a simplified set of payment transactions.

---

# 🧪 Verified Test Case

Consider the following group expenses:

| Expense    | Amount | Paid By | Split           |
| ---------- | -----: | ------- | --------------- |
| 🏨 Hotel   | ₹3,000 | A       | Equal — A, B, C |
| 🍽️ Dinner |   ₹900 | B       | Equal — A, B, C |

### Calculation

Each participant's share:

```text
Hotel:
₹3,000 ÷ 3 = ₹1,000 each

Dinner:
₹900 ÷ 3 = ₹300 each
```

Net positions:

```text
A → Paid ₹0
    Share = ₹1,300
    Net = -₹1,300

B → Paid ₹900
    Share = ₹1,300
    Net = -₹400

C → Paid ₹0
    Share = ₹1,300
    Net = -₹1,300
```

The engine uses the calculated balances to generate the appropriate settlement transactions.

> **Note:** Settlement output is derived dynamically from the underlying expense data.

---

# 🏗️ Technology Stack

| Technology             | Purpose                        |
| ---------------------- | ------------------------------ |
| **Next.js 15**         | Full-stack React framework     |
| **Next.js App Router** | Application routing            |
| **Supabase**           | Database, authentication & RLS |
| **PostgreSQL**         | Relational data storage        |
| **Tailwind CSS v4**    | UI styling                     |
| **Cesium**             | Interactive 3D globe           |
| **OpenWeather**        | Live weather data              |
| **Recharts**           | Data visualization             |
| **Lucide React**       | UI icons                       |
| **Cloudinary**         | File/image uploads             |
| **UPI Links**          | Payment settlements            |

---

# 🏛️ Architecture

```text
                         ┌────────────────────┐
                         │      TriFork       │
                         │   Next.js 15 App   │
                         └─────────┬──────────┘
                                   │
                ┌──────────────────┼──────────────────┐
                │                  │                  │
                ▼                  ▼                  ▼
        ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
        │   Supabase   │   │   External   │   │   Cloudinary │
        │              │   │    APIs      │   │              │
        │ PostgreSQL   │   │              │   │ File Storage │
        │ Auth         │   │ OpenWeather  │   │              │
        │ RLS          │   │              │   │              │
        └──────┬───────┘   └──────────────┘   └──────────────┘
               │
               ▼
       ┌─────────────────┐
       │ Calculation     │
       │ Engine          │
       │                 │
       │ Shares          │
       │ Balances        │
       │ Debt Settlement │
       └─────────────────┘
```

---

# 📁 Project Structure

```text
TriFork/
│
├── src/
│   ├── app/
│   │   ├── dashboard/
│   │   ├── itinerary/
│   │   ├── expenses/
│   │   ├── settlements/
│   │   └── ...
│   │
│   ├── components/
│   │   ├── globe/
│   │   ├── charts/
│   │   ├── itinerary/
│   │   ├── expenses/
│   │   └── ...
│   │
│   └── lib/
│       └── engine.ts
│
├── supabase-schema.sql
├── package.json
├── .env.local
├── .nvmrc
└── README.md
```

---

# ⚡ Getting Started

## 1. Clone the Repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL

cd TriFork
```

---

## 2. Install Dependencies

```bash
npm install
```

---

## 3. Set Up Supabase

Create a new project on Supabase.

Then:

1. Open the **SQL Editor**
2. Run the contents of `supabase-schema.sql`
3. Navigate to **Settings → API**
4. Copy your project URL
5. Copy your anon key

---

## 4. Configure Environment Variables

Create a `.env.local` file in the project root.

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

> ⚠️ Never commit `.env.local` or private credentials to GitHub.

---

## 5. Run Locally

Start the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

---

# 🧪 Testing

Run the calculation engine tests:

```bash
npm test
```

The test suite validates the core expense-sharing and debt-settlement logic.

---

# ☁️ Deployment

TriFork can be deployed using **Render** or other Next.js-compatible hosting platforms.

### Build Command

```bash
npm install && npm run build
```

### Start Command

```bash
npm run start
```

### Node Version

```text
20
```

The Node version can be specified through `.nvmrc`.

Make sure all required environment variables are configured in the deployment platform.

---

# 🔐 Security

TriFork uses Supabase authentication and Row Level Security to protect user and trip data.

### Security principles

* 🔒 Authentication-based access
* 🛡️ Row Level Security
* 👥 Group-level data isolation
* 🔑 Environment-based secrets
* 🧮 Derived financial calculations
* ☁️ Secure cloud file storage

---

# 🗺️ User Journey

```text
              ┌───────────────┐
              │   Create Trip │
              └───────┬───────┘
                      │
                      ▼
              ┌───────────────┐
              │ Invite Members│
              └───────┬───────┘
                      │
                      ▼
             ┌─────────────────┐
             │ Build Itinerary │
             └────────┬────────┘
                      │
                      ▼
             ┌─────────────────┐
             │ Explore 3D Globe│
             └────────┬────────┘
                      │
                      ▼
              ┌──────────────┐
              │Track Expenses│
              └───────┬──────┘
                      │
                      ▼
              ┌──────────────┐
              │ Smart Engine │
              └───────┬──────┘
                      │
                      ▼
             ┌─────────────────┐
             │ What-If Scenario│
             └────────┬────────┘
                      │
                      ▼
             ┌─────────────────┐
             │Smart Settlement │
             └────────┬────────┘
                      │
                      ▼
                 💸 UPI PAY
```

---

# 🎯 Use Cases

TriFork can be used for:

* 👨‍👩‍👧‍👦 Friends travelling together
* 🎓 College trips
* 🧑‍💻 Team & corporate trips
* 🌍 International group travel
* 🏕️ Weekend getaways
* ✈️ Multi-destination journeys
* 🚗 Road trips
* 🏨 Group vacations

---

# 🔮 Future Roadmap

* [ ] 🤖 AI-powered itinerary recommendations
* [ ] 🧾 Automatic receipt OCR
* [ ] 🏷️ Automatic expense categorization
* [ ] 💰 Advanced trip budgeting
* [ ] ✈️ Travel booking integrations
* [ ] 🔄 Real-time collaborative itinerary editing
* [ ] 🔔 Push notifications
* [ ] 💱 Multi-currency support
* [ ] 📱 Dedicated mobile application
* [ ] 🧠 Advanced settlement optimization
* [ ] 📈 Advanced trip analytics
* [ ] 🗺️ More detailed destination intelligence

---

# 🌐 Live Project

<p align="center">

<a href="https://tripfor.vercel.app/">
<img src="https://img.shields.io/badge/🌐_OPEN_TRIFORK-000000?style=for-the-badge" />
</a>

</p>

<p align="center">

<strong>Try the live application:</strong><br>

<a href="https://tripfor.vercel.app/">
https://tripfor.vercel.app/
</a>

</p>

---

# 🎥 Demo Video

<p align="center">

<a href="https://drive.google.com/file/d/1QdzKhRj0es53_jh1lPdCF0Efs_-tyKZr/view?usp=sharing">
<img src="https://img.shields.io/badge/▶️_WATCH_FULL_DEMO-FF0000?style=for-the-badge&logo=google-drive&logoColor=white" />
</a>

</p>

<p align="center">
See TriFork's complete workflow, features, and user experience in action.
</p>

---

# 💡 Core Philosophy

> **Travel planning should be collaborative.**
> **Expense management should be transparent.**
> **Settlements should be simple.**

### TriFork brings all three together.

---

<p align="center">

## 🧭 TriFork

### Plan Together. Explore Together. Settle Smarter.

<br>

Built with ❤️, creativity, and code.

</p>
