# Studio (DEV-only)

Studio is an isolated layout editor at `/studio` for block-based layout JSON editing.

## Safety scope

- Studio is only available when `STUDIO_ENABLED=true`.
- Password gate requires `STUDIO_PASSWORD`.
- All write APIs require CSRF header `x-studio-csrf`.
- AI only proposes layout JSON; it **does not** modify source files.

## Run locally

```bash
docker compose up --build studio-ai
npm run dev
```

Set env values:

```env
STUDIO_ENABLED=true
STUDIO_PASSWORD=dev-password
STUDIO_AI_URL=http://localhost:8010
```

## Studio checks

```bash
npm run studio:check
python -m venv .venv && source .venv/bin/activate
pip install -r services/studio-ai/requirements.txt
ruff check services/studio-ai
mypy services/studio-ai/app
pytest services/studio-ai/tests -q
```

## Add a new block type safely

1. Add a new block props schema in `src/studio/types.ts`.
2. Extend `studioBlockSchema` discriminated union with the new type.
3. Register defaults + schema in `src/studio/registry.ts`.
4. Add rendering branch in `src/studio/BlockRenderer.tsx`.
5. Update Python `services/studio-ai/app/models.py` allowlist and props validator.
