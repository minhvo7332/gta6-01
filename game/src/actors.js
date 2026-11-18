// People: Dana on foot, and the pedestrians who fill Azura Bay's
// sidewalks. Peds wander, queue at crossings, and flee from gunfire,
// sirens and speeding cars.
import { makeRng, pick, range, clamp, dist2, angleTo, turnToward } from './rng.js';
import { collideCircle, isSand, isWater, WORLD } from './citymap.js';

const PED_COLORS = ['#e8b06a', '#c98a5a', '#8a5a3a', '#d8c8a8', '#a86a4a'];
const SHIRTS = ['#d84a4a', '#4a7ad8', '#4ad86a', '#d8c94a', '#8a4ad8', '#e8e8e8', '#3a3a3a', '#e87a4a'];

export function createPlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, speed: 0, radius: 13,
    health: 100, maxHealth: 100,
    onFoot: true, car: null,
    walkCycle: 0, hurtFlash: 0, bustTimer: 0,
    cash: 120, ammo: 999,
  };
}

export function createPed(rng, x, y) {
  return {
    x, y, angle: rng() * Math.PI * 2, speed: range(rng, 28, 52),
    radius: 11, color: pick(rng, PED_COLORS), shirt: pick(rng, SHIRTS),
    state: 'walk', // walk | flee | dead
    targetAngle: rng() * Math.PI * 2, retarget: range(rng, 1, 4),
    walkCycle: rng() * 6, deadTimer: 0, inCar: null,
  };
}

export function spawnPeds(city, rng, count, cx, cy, radius) {
  const out = [];
  let guard = 0;
  while (out.length < count && guard++ < count * 40) {
    const x = cx + (rng() * 2 - 1) * radius;
    const y = cy + (rng() * 2 - 1) * radius;
    if (x < 60 || y < 60 || x > WORLD - 60 || y > WORLD - 60) continue;
    if (isWater(x, y)) continue;
    out.push(createPed(rng, x, y));
  }
  return out;
}

export function updatePlayerOnFoot(G, dt) {
  const p = G.player;
  const inp = G.input;
  let mx = 0, my = 0;
  if (inp.down('KeyW') || inp.down('ArrowUp')) my -= 1;
  if (inp.down('KeyS') || inp.down('ArrowDown')) my += 1;
  if (inp.down('KeyA') || inp.down('ArrowLeft')) mx -= 1;
  if (inp.down('KeyD') || inp.down('ArrowRight')) mx += 1;
  const run = inp.down('ShiftLeft') || inp.down('ShiftRight');
  const spd = run ? 235 : 150;
  if (mx || my) {
    const len = Math.hypot(mx, my);
    p.x += (mx / len) * spd * dt;
    p.y += (my / len) * spd * dt;
    p.walkCycle += dt * (run ? 13 : 9);
    // Face the mouse while on foot (aim), else face movement.
    p.angle = angleTo(p.x, p.y, G.input.mouse.wx, G.input.mouse.wy);
  }
  [p.x, p.y] = collideCircle(G.city, p.x, p.y, p.radius);
  if (p.hurtFlash > 0) p.hurtFlash -= dt;
  if (p.health < p.maxHealth && G.time - (G.lastHurtAt || 0) > 6) {
    p.health = Math.min(p.maxHealth, p.health + 4 * dt); // slow regen out of combat
  }
}

export function updatePeds(G, dt) {
  const p = G.player;
  for (const ped of G.peds) {
    if (ped.state === 'dead') { ped.deadTimer += dt; continue; }
    ped.walkCycle += dt * 6;
    // Flee from danger: gunfire, sirens, or the player speeding at them.
    let danger = false;
    if (G.shotsFiredAt && G.time - G.shotsFiredAt < 1.2) danger = true;
    if (G.wanted.level >= 2 && dist2(ped.x, ped.y, p.x, p.y) < 260 * 260) danger = true;
    if (p.car && p.car.speed > 200 && dist2(ped.x, ped.y, p.x, p.y) < 200 * 200) danger = true;
    if (danger && ped.state !== 'flee') {
      ped.state = 'flee';
      ped.targetAngle = angleTo(p.x, p.y, ped.x, ped.y);
    }
    if (ped.state === 'flee') {
      ped.retarget -= dt;
      if (ped.retarget <= 0) {
        ped.targetAngle = angleTo(p.x, p.y, ped.x, ped.y) + (Math.random() - 0.5);
        ped.retarget = 0.7;
      }
      ped.angle = turnToward(ped.angle, ped.targetAngle, 6 * dt);
      const sp = ped.speed * 2.1;
      ped.x += Math.cos(ped.angle) * sp * dt;
      ped.y += Math.sin(ped.angle) * sp * dt;
      if (dist2(ped.x, ped.y, p.x, p.y) > 520 * 520) ped.state = 'walk';
    } else {
      ped.retarget -= dt;
      if (ped.retarget <= 0) {
        ped.targetAngle += (Math.random() - 0.5) * 2.2;
        ped.retarget = range(Math.random, 1, 4);
      }
      ped.angle = turnToward(ped.angle, ped.targetAngle, 3 * dt);
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
    }
    [ped.x, ped.y] = collideCircle(G.city, ped.x, ped.y, ped.radius);
  }
  // Prune the dead after a while, keep the crowd near the player topped up.
  G.peds = G.peds.filter((ped) => ped.state !== 'dead' || ped.deadTimer < 8);
  if (G.peds.length < 26) {
    const rng = makeRng((Date.now() % 100000) + G.peds.length);
    G.peds.push(...spawnPeds(G.city, rng, 26 - G.peds.length, p.x, p.y, 700));
  }
}

export function drawPerson(ctx, x, y, angle, color, shirt, walkCycle, scale) {
  const s = scale || 1;
  const bob = Math.sin(walkCycle) * 2 * s;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  // Legs.
  ctx.fillStyle = '#2a2f3a';
  const legSwing = Math.sin(walkCycle) * 4 * s;
  ctx.fillRect(-4 * s, -8 * s + legSwing * 0.4, 5 * s, 9 * s);
  ctx.fillRect(-4 * s, 1 * s - legSwing * 0.4, 5 * s, 9 * s);
  // Body.
  ctx.fillStyle = shirt;
  ctx.fillRect(-7 * s, -9 * s, 13 * s, 18 * s);
  // Arms.
  ctx.fillStyle = color;
  ctx.fillRect(4 * s, -10 * s, 5 * s, 7 * s);
  ctx.fillRect(4 * s, 3 * s, 5 * s, 7 * s);
  // Head.
  ctx.beginPath();
  ctx.arc(8 * s, 0, 6.5 * s, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
  if (bob) { /* bob is folded into the leg swing; kept for future use */ }
}

export function drawPlayer(ctx, G) {
  const p = G.player;
  if (p.hurtFlash > 0 && Math.floor(p.hurtFlash * 12) % 2 === 0) return; // blink while hurt
  drawPerson(ctx, p.x, p.y, p.angle, '#e8b06a', '#d84a4a', p.walkCycle, 1.15);
  // Pistol in hand, pointing where Dana aims.
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#22252c';
  ctx.fillRect(10, -2, 12, 4);
  ctx.restore();
}
