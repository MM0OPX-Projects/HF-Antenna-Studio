# Installation and troubleshooting — v1.0.0

## Supported package

HF Antenna Studio v1.0.0 supports Windows 11 x64 through a per-user NSIS installer. The package contains the HTML/JavaScript application and the pinned nec2c/WebAssembly solver. End users do not install Node.js, Python, Docker, Rust, Emscripten, or an NEC executable.

The installer is unsigned. Only download it from the project's GitHub v1.0.0 release and verify its checksum before running it.

## Install

1. Download `HF Antenna Studio_1.0.0_x64-setup.exe` and `package-manifest.json` from the release.
2. In PowerShell, calculate the checksum:

   ```powershell
   Get-FileHash -Algorithm SHA256 '.\HF Antenna Studio_1.0.0_x64-setup.exe'
   ```

3. Compare every character with `installerSha256` in the manifest. Stop if it differs.
4. Run setup. It installs for the current Windows user and creates a Start-menu launcher.
5. Launch the application, open **About**, and confirm version `1.0.0`.
6. Open the verified dipole model, run a calculation, and confirm R, X, SWR and plots appear without an engine error.

SmartScreen may report an unknown publisher because v1.0.0 is not code-signed. A correct checksum verifies the downloaded bytes match the published artifact; it does not create publisher identity.

## Offline boundary

Windows 11 normally includes Evergreen WebView2. The small installer contains a bootstrapper/check and can require internet access if the runtime is missing or damaged. After the prerequisite and application are installed, normal modelling, saving, import/export, and solver calculations require no network connection or account.

The package has no telemetry, update client, calculation server, or external runtime asset. Its content-security policy blocks external network origins. External links on About/help are optional documentation links and are not used by calculations.

## Projects, autosave, and recovery

- Named projects, recent-project metadata, autosave, and the recovery journal are stored in the application's WebView profile.
- Use **Project → Export** to create a portable `.hfas` backup before clearing data, reinstalling Windows, or moving accounts/machines.
- Recovery is offered after an unexpected closure when a valid newer recovery snapshot exists.
- A future-schema project is rejected without overwriting the original file.
- Imported files and measurement samples remain local unless the user explicitly exports/shares them.

Ordinary uninstall removes the executable and launcher but intentionally preserves local project data and logs. To remove everything: export needed projects, uninstall, then manually delete `%LOCALAPPDATA%\uk.co.mm0opx.hfantennastudio` only after verifying the path and contents.

## Logs

Open **About → Open log folder**. The expected directory is:

```text
%LOCALAPPDATA%\uk.co.mm0opx.hfantennastudio\logs\
```

Logs contain bounded startup/frontend diagnostic messages, not deliberate full projects, NEC decks, measurements, or results. Review a log before sharing it.

For a useful problem report include application version, Windows build, WebView2 version, GPU/driver, model workflow, exact steps, visible modelling warnings, and the most recent log. Export a project only after checking it for private coordinates or construction information.

## Uninstall and update

Use **Settings → Apps → Installed apps → HF Antenna Studio → Uninstall**. v1.0.0 has no automatic updater. Verify the checksum of every later installer. Downgrade/repair and multi-user enterprise deployment are not supported release claims.

## Maintainer build

Required: Git with recursive submodules, Node.js 24.14.0/npm 11, Emscripten 3.1.56, Rust 1.90.0 with MSVC and Visual Studio C++ build tools.

```powershell
git clone --recurse-submodules https://github.com/MM0OPX-Projects/HF-Antenna-Studio.git
Set-Location .\HF-Antenna-Studio
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-wasm.ps1 -EmsdkPath C:\path\to\emsdk
Set-Location .\frontend
npm ci
Set-Location ..
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\package-windows.ps1 -SkipDependencyInstall
```

The package script verifies synchronized versions and creates the installer and `package-manifest.json` under `src-tauri\target\release\bundle\nsis`. The clean Windows workflow additionally installs, launches, executes a real solver calculation with networking disabled, checks logs and registration, uninstalls, and verifies user-data preservation. See [WINDOWS_PACKAGING.md](WINDOWS_PACKAGING.md).
