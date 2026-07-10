/**
 * Painted sky-dome horizons for each anime venue.
 * Upper hemisphere only — the ground ring owns the floor.
 * Styled after Metal Fusion stadium locations (recessed pit in a real place).
 */

import * as THREE from 'three';

function paintSky(ctx, w, h, top, mid, bot) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, top);
  g.addColorStop(0.55, mid);
  g.addColorStop(1, bot);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function paintSun(ctx, x, y, r, color) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(0.4, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function paintClouds(ctx, w, h, y0, color, count = 5) {
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const x = (i / count) * w + ((i * 97) % 80);
    const y = y0 + ((i * 37) % 40);
    const s = 28 + (i % 3) * 18;
    ctx.beginPath();
    ctx.ellipse(x, y, s * 1.6, s * 0.55, 0, 0, Math.PI * 2);
    ctx.ellipse(x - s * 0.7, y + 4, s * 0.9, s * 0.4, 0, 0, Math.PI * 2);
    ctx.ellipse(x + s * 0.8, y + 2, s, s * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Soft crowd band behind a low arena wall (tournament / WBBA feel). */
function paintCrowd(ctx, w, h, y, height) {
  for (let i = 0; i < 90; i++) {
    const x = (i / 90) * w + ((i * 13) % 7);
    const hh = height * (0.55 + (i % 5) * 0.1);
    ctx.fillStyle = i % 3 === 0 ? '#2a3040' : i % 3 === 1 ? '#3a4050' : '#1a2030';
    ctx.fillRect(x, y - hh, 8 + (i % 3) * 3, hh);
    // Head dots
    ctx.fillStyle = i % 4 === 0 ? '#e8c8a0' : '#c4a888';
    ctx.beginPath();
    ctx.arc(x + 5, y - hh - 3, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Abandoned Construction Site — blue girders, unfinished slabs (anime site). */
function paintConstruction(ctx, w, h) {
  paintSky(ctx, w, h, '#6a9ab8', '#a8c0d0', '#c8b8a0');
  paintSun(ctx, w * 0.8, h * 0.2, 85, 'rgba(255,230,180,0.5)');
  paintClouds(ctx, w, h, h * 0.16, 'rgba(255,255,255,0.35)', 4);

  // Industrial back wall
  ctx.fillStyle = '#5a6870';
  ctx.fillRect(0, h * 0.42, w, h * 0.35);

  // Blue construction girders (signature of the anime site stadium)
  ctx.strokeStyle = '#3a7ab8';
  ctx.lineWidth = 10;
  for (let i = 0; i < 8; i++) {
    const x = 40 + i * (w / 8);
    ctx.beginPath();
    ctx.moveTo(x, h * 0.75);
    ctx.lineTo(x, h * 0.28);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 30, h * 0.35);
    ctx.lineTo(x + 30, h * 0.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 30, h * 0.35);
    ctx.lineTo(x - 30, h * 0.5);
    ctx.stroke();
  }
  // Horizontal beams
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.38);
  ctx.lineTo(w, h * 0.38);
  ctx.moveTo(0, h * 0.52);
  ctx.lineTo(w, h * 0.52);
  ctx.stroke();

  // Unfinished concrete towers
  for (let i = 0; i < 4; i++) {
    const x = w * 0.05 + i * w * 0.28;
    ctx.fillStyle = '#8a8680';
    ctx.fillRect(x, h * 0.22, 55, h * 0.2);
    ctx.strokeStyle = '#5a5048';
    ctx.lineWidth = 2;
    for (let r = 0; r < 4; r++) {
      ctx.beginPath();
      ctx.moveTo(x + 10 + r * 12, h * 0.22);
      ctx.lineTo(x + 10 + r * 12, h * 0.22 - 16);
      ctx.stroke();
    }
  }

  // Floor haze (concrete)
  const haze = ctx.createLinearGradient(0, h * 0.7, 0, h);
  haze.addColorStop(0, 'rgba(160,160,160,0)');
  haze.addColorStop(1, 'rgba(140,140,140,0.55)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, h * 0.7, w, h * 0.3);
}

/** Survival Island — lush green isle in turquoise water. */
function paintIsland(ctx, w, h) {
  paintSky(ctx, w, h, '#4aa0d8', '#87ceeb', '#b8e0f0');
  paintSun(ctx, w * 0.85, h * 0.18, 100, 'rgba(255,250,200,0.7)');
  paintClouds(ctx, w, h, h * 0.14, 'rgba(255,255,255,0.5)', 5);

  // Distant green hills
  ctx.fillStyle = '#2d7a40';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.52);
  ctx.quadraticCurveTo(w * 0.2, h * 0.32, w * 0.45, h * 0.5);
  ctx.quadraticCurveTo(w * 0.65, h * 0.28, w * 0.9, h * 0.48);
  ctx.lineTo(w, h * 0.52);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#3d9a50';
  ctx.beginPath();
  ctx.moveTo(w * 0.15, h * 0.52);
  ctx.quadraticCurveTo(w * 0.4, h * 0.38, w * 0.7, h * 0.5);
  ctx.closePath();
  ctx.fill();

  // Turquoise ocean
  const ocean = ctx.createLinearGradient(0, h * 0.5, 0, h * 0.78);
  ocean.addColorStop(0, '#2a9ab8');
  ocean.addColorStop(0.4, '#3ab8d0');
  ocean.addColorStop(1, '#5ad0e0');
  ctx.fillStyle = ocean;
  ctx.fillRect(0, h * 0.5, w, h * 0.28);

  // Island landmass in mid
  ctx.fillStyle = '#4a9a40';
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.62, w * 0.38, h * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#6aba50';
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.6, w * 0.28, h * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();

  // Palm silhouettes
  for (let p = 0; p < 5; p++) {
    const px = w * (0.18 + p * 0.16);
    const py = h * 0.58;
    ctx.strokeStyle = '#3a5028';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.quadraticCurveTo(px + 6, py - 35, px + 2, py - 60);
    ctx.stroke();
    ctx.strokeStyle = '#2d6a30';
    ctx.lineWidth = 3;
    for (let l = 0; l < 5; l++) {
      const a = -Math.PI / 2 + (l - 2) * 0.4;
      ctx.beginPath();
      ctx.moveTo(px + 2, py - 60);
      ctx.quadraticCurveTo(
        px + 2 + Math.cos(a) * 28,
        py - 60 + Math.sin(a) * 18 - 8,
        px + 2 + Math.cos(a) * 48,
        py - 60 + Math.sin(a) * 30
      );
      ctx.stroke();
    }
  }

  // Beach / sand band at bottom
  const sand = ctx.createLinearGradient(0, h * 0.75, 0, h);
  sand.addColorStop(0, '#c8e070');
  sand.addColorStop(0.35, '#e8d4a0');
  sand.addColorStop(1, '#d4bc80');
  ctx.fillStyle = sand;
  ctx.fillRect(0, h * 0.75, w, h * 0.25);
}

/** WBBA Headquarters — indoor tournament bowl with crowd + rafters. */
function paintWbba(ctx, w, h) {
  // Bright stadium ceiling light
  paintSky(ctx, w, h, '#6a9ad0', '#a8c8e8', '#d0dce8');
  const lamp = ctx.createRadialGradient(w * 0.5, h * 0.08, 0, w * 0.5, h * 0.08, 220);
  lamp.addColorStop(0, 'rgba(255,255,255,0.85)');
  lamp.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = lamp;
  ctx.fillRect(0, 0, w, h * 0.45);

  // Rafters / beams
  ctx.strokeStyle = 'rgba(30,40,60,0.55)';
  ctx.lineWidth = 6;
  for (let i = 0; i < 7; i++) {
    const x = (i / 6) * w;
    ctx.beginPath();
    ctx.moveTo(w * 0.5, h * 0.05);
    ctx.lineTo(x, h * 0.42);
    ctx.stroke();
  }

  // Crowd tiers
  paintCrowd(ctx, w, h, h * 0.58, 70);
  paintCrowd(ctx, w, h, h * 0.68, 50);

  // Low arena wall
  ctx.fillStyle = '#3a4050';
  ctx.fillRect(0, h * 0.68, w, 18);
  ctx.fillStyle = '#5a6878';
  ctx.fillRect(0, h * 0.68, w, 4);

  // Tiled floor band
  const floor = ctx.createLinearGradient(0, h * 0.7, 0, h);
  floor.addColorStop(0, '#c8d0d8');
  floor.addColorStop(1, '#a8b0b8');
  ctx.fillStyle = floor;
  ctx.fillRect(0, h * 0.7, w, h * 0.3);
  ctx.strokeStyle = 'rgba(80,90,100,0.35)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 12; i++) {
    ctx.beginPath();
    ctx.moveTo((i / 12) * w, h * 0.7);
    ctx.lineTo((i / 12) * w, h);
    ctx.stroke();
  }
}

/** Metal Bey Rooftop — urban plaza tiles + city skyline (rim flush look). */
function paintRooftop(ctx, w, h) {
  paintSky(ctx, w, h, '#5aa0d0', '#8ec8e8', '#d0e8f8');
  paintSun(ctx, w * 0.8, h * 0.16, 90, 'rgba(255,250,220,0.7)');
  paintClouds(ctx, w, h, h * 0.15, 'rgba(255,255,255,0.5)', 5);

  // City skyline
  for (let i = 0; i < 22; i++) {
    const x = (i / 22) * w;
    const bh = 55 + ((i * 47) % 160);
    const bw = 28 + (i % 3) * 12;
    ctx.fillStyle = i % 3 === 0 ? '#6a7888' : i % 3 === 1 ? '#5a6878' : '#4a5868';
    ctx.fillRect(x, h * 0.55 - bh, bw, bh);
    ctx.fillStyle = 'rgba(220,235,250,0.4)';
    for (let wy = 0; wy < Math.floor(bh / 14); wy++) {
      for (let wx = 0; wx < Math.floor(bw / 10); wx++) {
        if ((wx + wy + i) % 2 === 0) continue;
        ctx.fillRect(x + 4 + wx * 10, h * 0.55 - bh + 6 + wy * 14, 5, 7);
      }
    }
  }

  // Plaza / rooftop ledge
  ctx.fillStyle = '#8a9098';
  ctx.fillRect(0, h * 0.54, w, h * 0.08);
  ctx.fillStyle = '#a8b0b8';
  ctx.fillRect(w * 0.1, h * 0.46, 70, 40);
  ctx.fillRect(w * 0.72, h * 0.44, 85, 48);

  // Light stone tile floor
  const roof = ctx.createLinearGradient(0, h * 0.6, 0, h);
  roof.addColorStop(0, '#c8c8c8');
  roof.addColorStop(1, '#a8a8a8');
  ctx.fillStyle = roof;
  ctx.fillRect(0, h * 0.6, w, h * 0.4);
  ctx.strokeStyle = 'rgba(90,90,90,0.35)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 10; i++) {
    ctx.beginPath();
    ctx.moveTo(0, h * 0.6 + i * 20);
    ctx.lineTo(w, h * 0.6 + i * 20);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(i * (w / 10), h * 0.6);
    ctx.lineTo(i * (w / 10), h);
    ctx.stroke();
  }
}

/** Koma Village — rural mountains, forest, dirt path. */
function paintVillage(ctx, w, h) {
  paintSky(ctx, w, h, '#5a8ab8', '#a8c8e0', '#e8dcc0');
  paintSun(ctx, w * 0.18, h * 0.2, 80, 'rgba(255,240,200,0.55)');
  paintClouds(ctx, w, h, h * 0.16, 'rgba(255,255,255,0.45)', 5);

  // Mountains
  ctx.fillStyle = '#6a8090';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.52);
  ctx.lineTo(w * 0.25, h * 0.26);
  ctx.lineTo(w * 0.5, h * 0.52);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#5a7080';
  ctx.beginPath();
  ctx.moveTo(w * 0.35, h * 0.52);
  ctx.lineTo(w * 0.62, h * 0.2);
  ctx.lineTo(w * 0.9, h * 0.52);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e8f0f8';
  ctx.beginPath();
  ctx.moveTo(w * 0.55, h * 0.3);
  ctx.lineTo(w * 0.62, h * 0.2);
  ctx.lineTo(w * 0.69, h * 0.3);
  ctx.closePath();
  ctx.fill();

  // Dense forest / bamboo band
  ctx.fillStyle = '#2d6a38';
  for (let i = 0; i < 28; i++) {
    const x = (i / 28) * w;
    const hh = 40 + (i % 4) * 18;
    ctx.fillRect(x, h * 0.55 - hh, 10, hh);
    ctx.beginPath();
    ctx.moveTo(x - 4, h * 0.55 - hh);
    ctx.lineTo(x + 5, h * 0.55 - hh - 20);
    ctx.lineTo(x + 14, h * 0.55 - hh);
    ctx.fill();
  }

  // Houses
  for (let i = 0; i < 4; i++) {
    const x = w * 0.15 + i * w * 0.18;
    ctx.fillStyle = '#e8d8c0';
    ctx.fillRect(x, h * 0.55, 50, 30);
    ctx.fillStyle = '#8a4030';
    ctx.beginPath();
    ctx.moveTo(x - 5, h * 0.55);
    ctx.lineTo(x + 25, h * 0.55 - 18);
    ctx.lineTo(x + 55, h * 0.55);
    ctx.closePath();
    ctx.fill();
  }

  const dirt = ctx.createLinearGradient(0, h * 0.68, 0, h);
  dirt.addColorStop(0, '#8a7a58');
  dirt.addColorStop(1, '#6a5a40');
  ctx.fillStyle = dirt;
  ctx.fillRect(0, h * 0.68, w, h * 0.32);
}

/** Dark Nebula HQ Rooftop — jagged night peaks + ominous tower. */
function paintDarkNebula(ctx, w, h) {
  paintSky(ctx, w, h, '#0a0618', '#141028', '#1a1838');
  paintClouds(ctx, w, h, h * 0.2, 'rgba(60,50,90,0.45)', 4);

  // Lightning
  ctx.strokeStyle = 'rgba(200,180,255,0.8)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(w * 0.7, h * 0.06);
  ctx.lineTo(w * 0.66, h * 0.18);
  ctx.lineTo(w * 0.72, h * 0.2);
  ctx.lineTo(w * 0.64, h * 0.36);
  ctx.stroke();

  // Jagged mountain silhouettes
  ctx.fillStyle = '#0e0c18';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.62);
  for (let i = 0; i < 12; i++) {
    const x = (i / 11) * w;
    const y = h * 0.35 + ((i * 37) % 80);
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, h * 0.62);
  ctx.closePath();
  ctx.fill();

  // Dark tower
  const tx = w * 0.5 - 40;
  ctx.fillStyle = '#0a0614';
  ctx.fillRect(tx, h * 0.2, 80, h * 0.45);
  ctx.fillStyle = '#1a0a28';
  ctx.beginPath();
  ctx.moveTo(tx - 8, h * 0.2);
  ctx.lineTo(tx + 40, h * 0.08);
  ctx.lineTo(tx + 88, h * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(160,60,255,0.45)';
  for (let wy = 0; wy < 10; wy++) {
    ctx.fillRect(tx + 12, h * 0.25 + wy * 18, 18, 8);
    ctx.fillRect(tx + 48, h * 0.25 + wy * 18, 18, 8);
  }

  const roof = ctx.createLinearGradient(0, h * 0.6, 0, h);
  roof.addColorStop(0, '#1a1020');
  roof.addColorStop(1, '#0e0a14');
  ctx.fillStyle = roof;
  ctx.fillRect(0, h * 0.6, w, h * 0.4);
}

/** City Streets — neon canyon. */
function paintStreets(ctx, w, h) {
  paintSky(ctx, w, h, '#1a2848', '#3a5070', '#687888');
  paintClouds(ctx, w, h, h * 0.14, 'rgba(180,190,200,0.28)', 3);

  for (let side = 0; side < 2; side++) {
    for (let i = 0; i < 5; i++) {
      const x = side === 0 ? i * 55 : w - 55 - i * 55;
      const bh = 100 + (i % 3) * 50;
      ctx.fillStyle = side === 0 ? '#2a3548' : '#243040';
      ctx.fillRect(x, h * 0.62 - bh, 50, bh);
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,60,100,0.7)' : 'rgba(60,200,255,0.7)';
      ctx.fillRect(x + 8, h * 0.62 - bh + 20, 34, 12);
      ctx.fillStyle = 'rgba(255,220,100,0.35)';
      for (let wy = 0; wy < 5; wy++) {
        ctx.fillRect(x + 10, h * 0.62 - bh + 45 + wy * 18, 12, 10);
        ctx.fillRect(x + 28, h * 0.62 - bh + 45 + wy * 18, 12, 10);
      }
    }
  }

  ctx.fillStyle = '#3a3a40';
  ctx.beginPath();
  ctx.moveTo(w * 0.35, h * 0.52);
  ctx.lineTo(w * 0.65, h * 0.52);
  ctx.lineTo(w, h * 0.72);
  ctx.lineTo(0, h * 0.72);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#e8c840';
  ctx.lineWidth = 3;
  ctx.setLineDash([15, 12]);
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.52);
  ctx.lineTo(w * 0.5, h * 0.72);
  ctx.stroke();
  ctx.setLineDash([]);

  const road = ctx.createLinearGradient(0, h * 0.7, 0, h);
  road.addColorStop(0, '#3a3a42');
  road.addColorStop(1, '#2a2a30');
  ctx.fillStyle = road;
  ctx.fillRect(0, h * 0.7, w, h * 0.3);
}

