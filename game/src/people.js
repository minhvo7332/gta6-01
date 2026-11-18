// Pedestrians and police for Solara Bay.
// Pedestrians stroll the sidewalks, panic and run when shots are fired or
// someone is hit nearby. Police appear when the wanted level rises: foot
// officers chase on foot, patrol cars chase by road and ram the player.
import { createRng } from './rng.js';
import { WORLD_WIDTH, WORLD_HEIGHT, isOnRoad, nearestRoadPoint, roadXs, roadYs } from './city.js';
import { damagePlayer, setWanted } from './player.js';

const PED_COUNT = 26;
const PED_COLORS = ['#e8b88a', '#c98a6a', '#8a6a4a', '#f0d0a8', '#a87a5a'];
const SHIRTS = ['#d84a4a', '#4a7ad8', '#3aa86a', '#e8c832', '#8a5ac8', '#38b8b0', '#e88030', '#f0f0f0'];

export function makePedestrian(rng, x, y) {
  return {
    kind: 'ped',
    x, y,
    angle: rng.range(0, Math.PI * 2),
    speed: rng.range(28, 55),
    color: rng.pick(PED_COLORS),
    shirt: rng.pick(SHIRTS),
    wander: rng.range(2, 6),
    panic: 0,
    down: false,
    downTimer: 0,
  };
}

export function makeOfficer(x, y) {
  return {
    kind: 'officer',
    x, y,
    angle: 0,
    speed: 175,
    color: '#e8b88a',
    shirt: '#2a4a8a',
    wander: 0,
    panic: 0,
    down: false,
    downTimer: 0,
    attackCooldown: 0,
    lost: 0, // seconds the player has been out of this officer's sight
  };
}

export function makePoliceCar(x, y, angle) {
  return {
    x, y, angle,
    speed: 0,
    color: '#20242e',
    name: 'Interceptor',
    traffic: false,
    parked: false,
    police: true,
    vertical: false,
    targetSpeed: 330,
    w: 46, h: 22,
    brakeLight: false,
    siren: true,
    lost: 0, // seconds the player has been out of this car's sight
    ramCooldown: 0, // seconds until this car may ram again
  };
}

export function createPeople(city, rng) {
  const peds = [];
  let guard = 0;
  while (peds.length < PED_COUNT && guard < 600) {
    guard += 1;
    const x = rng.range(200, WORLD_WIDTH - 200);
    const y = rng.range(200, WORLD_HEIGHT - 200);
    if (isOnRoad(x, y)) continue;
    peds.push(makePedestrian(rng, x, y));
  }
  return {
    peds,
    officers: [],
    policeCars: [],
    spawnTimer: 0,
  };
}

export function panicNearby(people, x, y, radius) {
  for (const p of people.peds) {
    if (p.down) continue;
    if (Math.hypot(p.x - x, p.y - y) < radius) p.panic = 3;
  }
}

export function updatePedestrians(people, city, rng, dt) {
  for (const p of people.peds) {
    if (p.down) {
      p.downTimer -= dt;
      if (p.downTimer <= 0) { p.down = false; p.panic = 2; }
      continue;
    }
    p.wander -= dt;
    if (p.wander <= 0) {
      p.wander = rng.range(2, 6);
      p.angle = rng.range(0, Math.PI * 2);
    }
    const speed = p.panic > 0 ? 150 : p.speed;
    if (p.panic > 0) p.panic -= dt;
    const nx = p.x + Math.cos(p.angle) * speed * dt;
    const ny = p.y + Math.sin(p.angle) * speed * dt;
    if (nx < 170 || ny < 40 || nx > WORLD_WIDTH - 40 || ny > WORLD_HEIGHT - 40) {
      p.angle += Math.PI;
      continue;
    }
    // Pedestrians avoid the road centre and building walls.
    if (isOnRoad(nx, ny) && p.panic <= 0) {
      p.angle += Math.PI / 2;
      continue;
    }
    p.x = nx;
    p.y = ny;
  }
}

// How many police units the wanted level calls for.
export function wantedPoliceCount(wanted) {
  if (wanted <= 0) return { officers: 0, cars: 0 };
  if (wanted === 1) return { officers: 1, cars: 0 };
  if (wanted === 2) return { officers: 2, cars: 1 };
  if (wanted === 3) return { officers: 2, cars: 2 };
  if (wanted === 4) return { officers: 3, cars: 3 };
  return { officers: 4, cars: 4 };
}

