// Cars: traffic that drives Azura Bay's roads, parked cars to steal, and
// the player's own ride. Traffic follows road centre lines and turns at
// intersections; the player drives with arcade physics.
import { makeRng, pick, range, rangeInt, clamp, dist2, angleTo, turnToward } from './rng.js';
import { TILE, WORLD, ROAD_EVERY, roadCenterX, roadCenterY, collideCircle, solidAt } from './citymap.js';

export const CAR_MODELS = [
  { name: 'Sunrunner', color: '#e8a13a', top: 240, accel: 420 },
  { name: 'Comet GT', color: '#c23a4a', top: 300, accel: 520 },
  { name: 'Hauler', color: '#4a7a8a', top: 190, accel: 330 },
  { name: 'Palm Cruiser', color: '#7ac98a', top: 220, accel: 380 },
  { name: 'Neon Taxi', color: '#e8d23a', top: 230, accel: 400 },
  { name: 'Dune Buggy', color: '#b06a3a', top: 210, accel: 360 },
];

export function makeCar(rng, x, y, angle, modelIdx, opts) {
  const model = CAR_MODELS[modelIdx ?? rangeInt(rng, 0, CAR_MODELS.length - 1)];
  const car = {
    x, y, angle, speed: 0, model, kind: 'civil',
    w: 34, h: 17, driver: null, parked: false,
    steer: 0, color: model.color, brakeLight: false,
    sirenPhase: 0, wrecked: false,
  };
  return Object.assign(car, opts || {});
}

export function makeCopCar(rng, x, y, angle) {
  const car = makeCar(rng, x, y, angle, 1, { kind: 'cop', color: '#2a4a8a' });
  car.topSpeed = 320;
  return car;
}

// Spawn traffic on the roads around a point.
export function spawnTraffic(city, rng, count, cx, cy, radius) {
  const out = [];
  let guard = 0;
  while (out.length < count && guard++ < count * 60) {
    const tx = rangeInt(rng, 2, 70);
    const ty = rangeInt(rng, 2, 70);
    const onV = (tx % ROAD_EVERY) === 1;
    const onH = (ty % ROAD_EVERY) === 1;
    if (!onV && !onH) continue;
    const x = onV ? roadCenterX(tx) + (rng() < 0.5 ? -10 : 10) : tx * TILE + TILE / 2;
    const y = onH ? roadCenterY(ty) + (rng() < 0.5 ? -10 : 10) : ty * TILE + TILE / 2;
    if (dist2(x, y, cx, cy) > radius * radius) continue;
    const angle = onV ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI);
    const car = makeCar(rng, x, y, angle, undefined, { parked: false });
    car.speed = range(rng, 60, 130);
    out.push(car);
  }
  return out;
}

// A few parked cars near a point, ready to be stolen.
export function spawnParked(city, rng, count, cx, cy, radius) {
  const out = [];
  let guard = 0;
  while (out.length < count && guard++ < count * 60) {
    const tx = rangeInt(rng, 2, 70);
    const ty = rangeInt(rng, 2, 70);
    const onV = (tx % ROAD_EVERY) === 1;
    const onH = (ty % ROAD_EVERY) === 1;
    if (!onV && !onH) continue;
    const x = onV ? roadCenterX(tx) + 16 : tx * TILE + TILE / 2;
    const y = onH ? roadCenterY(ty) + 16 : ty * TILE + TILE / 2;
    if (dist2(x, y, cx, cy) > radius * radius) continue;
    const angle = onV ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI);
    out.push(makeCar(rng, x, y, angle, undefined, { parked: true, driver: null }));
  }
  return out;
}

function nearIntersection(car) {
  const tx = Math.floor(car.x / TILE);
  const ty = Math.floor(car.y / TILE);
  const cx = Math.abs(car.x - roadCenterX(tx)) < 14;
  const cy = Math.abs(car.y - roadCenterY(ty)) < 14;
  return cx && cy && (tx % ROAD_EVERY) === 1 && (ty % ROAD_EVERY) === 1;
}

