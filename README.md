# HF Antenna Studio

HF Antenna Studio is a local, open-source antenna-modelling application for Windows 11. It combines an original HTML/TypeScript interface with a pinned nec2c/WebAssembly NEC-2 engine. Normal calculations, projects, and imported measurement data remain on the user's computer and require no cloud account.

Version 1.0.0 is the first validation-bounded public release. It is engineering software, not a substitute for construction measurements or professional safety analysis.

## What v1.0.0 provides

- Parametric dipole, vertical, loop/quad/hexbeam, Yagi, and two-element phased-array laboratories.
- An arbitrary-wire editor with reviewed NEC import/export boundaries.
- Interactive antenna geometry, 2D azimuth/elevation plots, 3D radiation patterns, and NEC-derived segment-current views.
- Feed resistance/reactance, complex impedance, SWR, gain, beam and take-off metrics where the selected model makes those quantities meaningful.
- Frequency analysis, model comparison, bounded parameter sweeps, and a deliberately non-global experimental optimiser.
- Touchstone `.s1p` measurement overlays that preserve the imported samples and distinguish measurement from simulation.
- Versioned local `.hfas` projects, autosave, recovery, import/export, and schema migration review.
- A per-user Windows installer containing the UI and solver. End users do not install Node.js, Python, Docker, a compiler, or a separate NEC executable.

The application exposes many engineering workflows, but feature presence is not the same as numerical validation. See the scope below and the full [validation report](docs/VALIDATION_REPORT.md).

## Unreleased development work

The local `feature/ground-radial-systems` branch adds explicit near-surface radial-wire models for single and phased ground-mounted verticals. NEC-2 requires these wires to remain slightly above Sommerfeld/Norton ground; the application does not claim buried-wire or exact soil-contact modelling. See [Ground-radial systems](docs/GROUND_RADIAL_SYSTEMS.md) and the Unreleased changelog. This work is not part of the frozen v1.0.0 release claim until its later release workflow passes.

## Validated scope

The v1.0.0 campaign covers these exact reference models:

| Family | Compared quantities | Evidence |
|---|---|---|
| Free-space dipole | R, X, gain and broadside/null shape | Published NEC-2 result plus exact-deck comparison |
| Dipole over perfect ground | R, X, SWR, gain and take-off angle | Same deck in separately installed 4NEC2 NEC-2D |
| Perfect-ground quarter-wave vertical | R, X, SWR, gain, take-off and azimuth symmetry | 4NEC2 plus image-theory gain sanity bound |
| Square and delta loops over perfect ground | R, X, SWR, gain and take-off angle | Same deck in 4NEC2 NEC-2D |
| Two- and three-element Yagis over perfect ground | R, X, SWR, forward/rear gain, F/B and take-off angle | Same deck in 4NEC2 NEC-2D; separate published sanity case |
| Ideal-current two-vertical phased array over perfect ground | gain, symmetry/reversal, heading, F/B and take-off | Same deck in 4NEC2 NEC-2D plus analytical array symmetry |

All nine primary reference states pass their declared tolerances. Seven supplemental exact-deck models also pass, for 16 external comparator executions. Most comparisons use two implementations of NEC-2, so they are strong regression evidence for generated decks, parsing, coordinates and displayed metrics—not independent proof that NEC-2 represents every physical installation.

Not validated for v1.0.0 include finite Sommerfeld/Norton ground as an independent numeric campaign, lossy conductors, complex physical feed networks, optimiser optimality, universal geometry/segmentation convergence, or agreement with a constructed antenna. These and other boundaries are recorded in [Known limitations](docs/KNOWN_LIMITATIONS.md).

## Install on Windows 11

1. Download the x64 setup executable and `package-manifest.json` from the v1.0.0 release. The named corresponding-source ZIP is provided separately for source/licence compliance.
2. Verify the installer's SHA-256 against the manifest.
3. Run the per-user installer and launch **HF Antenna Studio** from the Start menu.
4. Open **About** and confirm version `1.0.0`.
5. Open the verified dipole example and run one calculation before relying on a saved design.

The current installer is unsigned, so Microsoft Defender SmartScreen may display an unknown-publisher warning. Do not install a file whose checksum does not match the release manifest. Windows 11 normally includes Evergreen WebView2; a stripped machine may need a connection while the small installer obtains that prerequisite. Once installed, normal calculations work offline.

See [Installation and troubleshooting](docs/INSTALLATION.md) for checksums, storage, logs, uninstall behaviour, and source-build instructions.

## Privacy and project safety

No account, telemetry service, or calculation server is required. The packaged application uses a restrictive local-only content policy and runs nec2c inside a Web Worker. Projects are stored in the application's local WebView profile until explicitly exported. Export important designs as `.hfas` files: local browser-style storage is convenient recovery state, not a backup.

## Documentation

- [User guide](docs/USER_GUIDE.md)
- [Installation and troubleshooting](docs/INSTALLATION.md)
- [Engineering validation report](docs/VALIDATION_REPORT.md)
- [Known limitations](docs/KNOWN_LIMITATIONS.md)
- [Ground-radial systems](docs/GROUND_RADIAL_SYSTEMS.md)
- [Windows packaging evidence](docs/WINDOWS_PACKAGING.md)
- [Project file format](docs/PROJECT_FILE_FORMAT.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Release notes](docs/RELEASE_NOTES_v1.0.0.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)

## Build and test from source

Maintainers use Node.js 24.14.0, npm 11, Emscripten 3.1.56, Rust 1.90.0/MSVC, and the recursively checked-out solver submodule. From a PowerShell prompt in the repository:

```powershell
git submodule update --init --recursive
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-wasm.ps1 -EmsdkPath C:\path\to\emsdk
Set-Location .\frontend
npm ci
npm run type-check
npm run lint
npm test
npm run build:wasm
npm run test:smoke
```

The Windows package command and its clean-install acceptance test are documented in [docs/INSTALLATION.md](docs/INSTALLATION.md). The lockfiles, source commit, and toolchain pins are part of the release evidence.

## Contributing and provenance

Contributions are welcome through the [HF Antenna Studio repository](https://github.com/MM0OPX-Projects/HF-Antenna-Studio). Contributors must use the DCO sign-off and document the origin and licence of code, antenna reference data, model decks, and assets. Do not submit copied proprietary application code, artwork, screenshots, manuals, or reverse-engineered assets. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

HF Antenna Studio began from the GPL-licensed [EA1FUO/AntennaSim](https://github.com/EA1FUO/AntennaSim) codebase at audited commit `96e153ceefffd25819e42142d591ca811b4790d3`. Its interface, packaging, modelling adapters, validation infrastructure, and product documentation have subsequently been extensively changed. This project is not affiliated with or endorsed by AN-SOF, EZNEC, 4NEC2, or their authors. 4NEC2 is used only as a separately installed validation comparator and is not distributed here.

## Licence

HF Antenna Studio is distributed under `GPL-3.0-or-later`; see [LICENSE](LICENSE). The bundled solver is built from pinned KJ7LNW/nec2c source commit `55be1e0e3fe5ee9dad4ce6050711450d19c562fd` (tag `v1.3.3`) and is handled conservatively under GPLv3 because its historical provenance statements are not perfectly uniform. Source, build scripts, notices, and dependency records accompany the release. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and [docs/LICENSING.md](docs/LICENSING.md).

There is no warranty. NEC-2 has important thin-wire, junction, ground, and segmentation limits; inspect all warnings and validate consequential designs independently.