/** Volcano Interior / crater — jagged rock, magma glow, dark peaks. */
function paintVolcano(ctx, w, h) {
  paintSky(ctx, w, h, '#1a1028', '#2a1830', '#4a2018');
  paintClouds(ctx, w, h, h * 0.18, 'rgba(80,40,40,0.35)', 3);

  // Magma glow
  const magma = ctx.createRadialGradient(w * 0.5, h * 0.9, 0, w * 0.5, h * 0.9, 300);
  magma.addColorStop(0, 'rgba(255,100,20,0.65)');
  magma.addColorStop(0.45, 'rgba(180,30,10,0.35)');
  magma.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = magma;
  ctx.fillRect(0, h * 0.25, w, h * 0.75);

  // Jagged crater rim / peaks
  ctx.fillStyle = '#1a1410';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.7);
  for (let i = 0; i < 14; i++) {
    const x = (i / 13) * w;
    const y = h * 0.28 + ((i % 3) * 35) + ((i * 19) % 40);
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, h * 0.7);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#2a1c14';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, h);
  ctx.lineTo(w * 0.18, h);
  ctx.quadraticCurveTo(w * 0.12, h * 0.5, w * 0.22, 0);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w, 0);
  ctx.lineTo(w, h);
  ctx.lineTo(w * 0.82, h);
  ctx.quadraticCurveTo(w * 0.88, h * 0.5, w * 0.78, 0);
  ctx.closePath();
  ctx.fill();

  // Lava river
  const lava = ctx.createLinearGradient(0, h * 0.68, 0, h);
  lava.addColorStop(0, '#ff6010');
  lava.addColorStop(0.5, '#e02000');
  lava.addColorStop(1, '#801000');
  ctx.fillStyle = lava;
  ctx.beginPath();
  ctx.moveTo(w * 0.28, h * 0.7);
  ctx.quadraticCurveTo(w * 0.5, h * 0.62, w * 0.72, h * 0.7);
  ctx.lineTo(w * 0.82, h);
  ctx.lineTo(w * 0.18, h);
  ctx.closePath();
  ctx.fill();
}

/** Keys must match `skin.backdrop.style` in arenaSkins.js */
const PAINTERS = {
  construction: paintConstruction,
  survival_island: paintIsland,
  wbba_hq: paintWbba,
  rooftop_day: paintRooftop,
  koma_village: paintVillage,
  dn_rooftop_night: paintDarkNebula,
  city_streets: paintStreets,
  volcano: paintVolcano,
};

/**
 * @param {{ backdrop?: { style?: string } }} skin
 * @returns {THREE.CanvasTexture}
 */
export function createBackdropTexture(skin) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const style = skin?.backdrop?.style || 'construction';
  const painter = PAINTERS[style] || paintConstruction;
  painter(ctx, canvas.width, canvas.height);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}
