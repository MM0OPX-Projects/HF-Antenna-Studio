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
$startMenuRoots = @(
    (Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs"),
    (Join-Path $env:ProgramData "Microsoft\Windows\Start Menu\Programs")
)
$debugPolicySubpath = "Software\Policies\Microsoft\Edge\WebView2\AdditionalBrowserArguments"
$isAdministrator = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator
)
$debugPolicyPaths = @("HKCU:\$debugPolicySubpath")
if ($isAdministrator) {
    # WebView2 checks HKLM before HKCU. Elevated GitHub runners therefore need
    # the same temporary override at the machine-policy precedence level.
    $debugPolicyPaths = @("HKLM:\$debugPolicySubpath") + $debugPolicyPaths
}
$debugPolicyNames = @(
    "uk.co.mm0opx.hfantennastudio",
    "hf-antenna-studio.exe",
    "*"
)
$debugPolicyOriginal = @{}
$originalWebViewArguments = [Environment]::GetEnvironmentVariable("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", "Process")
$appProcess = $null

function Enable-WebViewDebugPolicy {
    $script:debugPolicyOriginal = @{}
    foreach ($debugPolicyPath in $debugPolicyPaths) {
        New-Item -Path $debugPolicyPath -Force | Out-Null
        foreach ($debugPolicyName in $debugPolicyNames) {
            $stateKey = "$debugPolicyPath|$debugPolicyName"
            try {
                $value = Get-ItemPropertyValue -Path $debugPolicyPath -Name $debugPolicyName -ErrorAction Stop
                $script:debugPolicyOriginal[$stateKey] = @{ Exists = $true; Value = [string]$value }
            } catch {
                $script:debugPolicyOriginal[$stateKey] = @{ Exists = $false; Value = $null }
            }
            New-ItemProperty -Path $debugPolicyPath -Name $debugPolicyName -Value "--remote-debugging-port=9222" -PropertyType String -Force | Out-Null
        }
    }
}

function Restore-WebViewDebugPolicy {
    if ($script:debugPolicyOriginal.Count -eq 0) { return }
    foreach ($debugPolicyPath in $debugPolicyPaths) {
        foreach ($debugPolicyName in $debugPolicyNames) {
            $stateKey = "$debugPolicyPath|$debugPolicyName"
            $original = $script:debugPolicyOriginal[$stateKey]
            if ($original -and $original.Exists) {
                New-ItemProperty -Path $debugPolicyPath -Name $debugPolicyName -Value $original.Value -PropertyType String -Force | Out-Null
            } else {
                Remove-ItemProperty -Path $debugPolicyPath -Name $debugPolicyName -ErrorAction SilentlyContinue
            }
        }
    }
    $script:debugPolicyOriginal = @{}
}

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

function Find-StartMenuShortcut {
    foreach ($root in $startMenuRoots) {
        if (-not (Test-Path -LiteralPath $root -PathType Container)) { continue }
        $shortcut = Get-ChildItem -LiteralPath $root -Filter "HF Antenna Studio.lnk" -File -Recurse |
            Select-Object -First 1
        if ($shortcut) { return $shortcut }
    }
    return $null
}

