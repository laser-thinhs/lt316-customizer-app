# Connecting CodeX AI to Docker

## Overview
CodeX AI can be integrated with Docker to:
- Run AI models in isolated containers
- Deploy AI services as microservices
- Scale AI workloads with orchestration
- Use Docker Desktop for local development

## Methods

### 1. **Docker Desktop Integration (Easiest)**

If you have Docker Desktop installed:

```bash
# Verify Docker is running
docker ps

# Pull a CodeX AI image (if available)
docker pull codexai/codex:latest

# Run CodeX AI container
docker run -d --name codexai \
  -p 8000:8000 \
  -e OPENAI_API_KEY=your-key-here \
  codexai/codex:latest
```

### 2. **Using Docker Compose**

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  codexai:
    image: codexai/codex:latest
    container_name: codexai-dev
    ports:
      - "8000:8000"
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - LOG_LEVEL=debug
    volumes:
      - ./models:/app/models
      - ./data:/app/data
    networks:
      - codexai-network

  # Your customizer app
  customizer:
    build: .
    container_name: customizer-app
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/customizer
      - CODEXAI_URL=http://codexai:8000
    depends_on:
      - codexai
    networks:
      - codexai-network

networks:
  codexai-network:
    driver: bridge
```

Run with:
```bash
docker compose up -d
```

### 3. **Connect via API from Your App**

In your Next.js app, create an API route:

```typescript
// src/pages/api/ai/analyze.ts
import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { imageData, prompt } = req.body;

    const response = await fetch(
      process.env.CODEXAI_URL || "http://localhost:8000"
    ).then((r) => r.json());

    res.status(200).json({ result: response });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed" });
  }
}
```

### 4. **Environment Variables**

Create `.env.local`:

```env
# CodeX AI
CODEXAI_URL=http://localhost:8000
CODEXAI_API_KEY=your-api-key
OPENAI_API_KEY=your-openai-key

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/customizer
```

### 5. **Dockerfile for Your Customizer App with CodeX AI**

```dockerfile
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:18-alpine AS builder
WORKDIR /app
COPY . .
COPY --from=deps /app/node_modules ./node_modules
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

USER nextjs
EXPOSE 3000

CMD ["npm", "start"]
```

## Quick Start

### Local Development:

```bash
# 1. Start Docker Desktop (or Docker daemon)

# 2. Run your customizer app with Docker Compose
cd /path/to/lt316-customizer-app
docker compose up -d

# 3. Access your app
# http://localhost:3000

# 4. Check logs
docker compose logs -f customizer
```

### Production Deployment:

```bash
# Build image
docker build -t customizer-app:latest .

# Run with CodeX AI
docker run -d --name customizer \
  -p 3000:3000 \
  -e CODEXAI_URL=http://codexai:8000 \
  -e OPENAI_API_KEY=your-key \
  customizer-app:latest
```

## Troubleshooting

### Container won't start:
```bash
docker logs customizer-app
```

### Can't reach CodeX AI from app:
```bash
# Use docker network to connect
docker network ls
docker inspect <network-name>
```

### Port conflicts:
```bash
# Change port in docker-compose.yml or use different port
docker run -p 9000:3000 customizer-app:latest
```

## Architecture

```
┌─────────────────────────────────────┐
│     Docker Desktop                  │
│  ┌───────────────────────────────┐  │
│  │  codexai-network              │  │
│  │  ┌─────────┐  ┌────────────┐  │  │
│  │  │ CodeX   │  │ Customizer │  │  │
│  │  │ AI      │←→│ App        │  │  │
│  │  │ :8000   │  │ :3000      │  │  │
│  │  └─────────┘  └────────────┘  │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

## Next Steps

1. **Install Docker Desktop** if you haven't: https://www.docker.com/products/docker-desktop
2. **Add CodeX AI service** to your docker-compose.yml
3. **Create API routes** in your app to call CodeX AI
4. **Test locally** with `docker compose up`
5. **Deploy to production** using Docker registries (Docker Hub, ECR, GCR)

## Resources

- Docker docs: https://docs.docker.com/
- Docker Compose: https://docs.docker.com/compose/
- CodeX AI docs: Check your CodeX AI provider's documentation
