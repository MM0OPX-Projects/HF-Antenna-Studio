# HF Antenna Studio v1.0.0 release notes

Release date: 2026-08-23

HF Antenna Studio v1.0.0 is the first public, validation-bounded Windows release. It packages the local HTML/TypeScript workbench with pinned nec2c/WebAssembly v1.3.3 source commit `55be1e0e3fe5ee9dad4ce6050711450d19c562fd`.

## Release highlights

- Windows 11 x64 per-user installer with local solver, launcher, clean program uninstall, preserved local project data, diagnostic logs, and no normal-operation cloud/account requirement.
- Parametric dipole, vertical, loop/quad/hexbeam, Yagi, and two-vertical phased-array workflows plus arbitrary wire editing.
- 2D/3D radiation patterns, feed impedance/SWR, frequency sweeps, NEC currents, model comparison, parameter sweeps, measurement overlay, and a bounded experimental optimiser.
- Versioned `.hfas` project files, migrations, autosave and recovery.
- Complete navigation recovery: every feature route and unknown URL has a tested path back to Home in desktop and compact layouts.
- Nine primary external reference states and seven supplemental exact-deck comparisons, all within their declared tolerances.

## Validation boundary

The release campaign verifies exact free-space/perfect-ground models for dipoles, a quarter-wave vertical, square/delta loops, two-/three-element Yagis, and ideal-current two-vertical broadside/end-fire arrays. Most use same-deck comparison with a separately installed 4NEC2 NEC-2D implementation. This is strong evidence for adapter, parser, coordinate and metric correctness but not proof of arbitrary physical antennas.

Finite real-ground models, explicit ground-surface/buried radial systems, complex feed networks, broad current-value accuracy, optimiser optimality, and measured constructed antennas remain outside the independent v1.0.0 campaign. Read [VALIDATION_REPORT.md](VALIDATION_REPORT.md) and [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md).

## Installation note

The installer is unsigned and may show a SmartScreen warning. Verify the SHA-256 in `package-manifest.json`. Windows 11's WebView2 normally satisfies the UI prerequisite; a stripped machine may need internet during installation. Calculations run locally and offline after installation.

## Upgrade/data note

Export important `.hfas` projects before upgrade. The uninstaller intentionally preserves the application profile and logs. This is not a substitute for a separate backup.

## Licence and source

The combined application is GPL-3.0-or-later and retains AntennaSim and nec2c provenance. The release tag records the application and solver gitlink; the separate `hf-antenna-studio-1.0.0-corresponding-source.zip` release asset expands the exact solver submodule and includes lockfiles, build/test scripts, licence, notices, SBOM and source manifest. 4NEC2 and commercial simulator assets are not bundled.

See [CHANGELOG.md](../CHANGELOG.md) for the detailed feature history.