function Invoke-PackagedWebViewTest([string]$applicationPath, [string]$phase) {
    $script:appProcess = $null
    $logPath = Join-Path $dataRoot "logs\hf-antenna-studio.log"
    $logLinesBeforeLaunch = if (Test-Path -LiteralPath $logPath -PathType Leaf) {
        @(Get-Content -LiteralPath $logPath).Count
    } else {
        0
    }
    $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = "--remote-debugging-port=9222"
    Enable-WebViewDebugPolicy
    $script:appProcess = Start-Process -FilePath $applicationPath -PassThru
    $deadline = (Get-Date).AddSeconds(60)
    $debugReady = $false
    $targetSummary = "no debugging targets"
    do {
        Start-Sleep -Milliseconds 500
        try {
            $targets = @(Invoke-RestMethod -Uri "http://127.0.0.1:9222/json/list" -TimeoutSec 2)
            $targetSummary = ($targets | ForEach-Object { "$($_.type):$($_.url)" }) -join ", "
            $debugReady = @($targets | Where-Object {
                $_.type -eq "page" -and
                $_.url -ne "about:blank" -and
                ($_.url -match "tauri" -or $_.url -match "localhost")
            }).Count -gt 0
        } catch {
            $debugReady = $false
        }
    } while (-not $debugReady -and (Get-Date) -lt $deadline -and -not $script:appProcess.HasExited)
    if (-not $debugReady) {
        $processState = if ($script:appProcess.HasExited) {
            "host exited with code $($script:appProcess.ExitCode)"
        } else {
            "host remained running"
        }
        $logTail = if (Test-Path -LiteralPath $logPath -PathType Leaf) {
            (Get-Content -LiteralPath $logPath -Tail 12) -join " | "
        } else {
            "no native diagnostic log was created"
        }
        $webViewCount = @(Get-Process -Name "msedgewebview2" -ErrorAction SilentlyContinue).Count
        throw "The packaged WebView2 application did not expose a ready application target; $processState; WebView2 process count $webViewCount; targets: $targetSummary; log: $logTail"
    }

    $env:HFAS_CDP_URL = "http://127.0.0.1:9222"
    $env:HFAS_PACKAGE_PHASE = $phase
    $env:HFAS_EXPECTED_VERSION = $expectedVersion
    & $NodePath (Join-Path $repoRoot "frontend\scripts\test-packaged-app.mjs")
    if ($LASTEXITCODE -ne 0) { throw "Packaged application $phase test failed with exit code $LASTEXITCODE." }

    $newLogLines = if (Test-Path -LiteralPath $logPath -PathType Leaf) {
        @(Get-Content -LiteralPath $logPath | Select-Object -Skip $logLinesBeforeLaunch)
    } else {
        @()
    }
    $newErrors = @($newLogLines | Where-Object { $_ -match '\[ERROR\]' })
    if ($newErrors.Count -gt 0) {
        throw "Packaged application $phase emitted diagnostic errors: $($newErrors -join ' | ')"
    }

    if (-not $script:appProcess.HasExited) {
        Stop-Process -Id $script:appProcess.Id -Force
        $script:appProcess.WaitForExit()
    }
    $script:appProcess = $null
    Restore-WebViewDebugPolicy
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
    $application = Get-ChildItem -LiteralPath $installDirectory -Filter "hf-antenna-studio.exe" -File -Recurse | Select-Object -First 1
    if (-not $application) { throw "Installed application launcher was not found below $installDirectory." }
    $startMenuShortcut = Find-StartMenuShortcut
    if (-not $startMenuShortcut) { throw "HF Antenna Studio Start-menu shortcut was not created." }

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
    if (Test-Path -LiteralPath $startMenuShortcut.FullName) { throw "Start-menu shortcut remains after uninstall." }
    if (-not (Test-Path -LiteralPath $sentinel -PathType Leaf)) {
        throw "Uninstall removed the user-data preservation sentinel."
    }

    $reinstall = Start-Process -FilePath $resolvedInstaller -ArgumentList "/S" -Wait -PassThru
    if ($reinstall.ExitCode -ne 0) { throw "Reinstall exited with code $($reinstall.ExitCode)." }
    $secondEntry = Find-UninstallEntry
    if (-not $secondEntry) { throw "Reinstall did not restore uninstall registration." }
    $secondUninstaller = Executable-FromCommand ([string]$secondEntry.UninstallString)
    $secondInstallDirectory = Split-Path -Parent $secondUninstaller
    $secondApplication = Get-ChildItem -LiteralPath $secondInstallDirectory -Filter "hf-antenna-studio.exe" -File -Recurse | Select-Object -First 1
    if (-not $secondApplication) { throw "Reinstalled application launcher was not found." }
    $secondStartMenuShortcut = Find-StartMenuShortcut
    if (-not $secondStartMenuShortcut) { throw "Reinstall did not restore the Start-menu shortcut." }
    Invoke-PackagedWebViewTest $secondApplication.FullName "verify-preserved"
    $secondUninstall = Start-Process -FilePath $secondUninstaller -ArgumentList "/S" -Wait -PassThru
    if ($secondUninstall.ExitCode -ne 0) { throw "Second uninstaller exited with code $($secondUninstall.ExitCode)." }
    if (Test-Path -LiteralPath $secondApplication.FullName) { throw "Application launcher remains after final uninstall." }
    if (Test-Path -LiteralPath $secondStartMenuShortcut.FullName) { throw "Start-menu shortcut remains after final uninstall." }

    Write-Host "Packaged Windows test passed: install, launch, offline solver, logs, uninstall, reinstall, and WebView project-profile preservation."
} finally {
    Restore-WebViewDebugPolicy
    [Environment]::SetEnvironmentVariable("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", $originalWebViewArguments, "Process")
    if ($appProcess -and -not $appProcess.HasExited) {
        Stop-Process -Id $appProcess.Id -Force -ErrorAction SilentlyContinue
    }
}
