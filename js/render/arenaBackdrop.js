/**
 * Painted sky-dome horizons for each anime venue.
 * Upper hemisphere only — the ground plane owns the floor.
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
  g.addColorStop(0.45, color);
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

/** Abandoned Construction Site — unfinished concrete towers, cranes, scaffolding. */
function paintConstruction(ctx, w, h) {
  paintSky(ctx, w, h, '#6a8498', '#a8b8c4', '#c4b8a0');
  paintSun(ctx, w * 0.78, h * 0.22, 90, 'rgba(255,220,160,0.55)');
  paintClouds(ctx, w, h, h * 0.18, 'rgba(255,255,255,0.35)', 4);

  // Distant unfinished towers
  for (let i = 0; i < 7; i++) {
    const x = (i / 7) * w + 20;
    const bh = 90 + (i % 3) * 50;
    const bw = 48 + (i % 2) * 16;
    ctx.fillStyle = i % 2 === 0 ? '#8a8680' : '#7a7670';
    ctx.fillRect(x, h * 0.72 - bh, bw, bh);
    // Floor slabs
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    for (let f = 0; f < 5; f++) {
      const fy = h * 0.72 - bh + (f + 1) * (bh / 6);
      ctx.beginPath();
      ctx.moveTo(x, fy);
      ctx.lineTo(x + bw, fy);
      ctx.stroke();
    }
    // Rebar stubs on top
    ctx.strokeStyle = '#5a5048';
    ctx.lineWidth = 2;
    for (let r = 0; r < 4; r++) {
      ctx.beginPath();
      ctx.moveTo(x + 8 + r * (bw / 4), h * 0.72 - bh);
      ctx.lineTo(x + 8 + r * (bw / 4), h * 0.72 - bh - 18);
      ctx.stroke();
    }
  }

  // Crane
  ctx.strokeStyle = '#c4a030';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(w * 0.18, h * 0.72);
  ctx.lineTo(w * 0.18, h * 0.28);
  ctx.lineTo(w * 0.42, h * 0.28);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(w * 0.36, h * 0.28);
  ctx.lineTo(w * 0.36, h * 0.48);
  ctx.stroke();
  ctx.fillStyle = '#a08020';
  ctx.fillRect(w * 0.33, h * 0.48, 28, 16);

  // Scaffolding
  ctx.strokeStyle = 'rgba(200,160,60,0.7)';
  ctx.lineWidth = 2;
  for (let s = 0; s < 3; s++) {
    const sx = w * 0.55 + s * 70;
    ctx.strokeRect(sx, h * 0.45, 50, h * 0.27);
    ctx.beginPath();
    ctx.moveTo(sx, h * 0.54);
    ctx.lineTo(sx + 50, h * 0.54);
    ctx.moveTo(sx, h * 0.63);
    ctx.lineTo(sx + 50, h * 0.63);
    ctx.stroke();
  }

  // Ground haze
  const haze = ctx.createLinearGradient(0, h * 0.68, 0, h);
  haze.addColorStop(0, 'rgba(180,160,120,0)');
  haze.addColorStop(1, 'rgba(160,140,100,0.5)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, h * 0.68, w, h * 0.32);
}

/** Survival Island — tropical beach, ocean, palm silhouettes. */
function paintIsland(ctx, w, h) {
  paintSky(ctx, w, h, '#4a90c8', '#87ceeb', '#f0e0b0');
  paintSun(ctx, w * 0.82, h * 0.2, 100, 'rgba(255,240,180,0.7)');
  paintClouds(ctx, w, h, h * 0.15, 'rgba(255,255,255,0.5)', 5);

  // Ocean
  const ocean = ctx.createLinearGradient(0, h * 0.55, 0, h * 0.78);
  ocean.addColorStop(0, '#2a7ab0');
  ocean.addColorStop(0.5, '#3a9ad0');
  ocean.addColorStop(1, '#5ab8d8');
  ctx.fillStyle = ocean;
  ctx.fillRect(0, h * 0.55, w, h * 0.23);

  // Wave lines
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    const y = h * 0.58 + i * 12;
    ctx.beginPath();
    for (let x = 0; x < w; x += 20) {
      const yy = y + Math.sin(x * 0.04 + i) * 3;
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }

  // Distant island hills
  ctx.fillStyle = '#2d6a3a';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.58);
  ctx.quadraticCurveTo(w * 0.2, h * 0.42, w * 0.4, h * 0.55);
  ctx.quadraticCurveTo(w * 0.55, h * 0.38, w * 0.75, h * 0.52);
  ctx.lineTo(w, h * 0.56);
  ctx.lineTo(w, h * 0.58);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#3d8a4a';
  ctx.beginPath();
  ctx.moveTo(w * 0.1, h * 0.58);
  ctx.quadraticCurveTo(w * 0.3, h * 0.48, w * 0.5, h * 0.56);
  ctx.lineTo(w * 0.1, h * 0.58);
  ctx.fill();

  // Palm trees
  for (let p = 0; p < 4; p++) {
    const px = w * (0.12 + p * 0.22);
    const py = h * 0.62;
    ctx.strokeStyle = '#5a4030';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.quadraticCurveTo(px + 8, py - 40, px + 4, py - 70);
    ctx.stroke();
    ctx.strokeStyle = '#2d6a3a';
    ctx.lineWidth = 4;
    for (let l = 0; l < 5; l++) {
      const a = -Math.PI / 2 + (l - 2) * 0.45;
      ctx.beginPath();
      ctx.moveTo(px + 4, py - 70);
      ctx.quadraticCurveTo(
        px + 4 + Math.cos(a) * 30,
        py - 70 + Math.sin(a) * 20 - 10,
        px + 4 + Math.cos(a) * 55,
        py - 70 + Math.sin(a) * 35
      );
      ctx.stroke();
    }
  }

  // Beach sand band
  const sand = ctx.createLinearGradient(0, h * 0.75, 0, h);
  sand.addColorStop(0, '#e8d4a0');
  sand.addColorStop(1, '#d4bc80');
  ctx.fillStyle = sand;
  ctx.fillRect(0, h * 0.75, w, h * 0.25);
}

