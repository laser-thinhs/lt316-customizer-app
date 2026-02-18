# py-api

FastAPI service for image tracing (PNG/JPG to SVG) used by the Next.js app.

## Run with Docker Compose

From the repository root:

```bash
docker compose up --build
```

Service endpoints:

- `GET http://localhost:8000/health`
- `POST http://localhost:8000/trace`

## Example Trace Request

```bash
curl -X POST \
  -F "file=@/path/to/image.png" \
  -F "mode=trace" \
  -F "simplify=0.4" \
  http://localhost:8000/trace
```

If tracing fails in-container, the service falls back to returning a valid SVG that embeds the source raster image.
