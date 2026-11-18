// Azura Bay's map: a seeded grid city with five districts, a beach and a
// harbour. Everything is generated from the seed, so the same seed builds
// the same streets, blocks and buildings every run.
import { makeRng, pick, range, rangeInt, clamp } from './rng.js';

export const TILE = 48;
export const GRID = 72;                 // tiles per side
export const WORLD = TILE * GRID;        // 3456 px per side
export const ROAD_EVERY = 6;             // a road band every 6 tiles
export const ROAD_W = 2;                 // road band width in tiles

// District ids, by region of the map.
export const DISTRICTS = {
  ironworks: { name: 'Ironworks', ground: '#6f6a5e', block: '#8a8474' },
  palmCourt: { name: 'Palm Court', ground: '#7fae6a', block: '#a8c98f' },
  neonMile: { name: 'Neon Mile', ground: '#5d5a78', block: '#7d7a9e' },
  harbor: { name: 'Harbor Lights', ground: '#5e6f7a', block: '#7d95a3' },
  coralKeys: { name: 'Coral Keys', ground: '#c9b078', block: '#e0c892' },
};

const PALETTES = {
  ironworks: ['#7a756a', '#6b6558', '#8d8678', '#5f5a4e'],
  palmCourt: ['#d8b48a', '#c9a06f', '#e3c39a', '#b98f66'],
  neonMile: ['#4a6fa5', '#7a4a8a', '#c25a6e', '#3f8a7a', '#8a6a3f'],
  harbor: ['#5a7a8a', '#4a6a7a', '#6a8a9a', '#3f5a6a'],
  coralKeys: ['#e8d8a8', '#f0e0b8', '#d8c088', '#e8c8a0'],
};

export function districtAt(x, y) {
  const fx = x / WORLD, fy = y / WORLD;
  if (fy > 0.86) return 'coralKeys';            // beach strip along the south
  if (fx < 0.22 && fy > 0.45) return 'harbor';  // docks, south-west
  if (fx < 0.5 && fy < 0.45) return 'ironworks';// factories, north-west
  if (fx >= 0.5 && fy < 0.45) return 'palmCourt';// houses, north-east
  return 'neonMile';                            // downtown, centre-south
}

export function districtNameAt(x, y) {
  return DISTRICTS[districtAt(x, y)].name;
}

function isRoadTile(tx, ty) {
  return (tx % ROAD_EVERY) < ROAD_W || (ty % ROAD_EVERY) < ROAD_W;
}

// Centre line (world px) of the nearest vertical / horizontal road.
export function roadCenterX(tx) {
  const band = Math.floor(tx / ROAD_EVERY);
  return (band * ROAD_EVERY + 1) * TILE + TILE / 2;
}
export function roadCenterY(ty) {
  const band = Math.floor(ty / ROAD_EVERY);
  return (band * ROAD_EVERY + 1) * TILE + TILE / 2;
}
export function nearestRoadCenterX(x) { return roadCenterX(Math.floor(x / TILE)); }
export function nearestRoadCenterY(y) { return roadCenterY(Math.floor(y / TILE)); }

export function isWater(x, y) {
  return y > WORLD * 0.94 || x < TILE * 0.5;
}

export function isSand(x, y) {
  return y > WORLD * 0.86 && y <= WORLD * 0.94;
}

