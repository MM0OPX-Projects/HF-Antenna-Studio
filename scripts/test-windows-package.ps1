param(
    [Parameter(Mandatory = $true)]
    [string]$InstallerPath,
    [string]$NodePath = "node"
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$resolvedInstaller = (Resolve-Path -LiteralPath $InstallerPath).Path
$expectedVersion = (Get-Content -LiteralPath (Join-Path $repoRoot "VERSION") -Raw).Trim()
$uninstallRoots = @(
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall",
    "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall",
    "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"
)
$dataRoot = Join-Path $env:LOCALAPPDATA "uk.co.mm0opx.hfantennastudio"
$sentinel = Join-Path $dataRoot "package-uninstall-preservation-sentinel.txt"
$appProcess = $null

function Find-UninstallEntry {
    foreach ($root in $uninstallRoots) {
        if (-not (Test-Path -LiteralPath $root)) { continue }
        $entry = Get-ChildItem -LiteralPath $root | ForEach-Object { Get-ItemProperty -LiteralPath $_.PSPath } |
            Where-Object { $_.DisplayName -eq "HF Antenna Studio" } | Select-Object -First 1
        if ($entry) { return $entry }
    }
    return $null
}

function Executable-FromCommand([string]$command) {
    $quoted = [regex]::Match($command, '^"([^"]+)"')
    if ($quoted.Success) { return $quoted.Groups[1].Value }
    return ($command -split '\s+')[0]
}

function Invoke-PackagedWebViewTest([string]$applicationPath, [string]$phase) {
    $script:appProcess = $null
    $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = "--remote-debugging-port=9222"
    $script:appProcess = Start-Process -FilePath $applicationPath -PassThru
    $deadline = (Get-Date).AddSeconds(30)
    $debugReady = $false
    do {
        Start-Sleep -Milliseconds 500
        try {
            $null = Invoke-RestMethod -Uri "http://127.0.0.1:9222/json/version" -TimeoutSec 2
            $debugReady = $true
        } catch {
            $debugReady = $false
        }
    } while (-not $debugReady -and (Get-Date) -lt $deadline -and -not $script:appProcess.HasExited)
    if (-not $debugReady) { throw "The packaged WebView2 application did not expose its test debugging endpoint." }

    $env:HFAS_CDP_URL = "http://127.0.0.1:9222"
    $env:HFAS_PACKAGE_PHASE = $phase
    $env:HFAS_EXPECTED_VERSION = $expectedVersion
    & $NodePath (Join-Path $repoRoot "frontend\scripts\test-packaged-app.mjs")
    if ($LASTEXITCODE -ne 0) { throw "Packaged application $phase test failed with exit code $LASTEXITCODE." }

    if (-not $script:appProcess.HasExited) {
        Stop-Process -Id $script:appProcess.Id -Force
        $script:appProcess.WaitForExit()
    }
    $script:appProcess = $null
    Start-Sleep -Seconds 1
}

try {
    $signature = Get-AuthenticodeSignature -LiteralPath $resolvedInstaller
    if ($signature.Status -notin @("Valid", "NotSigned")) {
        throw "Unexpected installer signature status: $($signature.Status)"
    }

    $install = Start-Process -FilePath $resolvedInstaller -ArgumentList "/S" -Wait -PassThru
    if ($install.ExitCode -ne 0) { throw "Installer exited with code $($install.ExitCode)." }

    $uninstallEntry = Find-UninstallEntry
    if (-not $uninstallEntry) { throw "HF Antenna Studio uninstall registration was not created." }
    if ([string]$uninstallEntry.DisplayVersion -ne $expectedVersion) {
        throw "Installed version $($uninstallEntry.DisplayVersion) does not match $expectedVersion."
    }

    $uninstaller = Executable-FromCommand ([string]$uninstallEntry.UninstallString)
    if (-not (Test-Path -LiteralPath $uninstaller -PathType Leaf)) {
        throw "Registered uninstaller does not exist: $uninstaller"
    }
    $installDirectory = Split-Path -Parent $uninstaller
    $application = Get-ChildItem -LiteralPath $installDirectory -Filter "HF Antenna Studio.exe" -File -Recurse | Select-Object -First 1
    if (-not $application) { throw "Installed application launcher was not found below $installDirectory." }

    New-Item -ItemType Directory -Path $dataRoot -Force | Out-Null
    Set-Content -LiteralPath $sentinel -Value "Preserve user project data across uninstall." -Encoding utf8

    Invoke-PackagedWebViewTest $application.FullName "initial"

    $logPath = Join-Path $dataRoot "logs\hf-antenna-studio.log"
    if (-not (Test-Path -LiteralPath $logPath -PathType Leaf)) {
        throw "Expected diagnostic log was not created at $logPath."
    }

    $uninstall = Start-Process -FilePath $uninstaller -ArgumentList "/S" -Wait -PassThru
    if ($uninstall.ExitCode -ne 0) { throw "Uninstaller exited with code $($uninstall.ExitCode)." }
    if (Test-Path -LiteralPath $application.FullName) { throw "Application launcher remains after uninstall." }
    if (-not (Test-Path -LiteralPath $sentinel -PathType Leaf)) {
        throw "Uninstall removed the user-data preservation sentinel."
    }

    $reinstall = Start-Process -FilePath $resolvedInstaller -ArgumentList "/S" -Wait -PassThru
    if ($reinstall.ExitCode -ne 0) { throw "Reinstall exited with code $($reinstall.ExitCode)." }
    $secondEntry = Find-UninstallEntry
    if (-not $secondEntry) { throw "Reinstall did not restore uninstall registration." }
    $secondUninstaller = Executable-FromCommand ([string]$secondEntry.UninstallString)
    $secondInstallDirectory = Split-Path -Parent $secondUninstaller
    $secondApplication = Get-ChildItem -LiteralPath $secondInstallDirectory -Filter "HF Antenna Studio.exe" -File -Recurse | Select-Object -First 1
    if (-not $secondApplication) { throw "Reinstalled application launcher was not found." }
    Invoke-PackagedWebViewTest $secondApplication.FullName "verify-preserved"
    $secondUninstall = Start-Process -FilePath $secondUninstaller -ArgumentList "/S" -Wait -PassThru
    if ($secondUninstall.ExitCode -ne 0) { throw "Second uninstaller exited with code $($secondUninstall.ExitCode)." }
    if (Test-Path -LiteralPath $secondApplication.FullName) { throw "Application launcher remains after final uninstall." }

    Write-Host "Packaged Windows test passed: install, launch, offline solver, logs, uninstall, reinstall, and WebView project-profile preservation."
} finally {
    if ($appProcess -and -not $appProcess.HasExited) {
        Stop-Process -Id $appProcess.Id -Force -ErrorAction SilentlyContinue
    }
}
