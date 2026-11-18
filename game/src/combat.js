// Combat: Dana's pistol, enemy gunfire, muzzle flashes, tracers and the
// little explosions when a car takes too much punishment. Rival gang
// members are armed peds who fight back.
import { dist2, angleTo, makeRng, range } from './rng.js';
import { createPed } from './actors.js';
import { collideCircle, solidAt } from './citymap.js';

export function createCombat() {
  return { bullets: [], flashes: [], shootCooldown: 0, kills: 0 };
}

export function fireBullet(G, x, y, angle, speed, damage, owner) {
  G.combat.bullets.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, damage, owner, life: 1.1 });
  G.combat.flashes.push({ x, y, t: 0.07 });
  if (owner === 'player') {
    G.audio.shoot();
    G.shotsFiredAt = G.time;
  }
}

export function spawnGang(G, x, y, count) {
  const rng = makeRng((Date.now() % 100000) + count * 31);
  const out = [];
  for (let i = 0; i < count; i++) {
    const ped = createPed(rng, x + range(rng, -60, 60), y + range(rng, -60, 60));
    ped.shirt = '#3a8a3a';
    ped.color = '#c98a5a';
    ped.state = 'gang';
    ped.hp = 30;
    ped.shootAt = range(rng, 0.3, 1.2);
    out.push(ped);
  }
  G.peds.push(...out);
  return out;
}

export function playerShoot(G) {
  const c = G.combat;
  if (c.shootCooldown > 0) return;
  c.shootCooldown = 0.28;
  const p = G.player;
  const aim = p.onFoot
    ? angleTo(p.x, p.y, G.input.mouse.wx, G.input.mouse.wy)
    : p.angle;
  const gx = p.x + Math.cos(aim) * 22;
  const gy = p.y + Math.sin(aim) * 22;
  fireBullet(G, gx, gy, aim, 620, 12, 'player');
}

export function updateCombat(G, dt) {
  const c = G.combat;
  if (c.shootCooldown > 0) c.shootCooldown -= dt;
  for (const f of c.flashes) f.t -= dt;
  c.flashes = c.flashes.filter((f) => f.t > 0);
  const p = G.player;
  // Gang members hunt the player and shoot.
  for (const ped of G.peds) {
    if (ped.state !== 'gang') continue;
    const d = Math.sqrt(dist2(ped.x, ped.y, p.x, p.y));
    ped.angle = angleTo(ped.x, ped.y, p.x, p.y);
    if (d > 160) {
      ped.x += Math.cos(ped.angle) * 95 * dt;
      ped.y += Math.sin(ped.angle) * 95 * dt;
      ped.walkCycle += dt * 9;
      [ped.x, ped.y] = collideCircle(G.city, ped.x, ped.y, ped.radius);
    } else {
      ped.shootAt -= dt;
      if (ped.shootAt <= 0) {
        ped.shootAt = 0.8 + Math.random() * 0.7;
        fireBullet(G, ped.x, ped.y, angleTo(ped.x, ped.y, p.x, p.y) + (Math.random() - 0.5) * 0.3, 300, 6, 'gang');
      }
    }
  }
  // Bullets fly and hit people, cars and walls.
  for (const b of c.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0) continue;
    // Walls stop bullets.
    if (solidAt(G.city, b.x, b.y)) { b.life = 0; continue; }
    if (b.owner === 'player' || b.owner === 'cop') {
      // Hit a ped (not the player).
      for (const ped of G.peds) {
        if (ped.state === 'dead') continue;
        if (b.owner === 'player' && ped.state === 'gang') { /* fall through */ }
        if (dist2(b.x, b.y, ped.x, ped.y) < 15 * 15) {
          b.life = 0;
          if (b.owner === 'player') {
            if (ped.state === 'gang') {
              ped.hp -= b.damage;
              if (ped.hp <= 0) {
                ped.state = 'dead'; ped.deadTimer = 0;
                c.kills++;
                G.onKill(ped);
              }
            } else {
              ped.state = 'dead'; ped.deadTimer = 0;
              c.kills++;
              G.addHeat(1, 'murder');
              G.onKill(ped);
            }
          }
          break;
        }
      }
      if (b.life <= 0) continue;
      // Hit a car.
      for (const car of G.cars) {
        if (car.wrecked) continue;
        if (dist2(b.x, b.y, car.x, car.y) < 22 * 22) {
          b.life = 0;
          car.hp = (car.hp ?? 40) - b.damage;
          if (car.hp <= 0 && !car.wrecked) {
            car.wrecked = true;
            car.speed = 0;
            G.explosions.push({ x: car.x, y: car.y, t: 0.6, r: 60 });
            G.audio.crash();
            G.addHeat(0.5, 'explosion');
            if (car === p.car) { p.car = null; p.onFoot = true; G.hurtPlayer(25); }
          }
          break;
        }
      }
    } else {
      // Enemy bullets can hit the player.
      if (dist2(b.x, b.y, p.x, p.y) < (p.onFoot ? 14 : 24) * (p.onFoot ? 14 : 24)) {
        b.life = 0;
        G.hurtPlayer(b.damage);
      }
    }
  }
  c.bullets = c.bullets.filter((b) => b.life > 0);
  for (const e of G.explosions) e.t -= dt;
  G.explosions = G.explosions.filter((e) => e.t > 0);
}

export function drawCombat(ctx, G) {
  for (const b of G.combat.bullets) {
    ctx.strokeStyle = '#ffe9a0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  for (const f of G.combat.flashes) {
    ctx.fillStyle = `rgba(255,220,120,${Math.max(0, f.t / 0.07)})`;
    ctx.beginPath();
    ctx.arc(f.x, f.y, 10, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const e of G.explosions) {
    const k = 1 - e.t / 0.6;
    ctx.fillStyle = `rgba(255,${Math.floor(160 - k * 120)},40,${1 - k})`;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r * (0.5 + k), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(60,60,60,${0.7 * (1 - k)})`;
    ctx.beginPath();
    ctx.arc(e.x, e.y - 20 * k, e.r * 0.4 * k + 6, 0, Math.PI * 2);
    ctx.fill();
  }
}
