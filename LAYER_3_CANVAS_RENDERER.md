# Canvas Rendering Implementation - Layer 3.0 (Part 1)

## What was built

### 1. CanvasRenderer Component
**File**: `src/components/editor/CanvasRenderer.tsx`

A high-performance 2D canvas renderer for displaying uploaded assets (images and SVGs) with full interaction support.

**Features:**
- **Asset rendering** — Display images and SVGs at specified position, size, rotation, opacity
- **Grid & centerlines** — Visual reference with configurable grid spacing
- **Selection box** — Blue dashed box around selected asset with resize handles
- **Drag-to-move** — Click and drag assets to reposition
- **Resize handles** — 4 corner handles (NW, NE, SW, SE) for proportional or free resizing
- **Cursor hints** — Shows grab/resize cursors based on interaction context
- **Rotation support** — Renders rotated assets with proper transform origin

**Props:**
```typescript
type Props = {
  canvasSize: { widthMm: number; heightMm: number };
  assets: CanvasAsset[];
  selectedAssetId?: string;
  mmScale?: number; // pixels per mm (default: 3)
  gridEnabled?: boolean;
  gridSpacingMm?: number;
  showCenterlines?: boolean;
  onAssetSelect?: (assetId: string) => void;
  onAssetMove?: (assetId: string, xMm: number, yMm: number) => void;
  onAssetResize?: (assetId: string, widthMm: number, heightMm: number) => void;
  onAssetRotate?: (assetId: string, rotationDeg: number) => void;
};
```

**Performance:**
- Uses native Canvas 2D API (fastest for this use case)
- Lazy loads images and SVGs
- SVG rendering via serialization to data URL
- Single render loop with efficient transforms

## Next steps to integrate

### Update EditorClient.tsx
Add the import:
```typescript
import CanvasRenderer from "./CanvasRenderer";
```

Replace the 2D canvas section (around line 399-426) with:
```typescript
<section className="rounded border bg-white p-3">
  <h2 className="mb-2 font-semibold">2D Unwrapped Canvas</h2>
  <CanvasRenderer
    canvasSize={{ widthMm: derived.zone.widthMm, heightMm: derived.zone.heightMm }}
    assets={activeAsset ? [{
      id: activeAsset.id,
      type: activeAsset.mime?.includes('svg') ? 'svg' : 'image' as const,
      url: activeAsset.url,
      xMm: store.placement.offsetXMm,
      yMm: store.placement.offsetYMm,
      widthMm: store.placement.widthMm,
      heightMm: store.placement.heightMm,
      rotationDeg: store.placement.rotationDeg,
      opacity: 1
    }] : []}
    selectedAssetId={activeAsset?.id}
    mmScale={3}
    gridEnabled={true}
    gridSpacingMm={5}
    showCenterlines={true}
    onAssetMove={(id, x, y) => store.patchPlacement({ offsetXMm: x, offsetYMm: y })}
    onAssetResize={(id, w, h) => store.patchPlacement({ widthMm: w, heightMm: h })}
  />
</section>
```

## Testing checklist
- [ ] Upload an image asset
- [ ] Drag asset around the canvas
- [ ] Resize asset using corner handles
- [ ] Verify rotation changes on canvas
- [ ] Test grid and centerline visibility
- [ ] Check opacity rendering

## Known limitations (TODO)
- Rotation via handles not yet implemented (uses onAssetRotate callback)
- SVG rendering may be slow for complex SVGs
- No keyboard shortcuts for nudging
- No multi-select support
- AABB collision detection doesn't account for rotation (good enough for MVP)

## Performance notes
- Canvas renders on every asset or store change
- SVG rendering creates new Image objects each frame (optimize later if needed)
- Loaded images cached in state to prevent re-fetching

## What's next
1. **Real 3D texture mapping** — Apply 2D design to 3D cylinder with seam visualization
2. **Preflight visualization** — Show safe zones, out-of-bounds highlighting
3. **Multi-object support** — Render multiple assets at different layers
