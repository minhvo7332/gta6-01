// Combat: punching, the pistol, bullets, and pickups (health, ammo, cash).
// Bullets are short-lived tracers with a hit test against peds, police and cars.
// Punching is a close arc in front of the player. Crimes raise the wanted heat.

import { PLAYER, WANTED } from './config.js';
import { angleDiff, distance } from './random.js';
import { addHeat } from './police.js';

const BULLET_HIT_DIST = 16;
const ENEMY_HIT_DIST = 14;
const POLICE_CAR_HIT_DIST = 26;
const ENEMY_HIT_DAMAGE = 9;
const PICKUP_DIST = 34;
const HEALTH_PACK = 40;
const AMMO_PACK = 24;
const CASH_PACK = 100;

export function createCombat() {
  return {
    bullets: [], // {x, y, angle, speed, life, fromPlayer}
    punchTimer: 0,
    fireTimer: 0,
    muzzle: 0,
  };
}

/** Everyone a punch or a bullet can hit. */
function hittable(world) {
  return [...world.peds, ...world.missions.enemies, ...world.police.cops];
}

/** Kill a target: mark it dead and raise the heat for the crime. */
function killTarget(world, target) {
  target.dead = true;
  const bystander = !target.gang && !world.police.cops.includes(target);
  addHeat(world.police, bystander ? WANTED.killHeat : WANTED.killHeat / 2);
}

export function tryPunch(combat, world, audio) {
  if (combat.punchTimer > 0 || world.player.inCar) return false;
  combat.punchTimer = 0.35;
  if (audio) audio.punch();
  const p = world.player;
  let landed = false;
  for (const t of hittable(world)) {
    if (t.dead) continue;
    if (distance(p.x, p.y, t.x, t.y) > PLAYER.punchRange) continue;
    const ang = Math.atan2(t.y - p.y, t.x - p.x);
    if (Math.abs(angleDiff(p.angle, ang)) > PLAYER.punchArc) continue;
    t.health -= PLAYER.punchDamage;
    t.flee = 2;
    landed = true;
    if (t.health <= 0) {
      t.dead = true;
      if (!t.gang) addHeat(world.police, WANTED.killHeat);
    }
  }
  if (landed && !world.missions.active) addHeat(world.police, WANTED.hitPedHeat / 2);
  return landed;
}

/** Fire one bullet from (x, y) along `angle`; returns the bullet, or null. */
function fireBullet(combat, x, y, angle, speed, life, fromPlayer) {
  const bullet = { x, y, angle, speed, life, fromPlayer };
  combat.bullets.push(bullet);
  return bullet;
}

export function tryShoot(combat, world, audio, targetX, targetY) {
  const p = world.player;
  if (combat.fireTimer > 0 || p.inCar || p.ammo <= 0) return false;
  combat.fireTimer = PLAYER.fireCooldown;
  combat.muzzle = 0.08;
  p.ammo -= 1;
  const angle = Math.atan2(targetY - p.y, targetX - p.x);
  p.angle = angle;
  fireBullet(combat, p.x + Math.cos(angle) * 20, p.y + Math.sin(angle) * 20, angle, 900, 0.5, true);
  if (audio) audio.shoot();
  addHeat(world.police, WANTED.shootHeat);
  return true;
}

/** Enemy gang members and cops shoot at the player when close enough. */
export function enemyShoot(combat, world, dt) {
  const p = world.player;
  const shooters = [...world.missions.enemies, ...world.police.cops].filter((t) => !t.dead);
  for (const t of shooters) {
    t.shootTimer -= dt;
    const d = distance(t.x, t.y, p.x, p.y);
    if (t.shootTimer > 0 || d > 380 || d < 60) continue;
    t.shootTimer = t.gang ? 1.1 : 1.6;
    const angle = Math.atan2(p.y - t.y, p.x - t.x);
    fireBullet(combat, t.x, t.y, angle, 700, 0.55, false);
  }
}

function stepPlayerBullet(combat, world, b) {
  for (const t of hittable(world)) {
    if (t.dead) continue;
    if (distance(b.x, b.y, t.x, t.y) >= BULLET_HIT_DIST) continue;
    t.health -= PLAYER.pistolDamage;
    b.life = 0;
    if (t.health <= 0) killTarget(world, t);
    return;
  }
  // A shot can also slow a police car: hit its engine and it limps.
  for (const car of world.police.cars) {
    if (distance(b.x, b.y, car.x, car.y) < POLICE_CAR_HIT_DIST) {
      car.speed *= 0.4;
      b.life = 0;
      return;
    }
  }
}

function stepEnemyBullet(combat, world, b) {
  const p = world.player;
  if (p.inCar) return;
  if (distance(b.x, b.y, p.x, p.y) < ENEMY_HIT_DIST) {
    p.health = Math.max(0, p.health - ENEMY_HIT_DAMAGE);
    b.life = 0;
  }
}

export function stepBullets(combat, world, dt) {
  for (const b of combat.bullets) {
    b.life -= dt;
    b.x += Math.cos(b.angle) * b.speed * dt;
    b.y += Math.sin(b.angle) * b.speed * dt;
    if (b.life <= 0) continue;
    if (b.fromPlayer) stepPlayerBullet(combat, world, b);
    else stepEnemyBullet(combat, world, b);
  }
  combat.bullets = combat.bullets.filter((b) => b.life > 0);
  if (combat.punchTimer > 0) combat.punchTimer -= dt;
  if (combat.fireTimer > 0) combat.fireTimer -= dt;
  if (combat.muzzle > 0) combat.muzzle -= dt;
}

/** Pickups scattered around the city: health kits, ammo boxes, dropped cash. */
export function spawnPickups(random, count) {
  const kinds = ['health', 'ammo', 'cash'];
  const pickups = [];
  for (let i = 0; i < count; i += 1) {
    pickups.push({
      x: 200 + random.range(0, 3200),
      y: 200 + random.range(0, 2000),
      kind: kinds[i % kinds.length],
      taken: false,
      bob: random.range(0, Math.PI * 2),
    });
  }
  return pickups;
}

function takePickup(pk, world, audio) {
  const p = world.player;
  pk.taken = true;
  if (pk.kind === 'health') p.health = Math.min(PLAYER.health, p.health + HEALTH_PACK);
  else if (pk.kind === 'ammo') p.ammo += AMMO_PACK;
  else world.cash += CASH_PACK;
  if (audio) audio.pickup();
}

export function stepPickups(pickups, world, dt, audio) {
  const p = world.player;
  for (const pk of pickups) {
    if (pk.taken) continue;
    pk.bob += dt * 3;
    if (distance(p.x, p.y, pk.x, pk.y) < PICKUP_DIST) takePickup(pk, world, audio);
  }
}
