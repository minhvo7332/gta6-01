// Combat: punching, the pistol, bullets, and pickups (health, ammo, cash).
// Bullets are short-lived tracers with a hit test against peds, police and cars.
// Punching is a close arc in front of the player. Crimes raise the wanted heat.

import { PLAYER, WANTED } from './config.js';
import { angleDiff, distance } from './random.js';
import { addHeat } from './police.js';

export function createCombat() {
  return {
    bullets: [], // {x, y, angle, speed, life, fromPlayer}
    punchTimer: 0,
    fireTimer: 0,
    muzzle: 0,
  };
}

export function tryPunch(combat, world, audio) {
  if (combat.punchTimer > 0 || world.player.inCar) return false;
  combat.punchTimer = 0.35;
  if (audio) audio.punch();
  const p = world.player;
  let hitAnyone = false;
  const targets = [...world.peds, ...world.missions.enemies, ...world.police.cops];
  for (const t of targets) {
    if (t.dead) continue;
    const d = distance(p.x, p.y, t.x, t.y);
    if (d > PLAYER.punchRange) continue;
    const ang = Math.atan2(t.y - p.y, t.x - p.x);
    if (Math.abs(angleDiff(p.angle, ang)) > PLAYER.punchArc) continue;
    t.health -= PLAYER.punchDamage;
    t.flee = 2;
    hitAnyone = true;
    if (t.health <= 0) {
      t.dead = true;
      if (!t.gang) addHeat(world.police, WANTED.killHeat);
    }
  }
  if (hitAnyone && !world.missions.active) addHeat(world.police, WANTED.hitPedHeat / 2);
  return hitAnyone;
}

export function tryShoot(combat, world, audio, targetX, targetY) {
  const p = world.player;
  if (combat.fireTimer > 0 || p.inCar || p.ammo <= 0) return false;
  combat.fireTimer = PLAYER.fireCooldown;
  combat.muzzle = 0.08;
  p.ammo -= 1;
  const angle = Math.atan2(targetY - p.y, targetX - p.x);
  p.angle = angle;
  combat.bullets.push({ x: p.x + Math.cos(angle) * 20, y: p.y + Math.sin(angle) * 20, angle, speed: 900, life: 0.5, fromPlayer: true });
  if (audio) audio.shoot();
  addHeat(world.police, WANTED.shootHeat);
  return true;
}

/** Enemy gang members and cops shoot at the player when close and in line of sight. */
export function enemyShoot(combat, world, dt, random) {
  const p = world.player;
  const shooters = [...world.missions.enemies, ...world.police.cops].filter((t) => !t.dead);
  for (const t of shooters) {
    t.shootTimer -= dt;
    const d = distance(t.x, t.y, p.x, p.y);
    if (t.shootTimer > 0 || d > 380 || d < 60) continue;
    t.shootTimer = t.gang ? 1.1 : 1.6;
    const angle = Math.atan2(p.y - t.y, p.x - t.x);
    combat.bullets.push({ x: t.x, y: t.y, angle, speed: 700, life: 0.55, fromPlayer: false });
  }
}

export function stepBullets(combat, world, dt) {
  const p = world.player;
  for (const b of combat.bullets) {
    b.life -= dt;
    b.x += Math.cos(b.angle) * b.speed * dt;
    b.y += Math.sin(b.angle) * b.speed * dt;
    if (b.life <= 0) continue;
    if (b.fromPlayer) {
      const targets = [...world.peds, ...world.missions.enemies, ...world.police.cops];
      for (const t of targets) {
        if (t.dead) continue;
        if (distance(b.x, b.y, t.x, t.y) < 16) {
          t.health -= PLAYER.pistolDamage;
          b.life = 0;
          if (t.health <= 0) {
            t.dead = true;
            if (!t.gang && !world.police.cops.includes(t)) addHeat(world.police, WANTED.killHeat);
            else addHeat(world.police, WANTED.killHeat / 2);
          }
          break;
        }
      }
      // A shot can also slow a police car: hit its engine and it limps.
      if (b.life > 0) {
        for (const car of world.police.cars) {
          if (distance(b.x, b.y, car.x, car.y) < 26) {
            car.speed *= 0.4;
            b.life = 0;
            break;
          }
        }
      }
    } else if (distance(b.x, b.y, p.x, p.y) < 14 && !p.inCar) {
      p.health -= 9;
      b.life = 0;
      if (p.health < 0) p.health = 0;
    }
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

export function stepPickups(pickups, world, dt, audio) {
  const p = world.player;
  for (const pk of pickups) {
    if (pk.taken) continue;
    pk.bob += dt * 3;
    if (distance(p.x, p.y, pk.x, pk.y) < 34) {
      pk.taken = true;
      if (pk.kind === 'health') p.health = Math.min(PLAYER.health, p.health + 40);
      else if (pk.kind === 'ammo') p.ammo += 24;
      else world.cash += 100;
      if (audio) audio.pickup();
    }
  }
}
