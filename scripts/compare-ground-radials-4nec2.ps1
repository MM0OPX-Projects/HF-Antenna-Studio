param([string]$EnginePath = "C:\4nec2\exe\nec2dxs11k.exe")

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$expectedEngineHash = "2FB857EF4EDD15C5A46FB2FE694502E965652E71F69855151B05210DDD410ACE"
$cases = @(
    @{
        Name = "surface-16radial-20m-real"
        Fixture = "validation\vertical\surface-16radial-20m-real.nec"
        Sha256 = "473847CBE76DE50FEEA7A4A5BFF1FACA968D358C53E50D9B5B87DF938230D941"
        Kind = "single"
        R = 32.3154
        X = -15.3840
    },
    @{
        Name = "template-surface-16radial-20m-real"
        Fixture = "validation\vertical\template-surface-16radial-20m-real.nec"
        Sha256 = "D13C1A9FBC7C2452BA196D1D2F28FBF8BCAFF0D4AC25DA8D49F74FE376C3A882"
        Kind = "single"
        R = 32.3095
        X = -15.5247
    },
    @{
        Name = "shared-16radial-20m-real"
        Fixture = "validation\phased-arrays\shared-16radial-20m-real.nec"
        Sha256 = "9FC10FF9337D3A003A1C7F730B86DFFE3BC6C0D76AAD1B16564926105EC1467E"
        Kind = "array"
    }
)

if (-not (Test-Path -LiteralPath $EnginePath -PathType Leaf)) {
    throw "4NEC2 comparator engine not found: $EnginePath"
}
$actualEngineHash = (Get-FileHash -LiteralPath $EnginePath -Algorithm SHA256).Hash
if ($actualEngineHash -ne $expectedEngineHash) {
    throw "4NEC2 comparator identity changed: expected $expectedEngineHash, received $actualEngineHash"
}

function Read-InputRows([string[]]$Lines) {
    $inSection = $false
    $rows = @()
    foreach ($line in $Lines) {
        if ($line -match "ANTENNA INPUT PARAMETERS") { $inSection = $true; continue }
        if ($inSection -and $line -match '^\s+(\d+)\s+(\d+)\s+([+-]?\d+\.\d+E[+-]\d+)\s*([+-]?\d+\.\d+E[+-]\d+)\s+([+-]?\d+\.\d+E[+-]\d+)\s*([+-]?\d+\.\d+E[+-]\d+)\s+([+-]?\d+\.\d+E[+-]\d+)\s*([+-]?\d+\.\d+E[+-]\d+)') {
            $rows += [pscustomobject]@{ Tag = [int]$matches[1]; Segment = [int]$matches[2]; Resistance = [double]$matches[7]; Reactance = [double]$matches[8] }
        } elseif ($inSection -and $rows.Count -gt 0 -and [string]::IsNullOrWhiteSpace($line)) {
            break
        }
    }
    return $rows
}

function Read-PatternRows([string[]]$Lines) {
    $inSection = $false
    $rows = @()
    foreach ($line in $Lines) {
        if ($line -match "RADIATION PATTERNS") { $inSection = $true; continue }
        if ($inSection -and $line -match '^\s+([0-9]+\.[0-9]+)\s+([0-9]+\.[0-9]+)\s+(-?[0-9]+\.[0-9]+)\s+(-?[0-9]+\.[0-9]+)\s+(-?[0-9]+\.[0-9]+)') {
            $gain = [double]$matches[5]
            if ($gain -gt -999) { $rows += [pscustomobject]@{ Theta = [double]$matches[1]; Phi = [double]$matches[2]; Gain = $gain } }
        }
    }
    return $rows
}

