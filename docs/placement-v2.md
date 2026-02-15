# Placement JSON v2 (Layer 2.1)

`placementJson` now uses a versioned document:

- `version: 2`
- `canvas` in millimeters
- `machine` engraving thresholds
- `objects` heterogeneous array (`image`, `vector`, `text_line`, `text_block`, `text_arc`)

## Migration

Legacy payloads (`widthMm`, `heightMm`, `offsetXMm`, `offsetYMm`, `rotationDeg`, `anchor`) are auto-upgraded on create/update/read.
The upgrader preserves dimensions/transform and creates a default image placeholder object (`id=legacy-image-slot`).

## Derived outlines

`POST /api/text/outline` generates a non-destructive vector object linked to source text object:

- `sourceTextObjectId`
- `sourceMeta.fontHash`
- `sourceMeta.conversionTimestamp`
- `sourceMeta.toleranceMm`

Current implementation emits deterministic placeholder geometry for safe persistence and later export integration.
