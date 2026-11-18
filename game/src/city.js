// Solara Bay city generation: six districts, a road grid, blocks of
// buildings, parks, a marina on the west edge and a beach along the south.
// Everything is derived from the seeded RNG passed in, so a fixed seed
// always produces the same city. No clocks, no Math.random here.
import { createRng } from './rng.js';

export const WORLD_WIDTH = 3200;
export const WORLD_HEIGHT = 2400;
export const ROAD_SPACING = 320;
export const ROAD_WIDTH = 56;

export const DISTRICTS = [
  {
    id: 'vista', name: 'Vista Heights',
    x: 0, y: 0, w: 1066, h: 1200,
    ground: '#7fae6a', groundAlt: '#74a35f',
    road: '#4a4a52', building: ['#c9b189', '#b7a06f', '#d8c49a'],
    accent: '#3f7d4e', blurb: 'Leafy hillside homes above the bay.',
  },
  {
    id: 'palm', name: 'Palm Court',
    x: 1066, y: 0, w: 1067, h: 1200,
    ground: '#c8b28a', groundAlt: '#bfa87e',
    road: '#3f3f46', building: ['#8fa8c8', '#c8a06a', '#9a8fc0', '#d8b25e'],
    accent: '#c98f2e', blurb: 'Glass towers, hotels and the neon strip.',
  },
  {
    id: 'foundry', name: 'Foundry Yard',
    x: 2133, y: 0, w: 1067, h: 1200,
    ground: '#9a938a', groundAlt: '#918a80',
    road: '#46464a', building: ['#7d7468', '#8a6f5a', '#6e6a72'],
    accent: '#c25e2e', blurb: 'Warehouses, cranes and container stacks.',
  },
  {
    id: 'harbor', name: 'Harborlight',
    x: 0, y: 1200, w: 1066, h: 1200,
    ground: '#a8b8a0', groundAlt: '#9cae94',
    road: '#45454c', building: ['#7fa3b8', '#b8c8d0', '#d0b090'],
    accent: '#2e7d9e', blurb: 'Fishing boats, docks and salt air.',
  },
  {
    id: 'coral', name: 'Coral Row',
    x: 1066, y: 1200, w: 1067, h: 1200,
    ground: '#e0c896', groundAlt: '#d8bf8a',
    road: '#4a4a50', building: ['#e08a7a', '#f0c060', '#7fc8b8', '#e8a0b8'],
    accent: '#e0705a', blurb: 'Beach bars, surf shops and pastel motels.',
  },
  {
    id: 'bazaar', name: 'Old Bazaar',
    x: 2133, y: 1200, w: 1067, h: 1200,
    ground: '#b8a888', groundAlt: '#ad9d7c',
    road: '#46464c', building: ['#a8805a', '#c8a868', '#8a7a5a', '#b07848'],
    accent: '#a03a2e', blurb: 'Crowded market lanes and spice stalls.',
  },
];

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
  }
  return DISTRICTS[1];
}

export function roadXs() {
  const xs = [];
  for (let x = ROAD_SPACING; x < WORLD_WIDTH; x += ROAD_SPACING) xs.push(x);
  return xs;
}

export function roadYs() {
  const ys = [];
  for (let y = ROAD_SPACING; y < WORLD_HEIGHT; y += ROAD_SPACING) ys.push(y);
  return ys;
}

export function isOnRoad(x, y) {
  const half = ROAD_WIDTH / 2 + 6;
  for (const rx of roadXs()) if (Math.abs(x - rx) < half) return true;
  for (const ry of roadYs()) if (Math.abs(y - ry) < half) return true;
  return false;
}

export function nearestRoadPoint(x, y) {
  let bestX = x;
  let bestD = Infinity;
  for (const rx of roadXs()) {
    const d = Math.abs(x - rx);
    if (d < bestD) { bestD = d; bestX = rx; }
  }
  let bestY = y;
  bestD = Infinity;
  for (const ry of roadYs()) {
    const d = Math.abs(y - ry);
    if (d < bestD) { bestD = d; bestY = ry; }
  }
  return { x: bestX, y: bestY };
}

