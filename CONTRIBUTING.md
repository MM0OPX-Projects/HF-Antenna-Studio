# Contributing to HF Antenna Studio

Thank you for helping build an open and technically honest antenna-modelling application.

## Contributor agreement and provenance

HF Antenna Studio uses the Developer Certificate of Origin 1.1. Every commit must include a sign-off created with `git commit -s`:

```text
Signed-off-by: Your Name <your.email@example.com>
```

By signing off, you certify that you have the right to submit the contribution under `GPL-3.0-or-later`. Record the source, version/commit, licence, and permission for external code, datasets, NEC models, expected numeric results, images, icons, or documentation excerpts.

Do not submit proprietary simulator code, decompiled material, copied commercial artwork/layouts, screenshots, manuals, package examples without redistribution permission, or unattributed values from books/forums. Commercial programs may be used as black-box comparators when their terms permit it, but they must not be bundled and the report must identify version, settings, model differences, and evidence limits.

## Development baseline

- Windows 11 is the primary supported desktop platform.
- Node.js 24.14.0 and npm 11 are required for the frontend.
- Emscripten 3.1.56 rebuilds the pinned `wasm/nec2c` submodule.
- Rust 1.90.0 and MSVC are required only for the Tauri/NSIS package.

```powershell
git clone --recurse-submodules https://github.com/YOUR_NAME/HF-Antenna-Studio.git
Set-Location .\HF-Antenna-Studio\frontend
npm ci
npm run type-check
npm run lint
npm test
npm run build:wasm
npm run test:smoke
```

Build the solver first with `scripts/build-wasm.ps1` if the checked-in development Wasm artefacts are absent or the solver source changed. End users do not require these tools.

## Branches and commits

Create work from the latest appropriate completed branch. Use `feature/...`, `fix/...`, `docs/...`, or `release/...`; never develop directly on `main`. Pull requests to `main` must pass CI, solver/reference regressions, documentation review, provenance review, and the relevant Windows package gate.

Use Conventional Commits, for example:

```text
fix(solver): reject stale worker response
docs(validation): record finite-ground comparator limits
test(editor): preserve unsupported NEC cards on round trip
```

Release branches are audited in full and squash-merged to `main` only after their required gates pass. Release tags are annotated and never force-pushed.

## Engineering rules

- Use SI units in shared models and keep NEC syntax inside adapters.
- Do not change solver or modelling behaviour merely to match a reference number.
- Add tests for geometry, feed identity, segmentation, NEC generation, parsing, cancellation, stale-result handling, and invalid inputs as applicable.
- Do not claim a feature or antenna family is validated without an independent reference and a recorded tolerance.
- Preserve imported NEC source and unsupported-card diagnostics; do not silently rewrite a user's model.
- Keep the UI keyboard-operable, labelled, contrast-safe, and explicit about units, result currency, ground model, and modelling warnings.
- Preserve solver/source provenance and offline/private operation.

For release-affecting changes, update `CHANGELOG.md`, the relevant guide, [docs/KNOWN_LIMITATIONS.md](docs/KNOWN_LIMITATIONS.md), and [docs/VALIDATION_REPORT.md](docs/VALIDATION_REPORT.md) when evidence or scope changes.

## Pull request evidence

Include:

- what changed and why;
- exact commands/tests and results;
- RF/solver evidence and tolerances where calculation output changes;
- screenshots or keyboard steps for material UI changes;
- provenance/licence records for every external input; and
- known limitations and manual checks still required.

Report security issues privately to the repository owner rather than publishing exploit details before a fix is available. Ordinary bugs and feature proposals belong in the project issue tracker.
