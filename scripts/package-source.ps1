param(
    [string]$OutputDirectory
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$solverRoot = Join-Path $repoRoot "wasm\nec2c"

if (-not $OutputDirectory) {
    $OutputDirectory = Join-Path $repoRoot "release-artifacts"
}
$OutputDirectory = [System.IO.Path]::GetFullPath($OutputDirectory)

$version = (Get-Content -Raw -LiteralPath (Join-Path $repoRoot "VERSION")).Trim()
if ($version -notmatch '^\d+\.\d+\.\d+$') {
    throw "VERSION is not a semantic release version: $version"
}

$applicationCommit = (& git -C $repoRoot rev-parse HEAD).Trim()
$treeEntry = (& git -C $repoRoot ls-tree HEAD wasm/nec2c).Trim()
if ($treeEntry -notmatch '^160000 commit ([0-9a-f]{40})\s+wasm/nec2c$') {
    throw "Unable to resolve the pinned wasm/nec2c Git link from $applicationCommit."
}
$expectedSolverCommit = $Matches[1]
$actualSolverCommit = (& git -C $solverRoot rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $actualSolverCommit -ne $expectedSolverCommit) {
    throw "Solver checkout $actualSolverCommit does not match pinned commit $expectedSolverCommit."
}

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$temporaryBase = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
$temporaryRoot = Join-Path $temporaryBase ("hfas-source-" + [Guid]::NewGuid().ToString("N"))
if (-not $temporaryRoot.StartsWith($temporaryBase, [System.StringComparison]::OrdinalIgnoreCase) -or
    -not ([System.IO.Path]::GetFileName($temporaryRoot)).StartsWith("hfas-source-", [System.StringComparison]::Ordinal)) {
    throw "Refusing unsafe temporary source path: $temporaryRoot"
}
$archiveRootName = "hf-antenna-studio-$version-source"
$archiveRoot = Join-Path $temporaryRoot $archiveRootName
$applicationTar = Join-Path $temporaryRoot "application.tar"
$solverTar = Join-Path $temporaryRoot "solver.tar"

try {
    New-Item -ItemType Directory -Force -Path $archiveRoot | Out-Null
    & git -C $repoRoot archive --format=tar --output=$applicationTar HEAD
    if ($LASTEXITCODE -ne 0) { throw "Unable to archive application source." }
    & tar -xf $applicationTar -C $archiveRoot
    if ($LASTEXITCODE -ne 0) { throw "Unable to extract application source archive." }

    $expandedSolverRoot = Join-Path $archiveRoot "wasm\nec2c"
    New-Item -ItemType Directory -Force -Path $expandedSolverRoot | Out-Null
    & git -C $solverRoot archive --format=tar --output=$solverTar HEAD
    if ($LASTEXITCODE -ne 0) { throw "Unable to archive pinned solver source." }
    & tar -xf $solverTar -C $expandedSolverRoot
    if ($LASTEXITCODE -ne 0) { throw "Unable to extract pinned solver source archive." }
    if (-not (Test-Path -LiteralPath (Join-Path $expandedSolverRoot "COPYING")) -or
        -not (Test-Path -LiteralPath (Join-Path $expandedSolverRoot "nec2c.c")) -or
        -not (Test-Path -LiteralPath (Join-Path $expandedSolverRoot "configure.ac"))) {
        throw "Expanded corresponding source is missing required solver content."
    }

    $manifest = @(
        "HF Antenna Studio corresponding source"
        "Version: $version"
        "Application commit: $applicationCommit"
        "Expanded solver path: wasm/nec2c"
        "Solver commit: $actualSolverCommit"
        "Build instructions: docs/INSTALLATION.md and docs/WINDOWS_PACKAGING.md"
    ) -join "`r`n"
    [System.IO.File]::WriteAllText(
        (Join-Path $archiveRoot "SOURCE_MANIFEST.txt"),
        $manifest + "`r`n",
        [System.Text.UTF8Encoding]::new($false)
    )

    $destination = Join-Path $OutputDirectory "hf-antenna-studio-$version-corresponding-source.zip"
    if (Test-Path -LiteralPath $destination) {
        Remove-Item -LiteralPath $destination -Force
    }
    Compress-Archive -LiteralPath $archiveRoot -DestinationPath $destination -CompressionLevel Optimal
    $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $destination).Hash
    $hashLine = "$hash  $([System.IO.Path]::GetFileName($destination))`r`n"
    [System.IO.File]::WriteAllText(
        "$destination.sha256",
        $hashLine,
        [System.Text.UTF8Encoding]::new($false)
    )

    Write-Output "Corresponding source: $destination"
    Write-Output "Application commit: $applicationCommit"
    Write-Output "Solver commit: $actualSolverCommit"
    Write-Output "SHA-256: $hash"
}
finally {
    if (Test-Path -LiteralPath $temporaryRoot) {
        Remove-Item -LiteralPath $temporaryRoot -Recurse -Force
    }
}
