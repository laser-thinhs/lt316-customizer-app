# LT316 Proof Builder (Layer 1)

Standalone web app foundation for cylindrical product proofing workflows.

## Stack
- Next.js (App Router) + TypeScript
- Tailwind CSS
- Prisma + PostgreSQL
- Zod validation
- Zustand for lightweight UI state

## Layer 1 features
- Product profiles + machine profiles in Postgres
- Design job creation and retrieval APIs
- Placement JSON validated with Zod (all units in **millimeters**)
- Minimal mobile-first UI:
  - product selector
  - New Job button
  - job summary card
- Stubbed file upload interface (no cloud storage yet)
- Tests:
  - validator test
  - API route test

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

## Migration commands

Development migration:

```bash
npm run prisma:migrate -- --name init
```

Deploy migrations (non-dev environments):

```bash
npm run prisma:deploy
```

## Seed command

```bash
npm run prisma:seed
```

## Test commands

```bash
npm test
npm run test:watch
```

## API Endpoints

### `GET /api/product-profiles`
List product profiles.

### `GET /api/product-profiles/:id`
Get one product profile by ID.

### `POST /api/design-jobs`
Create design job.

Body:

```json
{
  "orderRef": "optional-order-ref",
  "productProfileId": "cuid",
  "machineProfileId": "cuid-or-seeded-id",
  "placementJson": {
    "widthMm": 50,
    "heightMm": 50,
    "offsetXMm": 0,
    "offsetYMm": 0,
    "rotationDeg": 0,
    "anchor": "center"
  }
}
```

### `GET /api/design-jobs/:id`
Get one design job by ID.

## Notes
- `placementJson` is validated via Zod and intentionally stored in millimeters.
- File uploads are intentionally stubbed for Layer 1.
