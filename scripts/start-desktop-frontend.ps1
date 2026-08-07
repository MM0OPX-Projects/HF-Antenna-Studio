$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$frontendRoot = Join-Path $repoRoot "frontend"

Push-Location $frontendRoot
try {
    & node ".\scripts\check-wasm.mjs"
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    $env:VITE_ENGINE = "wasm"
    & npm run dev -- --host 127.0.0.1 --port 5173
    exit $LASTEXITCODE
} finally {
    Pop-Location
}
