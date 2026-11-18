// Combat: a melee swing and a simple ranged shot with limited ammo.
// Bullets are plain data; render.js draws them, people.js and police
// resolve the hits. Shooting or swinging at someone is a crime.
import { addHeat } from './player.js';
import { hitsBuilding, WORLD_WIDTH, WORLD_HEIGHT } from './city.js';

export const MELEE_RANGE = 46;
export const MELEE_ARC = 1.1; // radians either side of facing
export const BULLET_SPEED = 720;
export const BULLET_RANGE = 520;

export function createCombat() {
  return {
    bullets: [],
    swing: 0, // swing animation timer, 0 = idle
    muzzle: 0,
  };
}

export function tryMelee(player, combat, sound) {
  if (!player.onFoot || player.meleeCooldown > 0) return false;
  player.meleeCooldown = 0.45;
  combat.swing = 0.22;
  if (sound) sound.playMelee();
  return true;
}

export function tryShoot(player, combat, sound) {
  if (!player.onFoot || player.shootCooldown > 0) return false;
  if (player.ammo <= 0) {
    player.shootCooldown = 0.3;
    return false;
  }
  player.ammo -= 1;
  player.shootCooldown = 0.28;
  combat.muzzle = 0.08;
  const px = player.x + Math.cos(player.angle) * 18;
  const py = player.y + Math.sin(player.angle) * 18;
  combat.bullets.push({
    x: px, y: py,
    vx: Math.cos(player.angle) * BULLET_SPEED,
    vy: Math.sin(player.angle) * BULLET_SPEED,
    travelled: 0,
  });
  if (sound) sound.playShot();
  addHeat(player, 6, sound);
  return true;
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Melee hits the nearest person inside the swing arc. Returns the victim
// (a pedestrian or officer object) or null.
export function resolveMelee(player, people) {
  let best = null;
  let bestD = MELEE_RANGE;
  for (const p of people) {
    if (p.down) continue;
    const dx = p.x - player.x;
    const dy = p.y - player.y;
    const d = Math.hypot(dx, dy);
    if (d > MELEE_RANGE) continue;
    const ang = Math.atan2(dy, dx);
    if (Math.abs(angleDiff(ang, player.angle)) > MELEE_ARC) continue;
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

// Move bullets; drop the spent ones. Returns hit events for the caller to
// apply: [{bullet, x, y}] where a bullet died against a person or wall.
export function updateBullets(combat, city, people, dt) {
  const hits = [];
  const alive = [];
  for (const b of combat.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.travelled += BULLET_SPEED * dt;
    let dead = b.travelled > BULLET_RANGE;
    if (!dead) {
      for (const p of people) {
        if (p.down) continue;
        if (Math.hypot(p.x - b.x, p.y - b.y) < 16) {
          hits.push({ bullet: b, target: p, x: b.x, y: b.y });
          dead = true;
          break;
        }
      }
    }
    if (!dead && hitsBuilding(city, b.x, b.y, 0)) dead = true;
    if (!dead && (b.x < 0 || b.y < 0 || b.x > WORLD_WIDTH || b.y > WORLD_HEIGHT)) dead = true;
    if (!dead) alive.push(b);
  }
  combat.bullets = alive;
  if (combat.swing > 0) combat.swing -= dt;
  if (combat.muzzle > 0) combat.muzzle -= dt;
  return hits;
}
