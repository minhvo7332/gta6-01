// Solara Bay itself: a road grid, blocks full of buildings, two parks, a beach,
// a marina and a harbour. Generation is seeded, so the city never changes.
// Buildings are solid rectangles; roads are the drivable grid.

import { WORLD, PALETTE, DISTRICTS } from './config.js';
import { clamp } from './random.js';

export const ROAD_SPACING = 450;
export const ROAD_WIDTH = 110;
export const BEACH_Y = 2250;
export const SEA_Y = 2460;

const PARK_BLOCKS = [{ cx: 4, cy: 3 }, { cx: 1, cy: 2 }];
const LANDMARK_NAMES = ['HOTEL', 'MARKET', 'OFFICES', 'APARTMENTS', 'CAFE', 'GARAGE', 'MALL', 'STUDIO'];

/** Road centre lines: first at 225, then every ROAD_SPACING. */
function centres(size) {
  const list = [];
  for (let c = 225; c < size; c += ROAD_SPACING) list.push(c);
  return list;
}

/** The inner rectangle of one block, inset from the surrounding roads. */
function blockRect(vRoads, hRoads, bx, by) {
  const margin = ROAD_WIDTH / 2 + 14;
  return {
    x0: vRoads[bx] + margin,
    x1: vRoads[bx + 1] - margin,
    y0: hRoads[by] + margin,
    y1: hRoads[by + 1] - margin,
  };
}

function fillBlockWithBuildings(rect, random, buildings) {
  const cols = random.int(2, 3);
  const rows = random.int(1, 2);
  const cellW = (rect.x1 - rect.x0) / cols;
  const cellH = (rect.y1 - rect.y0) / rows;
  for (let cx = 0; cx < cols; cx += 1) {
    for (let cy = 0; cy < rows; cy += 1) {
      if (random.chance(0.12)) continue; // empty lot / plaza
      const w = Math.max(40, cellW * random.range(0.62, 0.86));
      const h = Math.max(40, cellH * random.range(0.62, 0.86));
      const x = rect.x0 + cx * cellW + (cellW - w) / 2;
      const y = rect.y0 + cy * cellH + (cellH - h) / 2;
      buildings.push({
        x, y, w, h,
        color: random.pick(PALETTE.buildingRoof),
        tall: random.chance(0.22),
        name: random.chance(0.3) ? random.pick(LANDMARK_NAMES) : '',
      });
    }
  }
}

function fillBlockWithPark(rect, random, parks, trees) {
  parks.push({ x: rect.x0, y: rect.y0, w: rect.x1 - rect.x0, h: rect.y1 - rect.y0 });
  for (let t = 0; t < 14; t += 1) {
    trees.push({
      x: random.range(rect.x0 + 20, rect.x1 - 20),
      y: random.range(rect.y0 + 20, rect.y1 - 20),
      r: random.range(9, 16),
    });
  }
}

export function buildCity(random) {
  const vRoads = centres(WORLD.width);
  const hRoads = centres(WORLD.height);
  const buildings = [];
  const parks = [];
  const trees = [];
  const parkKeys = new Set(PARK_BLOCKS.map((p) => `${p.cx},${p.cy}`));

  for (let bx = 0; bx < vRoads.length - 1; bx += 1) {
    for (let by = 0; by < hRoads.length - 1; by += 1) {
      const rect = blockRect(vRoads, hRoads, bx, by);
      if (rect.y0 > BEACH_Y) continue; // the beach has no buildings
      if (parkKeys.has(`${bx},${by}`)) {
        fillBlockWithPark(rect, random, parks, trees);
        continue;
      }
      fillBlockWithBuildings(rect, random, buildings);
      if (random.chance(0.5)) {
        trees.push({ x: random.range(rect.x0, rect.x1), y: random.range(rect.y0, rect.y1), r: random.range(8, 13) });
      }
    }
  }

  // Landmarks: Bay Tower, stadium, harbour cranes, pier. Solid like the rest.
  const landmarks = [
    { kind: 'tower', x: 1780, y: 1180, w: 120, h: 120, label: 'BAY TOWER' },
    { kind: 'stadium', x: 2650, y: 1150, w: 260, h: 180, label: 'SOLARA STADIUM' },
    { kind: 'cranes', x: 3100, y: 2050, w: 220, h: 120, label: 'HARBOR' },
    { kind: 'pier', x: 3000, y: 2320, w: 300, h: 60, label: 'PIER' },
  ];
  for (const lm of landmarks) {
    buildings.push({ x: lm.x, y: lm.y, w: lm.w, h: lm.h, color: '#7a6a9e', tall: true, name: lm.label });
  }

  return { vRoads, hRoads, buildings, parks, trees, landmarks };
}

