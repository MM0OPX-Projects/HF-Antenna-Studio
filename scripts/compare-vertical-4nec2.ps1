param(
    [string]$EnginePath = "C:\4nec2\exe\nec2dxs11k.exe"
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$fixtureRoot = Join-Path $repoRoot "validation\vertical"
$cases = @(
    @{ Name = "ideal-40m"; R = 33.82; X = -19.01; Gain = 5.13; Theta = 90.0 },
    @{ Name = "ideal-20m"; R = 34.03; X = -15.58; Gain = 5.13; Theta = 90.0 },
    @{ Name = "ideal-10m"; R = 34.30; X = -12.00; Gain = 5.13; Theta = 90.0 }
)

if (-not (Test-Path -LiteralPath $EnginePath -PathType Leaf)) {
    throw "4NEC2 comparator engine not found: $EnginePath"
}

$tempBase = [IO.Path]::GetTempPath()
$tempRoot = Join-Path $tempBase ("hfas-vertical-" + [guid]::NewGuid().ToString("N"))
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
        $inputLine = $lines | Where-Object { $_ -match '^\s+1\s+1\s+1\.00000E\+00' } | Select-Object -First 1
        if ($inputLine -notmatch '^\s+\d+\s+\d+\s+\S+\s+\S+\s+\S+\s+\S+\s+([+-]?\d+\.\d+E[+-]\d+)([+-]\d+\.\d+E[+-]\d+)') {
            throw "Could not parse comparator impedance for $($case.Name)."
        }
        $resistance = [double]$matches[1]
        $reactance = [double]$matches[2]
        $gainRows = foreach ($line in $lines) {
            if ($line -match '^\s+([0-9.]+)\s+([0-9.]+)\s+(-?[0-9.]+)\s+(-?[0-9.]+)\s+(-?[0-9.]+)') {
                $gain = [double]$matches[5]
                if ($gain -gt -999) { [pscustomobject]@{ Theta = [double]$matches[1]; Phi = [double]$matches[2]; Gain = $gain } }
            }
        }
        $peak = $gainRows | Sort-Object Gain -Descending | Select-Object -First 1
        $azimuthAtPeak = $gainRows | Where-Object { [math]::Abs($_.Theta - $peak.Theta) -lt 0.01 }
        $azimuthSpread = ($azimuthAtPeak | Measure-Object Gain -Maximum).Maximum - ($azimuthAtPeak | Measure-Object Gain -Minimum).Minimum
        $passed = [math]::Abs($resistance - $case.R) -le 0.02 -and
            [math]::Abs($reactance - $case.X) -le 0.02 -and
            [math]::Abs($peak.Gain - $case.Gain) -le 0.01 -and
            [math]::Abs($peak.Theta - $case.Theta) -le 0.01 -and
            $azimuthSpread -le 0.01
        [pscustomobject]@{
            Case = $case.Name
            ResistanceOhm = $resistance
            ReactanceOhm = $reactance
            PeakGainDbi = $peak.Gain
            PeakThetaDeg = $peak.Theta
            AzimuthSpreadDb = $azimuthSpread
            Pass = $passed
        }
    }

    $engineHash = (Get-FileHash -LiteralPath $EnginePath -Algorithm SHA256).Hash
    Write-Host "Comparator: 4NEC2 merged NEC-2D build 2.7 (30-Jan-2008)"
    Write-Host "Engine SHA256: $engineHash"
    $results | Format-Table -AutoSize
    if ($results.Pass -contains $false) { exit 1 }
} finally {
    $resolvedTemp = [IO.Path]::GetFullPath($tempRoot)
    $resolvedBase = [IO.Path]::GetFullPath($tempBase)
    if (-not $resolvedTemp.StartsWith($resolvedBase) -or -not (Split-Path -Leaf $resolvedTemp).StartsWith("hfas-vertical-")) {
        throw "Refusing to remove unexpected temporary path: $resolvedTemp"
    }
    if (Test-Path -LiteralPath $resolvedTemp) { Remove-Item -LiteralPath $resolvedTemp -Recurse -Force }
}
