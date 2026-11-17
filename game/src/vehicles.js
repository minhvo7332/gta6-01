// Cars: traffic that drives the road grid, and the player's car with arcade physics.
// Traffic cars pick a road, a direction and a lane, and turn at intersections.
// The player steals a parked or slow car by walking up to it and pressing E.

import { CAR, CAR_MODELS, WORLD } from './config.js';
import { clamp, distance } from './random.js';
import { ROAD_WIDTH, collideBuildings, randomRoadPoint } from './city.js';

export function makeCar(random, x, y, angle, model) {
  return {
    x, y, angle, speed: 0,
    model: model || random.pick(CAR_MODELS),
    traffic: false, // true while it is a traffic car
    isPlayer: false, // true while the player is driving it
    axis: 'v', dir: 1, lane: 24,
    stopped: 0, // seconds the car waits (traffic jam / pedestrian)
    skid: 0,
  };
}

/** Spawn the traffic fleet across the city, plus a few parked cars at the
 * kerb — easy to steal, and they make the streets feel lived-in. */
export function spawnTraffic(city, random, count) {
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const p = randomRoadPoint(city, random);
    const car = makeCar(random, p.x, p.y, p.axis === 'v' ? Math.PI / 2 : 0);
    car.traffic = true;
    car.axis = p.axis;
    car.dir = random.chance(0.5) ? 1 : -1;
    car.lane = random.range(18, 34) * (random.chance(0.5) ? 1 : -1);
    car.speed = random.range(90, 170);
    // Face along the road in the travel direction.
    car.angle = p.axis === 'v' ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
    cars.push(car);
  }
  for (let i = 0; i < 6; i += 1) {
    const p = randomRoadPoint(city, random);
    const parked = makeCar(random, p.x, p.y, p.axis === 'v' ? Math.PI / 2 : 0);
    parked.traffic = false;
    parked.axis = p.axis;
    parked.speed = 0;
    parked.angle = p.axis === 'v' ? (random.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (random.chance(0.5) ? 0 : Math.PI);
    // Parked at the kerb, just off the driving lane.
    if (p.axis === 'v') parked.x += 42;
    else parked.y += 42;
    cars.push(parked);
  }
  return cars;
}

function roadCentersNear(city, value, axis) {
  const list = axis === 'v' ? city.vRoads : city.hRoads;
  let best = list[0];
  let bd = Infinity;
  for (const c of list) {
    const d = Math.abs(c - value);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

/** One traffic car: drive along its road, turn at an intersection sometimes. */
function stepTrafficCar(car, city, dt, random) {
  const roadCenter = roadCentersNear(city, car.axis === 'v' ? car.x : car.y, car.axis);
  const target = roadCenter + car.lane;
  const along = car.axis === 'v' ? car.y : car.x;
  const across = car.axis === 'v' ? car.x : car.y;
  // Steer back onto the lane.
  const steerTo = across + (target - across) * Math.min(1, dt * 3);
  if (car.axis === 'v') car.x = steerTo; else car.y = steerTo;
  const next = along + car.dir * car.speed * dt;
  if (car.axis === 'v') car.y = next; else car.x = next;
  // At an intersection (near a cross road), sometimes turn onto it.
  const cross = car.axis === 'v' ? city.hRoads : city.vRoads;
  for (const c of cross) {
    if (Math.abs(along - c) < 6 && random.chance(0.25)) {
      car.axis = car.axis === 'v' ? 'h' : 'v';
      car.dir = random.chance(0.5) ? 1 : -1;
      car.lane = random.range(18, 34) * (random.chance(0.5) ? 1 : -1);
      car.angle = car.axis === 'v' ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
      break;
    }
  }
  // Wrap around the city edge instead of driving into the sea.
  if (car.x < 40) { car.x = 40; car.dir = 1; car.angle = 0; car.axis = 'h'; }
  if (car.x > WORLD.width - 40) { car.x = WORLD.width - 40; car.dir = -1; car.angle = Math.PI; car.axis = 'h'; }
  if (car.y < 40) { car.y = 40; car.dir = 1; car.angle = Math.PI / 2; car.axis = 'v'; }
  if (car.y > WORLD.height - 40) { car.y = WORLD.height - 40; car.dir = -1; car.angle = -Math.PI / 2; car.axis = 'v'; }
  const body = { x: car.x, y: car.y, r: 24 };
  if (collideBuildings(city, body)) { car.x = body.x; car.y = body.y; car.speed *= 0.5; }
}

/** Player car physics: throttle, steering that bites harder at speed, drag, drift. */
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
  car.angle += steer * CAR.steer * grip * dt * (car.speed >= 0 ? 1 : -1) * (Math.abs(car.speed) > 5 ? 1 : 0);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = clamp(car.x, 30, WORLD.width - 30);
  car.y = clamp(car.y, 30, WORLD.height - 30);
  const body = { x: car.x, y: car.y, r: 26 };
  if (collideBuildings(city, body)) {
    const before = Math.abs(car.speed);
    car.x = body.x;
    car.y = body.y;
    car.speed *= -0.25;
    car.skid = 0.4;
    return before > 260; // hard crash
  }
  if (car.skid > 0) car.skid -= dt;
  return false;
}

/** Nearest stealable car to the player (traffic or parked), within range. */
export function nearestCar(cars, x, y) {
  let best = null;
  let bd = CAR.stealRange;
  for (const car of cars) {
    const d = distance(x, y, car.x, car.y);
    if (d < bd) { bd = d; best = car; }
  }
  return best;
}

/** Step all traffic cars; simple separation so they do not stack. */
export function stepTraffic(cars, city, dt, random) {
  for (const car of cars) {
    if (car.traffic) stepTrafficCar(car, city, dt, random);
  }
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i];
      const b = cars[j];
      // Never shove the player's car: traffic must not push it off the road.
      if (a.isPlayer || b.isPlayer) continue;
      const d = distance(a.x, a.y, b.x, b.y);
      if (d > 0.01 && d < 52) {
        const push = (52 - d) / 2;
        const nx = (b.x - a.x) / d;
        const ny = (b.y - a.y) / d;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
      }
    }
  }
}
