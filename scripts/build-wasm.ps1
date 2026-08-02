[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$EmsdkPath = $env:EMSDK
)

$ErrorActionPreference = "Stop"
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$wasmDirectory = Join-Path $repositoryRoot "wasm"
$solverDirectory = Join-Path $wasmDirectory "nec2c"
$patchPath = Join-Path $wasmDirectory "patches\emscripten-compat.patch"
$buildDirectory = Join-Path $wasmDirectory "build"
$frontendWasmDirectory = Join-Path $repositoryRoot "frontend\public\wasm"

if ([string]::IsNullOrWhiteSpace($EmsdkPath)) {
    throw "Pass -EmsdkPath <path-to-emsdk>, or set the EMSDK environment variable."
}

$resolvedEmsdkPath = (Resolve-Path -LiteralPath $EmsdkPath).Path
$emsdkEnvironment = Join-Path $resolvedEmsdkPath "emsdk_env.ps1"
if (-not (Test-Path -LiteralPath $emsdkEnvironment -PathType Leaf)) {
    throw "Emscripten environment script was not found at $emsdkEnvironment"
}
if (-not (Test-Path -LiteralPath (Join-Path $solverDirectory "nec2c.c") -PathType Leaf)) {
    throw "NEC2C submodule is missing. Run: git submodule update --init --recursive"
}
if (-not (Get-Command cmake -ErrorAction SilentlyContinue)) {
    throw "CMake is required and was not found on PATH."
}
if (-not (Get-Command ninja -ErrorAction SilentlyContinue)) {
    throw "Ninja is required and was not found on PATH."
}

& git -C $solverDirectory diff --quiet --exit-code
if ($LASTEXITCODE -ne 0) {
    throw "The NEC2C submodule has local changes. Restore or preserve them before building."
}

$patchApplied = $false
try {
    & git -C $solverDirectory apply --check $patchPath
    if ($LASTEXITCODE -ne 0) {
        throw "The pinned Emscripten compatibility patch does not apply cleanly."
    }
    & git -C $solverDirectory apply $patchPath
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to apply the Emscripten compatibility patch."
    }
    $patchApplied = $true

    . $emsdkEnvironment

    & emcmake cmake -S $wasmDirectory -B $buildDirectory -G Ninja -DCMAKE_BUILD_TYPE=Release
    if ($LASTEXITCODE -ne 0) { throw "CMake configuration failed." }

    & cmake --build $buildDirectory --parallel
    if ($LASTEXITCODE -ne 0) { throw "NEC2C WebAssembly build failed." }

    New-Item -ItemType Directory -Force -Path $frontendWasmDirectory | Out-Null
    Copy-Item -LiteralPath (Join-Path $buildDirectory "nec2c.js") -Destination $frontendWasmDirectory -Force
    Copy-Item -LiteralPath (Join-Path $buildDirectory "nec2c.wasm") -Destination $frontendWasmDirectory -Force

    Get-FileHash -Algorithm SHA256 -LiteralPath @(
        (Join-Path $frontendWasmDirectory "nec2c.js"),
        (Join-Path $frontendWasmDirectory "nec2c.wasm")
    ) | Format-Table -AutoSize
}
finally {
    if ($patchApplied) {
        & git -C $solverDirectory restore --worktree -- .
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "Could not restore the clean NEC2C submodule worktree after the build."
        }
    }
}
