param(
    [string]$EnginePath = "C:\4nec2\exe\nec2dxs11k.exe"
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$fixtureRoot = Join-Path $repoRoot "validation\yagi"
$cases = @(
    @{ Name = "starting-2el-20m-perfect"; R = 57.80; X = 26.01; Forward = 11.85; Theta = 62.0; Rear = -3.52 },
    @{ Name = "starting-3el-20m-perfect"; R = 20.53; X = 9.38; Forward = 13.38; Theta = 64.0; Rear = -1.37 },
    @{ Name = "starting-5el-20m-perfect"; R = 24.66; X = 10.36; Forward = 14.87; Theta = 66.0; Rear = -2.16 }
)

if (-not (Test-Path -LiteralPath $EnginePath -PathType Leaf)) {
    throw "4NEC2 comparator engine not found: $EnginePath"
}

$tempBase = [IO.Path]::GetTempPath()
$tempRoot = Join-Path $tempBase ("hfas-yagi-" + [guid]::NewGuid().ToString("N"))
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
        if (-not $inputLine) {
            $snippet = $lines | Select-Object -First 30 | Out-String
            throw "Could not locate comparator impedance row for $($case.Name): $snippet"
        }
        $scientificFields = [regex]::Matches($inputLine, '[+-]?\d+\.\d+E[+-]\d+')
        if ($scientificFields.Count -ge 6) {
            $resistance = [double]$scientificFields[4].Value
            $reactance = [double]$scientificFields[5].Value
        } else {
            throw "Could not parse comparator impedance for $($case.Name): $inputLine"
        }
        $gainRows = foreach ($line in $lines) {
            if ($line -match '^\s+([0-9.]+)\s+([0-9.]+)\s+(-?[0-9.]+)\s+(-?[0-9.]+)\s+(-?[0-9.]+)') {
                $gain = [double]$matches[5]
                if ($gain -gt -999) { [pscustomobject]@{ Theta = [double]$matches[1]; Phi = [double]$matches[2]; Gain = $gain } }
            }
        }
        $forward = $gainRows | Where-Object { $_.Phi -le 180 } | Sort-Object Gain -Descending | Select-Object -First 1
        $rear = $gainRows | Where-Object { [math]::Abs($_.Theta - $forward.Theta) -lt 0.01 -and [math]::Abs($_.Phi - (($forward.Phi + 180) % 360)) -lt 0.01 } | Select-Object -First 1
        if (-not $forward -or -not $rear) { throw "Could not identify forward/rear samples for $($case.Name)." }
        $passed = [math]::Abs($resistance - $case.R) -le 0.02 -and
            [math]::Abs($reactance - $case.X) -le 0.02 -and
            [math]::Abs($forward.Gain - $case.Forward) -le 0.02 -and
            [math]::Abs($forward.Theta - $case.Theta) -le 0.01 -and
            [math]::Abs($rear.Gain - $case.Rear) -le 0.02
        [pscustomobject]@{
            Case = $case.Name
            ResistanceOhm = $resistance
            ReactanceOhm = $reactance
            ForwardGainDbi = $forward.Gain
            ForwardThetaDeg = $forward.Theta
            RearGainDbi = $rear.Gain
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
    if (-not $resolvedTemp.StartsWith($resolvedBase) -or -not (Split-Path -Leaf $resolvedTemp).StartsWith("hfas-yagi-")) {
        throw "Refusing to remove unexpected temporary path: $resolvedTemp"
    }
    if (Test-Path -LiteralPath $resolvedTemp) { Remove-Item -LiteralPath $resolvedTemp -Recurse -Force }
}
