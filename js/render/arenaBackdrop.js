/**
 * Painted sky-dome textures for anime-style arena venues.
 * Flat canvas art only — no stadium geometry changes.
 */

import * as THREE from 'three';

/** @param {import('./arenaSkins.js').ArenaSkin} skin */
export function createBackdropTexture(skin) {
  const w = 1024;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const bd = skin.backdrop || {
    style: 'storm',
    top: '#0a1838',
    mid: '#1e4a8c',
    bottom: '#061020',
  };

  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, bd.top);
  sky.addColorStop(0.45, bd.mid);
  sky.addColorStop(1, bd.bottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  switch (bd.style) {
    case 'warehouse':
      paintWarehouse(ctx, w, h, bd);
      break;
    case 'lab':
      paintLab(ctx, w, h, bd);
      break;
    case 'city_night':
      paintCityNight(ctx, w, h, bd);
      break;
    case 'desert_sunset':
      paintDesertSunset(ctx, w, h, bd);
      break;
    case 'storm':
      paintStorm(ctx, w, h, bd);
      break;
    case 'nebula':
      paintNebula(ctx, w, h, bd);
      break;
    case 'arena_lights':
      paintArenaLights(ctx, w, h, bd);
      break;
    case 'crater':
      paintCrater(ctx, w, h, bd);
      break;
    default:
      paintStorm(ctx, w, h, bd);
  }

  // Soft vignette so the stadium reads clearly in the center.
  const vig = ctx.createRadialGradient(w / 2, h * 0.62, h * 0.1, w / 2, h * 0.55, h * 0.85);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function paintWarehouse(ctx, w, h, bd) {
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  for (let i = 0; i < 14; i++) {
    const x = (i / 14) * w;
    ctx.fillRect(x, h * 0.35, 10, h * 0.65);
  }
  ctx.strokeStyle = bd.glow || '#e85d04';
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 3;
  for (let i = 0; i < 8; i++) {
    const y = h * 0.4 + Math.random() * h * 0.35;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y + (Math.random() - 0.5) * 40);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = bd.accent || '#f59e0b';
  for (let i = 0; i < 40; i++) {
    ctx.globalAlpha = 0.25 + Math.random() * 0.5;
    ctx.fillRect(Math.random() * w, h * 0.35 + Math.random() * h * 0.4, 4, 6);
  }
  ctx.globalAlpha = 1;
}

function paintLab(ctx, w, h, bd) {
  ctx.strokeStyle = bd.glow || '#d4a017';
  ctx.globalAlpha = 0.22;
  for (let i = 0; i < 5; i++) {
    ctx.lineWidth = 2 + i;
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.42, 40 + i * 36, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (let i = 0; i < 12; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h * 0.7;
    const r = 30 + Math.random() * 80;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, hexAlpha(bd.accent || '#a855f7', 0.35));
    g.addColorStop(1, hexAlpha(bd.accent || '#a855f7', 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintCityNight(ctx, w, h, bd) {
  ctx.fillStyle = 'rgba(4, 10, 22, 0.85)';
  let x = 0;
  while (x < w) {
    const bw = 18 + Math.random() * 42;
    const bh = 40 + Math.random() * h * 0.35;
    ctx.fillRect(x, h - bh, bw, bh);
    ctx.fillStyle = bd.glow || '#60a5fa';
    for (let wy = h - bh + 8; wy < h - 8; wy += 10) {
      for (let wx = x + 4; wx < x + bw - 4; wx += 8) {
        if (Math.random() > 0.45) {
          ctx.globalAlpha = 0.25 + Math.random() * 0.55;
          ctx.fillRect(wx, wy, 3, 4);
        }
      }
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(4, 10, 22, 0.85)';
    x += bw + 4;
  }
  const mx = w * 0.72;
  const my = h * 0.22;
  const moon = ctx.createRadialGradient(mx, my, 2, mx, my, 28);
  moon.addColorStop(0, '#e8f0ff');
  moon.addColorStop(1, 'rgba(150,180,255,0)');
  ctx.fillStyle = moon;
  ctx.beginPath();
  ctx.arc(mx, my, 28, 0, Math.PI * 2);
  ctx.fill();
}

function paintDesertSunset(ctx, w, h, bd) {
  const sx = w * 0.5;
  const sy = h * 0.48;
  const sun = ctx.createRadialGradient(sx, sy, 4, sx, sy, 90);
  sun.addColorStop(0, '#fff2c0');
  sun.addColorStop(0.35, bd.glow || '#f59e0b');
  sun.addColorStop(1, 'rgba(251,146,60,0)');
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(sx, sy, 90, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(20, 10, 4, 0.75)';
  ctx.beginPath();
  ctx.moveTo(0, h);
  let px = 0;
  while (px < w) {
    const peak = h * (0.55 + Math.random() * 0.2);
    ctx.lineTo(px + 40, peak);
    ctx.lineTo(px + 80, h * 0.72);
    px += 80 + Math.random() * 40;
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
}

function paintStorm(ctx, w, h, bd) {
  for (let i = 0; i < 18; i++) {
    const x = Math.random() * w;
    const y = h * 0.1 + Math.random() * h * 0.45;
    const r = 50 + Math.random() * 120;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(180,200,255,0.22)');
    g.addColorStop(1, 'rgba(180,200,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = bd.glow || '#38bdf8';
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    ctx.globalAlpha = 0.35 + Math.random() * 0.4;
    let x = Math.random() * w;
    let y = h * 0.08;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 6; s++) {
      x += (Math.random() - 0.5) * 50;
      y += h * 0.08;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function paintNebula(ctx, w, h, bd) {
  for (let i = 0; i < 20; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h * 0.75;
    const r = 40 + Math.random() * 140;
    const col = Math.random() > 0.5 ? bd.glow || '#ef4444' : bd.accent || '#a855f7';
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, hexAlpha(col, 0.4));
    g.addColorStop(1, hexAlpha(col, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 80; i++) {
    ctx.globalAlpha = 0.2 + Math.random() * 0.7;
    ctx.fillRect(Math.random() * w, Math.random() * h * 0.7, 1.5, 1.5);
  }
  ctx.globalAlpha = 1;
}

function paintArenaLights(ctx, w, h, bd) {
  for (let i = 0; i < 7; i++) {
    const x = ((i + 0.5) / 7) * w;
    const g = ctx.createLinearGradient(x, 0, x, h * 0.7);
    g.addColorStop(0, hexAlpha(bd.glow || '#f8fafc', 0.35));
    g.addColorStop(1, hexAlpha(bd.glow || '#f8fafc', 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - 18, 0);
    ctx.lineTo(x + 18, 0);
    ctx.lineTo(x + 70, h * 0.7);
    ctx.lineTo(x - 70, h * 0.7);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = hexAlpha(bd.accent || '#ef4444', 0.35);
  ctx.fillRect(0, h * 0.72, w, 8);
}

function paintCrater(ctx, w, h, bd) {
  const g = ctx.createRadialGradient(w / 2, h * 0.55, 10, w / 2, h * 0.5, h * 0.55);
  g.addColorStop(0, hexAlpha(bd.glow || '#ff2200', 0.55));
  g.addColorStop(0.5, hexAlpha(bd.accent || '#fb923c', 0.2));
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#ffaa66';
  for (let i = 0; i < 60; i++) {
    ctx.globalAlpha = 0.15 + Math.random() * 0.4;
    ctx.beginPath();
    ctx.arc(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(8,2,2,0.8)';
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += 30) {
    ctx.lineTo(x, h * (0.62 + Math.sin(x * 0.04) * 0.06 + Math.random() * 0.05));
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
}

function hexAlpha(hex, a) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
}
