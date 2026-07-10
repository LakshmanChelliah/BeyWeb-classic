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

/** Dense packed spectator stands (anime tournament still). */
function paintCrowd(ctx, w, h, y, height, density = 140) {
  for (let i = 0; i < density; i++) {
    const x = (i / density) * w + ((i * 17) % 9) - 4;
    const hh = height * (0.5 + (i % 7) * 0.08);
    const body = i % 4 === 0 ? '#2a3040' : i % 4 === 1 ? '#3a4558' : i % 4 === 2 ? '#1e2838' : '#343c4c';
    ctx.fillStyle = body;
    ctx.fillRect(x, y - hh, 6 + (i % 3) * 2, hh);
    // Head
    ctx.fillStyle = i % 5 === 0 ? '#e8c8a0' : i % 5 === 1 ? '#c4a888' : '#d4b898';
    ctx.beginPath();
    ctx.arc(x + 4, y - hh - 2, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** WBBA Headquarters — indoor tournament bowl with a wall of still crowds. */
function paintWbba(ctx, w, h) {
  // Dark indoor ceiling + warm stadium floodlights
  paintSky(ctx, w, h, '#0a1020', '#1a2a48', '#2a4a58');
  const lamp = ctx.createRadialGradient(w * 0.5, h * 0.04, 0, w * 0.5, h * 0.04, 280);
  lamp.addColorStop(0, 'rgba(255,236,180,0.75)');
  lamp.addColorStop(0.4, 'rgba(200,180,120,0.22)');
  lamp.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = lamp;
  ctx.fillRect(0, 0, w, h * 0.4);

  // Packed stands
  for (let row = 0; row < 8; row++) {
    const y = h * (0.18 + row * 0.055);
    const rowH = 38 + row * 2;
    ctx.fillStyle = row % 2 === 0 ? '#1a2230' : '#151c28';
    ctx.fillRect(0, y - rowH, w, rowH + 4);
    paintCrowd(ctx, w, h, y, rowH * 0.85, 160 + row * 8);
  }

  // Jumbotron band
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(w * 0.28, h * 0.12, w * 0.44, h * 0.12);
  const screen = ctx.createLinearGradient(0, h * 0.12, 0, h * 0.24);
  screen.addColorStop(0, '#67e8f9');
  screen.addColorStop(1, '#0891b2');
  ctx.fillStyle = screen;
  ctx.fillRect(w * 0.3, h * 0.13, w * 0.4, h * 0.1);

  // Teal stadium floor
  const teal = ctx.createLinearGradient(0, h * 0.62, 0, h);
  teal.addColorStop(0, '#2a9aaa');
  teal.addColorStop(1, '#1e7888');
  ctx.fillStyle = teal;
  ctx.fillRect(0, h * 0.62, w, h * 0.38);
  ctx.strokeStyle = 'rgba(20,80,90,0.35)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 12; i++) {
    ctx.beginPath();
    ctx.moveTo((i / 12) * w, h * 0.62);
    ctx.lineTo((i / 12) * w, h);
    ctx.stroke();
  }

  // Raised gold platform band (anime signature)
  const gold = ctx.createLinearGradient(0, h * 0.72, 0, h * 0.92);
  gold.addColorStop(0, '#e8c868');
  gold.addColorStop(0.5, '#d4a84a');
  gold.addColorStop(1, '#a87828');
  ctx.fillStyle = gold;
  ctx.fillRect(0, h * 0.74, w, h * 0.16);
  ctx.fillStyle = 'rgba(255,240,200,0.25)';
  ctx.fillRect(0, h * 0.74, w, 6);
  // Gold curb drop to teal
  ctx.fillStyle = '#a87828';
  ctx.fillRect(0, h * 0.9, w, 10);

  // Dark dish oval hint in center-bottom
  ctx.fillStyle = '#2a3038';
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.95, w * 0.22, h * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
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

/** Metal Bey Rooftop — elevated deck; painted skyline with towers taller than the stadium. */
function paintRooftop(ctx, w, h) {
  paintSky(ctx, w, h, '#2a78c0', '#6ab0e0', '#a8d0f0');
  paintSun(ctx, w * 0.8, h * 0.12, 110, 'rgba(255,250,220,0.8)');
  paintClouds(ctx, w, h, h * 0.1, 'rgba(255,255,255,0.45)', 6);

  // Far skyline — very tall towers that rise into the upper sky
  for (let i = 0; i < 28; i++) {
    const x = (i / 28) * w;
    const bh = 120 + ((i * 61) % 220);
    const bw = 22 + (i % 4) * 10;
    ctx.fillStyle = i % 3 === 0 ? '#4a5868' : i % 3 === 1 ? '#3a4858' : '#2a3848';
    // Tops reach well into the upper third of the canvas (above stadium eye-line)
    ctx.fillRect(x, h * 0.55 - bh, bw, bh);
    ctx.fillStyle = 'rgba(200,220,240,0.35)';
    for (let wy = 0; wy < Math.floor(bh / 12); wy++) {
      for (let wx = 0; wx < Math.floor(bw / 9); wx++) {
        if ((wx + wy + i) % 2 === 0) continue;
        ctx.fillRect(x + 3 + wx * 9, h * 0.55 - bh + 5 + wy * 12, 4, 6);
      }
    }
  }

  // Near taller towers (looming past the deck)
  for (let i = 0; i < 8; i++) {
    const x = w * (0.05 + i * 0.12);
    const bh = 200 + (i % 3) * 60;
    const bw = 36 + (i % 2) * 14;
    ctx.fillStyle = '#2a3545';
    ctx.fillRect(x, h * 0.62 - bh, bw, bh);
    ctx.fillStyle = 'rgba(180,210,240,0.4)';
    for (let wy = 0; wy < 18; wy++) {
      ctx.fillRect(x + 6, h * 0.62 - bh + 10 + wy * 12, 10, 7);
      ctx.fillRect(x + bw - 16, h * 0.62 - bh + 10 + wy * 12, 10, 7);
    }
  }

  // Below-deck haze / distant streets
  const below = ctx.createLinearGradient(0, h * 0.55, 0, h);
  below.addColorStop(0, 'rgba(80,110,140,0)');
  below.addColorStop(0.4, 'rgba(70,100,130,0.4)');
  below.addColorStop(1, '#5a7a98');
  ctx.fillStyle = below;
  ctx.fillRect(0, h * 0.55, w, h * 0.45);
}

/** Dark Nebula HQ Rooftop — purple night sky, city far below in cyan mist. */
function paintDarkNebula(ctx, w, h) {
  // Deep purple night sky
  paintSky(ctx, w, h, '#1a0a30', '#2a1450', '#3a2080');
  paintClouds(ctx, w, h, h * 0.16, 'rgba(80,50,120,0.4)', 5);

  // Soft purple glow / moon haze
  const glow = ctx.createRadialGradient(w * 0.7, h * 0.18, 0, w * 0.7, h * 0.18, 180);
  glow.addColorStop(0, 'rgba(160,100,255,0.35)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h * 0.5);

  // Lightning
  ctx.strokeStyle = 'rgba(180,200,255,0.75)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(w * 0.22, h * 0.05);
  ctx.lineTo(w * 0.26, h * 0.16);
  ctx.lineTo(w * 0.2, h * 0.18);
  ctx.lineTo(w * 0.28, h * 0.32);
  ctx.stroke();

  // Mid-distance towers rising through mist (taller than stadium eye-line)
  for (let i = 0; i < 18; i++) {
    const x = (i / 18) * w;
    const bh = 90 + ((i * 67) % 180);
    const bw = 20 + (i % 3) * 12;
    ctx.fillStyle = i % 2 === 0 ? '#0e0a1c' : '#120e22';
    ctx.fillRect(x, h * 0.48 - bh, bw, bh);
    // Cyan window bands
    ctx.fillStyle = 'rgba(80,220,255,0.45)';
    for (let wy = 0; wy < Math.floor(bh / 14); wy++) {
      if ((wy + i) % 3 === 0) continue;
      ctx.fillRect(x + 3, h * 0.48 - bh + 6 + wy * 14, bw - 6, 4);
    }
  }

  // Signature spiral / stepped Dark Nebula tower (center-left)
  ctx.fillStyle = '#0a0614';
  for (let t = 0; t < 7; t++) {
    const tw = 70 - t * 8;
    const th = 28;
    ctx.fillRect(w * 0.28 - tw / 2, h * 0.42 - t * 26 - 40, tw, th);
  }

  // Orb tower (right) — glowing cyan sphere cradled by pillars
  const ox = w * 0.78;
  ctx.fillStyle = '#0e0a1a';
  ctx.fillRect(ox - 18, h * 0.2, 12, h * 0.28);
  ctx.fillRect(ox + 8, h * 0.2, 12, h * 0.28);
  const orb = ctx.createRadialGradient(ox + 1, h * 0.28, 0, ox + 1, h * 0.28, 42);
  orb.addColorStop(0, 'rgba(120,240,255,0.95)');
  orb.addColorStop(0.45, 'rgba(40,160,255,0.7)');
  orb.addColorStop(1, 'rgba(20,40,120,0)');
  ctx.fillStyle = orb;
  ctx.beginPath();
  ctx.arc(ox + 1, h * 0.28, 42, 0, Math.PI * 2);
  ctx.fill();

  // Thick cyan/purple mist bank — city streets 1000m below
  const mist = ctx.createLinearGradient(0, h * 0.42, 0, h);
  mist.addColorStop(0, 'rgba(40,20,80,0)');
  mist.addColorStop(0.25, 'rgba(40,120,200,0.35)');
  mist.addColorStop(0.55, 'rgba(60,40,120,0.75)');
  mist.addColorStop(1, '#1a0a28');
  ctx.fillStyle = mist;
  ctx.fillRect(0, h * 0.42, w, h * 0.58);

  // Faint city lights deep in the mist
  for (let i = 0; i < 80; i++) {
    ctx.globalAlpha = 0.15 + Math.random() * 0.35;
    ctx.fillStyle = Math.random() > 0.5 ? '#67e8f9' : '#c084fc';
    ctx.fillRect(Math.random() * w, h * 0.55 + Math.random() * h * 0.4, 2 + Math.random() * 3, 2);
  }
  ctx.globalAlpha = 1;
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