export function updateTraffic(G, dt) {
  const p = G.player;
  for (const car of G.cars) {
    if (car === p.car || car.kind === 'cop') continue;
    if (car.parked || car.wrecked) continue;
    // Slow down for the car ahead.
    let slow = false;
    for (const other of G.cars) {
      if (other === car || other.wrecked) continue;
      const d = dist2(car.x, car.y, other.x, other.y);
      if (d < 70 * 70) {
        const ahead = Math.cos(car.angle) * (other.x - car.x) + Math.sin(car.angle) * (other.y - car.y);
        if (ahead > 0) { slow = true; break; }
      }
    }
    const target = slow ? 0 : 110;
    car.speed += clamp(target - car.speed, -260 * dt, 160 * dt);
    // At an intersection, sometimes turn onto the cross street.
    if (nearIntersection(car) && Math.random() < 0.25) {
      const dirs = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
      const cur = Math.round(car.angle / (Math.PI / 2)) % 4;
      const pickDir = dirs[(cur + (Math.random() < 0.5 ? 1 : 3) + 4) % 4];
      car.angle = pickDir;
    }
    // Stay glued to the road centre line.
    const tx = Math.floor(car.x / TILE);
    const ty = Math.floor(car.y / TILE);
    const vertical = Math.abs(Math.cos(car.angle)) < 0.5;
    if (vertical) {
      const cx = roadCenterX(tx);
      car.x += (cx - car.x) * Math.min(1, 4 * dt);
    } else {
      const cy = roadCenterY(ty);
      car.y += (cy - car.y) * Math.min(1, 4 * dt);
    }
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // Keep traffic inside the city.
    if (car.x < 60 || car.y < 60 || car.x > WORLD - 60 || car.y > WORLD - 60) {
      car.angle += Math.PI;
      car.x = clamp(car.x, 80, WORLD - 80);
      car.y = clamp(car.y, 80, WORLD - 80);
    }
  }
  // Keep the streets busy around the player.
  if (G.cars.filter((c) => c.kind === 'civil' && !c.parked).length < 14) {
    const rng = makeRng((Date.now() % 100000) + 13);
    G.cars.push(...spawnTraffic(G.city, rng, 4, p.x, p.y, 900));
  }
  if (G.cars.filter((c) => c.parked).length < 5) {
    const rng = makeRng((Date.now() % 100000) + 29);
    G.cars.push(...spawnParked(G.city, rng, 3, p.x, p.y, 800));
  }
}

export function updatePlayerCar(G, dt) {
  const p = G.player;
  const car = p.car;
  if (!car) return;
  const inp = G.input;
  const fwd = (inp.down('KeyW') || inp.down('ArrowUp')) ? 1 : 0;
  const back = (inp.down('KeyS') || inp.down('ArrowDown')) ? 1 : 0;
  const left = (inp.down('KeyA') || inp.down('ArrowLeft')) ? 1 : 0;
  const right = (inp.down('KeyD') || inp.down('ArrowRight')) ? 1 : 0;
  const handbrake = inp.down('Space');
  const top = car.topSpeed || car.model.top;
  if (fwd) car.speed += car.model.accel * dt;
  if (back) car.speed -= car.model.accel * 0.7 * dt;
  if (!fwd && !back) car.speed -= Math.sign(car.speed) * 140 * dt;
  if (handbrake) car.speed -= Math.sign(car.speed) * 500 * dt;
  car.speed = clamp(car.speed, -top * 0.45, top);
  if (Math.abs(car.speed) < 6 && !fwd && !back) car.speed = 0;
  const steerDir = (right ? 1 : 0) - (left ? 1 : 0);
  const steerAmount = steerDir * (car.speed >= 0 ? 1 : -1) * clamp(Math.abs(car.speed) / 120, 0.25, 1);
  car.angle += steerAmount * 2.6 * dt * (handbrake ? 1.4 : 1);
  car.brakeLight = back || handbrake;
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  // Buildings stop the car hard; a crash hurts and can raise the heat.
  if (solidAt(G.city, nx, ny)) {
    if (Math.abs(car.speed) > 160) {
      G.audio.crash();
      G.addHeat(0.15, 'crash');
      car.speed *= -0.25;
    } else {
      car.speed *= 0.4;
    }
  } else {
    car.x = nx; car.y = ny;
  }
  [car.x, car.y] = collideCircle(G.city, car.x, car.y, 16);
  p.x = car.x; p.y = car.y; p.angle = car.angle;
  // Running over pedestrians is a crime.
  for (const ped of G.peds) {
    if (ped.state === 'dead') continue;
    if (dist2(ped.x, ped.y, car.x, car.y) < 26 * 26 && Math.abs(car.speed) > 60) {
      ped.state = 'dead'; ped.deadTimer = 0;
      G.addHeat(1, 'pedestrian');
      G.audio.crash();
      G.message('Pedestrian down! The cops were called.', '#ff6a6a');
    }
  }
  if (Math.abs(car.speed) > 20) G.audio.engine(true);
}

