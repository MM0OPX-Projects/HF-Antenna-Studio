$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$frontendRoot = Join-Path $repoRoot "frontend"

& (Join-Path $PSScriptRoot "check-package-version.ps1")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Push-Location $frontendRoot
try {
    & node ".\scripts\check-wasm.mjs"
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    $env:VITE_ENGINE = "wasm"
    & npm run build
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
    Pop-Location
}
