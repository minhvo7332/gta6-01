// The heat: a 0–5 star wanted level, and the Azura Police Department's
// response — foot cops at one star, patrol cars at two, roadblocks and
// gunfire at three and up. Lay low and the heat cools off.
import { makeRng, rangeInt, clamp, dist2, angleTo, turnToward } from './rng.js';
import { TILE, WORLD, roadCenterX, roadCenterY, collideCircle } from './citymap.js';
import { makeCopCar, drawCar } from './vehicles.js';
import { createPed, drawPerson } from './actors.js';

export function createWanted() {
  return { level: 0, heat: 0, coolTimer: 0, bustProgress: 0, sirenAt: 0 };
}

export function addHeat(G, amount, reason) {
  const w = G.wanted;
  w.heat = clamp(w.heat + amount, 0, 5.99);
  const newLevel = Math.floor(w.heat);
  if (newLevel > w.level) {
    w.level = newLevel;
    G.message(`WANTED LEVEL ${w.level} — ${reason}!`, '#ff4a4a');
    G.audio.siren();
    w.sirenAt = G.time;
  }
  w.coolTimer = 0;
}

export function spawnCopCar(G) {
  const p = G.player;
  const rng = makeRng((Date.now() % 100000) + G.cops.length * 7);
  // Appear on a road a little way off, roughly toward the player.
  const dir = rng() * Math.PI * 2;
  const sx = clamp(p.x + Math.cos(dir) * 620, 100, WORLD - 100);
  const sy = clamp(p.y + Math.sin(dir) * 620, 100, WORLD - 100);
  const tx = Math.floor(sx / TILE), ty = Math.floor(sy / TILE);
  const x = roadCenterX(tx);
  const y = roadCenterY(ty);
  const car = makeCopCar(rng, x, y, angleTo(x, y, p.x, p.y));
  G.cars.push(car);
  G.cops.push({ kind: 'car', car, stuck: 0 });
}

export function spawnFootCop(G) {
  const p = G.player;
  const rng = makeRng((Date.now() % 100000) + G.cops.length * 11);
  const dir = rng() * Math.PI * 2;
  const x = clamp(p.x + Math.cos(dir) * 320, 80, WORLD - 80);
  const y = clamp(p.y + Math.sin(dir) * 320, 80, WORLD - 80);
  const ped = createPed(rng, x, y);
  ped.shirt = '#2a4a8a';
  ped.color = '#e8b06a';
  ped.speed = 120;
  G.peds.push(ped);
  G.cops.push({ kind: 'foot', ped, shootAt: 0 });
}

export function updateWanted(G, dt) {
  const w = G.wanted;
  const p = G.player;
  // Cool off when the player stays clean and out of sight.
  if (w.level > 0) {
    w.coolTimer += dt;
    const nearestCop = G.cops.reduce((m, c) => {
      const cx = c.kind === 'car' ? c.car.x : c.ped.x;
      const cy = c.kind === 'car' ? c.car.y : c.ped.y;
      return Math.min(m, dist2(cx, cy, p.x, p.y));
    }, Infinity);
    const seen = nearestCop < 420 * 420;
    if (!seen && w.coolTimer > 6) {
      w.heat = Math.max(0, w.heat - dt * 0.12);
      const nl = Math.floor(w.heat);
      if (nl < w.level) {
        w.level = nl;
        if (nl === 0) G.message('You lost the cops. Heat is off.', '#7ad87a');
      }
    }
  }
  // Keep the response matched to the wanted level.
  const wantCars = w.level >= 2 ? Math.min(1 + w.level, 5) : 0;
  const wantFoot = w.level === 1 ? 2 : w.level >= 3 ? 1 : 0;
  const haveCars = G.cops.filter((c) => c.kind === 'car').length;
  const haveFoot = G.cops.filter((c) => c.kind === 'foot').length;
  if (haveCars < wantCars && Math.random() < dt * 0.8) spawnCopCar(G);
  if (haveFoot < wantFoot && Math.random() < dt * 0.8) spawnFootCop(G);
  // Siren wail now and then while wanted.
  if (w.level > 0 && G.time - w.sirenAt > 4) {
    G.audio.siren();
    w.sirenAt = G.time;
  }
  // Update each cop.
  for (const cop of G.cops) {
    if (cop.kind === 'car') updateCopCar(G, cop, dt);
    else updateFootCop(G, cop, dt);
  }
  // Drop cops that got too far away once the heat is gone.
  if (w.level === 0) {
    G.cops = G.cops.filter((c) => {
      const cx = c.kind === 'car' ? c.car.x : c.ped.x;
      const cy = c.kind === 'car' ? c.car.y : c.ped.y;
      return dist2(cx, cy, p.x, p.y) < 900 * 900;
    });
  }
  // Busted: a foot cop holding the player on foot.
  if (p.onFoot && w.level > 0) {
    let touching = false;
    for (const cop of G.cops) {
      if (cop.kind !== 'foot') continue;
      if (dist2(cop.ped.x, cop.ped.y, p.x, p.y) < 26 * 26) { touching = true; break; }
    }
    if (touching) {
      w.bustProgress += dt;
      if (w.bustProgress > 1.4) G.busted();
    } else {
      w.bustProgress = Math.max(0, w.bustProgress - dt * 2);
    }
  } else {
    w.bustProgress = 0;
  }
}