/** WBBA Headquarters — modern glass HQ building, city plaza. */
function paintWbba(ctx, w, h) {
  paintSky(ctx, w, h, '#1a3a6a', '#3a6aaa', '#8ab0d0');
  paintSun(ctx, w * 0.15, h * 0.18, 70, 'rgba(200,220,255,0.4)');
  paintClouds(ctx, w, h, h * 0.2, 'rgba(200,220,255,0.25)', 4);

  // Side buildings
  for (let i = 0; i < 6; i++) {
    const x = i < 3 ? i * 70 : w - (6 - i) * 70;
    const bh = 80 + (i % 3) * 40;
    ctx.fillStyle = i % 2 === 0 ? '#2a3a50' : '#243448';
    ctx.fillRect(x, h * 0.72 - bh, 55, bh);
    ctx.fillStyle = 'rgba(120,180,255,0.25)';
    for (let wy = 0; wy < 6; wy++) {
      for (let wx = 0; wx < 3; wx++) {
        ctx.fillRect(x + 8 + wx * 14, h * 0.72 - bh + 10 + wy * 14, 10, 10);
      }
    }
  }

  // Central WBBA HQ tower
  const hx = w * 0.5 - 70;
  const hh = 220;
  ctx.fillStyle = '#1e3a5c';
  ctx.fillRect(hx, h * 0.72 - hh, 140, hh);
  // Glass face
  const glass = ctx.createLinearGradient(hx, h * 0.72 - hh, hx + 140, h * 0.72);
  glass.addColorStop(0, 'rgba(100,180,255,0.45)');
  glass.addColorStop(0.5, 'rgba(60,120,200,0.35)');
  glass.addColorStop(1, 'rgba(40,80,140,0.5)');
  ctx.fillStyle = glass;
  ctx.fillRect(hx + 8, h * 0.72 - hh + 8, 124, hh - 16);
  // WBBA letters
  ctx.fillStyle = '#e8f0ff';
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('WBBA', w * 0.5, h * 0.72 - hh + 50);
  // Antenna
  ctx.strokeStyle = '#c0d0e0';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.72 - hh);
  ctx.lineTo(w * 0.5, h * 0.72 - hh - 40);
  ctx.stroke();
  ctx.fillStyle = '#ff4040';
  ctx.beginPath();
  ctx.arc(w * 0.5, h * 0.72 - hh - 40, 5, 0, Math.PI * 2);
  ctx.fill();

  // Plaza
  const plaza = ctx.createLinearGradient(0, h * 0.7, 0, h);
  plaza.addColorStop(0, '#4a5a70');
  plaza.addColorStop(1, '#3a4a60');
  ctx.fillStyle = plaza;
  ctx.fillRect(0, h * 0.7, w, h * 0.3);
}

