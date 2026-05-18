# Asset tracking — submission

Built by Abhilasha Senapati for the Cerebras AI Engineering Intern take-home challenge.

**Live app:** https://ai-builder-challenge-starter-4u67jc84f-abhi-lashas-projects.vercel.app

---

## Running locally

**Prerequisites:** Node 22+, Docker (for the API), pnpm 9+.

### 1. Start the API

```bash
cd api
docker build -t asset-tracking-api .
docker run -p 8080:8080 asset-tracking-api
```

Verify: `curl http://localhost:8080/health` → `{"ok":true,"version":"1.0.0"}`

### 2. Configure and start the frontend

```bash
cd starter
cp .env.example .env
# .env already has:
#   API_BASE_URL=http://localhost:8080/v1
#   API_TOKEN=local-dev-token-1234567890
npm install
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
| `/tech/store` | Scan asset → scan location → store. Shows current state between steps. Warns when de-racking from `in_service`. |
| `/tech/deploy` | Scan asset → scan full rack location → deploy. Client-side validates rack + RU. Write-backs to Facilities and Finance run server-side. |
| `/tech/transfer` | Scan asset → scan badge → transfer custody. Same-custodian guard client-side. |

### Manager dashboard

| Route | Description |
|---|---|
| `/manager` | Asset list with state tabs, site dropdown, custodian filter, saved preferences (localStorage). Summary cards as filter shortcuts. 25-per-page pagination. |
| `/manager/assets/[tag]` | Server-rendered detail: info grid + newest-first event log. Responsive table (desktop) / cards (mobile). |
| `/manager/reconcile` | Three-way reconciliation report. 5 buckets ordered by urgency. Click a bucket card to filter. |

### Server routes

| Route | Description |
|---|---|
| `/api/scans/deploy` | Deploy + Facilities write-back (rack_location) + Finance write-back (status: capitalized). Write-back failures never block the tech. |
| `/api/scans/store` | Store + conditional Facilities de-rack (only when coming from `in_service`). |
| `/api/reconcile` | Fetches ops + facilities + finance in parallel, classifies each asset into a bucket, returns a structured report. |

### Dev tooling

`/dev/barcodes` — printable QR codes for test assets, location barcodes, and badge IDs.

---

## Three calls I nearly made the other way

### 1. Client-side API calls vs. server routes for write-backs

My first instinct was to call Facilities and Finance directly from the browser — simpler code, no extra route needed. I stopped when I realised the mock URLs and credentials would be visible in the network tab and bundled JS. The write-backs touch sensitive internal systems (the real equivalents would be on a private VPN), so they need to happen server-to-server. I added `/api/scans/deploy` and `/api/scans/store` as thin Next.js route handlers. This also means write-back failures don't bubble to the client as hard errors, they're logged and surfaced later in reconciliation.

### 2. `api.scans.receive()` helper vs. raw `fetch` for the receive workflow

The typed `api.scans.receive()` wrapper is convenient, but it abstracts away the HTTP status code. The receive endpoint returns 200 for an idempotent duplicate and 201 for a genuinely new asset. Two different outcomes that need different UI feedback. I switched to raw `fetch` and branched on `res.status` directly. It's slightly less ergonomic but it's the only way to tell "this asset was just created" from "this asset was already here" without relying on the response body differing.

### 3. Manager list as a server component vs. client component

The manager list has saved filter preferences in localStorage. Server components can't access `localStorage`, and if I SSR with default filters and hydrate with saved ones, there's a flash of wrong content. A client component with a `prefsLoaded` gate (don't fetch until localStorage is read) is more code but gives correct behaviour. I could have put preferences in a cookie and read them in an RSC, but cookies have their own pitfalls (size limits, SameSite policy). LocalStorage + client component was the cleaner call.

---

## Deliberate edge case decisions

**De-rack warning on store.** When a tech stores an asset that's currently `in_service`, the app warns before committing. I could have silently allowed it — the API accepts it. I didn't, because moving a live server out of a rack without a heads-up is how incidents start. The warning is one extra tap; the alternative is an unexplained outage.

**Same-custodian guard on transfer.** If a tech scans their own badge as the transfer recipient, the app blocks it client-side before hitting the API. The API would reject it anyway, but showing the error before the network round-trip means the tech gets immediate feedback rather than a confusing API error message.

**Serial conflict shows both serials side-by-side.** A 409 on receive means the tag exists with a different serial — someone either mis-scanned or the asset was relabelled. I show both the existing serial and the one just entered in a side-by-side comparison. A generic "conflict" error would send the tech to a manager with no information. The comparison gives them what they need to resolve it on the spot.

**Write-back failures don't block the tech.** If the Facilities or Finance write-back fails after a deploy scan, the scan itself is still committed. The tech gets a success. The discrepancy surfaces in the next reconciliation run. Blocking a deployment because an internal system is slow or down would be the wrong tradeoff — the asset is physically in the rack regardless of what Facilities thinks.

---

## What I chose not to build

**Counts on the summary cards.** My first pass showed "42 in service / 17 stored / …" on the dashboard cards. Getting those numbers required 6 parallel API calls on every page load — one per state, because the API has no aggregation endpoint. I removed the counts and made the cards pure filter shortcuts. The total count is derived from the single list request already in flight. Removing those 6 calls was the single biggest performance improvement I made.

**RMA workflow UI.** The state machine supports RMA; the API accepts it. I didn't build a `/tech/rma` page. A broken instrument needs a manager's sign-off before it leaves the building. That's a process decision, not a scan. A tech initiating RMA without sign-off creates a compliance problem. I surfaced RMA as a state in the badge and reconciliation report so managers can see it.

**Offline mode.** The right answer is a service worker with a write-ahead queue — a full week of work to do correctly. I made the failure path as obvious as possible instead: error banners name exactly what failed and confirm whether the scan was saved, so a tech knows whether to retry or move on.

**Optimistic updates.** After a successful scan, navigating back to the manager list shows stale data. The fix is SWR or React Query with cache invalidation. I kept plain `fetch` + `useState` because adding a caching layer without tests creates subtle inconsistencies that are harder to debug than a stale list.

---

## Reconciliation bucket design

The core question is: **what does a manager need to do Monday morning?** Not "what disagrees". Everything disagreeing is noise. "What needs a human decision this week" is signal.

Five buckets, ordered by urgency:

**Orphaned records** — something exists in Facilities or Finance that Operations has never heard of. Usually means an asset came in through a side channel (a personal order, a donation, an undocumented swap), or was disposed of and never closed out in Finance. Needs investigation before the next audit.

**Both systems drifted** — the asset exists in Operations, but both Facilities and Finance disagree with it. Two systems being wrong simultaneously is harder to explain away than one — more likely a process failure than a data entry glitch.

**Location mismatch** — Facilities says rack B-12, Operations says rack C-4. Usually a move that was re-scanned in Ops but the Facilities write-back failed. Actionable but not urgent — the asset is accounted for, just in the wrong place on paper.

**Finance mismatch** — book status doesn't match operational state. An `in_service` asset still listed as `pending_receipt` is a capitalisation problem; a `disposed` asset still `capitalized` is an audit finding.

**Reconciled** — all three systems agree. Shown last. A manager shouldn't need to look at this bucket.

What I deliberately didn't make a bucket: **minor field differences** (room names spelled two ways, rack numbers with/without leading zeros). Those are data quality issues, not operational ones. Surfacing them makes the report noisy enough that managers stop reading it.

---

## Pushback on the brief / things I noticed

- **`better-sqlite3` on Node 25:** `better-sqlite3` won't build on Node 25. The root `pnpm-workspace.yaml` had placeholder comment text (`"set this to true or false"`) instead of real boolean values. I fixed both — Docker builds the API on Node 22, and `allowBuilds` is now correct.

- **The `api-client.ts` import path bug:** `lib/scan-utils.ts` and `lib/use-current-user.ts` imported from `"./types.js"` and `"./auth.js"`. Next.js doesn't resolve `.js` extensions for `.ts` source files in the App Router — these silently fail at runtime. Fixed to `@/lib/types` and `@/lib/auth`.

- **The reconcile route returned `501` with a hint in the error body:** The error body format matched a real API error, which would cause the client to display "Build the reconciliation logic in app/api/reconcile/route.ts" to a real user. Replaced with the working implementation.

- **Location barcode format wasn't defined:** The brief mentioned scanning locations but didn't specify a format. I designed `LOC|site|room|row|rack|ru` — consistent across the scanner parser, the `/dev/barcodes` page, and the reconciliation comparison logic.

---

## Deployment

**Frontend:** Vercel → import repo → root directory: `starter` → add `API_BASE_URL` and `API_TOKEN` → deploy.

**API:** Railway/Render/Fly.io using the existing Dockerfile. Expose port 8080. Set `AUTH_TOKEN` to match `API_TOKEN` on the frontend.
