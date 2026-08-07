param(
    [switch]$OfflineInstaller,
    [switch]$SkipDependencyInstall
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$frontendRoot = Join-Path $repoRoot "frontend"
$tauriRoot = Join-Path $repoRoot "src-tauri"
$iconSource = Join-Path $frontendRoot "public\favicon.svg"
$iconOutput = Join-Path $tauriRoot "icons"

foreach ($command in @("node", "npm", "cargo", "rustc")) {
    if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
        throw "$command is required to build the Windows package. See docs/WINDOWS_PACKAGING.md."
    }
}

& (Join-Path $PSScriptRoot "check-package-version.ps1")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if (-not $SkipDependencyInstall) {
    Push-Location $frontendRoot
    try {
        & npm ci
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    } finally {
        Pop-Location
    }
}

Push-Location $tauriRoot
try {
    & cargo tauri icon $iconSource --output $iconOutput
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

    $arguments = @("tauri", "build", "--bundles", "nsis")
    if ($OfflineInstaller) {
        $arguments += @("--config", "tauri.offline.conf.json")
    }
    & cargo @arguments
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
    Pop-Location
}

$installers = Get-ChildItem -LiteralPath (Join-Path $tauriRoot "target\release\bundle\nsis") -Filter "*-setup.exe" -File
if ($installers.Count -ne 1) {
    throw "Expected exactly one NSIS installer, found $($installers.Count)."
}

$installer = $installers[0]
$metadata = [ordered]@{
    product = "HF Antenna Studio"
    version = (Get-Content -LiteralPath (Join-Path $repoRoot "VERSION") -Raw).Trim()
    file = $installer.Name
    bytes = $installer.Length
    sha256 = (Get-FileHash -LiteralPath $installer.FullName -Algorithm SHA256).Hash
    webviewMode = if ($OfflineInstaller) { "offlineInstaller" } else { "embedBootstrapper" }
    solver = "KJ7LNW nec2c WebAssembly v1.3.3 source commit 55be1e0e3fe5ee9dad4ce6050711450d19c562fd"
}
$manifestPath = Join-Path $installer.DirectoryName "package-manifest.json"
$metadata | ConvertTo-Json | Set-Content -LiteralPath $manifestPath -Encoding utf8

Write-Host "Windows test installer: $($installer.FullName)"
Write-Host "SHA256: $($metadata.sha256)"
Write-Host "Manifest: $manifestPath"
