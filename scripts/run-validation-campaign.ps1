param(
    [string]$EnginePath = "C:\4nec2\exe\nec2dxs11k.exe"
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$manifestPath = Join-Path $repoRoot "validation\campaign\reference-cases.json"
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
    throw "Validation campaign manifest not found: $manifestPath"
}
if (-not (Test-Path -LiteralPath $EnginePath -PathType Leaf)) {
    throw "4NEC2 comparator engine not found: $EnginePath"
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$requiredFamilies = @(
    "free-space-dipole",
    "dipole-over-ground",
    "quarter-wave-vertical",
    "full-wave-loop",
    "delta-loop",
    "two-element-yagi",
    "three-element-yagi",
    "two-element-phased-vertical-array"
)
if ($manifest.schemaVersion -ne 1) {
    throw "Unsupported validation campaign schema: $($manifest.schemaVersion)"
}
foreach ($family in $requiredFamilies) {
    if ($family -notin @($manifest.cases.family)) {
        throw "Validation campaign is missing required family: $family"
    }
}
foreach ($case in $manifest.cases) {
    if ($case.classification -notin @($manifest.allowedClassifications)) {
        throw "Validation case $($case.id) has an invalid discrepancy classification: $($case.classification)"
    }
    if ($case.status -ne "pass") {
        throw "Validation case $($case.id) is recorded as $($case.status), not pass."
    }
    if ([string]::IsNullOrWhiteSpace($case.investigation)) {
        throw "Validation case $($case.id) has no investigation record."
    }
}
$engineHash = (Get-FileHash -LiteralPath $EnginePath -Algorithm SHA256).Hash
if ($engineHash -ne $manifest.comparatorEngine.executableSha256) {
    throw "Comparator hash $engineHash does not match the reviewed campaign hash $($manifest.comparatorEngine.executableSha256)."
}

foreach ($case in $manifest.cases) {
    $fixturePath = Join-Path $repoRoot ($case.fixture -replace '/', '\')
    if (-not (Test-Path -LiteralPath $fixturePath -PathType Leaf)) {
        throw "Campaign fixture is missing for $($case.id): $fixturePath"
    }
    $actualHash = (Get-FileHash -LiteralPath $fixturePath -Algorithm SHA256).Hash
    if ($actualHash -ne $case.deckSha256) {
        throw "Deck hash mismatch for $($case.id): expected $($case.deckSha256), got $actualHash."
    }
}

$comparators = @(
    "compare-dipole-4nec2.ps1",
    "compare-vertical-4nec2.ps1",
    "compare-loop-beams-4nec2.ps1",
    "compare-yagi-4nec2.ps1",
    "compare-phased-arrays-4nec2.ps1"
)

foreach ($comparator in $comparators) {
    $scriptPath = Join-Path $PSScriptRoot $comparator
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $scriptPath -EnginePath $EnginePath
    if ($LASTEXITCODE -ne 0) {
        throw "$comparator failed with exit code $LASTEXITCODE."
    }
}

Write-Host "Validation campaign passed: $($manifest.cases.Count) primary cases, $($comparators.Count) comparator families."
Write-Host "Application solver: $($manifest.applicationEngine.name) $($manifest.applicationEngine.version) at $($manifest.applicationEngine.sourceCommit)"
Write-Host "Comparator: $($manifest.comparatorEngine.name) $($manifest.comparatorEngine.version) SHA256 $engineHash"
