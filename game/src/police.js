// The wanted system and the police who answer it.
// Heat rises with crimes and decays when the player lies low; stars follow heat.
// Police cars spawn on nearby roads and ram the player; foot cops chase on foot
// and arrest a slow player. Outrun them, break line of sight, and the heat cools.

import { MAX_POLICE_CARS, MAX_COPS, WANTED, WORLD } from './config.js';
import { angleDiff, clamp, distance } from './random.js';
import { roadPointNear } from './city.js';

const HEAT_CAP = 400;
const RAM_COOLDOWN = 1.0;
const SIREN_EVERY = 2.2;

/** Star level for a heat value: the highest threshold it reaches. */
export function wantedStars(heat) {
  let stars = 0;
  for (let i = 0; i < WANTED.thresholds.length; i += 1) {
    if (heat >= WANTED.thresholds[i]) stars = i;
  }
  return Math.min(5, stars);
}

export function createPolice() {
  return {
    heat: 0,
    stars: 0,
    quietTimer: 0, // seconds since the last crime
    ramCooldown: 0, // seconds until a ram can hurt the player again
    cars: [], // {x, y, angle, speed}
    cops: [], // {x, y, angle, speed}
    sirenTimer: 0,
  };
}

export function addHeat(police, amount) {
  police.heat = Math.min(HEAT_CAP, police.heat + amount);
  police.quietTimer = 0;
  police.stars = wantedStars(police.heat);
}

function spawnPoliceCar(police, city, random, player) {
  const p = roadPointNear(city, random, player.x, player.y);
  police.cars.push({
    x: p.x,
    y: p.y,
    angle: Math.atan2(player.y - p.y, player.x - p.x),
    speed: 0,
  });
}

function spawnCop(police, city, random, player) {
  const p = roadPointNear(city, random, player.x, player.y);
  police.cops.push({ x: p.x, y: p.y, angle: 0, speed: 150 });
}

/** How many police cars and foot cops the current star level calls for. */
function wantedStrength(stars) {
  if (stars === 0) return { cars: 0, cops: 0 };
  return {
    cars: Math.min(MAX_POLICE_CARS, 1 + stars),
    cops: Math.min(MAX_COPS, stars * 2),
  };
}

function stepPoliceCar(car, player, dt, targetSpeed) {
  const wantAngle = Math.atan2(player.y - car.y, player.x - car.x);
  car.angle += clamp(angleDiff(car.angle, wantAngle), -2.4 * dt, 2.4 * dt);
  car.speed = Math.min(targetSpeed, car.speed + 420 * dt);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = clamp(car.x, 30, WORLD.width - 30);
  car.y = clamp(car.y, 30, WORLD.height - 30);
  return distance(car.x, car.y, player.x, player.y);
}

function stepCop(cop, player, dt) {
  const d = distance(cop.x, cop.y, player.x, player.y);
  cop.angle = Math.atan2(player.y - cop.y, player.x - cop.x);
  const speed = d < 200 ? 190 : 150;
  cop.x += Math.cos(cop.angle) * speed * dt;
  cop.y += Math.sin(cop.angle) * speed * dt;
  return d;
}

/** Cool the heat after a quiet spell; the stars fall with it. */
function decayHeat(police, dt) {
  police.quietTimer += dt;
  if (police.quietTimer <= WANTED.decayDelay || police.heat <= 0) return;
  police.heat = Math.max(0, police.heat - WANTED.decayPerSecond * dt);
  police.stars = wantedStars(police.heat);
}

export function stepPolice(police, city, player, dt, random, audio) {
  decayHeat(police, dt);
  const strength = wantedStrength(police.stars);

  // Spawn up to strength, one at a time.
  if (police.cars.length < strength.cars && random.chance(dt * 1.2)) {
    spawnPoliceCar(police, city, random, player);
  }
  if (police.cops.length < strength.cops && random.chance(dt * 0.8)) {
    spawnCop(police, city, random, player);
  }
  // Stand down when the heat is gone.
  if (police.stars === 0) {
    police.cars.length = 0;
    police.cops.length = 0;
    return { rammed: false, arrested: false };
  }

  let rammed = false;
  let arrested = false;
  const playerSpeed = Math.abs(player.carSpeed || 0);
  const targetSpeed = 300 + police.stars * 45;
  if (police.ramCooldown > 0) police.ramCooldown -= dt;

  for (const car of police.cars) {
    const d = stepPoliceCar(car, player, dt, targetSpeed);
    if (d < 46) {
      // A ram hurts at most once a second, and shoves the police car off so
      // it cannot sit on the player and drain health every frame.
      if (police.ramCooldown <= 0) {
        rammed = true;
        police.ramCooldown = RAM_COOLDOWN;
      }
      car.speed *= -0.4;
      car.x += Math.cos(car.angle) * -60;
      car.y += Math.sin(car.angle) * -60;
    }
  }
  for (const cop of police.cops) {
    const d = stepCop(cop, player, dt);
    // Arrest: on foot, slow, and a cop reaches you.
    if (!player.inCar && playerSpeed < 40 && d < 26) arrested = true;
  }
  police.sirenTimer -= dt;
  if (police.sirenTimer <= 0 && police.stars > 0) {
    police.sirenTimer = SIREN_EVERY;
    if (audio) audio.siren();
  }
  return { rammed, arrested };
}