/** Metal Bey Rooftop — daytime city skyline from a high rooftop. */
function paintRooftop(ctx, w, h) {
  paintSky(ctx, w, h, '#4a90c8', '#87ceeb', '#c8e4f8');
  paintSun(ctx, w * 0.82, h * 0.18, 95, 'rgba(255,250,220,0.75)');
  paintClouds(ctx, w, h, h * 0.16, 'rgba(255,255,255,0.55)', 6);

  // Dense daytime city skyline (must read clearly as rooftop view)
  for (let i = 0; i < 20; i++) {
    const x = (i / 20) * w;
    const bh = 70 + ((i * 47) % 150);
    const bw = 30 + (i % 3) * 12;
    ctx.fillStyle = i % 3 === 0 ? '#5a6878' : i % 3 === 1 ? '#4a5868' : '#3a4858';
    ctx.fillRect(x, h * 0.58 - bh, bw, bh);
    // Windows
    ctx.fillStyle = 'rgba(200,220,240,0.45)';
    for (let wy = 0; wy < Math.floor(bh / 14); wy++) {
      for (let wx = 0; wx < Math.floor(bw / 10); wx++) {
        if ((wx + wy + i) % 2 === 0) continue;
        ctx.fillRect(x + 4 + wx * 10, h * 0.58 - bh + 6 + wy * 14, 5, 7);
      }
    }
  }

  // Near rooftop ledge / HVAC units
  ctx.fillStyle = '#6a7078';
  ctx.fillRect(0, h * 0.56, w, h * 0.1);
  ctx.fillStyle = '#8a9098';
  ctx.fillRect(w * 0.08, h * 0.48, 70, 45);
  ctx.fillRect(w * 0.68, h * 0.44, 90, 55);
  ctx.fillStyle = '#a0a8b0';
  ctx.fillRect(w * 0.1, h * 0.46, 24, 14);
  ctx.fillRect(w * 0.7, h * 0.42, 28, 16);
  // Railing
  ctx.strokeStyle = '#c8d0d8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.56);
  ctx.lineTo(w, h * 0.56);
  ctx.stroke();

  // Tar roof surface
  const roof = ctx.createLinearGradient(0, h * 0.64, 0, h);
  roof.addColorStop(0, '#5a6068');
  roof.addColorStop(1, '#3a4048');
  ctx.fillStyle = roof;
  ctx.fillRect(0, h * 0.64, w, h * 0.36);
}

/** Koma Village — rural Japanese village, mountains, wooden houses. */
function paintVillage(ctx, w, h) {
  paintSky(ctx, w, h, '#5a8ab8', '#a8c8e0', '#e8dcc0');
  paintSun(ctx, w * 0.2, h * 0.22, 85, 'rgba(255,240,200,0.55)');
  paintClouds(ctx, w, h, h * 0.18, 'rgba(255,255,255,0.45)', 5);

  // Mountains
  ctx.fillStyle = '#6a8090';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.55);
  ctx.lineTo(w * 0.25, h * 0.28);
  ctx.lineTo(w * 0.5, h * 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#5a7080';
  ctx.beginPath();
  ctx.moveTo(w * 0.35, h * 0.55);
  ctx.lineTo(w * 0.6, h * 0.22);
  ctx.lineTo(w * 0.85, h * 0.55);
  ctx.closePath();
  ctx.fill();
  // Snow caps
  ctx.fillStyle = '#e8f0f8';
  ctx.beginPath();
  ctx.moveTo(w * 0.18, h * 0.35);
  ctx.lineTo(w * 0.25, h * 0.28);
  ctx.lineTo(w * 0.32, h * 0.35);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w * 0.52, h * 0.32);
  ctx.lineTo(w * 0.6, h * 0.22);
  ctx.lineTo(w * 0.68, h * 0.32);
  ctx.closePath();
  ctx.fill();

  // Forest band
  ctx.fillStyle = '#3a6a40';
  for (let i = 0; i < 20; i++) {
    const x = (i / 20) * w;
    ctx.beginPath();
    ctx.moveTo(x, h * 0.58);
    ctx.lineTo(x + 18, h * 0.45 + (i % 3) * 8);
    ctx.lineTo(x + 36, h * 0.58);
    ctx.fill();
  }

  // Village houses
  for (let i = 0; i < 5; i++) {
    const x = w * 0.1 + i * (w * 0.16);
    const y = h * 0.58;
    // Walls
    ctx.fillStyle = '#e8d8c0';
    ctx.fillRect(x, y, 55, 35);
    // Roof
    ctx.fillStyle = '#8a4030';
    ctx.beginPath();
    ctx.moveTo(x - 6, y);
    ctx.lineTo(x + 27, y - 22);
    ctx.lineTo(x + 61, y);
    ctx.closePath();
    ctx.fill();
    // Door
    ctx.fillStyle = '#5a4030';
    ctx.fillRect(x + 20, y + 12, 14, 23);
  }

  // Dirt path / ground
  const dirt = ctx.createLinearGradient(0, h * 0.7, 0, h);
  dirt.addColorStop(0, '#8a7a58');
  dirt.addColorStop(1, '#6a5a40');
  ctx.fillStyle = dirt;
  ctx.fillRect(0, h * 0.7, w, h * 0.3);
}

