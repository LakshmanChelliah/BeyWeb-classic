---
name: bey-fight-capture
description: >-
  Capture Bey Web (BeyWeb-classic) ability VFX with Playwright: boot pc.html?capture=1,
  start a Casual fight, fire power/special moves, dump canvas frames + phase JSON, then
  review frames for flat rings / anime fidelity. Use when QA-ing bey specials, recording
  fight clips, cycling frames for visual review, or recycling the fight-capture pipeline.
---

# Bey fight capture pipeline

Recyclable loop for **eyes-on** ability VFX QA without hand-playing every special.

## When to use

- After changing `js/render/*AbilityVfx.js`, `starBlastVfx.js`, or ability physics
- When asked to “record the fight”, “cycle frames”, or “browser-automate specials”
- Before claiming recruiter-wow / anime fidelity — **frames beat guesses**

## Prerequisites

1. Static server on the repo root (example: `npm run dev` → `:8000`, or existing `:8765`)
2. Playwright + Chromium:

```bash
npm install --no-save playwright
npx playwright install chromium
```

3. Capture hook: open **`pc.html?capture=1`** (script adds the flag automatically)

## Pipeline (do this every time)

### 1. Serve

```bash
npx --yes http-server -p 8000 -c-1 -a 127.0.0.1 .
# or reuse whatever port is already up
```

### 2. Record

Single special (Pegasus Star Blast):

```bash
node scripts/capture-fight.mjs \
  --url http://127.0.0.1:8000/pc.html \
  --out /opt/cursor/artifacts/bey-fight-frames \
  --bey pegasus --slot special --seconds 2.8 --fps 12
```

Full special suite (all playable beys):

```bash
node scripts/capture-fight.mjs \
  --url http://127.0.0.1:8000/pc.html \
  --out /opt/cursor/artifacts/bey-fight-frames \
  --suite --seconds 2.5 --fps 10
```

Useful flags: `--power`, `--headed`, `--side ai`, `--bey bull`.

Clips record **live** frames for ~1.15s (special impact window), then **freeze**
remaining frames so the camera does not fly away on KO.

### 3. Review frames

Each clip lands in:

```text
<out>/<bey>-<label>/
  frame_0000.png … frame_NNNN.png
  frame_0000.json …   # phase / spin / ability snapshot
  manifest.json
summary.json
```

**Read the PNGs with the Read tool** (images are supported). Check:

| Fail | Look for |
|------|----------|
| Flat “range ring” | Opaque `RingGeometry` discs around beys / slam footprints |
| Weak special | Thin trails, no apex / spirit / debris, camera dead |
| Physics desync | Slam VFX with no launch→bounce→settle in JSON phases |
| Overlay junk | Detached badges / chips on hero media (N/A in-canvas, but flash overlay) |

JSON fields to skim: `abilities.player.special`, `player.launchBouncePhase`, `*Phase` keys on bodies.

### 4. Fix → re-capture → re-review

Edit the relevant `*AbilityVfx.js` / physics, re-run the **same** `--bey` clip, compare new frames. Do not declare done on code-only smoke tests.

## In-page API (`window.__beyCapture`)

Installed by `js/debug/captureApi.js` when `?capture=1` (also enables ability no-delay via `RUNTIME_FLAGS`).

| Method | Purpose |
|--------|---------|
| `bootCasualFight({ playerBeyId })` | Boot → Casual → pick → Start → close face-off |
| `trigger(side, slot)` | Fire `power` / `special` |
| `placeCloseFaceOff()` | Put beys near center so slams connect |
| `setSpin(p, a)` | Keep gauges full for QA |
| `freeze(true\|false)` | Pause sim for a still |
| `snapshot()` | Phase / ability / pose dump |
| `waitFightReady()` | After launch grace |

Selection helpers used by the API: `selection.focusBey(id)`, `selection.confirmCurrent()`.

## Manual / web-agent path

If Playwright is unavailable, drive the same API from DevTools or a browser agent:

1. Open `http://127.0.0.1:PORT/pc.html?capture=1`
2. Wait for boot, then:

```js
await __beyCapture.bootCasualFight({ playerBeyId: 'eagle' });
__beyCapture.trigger('player', 'special');
```

3. Screenshot `#game-canvas` on an interval (or freeze + screenshot).

## Playable bey ids

`pegasus`, `lightning_ldrago`, `meteo_ldrago`, `leone`, `libra`, `eagle`, `striker`, `bull`

## Hard rules for reviewers (from VFX revamp)

- No flat circles for attack range or “special move imitation”
- Prefer volumetric / particle / motif VFX (`three.quarks` where wired)
- Slam specials should show post-hit **launch → bounce → settle** when physics presets exist

## Files

- `js/debug/captureApi.js` — capture API
- `js/app/bootstrap.js` — installs API
- `js/config.js` — `RUNTIME_FLAGS` / `isAbilityTestNoDelays()`
- `scripts/capture-fight.mjs` — Playwright recorder
- `js/ui/selection.js` — `focusBey` / `confirmCurrent`
