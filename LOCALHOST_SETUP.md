# Local Development Setup Guide

## Quick Start on localhost:3000

This guide provides step-by-step instructions to run the LT316 Proof Builder application on localhost:3000.

### Prerequisites
- Node.js v24.x or later
- npm 11.x or later
- Docker (for PostgreSQL)

### Setup Steps

#### Optional: Start full local service stack (Docker)

If you want supporting services running in Docker (Postgres + Python APIs), run:

```bash
npm run stack:up
```

This starts:
- `db` on `5432`
- `py-api` on `8000`
- `studio-ai` on `8010`

To stop these services:

```bash
npm run stack:down
```

1. **Install Dependencies**
```bash
npm install
```

2. **Start PostgreSQL Database**
```bash
docker compose up -d
```

This starts PostgreSQL with:
- User: `app`
- Password: `app`
- Database: `customizer`
- Port: `5432`

3. **Create Environment File**

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

The `.env` file should contain:
```env
DATABASE_URL="postgresql://app:app@localhost:5432/customizer?schema=public"
```

4. **Set Up Database**

Generate Prisma client:
```bash
npm run prisma:generate
```

Run migrations:
```bash
npm run prisma:migrate
```

Seed initial data:
```bash
npm run prisma:seed
```

5. **Start Development Server**
```bash
npm run dev
```

The application will be available at: **http://localhost:3000**

### Verify Setup

1. **Health Check**
```bash
curl http://localhost:3000/api/health
```

Expected response:
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

2. **Open Browser**

Navigate to http://localhost:3000 and you should see the LT316 Proof Builder interface with:
- Product profile dropdown (populated with seeded data)
- "New Job" button

### Troubleshooting

**Port 3000 already in use:**
```bash
# Find and kill process using port 3000
lsof -ti:3000 | xargs kill -9
# Or use a different port
npm run dev -- -p 3001
```

**Database connection issues:**
```bash
# Check if PostgreSQL container is running
docker ps | grep postgres

# Restart container if needed
docker compose restart

# Check database logs
docker compose logs db
```

**Reset database:**
```bash
npm run prisma:migrate reset -- --force
npm run prisma:seed
```

### API Endpoints

- `GET /api/health` - Health check
- `GET /api/product-profiles` - List product profiles
- `GET /api/product-profiles/:id` - Get product profile
- `POST /api/design-jobs` - Create design job
- `GET /api/design-jobs/:id` - Get design job
- `PATCH /api/design-jobs/:id/placement` - Update placement

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- placement.schema.test.ts

# Run tests in watch mode
npm run test:watch
```

### Development Workflow

1. Make code changes
2. Hot reload happens automatically
3. Test your changes at http://localhost:3000
4. Run tests: `npm test`
5. Lint code: `npm run lint`

### Stopping the Application

```bash
# Stop the dev server: Ctrl+C

# Stop and remove Docker containers
docker compose down

# Stop and remove containers with volumes (clears database)
docker compose down -v
```
