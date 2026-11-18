// The player: Rey Marlow, a courier-turned-wheelman, on foot and in a car.
// Movement, health, money, ammo and the wanted level live here. Cars
// themselves are owned by vehicles.js; this module drives the person.
import { hitsBuilding, WORLD_WIDTH, WORLD_HEIGHT } from './city.js';

export const FOOT_SPEED = 210;
export const SPRINT_SPEED = 330;
export const PLAYER_RADIUS = 14;

export function createPlayer(x, y) {
  return {
    x, y,
    angle: -Math.PI / 2,
    health: 100,
    maxHealth: 100,
    money: 200,
    ammo: 24,
    wanted: 0,
    heat: 0, // 0..100, feeds the wanted level
    hiddenTime: 0, // seconds spent out of police sight
    onFoot: true,
    car: null, // the vehicle object currently driven, or null
    sprinting: false,
    moving: false,
    hurtFlash: 0,
    meleeCooldown: 0,
    shootCooldown: 0,
    dead: false,
  };
}

// Keep a point inside the world and out of building footprints.
export function collideWorld(city, x, y, radius) {
  let nx = Math.max(24, Math.min(WORLD_WIDTH - 24, x));
  let ny = Math.max(24, Math.min(WORLD_HEIGHT - 24, y));
  const b = hitsBuilding(city, nx, ny, radius);
  if (b) {
    // Push out along the smallest penetration axis.
    const left = nx - (b.x - radius);
    const right = b.x + b.w + radius - nx;
    const top = ny - (b.y - radius);
    const bottom = b.y + b.h + radius - ny;
    const m = Math.min(left, right, top, bottom);
    if (m === left) nx = b.x - radius;
    else if (m === right) nx = b.x + b.w + radius;
    else if (m === top) ny = b.y - radius;
    else ny = b.y + b.h + radius;
  }
  return { x: nx, y: ny };
}

export function updateOnFoot(player, city, input, dt) {
  const axis = input.moveAxis();
  player.moving = axis.x !== 0 || axis.y !== 0;
  player.sprinting = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
  const speed = player.sprinting ? SPRINT_SPEED : FOOT_SPEED;
  if (player.moving) {
    const nx = player.x + axis.x * speed * dt;
    const ny = player.y + axis.y * speed * dt;
    const solved = collideWorld(city, nx, ny, PLAYER_RADIUS);
    player.x = solved.x;
    player.y = solved.y;
    player.angle = Math.atan2(axis.y, axis.x);
  }
  if (player.meleeCooldown > 0) player.meleeCooldown -= dt;
  if (player.shootCooldown > 0) player.shootCooldown -= dt;
  if (player.hurtFlash > 0) player.hurtFlash -= dt;
}

// Committing a crime adds heat; enough heat raises the wanted stars.
export function addHeat(player, amount, sound) {
  player.heat = Math.min(100, player.heat + amount);
  player.hiddenTime = 0;
  const newWanted = player.heat <= 0 ? 0 : Math.max(1, Math.ceil(player.heat / 20));
  if (newWanted > player.wanted) {
    player.wanted = newWanted;
    if (sound) sound.playWantedUp();
  }
}

export function setWanted(player, level, sound) {
  const clamped = Math.max(0, Math.min(5, level));
  if (clamped > player.wanted && sound) sound.playWantedUp();
  player.wanted = clamped;
  player.heat = clamped * 20;
  player.hiddenTime = 0;
}

// Wanted decays only while the player stays out of police sight.
export function decayWanted(player, dt, policeNear) {
  if (player.wanted === 0) return;
  if (policeNear) {
    player.hiddenTime = 0;
    return;
  }
  player.hiddenTime += dt;
  if (player.hiddenTime > 6) {
    player.heat = Math.max(0, player.heat - dt * 4);
    const level = Math.ceil(player.heat / 20);
    player.wanted = level;
  }
}

export function damagePlayer(player, amount) {
  if (player.dead) return;
  player.health = Math.max(0, player.health - amount);
  player.hurtFlash = 0.4;
  if (player.health <= 0) player.dead = true;
}

export function healPlayer(player, amount) {
  player.health = Math.min(player.maxHealth, player.health + amount);
}

export function playerSpeed(player) {
  if (player.onFoot || !player.car) return 0;
  return Math.abs(player.car.speed);
}
