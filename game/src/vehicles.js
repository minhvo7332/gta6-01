// Vehicles: traffic cars that drive the road grid, parked cars to steal,
// and the driving model for the player's car. Cars are plain data;
// render.js draws them as rounded bodies with cabins and headlights.
import { createRng } from './rng.js';
import { roadXs, roadYs, ROAD_WIDTH, WORLD_WIDTH, WORLD_HEIGHT, hitsBuilding } from './city.js';
import { collideWorld } from './player.js';

export const CAR_COLORS = ['#d84a4a', '#4a7ad8', '#e8c832', '#3aa86a', '#c8c8d0', '#8a5ac8', '#e88030', '#38b8b0'];
export const CAR_NAMES = ['Comet', 'Sunrunner', 'Bayliner', 'Prowler', 'Dune GT', 'Harbor Cab', 'Streetfox', 'Marina'];
const TRAFFIC_COUNT = 10;
const PARKED_COUNT = 12;

export function makeCar(rng, x, y, angle, opts) {
  const o = opts || {};
  return {
    x, y, angle,
    speed: 0,
    color: o.color || rng.pick(CAR_COLORS),
    name: o.name || rng.pick(CAR_NAMES),
    traffic: !!o.traffic,
    parked: !!o.parked,
    police: !!o.police,
    vertical: !!o.vertical,
    targetSpeed: o.targetSpeed || rng.range(90, 150),
    w: 46, h: 22,
    brakeLight: false,
  };
}

export function createVehicles(city, rng) {
  const traffic = [];
  const parked = [];
  const rxs = roadXs();
  const rys = roadYs();
  for (let i = 0; i < TRAFFIC_COUNT; i += 1) {
    const vertical = rng.chance(0.5);
    const car = vertical
      ? makeCar(rng, rng.pick(rxs) + (rng.chance(0.5) ? 13 : -13), rng.range(200, WORLD_HEIGHT - 200), rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2, { traffic: true, vertical: true })
      : makeCar(rng, rng.range(200, WORLD_WIDTH - 200), rng.pick(rys) + (rng.chance(0.5) ? 13 : -13), rng.chance(0.5) ? 0 : Math.PI, { traffic: true, vertical: false });
    car.speed = car.targetSpeed;
    traffic.push(car);
  }
  // Parked cars sit along road edges, clear of intersections.
  let guard = 0;
  while (parked.length < PARKED_COUNT && guard < 300) {
    guard += 1;
    const vertical = rng.chance(0.5);
    const x = vertical ? rng.pick(rxs) + 34 : rng.range(300, WORLD_WIDTH - 300);
    const y = vertical ? rng.range(300, WORLD_HEIGHT - 300) : rng.pick(rys) + 34;
    if (Math.abs(x % 320) < 60 && Math.abs(y % 320) < 60) continue;
    if (hitsBuilding(city, x, y, 30)) continue;
    parked.push(makeCar(rng, x, y, vertical ? Math.PI / 2 : 0, { parked: true }));
  }
  return { traffic, parked };
}

// Traffic follows its road to the edge, then turns onto a cross street.
export function updateTraffic(vehicles, rng, dt) {
  const all = vehicles.traffic;
  for (const car of all) {
    const ahead = car.vertical
      ? (car.angle > 0 ? car.y + 90 : car.y - 90)
      : (car.angle === 0 ? car.x + 90 : car.x - 90);
    let blocked = false;
    for (const other of all) {
      if (other === car) continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const along = car.vertical ? dy * Math.sin(car.angle) : dx * Math.cos(car.angle);
      const side = car.vertical ? Math.abs(dx) : Math.abs(dy);
      if (along > 0 && along < 70 && side < 30) { blocked = true; break; }
    }
    const want = blocked ? 0 : car.targetSpeed;
    car.speed += (want - car.speed) * Math.min(1, dt * 1.4);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    const edge = 120;
    const pastEdge = car.vertical
      ? (car.angle > 0 ? car.y > WORLD_HEIGHT - edge : car.y < edge)
      : (car.angle === 0 ? car.x > WORLD_WIDTH - edge : car.x < edge);
    if (pastEdge || ahead < 0 || ahead > 2400) {
      // Turn onto the nearest cross road.
      const rxs = roadXs();
      const rys = roadYs();
      if (car.vertical) {
        const ny = rys.reduce((a, b) => (Math.abs(b - car.y) < Math.abs(a - car.y) ? b : a), rys[0]);
        car.y = ny + (rng.chance(0.5) ? 13 : -13);
        car.angle = rng.chance(0.5) ? 0 : Math.PI;
        car.vertical = false;
      } else {
        const nx = rxs.reduce((a, b) => (Math.abs(b - car.x) < Math.abs(a - car.x) ? b : a), rxs[0]);
        car.x = nx + (rng.chance(0.5) ? 13 : -13);
        car.angle = rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
        car.vertical = true;
      }
      car.speed = car.targetSpeed;
    }
    void ROAD_WIDTH;
  }
}

// Arcade driving: accelerate, brake/reverse, steer harder at low speed.
export function driveCar(car, city, input, dt, sound) {
  const axis = input.moveAxis();
  const accel = 340;
  const maxSpeed = 460;
  const maxReverse = 140;
  if (axis.y < 0) car.speed += accel * dt;
  else if (axis.y > 0) car.speed -= accel * 0.9 * dt;
  else car.speed -= car.speed * 0.9 * dt;
  if (car.speed > maxSpeed) car.speed = maxSpeed;
  if (car.speed < -maxReverse) car.speed = -maxReverse;
  const steer = axis.x * (car.speed >= 0 ? 1 : -1);
  const turnRate = 2.1 * Math.min(1, Math.abs(car.speed) / 120 + 0.25);
  car.angle += steer * turnRate * dt * (car.speed >= 0 ? 1 : 1);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  // Cars stop at buildings and world edges instead of passing through.
  const b = hitsBuilding(city, nx, ny, 24);
  if (b || nx < 30 || ny < 30 || nx > WORLD_WIDTH - 30 || ny > WORLD_HEIGHT - 30) {
    if (Math.abs(car.speed) > 160 && sound) sound.playCrash();
    car.speed *= -0.25;
  } else {
    car.x = nx;
    car.y = ny;
  }
  if (sound) sound.setEngineSpeed(Math.abs(car.speed) / maxSpeed);
  return Math.abs(car.speed);
}

export function nearestParkedCar(vehicles, x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of vehicles.parked) {
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

export function nearestTrafficCar(vehicles, x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of vehicles.traffic) {
    if (Math.abs(car.speed) > 40) continue; // only slow traffic can be jacked
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

export function enterCar(player, car, vehicles) {
  const idx = vehicles.parked.indexOf(car);
  if (idx !== -1) vehicles.parked.splice(idx, 1);
  const tidx = vehicles.traffic.indexOf(car);
  if (tidx !== -1) vehicles.traffic.splice(tidx, 1);
  car.parked = false;
  car.traffic = false;
  player.car = car;
  player.onFoot = false;
  player.x = car.x;
  player.y = car.y;
}

export function exitCar(player, vehicles, city) {
  const car = player.car;
  if (!car) return;
  car.speed = 0;
  car.parked = true;
  vehicles.parked.push(car);
  const side = collideWorld(city, car.x + Math.cos(car.angle + Math.PI / 2) * 34, car.y + Math.sin(car.angle + Math.PI / 2) * 34, 14);
  player.x = side.x;
  player.y = side.y;
  player.car = null;
  player.onFoot = true;
}
