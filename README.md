# LT316 Proof Builder

Standalone web app for cylindrical product proofing workflows with placement editor, template system, batch processing, and export pipeline.

## Stack
- Next.js (App Router) + TypeScript
- Tailwind CSS
- Prisma + PostgreSQL
- Zod validation
- Zustand for lightweight UI state

## Current Status (Layers 1 → 2.6 Complete)

### Layer 1: Foundation
- Product profiles + machine profiles in Postgres
- Design job creation and retrieval APIs
- Placement JSON validated with Zod (all units in **millimeters**)
- Placement editor panel (2D numeric controls)
- Health endpoint with DB connectivity check

### Layer 2.1: Text Tooling
- Placement v2 schema with heterogeneous objects (text_line, text_block, text_arc, image, vector)
- Text layout and typography controls
- Font management and outline generation API
- Deterministic millimeter-based placement

### Layer 2.2: Templates & Batch Processing
- Template creation with variable token system
- CSV batch upload and processing
- VDP (Variable Data Printing) token substitution
- Batch run management and error handling

### Layer 2.3: Preflight & Export
- Export artifact generation (manifest, SVG)
- Preflight validation (geometry, safe zones, overlaps)
- Design job export pipeline
- Export pack creation

### Layer 2.4: Asset Management
- Asset upload endpoint (`multipart/form-data`)
- Local file storage under `./storage`
- Image normalization and preview generation
- Supported formats: png, jpg, jpeg, svg, webp (up to 15MB)
- Asset linking to design jobs

### Layer 2.5: Wrap Preflight & SVG Export
- Cylindrical wrap calculations
- SVG export with device-ready formatting
- Enhanced preflight checks for wrap scenarios

### Layer 2.6: Autosave & Recovery
- Placement autosave with retry logic
- Local draft recovery
- Placement hash-based change detection
- Audit trail service

## Quick Start

See [LOCALHOST_SETUP.md](./LOCALHOST_SETUP.md) for detailed setup instructions.

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Seed initial data
npm run prisma:seed