/** True when (x, y) sits on a road, within the road's width. */
export function onRoad(city, x, y) {
  for (const c of city.vRoads) {
    if (Math.abs(x - c) < ROAD_WIDTH / 2) return true;
  }
  for (const c of city.hRoads) {
    if (Math.abs(y - c) < ROAD_WIDTH / 2) return true;
  }
  return false;
}

/** The road centre line nearest a point, and whether it runs vertically. */
export function nearestRoad(city, x, y) {
  let best = { axis: 'v', center: city.vRoads[0], dist: Infinity };
  for (const c of city.vRoads) {
    const d = Math.abs(x - c);
    if (d < best.dist) best = { axis: 'v', center: c, dist: d };
  }
  for (const c of city.hRoads) {
    const d = Math.abs(y - c);
    if (d < best.dist) best = { axis: 'h', center: c, dist: d };
  }
  return best;
}

/**
 * Push a circle {x, y, r} out of every building it overlaps, in place.
 * Returns true when it was pushed at all.
 */
export function collideBuildings(city, body) {
  let pushed = false;
  for (const b of city.buildings) {
    const cx = clamp(body.x, b.x, b.x + b.w);
    const cy = clamp(body.y, b.y, b.y + b.h);
    const dx = body.x - cx;
    const dy = body.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= body.r * body.r) continue;
    pushed = true;
    if (d2 > 0.01) {
      const d = Math.sqrt(d2);
      body.x = cx + (dx / d) * body.r;
      body.y = cy + (dy / d) * body.r;
      continue;
    }
    // Centre inside the building: leave along the smallest penetration.
    const left = body.x - b.x;
    const right = b.x + b.w - body.x;
    const top = body.y - b.y;
    const bottom = b.y + b.h - body.y;
    const m = Math.min(left, right, top, bottom);
    if (m === left) body.x = b.x - body.r;
    else if (m === right) body.x = b.x + b.w + body.r;
    else if (m === top) body.y = b.y - body.r;
    else body.y = b.y + b.h + body.r;
  }
  return pushed;
}

/** A random point on a road, for spawning traffic and pedestrians. */
export function randomRoadPoint(city, random) {
  if (random.chance(0.5)) {
    const c = random.pick(city.vRoads);
    return { x: c + random.range(-30, 30), y: random.range(60, WORLD.height - 60), axis: 'v' };
  }
  const c = random.pick(city.hRoads);
  return { x: random.range(60, WORLD.width - 60), y: c + random.range(-30, 30), axis: 'h' };
}

/** A point on a road near (x, y), for spawning police. */
export function roadPointNear(city, random, x, y) {
  const road = nearestRoad(city, x, y);
  const offset = random.range(300, 520) * (random.chance(0.5) ? 1 : -1);
  if (road.axis === 'v') {
    return { x: road.center + random.range(-25, 25), y: clamp(y + offset, 60, WORLD.height - 60) };
  }
  return { x: clamp(x + offset, 60, WORLD.width - 60), y: road.center + random.range(-25, 25) };
}

/** The district a point is in: the nearest district centre wins. */
export function districtAt(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const d of DISTRICTS) {
    const dist = (d.x - x) * (d.x - x) + (d.y - y) * (d.y - y);
    if (dist < bestD) {
      bestD = dist;
      best = d;
    }
  }
  return best ? best.name : 'Solara Bay';
}
