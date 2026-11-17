// Solara Bay itself: a road grid, city blocks full of buildings, a park, a beach,
// a marina and a harbour. Generation is seeded, so the city never changes.
// Buildings are solid rectangles; roads are the drivable/walkable grid.

import { WORLD, PALETTE, DISTRICTS } from './config.js';
import { clamp } from './random.js';

export const ROAD_SPACING = 450;
export const ROAD_WIDTH = 110;
export const BEACH_Y = 2250;
export const SEA_Y = 2460;

function roadCenters(size) {
  const centers = [];
  for (let c = 225; c < size; c += ROAD_SPACING) centers.push(c);
  return centers;
}

export function buildCity(random) {
  const vRoads = roadCenters(WORLD.width);
  const hRoads = roadCenters(WORLD.height);
  const buildings = [];
  const parks = [];
  const trees = [];
  const landmarks = [];

  // One park block in the middle of Downtown, and a second near Old Town.
  const parkBlocks = [{ cx: 4, cy: 3 }, { cx: 1, cy: 2 }];
  const parkSet = new Set(parkBlocks.map((p) => `${p.cx},${p.cy}`));

  for (let bx = 0; bx < vRoads.length - 1; bx += 1) {
    for (let by = 0; by < hRoads.length - 1; by += 1) {
      const x0 = vRoads[bx] + ROAD_WIDTH / 2 + 14;
      const x1 = vRoads[bx + 1] - ROAD_WIDTH / 2 - 14;
      const y0 = hRoads[by] + ROAD_WIDTH / 2 + 14;
      const y1 = hRoads[by + 1] - ROAD_WIDTH / 2 - 14;
      if (y0 > BEACH_Y) continue; // beach: no buildings
      if (parkSet.has(`${bx},${by}`)) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        for (let t = 0; t < 14; t += 1) {
          trees.push({ x: random.range(x0 + 20, x1 - 20), y: random.range(y0 + 20, y1 - 20), r: random.range(9, 16) });
        }
        continue;
      }
      // 2-4 buildings per block, with alleys between them.
      const cols = random.int(2, 3);
      const rows = random.int(1, 2);
      const bw = (x1 - x0) / cols;
      const bh = (y1 - y0) / rows;
      for (let cx = 0; cx < cols; cx += 1) {
        for (let cy = 0; cy < rows; cy += 1) {
          if (random.chance(0.12)) continue; // empty lot / plaza
          const w = bw * random.range(0.62, 0.86);
          const h = bh * random.range(0.62, 0.86);
          const x = x0 + cx * bw + (bw - w) / 2;
          const y = y0 + cy * bh + (bh - h) / 2;
          buildings.push({
            x, y, w, h,
            color: random.pick(PALETTE.buildingRoof),
            tall: random.chance(0.22),
            name: random.chance(0.3) ? random.pick(['HOTEL', 'MARKET', 'OFFICES', 'APARTMENTS', 'CAFE', 'GARAGE', 'MALL', 'STUDIO']) : '',
          });
        }
      }
      if (random.chance(0.5)) {
        trees.push({ x: random.range(x0, x1), y: random.range(y0, y1), r: random.range(8, 13) });
      }
    }
  }

  // Landmarks: the Bay Tower (tallest), the stadium, the harbour cranes, the pier.
  landmarks.push({ kind: 'tower', x: 1780, y: 1180, w: 120, h: 120, label: 'BAY TOWER' });
  landmarks.push({ kind: 'stadium', x: 2650, y: 1150, w: 260, h: 180, label: 'SOLARA STADIUM' });
  landmarks.push({ kind: 'cranes', x: 3100, y: 2050, w: 220, h: 120, label: 'HARBOR' });
  landmarks.push({ kind: 'pier', x: 3000, y: 2320, w: 300, h: 60, label: 'PIER' });
  // Landmark buildings are solid too.
  for (const lm of landmarks) buildings.push({ x: lm.x, y: lm.y, w: lm.w, h: lm.h, color: '#7a6a9e', tall: true, name: lm.label });

  return { vRoads, hRoads, buildings, parks, trees, landmarks };
}

/** True when the point is on a road (within the road's width). */
export function onRoad(city, x, y) {
  for (const c of city.vRoads) if (Math.abs(x - c) < ROAD_WIDTH / 2) return true;
  for (const c of city.hRoads) if (Math.abs(y - c) < ROAD_WIDTH / 2) return true;
  return false;
}

/** Nearest road centre line to a point, and whether it is vertical. */
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

/** Push a circle (x, y, r) out of every building it overlaps. Returns true if pushed. */
export function collideBuildings(city, body) {
  let hit = false;
  for (const b of city.buildings) {
    const cx = clamp(body.x, b.x, b.x + b.w);
    const cy = clamp(body.y, b.y, b.y + b.h);
    const dx = body.x - cx;
    const dy = body.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= body.r * body.r) continue;
    hit = true;
    if (d2 > 0.01) {
      const d = Math.sqrt(d2);
      body.x = cx + (dx / d) * body.r;
      body.y = cy + (dy / d) * body.r;
    } else {
      // Centre inside the building: push out along the smallest penetration.
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
  }
  return hit;
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

/** The district a point is in: the nearest district centre. */
export function districtAt(x, y) {
  let best = null;
  let bd = Infinity;
  for (const d of DISTRICTS) {
    const dist = (d.x - x) * (d.x - x) + (d.y - y) * (d.y - y);
    if (dist < bd) { bd = dist; best = d; }
  }
  return best ? best.name : 'Solara Bay';
}