export function nearestCar(G, x, y, maxDist) {
  let best = null, bestD = maxDist * maxDist;
  for (const car of G.cars) {
    if (car.wrecked) continue;
    const d = dist2(x, y, car.x, car.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

// Steal the nearest car: pull the driver out if there is one.
export function stealCar(G, car) {
  const p = G.player;
  if (car.driver) {
    const driver = car.driver;
    driver.inCar = null;
    driver.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
    driver.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
    driver.state = 'flee';
    car.driver = null;
    G.peds.push(driver);
  }
  car.parked = false;
  p.car = car;
  p.onFoot = false;
  p.x = car.x; p.y = car.y;
  G.addHeat(1, 'grand theft auto');
  G.audio.pickup();
  G.message(`Stole a ${car.model.name}!`, '#ffd23a');
  return car;
}

export function exitCar(G) {
  const p = G.player;
  const car = p.car;
  if (!car) return;
  car.speed *= 0.2;
  p.car = null;
  p.onFoot = true;
  p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 28;
  p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 28;
  p.angle = car.angle + Math.PI / 2;
  [p.x, p.y] = collideCircle(G.city, p.x, p.y, p.radius);
}

export function drawCar(ctx, car, time) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const w = car.w, h = car.h;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-w / 2 + 3, -h / 2 + 4, w, h);
  // Body.
  ctx.fillStyle = car.color;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, 5);
  ctx.fill();
  // Cabin + windshield.
  ctx.fillStyle = 'rgba(20,30,45,0.85)';
  ctx.beginPath();
  ctx.roundRect(-w * 0.12, -h / 2 + 3, w * 0.32, h - 6, 3);
  ctx.fill();
  ctx.fillStyle = 'rgba(180,220,255,0.5)';
  ctx.fillRect(w * 0.2, -h / 2 + 3, 3, h - 6);
  // Headlights and brake lights.
  ctx.fillStyle = '#ffe9a0';
  ctx.fillRect(w / 2 - 2, -h / 2 + 2, 3, 4);
  ctx.fillRect(w / 2 - 2, h / 2 - 6, 3, 4);
  ctx.fillStyle = car.brakeLight ? '#ff2a2a' : '#8a1a1a';
  ctx.fillRect(-w / 2, -h / 2 + 2, 3, 4);
  ctx.fillRect(-w / 2, h / 2 - 6, 3, 4);
  if (car.kind === 'cop') {
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(-w * 0.28, -h / 2, w * 0.1, h);
    ctx.fillStyle = '#111';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('APD', 0, 2);
    // Flashing light bar.
    const on = Math.floor(time * 6) % 2 === 0;
    ctx.fillStyle = on ? '#ff2a2a' : '#2a6aff';
    ctx.fillRect(-4, -h / 2 - 3, 8, 4);
    ctx.fillStyle = on ? '#2a6aff' : '#ff2a2a';
    ctx.fillRect(-4, h / 2 - 1, 8, 4);
  }
  ctx.restore();
}