/** Dark Nebula HQ Rooftop — ominous black tower, stormy night. */
function paintDarkNebula(ctx, w, h) {
  paintSky(ctx, w, h, '#0a0618', '#1a1030', '#2a1840');
  // Lightning flash glow
  const flash = ctx.createRadialGradient(w * 0.7, h * 0.25, 0, w * 0.7, h * 0.25, 150);
  flash.addColorStop(0, 'rgba(180,140,255,0.35)');
  flash.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = flash;
  ctx.fillRect(0, 0, w, h * 0.5);

  // Lightning bolt
  ctx.strokeStyle = 'rgba(200,180,255,0.85)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(w * 0.72, h * 0.08);
  ctx.lineTo(w * 0.68, h * 0.2);
  ctx.lineTo(w * 0.74, h * 0.22);
  ctx.lineTo(w * 0.66, h * 0.38);
  ctx.stroke();

  // Dark city
  for (let i = 0; i < 12; i++) {
    const x = (i / 12) * w;
    const bh = 50 + ((i * 53) % 100);
    ctx.fillStyle = '#0e0a18';
    ctx.fillRect(x, h * 0.62 - bh, 40, bh);
    ctx.fillStyle = 'rgba(160,80,255,0.3)';
    for (let wy = 0; wy < 4; wy++) {
      ctx.fillRect(x + 8, h * 0.62 - bh + 10 + wy * 16, 8, 8);
      ctx.fillRect(x + 22, h * 0.62 - bh + 10 + wy * 16, 8, 8);
    }
  }

  // Dark Nebula HQ — tall black tower with purple crown
  const tx = w * 0.5 - 45;
  const th = 260;
  ctx.fillStyle = '#0a0614';
  ctx.fillRect(tx, h * 0.65 - th, 90, th);
  ctx.fillStyle = '#1a0a28';
  ctx.beginPath();
  ctx.moveTo(tx - 10, h * 0.65 - th);
  ctx.lineTo(tx + 45, h * 0.65 - th - 50);
  ctx.lineTo(tx + 100, h * 0.65 - th);
  ctx.closePath();
  ctx.fill();
  // Purple windows
  ctx.fillStyle = 'rgba(160,60,255,0.5)';
  for (let wy = 0; wy < 12; wy++) {
    ctx.fillRect(tx + 15, h * 0.65 - th + 20 + wy * 18, 20, 10);
    ctx.fillRect(tx + 50, h * 0.65 - th + 20 + wy * 18, 20, 10);
  }
  // Emblem glow
  ctx.fillStyle = 'rgba(180,60,255,0.6)';
  ctx.beginPath();
  ctx.arc(tx + 45, h * 0.65 - th + 80, 18, 0, Math.PI * 2);
  ctx.fill();

  // Rooftop
  const roof = ctx.createLinearGradient(0, h * 0.62, 0, h);
  roof.addColorStop(0, '#1a1020');
  roof.addColorStop(1, '#0e0a14');
  ctx.fillStyle = roof;
  ctx.fillRect(0, h * 0.62, w, h * 0.38);
}

