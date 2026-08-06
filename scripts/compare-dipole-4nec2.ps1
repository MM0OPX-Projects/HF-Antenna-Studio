param(
    [string]$EnginePath = "C:\4nec2\exe\nec2dxs11k.exe",
    [switch]$Record
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$fixtureRoot = Join-Path $repoRoot "validation\dipole"
$cases = @(
    @{ Name = "ellingson-38mhz-app-21seg"; R = 77.61; X = 45.41; Gain = 2.16; Theta = 90.0; Phi = 90.0; NullTheta = 90.0; NullPhi = 0.0; MaximumNullGain = -40.0; ToleranceOhm = 0.02 },
    @{ Name = "half-wave-20m-half-lambda-perfect"; R = 72.80; X = 25.90; Gain = 8.43; Theta = 60.0; ToleranceOhm = 0.02 }
)

if (-not (Test-Path -LiteralPath $EnginePath -PathType Leaf)) {
    throw "4NEC2 comparator engine not found: $EnginePath"
}

$tempBase = [IO.Path]::GetTempPath()
$tempRoot = Join-Path $tempBase ("hfas-dipole-" + [guid]::NewGuid().ToString("N"))
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
        } finally {
            Pop-Location
        }

        $lines = Get-Content -LiteralPath (Join-Path $tempRoot $outputName)
        $inputLine = $lines | Where-Object { $_ -match '^\s+\d+\s+\d+\s+1\.0000+E\+00' } | Select-Object -First 1
        if (-not $inputLine) { throw "Could not locate comparator impedance row for $($case.Name)." }
        $fields = [regex]::Matches($inputLine, '[+-]?\d+\.\d+E[+-]\d+')
        if ($fields.Count -lt 6) { throw "Could not parse comparator impedance for $($case.Name): $inputLine" }
        $resistance = [double]$fields[4].Value
        $reactance = [double]$fields[5].Value
        $allGainRows = foreach ($line in $lines) {
            if ($line -match '^\s+([0-9.]+)\s+([0-9.]+)\s+(-?[0-9.]+)\s+(-?[0-9.]+)\s+(-?[0-9.]+)') {
                $gain = [double]$matches[5]
                [pscustomobject]@{ Theta = [double]$matches[1]; Phi = [double]$matches[2]; Gain = $gain }
            }
        }
        $gainRows = $allGainRows | Where-Object { $_.Gain -gt -999 }
        $peak = if ($null -ne $case.Phi) {
            $gainRows | Where-Object { [math]::Abs($_.Theta - $case.Theta) -lt 0.01 -and [math]::Abs($_.Phi - $case.Phi) -lt 0.01 } | Select-Object -First 1
        } else {
            $gainRows | Sort-Object Gain -Descending | Select-Object -First 1
        }
        if (-not $peak) { throw "Could not identify a valid gain sample for $($case.Name)." }
        $nullSample = if ($null -ne $case.NullPhi) {
            $allGainRows | Where-Object { [math]::Abs($_.Theta - $case.NullTheta) -lt 0.01 -and [math]::Abs($_.Phi - $case.NullPhi) -lt 0.01 } | Select-Object -First 1
        } else { $null }
        if ($null -ne $case.NullPhi -and -not $nullSample) { throw "Could not identify the reviewed axial-null sample for $($case.Name)." }
        $nullPassed = $null -eq $case.NullPhi -or $nullSample.Gain -le $case.MaximumNullGain
        $passed = $Record -or (
            [math]::Abs($resistance - $case.R) -le $case.ToleranceOhm -and
            [math]::Abs($reactance - $case.X) -le $case.ToleranceOhm -and
            [math]::Abs($peak.Gain - $case.Gain) -le 0.02 -and
            [math]::Abs($peak.Theta - $case.Theta) -le 0.01 -and
            $nullPassed
        )
        [pscustomobject]@{
            Case = $case.Name
            ResistanceOhm = $resistance
            ReactanceOhm = $reactance
            PeakGainDbi = $peak.Gain
            PeakThetaDeg = $peak.Theta
            PeakPhiDeg = $peak.Phi
            AxialNullGainDbi = if ($nullSample) { $nullSample.Gain } else { $null }
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
    if (-not $resolvedTemp.StartsWith($resolvedBase) -or -not (Split-Path -Leaf $resolvedTemp).StartsWith("hfas-dipole-")) {
        throw "Refusing to remove unexpected temporary path: $resolvedTemp"
    }
    if (Test-Path -LiteralPath $resolvedTemp) { Remove-Item -LiteralPath $resolvedTemp -Recurse -Force }
}
