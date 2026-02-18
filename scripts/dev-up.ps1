$ErrorActionPreference = "Stop"

Write-Host "[dev:up] Ensuring Docker is available..."
$null = docker --version
$null = docker compose version

Write-Host "[dev:up] Starting PostgreSQL container (db)..."
docker compose up -d db | Out-Null

Write-Host "[dev:up] Waiting for DB readiness..."
$ready = $false
for ($i = 1; $i -le 30; $i++) {
  try {
    $probe = docker compose exec -T db pg_isready -U app -d customizer 2>$null
    if ($LASTEXITCODE -eq 0) {
      $ready = $true
      break
    }
  } catch {}
  Start-Sleep -Seconds 1
}

if (-not $ready) {
  throw "Database did not become ready in time. Run 'docker compose logs db' and retry."
}

Write-Host "[dev:up] Applying Prisma migrations..."
npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) {
  throw "Prisma migrate deploy failed."
}

Write-Host "[dev:up] Starting Next.js dev server on http://localhost:3000 ..."
npm run dev
