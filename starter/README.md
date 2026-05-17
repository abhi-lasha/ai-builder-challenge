# Asset tracking — submission

Built by Abhilasha Senapati for the Cerebras AI Engineering Intern take-home challenge.

---

## Running locally

**Prerequisites:** Node 22+, Docker (for the API), pnpm 9+.

### 1. Start the API (Docker)

```bash
# From the repo root
cd api
docker build -t asset-tracking-api .
docker run -p 8080:8080 asset-tracking-api
```

Verify it's healthy: `curl http://localhost:8080/health` → `{"ok":true,"version":"1.0.0"}`

### 2. Configure the frontend

```bash
cd starter
cp .env.example .env
# .env already has:
#   API_BASE_URL=http://localhost:8080/v1
#   API_TOKEN=local-dev-token-1234567890
```

### 3. Start the frontend

```bash
cd starter
npm install   # or pnpm install
npm run dev   # http://localhost:3000
```

### Environment variables

| Variable | Required | Notes |
|---|---|---|
| `API_BASE_URL` | Yes | Upstream API base including `/v1`. Default: `http://localhost:8080/v1` |
| `API_TOKEN` | Yes | Server-only. **Never** prefix with `NEXT_PUBLIC_` — the browser hits `/api/upstream/*` and the proxy attaches it. |

---

## What was built

### Tech workflows (mobile-first, glove-friendly)

| Route | Description |
|---|---|
| `/tech` | Workflow picker — 4 cards, full tap targets |
| `/tech/receive` | Two-phase receive: scan tag → fill details. Handles new (201), duplicate+same serial (200 → blue banner), and serial conflict (409 → side-by-side comparison). |
| `/tech/store` | Scan asset → scan location → store. Shows current state card between steps. Warns when de-racking from `in_service`. |
| `/tech/deploy` | Scan asset → scan full rack location → deploy. Client-side validates rack + RU before submitting. Write-backs to Facilities and Finance run server-side. |
| `/tech/transfer` | Scan asset → scan badge → transfer custody. Same-custodian guard client-side. |

### Manager dashboard

| Route | Description |
|---|---|
| `/manager` | Asset list with state tabs, site dropdown, custodian filter, saved preferences (localStorage). Summary cards act as filter shortcuts. 25-per-page pagination. |
| `/manager/assets/[tag]` | Server-rendered detail: info grid + newest-first event log. Responsive table (desktop) / cards (mobile). |
| `/manager/reconcile` | Three-way reconciliation report. 5 buckets: synced, location drift, finance drift, both drifted, ghost. Click a bucket card to filter. Refresh button. |

### Server routes

| Route | Description |
|---|---|
| `/api/scans/deploy` | Deploy + Facilities write-back (rack_location) + Finance write-back (status: capitalized). Write-back failures are logged server-side but never block the tech. |
| `/api/scans/store` | Store + conditional Facilities de-rack (only when coming from `in_service`). |
| `/api/reconcile` | Fetches ops + facilities + finance in parallel, classifies each asset into a bucket, and returns a structured report. |

### Dev tooling

`/dev/barcodes` — printable QR codes for all test assets, 3 location barcodes, and 3 badge IDs. Useful during demos.

---

## Three calls I nearly made the other way

### 1. Client-side API calls with the token vs. server routes for write-backs

My first instinct was to call Facilities and Finance directly from the browser — simpler code, no extra route needed. I stopped when I realised the mock URLs and credentials would be visible in the network tab and bundled JS. The write-backs touch sensitive internal systems (the real equivalents would be on a private VPN), so they need to happen server-to-server. I added `/api/scans/deploy` and `/api/scans/store` as thin Next.js route handlers that hold the upstream credentials and fan out to all three systems. This also means write-back failures don't bubble to the client as hard errors — they're logged and surfaced later in reconciliation.

### 2. `api.scans.receive()` helper vs. raw `fetch` for the receive workflow

The typed `api.scans.receive()` wrapper is convenient, but it abstracts away the HTTP status code. The receive endpoint returns 200 for an idempotent duplicate and 201 for a genuinely new asset — two different outcomes that need different UI feedback. I switched to `fetch("/api/upstream/scans/receive")` and branched on `res.status` directly. It's slightly less ergonomic but it's the only way to tell "this asset was just created" from "this asset was already here" without relying on the response body differing (it doesn't — both return the asset).

### 3. Manager list as a server component vs. client component with `useEffect`

The manager list has saved filter preferences in localStorage. Server components can't access `localStorage`, and worse, if I SSR the list with default filters and then hydrate with the user's saved filters, I'd get a flash of the wrong content. A client component with a `prefsLoaded` gate (don't fetch until localStorage is read) is more code, but it gives correct behaviour: the list only fetches once the user's actual preferences are known. I could have put preferences in a cookie and read them in an RSC, but that's a more invasive change and cookies have their own pitfalls (size limits, SameSite policy). LocalStorage + client component was the cleaner call for this scope.

---

## What I chose not to build

The brief explicitly lists several out-of-scope items. These are the ones where I made an active call to stop rather than just following the exclusion list:

**Counts on the summary cards.** My first pass showed "42 in service / 17 stored / …" on the manager dashboard cards. It looked satisfying, but getting those numbers required 6 parallel API calls on every page load — one per state. The API has no aggregation endpoint, so each call fetches the full filtered list just to count it. I removed the counts entirely and made the cards pure filter shortcuts. The total count is still there (derived from the single list result already in flight), just not broken out by state. A manager who needs that breakdown can click a card and see it in the table header. Removing the counts cut load time more than any other single change.

