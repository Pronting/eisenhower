# ISHWE QuickNote

Lightweight Tauri 2 desktop client for the [ISHWE](../) Eisenhower matrix task manager. Capture tasks from anywhere with a global hotkey (default `Ctrl+Shift+N`).

## Architecture

This is a **fully independent** Vite + React + Tauri 2 sub-project. The Next.js web app under `../frontend/` is **not** touched — see the parent `.claude/plan/quick-note-desktop.md` for the design rationale (TL;DR: previous attempt at PR #11 broke the Web build by mutating `frontend/next.config.js`).

## Development

```bash
cd desktop
pnpm install
pnpm tauri dev
```

The first run will download and compile the Rust dependencies (5–10 min). Subsequent runs are fast.

## Build installers

```bash
pnpm tauri build                                  # current platform
pnpm tauri build --target x86_64-pc-windows-msvc  # Windows MSI/NSIS
pnpm tauri build --target x86_64-unknown-linux-gnu # Linux DEB/AppImage
```

Outputs land in `desktop/src-tauri/target/<triple>/release/bundle/`.

## Configuration

Copy `desktop/.env.example` to `desktop/.env.local` and adjust:

- `VITE_API_URL` — backend base URL (default: `http://106.53.173.60:8000`)
- `VITE_WEB_URL` — web app URL used in the Device Flow authorize link (default: `http://localhost:3000`)

The capability allow-list in `desktop/src-tauri/capabilities/default.json` also restricts the Rust HTTP plugin to these hosts. Add new hosts there if needed.

## Releasing

Push a `v*` tag to trigger `.github/workflows/tauri-release.yml`, which builds Windows + Linux installers and attaches them to a GitHub Release draft.
