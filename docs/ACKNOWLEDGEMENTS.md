# Acknowledgements and sources

HF Antenna Studio exists because radio amateurs, researchers, and open-source developers have shared decades of antenna knowledge, electromagnetic software, reference material, and practical experience. The project records that provenance with gratitude.

## Project creation

**Project creator, product vision, requirements, and project direction:** Colin Summers, MM0OPX.

**Software coding and documentation:** ChatGPT Codex, working under Colin Summers's direction, review, and acceptance.

HF Antenna Studio was created from Colin Summers's vision for a modern, locally hosted and privacy-preserving antenna-modelling application for radio amateurs. The product decisions, requested capabilities, modelling priorities, validation requirements, and release direction reflect his continuing direction of the project.

The use of ChatGPT Codex as a software-development tool does not imply sponsorship or endorsement by OpenAI. Git history remains the authoritative record of individual commits and inherited authorship.

## Open-source foundations

The project offers sincere thanks to:

- **EA1FUO and every AntennaSim contributor**, with particular thanks for creating and sharing **[AntennaSim](https://github.com/EA1FUO/AntennaSim)** under the GNU GPL. **HF Antenna Studio was forked from AntennaSim** at audited commit `96e153ceefffd25819e42142d591ca811b4790d3`; it is not a clean-room application that merely resembles it. The original project supplied the software foundation from which this application developed, and its Git authorship, licence, project name, source link, and exact fork point are retained as permanent provenance.
- **The KJ7LNW/nec2c maintainers and earlier NEC contributors**, whose [nec2c project](https://github.com/KJ7LNW/nec2c) makes a real NEC-2 calculation engine available for open-source use and reproducible WebAssembly builds. HF Antenna Studio does not present the electromagnetic solver as its own invention.
- **The authors and maintainers of React, Three.js, Tauri, Recharts, Zustand, TypeScript, Vite, Vitest, Playwright, and the project's other open-source dependencies.** Their work makes the local interface, visualisation, packaging, and test infrastructure possible. Exact versions and licence information are recorded in the lockfiles, software bill of materials, and [`THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md).

## Antenna and validation references

The project gratefully acknowledges the following technical sources:

- **Steve Hunt, G3TXQ**, for publishing the design rationale and bare-wire starting dimensions for the [G3TXQ Broadband Hexbeam](https://www.karinya.net/g3txq/hexbeam/broadband/) and its [technical explanation](https://www.karinya.net/g3txq/hexbeam/broadband_tech/). These sources inform the attributed single-band plan-view topology in HF Antenna Studio.
- **K4KIO**, whose [Hexbeam construction specifications](https://www.hex-beam.com/specs/) provide a useful independent construction-oriented cross-check of the published element dimensions and wire arrangement.
- **The 4NEC2 project and its contributors**, for providing an established NEC-oriented application used as a separately installed validation comparator. HF Antenna Studio does not distribute 4NEC2 or imply its endorsement. The comparator source page is [4NEC2](https://www.qsl.net/4nec2/Home.htm).
- **The NEC research and documentation community**, including the maintainers of the [NEC-2 user's-guide material](https://www.nec2.org/part_3/toc.html), for preserving the method, card definitions, examples, and modelling limitations on which responsible NEC use depends.
- **The engineering reference authors and standards community**, including the [IACS conductivity reference](https://ihiconnectors.com/IACS-conductivity-electrical-alloys.htm) and the [NEC-2 aluminium-conductor example](https://www.nec2.org/part_3/examples/ex2.html), for the public material data and examples used to bound the application's generic conductor presets. These references inform approximations; they do not identify a user's physical alloy.
- **Steve Ellingson**, for the published NEC-2 dipole reference used in the validation campaign, and **NBS/NIST**, for *Technical Note 688: Yagi Antenna Design*. Exact citations, comparison scope, model differences, and results appear in [`VALIDATION_REPORT.md`](VALIDATION_REPORT.md).

Published dimensions and numerical references are treated as attributed engineering facts. The project uses original coordinate-generation code, tests, documentation, and interface work; it does not copy proprietary source code, artwork, application layouts, manuals, or commercial model libraries.

## Radio community

Thanks also go to the amateur-radio operators, antenna builders, experimenters, educators, standards authors, and open-source contributors who publish measurements, identify modelling traps, and challenge software claims. Their habit of comparing simulation with construction and measurement is central to this project's validation-first approach.

## Attribution boundaries

Acknowledgement does not imply that any named person or project has reviewed, approved, sponsored, or endorsed HF Antenna Studio. Product claims and defects remain the responsibility of the HF Antenna Studio project. Licence obligations and redistribution notices are defined by [`LICENSE`](../LICENSE), [`THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md), and [`LICENSING.md`](LICENSING.md); this page supplements rather than replaces them.

If a source or contributor has been omitted or described inaccurately, please open an issue with the relevant file, model, or reference so the record can be corrected.
