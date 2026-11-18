// Cars: traffic that drives the road grid, and the player's car with arcade
// physics. Traffic cars pick a road, a direction and a lane, and turn at
// intersections. The player steals a parked or slow car by walking up to it
// and pressing E.

import { CAR, CAR_MODELS, WORLD } from './config.js';
import { clamp, distance } from './random.js';
import { collideBuildings, randomRoadPoint } from './city.js';

const KERB_OFFSET = 42;
const EDGE_MARGIN = 40;

/** A car: position, heading, speed, model, and its traffic state. */
export function makeCar(random, x, y, angle, model) {
  return {
    x,
    y,
    angle,
    speed: 0,
    model: model || random.pick(CAR_MODELS),
    traffic: false, // true while it is a traffic car
    isPlayer: false, // true while the player is driving it
    axis: 'v',
    dir: 1,
    lane: 24,
    stopped: 0,
    skid: 0,
  };
}

/** Heading for a car travelling along `axis` in direction `dir`. */
function headingFor(axis, dir) {
  if (axis === 'v') return dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  return dir > 0 ? 0 : Math.PI;
}

function randomLane(random) {
  return random.range(18, 34) * (random.chance(0.5) ? 1 : -1);
}

function placeOnRoad(car, point, random, moving) {
  car.traffic = moving;
  car.axis = point.axis;
  car.dir = random.chance(0.5) ? 1 : -1;
  car.lane = randomLane(random);
  car.angle = headingFor(point.axis, car.dir);
  if (moving) car.speed = random.range(90, 170);
}

/** Spawn the traffic fleet across the city, plus parked cars at the kerb — easy
 * to steal, and they make the streets feel lived-in. */
export function spawnTraffic(city, random, count) {
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const point = randomRoadPoint(city, random);
    const car = makeCar(random, point.x, point.y, 0);
    placeOnRoad(car, point, random, true);
    cars.push(car);
  }
  for (let i = 0; i < 6; i += 1) {
    const point = randomRoadPoint(city, random);
    const parked = makeCar(random, point.x, point.y, 0);
    placeOnRoad(parked, point, random, false);
    // Parked at the kerb, just off the driving lane.
    if (point.axis === 'v') parked.x += KERB_OFFSET;
    else parked.y += KERB_OFFSET;
    cars.push(parked);
  }
  return cars;
}

/** The road centre line nearest `value` on the given axis. */
function nearestCentre(city, value, axis) {
  const list = axis === 'v' ? city.vRoads : city.hRoads;
  let best = list[0];
  let bestD = Infinity;
  for (const c of list) {
    const d = Math.abs(c - value);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

/** One traffic car: drive along its road, turn at an intersection sometimes. */
function stepTrafficCar(car, city, dt, random) {
  const centre = nearestCentre(city, car.axis === 'v' ? car.x : car.y, car.axis);
  const target = centre + car.lane;
  const along = car.axis === 'v' ? car.y : car.x;
  const across = car.axis === 'v' ? car.x : car.y;
  // Ease back onto the lane.
  const steered = across + (target - across) * Math.min(1, dt * 3);
  if (car.axis === 'v') car.x = steered;
  else car.y = steered;
  const next = along + car.dir * car.speed * dt;
  if (car.axis === 'v') car.y = next;
  else car.x = next;
  // At an intersection (near a cross road), sometimes turn onto it.
  const cross = car.axis === 'v' ? city.hRoads : city.vRoads;
  for (const c of cross) {
    if (Math.abs(along - c) >= 6) continue;
    if (!random.chance(0.25)) continue;
    car.axis = car.axis === 'v' ? 'h' : 'v';
    car.dir = random.chance(0.5) ? 1 : -1;
    car.lane = randomLane(random);
    car.angle = headingFor(car.axis, car.dir);
    break;
  }
  // Wrap around the city edge instead of driving into the sea.
  if (car.x < EDGE_MARGIN) { car.x = EDGE_MARGIN; car.dir = 1; car.angle = 0; car.axis = 'h'; }
  if (car.x > WORLD.width - EDGE_MARGIN) { car.x = WORLD.width - EDGE_MARGIN; car.dir = -1; car.angle = Math.PI; car.axis = 'h'; }
  if (car.y < EDGE_MARGIN) { car.y = EDGE_MARGIN; car.dir = 1; car.angle = Math.PI / 2; car.axis = 'v'; }
  if (car.y > WORLD.height - EDGE_MARGIN) { car.y = WORLD.height - EDGE_MARGIN; car.dir = -1; car.angle = -Math.PI / 2; car.axis = 'v'; }
  const body = { x: car.x, y: car.y, r: 24 };
  if (collideBuildings(city, body)) {
    car.x = body.x;
    car.y = body.y;
    car.speed *= 0.5;
  }
}

/**
 * Player car physics: throttle, steering that bites harder at speed, drag,
 * a little drift. Returns true on a hard crash into a building.
 */
export function stepPlayerCar(car, steer, throttle, dt, city) {
  const forward = throttle > 0 ? 1 : throttle < 0 ? -1 : 0;
  if (forward !== 0) {
    car.speed += forward * (throttle > 0 ? CAR.accel : CAR.brake) * dt;
  }
  car.speed = clamp(car.speed, -CAR.reverseMax, CAR.maxSpeed);
  // Drag and rolling resistance.
  car.speed -= car.speed * CAR.drag * dt;
  if (forward === 0 && Math.abs(car.speed) < 12) car.speed = 0;
  const grip = clamp(Math.abs(car.speed) / 200, 0.25, 1);
  const turning = Math.abs(car.speed) > 5;
  if (turning) {
    car.angle += steer * CAR.steer * grip * dt * (car.speed >= 0 ? 1 : -1);
  }
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = clamp(car.x, 30, WORLD.width - 30);
  car.y = clamp(car.y, 30, WORLD.height - 30);
  const body = { x: car.x, y: car.y, r: 26 };
  if (!collideBuildings(city, body)) {
    if (car.skid > 0) car.skid -= dt;
    return false;
  }
  const impact = Math.abs(car.speed);
  car.x = body.x;
  car.y = body.y;
  car.speed *= -0.25;
  car.skid = 0.4;
  return impact > 260; // hard crash
}

/** Nearest stealable car to the player (traffic or parked), within range. */
export function nearestCar(cars, x, y) {
  let best = null;
  let bestD = CAR.stealRange;
  for (const car of cars) {
    const d = distance(x, y, car.x, car.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

/** Push two overlapping cars apart (never the player's car). */
function separate(a, b) {
  if (a.isPlayer || b.isPlayer) return;
  const d = distance(a.x, a.y, b.x, b.y);
  if (d <= 0.01 || d >= 52) return;
  const push = (52 - d) / 2;
  const nx = (b.x - a.x) / d;
  const ny = (b.y - a.y) / d;
  a.x -= nx * push;
  a.y -= ny * push;
  b.x += nx * push;
  b.y += ny * push;
}

/** Step all traffic cars, with simple separation so they do not stack. */
export function stepTraffic(cars, city, dt, random) {
  for (const car of cars) {
    if (car.traffic) stepTrafficCar(car, city, dt, random);
  }
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      separate(cars[i], cars[j]);
    }
  }
}