$tempBase = [IO.Path]::GetTempPath()
$tempRoot = Join-Path $tempBase ("hfas-ground-radials-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $tempRoot | Out-Null

try {
    $results = foreach ($case in $cases) {
        $source = Join-Path $repoRoot $case.Fixture
        $actualHash = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash
        if ($actualHash -ne $case.Sha256) { throw "Reviewed deck hash changed for $($case.Name): $actualHash" }
        $inputName = "$($case.Name).nec"
        $outputName = "$($case.Name).out"
        Copy-Item -LiteralPath $source -Destination (Join-Path $tempRoot $inputName)
        Push-Location $tempRoot
        try {
            @($inputName, $outputName) | & $EnginePath | Out-Null
            if ($LASTEXITCODE -ne 0) { throw "Comparator exited $LASTEXITCODE for $($case.Name)." }
        } finally { Pop-Location }

        $lines = Get-Content -LiteralPath (Join-Path $tempRoot $outputName)
        $inputs = @(Read-InputRows $lines)
        $pattern = @(Read-PatternRows $lines)
        if ($case.Kind -eq "single") {
            $peak = $pattern | Sort-Object Gain -Descending | Select-Object -First 1
            $sameTheta = @($pattern | Where-Object { [math]::Abs($_.Theta - $peak.Theta) -lt 0.01 })
            $spread = ($sameTheta | Measure-Object Gain -Maximum).Maximum - ($sameTheta | Measure-Object Gain -Minimum).Minimum
            $pass = $inputs.Count -eq 1 -and [math]::Abs($inputs[0].Resistance - $case.R) -le 0.02 -and [math]::Abs($inputs[0].Reactance - $case.X) -le 0.02 -and [math]::Abs($peak.Gain - -0.16) -le 0.02 -and [math]::Abs($peak.Theta - 65) -le 0.01 -and $spread -le 0.01
            [pscustomobject]@{ Case = $case.Name; R1 = $inputs[0].Resistance; X1 = $inputs[0].Reactance; R2 = $null; X2 = $null; Gain = $peak.Gain; Theta = $peak.Theta; Phi = $peak.Phi; SymmetryDb = $spread; Pass = $pass }
        } else {
            $forward = $pattern | Where-Object { [math]::Abs($_.Theta - 64) -lt 0.01 -and [math]::Abs($_.Phi - 90) -lt 0.01 } | Select-Object -First 1
            $reverse = $pattern | Where-Object { [math]::Abs($_.Theta - 64) -lt 0.01 -and [math]::Abs($_.Phi - 270) -lt 0.01 } | Select-Object -First 1
            $symmetry = [math]::Abs($forward.Gain - $reverse.Gain)
            $pass = $inputs.Count -eq 2 -and [math]::Abs($inputs[0].Resistance - 121.795) -le 0.02 -and [math]::Abs($inputs[0].Reactance - 566.626) -le 0.02 -and [math]::Abs($inputs[1].Resistance - 121.807) -le 0.02 -and [math]::Abs($inputs[1].Reactance - 566.639) -le 0.02 -and [math]::Abs($forward.Gain - -2.80) -le 0.02 -and $symmetry -le 0.01
            [pscustomobject]@{ Case = $case.Name; R1 = $inputs[0].Resistance; X1 = $inputs[0].Reactance; R2 = $inputs[1].Resistance; X2 = $inputs[1].Reactance; Gain = $forward.Gain; Theta = $forward.Theta; Phi = $forward.Phi; SymmetryDb = $symmetry; Pass = $pass }
        }
    }

    Write-Host "Comparator: 4NEC2 merged NEC-2D build 2.7 (30-Jan-2008)"
    Write-Host "Engine SHA256: $actualEngineHash"
    $results | Format-Table -AutoSize
    if ($results.Pass -contains $false) { exit 1 }
} finally {
    $resolvedTemp = [IO.Path]::GetFullPath($tempRoot)
    $resolvedBase = [IO.Path]::GetFullPath($tempBase)
    if (-not $resolvedTemp.StartsWith($resolvedBase) -or -not (Split-Path -Leaf $resolvedTemp).StartsWith("hfas-ground-radials-")) {
        throw "Refusing to remove unexpected temporary path: $resolvedTemp"
    }
    if (Test-Path -LiteralPath $resolvedTemp) { Remove-Item -LiteralPath $resolvedTemp -Recurse -Force }
}
