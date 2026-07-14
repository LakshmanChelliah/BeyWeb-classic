# AGENTS.md

## Cursor Cloud specific instructions

**Product:** Bey Web (Classic) — a fully client-side 3D Beyblade arena game. No backend, database, or online multiplayer in this repo. Two entry points share the same game: `index.html` (mobile) and `pc.html` (desktop, includes local 2-player).

### Services

There is exactly one service: a **static HTTP server** serving the repo root, plus a browser.

- Run it with `npm run dev` (serves `http://127.0.0.1:8000`, see `package.json`). Open `/pc.html` (desktop) or `/index.html` (mobile).
- The game loads Three.js, cannon-es, and three.quarks from the local `vendor/` directory via HTML import maps — there are **no CDN dependencies**, and `npm install` is **not** required just to play. All `.glb`/`.png` game assets are committed at the repo root.
- ES modules and `.glb` loading require HTTP; opening via `file://` is unreliable. Always use the static server.

### Dependencies / gotchas

- `npm install` fails with an `ERESOLVE` peer-dependency conflict (`three.quarks@0.15.7` wants `three >=0.165` but the project pins `three@0.160.0`). This is expected — always install with `--legacy-peer-deps`. The npm deps are only used by the Node asset-pipeline scripts in `scripts/` (GLB recolor/build), not by the game runtime.
- **Playwright is optional QA tooling and is not part of the update script.** To run the `scripts/verify-*.mjs` and `scripts/capture-*.mjs` scripts, install it on demand: `npm install --no-save --legacy-peer-deps playwright && npx playwright install chromium`.

### Lint / test / build / run

- **Run (dev):** `npm run dev`
- **Build:** none — it is a static site; GitHub Pages deploys the repo root as-is (`.github/workflows/pages.yml`).
- **Lint:** no linter configured.
- **Tests:** `npm test` is a placeholder that intentionally exits with an error. The real checks are the Playwright verification scripts (require Playwright, see above), e.g. `node scripts/verify-local-site.mjs`, `node scripts/verify-pc-page.mjs`, `node scripts/verify-change-bey-confirm.mjs`. The dev server must be running first.
- **VFX/fight capture:** `node scripts/capture-fight.mjs --url http://127.0.0.1:8000/pc.html --bey pegasus --slot special` boots a Casual fight headlessly and dumps canvas frames. See `.cursor/skills/bey-fight-capture/SKILL.md` and the in-page `window.__beyCapture` API (enabled with `?capture=1`).
