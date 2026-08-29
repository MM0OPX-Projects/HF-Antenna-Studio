# HF Antenna Studio licensing and attribution

Status: v1.0.0 engineering compliance record; not legal advice
Last reviewed: 2026-08-29

Project-creator credits and professional thanks are recorded in [`ACKNOWLEDGEMENTS.md`](ACKNOWLEDGEMENTS.md). That page is complementary context; the licence and redistribution obligations remain those stated here, in the root `LICENSE`, and in `THIRD_PARTY_NOTICES.md`.

## Distribution position

HF Antenna Studio is distributed as a combined work under `GPL-3.0-or-later`. The root `LICENSE` contains the complete GNU GPLv3 text and the package metadata uses the same SPDX expression. Release source includes the exact dependency lockfiles, solver submodule reference/source, build/test scripts, notices, and machine-readable frontend SBOM.

This conservative GPL position is required because:

- HF Antenna Studio is derived from GPL-3.0-or-later EA1FUO/AntennaSim source;
- the pinned KJ7LNW/nec2c solver tree contains a GPLv3 `COPYING` file alongside less uniform historical provenance wording; and
- a process, worker, or Wasm boundary is an engineering mechanism, not an assumed licence exemption.

The project does not claim that a new name or repository removes inherited obligations. It does not advertise nec2c as unambiguously public domain.

## Provenance

### EA1FUO/AntennaSim

- Audited/import source: commit `96e153ceefffd25819e42142d591ca811b4790d3`.
- Licence: GNU GPL version 3 or later in the upstream root licence.
- Treatment: Git history and attribution retained; public README, product identity, documentation and UI claims replaced with HF Antenna Studio originals. Adapted source is included in corresponding source.

### KJ7LNW/nec2c

- Source/tag: commit `55be1e0e3fe5ee9dad4ce6050711450d19c562fd`, tag `v1.3.3`.
- Distributed form: project-built `nec2c.js` and `nec2c.wasm` plus exact pinned source and build scripts.
- Notices: upstream README, source headers and `wasm/nec2c/COPYING` are retained.
- Patches: the submodule is clean; project-specific build integration is outside it under `wasm/` and `scripts/`.
- Position: distribute conservatively under GPLv3 while explicitly recording the unresolved historical wording. This is an engineering release decision, not a legal adjudication of every NEC-era contribution.

### Application dependencies

Direct browser runtime dependencies (React, React DOM, React Router, Three.js, React Three Fiber/Drei/Postprocessing, postprocessing, Recharts, three-stdlib and Zustand) declare MIT licences. Direct Rust dependencies Tauri/tauri-build and Serde declare Apache-2.0 OR MIT. The exact transitive inventories are pinned by `frontend/package-lock.json` and `src-tauri/Cargo.lock`; `THIRD_PARTY_NOTICES.md` explains their use and the frontend CycloneDX SBOM lists resolved packages.

The build uses Node/npm, Vite, TypeScript, Tailwind, ESLint, Vitest, Playwright, Emscripten, Rust and NSIS/Tauri tooling. These are build/test inputs rather than separately installed end-user prerequisites. Windows WebView2 remains subject to Microsoft's applicable terms; the preferred package embeds its small bootstrapper/check and does not claim the untested larger air-gapped redistribution variant.

## Assets, validation, and external software

- The HF Antenna Studio icon, waveform mark, layout, wording and current documentation are project-authored and GPL-3.0-or-later.
- No CDN font/image/icon package is required at runtime.
- Project-authored NEC fixtures and comparator scripts are GPL-3.0-or-later.
- External publications are linked and paraphrased; their PDFs, images, substantial prose and tables are not bundled.
- The G3TXQ broadband Hexbeam generator uses project-authored coordinate code derived from factual half-driver, reflector and tip-spacing dimensions published by Steve Hunt G3TXQ and cross-checked against K4KIO's construction specifications. No source diagram, spreadsheet, EZNEC deck, article text, website artwork or commercial asset is bundled or copied into the interface.
- 4NEC2 is installed separately by the validation operator. No 4NEC2 executable, model library, screenshot, artwork or raw packaged output is distributed.
- AN-SOF and EZNEC are factual reference names only. No code, algorithm implementation, artwork, trade dress, help text or bundled asset is copied.
- NanoVNA software/fixtures are not bundled. User measurement files remain user data.

## Contributor policy

`CONTRIBUTING.md` requires Developer Certificate of Origin sign-off and provenance for code, data, models, expected values, assets and excerpts. Contributors must have the right to submit their work under GPL-3.0-or-later. Proprietary/decompiled source, copied commercial assets/layouts, and unattributed reference material are rejected.

## v1.0.0 release checklist

### Satisfied engineering controls

- [x] Complete GPLv3 licence at repository root and package metadata aligned to `GPL-3.0-or-later`.
- [x] DCO and provenance requirements documented.
- [x] AntennaSim origin and exact audited commit recorded; Git authorship retained.
- [x] nec2c repository, exact tag/commit, source, upstream notices, clean submodule and reproducible Emscripten build recorded.
- [x] Lockfiles match the release build and the frontend resolved dependency graph has a CycloneDX SBOM.
- [x] Direct runtime licence expressions manually reviewed; exact transitive graphs retained in lockfiles/SBOM.
- [x] No remote runtime asset, cloud service, proprietary comparator binary, proprietary model collection or commercial interface asset is bundled.
- [x] Public claims distinguish same-method numerical comparison from independent physical truth.
- [x] Offline About page presents project, solver, dependency, source and warranty notices; the NSIS installer presents the complete GPL text.
- [x] `THIRD_PARTY_NOTICES.md` accompanies source and packaged UI notice; the release workflow creates a corresponding-source ZIP that expands the exact solver submodule instead of relying on GitHub's gitlink-only automatic archive.
- [x] Installer manifest identifies version, solver source and SHA-256 of the exact setup executable.
- [x] No project EULA or installer restriction contradicts GPL rights.

### Explicitly not claimed

- Code signing/signature and SmartScreen publisher reputation are not present in v1.0.0; the SHA-256 manifest is the published integrity control.
- A full cross-ecosystem legal-opinion SBOM/attestation covering WebView2, Windows, NSIS and every build tool is not claimed. Those platforms/tools are named and exact application graphs are locked.
- The optional fully offline WebView2 installer variant is not distributed as the v1.0.0 supported package.
- Trademark clearance and a formal legal opinion on NEC/nec2c historical provenance have not been obtained.
- No export-control or jurisdiction-specific legal advice is represented by this engineering checklist; the distributor remains responsible for applicable law.

These limitations are disclosed in `docs/KNOWN_LIMITATIONS.md`. They do not alter recipients' GPL rights or the no-warranty statement.

## Release consistency rules

- Describe HF Antenna Studio as GPL-3.0-or-later.
- Describe the v1 solver exactly as pinned nec2c/WebAssembly NEC-2, not as a novel or universally validated solver.
- Do not call 4NEC2, EZNEC, AN-SOF or NanoVNA project dependencies or imply their endorsement.
- Keep all derived source and solver corresponding source available with each distributed binary version.
- Review every new dependency, external deck/result, asset and installer component before a later release.
- A future solver/licence/distribution change requires an ADR plus an updated notice, SBOM, compatibility review and validation campaign.
