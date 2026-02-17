# LT316 Proof Builder - Feature Overview

This document provides a comprehensive overview of the features and workflows implemented in the LT316 Proof Builder application.

## Table of Contents
- [Core Concepts](#core-concepts)
- [User Workflows](#user-workflows)
- [Data Model](#data-model)
- [Feature Breakdown by Layer](#feature-breakdown-by-layer)

## Core Concepts

### Cylindrical Product Proofing
The LT316 Proof Builder is designed for creating and managing laser engraving proofs on cylindrical products (like bottles, tumblers, etc.). The system handles:
- Product geometry (diameter, height, engravable zones)
- Cylindrical wrap calculations
- Safe zone validation
- Export-ready SVG generation for laser engraving machines

### Design Jobs
A **Design Job** is the central entity representing a single proof/design for a specific product. Each job contains:
- Reference to a product profile (physical dimensions)
- Reference to a machine profile (laser settings)
- Placement JSON (object layout and design elements)
- Status tracking (draft → approved → exported)
- Associated assets (images, vectors)

### Placement JSON (v2)
The placement document is a versioned JSON structure containing:
- **Canvas**: Defines the engravable area in millimeters
- **Objects**: Heterogeneous array of design elements:
  - `text_line`: Single-line text with font, size, alignment
  - `text_block`: Multi-line text with wrapping
  - `text_arc`: Text following an arc path
  - `image`: Raster image with positioning and scaling
  - `vector`: SVG path data for logos/graphics
- **Machine settings**: Laser power, speed, frequency thresholds

### Templates & VDP
Templates enable variable data printing workflows:
- Define reusable layouts with `{{token}}` placeholders
- Token definitions specify validation rules and defaults
- Apply templates with different values to create job variants
- Batch process CSV files to create hundreds of jobs automatically

## User Workflows

### 1. Single Design Job Creation
```
Home Page → Select Product → Create Job → Edit Placement → Upload Assets → Preflight → Export
```
1. User selects a product profile (e.g., "20oz Tumbler")
2. System creates a draft design job with default placement
3. User edits placement in the visual editor:
   - Add/remove text elements
   - Upload and position images
   - Adjust dimensions and spacing
4. System auto-saves changes with retry logic
5. User runs preflight validation
6. User exports the final SVG and manifest

### 2. Template-Based Design
```
Templates → Create Template → Define Tokens → Save → Apply to Jobs
```
1. User creates a template with variable placeholders
2. Defines tokens (e.g., `{{name}}`, `{{date}}`, `{{logo}}`)
3. Saves template with preview
4. Applies template to new jobs with specific values
5. System substitutes tokens and creates ready-to-export jobs

### 3. Batch Processing (CSV)
```
Templates → Select Template → Upload CSV → Map Columns → Process → Review Results
```
1. User prepares CSV with variable data (columns for each token)
2. Uploads CSV file to batch endpoint
3. Maps CSV columns to template tokens
4. System processes each row:
   - Creates design job
   - Substitutes token values
   - Generates placement
   - Validates geometry
5. User reviews batch results (success/failed items)
6. Optionally retries failed items
7. Bulk exports all successful jobs

## Data Model

### Core Entities

```
ProductProfile (Physical product specs)
├── diameterMm
├── heightMm
├── engraveZoneWidthMm
├── engraveZoneHeightMm
└── defaultSettingsProfile (JSON)

MachineProfile (Laser engraver specs)
├── laserType
├── lens
├── powerDefault
├── speedDefault
└── frequencyDefault

DesignJob (Single proof/design)
├── productProfileId
├── machineProfileId
├── status (draft|approved|exported)
├── placementJson (v2 document)
├── placementHash (change detection)
├── templateId (optional)
└── batchRunItemId (optional)

Asset (Images, vectors)
├── designJobId
├── kind (original|normalized|preview)
├── filePath
├── widthPx, heightPx
└── mimeType

Template (Reusable layout)
├── name, slug
├── placementDocument (with {{tokens}})
├── tokenDefinitions (validation rules)
├── version, isActive
└── templateHash

BatchRun (CSV batch job)
├── templateId
├── status (queued|processing|completed|failed|partial)
├── totalRows, successCount, failCount
├── csvFileName
└── items[] (BatchRunItem)

ExportArtifact (Output files)
├── designJobId
├── kind (manifest|svg)
├── filePath
└── metadata (JSON)
```

### Relationships
- **ProductProfile** → many **DesignJobs**
- **MachineProfile** → many **DesignJobs**
- **DesignJob** → many **Assets** (cascade delete)
- **DesignJob** → many **ExportArtifacts** (cascade delete)
- **Template** → many **DesignJobs** (via templateId)
- **Template** → many **BatchRuns**
- **BatchRun** → many **BatchRunItems** → one **DesignJob**

## Feature Breakdown by Layer

### Layer 1: Foundation
**Goal**: Basic CRUD operations and database setup

**Features**:
- Product profile management
- Machine profile management
- Design job creation with basic placement
- Health endpoint with database connectivity check
- Prisma schema and migrations

**Tech Stack Established**:
- Next.js 15 (App Router)
- PostgreSQL via Prisma
- Zod validation
- TypeScript throughout

### Layer 2.1: Text Tooling
**Goal**: Comprehensive text handling and placement v2 schema

**Features**:
- Placement v2 schema with versioned documents
- Legacy placement auto-upgrade (v1 → v2)
- Text object types: `text_line`, `text_block`, `text_arc`
- Font management API (`GET /api/fonts`)
- Text-to-vector outline conversion (`POST /api/text/outline`)
- Typography controls (font family, size, weight, line height, kerning)
- Text layout engine with millimeter-precision

**Placement v2 Objects**:
```typescript
{
  id: string;
  kind: "text_line" | "text_block" | "text_arc" | "image" | "vector";
  x: number;        // millimeters from origin
  y: number;        // millimeters from origin
  rotation?: number; // degrees
  // ... kind-specific properties
}
```

### Layer 2.2: Templates & Batch Processing
**Goal**: Enable mass production workflows with variable data

**Features**:
- Template CRUD operations
- Token system with validation schemas
- Token types: string, number, date, color, image_url
- CSV upload and parsing
- Batch run processing engine
- Row-by-row atomic job creation
- Error tracking and reporting
- Failed item retry mechanism
- Error CSV export
- Rate limiting on batch creation

**Template Token Syntax**:
```json
{
  "placementDocument": {
    "objects": [
      {
        "kind": "text_line",
        "content": "{{customer_name}}"
      }
    ]
  },
  "tokenDefinitions": [
    {
      "key": "customer_name",
      "label": "Customer Name",
      "type": "string",
      "required": true,
      "validation": { "maxLength": 50 }
    }
  ]
}
```

**CSV Example**:
```csv
customer_name,order_date,quantity
John Smith,2026-02-15,100
Jane Doe,2026-02-16,250
```

### Layer 2.3: Preflight & Export
**Goal**: Validate designs and generate production-ready outputs

**Features**:
- Preflight validation engine
- Safe zone boundary checking
- Object overlap detection
- Export artifact generation
  - Manifest JSON (metadata, settings, BOM)
  - SVG files (device-ready format)
- Export pack creation (ZIP with all artifacts)
- Bulk export endpoint for multiple jobs
- Export status tracking
- Validation warnings vs. errors

**Preflight Checks**:
- Text not outside engravable zone
- Images within safe boundaries
- No critical overlaps between objects
- Minimum spacing requirements met
- Font availability verification
- Asset resolution checks

**Export Manifest Structure**:
```json
{
  "jobId": "...",
  "product": { "sku": "...", "diameterMm": 80, ... },
  "machine": { "power": 50, "speed": 300, ... },
  "objects": [...],
  "exportTimestamp": "2026-02-16T...",
  "preflightStatus": "pass"
}
```

### Layer 2.4: Asset Management
**Goal**: Handle image and vector asset uploads with normalization

**Features**:
- Multi-part file upload endpoint
- Local filesystem storage under `./storage`
- Asset kind tracking (original, normalized, preview)
- Supported formats: PNG, JPG, JPEG, SVG, WEBP
- File size validation (max 15MB)
- Asset normalization for export
- Image metadata extraction (dimensions, mime type)
- Filename sanitization
- Cascade deletion with design jobs
- Asset-to-placement-object linking

**Storage Structure**:
```
./storage/
└── design-jobs/
    └── {designJobId}/
        ├── {assetId}-original.png
        ├── {assetId}-normalized.png
        └── {assetId}-preview.png
```

### Layer 2.5: Wrap Preflight & SVG Export
**Goal**: Handle cylindrical projection and device-ready SVG output

**Features**:
- Cylindrical wrap calculation for text and objects
- Arc length projection (flat → wrapped)
- SVG export with wrap-aware coordinates
- Device-specific SVG formatting
- Enhanced preflight for wrap scenarios
- Distortion compensation
- Seam reference alignment

**Wrap Calculation**:
- Objects on a flat canvas are projected onto cylinder surface
- X-coordinates converted to arc angles: `angle = x / radius`
- Text along arc paths use actual wrapped dimensions
- Safe zones account for seam reference point

### Layer 2.6: Autosave & Recovery
**Goal**: Improve reliability and user experience with automatic saving

**Features**:
- Placement autosave hook (`useAutosavePlacement`)
- Exponential backoff retry logic
- Placement hash-based change detection
- Local draft recovery from browser storage
- Debounced save triggers
- Optimistic UI updates with rollback
- Audit trail service for tracking changes
- Version history tracking

**Autosave Flow**:
1. User edits placement in UI
2. Change detected by hash comparison
3. Debounce timer (500ms)
4. Save triggered with retry logic
5. Success: Update hash and timestamp
6. Failure: Retry with exponential backoff (3 attempts)
7. Final failure: Persist to local storage

**Audit Trail**:
```typescript
{
  designJobId: string;
  action: "placement_updated" | "status_changed" | "exported";
  timestamp: Date;
  metadata: { previousHash?, newHash?, ... }
}
```

## API Usage Examples

### Create a Design Job
```bash
POST /api/design-jobs
Content-Type: application/json

{
  "productProfileId": "cuid...",
  "machineProfileId": "cuid...",
  "placementJson": {
    "version": 2,
    "canvas": { "widthMm": 200, "heightMm": 80 },
    "objects": []
  }
}
```

### Upload an Asset
```bash
POST /api/assets
Content-Type: multipart/form-data

designJobId: cuid...
file: (binary)
```

### Apply Template to Job
```bash
POST /api/templates/{templateId}/apply
Content-Type: application/json

{
  "designJobId": "cuid...",
  "tokenValues": {
    "customer_name": "John Smith",
    "order_date": "2026-02-15"
  }
}
```

### Process CSV Batch
```bash
POST /api/batches
Content-Type: multipart/form-data

templateId: cuid...
file: batch.csv
productProfileId: cuid...
machineProfileId: cuid...
```

### Run Preflight
```bash
POST /api/design-jobs/{id}/preflight

# Response:
{
  "status": "pass",
  "checks": [
    { "check": "safe_zone", "status": "pass" },
    { "check": "object_overlap", "status": "warn", "message": "..." }
  ]
}
```

### Export Job
```bash
POST /api/design-jobs/{id}/export

# Returns ZIP with:
# - manifest.json
# - design.svg
```

## Configuration

### Environment Variables
All configuration via `.env` file:
- `DATABASE_URL` - PostgreSQL connection string
- `STORAGE_ROOT` - Asset storage directory (default: `./storage`)
- `BATCH_MAX_ROWS` - Max CSV rows per batch (default: 500)
- `CSV_MAX_SIZE_BYTES` - Max CSV file size (default: 1MB)
- `PLACEMENT_ROUNDING_MM` - Precision for coordinates (default: 0.001mm)

### Product Profiles
Seeded via `prisma/seed.ts`:
- Physical dimensions (diameter, height)
- Engravable zone specifications
- Tool outline SVG path (for preview rendering)
- Default machine settings

### Machine Profiles
Seeded via `prisma/seed.ts`:
- Laser type and lens specifications
- Default power/speed/frequency values
- Rotary mode settings

## Testing Strategy

### Unit Tests
- Schema validation (Zod)
- Utility functions (geometry, text layout, csv parsing)
- Domain logic (cylinder math, safe zones)

### Integration Tests
- API route handlers
- Database operations (Prisma)
- File upload/storage
- Batch processing workflows

### E2E Tests (Playwright)
- Full user workflows
- Editor interactions
- Upload and placement
- Template application

**Current Coverage**: 23 test suites, 62 tests, all passing

## Future Considerations

### Potential Layer 2.7+ Features
- **Cloud Storage**: S3/Azure Blob integration for assets
- **User Authentication**: Auth0 or NextAuth.js
- **Permissions & Teams**: Multi-tenant workspace model
- **Real-time Collaboration**: WebSocket-based shared editing
- **3D Preview**: Three.js cylinder preview with texture mapping
- **PDF Export**: Additional export format for client proofs
- **Artwork Library**: Reusable asset library across jobs
- **Advanced Typography**: OpenType features, ligatures, custom fonts
- **Color Management**: Pantone/CMYK/spot color support
- **Machine Profiles**: Per-material laser settings presets
- **Approval Workflow**: Client review → feedback → approval chain
- **Production Scheduling**: Queue management for manufacturing
- **Analytics Dashboard**: Job metrics, usage stats, error tracking

### Scalability Improvements
- Background job processing (Bull/BullMQ)
- Redis caching for frequent queries
- CDN for asset delivery
- Database read replicas
- Horizontal scaling of API instances

### Developer Experience
- API documentation (OpenAPI/Swagger)
- SDK/client libraries
- Webhooks for external integrations
- GraphQL API alternative
- CLI tool for batch operations
