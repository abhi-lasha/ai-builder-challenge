# Asset tracking — starter

The Next.js frontend for the asset tracking challenge. See the [root README](../README.md) for the full submission writeup.

## Quick start

```bash
cd starter
cp .env.example .env
npm install
npm run dev   # http://localhost:3000
```

The frontend expects the upstream API at `API_BASE_URL`. Browser requests go through a same-origin proxy at `/api/upstream/*` — the proxy attaches the bearer token server-side, so `API_TOKEN` never reaches the client.

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `API_BASE_URL` | Yes | Upstream API base including `/v1`. Default: `http://localhost:8080/v1` |
| `API_TOKEN` | Yes | Server-only. **Never** prefix with `NEXT_PUBLIC_`. |

## Scripts

```bash
npm run dev       # Next.js dev server on :3000
npm run build     # Production build
npm run start     # Run the production build
npm run typecheck # tsc --noEmit
npm run lint      # next lint
```

## Deployment

1. Import the repo in Vercel. Set the **root directory** to `starter`.
2. Add `API_BASE_URL` and `API_TOKEN` as environment variables.
3. Deploy.
