# Third-party notices

This notice accompanies HF Antenna Studio v1.0.0. It is an attribution and inventory, not a replacement for the applicable licence texts. The exact dependency graph is pinned by `frontend/package-lock.json`, `src-tauri/Cargo.lock`, and the `wasm/nec2c` Git submodule. `SBOM.frontend.cdx.json` provides a machine-readable JavaScript inventory.

## AntennaSim-derived source

HF Antenna Studio began from EA1FUO/AntennaSim at commit `96e153ceefffd25819e42142d591ca811b4790d3`, distributed under GNU GPL version 3 or later. Git history retains original authorship and the repository retains the GPL text in `LICENSE`. HF Antenna Studio contributors have extensively modified the application and preserve that provenance rather than presenting the work as a clean-room implementation.

Source: <https://github.com/EA1FUO/AntennaSim/tree/96e153ceefffd25819e42142d591ca811b4790d3>

## nec2c / NEC-2 solver

The packaged solver is built from KJ7LNW/nec2c tag `v1.3.3`, commit `55be1e0e3fe5ee9dad4ce6050711450d19c562fd`. The upstream tree contains its complete `COPYING` file at `wasm/nec2c/COPYING`, original program history, copyright/warranty comments, and build source. Its README describes a C translation of the original NEC-2 FORTRAN and notes the incorporated SOMNEC implementation.

Historical licensing descriptions for nec2c are not perfectly uniform. HF Antenna Studio therefore preserves all upstream notices and handles the distributed solver conservatively under GPLv3 rather than advertising it as unambiguously public domain. The exact source and build scripts are included in this repository.

Source: <https://github.com/KJ7LNW/nec2c/tree/55be1e0e3fe5ee9dad4ce6050711450d19c562fd>

## Application runtime libraries

The HTML application directly uses React, React DOM, React Router, Three.js, React Three Fiber, Drei, React Three Postprocessing, postprocessing, Recharts, Zustand, and three-stdlib. Those packages declare MIT licences in the pinned npm inventory. Their transitive dependencies and exact versions are listed in the lockfile and frontend SBOM.

The Windows host directly uses:

- Tauri and tauri-build, licensed Apache-2.0 OR MIT by their authors; and
- Serde, licensed Apache-2.0 OR MIT by its authors.

Their exact transitive Rust versions are in `src-tauri/Cargo.lock`. No Tauri plugin beyond the core host is enabled in v1.0.0.

## Build and installer components

Vite, TypeScript, Tailwind CSS, ESLint, Vitest, Playwright, Emscripten and the Rust toolchain are build/test tools and are not shipped as independent user runtimes. The Tauri toolchain builds an NSIS installer. The package uses Windows WebView2; the preferred small installer uses Microsoft's Evergreen bootstrapper only when WebView2 is absent. Microsoft's applicable WebView2 redistribution terms remain applicable to that component.

HF Antenna Studio does not bundle 4NEC2, AN-SOF, EZNEC, NanoVNA software, their example libraries, or their interface assets. 4NEC2 is an independently installed black-box validation comparator only.

## Project-authored assets and data

The HF Antenna Studio UI, current waveform mark, release documentation, validation runners, and application-authored NEC fixtures are distributed under GPL-3.0-or-later. External publications used as references are linked and summarized; their PDFs, figures, tables, and substantial prose are not redistributed.

## Obtaining source and licence information

The GitHub release for v1.0.0 includes `hf-antenna-studio-1.0.0-corresponding-source.zip`. Unlike GitHub's automatic repository archive, this release asset expands `wasm/nec2c` at the exact pinned commit and includes the application source, build scripts, lockfiles, GPL text, notices, SBOM and a source manifest. Git history and the tag remain at <https://github.com/MM0OPX-Projects/HF-Antenna-Studio>. In the installed application, **About → Licences and notices** opens an offline summary.

If an attribution or licence record appears incomplete, please report the exact package/file and release version before redistributing a modified binary.
