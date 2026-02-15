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
