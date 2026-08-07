$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$expected = (Get-Content -LiteralPath (Join-Path $repoRoot "VERSION") -Raw).Trim()
$frontend = Get-Content -LiteralPath (Join-Path $repoRoot "frontend\package.json") -Raw | ConvertFrom-Json
$tauri = Get-Content -LiteralPath (Join-Path $repoRoot "src-tauri\tauri.conf.json") -Raw | ConvertFrom-Json
$cargoText = Get-Content -LiteralPath (Join-Path $repoRoot "src-tauri\Cargo.toml") -Raw
$cargoVersionMatch = [regex]::Match($cargoText, '(?m)^version\s*=\s*"([^"]+)"')

if (-not $cargoVersionMatch.Success) {
    throw "Could not read the package version from src-tauri/Cargo.toml."
}

$versions = [ordered]@{
    VERSION = $expected
    Frontend = [string]$frontend.version
    Tauri = [string]$tauri.version
    Cargo = $cargoVersionMatch.Groups[1].Value
}

foreach ($entry in $versions.GetEnumerator()) {
    if ($entry.Value -ne $expected) {
        throw "Version mismatch: $($entry.Key) is $($entry.Value), expected $expected."
    }
}

$validBundleCategories = @(
    "Business", "DeveloperTool", "Education", "Entertainment", "Finance", "Game",
    "ActionGame", "AdventureGame", "ArcadeGame", "BoardGame", "CardGame", "CasinoGame",
    "DiceGame", "EducationalGame", "FamilyGame", "KidsGame", "MusicGame", "PuzzleGame",
    "RacingGame", "RolePlayingGame", "SimulationGame", "SportsGame", "StrategyGame",
    "TriviaGame", "WordGame", "GraphicsAndDesign", "HealthcareAndFitness", "Lifestyle",
    "Medical", "Music", "News", "Photography", "Productivity", "Reference",
    "SocialNetworking", "Sports", "Travel", "Utility", "Video", "Weather"
)
if ($tauri.bundle.category -notin $validBundleCategories) {
    throw "Unsupported Tauri bundle category: $($tauri.bundle.category)."
}

foreach ($hookName in @("beforeBuildCommand", "beforeDevCommand")) {
    $hook = [string]$tauri.build.$hookName
    $pathMatch = [regex]::Match($hook, '-File\s+(?:"([^"]+)"|([^\s]+))')
    if (-not $pathMatch.Success) {
        throw "$hookName must invoke a repository-local PowerShell file."
    }
    $hookPath = if ($pathMatch.Groups[1].Success) { $pathMatch.Groups[1].Value } else { $pathMatch.Groups[2].Value }
    if (-not (Test-Path -LiteralPath (Join-Path $repoRoot $hookPath) -PathType Leaf)) {
        throw "$hookName path does not resolve from the repository root: $hookPath"
    }
}

Write-Host "Package versions are synchronized at $expected."
