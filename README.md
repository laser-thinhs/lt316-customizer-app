# LT316 Proof Builder (Layer 1 / 1.5 Prep)

Standalone web app foundation for cylindrical product proofing workflows.

## Stack
- Next.js (App Router) + TypeScript
- Tailwind CSS
- Prisma + PostgreSQL
- Zod validation
- Zustand for lightweight UI state

## Current Layer status
- Product profiles + machine profiles in Postgres
- Design job creation and retrieval APIs
- Placement JSON validated with Zod (all units in **millimeters**)
- Placement editor panel (2D numeric controls)
- Stubbed file upload interface (no cloud storage yet)
- Health endpoint with DB connectivity check
- Tests for schemas, API routes, and UI happy path

## Environment variables

Create `.env` from `.env.example`:

```bash
cp .env.example .env
```

Required:

- `DATABASE_URL`

Example:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/lt316_proof_builder?schema=public"
```

## Setup

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

App runs at: http://localhost:3000

## Health check

```bash
curl http://localhost:3000/api/health
```

Expected response (healthy):

```json
{
  "data": {
    "status": "ok",
    "checks": {
      "app": "ok",
      "database": "ok"
    }
  }
}
```

## Troubleshooting

### PowerShell execution policy (`npm.ps1` blocked)
If Windows PowerShell blocks npm scripts with an execution-policy error:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

Or run scripts through Command Prompt/Git Bash/WSL.

### Docker + WSL notes
- If running Postgres via Docker Desktop, ensure the container is exposed to your WSL distro.
- Inside WSL, `localhost:5432` usually works when Docker Desktop WSL integration is enabled.
- If not, use the host IP from `/etc/resolv.conf` and update `DATABASE_URL`.

### DB reset workflow
When schema or seed data gets out of sync:

```bash
npm run prisma:migrate reset -- --force
npm run prisma:seed
```

Then restart dev server:

```bash
npm run dev
```

## API Endpoints

### `GET /api/health`
App + database connectivity status.

### `GET /api/product-profiles`
List product profiles.

### `GET /api/product-profiles/:id`
Get one product profile by ID.

### `POST /api/design-jobs`
Create design job.

### `GET /api/design-jobs/:id`
Get one design job by ID.

### `PATCH /api/design-jobs/:id/placement`
Update placement JSON for an existing draft/design job.

## Test command matrix

```bash
npm test                  # all tests
npm run test -- placement.schema.test.ts
npm run test -- design-jobs.route.test.ts
npm run test -- home-page.ui.test.tsx
```

## Notes
- `placementJson` is validated via Zod and intentionally stored in millimeters only.
- File uploads are intentionally stubbed for Layer 1 and still not connected to cloud storage.


## Artwork uploads (Layer 2.4)

- Upload endpoint: `POST /api/assets` (`multipart/form-data`) with `designJobId` and `file`.
- Supported file types: `png`, `jpg`, `jpeg`, `svg`, `webp` up to **15 MB**.
- Files are stored locally under:
  - `${STORAGE_ROOT}/design-jobs/{designJobId}/{assetId}-{sanitizedOriginalName}`
- Default storage root is `./storage` and can be changed with `STORAGE_ROOT`.
- The app auto-creates storage directories when needed.
- Local cleanup: deleting files from `./storage/design-jobs/*` removes local uploads only (database rows remain unless removed separately).

## Switching tracer to remote microservice

Tracer APIs now use a provider abstraction. The default mode is local and keeps using in-repo tracing-core behavior.

### Environment flags

- `TRACER_PROVIDER=local|remote` (default: `local`)
- `TRACER_SERVICE_URL` (required when `TRACER_PROVIDER=remote`)
- `TRACER_SERVICE_API_KEY` (optional; sent as `x-api-key`)
- `TRACER_TIMEOUT_MS` (default: `15000`)

### Behavior

- `POST /api/tracer` always preserves the existing response shape and now also stores generated SVG output in app-managed tracer assets.
- `POST /api/tracer/jobs` and `GET /api/tracer/jobs/:id` support queued/processing/done/failed flow.
- In remote mode, the app forwards `x-request-id` and retries remote network calls once with a 15s timeout.
- Job completion is idempotent: once `outputSvgAssetId` is set, repeated polling returns stored output instead of creating duplicates.

### Optional compose profile

Run app + db only (local tracer provider):

```bash
docker compose --profile app up --build
```

Run app + db + external tracer service profile:

```bash
TRACER_PROVIDER=remote docker compose --profile app --profile tracer-remote up --build
```
