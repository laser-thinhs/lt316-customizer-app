$ErrorActionPreference = "Stop"

Write-Host "[stack:up] Ensuring Docker is available..."
$null = docker --version
$null = docker compose version

Write-Host "[stack:up] Starting Docker services (db, py-api, studio-ai)..."
docker compose up -d db py-api studio-ai | Out-Null

Write-Host "[stack:up] Waiting for DB readiness..."
$dbReady = $false
for ($i = 1; $i -le 90; $i++) {
  try {
    $probe = docker compose exec -T db pg_isready -U app -d customizer 2>$null
    if ($LASTEXITCODE -eq 0 -or ($probe -is [string] -and $probe -match "accepting connections")) {
      $dbReady = $true
      break
    }
  } catch {
    # Continue retrying while container is still starting.
  }
  Start-Sleep -Seconds 1
}

if (-not $dbReady) {
  Write-Host "[stack:up] DB readiness probe failed. Recent db logs:" -ForegroundColor Yellow
  docker compose logs db --tail 40
  throw "Database did not become ready in time."
}

function Wait-HttpHealthy {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name,
    [Parameter(Mandatory = $true)]
    [string]$Url,
    [int]$Attempts = 60
  )

  for ($i = 1; $i -le $Attempts; $i++) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 3
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
        Write-Host "[stack:up] $Name healthy ($($response.StatusCode))"
        return
      }
    } catch {
      # Continue retrying while container app boots.
    }
    Start-Sleep -Seconds 1
  }

  Write-Host "[stack:up] $Name failed health check. Recent logs:" -ForegroundColor Yellow
  docker compose logs --tail 60 $Name
  throw "$Name did not become healthy in time."
}

Wait-HttpHealthy -Name "py-api" -Url "http://127.0.0.1:8000/health"
Wait-HttpHealthy -Name "studio-ai" -Url "http://127.0.0.1:8010/health"

Write-Host "[stack:up] Services ready:"
docker compose ps
