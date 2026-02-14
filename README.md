# Custom Product Designer Scaffold

Production-oriented scaffold for a standalone product customizer MVP.

## Stack

- Next.js (TypeScript, App Router)
- Tailwind CSS
- Prisma + PostgreSQL
- Auth scaffold (email magic-link placeholder)
- Upload abstraction (S3-compatible + local fallback)

## MVP Included

- Product template data model with LightBurn defaults.
- Artwork upload API for SVG/PNG with file type + size validation.
- 2D placement tool with mm units, X/Y offset, rotation, and safe-area overlay.
- Job submission persistence with final transform values.
- Admin page for template + default laser setting management.
- JSON export endpoint for LightBurn conversion pipeline handoff.

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Copy environment values:

```bash
cp .env.example .env
```

3. Start PostgreSQL:

```bash
docker compose up -d
```

4. Generate Prisma client and run migrations:

```bash
npm run prisma:generate
npx prisma migrate dev --name init
```

5. Seed initial template (`20oz tumbler`):

```bash
npm run prisma:seed
```

6. Run app:

```bash
npm run dev
```

Open:
- Designer: `http://localhost:3000`
- Admin: `http://localhost:3000/admin`
- Sign-in scaffold: `http://localhost:3000/auth/sign-in`

## API Endpoints

- `GET /api/templates`
- `POST /api/admin/templates`
- `POST /api/uploads`
- `POST /api/jobs`
- `GET /api/jobs/:id/export`
- `POST /api/auth/magic-link`

## Suggested Initial Commit Messages

1. `feat: scaffold Next.js custom product designer MVP`
2. `chore: add Prisma/Postgres, upload storage abstraction, and seed data`
3. `feat: add canvas placement tool, admin template manager, and export API`
