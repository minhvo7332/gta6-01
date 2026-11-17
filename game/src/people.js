// Pedestrians: they stroll the sidewalks, cross at intersections, and run away
// from gunfire, speeding cars and police chases. A few are gang members during
// the Harbor Heist — they shoot back.

import { WORLD } from './config.js';
import { clamp, distance } from './random.js';
import { collideBuildings, randomRoadPoint } from './city.js';

const SHIRTS = ['#e8b23c', '#c94a4a', '#4a7fb5', '#7fae5a', '#e8e4da', '#d2691e', '#3fa8a0', '#8a6f9e'];

export function makePed(random, city, gang = false) {
  const p = randomRoadPoint(city, random);
  return {
    x: p.x + random.range(-70, 70),
    y: p.y + random.range(-70, 70),
    angle: random.range(0, Math.PI * 2),
    speed: random.range(28, 55),
    shirt: random.pick(SHIRTS),
    skin: random.pick(['#e8b88a', '#c98a5a', '#8a5a3c', '#f0c8a0']),
    gang,
    health: gang ? 60 : 100,
    flee: 0,
    targetX: p.x,
    targetY: p.y,
    retarget: 0,
    shootTimer: random.range(0.5, 1.5),
    dead: false,
  };
}

export function spawnPeds(city, random, count) {
  const peds = [];
  for (let i = 0; i < count; i += 1) peds.push(makePed(random, city, false));
  return peds;
}

/** Pick a new strolling destination on a nearby road. */
function retarget(ped, city, random) {
  const p = randomRoadPoint(city, random);
  ped.targetX = clamp(ped.x + random.range(-500, 500), 60, WORLD.width - 60);
  ped.targetY = clamp(ped.y + random.range(-500, 500), 60, WORLD.height - 60);
  void p;
  ped.retarget = random.range(4, 10);
}

export function stepPeds(peds, city, player, dt, random) {
  for (const ped of peds) {
    if (ped.dead) continue;
    if (ped.flee > 0) ped.flee -= dt;
    ped.retarget -= dt;
    // Flee from the player when the player is dangerous or very close in a car.
    const dPlayer = distance(ped.x, ped.y, player.x, player.y);
    if (player.danger > 0 && dPlayer < 320) ped.flee = 1.5;
    // Flee from any fast car, not just the player's.
    if (ped.flee <= 0 && player.nearCarSpeed > 200) {
      const dc = distance(ped.x, ped.y, player.nearCarX, player.nearCarY);
      if (dc < 200) ped.flee = 1.2;
    }
    let tx = ped.targetX;
    let ty = ped.targetY;
    if (ped.flee > 0) {
      tx = ped.x + (ped.x - player.x);
      ty = ped.y + (ped.y - player.y);
    } else if (ped.retarget <= 0) {
      retarget(ped, city, random);
      tx = ped.targetX;
      ty = ped.targetY;
    }
    const dx = tx - ped.x;
    const dy = ty - ped.y;
    const d = Math.hypot(dx, dy);
    if (d > 8) {
      const want = Math.atan2(dy, dx);
      ped.angle += clamp(((want - ped.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI, -3 * dt, 3 * dt);
      const speed = ped.speed * (ped.flee > 0 ? 2.4 : 1);
      ped.x += Math.cos(ped.angle) * speed * dt;
      ped.y += Math.sin(ped.angle) * speed * dt;
    }
    ped.x = clamp(ped.x, 30, WORLD.width - 30);
    ped.y = clamp(ped.y, 30, WORLD.height - 30);
    const body = { x: ped.x, y: ped.y, r: 12 };
    if (collideBuildings(city, body)) { ped.x = body.x; ped.y = body.y; retarget(ped, city, random); }
  }
}
