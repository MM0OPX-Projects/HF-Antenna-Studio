# HF Antenna Studio — Licensing and Attribution Plan

Status: project recommendation and release checklist, not legal advice
Last reviewed: 2026-08-02

## Recommended project license

Use **GNU GPL-3.0-or-later** for HF Antenna Studio's combined application distribution.

Reasons:

- The audited EA1FUO/AntennaSim repository grants GPL version 3 or later. Selectively copying or adapting its code must preserve compatible GPL terms and notices.
- The KJ7LNW/nec2c source used by AntennaSim has ambiguous public-domain/GPL signals. Treating the exact distributed solver and combined installer conservatively under GPL terms avoids a falsely permissive release while provenance is resolved.
- NEC2++ is GPL-2.0-or-later; a distributor can select GPLv3 for a combined GPLv3 work, subject to verifying the exact files and dependencies.
- A single strong-copyleft policy is easier for contributors and recipients to understand than implying that process separation erases all obligations.

Use SPDX identifier:

```text
GPL-3.0-or-later
```

The AntennaSim baseline import includes the complete GPL-3.0-or-later text and upstream copyright notice at repository root, and the frontend/backend package metadata now uses the same SPDX expression. Public binary distribution is still gated on the remaining checklist, especially solver provenance, third-party notices, corresponding source, and branding/assets review.

## Verified-dipole branch checkpoint

The `feature/verified-dipole-model` work adds no runtime or development dependency and remains part of the GPL-3.0-or-later AntennaSim-derived source tree. The feature's new TypeScript, tests, and original UI are distributed under the repository license; existing shared AntennaSim components retain their upstream history and notices.

External validation handling is consistent with the comparator policy:

- the Ellingson Virginia Tech/UNM memo is linked and only selected factual scalar results plus an independently authored summary are recorded; the PDF and its figures are not copied into the repository;
- no rftools.io code, output file, screenshot, interface artwork, or model asset is committed;
- PyNEC/necpp was evaluated but is not installed, linked, bundled, or added as a dependency;
- no 4NEC2, EZNEC, or AN-SOF artifact is included;
- the `HF Antenna Studio` name is applied as original product text, while AntennaSim provenance remains explicit in the baseline documentation.

This checkpoint does not resolve the pinned nec2c provenance or approve a public binary distribution. The existing solver and release checklist remains open and unchanged.

If the project later decides to avoid all GPL-covered reuse and chooses a differently licensed solver arrangement, relicensing new original code would require contributor agreement and a new documented decision. The current architecture does not assume that future path.

## Audited upstream classifications

### EA1FUO/AntennaSim