export function updatePolice(people, player, rng, dt, sound) {
  const want = wantedPoliceCount(player.wanted);
  people.spawnTimer -= dt;
  const px = player.onFoot ? player.x : player.car.x;
  const py = player.onFoot ? player.y : player.car.y;

  // Spawn reinforcements away from the player, on a road, so the player
  // can break away and hide: wanted only decays out of police sight.
  if (people.spawnTimer <= 0) {
    people.spawnTimer = 1.2;
    const spawnAngle = rng.range(0, Math.PI * 2);
    const spawnDist = rng.range(560, 900);
    const sx = px + Math.cos(spawnAngle) * spawnDist;
    const sy = py + Math.sin(spawnAngle) * spawnDist;
    if (people.officers.length < want.officers) {
      const spot = nearestRoadPoint(sx, sy);
      people.officers.push(makeOfficer(spot.x, spot.y));
    } else if (people.policeCars.length < want.cars) {
      const rxs = roadXs();
      const rys = roadYs();
      const vertical = rng.chance(0.5);
      const cx = vertical ? rxs.reduce((a, b) => (Math.abs(b - sx) < Math.abs(a - sx) ? b : a), rxs[0]) : sx;
      const cy = vertical ? sy : rys.reduce((a, b) => (Math.abs(b - sy) < Math.abs(a - sy) ? b : a), rys[0]);
      people.policeCars.push(makePoliceCar(cx, cy, vertical ? Math.PI / 2 : 0));
    }
  }

  // Foot officers run at the player and hit them up close. They lose the
  // trail if the player stays out of sight, then wander and give up.
  for (const o of people.officers) {
    if (o.down) {
      o.downTimer -= dt;
      if (o.downTimer <= 0) o.down = false;
      continue;
    }
    const dx = px - o.x;
    const dy = py - o.y;
    const d = Math.hypot(dx, dy);
    if (d > 520) o.lost += dt;
    else o.lost = 0;
    if (o.lost > 5) {
      // Lost the trail: wander in place instead of homing in forever.
      o.wander -= dt;
      if (o.wander <= 0) {
        o.wander = rng.range(1, 3);
        o.angle = rng.range(0, Math.PI * 2);
      }
      o.x += Math.cos(o.angle) * 40 * dt;
      o.y += Math.sin(o.angle) * 40 * dt;
      continue;
    }
    o.angle = Math.atan2(dy, dx);
    if (d > 26) {
      o.x += Math.cos(o.angle) * o.speed * dt;
      o.y += Math.sin(o.angle) * o.speed * dt;
    } else if (player.onFoot) {
      o.attackCooldown -= dt;
      if (o.attackCooldown <= 0) {
        o.attackCooldown = 0.9;
        damagePlayer(player, 6);
      }
    }
  }
  people.officers = people.officers.filter((o) => !o.down || o.downTimer > -20);

  // Patrol cars steer toward the player and ram. A car that cannot see
  // the player for a while gives up and leaves the chase.
  for (const car of people.policeCars) {
    const dx = px - car.x;
    const dy = py - car.y;
    const d = Math.hypot(dx, dy);
    if (d > 620) car.lost += dt;
    else car.lost = 0;
    if (car.ramCooldown > 0) car.ramCooldown -= dt;
    const target = Math.atan2(dy, dx);
    let diff = target - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += Math.max(-2.6 * dt, Math.min(2.6 * dt, diff));
    const wantSpeed = Math.min(car.targetSpeed + player.wanted * 22, 520);
    car.speed += (wantSpeed - car.speed) * Math.min(1, dt * 1.2);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // A ram lands at most once a second, then the patrol car backs off
    // and has to close in again instead of pinning the player forever.
    if (d < 40 && car.ramCooldown <= 0) {
      car.ramCooldown = 1.0;
      car.x -= Math.cos(car.angle) * 34;
      car.y -= Math.sin(car.angle) * 34;
      if (player.onFoot) {
        damagePlayer(player, 14);
        // Knock the player away from the bumper.
        player.x += Math.cos(car.angle) * 26;
        player.y += Math.sin(car.angle) * 26;
      } else {
        player.car.speed *= 0.45;
        if (sound) sound.playCrash();
      }
      car.speed *= 0.35;
    }
  }

  // Wanted falls away: when the level drops, excess units give up.
  // Units that lost the trail entirely drive off as well.
  people.policeCars = people.policeCars.filter((c) => c.lost < 8);
  if (people.officers.length > want.officers) {
    people.officers.length = want.officers;
  }
  if (people.policeCars.length > want.cars) {
    people.policeCars.length = want.cars;
  }
}

export function policeNearPlayer(people, player, radius) {
  const px = player.onFoot ? player.x : player.car.x;
  const py = player.onFoot ? player.y : player.car.y;
  for (const o of people.officers) {
    if (!o.down && o.lost < 5 && Math.hypot(o.x - px, o.y - py) < radius) return true;
  }
  for (const c of people.policeCars) {
    if (c.lost < 6 && Math.hypot(c.x - px, c.y - py) < radius) return true;
  }
  return false;
}

export function knockDown(person) {
  person.down = true;
  person.downTimer = 6;
}

export { setWanted };