function updateCopCar(G, cop, dt) {
  const car = cop.car;
  const p = G.player;
  const target = angleTo(car.x, car.y, p.x, p.y);
  const d = Math.sqrt(dist2(car.x, car.y, p.x, p.y));
  // Ram the player's car, or the player on foot.
  const wantSpeed = d > 90 ? (car.topSpeed || 320) : 120;
  car.speed += clamp(wantSpeed - car.speed, -500 * dt, 420 * dt);
  car.angle = turnToward(car.angle, target, 2.4 * dt);
  car.sirenPhase += dt;
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  [car.x, car.y] = collideCircle(G.city, nx, ny, 16);
  // Ram damage when it slams the player's car.
  if (p.car && d < 40 && Math.abs(car.speed) > 80) {
    p.car.speed *= 0.6;
    car.speed *= 0.4;
    if (G.time - (G.lastRamAt || -9) > 1) {
      G.lastRamAt = G.time;
      G.audio.crash();
      G.hurtPlayer(6);
    }
  }
  // At wanted 3+, cops shoot from the car window.
  if (G.wanted.level >= 3) {
    cop.shootAt = (cop.shootAt || 0) - dt;
    if (cop.shootAt <= 0 && d < 420) {
      cop.shootAt = 0.9;
      G.fireBullet(car.x, car.y, target + (Math.random() - 0.5) * 0.2, 260, 5, 'cop');
    }
  }
  if (Math.abs(car.speed) < 5) cop.stuck += dt;
  else cop.stuck = 0;
  if (cop.stuck > 4) { // give up and respawn elsewhere
    cop.stuck = 0;
    G.cars = G.cars.filter((c) => c !== car);
    G.cops = G.cops.filter((c) => c !== cop);
    spawnCopCar(G);
  }
}

function updateFootCop(G, cop, dt) {
  const ped = cop.ped;
  const p = G.player;
  const d = Math.sqrt(dist2(ped.x, ped.y, p.x, p.y));
  ped.angle = turnToward(ped.angle, angleTo(ped.x, ped.y, p.x, p.y), 6 * dt);
  const sp = d > 60 ? 165 : 90;
  ped.x += Math.cos(ped.angle) * sp * dt;
  ped.y += Math.sin(ped.angle) * sp * dt;
  ped.walkCycle += dt * 10;
  [ped.x, ped.y] = collideCircle(G.city, ped.x, ped.y, ped.radius);
  if (G.wanted.level >= 2) {
    cop.shootAt = (cop.shootAt || 0) - dt;
    if (cop.shootAt <= 0 && d < 380 && d > 50) {
      cop.shootAt = 1.1;
      G.fireBullet(ped.x, ped.y, angleTo(ped.x, ped.y, p.x, p.y) + (Math.random() - 0.5) * 0.25, 300, 6, 'cop');
    }
  }
}

export function drawCops(ctx, G) {
  for (const cop of G.cops) {
    if (cop.kind === 'car') drawCar(ctx, cop.car, G.time);
    else drawPerson(ctx, cop.ped.x, cop.ped.y, cop.ped.angle, cop.ped.color, cop.ped.shirt, cop.ped.walkCycle, 1.1);
  }
}