export function buildCity(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const byBlock = new Map();
  // One block = the tiles between two road bands.
  for (let bx = 0; bx < GRID / ROAD_EVERY; bx++) {
    for (let by = 0; by < GRID / ROAD_EVERY; by++) {
      const x0 = (bx * ROAD_EVERY + ROAD_W) * TILE;
      const y0 = (by * ROAD_EVERY + ROAD_W) * TILE;
      const w = (ROAD_EVERY - ROAD_W) * TILE;
      const cx = x0 + w / 2, cy = y0 + w / 2;
      const district = districtAt(cx, cy);
      if (isSand(cx, cy) || isWater(cx, cy)) continue;
      // A park every so often instead of buildings.
      if (rng() < 0.08) {
        buildings.push({ kind: 'park', x: x0, y: y0, w, h: w, district, trees: rangeInt(rng, 4, 9) });
        continue;
      }
      const n = district === 'neonMile' ? rangeInt(rng, 1, 2) : rangeInt(rng, 1, 4);
      for (let i = 0; i < n; i++) {
        const bw = range(rng, w * 0.28, w * 0.48);
        const bh = range(rng, w * 0.28, w * 0.48);
        const bx0 = x0 + range(rng, 4, Math.max(5, w - bw - 4));
        const by0 = y0 + range(rng, 4, Math.max(5, w - bh - 4));
        const tall = district === 'neonMile' ? rangeInt(rng, 2, 5) : rangeInt(rng, 1, 2);
        const b = {
          kind: 'building', x: bx0, y: by0, w: bw, h: bh,
          color: pick(rng, PALETTES[district]), district, tall,
          roof: pick(rng, ['#3a3f4a', '#4a3f3a', '#2f3a3f', '#5a4a3a']),
        };
        buildings.push(b);
        const key = `${bx},${by}`;
        if (!byBlock.has(key)) byBlock.set(key, []);
        byBlock.get(key).push(b);
      }
    }
  }
  // Landmark spots the missions and services use (world coords).
  const spots = {
    plaza: { x: WORLD * 0.5, y: WORLD * 0.52, label: 'Marisol Plaza' },
    docks: { x: WORLD * 0.1, y: WORLD * 0.72, label: 'Harbor Docks' },
    bank: { x: WORLD * 0.58, y: WORLD * 0.6, label: 'Azura National Bank' },
    garage: { x: WORLD * 0.34, y: WORLD * 0.36, label: "Vega's Garage" },
    clinic: { x: WORLD * 0.66, y: WORLD * 0.3, label: 'Palm Court Clinic' },
    gunstore: { x: WORLD * 0.44, y: WORLD * 0.66, label: 'Iron & Lead' },
    ironworks: { x: WORLD * 0.24, y: WORLD * 0.2, label: 'Ironworks Yard' },
    boat: { x: WORLD * 0.78, y: WORLD * 0.9, label: 'Escape Boat' },
    neonMile: { x: WORLD * 0.56, y: WORLD * 0.55, label: 'Neon Mile' },
  };
  return { buildings, byBlock, spots, seed };
}

// True when a point is inside a building (with a small margin).
export function solidAt(city, x, y) {
  if (x < TILE || y < TILE || x > WORLD - TILE || y > WORLD - TILE) return true;
  if (isWater(x, y)) return true;
  const bx = Math.floor(Math.floor(x / TILE) / ROAD_EVERY);
  const by = Math.floor(Math.floor(y / TILE) / ROAD_EVERY);
  const list = city.byBlock.get(`${bx},${by}`);
  if (!list) return false;
  for (const b of list) {
    if (b.kind !== 'building') continue;
    if (x > b.x - 2 && x < b.x + b.w + 2 && y > b.y - 2 && y < b.y + b.h + 2) return true;
  }
  return false;
}

// Slide a circle (radius r) out of buildings: returns corrected [x, y].
export function collideCircle(city, x, y, r) {
  const bx = Math.floor(Math.floor(x / TILE) / ROAD_EVERY);
  const by = Math.floor(Math.floor(y / TILE) / ROAD_EVERY);
  for (let gx = bx - 1; gx <= bx + 1; gx++) {
    for (let gy = by - 1; gy <= by + 1; gy++) {
      const list = city.byBlock.get(`${gx},${gy}`);
      if (!list) continue;
      for (const b of list) {
        if (b.kind !== 'building') continue;
        const nx = clamp(x, b.x, b.x + b.w);
        const ny = clamp(y, b.y, b.y + b.h);
        const dx = x - nx, dy = y - ny;
        const d2 = dx * dx + dy * dy;
        if (d2 < r * r && d2 > 0.01) {
          const d = Math.sqrt(d2);
          x = nx + (dx / d) * r;
          y = ny + (dy / d) * r;
        } else if (d2 <= 0.01) {
          // Inside the rect: push out along the smallest penetration axis.
          const pl = x - b.x, pr = b.x + b.w - x, pt = y - b.y, pb = b.y + b.h - y;
          const m = Math.min(pl, pr, pt, pb);
          if (m === pl) x = b.x - r;
          else if (m === pr) x = b.x + b.w + r;
          else if (m === pt) y = b.y - r;
          else y = b.y + b.h + r;
        }
      }
    }
  }
  if (isWater(x, y)) { // keep out of the sea
    if (y > WORLD * 0.94) y = WORLD * 0.94 - r;
    if (x < TILE * 0.5) x = TILE * 0.5 + r;
  }
  return [clamp(x, TILE, WORLD - TILE), clamp(y, TILE, WORLD - TILE)];
}

