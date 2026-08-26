# HF Antenna Studio — Windows 11 Packaging

Status: distributable test-build architecture

Last reviewed: 2026-08-07

## Outcome

HF Antenna Studio uses a minimal Tauri 2 host for its Windows 11 x64 release package. The host embeds the production React/Vite assets and the exact nec2c WebAssembly files produced from the pinned solver submodule. A normal user installs one per-user NSIS setup executable and does not install Node.js, Python, Rust, Emscripten, Docker, Redis, or a separate NEC executable.

This is a packaging selection, not a new electromagnetic solver selection. The package exercises the currently validated browser/Wasm pipeline while D-005's native nec2c versus NEC2++ product bake-off remains open. No RF calculation code or expected result was changed for packaging.

## Evaluated approaches

| Approach | Offline/local fit | Installer and uninstall | Footprint/support cost | Decision |
|---|---|---|---|---|
| Edge PWA | The existing frontend can cache assets and appear in the Start menu, but initial deployment, browser policy/profile state, storage clearing, diagnostics, and controlled solver/version delivery remain browser-owned. | Edge provides install/uninstall integration, but the project would not own a conventional distributable installer. | Smallest payload, weaker reproducibility and support boundary. | Keep as a possible demo/discovery route, not the primary Windows package. |
| Browser plus packaged localhost service | Can invoke a native process but adds a listening port, service lifecycle, firewall/origin policy, and two installation/runtime surfaces. | Requires custom service installation and cleanup. | Larger operational and security surface than needed for the current Wasm engine. | Rejected for v1. |
| Electron | Provides a consistent bundled Chromium/Node runtime and mature packaging. Electron explicitly embeds Chromium and Node. | Conventional Windows packaging is available through Electron tooling. | Reliable but duplicates the WebView already supplied by Windows 11 and materially increases update and distribution payload. | Retain only as fallback if WebView2/Tauri fails supported-machine testing. |
| Tauri 2 plus system WebView2 | Embeds the existing frontend without a localhost server. Windows 11 distributes Evergreen WebView2 as an OS component; the NSIS package still includes Microsoft's small bootstrapper/check. | Per-user launcher, Start-menu entry, Apps uninstall registration, and clean program removal. | Small native host and no duplicate browser engine. | **Selected for v1.0.0.** |
| Tauri 2 plus WebView2 offline installer/fixed runtime | Supports installation on a disconnected or unusually stripped Windows image. | Same application installer behaviour. | Tauri documents roughly 127 MB extra for the offline installer and roughly 180 MB for fixed runtime. The application then carries browser servicing consequences. | Provide an explicit larger build variant only after air-gapped testing. |

