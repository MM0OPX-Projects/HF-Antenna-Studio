param([string]$EnginePath = "C:\4nec2\exe\nec2dxs11k.exe", [switch]$Record)
$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$fixtureRoot = Join-Path $repoRoot "validation\phased-arrays"
$cases = @(
    @{ Name = "broadside-20m-perfect"; Gain = 6.20; Theta = 88; Phi = 90; Reverse = 6.20 },
    @{ Name = "endfire-forward-20m-perfect"; Gain = 8.18; Theta = 88; Phi = 0; Reverse = -26.72 },
    @{ Name = "endfire-reverse-20m-perfect"; Gain = 8.18; Theta = 88; Phi = 180; Reverse = -26.72 }
)
if (-not (Test-Path -LiteralPath $EnginePath -PathType Leaf)) { throw "4NEC2 comparator engine not found: $EnginePath" }
$tempBase = [IO.Path]::GetTempPath()
$tempRoot = Join-Path $tempBase ("hfas-phased-arrays-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $tempRoot | Out-Null
try {
    $results = foreach ($case in $cases) {
        $inputName = "$($case.Name).nec"
        $outputName = "$($case.Name).out"
        Copy-Item -LiteralPath (Join-Path $fixtureRoot $inputName) -Destination (Join-Path $tempRoot $inputName)
        Push-Location $tempRoot
        try {
            @($inputName, $outputName) | & $EnginePath | Out-Null
            if ($LASTEXITCODE -ne 0) { throw "Comparator exited $LASTEXITCODE for $($case.Name)." }
        } finally { Pop-Location }
        $lines = Get-Content -LiteralPath (Join-Path $tempRoot $outputName)
        $gainRows = foreach ($line in $lines) {
            if ($line -match '^\s+([0-9.]+)\s+([0-9.]+)\s+(-?[0-9.]+)\s+(-?[0-9.]+)\s+(-?[0-9.]+)') {
                $gain = [double]$matches[5]
                if ($gain -gt -999) { [pscustomobject]@{ Theta = [double]$matches[1]; Phi = [double]$matches[2]; Gain = $gain } }
            }
        }
        # Use the reviewed theoretical array axes instead of Sort-Object's
        # arbitrary choice among equal gain values rounded to 0.01 dB.
        $peak = $gainRows | Where-Object { [math]::Abs($_.Theta - $case.Theta) -lt 0.01 -and [math]::Abs($_.Phi - $case.Phi) -lt 0.01 } | Select-Object -First 1
        if (-not $peak) { throw "Could not identify the reviewed forward-axis sample for $($case.Name)." }
        $reversePhi = ($case.Phi + 180) % 360
        $reverse = $gainRows | Where-Object { [math]::Abs($_.Theta - $case.Theta) -lt 0.01 -and [math]::Abs($_.Phi - $reversePhi) -lt 0.01 } | Select-Object -First 1
        if (-not $reverse) { throw "Could not identify the exact reverse sample for $($case.Name)." }
        $passed = $Record -or (
            [math]::Abs($peak.Gain - $case.Gain) -le 0.02 -and
            [math]::Abs($peak.Theta - $case.Theta) -le 0.01 -and
            [math]::Abs($peak.Phi - $case.Phi) -le 0.01 -and
            [math]::Abs($reverse.Gain - $case.Reverse) -le 0.02
        )
        [pscustomobject]@{
            Case = $case.Name
            PeakGainDbi = $peak.Gain
            PeakThetaDeg = $peak.Theta
            PeakPhiDeg = $peak.Phi
            ReverseGainDbi = $reverse.Gain
            FrontToBackDb = $peak.Gain - $reverse.Gain
            DeckSha256 = (Get-FileHash -LiteralPath (Join-Path $fixtureRoot $inputName) -Algorithm SHA256).Hash
            Pass = $passed
        }
    }
    Write-Host "Comparator: 4NEC2 merged NEC-2D build 2.7 (30-Jan-2008)"
    Write-Host "Engine SHA256: $((Get-FileHash -LiteralPath $EnginePath -Algorithm SHA256).Hash)"
    $results | Format-Table -AutoSize
    if (-not $Record -and $results.Pass -contains $false) { exit 1 }
} finally {
    $resolvedTemp = [IO.Path]::GetFullPath($tempRoot)
    $resolvedBase = [IO.Path]::GetFullPath($tempBase)
    if (-not $resolvedTemp.StartsWith($resolvedBase) -or -not (Split-Path -Leaf $resolvedTemp).StartsWith("hfas-phased-arrays-")) { throw "Refusing to remove unexpected temporary path: $resolvedTemp" }
    if (Test-Path -LiteralPath $resolvedTemp) { Remove-Item -LiteralPath $resolvedTemp -Recurse -Force }
}
