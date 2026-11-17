// The wanted system and the police who answer it.
// Heat rises with crimes and decays when the player lies low; stars follow heat.
// Police cars spawn on nearby roads and ram the player; foot cops chase on foot
// and arrest a slow player. Outrun them, break line of sight, and the heat cools.

import { MAX_POLICE_CARS, MAX_COPS, POLICE_RAM_DAMAGE, WANTED, WORLD } from './config.js';
import { angleDiff, clamp, distance } from './random.js';
import { roadPointNear } from './city.js';

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
  police.heat = Math.min(400, police.heat + amount);
  police.quietTimer = 0;
  police.stars = wantedStars(police.heat);
}

function spawnPoliceCar(police, city, random, player) {
  const p = roadPointNear(city, random, player.x, player.y);
  police.cars.push({
    x: p.x, y: p.y,
    angle: Math.atan2(player.y - p.y, player.x - p.x),
    speed: 0,
  });
}

function spawnCop(police, city, random, player) {
  const p = roadPointNear(city, random, player.x, player.y);
  police.cops.push({ x: p.x, y: p.y, angle: 0, speed: 150 });
}

export function stepPolice(police, city, player, dt, random, audio) {
  // Heat decays after a quiet spell; stars fall with it.
  police.quietTimer += dt;
  if (police.quietTimer > WANTED.decayDelay && police.heat > 0) {
    police.heat = Math.max(0, police.heat - WANTED.decayPerSecond * dt);
    police.stars = wantedStars(police.heat);
  }
  const want = police.stars;
  const wantCars = want === 0 ? 0 : Math.min(MAX_POLICE_CARS, 1 + want);
  const wantCops = want === 0 ? 0 : Math.min(MAX_COPS, want * 2);

  // Spawn to strength, one at a time.
  if (police.cars.length < wantCars && random.chance(dt * 1.2)) {
    spawnPoliceCar(police, city, random, player);
  }
  if (police.cops.length < wantCops && random.chance(dt * 0.8)) {
    spawnCop(police, city, random, player);
  }
  // Stand down when the heat is gone.
  if (want === 0) {
    police.cars.length = 0;
    police.cops.length = 0;
    return { rammed: false, arrested: false };
  }

  let rammed = false;
  let arrested = false;
  const playerSpeed = Math.abs(player.carSpeed || 0);
  const targetSpeed = 300 + want * 45;
  if (police.ramCooldown > 0) police.ramCooldown -= dt;

  for (const car of police.cars) {
    const wantAngle = Math.atan2(player.y - car.y, player.x - car.x);
    car.angle += clamp(angleDiff(car.angle, wantAngle), -2.4 * dt, 2.4 * dt);
    car.speed = Math.min(targetSpeed, car.speed + 420 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.x = clamp(car.x, 30, WORLD.width - 30);
    car.y = clamp(car.y, 30, WORLD.height - 30);
    const d = distance(car.x, car.y, player.x, player.y);
    if (d < 46) {
      // A ram hurts at most once a second, and shoves the police car off so
      // it cannot sit on the player and drain health every frame.
      if (police.ramCooldown <= 0) {
        rammed = true;
        police.ramCooldown = 1.0;
      }
      car.speed *= -0.4;
      car.x += Math.cos(car.angle) * -60;
      car.y += Math.sin(car.angle) * -60;
    }
  }
  for (const cop of police.cops) {
    const d = distance(cop.x, cop.y, player.x, player.y);
    const wantAngle = Math.atan2(player.y - cop.y, player.x - cop.x);
    cop.angle = wantAngle;
    const speed = d < 200 ? 190 : 150;
    cop.x += Math.cos(cop.angle) * speed * dt;
    cop.y += Math.sin(cop.angle) * speed * dt;
    // Arrest: on foot, slow, and a cop reaches you.
    if (!player.inCar && playerSpeed < 40 && d < 26) arrested = true;
  }
  police.sirenTimer -= dt;
  if (police.sirenTimer <= 0 && want > 0) {
    police.sirenTimer = 2.2;
    if (audio) audio.siren();
  }
  return { rammed, arrested };
}