Primary references: [Tauri Windows installers and WebView2 modes](https://v2.tauri.app/distribute/windows-installer/), [Microsoft WebView2 distribution](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution), [Tauri security capabilities](https://v2.tauri.app/security/capabilities/), [Tauri CSP guidance](https://v2.tauri.app/security/csp/), [Electron packaging](https://www.electronjs.org/docs/latest/tutorial/application-distribution), and [Microsoft Edge PWA installation](https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/ux).

## Runtime architecture

```text
NSIS per-user installer
  └─ HF Antenna Studio.exe (small Tauri/Rust host)
       ├─ system Evergreen WebView2
       ├─ bundled HTML/CSS/JavaScript
       ├─ bundled nec2c.js + nec2c.wasm
       ├─ browser-local project library/recovery journal
       └─ three native diagnostic commands
            ├─ report package version/storage/log path
            ├─ append bounded diagnostic record
            └─ open the log directory
```

There is no Python process, Node.js runtime, local HTTP listener, Redis instance, cloud account, telemetry client, automatic update client, or remote calculation endpoint in the package. A restrictive CSP permits bundled assets, WebAssembly, workers, and Tauri IPC but has no external network origin in `connect-src`.

## Solver identity

The distributable build runs KJ7LNW nec2c/WebAssembly v1.3.3 from source commit `55be1e0e3fe5ee9dad4ce6050711450d19c562fd`. The Windows packaging workflow:

1. checks out the solver submodule recursively;
2. installs pinned Emscripten 3.1.56;
3. rebuilds `nec2c.js` and `nec2c.wasm` from source;
4. builds the frontend with `VITE_ENGINE=wasm`;
5. embeds those generated files in the Tauri package;
6. runs a real dipole solve inside the installed WebView2 application with browser networking forced offline; and
7. creates and hashes a corresponding-source ZIP with the exact solver submodule expanded.

The campaign in [`VALIDATION_REPORT.md`](VALIDATION_REPORT.md) defines what has and has not been numerically validated. Packaging does not broaden those claims.

## Installation

1. Download the `HF Antenna Studio_*_x64-setup.exe` and `package-manifest.json` from the v1.0.0 release.
2. Verify its published SHA-256 value in `package-manifest.json`.
3. Run the setup executable. The current test build installs for the current user and should not request administrator rights.
4. Launch **HF Antenna Studio** from the Start menu.
5. Confirm the version in the title navigation or **About** page.

Windows 11 normally includes the Evergreen WebView2 runtime. The small installer includes the WebView2 bootstrapper/check; if a stripped machine lacks WebView2, completing that prerequisite can require a network connection during installation. Once installed, ordinary antenna calculations and project operations are local and require no connection.

For a genuinely disconnected installation image, build with `scripts/package-windows.ps1 -OfflineInstaller`. This merges `src-tauri/tauri.offline.conf.json` and embeds Microsoft's substantially larger offline WebView2 installer. That variant is not a release claim until tested in an air-gapped clean VM.

## Projects, uninstall, and recovery

Projects remain in the dedicated WebView profile's browser-local storage unless the user explicitly exports a `.hfas` file. Autosave/recovery and schema migration retain the rules in [`PROJECT_FILE_FORMAT.md`](PROJECT_FILE_FORMAT.md).

The NSIS uninstaller removes the program files and launcher registration. It intentionally does not delete the application's local user-data/log directory; this protects unsaved project-library data from an ordinary uninstall or upgrade. Users who want a complete data removal can export any required `.hfas` files, uninstall, and then remove the documented application-data directory manually. A future UI data-management command must require explicit confirmation and must not be tied to ordinary uninstall.

Before moving to a different Windows account, machine, or clean OS installation, export important projects. Browser-local storage is not a substitute for a separately backed-up project file.

## Version and troubleshooting logs

`VERSION`, `frontend/package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json` must agree. `scripts/check-package-version.ps1` fails the build on drift. The version is shown continuously in the navigation and on the About page.

The installed host writes `hf-antenna-studio.log` under:

```text
%LOCALAPPDATA%\uk.co.mm0opx.hfantennastudio\logs\
```

The About page reports the resolved location and provides **Open log folder**. Logs contain startup, frontend initialization, explicitly forwarded warning/error records, and uncaught frontend errors. Input geometry, full projects, NEC decks, measurement files, and solver results are not deliberately logged. Log strings are single-line and bounded to 4,000 characters; release review must still inspect accidental sensitive content.

Troubleshooting order:

1. record the displayed application version;
2. export important projects before clearing data or reinstalling;
3. open the log folder from About and retain the latest log;
4. note Windows build, WebView2 version, GPU/driver, antenna workflow, and exact action that failed;
5. retry the verified-dipole model to distinguish general solver startup from model-specific failure; and
6. attach a project only after reviewing it for private antenna/location information.

## Reproducible maintainer build

Build requirements are for maintainers/CI only, never end users:

- Windows 11 x64;
- Node.js 24.14.0 and npm 11;
- Rust 1.90.0 with the MSVC target and Visual Studio C++ Build Tools;
- Tauri CLI 2.11.2, installed from the exact npm lockfile by `npm ci`;
- Emscripten 3.1.56; and
- recursively checked-out solver submodule.

From the repository root:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-wasm.ps1 -EmsdkPath C:\path\to\emsdk
Set-Location .\frontend
npm ci
Set-Location ..
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\package-windows.ps1 -SkipDependencyInstall
```

The release-candidate installer appears under `src-tauri/target/release/bundle/nsis/` with a generated `package-manifest.json`. Build outputs and generated icons are ignored and must not be committed.

## Automated package acceptance

The clean `windows-latest` workflow performs:

- source rebuild of the pinned Wasm solver;
- version synchronization and production frontend build;
- Tauri/NSIS release build;
- silent per-user installation;
- uninstall-registry and launcher checks;
- installed WebView2 startup;
- package identity and diagnostic IPC checks;
- a real verified-dipole solve while the WebView context is offline;
- real single-vertical and phased-array solves using explicit raised radial wires over Sommerfeld/Norton ground while the WebView context is offline;
- rejection of any external HTTP/HTTPS request during that solve;
- diagnostic-log creation;
- silent uninstall and launcher removal; and
- uninstall/reinstall confirmation that an actual WebView local-storage sentinel survives, plus an application-data-directory preservation check.

The workflow artifact is a release-candidate build, retained for 14 days. The exact accepted installer is promoted to the GitHub release with its manifest, corresponding-source ZIP and source checksum. It is unsigned. SmartScreen reputation, code signing, upgrade/repair, Windows ARM64, enterprise policy, non-ASCII Windows profiles, endpoint security, 100–200% DPI, High Contrast, Narrator, GPU/software rendering, and a genuinely air-gapped installer remain accepted unvalidated platform combinations rather than v1.0.0 claims.

The post-v1 ground-radial branch extends the installed-app smoke beyond the frozen v1 dipole gate. The browser-equivalent offline checks pass locally; the native install/uninstall rerun requires the Windows Rust/NSIS build host and remains pending until the branch can run there. Once that gate passes, it proves bundled solver execution, current-table parsing, navigation, and absence of external requests for the exact raised-wire models. It does not broaden the numerical-validation limits in `VALIDATION_REPORT.md`.

## Known limitations

- The current package uses the D-031-selected, validation-bounded Wasm adapter. Native candidates remain post-v1 alternatives and are not an undecided v1 dependency.
- The preferred small installer assumes the Windows 11 Evergreen runtime is serviceable; it is not an air-gapped-install claim.
- The v1.0.0 installer is not code-signed and may trigger Windows reputation warnings; verify its published SHA-256.
- Browser-local project storage is preserved but is not yet replaced by atomic native filesystem storage.
- Logs are bounded operational diagnostics, not a complete raw solver-output archive.
- Automatic updating is deliberately absent; normal operation makes no update/network request.
- Installer repair, in-place downgrade, multi-user installation, and ARM64 packages are not yet supported claims.
- The final locked frontend graph must pass `npm audit`; Rust dependencies are checked by RustSec in CI. A release candidate with a known applicable high-severity advisory is blocked.
