/**
 * Dense anime-poster sky-dome textures for pivotal Metal Fusion venues.
 * Canvas art only — stadium geometry never changes.
 */

import * as THREE from 'three';

/** @param {import('./arenaSkins.js').ArenaSkin} skin */
export function createBackdropTexture(skin) {
  const w = 1536;
  const h = 768;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const bd = skin.backdrop || {
    style: 'koma_village',
    top: '#6a90b0',
    mid: '#8ab0a0',
    bottom: '#3a5040',
  };

  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, bd.top);
  sky.addColorStop(0.42, bd.mid);
  sky.addColorStop(1, bd.bottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  switch (bd.style) {
    case 'construction':
      paintConstruction(ctx, w, h, bd);
      break;
    case 'survival_island':
      paintSurvivalIsland(ctx, w, h, bd);
      break;
    case 'wbba_hq':
      paintWbbaHq(ctx, w, h, bd);
      break;
    case 'rooftop_day':
      paintRooftopDay(ctx, w, h, bd);
      break;
    case 'koma_village':
      paintKomaVillage(ctx, w, h, bd);
      break;
    case 'dn_rooftop_night':
      paintDnRooftopNight(ctx, w, h, bd);
      break;
    case 'city_streets':
      paintCityStreets(ctx, w, h, bd);
      break;
    case 'volcano':
      paintVolcano(ctx, w, h, bd);
      break;
    default:
      paintKomaVillage(ctx, w, h, bd);
  }

  // Soft center vignette so beys stay readable.
  const vig = ctx.createRadialGradient(w / 2, h * 0.58, h * 0.08, w / 2, h * 0.52, h * 0.9);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(0.7, 'rgba(0,0,0,0.12)');
  vig.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function hexAlpha(hex, a) {
  const raw = String(hex || '#ffffff').replace('#', '');
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw.padStart(6, '0');
  const n = parseInt(full.slice(0, 6), 16) || 0xffffff;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function paintStars(ctx, w, h, count, maxY = 0.55) {
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < count; i++) {
    ctx.globalAlpha = 0.15 + Math.random() * 0.7;
    const s = 1 + Math.random() * 2;
    ctx.fillRect(Math.random() * w, Math.random() * h * maxY, s, s);
  }
  ctx.globalAlpha = 1;
}

/** Benkei — abandoned construction / warehouse site */
function paintConstruction(ctx, w, h, bd) {
  // Dust haze
  for (let i = 0; i < 10; i++) {
    const x = Math.random() * w;
    const y = h * 0.3 + Math.random() * h * 0.4;
    const r = 60 + Math.random() * 140;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(180,140,80,0.18)');
    g.addColorStop(1, 'rgba(180,140,80,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Scaffolding grid
  ctx.strokeStyle = 'rgba(40,30,20,0.55)';
  ctx.lineWidth = 3;
  for (let x = 40; x < w; x += 70) {
    ctx.beginPath();
    ctx.moveTo(x, h * 0.2);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = h * 0.25; y < h; y += 48) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Diagonal braces
  ctx.strokeStyle = 'rgba(60,40,20,0.4)';
  ctx.lineWidth = 2;
  for (let x = 0; x < w; x += 140) {
    ctx.beginPath();
    ctx.moveTo(x, h * 0.25);
    ctx.lineTo(x + 70, h * 0.55);
    ctx.lineTo(x + 140, h * 0.25);
    ctx.stroke();
  }

  // Unfinished building blocks
  ctx.fillStyle = 'rgba(20,16,12,0.75)';
  for (let i = 0; i < 9; i++) {
    const bx = (i / 9) * w + 10;
    const bw = 60 + (i % 3) * 25;
    const bh = h * (0.28 + (i % 4) * 0.08);
    ctx.fillRect(bx, h - bh, bw, bh);
    // Empty window holes
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    for (let wy = h - bh + 16; wy < h - 20; wy += 28) {
      for (let wx = bx + 10; wx < bx + bw - 14; wx += 22) {
        ctx.fillRect(wx, wy, 12, 16);
      }
    }
    ctx.fillStyle = 'rgba(20,16,12,0.75)';
  }

  // Hazard lamps
  for (let i = 0; i < 8; i++) {
    const x = ((i + 0.5) / 8) * w;
    const y = h * 0.28 + (i % 2) * 30;
    const lamp = ctx.createRadialGradient(x, y, 2, x, y, 50);
    lamp.addColorStop(0, hexAlpha(bd.glow || '#f59e0b', 0.7));
    lamp.addColorStop(1, hexAlpha(bd.glow || '#f59e0b', 0));
    ctx.fillStyle = lamp;
    ctx.beginPath();
    ctx.arc(x, y, 50, 0, Math.PI * 2);
    ctx.fill();
  }

  // Crane boom silhouette
  ctx.strokeStyle = 'rgba(10,8,6,0.85)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(w * 0.1, h * 0.7);
  ctx.lineTo(w * 0.1, h * 0.15);
  ctx.lineTo(w * 0.55, h * 0.22);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(w * 0.55, h * 0.22);
  ctx.lineTo(w * 0.55, h * 0.45);
  ctx.stroke();
}

/** Yu — Survival Island beach arena */
function paintSurvivalIsland(ctx, w, h, bd) {
  // Soft sun
  const sun = ctx.createRadialGradient(w * 0.78, h * 0.18, 4, w * 0.78, h * 0.18, 90);
  sun.addColorStop(0, '#fff8d0');
  sun.addColorStop(0.4, hexAlpha(bd.glow || '#fef08a', 0.55));
  sun.addColorStop(1, 'rgba(255,240,160,0)');
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(w * 0.78, h * 0.18, 90, 0, Math.PI * 2);
  ctx.fill();

  // Cloud puffs
  for (let i = 0; i < 12; i++) {
    const x = Math.random() * w;
    const y = h * 0.08 + Math.random() * h * 0.22;
    const r = 40 + Math.random() * 70;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Ocean band
  const ocean = ctx.createLinearGradient(0, h * 0.52, 0, h * 0.78);
  ocean.addColorStop(0, '#3db8e0');
  ocean.addColorStop(0.5, '#1a7aaa');
  ocean.addColorStop(1, '#0e4a6a');
  ctx.fillStyle = ocean;
  ctx.fillRect(0, h * 0.52, w, h * 0.28);

  // Wave sparkles
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 18; i++) {
    const y = h * 0.55 + Math.random() * h * 0.18;
    ctx.beginPath();
    ctx.moveTo(Math.random() * w, y);
    ctx.quadraticCurveTo(Math.random() * w, y - 8, Math.random() * w, y);
    ctx.stroke();
  }

  // Distant cliffs
  ctx.fillStyle = 'rgba(40,70,60,0.55)';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.58);
  for (let x = 0; x <= w * 0.35; x += 40) {
    ctx.lineTo(x, h * (0.42 + Math.sin(x * 0.05) * 0.06));
  }
  ctx.lineTo(w * 0.35, h * 0.58);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(50,80,70,0.5)';
  ctx.beginPath();
  ctx.moveTo(w * 0.65, h * 0.58);
  for (let x = w * 0.65; x <= w; x += 40) {
    ctx.lineTo(x, h * (0.4 + Math.cos(x * 0.04) * 0.07));
  }
  ctx.lineTo(w, h * 0.58);
  ctx.closePath();
  ctx.fill();

  // Palm silhouettes
  for (let i = 0; i < 7; i++) {
    const x = (i / 6) * w * 0.9 + w * 0.05;
    const base = h * 0.72;
    ctx.strokeStyle = 'rgba(20,50,30,0.85)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.quadraticCurveTo(x + 8, base - 60, x - 4, base - 110);
    ctx.stroke();
    ctx.fillStyle = 'rgba(20,60,30,0.8)';
    for (let f = 0; f < 5; f++) {
      const ang = -Math.PI * 0.7 + f * 0.35;
      ctx.beginPath();
      ctx.moveTo(x - 4, base - 110);
      ctx.quadraticCurveTo(
        x - 4 + Math.cos(ang) * 40,
        base - 110 + Math.sin(ang) * 20,
        x - 4 + Math.cos(ang) * 70,
        base - 100 + Math.sin(ang) * 35
      );
      ctx.quadraticCurveTo(
        x - 4 + Math.cos(ang) * 30,
        base - 105,
        x - 4,
        base - 110
      );
      ctx.fill();
    }
  }

  // Sand shore
  const sand = ctx.createLinearGradient(0, h * 0.72, 0, h);
  sand.addColorStop(0, '#e8d4a0');
  sand.addColorStop(1, '#c8a870');
  ctx.fillStyle = sand;
  ctx.fillRect(0, h * 0.72, w, h * 0.28);
}

/** Tsubasa — WBBA HQ indoor theater stadium */
function paintWbbaHq(ctx, w, h, bd) {
  // Dark ceiling rafters
  ctx.fillStyle = 'rgba(6,10,18,0.9)';
  ctx.fillRect(0, 0, w, h * 0.22);
  ctx.strokeStyle = 'rgba(80,100,140,0.35)';
  ctx.lineWidth = 4;
  for (let x = 0; x < w; x += 90) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 40, h * 0.22);
    ctx.stroke();
  }

  // Spotlights
  for (let i = 0; i < 9; i++) {
    const x = ((i + 0.5) / 9) * w;
    const beam = ctx.createLinearGradient(x, h * 0.08, x, h * 0.7);
    beam.addColorStop(0, hexAlpha(bd.glow || '#e2e8f0', 0.45));
    beam.addColorStop(1, hexAlpha(bd.glow || '#e2e8f0', 0));
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(x - 14, h * 0.08);
    ctx.lineTo(x + 14, h * 0.08);
    ctx.lineTo(x + 90, h * 0.72);
    ctx.lineTo(x - 90, h * 0.72);
    ctx.closePath();
    ctx.fill();
    // Lamp body
    ctx.fillStyle = hexAlpha(bd.glow || '#e2e8f0', 0.9);
    ctx.beginPath();
    ctx.arc(x, h * 0.08, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Tiered seating left / right
  for (const side of [-1, 1]) {
    for (let row = 0; row < 8; row++) {
      const y = h * 0.28 + row * 28;
      const inset = 40 + row * 18;
      const x0 = side < 0 ? 0 : w - (w * 0.28 - inset * 0.15);
      const bw = w * 0.28 - row * 8;
      ctx.fillStyle = row % 2 === 0 ? 'rgba(20,35,60,0.85)' : 'rgba(15,28,50,0.85)';
      if (side < 0) ctx.fillRect(0, y, bw, 24);
      else ctx.fillRect(w - bw, y, bw, 24);
      // Seat dots
      ctx.fillStyle = hexAlpha(bd.accent || '#3b82f6', 0.35);
      const startX = side < 0 ? 12 : w - bw + 12;
      for (let sx = startX; sx < startX + bw - 20; sx += 14) {
        ctx.beginPath();
        ctx.arc(sx, y + 12, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // LED ribbon
  const led = ctx.createLinearGradient(0, h * 0.24, w, h * 0.24);
  led.addColorStop(0, hexAlpha(bd.accent || '#3b82f6', 0.1));
  led.addColorStop(0.5, hexAlpha(bd.accent || '#3b82f6', 0.7));
  led.addColorStop(1, hexAlpha(bd.accent || '#3b82f6', 0.1));
  ctx.fillStyle = led;
  ctx.fillRect(0, h * 0.235, w, 6);

  // Far scoreboard block
  ctx.fillStyle = 'rgba(10,16,28,0.9)';
  ctx.fillRect(w * 0.35, h * 0.12, w * 0.3, h * 0.1);
  ctx.strokeStyle = hexAlpha(bd.accent || '#3b82f6', 0.6);
  ctx.lineWidth = 2;
  ctx.strokeRect(w * 0.35, h * 0.12, w * 0.3, h * 0.1);
  ctx.fillStyle = hexAlpha(bd.glow || '#e2e8f0', 0.5);
  ctx.font = `bold ${Math.floor(h * 0.035)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('WBBA', w * 0.5, h * 0.185);
}

/** Kyoya — daytime rooftop with CLEARLY visible city buildings */
function paintRooftopDay(ctx, w, h, bd) {
  // Bright sky already filled; add clouds
  for (let i = 0; i < 14; i++) {
    const x = Math.random() * w;
    const y = h * 0.05 + Math.random() * h * 0.28;
    const r = 50 + Math.random() * 100;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.75)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.3)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Sun
  const sun = ctx.createRadialGradient(w * 0.18, h * 0.16, 3, w * 0.18, h * 0.16, 70);
  sun.addColorStop(0, '#fffef0');
  sun.addColorStop(0.35, hexAlpha(bd.accent || '#fbbf24', 0.55));
  sun.addColorStop(1, 'rgba(251,191,36,0)');
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(w * 0.18, h * 0.16, 70, 0, Math.PI * 2);
  ctx.fill();

  // Far skyline (lighter)
  drawCityBlockRow(ctx, w, h, {
    yBase: h * 0.58,
    maxH: h * 0.28,
    color: 'rgba(120,150,180,0.55)',
    window: 'rgba(255,255,220,0.25)',
    density: 1.1,
  });

  // Mid skyline (stronger, taller — the "wow" buildings)
  drawCityBlockRow(ctx, w, h, {
    yBase: h * 0.68,
    maxH: h * 0.42,
    color: 'rgba(70,95,120,0.88)',
    window: 'rgba(255,250,220,0.45)',
    density: 0.95,
    landmarks: true,
  });

  // Near parapet / rooftop edge
  ctx.fillStyle = 'rgba(90,85,75,0.92)';
  ctx.fillRect(0, h * 0.78, w, h * 0.08);
  ctx.fillStyle = 'rgba(60,55,50,0.9)';
  ctx.fillRect(0, h * 0.86, w, h * 0.14);
  // Rail posts
  ctx.fillStyle = 'rgba(40,40,40,0.85)';
  for (let x = 20; x < w; x += 36) {
    ctx.fillRect(x, h * 0.74, 4, h * 0.06);
  }
  ctx.strokeStyle = 'rgba(40,40,40,0.7)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.75);
  ctx.lineTo(w, h * 0.75);
  ctx.stroke();
}

function drawCityBlockRow(ctx, w, h, opts) {
  let x = -20;
  let i = 0;
  while (x < w + 40) {
    const bw = (28 + (i % 5) * 18 + Math.random() * 20) * (opts.density || 1);
    let bh = opts.maxH * (0.35 + Math.random() * 0.65);
    // Landmark towers
    if (opts.landmarks && (i === 4 || i === 11 || i === 17)) {
      bh = opts.maxH * (0.85 + Math.random() * 0.2);
    }
    const y = opts.yBase - bh;
    ctx.fillStyle = opts.color;
    ctx.fillRect(x, y, bw, bh);

    // Antenna / roof gear on landmarks
    if (opts.landmarks && bh > opts.maxH * 0.8) {
      ctx.fillStyle = 'rgba(40,50,60,0.9)';
      ctx.fillRect(x + bw * 0.45, y - 28, 3, 28);
      ctx.beginPath();
      ctx.arc(x + bw * 0.45 + 1.5, y - 28, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Windows grid — clearly readable
    ctx.fillStyle = opts.window;
    for (let wy = y + 8; wy < opts.yBase - 8; wy += 11) {
      for (let wx = x + 5; wx < x + bw - 6; wx += 9) {
        if (Math.random() > 0.18) ctx.fillRect(wx, wy, 5, 6);
      }
    }

    x += bw + 6;
    i += 1;
  }
}

/** Gingka — Koma Village ruins / relics */
function paintKomaVillage(ctx, w, h, bd) {
  // Soft daylight haze
  for (let i = 0; i < 8; i++) {
    const x = Math.random() * w;
    const y = h * 0.15 + Math.random() * h * 0.3;
    const r = 80 + Math.random() * 120;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,250,220,0.2)');
    g.addColorStop(1, 'rgba(255,250,220,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Distant forested hills
  ctx.fillStyle = 'rgba(40,70,50,0.45)';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.55);
  for (let x = 0; x <= w; x += 50) {
    ctx.lineTo(x, h * (0.4 + Math.sin(x * 0.02) * 0.05));
  }
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(30,55,40,0.55)';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.62);
  for (let x = 0; x <= w; x += 40) {
    ctx.lineTo(x, h * (0.48 + Math.cos(x * 0.03) * 0.06));
  }
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();

  // Stone ruin arches / pillars
  const ruins = [
    [0.08, 0.42, 0.12],
    [0.22, 0.38, 0.1],
    [0.55, 0.4, 0.14],
    [0.72, 0.36, 0.11],
    [0.88, 0.44, 0.1],
  ];
  for (const [px, py, pw] of ruins) {
    const x = px * w;
    const y = py * h;
    const ww = pw * w;
    ctx.fillStyle = 'rgba(90,85,70,0.85)';
    // Two pillars + lintel
    ctx.fillRect(x, y, ww * 0.18, h * 0.35);
    ctx.fillRect(x + ww * 0.72, y, ww * 0.18, h * 0.35);
    ctx.fillRect(x - 4, y, ww + 8, h * 0.05);
    // Cracks
    ctx.strokeStyle = 'rgba(40,35,25,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 4, y + 20);
    ctx.lineTo(x + 10, y + 80);
    ctx.stroke();
  }

  // Relic stone circle marks in mid ground
  ctx.strokeStyle = hexAlpha(bd.accent || '#86efac', 0.35);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(w * 0.5, h * 0.7, h * 0.12, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(w * 0.5, h * 0.7, h * 0.08, 0, Math.PI * 2);
  ctx.stroke();

  // Torii-like gate silhouette (nostalgia beat)
  ctx.strokeStyle = 'rgba(80,40,30,0.75)';
  ctx.lineWidth = 8;
  const gx = w * 0.42;
  const gy = h * 0.48;
  ctx.beginPath();
  ctx.moveTo(gx, gy + h * 0.22);
  ctx.lineTo(gx, gy);
  ctx.moveTo(gx + w * 0.16, gy + h * 0.22);
  ctx.lineTo(gx + w * 0.16, gy);
  ctx.moveTo(gx - 20, gy);
  ctx.lineTo(gx + w * 0.16 + 20, gy);
  ctx.moveTo(gx - 10, gy + 18);
  ctx.lineTo(gx + w * 0.16 + 10, gy + 18);
  ctx.stroke();
}

/** Ryuga Lightning — Dark Nebula HQ rooftop night city */
function paintDnRooftopNight(ctx, w, h, bd) {
  paintStars(ctx, w, h, 90, 0.5);

  // Purple nebula haze
  for (let i = 0; i < 10; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h * 0.45;
    const r = 70 + Math.random() * 150;
    const col = Math.random() > 0.5 ? bd.glow || '#ef4444' : bd.accent || '#a855f7';
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, hexAlpha(col, 0.28));
    g.addColorStop(1, hexAlpha(col, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Twin Dark Nebula towers (signature)
  const towerW = w * 0.09;
  for (const tx of [w * 0.32, w * 0.55]) {
    ctx.fillStyle = 'rgba(8,4,16,0.95)';
    ctx.fillRect(tx, h * 0.12, towerW, h * 0.55);
    // Red window bands
    ctx.fillStyle = hexAlpha(bd.glow || '#ef4444', 0.45);
    for (let wy = h * 0.16; wy < h * 0.62; wy += 16) {
      ctx.globalAlpha = 0.25 + Math.random() * 0.45;
      ctx.fillRect(tx + 6, wy, towerW - 12, 5);
    }
    ctx.globalAlpha = 1;
    // Spire
    ctx.fillStyle = 'rgba(12,6,20,0.95)';
    ctx.beginPath();
    ctx.moveTo(tx, h * 0.12);
    ctx.lineTo(tx + towerW / 2, h * 0.04);
    ctx.lineTo(tx + towerW, h * 0.12);
    ctx.closePath();
    ctx.fill();
  }

  // City below
  drawCityBlockRow(ctx, w, h, {
    yBase: h * 0.72,
    maxH: h * 0.32,
    color: 'rgba(12,10,24,0.92)',
    window: hexAlpha(bd.accent || '#a855f7', 0.4),
    density: 1,
  });

  // Rooftop ledge
  ctx.fillStyle = 'rgba(20,12,28,0.95)';
  ctx.fillRect(0, h * 0.78, w, h * 0.22);
  ctx.fillStyle = hexAlpha(bd.glow || '#ef4444', 0.35);
  ctx.fillRect(0, h * 0.78, w, 4);
}

/** Masamune — city streets neon canyon */
function paintCityStreets(ctx, w, h, bd) {
  paintStars(ctx, w, h, 40, 0.35);

  // Building walls left/right (street canyon)
  for (const side of [-1, 1]) {
    for (let col = 0; col < 5; col++) {
      const depth = col;
      const bw = w * (0.18 - depth * 0.015);
      const x = side < 0 ? depth * 8 : w - bw - depth * 8;
      const top = h * (0.08 + depth * 0.04);
      ctx.fillStyle = `rgba(${12 + depth * 8},${18 + depth * 6},${28 + depth * 8},0.92)`;
      ctx.fillRect(x, top, bw, h - top);
      // Neon signs
      const neon = col % 2 === 0 ? bd.glow || '#22d3ee' : bd.accent || '#ef4444';
      ctx.fillStyle = hexAlpha(neon, 0.55);
      ctx.fillRect(x + 10, top + 40 + col * 30, bw - 20, 10);
      ctx.fillStyle = hexAlpha(neon, 0.2);
      ctx.fillRect(x + 8, top + 38 + col * 30, bw - 16, 14);
      // Windows
      ctx.fillStyle = 'rgba(255,220,150,0.35)';
      for (let wy = top + 70; wy < h * 0.7; wy += 22) {
        for (let wx = x + 12; wx < x + bw - 16; wx += 16) {
          if (Math.random() > 0.35) ctx.fillRect(wx, wy, 8, 10);
        }
      }
    }
  }

  // Road vanishing point
  const road = ctx.createLinearGradient(0, h * 0.62, 0, h);
  road.addColorStop(0, '#1a222c');
  road.addColorStop(1, '#0a0e14');
  ctx.fillStyle = road;
  ctx.beginPath();
  ctx.moveTo(w * 0.28, h * 0.62);
  ctx.lineTo(w * 0.72, h * 0.62);
  ctx.lineTo(w * 0.95, h);
  ctx.lineTo(w * 0.05, h);
  ctx.closePath();
  ctx.fill();

  // Center line dashes
  ctx.strokeStyle = hexAlpha(bd.glow || '#22d3ee', 0.5);
  ctx.lineWidth = 4;
  ctx.setLineDash([18, 16]);
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.64);
  ctx.lineTo(w * 0.5, h);
  ctx.stroke();
  ctx.setLineDash([]);

  // Crosswalk near camera
  ctx.fillStyle = 'rgba(240,240,240,0.35)';
  for (let i = 0; i < 8; i++) {
    ctx.fillRect(w * 0.22 + i * 28, h * 0.82, 14, h * 0.08);
  }

  // Traffic light glow
  for (const [x, col] of [
    [w * 0.3, '#22c55e'],
    [w * 0.7, '#ef4444'],
  ]) {
    const g = ctx.createRadialGradient(x, h * 0.55, 2, x, h * 0.55, 40);
    g.addColorStop(0, hexAlpha(col, 0.7));
    g.addColorStop(1, hexAlpha(col, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, h * 0.55, 40, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Meteo L-Drago — volcano interior */
function paintVolcano(ctx, w, h, bd) {
  // Ember core glow
  const core = ctx.createRadialGradient(w / 2, h * 0.62, 20, w / 2, h * 0.55, h * 0.55);
  core.addColorStop(0, hexAlpha(bd.glow || '#ff3300', 0.7));
  core.addColorStop(0.35, hexAlpha(bd.accent || '#fb923c', 0.35));
  core.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, w, h);

  // Rising heat shimmer bands
  ctx.strokeStyle = hexAlpha(bd.accent || '#fb923c', 0.2);
  ctx.lineWidth = 2;
  for (let i = 0; i < 12; i++) {
    const y = h * 0.2 + i * 28;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= w; x += 40) {
      ctx.lineTo(x, y + Math.sin(x * 0.05 + i) * 6);
    }
    ctx.stroke();
  }

  // Jagged crater walls L/R
  for (const side of [-1, 1]) {
    ctx.fillStyle = 'rgba(20,8,6,0.92)';
    ctx.beginPath();
    if (side < 0) {
      ctx.moveTo(0, 0);
      ctx.lineTo(w * 0.38, 0);
      for (let y = 0; y <= h; y += 40) {
        ctx.lineTo(w * (0.22 + Math.sin(y * 0.04) * 0.08), y);
      }
      ctx.lineTo(0, h);
    } else {
      ctx.moveTo(w, 0);
      ctx.lineTo(w * 0.62, 0);
      for (let y = 0; y <= h; y += 40) {
        ctx.lineTo(w * (0.78 + Math.cos(y * 0.04) * 0.08), y);
      }
      ctx.lineTo(w, h);
    }
    ctx.closePath();
    ctx.fill();

    // Lava veins on rock
    ctx.strokeStyle = hexAlpha(bd.glow || '#ff3300', 0.55);
    ctx.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      const x0 = side < 0 ? Math.random() * w * 0.25 : w * 0.75 + Math.random() * w * 0.25;
      ctx.beginPath();
      ctx.moveTo(x0, Math.random() * h * 0.3);
      ctx.quadraticCurveTo(
        x0 + (Math.random() - 0.5) * 80,
        h * 0.5,
        x0 + (Math.random() - 0.5) * 40,
        h * 0.85
      );
      ctx.stroke();
    }
  }

  // Lava pool at bottom
  const pool = ctx.createLinearGradient(0, h * 0.72, 0, h);
  pool.addColorStop(0, hexAlpha(bd.glow || '#ff3300', 0.85));
  pool.addColorStop(0.5, '#ff6600');
  pool.addColorStop(1, '#8a1000');
  ctx.fillStyle = pool;
  ctx.beginPath();
  ctx.moveTo(w * 0.2, h * 0.78);
  ctx.quadraticCurveTo(w * 0.5, h * 0.7, w * 0.8, h * 0.78);
  ctx.lineTo(w * 0.85, h);
  ctx.lineTo(w * 0.15, h);
  ctx.closePath();
  ctx.fill();

  // Ash / sparks
  ctx.fillStyle = '#ffaa66';
  for (let i = 0; i < 90; i++) {
    ctx.globalAlpha = 0.2 + Math.random() * 0.55;
    ctx.beginPath();
    ctx.arc(Math.random() * w, Math.random() * h, 1 + Math.random() * 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
