$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$expected = (Get-Content -LiteralPath (Join-Path $repoRoot "VERSION") -Raw).Trim()
$frontend = Get-Content -LiteralPath (Join-Path $repoRoot "frontend\package.json") -Raw | ConvertFrom-Json
$tauri = Get-Content -LiteralPath (Join-Path $repoRoot "src-tauri\tauri.conf.json") -Raw | ConvertFrom-Json
$cargoText = Get-Content -LiteralPath (Join-Path $repoRoot "src-tauri\Cargo.toml") -Raw
$cargoVersionMatch = [regex]::Match($cargoText, '(?m)^version\s*=\s*"([^"]+)"')

if (-not $cargoVersionMatch.Success) {
    throw "Could not read the package version from src-tauri/Cargo.toml."
}

$versions = [ordered]@{
    VERSION = $expected
    Frontend = [string]$frontend.version
    Tauri = [string]$tauri.version
    Cargo = $cargoVersionMatch.Groups[1].Value
}

foreach ($entry in $versions.GetEnumerator()) {
    if ($entry.Value -ne $expected) {
        throw "Version mismatch: $($entry.Key) is $($entry.Value), expected $expected."
    }
}

Write-Host "Package versions are synchronized at $expected."
