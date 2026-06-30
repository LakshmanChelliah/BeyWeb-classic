# Spin Sumo (Classic)

Static snapshot of [BeyWeb](https://github.com/LakshmanChelliah/BeyWeb) at commit **`e08af1c`** — the last version before online multiplayer and Railway deployment.

## Play

**Live:** https://lakshmanchelliah.github.io/BeyWeb-classic/

| Platform | Modes |
|----------|--------|
| **Mobile** | Casual vs CPU, Tournament vs CPU |
| **PC** | Casual vs CPU, Tournament vs CPU, **local 2-player** (WASD + arrow keys) |

No server required. Open `index.html` or `pc.html` locally, or use the GitHub Pages link above.

## Local

Open `index.html` (mobile) or `pc.html` (desktop) in a browser, or serve the folder with any static file server:

```bash
npm run dev
```

## Assets

Game media lives under `assets/`:

| Folder | Contents |
|--------|----------|
| `assets/models/` | Playable bey GLB meshes |
| `assets/logos/` | Bey logo PNGs (HUD + special-move flash) |
| `assets/textures/` | Pipeline debug / baked texture outputs |
| `assets/reference/` | Art reference stills |

Runtime paths are built in [`js/config/assets.js`](js/config/assets.js). The bey roster in [`js/game/data/beys.js`](js/game/data/beys.js) references those helpers.

## Main repo

For online multiplayer and the latest features, see [BeyWeb](https://github.com/LakshmanChelliah/BeyWeb) on Railway.