export function drawCity(ctx, city, cam) {
  const x0 = Math.max(0, Math.floor(cam.x / TILE));
  const y0 = Math.max(0, Math.floor(cam.y / TILE));
  const x1 = Math.min(GRID - 1, Math.ceil((cam.x + cam.w) / TILE));
  const y1 = Math.min(GRID - 1, Math.ceil((cam.y + cam.h) / TILE));
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const px = tx * TILE, py = ty * TILE;
      const wx = px + TILE / 2, wy = py + TILE / 2;
      let fill;
      if (isWater(wx, wy)) fill = '#1d5f8a';
      else if (isSand(wx, wy)) fill = '#e0c892';
      else if (isRoadTile(tx, ty)) fill = '#33363d';
      else fill = DISTRICTS[districtAt(wx, wy)].ground;
      ctx.fillStyle = fill;
      ctx.fillRect(px, py, TILE, TILE);
      if (isRoadTile(tx, ty)) {
        // Dashed centre line on road bands.
        ctx.fillStyle = '#c9b458';
        if ((tx % ROAD_EVERY) === 1 && (ty % ROAD_EVERY) >= ROAD_W) {
          if ((ty % 2) === 0) ctx.fillRect(px + TILE / 2 - 2, py, 4, TILE);
        }
        if ((ty % ROAD_EVERY) === 1 && (tx % ROAD_EVERY) >= ROAD_W) {
          if ((tx % 2) === 0) ctx.fillRect(px, py + TILE / 2 - 2, TILE, 4);
        }
      }
    }
  }
  // Buildings and parks in view.
  for (const b of city.buildings) {
    if (b.x + b.w < cam.x || b.x > cam.x + cam.w || b.y + b.h < cam.y || b.y > cam.y + cam.h) continue;
    if (b.kind === 'park') {
      ctx.fillStyle = '#4a8a4a';
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = '#2f6b2f';
      const rng = makeRng(b.x + b.y);
      for (let i = 0; i < b.trees; i++) {
        const tx = b.x + 14 + rng() * (b.w - 28);
        const ty = b.y + 14 + rng() * (b.h - 28);
        ctx.beginPath(); ctx.arc(tx, ty, 9, 0, Math.PI * 2); ctx.fill();
      }
      continue;
    }
    // Fake height: offset shadow stack by storeys.
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(b.x + 5, b.y + 5 + b.tall * 2, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    const cols = Math.max(1, Math.floor(b.w / 22));
    const rows = Math.max(1, Math.floor(b.h / 22));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        if ((i * 7 + j * 3 + b.tall) % 3 === 0) {
          ctx.fillRect(b.x + 8 + i * 22, b.y + 8 + j * 22, 8, 10);
        }
      }
    }
  }
  // The sea shimmer and the beach umbrellas.
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  const t = Date.now() * 0.0004;
  for (let i = 0; i < 6; i++) {
    const wy = WORLD * 0.95 + i * 14;
    if (wy < cam.y || wy > cam.y + cam.h) continue;
    ctx.fillRect(cam.x + ((t * 60 + i * 260) % (cam.w + 200)) - 100, wy, 120, 3);
  }
}
