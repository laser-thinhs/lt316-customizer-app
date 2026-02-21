$ErrorActionPreference = "Stop"

function Write-Step([string]$message) {
  Write-Host "[dev:recover] $message"
}

function Ensure-DockerEngine {
  try {
    docker info *> $null
    return
  } catch {
    $desktopPath = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    if (Test-Path $desktopPath) {
      Write-Step "Starting Docker Desktop..."
      Start-Process -FilePath $desktopPath | Out-Null
    } else {
      throw "Docker engine is not reachable and Docker Desktop was not found."
    }
  }

  Write-Step "Waiting for Docker engine..."
  for ($i = 1; $i -le 36; $i++) {
    try {
      docker info *> $null
      Write-Step "Docker engine is ready."
      return
    } catch {
      Start-Sleep -Seconds 5
    }
  }

  throw "Docker engine did not become ready in time."
}

Write-Step "Stopping processes bound to port 3000..."
$conns = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($conns) {
  $procIds = $conns | Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($procId in $procIds) {
    if ($procId -gt 0) {
      try {
        Stop-Process -Id $procId -Force -ErrorAction Stop
        Write-Step "Stopped process $procId"
      } catch {
        Write-Step "Could not stop process $procId"
      }
    }
  }
} else {
  Write-Step "No process currently bound to port 3000."
}

if (Test-Path .next) {
  Write-Step "Clearing .next cache..."
  try {
    Remove-Item -Recurse -Force .next -ErrorAction Stop
  } catch {
    Write-Step "Initial cache removal failed; stopping Node.js processes and retrying..."
    Get-Process node -ErrorAction SilentlyContinue | ForEach-Object {
      try {
        Stop-Process -Id $_.Id -Force -ErrorAction Stop
      } catch {
        # Ignore individual stop errors.
      }
    }
    Start-Sleep -Seconds 1
    Remove-Item -Recurse -Force .next -ErrorAction Stop
  }
}

Ensure-DockerEngine

Write-Step "Handing off to dev:up (db + migrations + dev server)..."
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev-up.ps1
