param(
  [switch]$Apply
)

$ErrorActionPreference = "Stop"

Write-Host "[branch:clean] Fetching and pruning remotes..."
git fetch --all --prune | Out-Null

$defaultRef = "origin/main"
$headRef = git symbolic-ref refs/remotes/origin/HEAD 2>$null
if ($headRef -and $headRef.Trim()) {
  $headRef = $headRef.Trim()
  if ($headRef -match '^refs/remotes/(.+)$') {
    $defaultRef = $Matches[1]
  } else {
    $defaultRef = $headRef
  }
}

$defaultBranch = $defaultRef -replace '^origin/', ''
$currentBranch = git branch --show-current

$protectedLocal = @($defaultBranch, "main", "DEV", "dev", $currentBranch) | Sort-Object -Unique
$protectedRemote = @("origin/HEAD", "origin/$defaultBranch", "origin/main", "origin/DEV", "origin/dev") | Sort-Object -Unique

$localMerged = git branch --merged $defaultRef |
  ForEach-Object { $_.Replace('*', '').Trim() } |
  Where-Object { $_ -and -not ($protectedLocal -contains $_) }

$remoteMerged = git branch -r --merged $defaultRef |
  ForEach-Object { $_.Trim() } |
  Where-Object { $_ -and $_ -notmatch '->' -and -not ($protectedRemote -contains $_) }

Write-Host "[branch:clean] Default branch: $defaultBranch"
Write-Host "[branch:clean] Local merged candidates: $($localMerged.Count)"
foreach ($branchName in $localMerged) {
  Write-Host "  - $branchName"
}

Write-Host "[branch:clean] Remote merged candidates: $($remoteMerged.Count)"
foreach ($refName in $remoteMerged) {
  Write-Host "  - $refName"
}

if (-not $Apply) {
  Write-Host "[branch:clean] Dry run only. Re-run with -Apply to delete listed branches."
  return
}

Write-Host "[branch:clean] Deleting merged local branches..."
foreach ($branchName in $localMerged) {
  git branch -d $branchName | Out-Null
  Write-Host "  deleted local: $branchName"
}

Write-Host "[branch:clean] Deleting merged remote branches..."
foreach ($refName in $remoteMerged) {
  $remoteBranch = $refName -replace '^origin/', ''
  git push origin --delete $remoteBranch | Out-Null
  Write-Host "  deleted remote: $refName"
}

Write-Host "[branch:clean] Final local branches:"
git branch --sort=-committerdate

Write-Host "[branch:clean] Done."