/** City Streets — urban street canyon, neon, asphalt. */
function paintStreets(ctx, w, h) {
  paintSky(ctx, w, h, '#1a2848', '#3a5070', '#687888');
  paintClouds(ctx, w, h, h * 0.15, 'rgba(180,190,200,0.3)', 3);

  // Buildings left & right (street canyon)
  for (let side = 0; side < 2; side++) {
    for (let i = 0; i < 5; i++) {
      const x = side === 0 ? i * 55 : w - 55 - i * 55;
      const bh = 100 + (i % 3) * 50;
      ctx.fillStyle = side === 0 ? '#2a3548' : '#243040';
      ctx.fillRect(x, h * 0.65 - bh, 50, bh);
      // Neon signs
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,60,100,0.7)' : 'rgba(60,200,255,0.7)';
      ctx.fillRect(x + 8, h * 0.65 - bh + 20, 34, 12);
      ctx.fillStyle = 'rgba(255,220,100,0.4)';
      for (let wy = 0; wy < 5; wy++) {
        ctx.fillRect(x + 10, h * 0.65 - bh + 45 + wy * 18, 12, 10);
        ctx.fillRect(x + 28, h * 0.65 - bh + 45 + wy * 18, 12, 10);
      }
    }
  }

  // Street vanishing point
  ctx.fillStyle = '#3a3a40';
  ctx.beginPath();
  ctx.moveTo(w * 0.35, h * 0.55);
  ctx.lineTo(w * 0.65, h * 0.55);
  ctx.lineTo(w, h * 0.75);
  ctx.lineTo(0, h * 0.75);
  ctx.closePath();
  ctx.fill();
  // Center line
  ctx.strokeStyle = '#e8c840';
  ctx.lineWidth = 3;
  ctx.setLineDash([15, 12]);
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.55);
  ctx.lineTo(w * 0.5, h * 0.75);
  ctx.stroke();
  ctx.setLineDash([]);

  // Asphalt foreground
  const road = ctx.createLinearGradient(0, h * 0.72, 0, h);
  road.addColorStop(0, '#3a3a42');
  road.addColorStop(1, '#2a2a30');
  ctx.fillStyle = road;
  ctx.fillRect(0, h * 0.72, w, h * 0.28);
}

/** Volcano Interior — lava chamber, glowing cracks, rock walls. */
function paintVolcano(ctx, w, h) {
  paintSky(ctx, w, h, '#1a0808', '#3a1010', '#5a2010');

  // Magma glow from below
  const magma = ctx.createRadialGradient(w * 0.5, h * 0.85, 0, w * 0.5, h * 0.85, 280);
  magma.addColorStop(0, 'rgba(255,120,20,0.7)');
  magma.addColorStop(0.4, 'rgba(200,40,10,0.4)');
  magma.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = magma;
  ctx.fillRect(0, h * 0.3, w, h * 0.7);

  // Cave rock walls
  ctx.fillStyle = '#2a1810';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, h);
  ctx.lineTo(w * 0.2, h);
  ctx.quadraticCurveTo(w * 0.15, h * 0.5, w * 0.25, 0);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w, 0);
  ctx.lineTo(w, h);
  ctx.lineTo(w * 0.8, h);
  ctx.quadraticCurveTo(w * 0.85, h * 0.5, w * 0.75, 0);
  ctx.closePath();
  ctx.fill();

  // Stalactites
  ctx.fillStyle = '#1a1008';
  for (let i = 0; i < 10; i++) {
    const x = (i / 10) * w + 20;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 15, 40 + (i % 3) * 25);
    ctx.lineTo(x + 30, 0);
    ctx.fill();
  }

  // Lava river
  const lava = ctx.createLinearGradient(0, h * 0.7, 0, h);
  lava.addColorStop(0, '#ff6010');
  lava.addColorStop(0.5, '#e02000');
  lava.addColorStop(1, '#801000');
  ctx.fillStyle = lava;
  ctx.beginPath();
  ctx.moveTo(w * 0.25, h * 0.72);
  ctx.quadraticCurveTo(w * 0.5, h * 0.65, w * 0.75, h * 0.72);
  ctx.lineTo(w * 0.85, h);
  ctx.lineTo(w * 0.15, h);
  ctx.closePath();
  ctx.fill();

  // Glow cracks on walls
  ctx.strokeStyle = 'rgba(255,100,20,0.6)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const x = i < 4 ? 30 + i * 30 : w - 30 - (i - 4) * 30;
    ctx.beginPath();
    ctx.moveTo(x, h * 0.3);
    ctx.lineTo(x + (i % 2 === 0 ? 15 : -15), h * 0.5);
    ctx.lineTo(x, h * 0.7);
    ctx.stroke();
  }
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
