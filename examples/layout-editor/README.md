# Layout Editor Prototype

This is a safe, standalone prototype of a Shopify-style theme customizer.

## Run

1. Open `examples/layout-editor/index.html` directly in your browser.
2. Use **Add section** to insert `Hero`, `Rich Text`, `Image + Text`, or `Button Row` sections.
3. Drag section cards on the left panel to reorder.
4. Click a section to edit settings in the right panel and see live preview updates in the center panel.
5. Use **Save/Load** for `localStorage`, and **Export/Import JSON** for file-based data transfer.

## Data shape

```json
{
  "slug": "home",
  "sections": [
    {
      "id": "hero_ab12cd34",
      "type": "hero",
      "hidden": false,
      "settings": {}
    }
  ]
}
```

Local storage keys are saved as `layout:<slug>`.