// True when a point sits inside any building footprint.
export function hitsBuilding(city, x, y, pad) {
  const p = pad || 0;
  for (const b of city.buildings) {
    if (x > b.x - p && x < b.x + b.w + p && y > b.y - p && y < b.y + b.h + p) return b;
  }
  return null;
}

export function buildCity(seed) {
  const rng = createRng(seed);
  const buildings = [];
  const parks = [];
  const trees = [];
  const docks = [];

  // Marina docks along the west water edge.
  for (let i = 0; i < 6; i += 1) {
    docks.push({ x: 60, y: 1330 + i * 170, w: 90, h: 16 });
  }

  // Walk the block grid between roads and fill each block.
  const xs = [0, ...roadXs(), WORLD_WIDTH];
  const ys = [0, ...roadYs(), WORLD_HEIGHT];
  for (let bi = 0; bi < xs.length - 1; bi += 1) {
    for (let bj = 0; bj < ys.length - 1; bj += 1) {
      const bx = xs[bi] + ROAD_WIDTH / 2 + 8;
      const by = ys[bj] + ROAD_WIDTH / 2 + 8;
      const blockW = xs[bi + 1] - xs[bi] - ROAD_WIDTH - 16;
      const blockH = ys[bj + 1] - ys[bj] - ROAD_WIDTH - 16;
      if (blockW < 60 || blockH < 60) continue;
      const cx = bx + blockW / 2;
      const cy = by + blockH / 2;
      const district = districtAt(cx, cy);
      // West water strip and the Coral Row beach stay open.
      if (cx < 180) continue;
      if (district.id === 'coral' && cy > 2260) continue;
      if (rng.chance(0.16)) {
        parks.push({ x: bx, y: by, w: blockW, h: blockH, district: district.id });
        const count = rng.int(4, 8);
        for (let t = 0; t < count; t += 1) {
          trees.push({
            x: rng.range(bx + 16, bx + blockW - 16),
            y: rng.range(by + 16, by + blockH - 16),
            r: rng.range(9, 15),
          });
        }
        continue;
      }
      // Split the block into 1-4 buildings.
      const cols = rng.chance(0.5) ? 2 : 1;
      const rows = rng.chance(0.5) ? 2 : 1;
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          const pad = 10;
          const bw = blockW / cols - pad * 2;
          const bh = blockH / rows - pad * 2;
          if (bw < 34 || bh < 34) continue;
          const tall = district.id === 'palm' && rng.chance(0.45);
          buildings.push({
            x: bx + c * (blockW / cols) + pad,
            y: by + r * (blockH / rows) + pad,
            w: bw, h: bh,
            color: rng.pick(district.building),
            roof: rng.pick(['#5a5a62', '#6a5a4a', '#4a5a6a', '#7a6a5a']),
            tall,
            floors: tall ? rng.int(4, 7) : rng.int(1, 3),
            seed: rng.int(1, 99999),
            district: district.id,
          });
        }
      }
      if (rng.chance(0.6)) {
        trees.push({ x: bx + 8, y: by + 8, r: rng.range(8, 12) });
        trees.push({ x: bx + blockW - 8, y: by + blockH - 8, r: rng.range(8, 12) });
      }
    }
  }

  return {
    seed,
    buildings,
    parks,
    trees,
    docks,
    landmarks: {
      palmPlaza: { x: 1600, y: 640, label: 'Palm Plaza' },
      marina: { x: 320, y: 1760, label: 'Harborlight Marina' },
      beach: { x: 1600, y: 2220, label: 'Coral Beach' },
      foundryGate: { x: 2720, y: 640, label: 'Foundry Gate' },
      bazaar: { x: 2720, y: 1760, label: 'Old Bazaar' },
      vistaHill: { x: 480, y: 480, label: 'Vista Hill' },
      hideout: { x: 480, y: 2080, label: "Rey's Hideout" },
    },
  };
}