**RMA workflow UI.** The state machine supports RMA; the API accepts it. I didn't build a `/tech/rma` page. A broken instrument needs a manager's sign-off before it leaves the building — that's a process decision, not a scan. A tech scanning an asset into RMA without that sign-off creates a compliance problem. I surfaced RMA as a state in the badge and the reconciliation report so managers can see it, but I didn't give techs a way to initiate it.

**Offline mode.** Lab docks often have patchy Wi-Fi. The right answer is a service worker with a write-ahead queue. That's a full week of work to do correctly (conflict resolution, queue flushing, ordering guarantees). I made the failure path as obvious as possible instead — the error banners name exactly what failed and confirm whether the scan was saved, so a tech knows whether to retry or move on. Good error copy is not a substitute for offline support in production, but it's the right call for a 10-hour challenge.

**Optimistic updates.** After a successful scan, navigating back to the manager list shows stale data until the next fetch. The fix is SWR or React Query with cache invalidation keyed on the asset tag. I kept plain `fetch` + `useState` because adding a caching layer without tests is a liability — it creates subtle inconsistencies that are harder to debug than a stale list. The pattern is clear enough that a reviewer can see where it would slot in.

---

## Reconciliation bucket design

The brief says to decide the categories and explain them to a non-technical asset manager. Here's the reasoning:

The core question is: **what does a manager need to do Monday morning?** Not "what disagrees" — everything disagreeing is noise. "What needs a human decision this week" is signal.

I settled on five buckets, ordered by how urgent they are:

**Ghost records** — something exists in Facilities or Finance that Operations has never heard of. This is the most alarming: it usually means an asset was brought in through a side channel (a PI's personal order, a donation, a hardware swap done without a scan), or something was disposed of and never closed out in Finance. Either way, a human needs to investigate before the next audit.

**Both systems drifted** — the asset exists in Operations, but both Facilities and Finance disagree with it. This is typically a deploy that happened months ago and was never written back to either system. Two systems being wrong simultaneously is harder to explain away than one — it's more likely a process failure than a data entry glitch.

**Location drift** — Facilities says the asset is in rack B-12, Operations says it's in rack C-4. Usually this means the asset was moved and re-scanned in Ops, but the Facilities write-back failed or was skipped. Actionable but not urgent — the asset is accounted for, just in the wrong place on paper.

**Finance drift** — the asset's book status doesn't match its operational state. An `in_service` asset that Finance still calls `pending_receipt` is a capitalisation problem; a `disposed` asset still listed as `capitalized` is an audit finding. Finance teams care about this more than facilities teams do.

**Synced** — all three systems agree. Shown last, collapsed by default in spirit (though visible for completeness). A manager shouldn't need to look at this bucket; it's there so the report feels complete rather than only showing problems.

What I deliberately didn't make a bucket: **minor field differences** (a room name spelled two ways, a rack number with/without a leading zero). Those are data quality issues, not operational ones. Surfacing them would make the report noisy enough that managers stop reading it.

---

## Pushback on the brief / things I noticed

- **`better-sqlite3` on Node 25:** pnpm 11 requires Node 22+ (it uses the `node:sqlite` builtin), but `better-sqlite3` won't build on Node 25. The root `pnpm-workspace.yaml` had placeholder comment text (`"set this to true or false"`) instead of real boolean values. I fixed both — Docker builds the API on Node 22, and `allowBuilds` in the workspace config is now correct.

- **The `api-client.ts` import path bug:** `lib/scan-utils.ts` and `lib/use-current-user.ts` imported from `"./types.js"` and `"./auth.js"` respectively. Next.js doesn't resolve the `.js` extension for `.ts` source files in the App Router — these both silently fail at runtime. I changed them to `@/lib/types` and `@/lib/auth`.

- **The reconcile route returned `501` with a hint comment inside the error body:** That's a useful scaffold, but the error body format was also the same as a real API error, which would cause the client to try to display "Build the reconciliation logic in app/api/reconcile/route.ts" to a real user. I replaced it with the working implementation.

- **Location barcode format wasn't defined:** The brief mentioned scanning locations but didn't specify a format. I designed `LOC|site|room|row|rack|ru` (5 pipe-separated segments) — consistent with what the `/dev/barcodes` page generates and what the scan-utils parse. The deploy write-back uses `[site, room, row, rack, ru].filter(Boolean).join("/")` for Facilities records, so the reconciliation can compute the expected value and compare directly.

---

## Scripts

```bash
npm run dev       # Next.js dev server on :3000
npm run build     # Production build
npm run start     # Run the production build
npm run typecheck # tsc --noEmit (zero errors)
npm run lint      # next lint
```

---

## Deployment

**Frontend (Vercel):**
1. Push to GitHub.
2. Import the repo in Vercel. Set the **root directory** to `starter`.
3. Add environment variables: `API_BASE_URL` and `API_TOKEN` (the values from your deployed API).
4. Deploy.

**API:** Deploy the `api/` directory to Railway, Render, or Fly.io using the existing Dockerfile. Expose port 8080. Set `AUTH_TOKEN` to match what you put in `API_TOKEN` on the frontend.
