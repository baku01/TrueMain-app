# CI/CD

The only workflow in this repository is `.github/workflows/desktop-build.yml`. The configuration files under
`.github/` carry no comments on purpose; this page is where their rationale lives.

## Desktop build

| Trigger | What it does |
| ------- | ------------ |
| Push to any branch but `develop`/`master`, when `desktop/`, `web/layers/common/` or `web/shared/` changed (Markdown aside), or manual | Builds the desktop app for macOS and Windows and keeps each installer as an artifact; a push to `main` also publishes them as the repository's latest release |

- **Jobs.** `build` runs once per platform (a matrix); `release` runs after both (even if one failed), on `main` only.
- **macOS.** `macos-15`: the Swift capture helper (`desktop/capture/macos`, ScreenCaptureKit) built universal (arm64 + x86_64) and ad-hoc signed, then `tauri build --target universal-apple-darwin --bundles app,dmg`. The bundle must hold an executable `truemain-capture` and pass `codesign --verify --deep --strict`.
- **Windows.** `windows-2025`: the Rust capture helper (`-p truemain-capture`) copied to `src-tauri/binaries/` under its target-triple name, declared as an external binary through the throwaway config, then `tauri build --bundles nsis`.
- **Both.** Node 24 with the npm cache keyed on `desktop/app/package-lock.json`, stable Rust, the Rust cache over the `desktop` workspace. `createUpdaterArtifacts` is switched off through a throwaway `desktop/flavor.json`: the updater artifacts need the original owner's signing key, and these builds use no secret.
- **Artifacts.** `truemain-macOS-<sha>` (`TrueMain-macOS.dmg`) and `truemain-Windows-<sha>` (`TrueMain-Windows-setup.exe`), kept 14 days.
- **Release.** On `main`, the `latest` release is deleted and recreated with the installers of whichever platforms built — one platform failing does not keep the other's out — so `releases/latest/download/TrueMain-macOS.dmg` and `…/TrueMain-Windows-setup.exe` are stable links. It needs `contents: write` and nothing else.
- **Signing.** Neither installer is signed or notarised: macOS asks to confirm the first opening (`xattr -cr /Applications/TrueMain.app`), Windows SmartScreen shows "unknown publisher".
- **Concurrency.** A new push to a branch cancels that branch's build in progress.

## Workflows that were removed

The repository used to carry the original project's full pipeline: CI, CodeQL, SonarQube Cloud, the Claude review, image
builds, deploys to its VPS, migrations, the edge proxy, load tests and the desktop release and promotion workflows. They
depended on infrastructure and secrets that belong to the original owner, and were deleted. They stay in the git history,
with their explanation in the previous version of this page (commit `31e383b7` and earlier).
