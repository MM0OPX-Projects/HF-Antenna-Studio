param([string]$EnginePath = "C:\4nec2\exe\nec2dxs11k.exe", [switch]$Record)
$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$fixtureRoot = Join-Path $repoRoot "validation\loop-beams"
$cases = @(
    @{ Name = "square-loop-20m-perfect"; Directional = $false; R = 106.289; X = -72.509; Gain = 8.46; Theta = 54 },
    @{ Name = "delta-loop-20m-perfect"; Directional = $false; R = 103.861; X = -77.3984; Gain = 7.94; Theta = 48 },
    @{ Name = "diamond-loop-20m-perfect"; Directional = $false; R = 88.9143; X = -80.3723; Gain = 7.95; Theta = 90 },
    @{ Name = "cubical-quad-2el-20m-perfect"; Directional = $true; R = 84.0498; X = 10.183; Gain = 14.36; Theta = 72 },
    @{ Name = "hexbeam-20m-perfect"; Directional = $true; R = 31.8707; X = 3.09544; Gain = 11.96; Theta = 62 }
)
if (-not (Test-Path -LiteralPath $EnginePath -PathType Leaf)) { throw "4NEC2 comparator engine not found: $EnginePath" }
$tempBase = [IO.Path]::GetTempPath(); $tempRoot = Join-Path $tempBase ("hfas-loop-beams-" + [guid]::NewGuid().ToString("N")); New-Item -ItemType Directory -Path $tempRoot | Out-Null
try {
    $results = foreach ($case in $cases) {
        $inputName = "$($case.Name).nec"; $outputName = "$($case.Name).out"; Copy-Item -LiteralPath (Join-Path $fixtureRoot $inputName) -Destination (Join-Path $tempRoot $inputName)
        Push-Location $tempRoot
        try { @($inputName, $outputName) | & $EnginePath | Out-Null; if ($LASTEXITCODE -ne 0) { throw "Comparator exited $LASTEXITCODE for $($case.Name)." } } finally { Pop-Location }
        $lines = Get-Content -LiteralPath (Join-Path $tempRoot $outputName); $inputLine = $lines | Where-Object { $_ -match '^\s+\d+\s+\d+\s+1\.0000+E\+00' } | Select-Object -First 1
        if (-not $inputLine) { throw "Could not locate comparator impedance row for $($case.Name)." }
        $fields = [regex]::Matches($inputLine, '[+-]?\d+\.\d+E[+-]\d+'); if ($fields.Count -lt 6) { throw "Could not parse comparator impedance for $($case.Name): $inputLine" }; $resistance = [double]$fields[4].Value; $reactance = [double]$fields[5].Value
        $gainRows = foreach ($line in $lines) { if ($line -match '^\s+([0-9.]+)\s+([0-9.]+)\s+(-?[0-9.]+)\s+(-?[0-9.]+)\s+(-?[0-9.]+)') { $gain = [double]$matches[5]; if ($gain -gt -999) { [pscustomobject]@{ Theta = [double]$matches[1]; Phi = [double]$matches[2]; Gain = $gain } } } }
        $peak = if ($case.Directional) { $gainRows | Where-Object { $_.Phi -le 180 } | Sort-Object Gain -Descending | Select-Object -First 1 } else { $gainRows | Sort-Object Gain -Descending | Select-Object -First 1 }
        if (-not $peak) { throw "Could not identify a valid gain sample for $($case.Name)." }
        $passed = $Record -or ([math]::Abs($resistance - $case.R) -le 0.02 -and [math]::Abs($reactance - $case.X) -le 0.02 -and [math]::Abs($peak.Gain - $case.Gain) -le 0.02 -and [math]::Abs($peak.Theta - $case.Theta) -le 0.01)
        [pscustomobject]@{ Case = $case.Name; ResistanceOhm = $resistance; ReactanceOhm = $reactance; PeakGainDbi = $peak.Gain; PeakThetaDeg = $peak.Theta; PeakPhiDeg = $peak.Phi; Pass = $passed }
    }
    Write-Host "Comparator: 4NEC2 merged NEC-2D build 2.7 (30-Jan-2008)"; Write-Host "Engine SHA256: $((Get-FileHash -LiteralPath $EnginePath -Algorithm SHA256).Hash)"; $results | Format-Table -AutoSize
    if (-not $Record -and $results.Pass -contains $false) { exit 1 }
} finally {
    $resolvedTemp = [IO.Path]::GetFullPath($tempRoot); $resolvedBase = [IO.Path]::GetFullPath($tempBase)
    if (-not $resolvedTemp.StartsWith($resolvedBase) -or -not (Split-Path -Leaf $resolvedTemp).StartsWith("hfas-loop-beams-")) { throw "Refusing to remove unexpected temporary path: $resolvedTemp" }
    if (Test-Path -LiteralPath $resolvedTemp) { Remove-Item -LiteralPath $resolvedTemp -Recurse -Force }
}
