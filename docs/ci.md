# CI/CD

The only workflow in this repository is `.github/workflows/desktop-macos.yml`. The configuration files under
`.github/` carry no comments on purpose; this page is where their rationale lives.

## Desktop macOS build

| Trigger | What it does |
| ------- | ------------ |
| Push to any branch but `develop`/`master`, when `desktop/`, `web/layers/common/` or `web/shared/` changed (Markdown aside), or manual | Builds the desktop app for macOS and keeps the installer as an artifact |

- **Runner and toolchain.** `macos-15`, Node 24 with the npm cache keyed on `desktop/app/package-lock.json`, stable Rust with
  both Apple targets, and the Rust cache over the `desktop` workspace.
- **Capture helper.** The Swift helper (`desktop/capture/macos`, ScreenCaptureKit) is built universal (arm64 + x86_64), ad-hoc
  signed and copied to `desktop/src-tauri/binaries/`, where `tauri.conf.json` bundles it into the app.
- **App bundle.** `tauri build --target universal-apple-darwin --bundles app,dmg` with `createUpdaterArtifacts` switched off
  through a throwaway config: the updater artifacts need the owner's signing key, and this build uses no secret.
- **Check.** The bundle must hold an executable `truemain-capture` and pass `codesign --verify --deep --strict`.
- **Artifact.** The `.dmg`, named `truemain-macos-<sha>`, kept 14 days. It is ad-hoc signed, not notarised: macOS asks to
  confirm opening it the first time.
- **Concurrency.** A new push to a branch cancels that branch's build in progress.

## Workflows that were removed

The repository used to carry the original project's full pipeline: CI, CodeQL, SonarQube Cloud, the Claude review, image
builds, deploys to its VPS, migrations, the edge proxy, load tests and the desktop release and promotion workflows. They
depended on infrastructure and secrets that belong to the original owner, and were deleted. They stay in the git history,
with their explanation in the previous version of this page (commit `31e383b7` and earlier).