- Audited commit: [`96e153ceefffd25819e42142d591ca811b4790d3`](https://github.com/EA1FUO/AntennaSim/tree/96e153ceefffd25819e42142d591ca811b4790d3).
- Root license: GNU GPL version 3 with “or later” permission and an AntennaSim contributor notice.
- GitHub's automated `NOASSERTION` classification is not a grant; read the actual license file.
- Reused files require retained notices, source attribution, compatible distribution terms, and corresponding source.
- Concepts and facts are not licensed like copied expression, but a “conceptual rewrite” must not be used to erase actual copied code/text/art provenance.

### KJ7LNW/nec2c

- AntennaSim pins commit [`55be1e0e3fe5ee9dad4ce6050711450d19c562fd`](https://github.com/KJ7LNW/nec2c/tree/55be1e0e3fe5ee9dad4ce6050711450d19c562fd).
- The README describes nec2c as public domain, while `COPYING` contains GPLv3; [Fedora's package metadata](https://packages.fedoraproject.org/pkgs/nec2c/nec2c/index.html) classifies its package as GPL-3.0-only.
- Source headers contain government-origin/warranty history that must be traced to the original conversion and later contributions.
- Until counsel or a documented provenance review resolves the inconsistency, preserve all notices, comply with GPLv3 source obligations for the shipped source/binary, and do not advertise the component as public domain.
- Record every local patch and the complete reproducible Windows build recipe.

### NEC2++

- Audited commit: [`865851d15c5de8e64054adf5621a12e5b9984233`](https://github.com/tmolteno/necpp/tree/865851d15c5de8e64054adf5621a12e5b9984233).
- Project/source notices indicate GPL-2.0-or-later; verify each bundled subtree and generated/binary component.
- Its bundled Eigen and other dependencies require their own notice/license review.
- If selected, record whether the CLI, library, wrapper, test data, and Wasm artifacts have different applicable notices.

No solver is approved for redistribution merely by appearing in this list. Approval applies to an exact pinned source, patch set, build, and bundle after checklist review.

## Combined distribution policy

The Windows installer is considered one product distribution for compliance planning even when the solver runs as a child process. It will include or provide, as required:

- HF Antenna Studio corresponding source;
- the exact solver corresponding source;
- build and installation scripts needed to reproduce modified binaries;
- local patches in source form;
- GPL license text and warranty disclaimer;
- copyright notices and attribution;
- third-party notices/licenses;
- source commit and binary hash information;
- a clear route from the About/Licenses screen to the bundled offline notices.

Do not rely on a subprocess boundary as a legal conclusion that would permit incompatible licensing. Seek qualified advice if the distribution model or intended license changes.

## Original product identity

HF Antenna Studio will create its own:

- name treatment, icon, logo, color system, layout, illustrations, screenshots, and marketing assets;
- application wording, tutorials, help, validity explanations, examples, and templates;
- code and design system except for explicitly attributed open-source reuse.

AN-SOF, 4NEC2, EZNEC, AntennaSim, NEC2++, and nec2c names are used factually and remain associated with their respective owners/projects. Do not imply sponsorship or compatibility beyond evidence. Complete a trademark/name search for “HF Antenna Studio” before public launch.

## Proprietary comparator policy

4NEC2, EZNEC, and AN-SOF can inform workflow research and black-box numeric comparison. The project must not copy their:

- executable/source code or proprietary algorithms;
- icons, artwork, screenshots, chart styles, or other visual assets;
- documentation/help text or sample collections without compatible permission;
- branding, distinctive trade dress, or marketing copy;
- bundled solver/data files outside their distribution terms.

Validation records should prefer independently authored NEC decks and numeric tables of selected results. Store screenshots, full output files, or redistributed example decks only after checking their terms. Record application version and settings without implying endorsement.

## AntennaSim reuse procedure

Before copying/adapting a file:

1. Record upstream repository, exact commit, source path, original copyright header, and license.
2. Decide whether the file is copied, modified, translated, or only consulted.
3. Preserve existing notices; add an HF Antenna Studio modification notice without deleting authorship.
4. Add the source to a machine-readable provenance inventory and human-readable third-party notice where appropriate.
5. Review transitive imports/assets; do not copy an entire directory to obtain one component.
6. Replace AntennaSim branding, remote URLs, screenshots, sample data, and version text unless separately appropriate and attributed.
7. Add HF Antenna Studio contract/validation tests before treating the component as supported.
8. Include the adapted source in corresponding-source releases.

Git history can preserve useful authorship, but a commit hash and notice inventory are still required because selective file imports can obscure history.

## Source and asset provenance records

Maintain records with at least:

```text
component/package/file
version or commit
source URL
copyright holders/notices
SPDX license expression
use: build/dev/runtime/test/data/asset
modified? patch location
distributed? target artifact
source-offer/corresponding-source location
reviewer/date/notes
```

Separate categories include:

- npm and Cargo packages;
- Tauri CLI/runtime/plugins;
- WebView2 runtime/installer redistribution terms;
- Rust/Node/compiler/build-tool redistribution;
- native solver source and runtime libraries;
- Emscripten/Wasm tooling if later used;
- fonts, icons, color palettes, images, sample antenna models, and documentation excerpts;
- validation decks, raw reference outputs, and comparator records;
- installer/bootstrapper/signing components.

Generated code is not automatically unencumbered; record the generator and template/runtime terms.

## Contributor licensing

Recommended initial policy:

- accept contributions under the repository's GPL-3.0-or-later terms through a Developer Certificate of Origin sign-off;
- state in `CONTRIBUTING.md` that contributors must have the right to submit code, data, docs, and assets;
- do not require a broad copyright assignment without a separately reviewed reason;
- reject code pasted from proprietary applications, decompiled material, disallowed AI training/output sources, or unattributed forums/books;
- require provenance for validation models and expected values;
- allow project maintainers to request replacement of questionable assets/data.

If future dual licensing is contemplated, contributor terms must be redesigned before accepting contributions under that model; it cannot be assumed retroactively.

## Release licensing checklist

### Repository baseline

- [ ] Complete GPL-3.0 license text at root.
- [ ] Package metadata uses `GPL-3.0-or-later` consistently.
- [ ] Copyright/authorship policy documented.
- [ ] `CONTRIBUTING.md` includes DCO/provenance requirements.
- [ ] `LICENSES/` or `licenses/` contains required third-party license texts.
- [ ] `THIRD_PARTY_NOTICES` identifies distributed components and assets.
- [ ] Source files carry appropriate SPDX identifiers/notices according to project policy.

### Solver

- [ ] Exact source repository, commit/tag, and archive hash recorded.
- [ ] License/provenance ambiguity resolved or approved under conservative terms.
- [ ] Every patch is documented and included.
- [ ] Windows compiler/toolchain, flags, and dependencies recorded.
- [ ] Binary SHA-256 and reproducible-build status published.
- [ ] Corresponding source and build/install scripts ship or are durably offered as required.
- [ ] Upstream notices/warranty disclaimers retained.
- [ ] Test/reference files reviewed separately from program-source licensing.

### Application dependencies and assets

- [ ] Lock files match release build.
- [ ] SBOM covers desktop, JavaScript, Rust, native solver, runtime libraries, installer, and assets.
- [ ] Automated license scan reviewed manually for unknown/custom/dual licenses.
- [ ] Copyleft compatibility reviewed for linked and bundled components.
- [ ] Fonts/icons/images/themes have compatible redistribution/modification terms and attribution.
- [ ] WebView2 offline/fixed-runtime redistribution complies with Microsoft's applicable terms.
- [ ] No CDN-only or remotely licensed runtime asset is required offline.
- [ ] No proprietary comparison-package artifact is bundled without permission.

### AntennaSim-derived material

- [ ] File-level source commit/path provenance recorded.
- [ ] Original notices retained.
- [ ] Adaptation/modification notice added where appropriate.
- [ ] Source included in the GPL corresponding-source bundle.
- [ ] Branding/assets/text reviewed and replaced unless intentionally licensed/attributed.

### Documentation and validation

- [ ] Every external deck/table/image has source and license/permission metadata.
- [ ] Quotations are minimal, attributed, and legally reviewed where needed.
- [ ] 4NEC2/EZNEC/AN-SOF references are factual and do not imply endorsement.
- [ ] NEC manual links/citations are recorded; redistribution of copies follows site/document terms.
- [ ] Validation output redistribution is permitted, or only original reviewed summaries are shipped.

### Installer and release

- [ ] About/Licenses view works offline.
- [ ] Installer includes applicable license and notice access.
- [ ] Binary and source release versions correspond.
- [ ] Source download remains available for the required period/distribution method.
- [ ] Checksums, signatures, SBOM, and provenance attestations identify the exact artifacts.
- [ ] No license text is contradicted by an EULA, store term, or installer restriction.
- [ ] Export/control or jurisdiction-specific obligations have been considered by the distributor.

## Internal consistency rules

The `feature/antenna-template-system` implementation adds original project TypeScript, tests, and documentation under the existing GPL-3.0-or-later project terms. It adds no runtime dependency, copied proprietary asset, bundled comparator output, or externally sourced numeric validation table. The template regression values are generated locally and are explicitly not represented as independent reference data. Future externally sourced decks/results still require the documentation-and-validation checklist above.

The `feature/vertical-antennas` implementation likewise adds original project code, tests, documentation, and three application-generated ideal-monopole NEC fixtures under the existing project terms. The separate NEC-2 User's Guide Example 10 fixture is a short functional input deck transcribed from the cited official guide/sample source and must retain its source/provenance note; its redistribution status still requires release review. The local 4NEC2 installation and `nec2dxs11k.exe` are external comparison tools only: neither executable nor proprietary application asset is copied or bundled. The committed comparator script records locally generated numeric summaries and the executable hash, not a 4NEC2 binary or raw packaged output.

- Documentation must say GPL-3.0-or-later for HF Antenna Studio unless a later ADR changes it.
- Do not call KJ7LNW/nec2c unambiguously public domain while its provenance is unresolved.
- Do not describe a solver as “open-source and approved” until its exact source and bundle pass review.
- Do not call 4NEC2, EZNEC, or AN-SOF project dependencies; they are external comparison tools.
- A new repository does not remove obligations for copied AntennaSim material.
- A native process boundary is an engineering isolation mechanism, not a license exemption.

## Questions requiring qualified review

- The precise status of original NEC-2 government-origin code, the C conversion, and later KJ7LNW contributions.
- Whether any desired reference output/deck can be redistributed or should remain a locally generated/manual comparison record.
- WebView2 runtime redistribution terms for the chosen offline packaging mode.
- The project-name/trademark search.
- Any future plugin/solver interface intended for proprietary third-party modules.
- Any proposal to relicense, dual-license, distribute through an app store, or include a non-GPL-compatible dependency.