# Start dev server
npm run dev
```

App runs at: **http://localhost:3000**

### Health Check
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

### Health & Config
- **`GET /api/health`** - App + database connectivity status
- **`GET /api/fonts`** - List available fonts for text rendering

### Product Profiles
- **`GET /api/product-profiles`** - List all product profiles
- **`GET /api/product-profiles/:id`** - Get product profile by ID

### Design Jobs
- **`POST /api/design-jobs`** - Create new design job
- **`GET /api/design-jobs/:id`** - Get design job by ID
- **`PATCH /api/design-jobs/:id`** - Update design job (status, metadata)
- **`PATCH /api/design-jobs/:id/placement`** - Update placement JSON
- **`GET /api/design-jobs/:id/assets`** - List assets for a design job
- **`GET /api/design-jobs/:id/proof`** - Generate proof image
- **`POST /api/design-jobs/:id/preflight`** - Run preflight validation
- **`POST /api/design-jobs/:id/export`** - Generate export pack with artifacts
- **`POST /api/design-jobs/:id/export/svg`** - Export SVG with wrap calculations
- **`POST /api/design-jobs/export-batch`** - Bulk export multiple design jobs

### Assets
- **`POST /api/assets`** - Upload asset (multipart/form-data)
- **`GET /api/assets/:id`** - Get asset metadata
- **`POST /api/assets/:id/normalize`** - Normalize asset for export
- **`POST /api/assets/upload`** - Alternative upload endpoint

### Templates
- **`GET /api/templates`** - List templates (with filtering)
- **`POST /api/templates`** - Create new template
- **`GET /api/templates/:id`** - Get template by ID
- **`PATCH /api/templates/:id`** - Update template
- **`POST /api/templates/:id/apply`** - Apply template to design job with token values

### Batches
- **`GET /api/batches`** - List batch runs
- **`POST /api/batches`** - Create batch from CSV upload
- **`GET /api/batches/:id`** - Get batch run details
- **`GET /api/batches/:id/items`** - List batch items with status
- **`POST /api/batches/:id/retry-failed`** - Retry failed batch items
- **`GET /api/batches/:id/errors.csv`** - Download CSV of failed items

### Text Processing
- **`POST /api/text/outline`** - Generate vector outline from text object

## Test Suite

```bash
npm test                               # Run all tests (23 suites, 62 tests)
npm run test:watch                     # Run tests in watch mode
npm run test -- placement.schema.test.ts    # Run specific test file
npm run test -- design-jobs.route.test.ts
npm run test -- home-page.ui.test.tsx
```

Current test coverage includes:
- Schema validation (placement, templates, batches)
- API route integration tests
- Text layout and typography
- Cylinder geometry and wrap calculations
- Asset upload and normalization
- Batch processing workflows
- Export and preflight pipelines
- UI component testing

## Architecture Notes

### Placement JSON Format
- All measurements in **millimeters** (no unit mixing)
- Versioned schema (current: v2) with auto-upgrade from legacy
- Heterogeneous object types: `text_line`, `text_block`, `text_arc`, `image`, `vector`
- Validated with Zod on create/update/read operations

### Asset Storage
- Local filesystem storage under `${STORAGE_ROOT}/design-jobs/{designJobId}/`
- Default `STORAGE_ROOT` is `./storage` (configurable via env var)
- Asset kinds: `original`, `normalized`, `preview`
- Automatic directory creation on upload
- Assets cascade-delete when design job is deleted

### Template System
- JSON placement documents with `{{token}}` syntax
- Token definitions specify type, label, validation, defaults
- VDP substitution during batch processing
- Template versioning and activation controls

### Batch Processing
- CSV upload with column mapping to template tokens
- Row-by-row processing with atomic design job creation
- Status tracking: `success`, `failed`, `skipped`
- Error CSV export with reason codes
- Failed item retry capability

## Asset Management

### Upload
Use `POST /api/assets` with `multipart/form-data`:
- Required fields: `designJobId`, `file`
- Supported formats: png, jpg, jpeg, svg, webp
- Max file size: **15 MB**

### Storage
Assets are stored locally:
```
${STORAGE_ROOT}/design-jobs/{designJobId}/{assetId}-{sanitizedFileName}
```

Default `STORAGE_ROOT` is `./storage` and can be configured via environment variable.

### Asset Lifecycle
1. **Upload** - Original file stored with metadata
2. **Normalize** - Convert to export-ready format (optional)
3. **Preview** - Generate thumbnail/preview (optional)
4. **Link** - Associate with design job placement objects

### Cleanup
- Deleting a design job cascade-deletes all associated assets (database + files)
- Manual file deletion from `./storage/design-jobs/*` removes files only (database rows persist unless explicitly deleted)

## Environment Variables

Create `.env` from `.env.example`:

```bash
cp .env.example .env
```

### Required
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/lt316_proof_builder?schema=public"
```

### Optional
```env
# Application name (default: "LT316 Proof Builder")
NEXT_PUBLIC_APP_NAME="LT316 Proof Builder"

# Batch processing limits
BATCH_MAX_ROWS="500"
CSV_MAX_SIZE_BYTES="1048576"
BATCH_CREATE_RATE_LIMIT_PER_MIN="10"

# Placement precision
PLACEMENT_ROUNDING_MM="0.001"

# Asset storage location
STORAGE_ROOT="./storage"

# API auth hardening (disabled by default)
API_AUTH_REQUIRED="false"
API_AUTH_REQUIRED_IN_TEST="false"
API_KEY=""
```

## Development Workflow

### Initial Setup
```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

### Database Migrations
```bash
# Create new migration
npm run prisma:migrate

# Reset database (destructive)
npm run prisma:migrate reset -- --force
npm run prisma:seed

# Deploy migrations (production)
npm run prisma:deploy
```

### Testing
```bash
npm test                    # All tests
npm run test:watch          # Watch mode
npm run test -- <pattern>   # Specific tests
```

### Code Quality
```bash
npm run lint                # ESLint check
npm run build               # Production build test
```
