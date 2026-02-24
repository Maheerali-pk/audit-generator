# Klaviyo Audit Builder

A web application for generating comprehensive performance audit reports for Klaviyo marketing accounts. Connect multiple Klaviyo accounts, configure audit parameters, and generate detailed reports covering email marketing health, flows, campaigns, deliverability, and business performance.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Database & Auth:** Supabase (PostgreSQL + Auth)
- **UI:** shadcn/ui, Radix UI, Tailwind CSS 4
- **Language:** TypeScript
- **Encryption:** AES-256-GCM (for storing Klaviyo API keys)

## Getting Started

### Prerequisites

- Node.js 18+
- A Supabase project
- A Klaviyo account with API key(s)

### Environment Variables

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ENCRYPTION_KEY=your-32-byte-hex-key
```

Generate a 32-byte encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Install & Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run gen-db-types` | Regenerate Supabase TypeScript types |

## Project Structure

```
app/
  (dashboard)/              Route group for authenticated pages
    page.tsx                Dashboard home (account list)
    accounts/[id]/
      page.tsx              Account detail & audit runner
      settings/page.tsx     Account settings (timezone, flow mappings)
  api/
    accounts/               CRUD for Klaviyo accounts
    accounts/[id]/audit/    Audit report generation & retrieval
    accounts/[id]/flows/    Fetch flows from Klaviyo
  auth/
    signin/                 Sign in page
    signup/                 Sign up page
    callback/               OAuth callback

components/
  dashboard/                Sidebar, header, dialogs
  ui/                       shadcn/ui components
  debug-console.tsx         Dev-only debug panel (Ctrl+Shift+D)

lib/
  klaviyo.ts                Klaviyo API client (profiles, metrics, flows, campaigns, reports)
  encryption.ts             AES-256-GCM encrypt/decrypt for API keys
  metrics.ts                Metric computation helpers
  constants.ts              Audit section definitions
  debug-logger.ts           Backend request logger (dev only)
  supabase/                 Supabase client helpers (server, admin, middleware)

types/
  audit.types.ts            Audit report & metrics interfaces
  campaigns.types.ts        Campaign & campaign report types
  flows.types.ts            Flow & flow report types
  events.types.ts           Event types
  metrics.types.ts          Metric aggregate types
  database.types.ts         Supabase generated types
```

## Audit Sections

Each audit report can include any combination of these sections:

| Section | What it measures |
|---|---|
| **Email Marketing** | List health, subscriber counts, growth rate, unsubscribe rate |
| **Popups & Forms** | Active forms, submit rates, email/SMS captures, device split |
| **Flows** | Open/click rates for welcome, abandoned cart, browse abandonment, post-purchase, and winback flows; flow revenue share |
| **Campaigns** | Send frequency, open/click/bounce/unsubscribe rates, revenue, top/bottom performers |
| **Technical Health** | Bounce rate, spam complaints, deliverability rate, integration status, email revenue |
| **Business Performance** | Total revenue, Klaviyo attributed revenue (campaigns + flows), email vs SMS split across 30d/90d/365d windows |

## API Routes

### Accounts

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/accounts` | List all accounts |
| `POST` | `/api/accounts` | Create account (encrypts API key) |
| `GET` | `/api/accounts/[id]` | Get account by ID |
| `PATCH` | `/api/accounts/[id]` | Update account |
| `DELETE` | `/api/accounts/[id]` | Delete account |

### Audit Reports

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/accounts/[id]/audit` | Generate audit report (body: `{ sections: string[] }`) |
| `GET` | `/api/accounts/[id]/audit` | Get latest audit report |
| `GET` | `/api/accounts/[id]/audit?history=true` | Get all completed audits |
| `DELETE` | `/api/accounts/[id]/audit` | Delete all audits for account |

### Flows

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/accounts/[id]/flows` | Fetch flows from Klaviyo for mapping |

## Business Performance Revenue Calculation

Revenue metrics in the Business Performance Summary are derived from Klaviyo's reporting APIs rather than metric aggregates:

- **Campaign Revenue** — from `POST /api/campaign-values-reports` (`recipients x revenue_per_recipient`)
- **Flow Revenue** — from `POST /api/flow-values-reports` (`recipients x revenue_per_recipient`)
- **Klaviyo Attributed Revenue** — `campaign revenue + flow revenue`
- **Email/SMS Revenue** — filtered by `send_channel` from the same campaign + flow report results
- **Total Business Revenue** — from metric aggregates (`Placed Order` sum_value, all sources)

## Debug Console (Development Only)

A built-in debug panel captures all `/api/` requests in the browser with backend log output:

- **Toggle:** Click the terminal icon (bottom-right) or press `Ctrl+Shift+D`
- **Features:** Request/response bodies, backend `console.log` output with timestamps, timing data
- **Chrome DevTools:** Backend logs also appear as collapsed groups in the browser console

The debug system is powered by `AsyncLocalStorage` on the backend and a `fetch` interceptor on the frontend. It is completely stripped from production builds.

## Deployment

Designed for Vercel with `maxDuration: 300` on the audit endpoint (requires Pro plan for timeouts > 60s). The audit generation process makes many sequential Klaviyo API calls with rate-limit handling.

```bash
npm run build
```

Ensure all environment variables are set in your deployment platform.
