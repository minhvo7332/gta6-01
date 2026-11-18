// Azura Bay — boot: builds the world, runs the loop, and owns the game
// state every system reads. Title -> streets -> pause / busted / wasted.
import { makeRng } from './rng.js';
import { buildCity, drawCity, WORLD, nearestRoadCenterX, nearestRoadCenterY } from './citymap.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createPlayer, updatePlayerOnFoot, updatePeds, drawPlayer, drawPerson, spawnPeds } from './actors.js';
import { makeCar, spawnTraffic, spawnParked, updateTraffic, updatePlayerCar, nearestCar, stealCar, exitCar, drawCar } from './vehicles.js';
import { createWanted, addHeat, updateWanted, drawCops } from './wanted.js';
import { createCombat, playerShoot, updateCombat, drawCombat, fireBullet } from './combat.js';
import { createMissionState, startMission, updateMissions, missionMarker, objectiveText, onMissionKill, MISSIONS } from './missions.js';
import { drawHud, drawObjectiveArrow, drawTitle, drawPause, drawEnd } from './hud.js';
import { saveGame, loadSave, hasSave, applySave } from './savegame.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || 7) || 7;
const shot = params.get('shot');

const rng = makeRng(seed);
const city = buildCity(seed);
const input = createInput(canvas);
const audio = createAudio();

const G = {
  city, rng, input, audio,
  time: 0, mode: 'title', endKind: null,
  player: createPlayer(city.spots.plaza.x, city.spots.plaza.y),
  peds: [], cars: [], cops: [],
  wanted: createWanted(),
  combat: createCombat(),
  missions: createMissionState(),
  explosions: [],
  msgText: '', msgAt: -99, msgColor: '#fff',
  shotsFiredAt: -99, lastHurtAt: -99, lastRamAt: -99,
  hasSave: hasSave(),
  frames: 0,
};

G.message = (text, color) => { G.msgText = text; G.msgColor = color || '#fff'; G.msgAt = G.time; };
G.addHeat = (amount, reason) => addHeat(G, amount, reason);
G.fireBullet = (x, y, angle, speed, damage, owner) => fireBullet(G, x, y, angle, speed, damage, owner);
G.hurtPlayer = (dmg) => {
  const p = G.player;
  if (G.mode !== 'playing') return;
  p.health -= dmg;
  p.hurtFlash = 0.35;
  G.lastHurtAt = G.time;
  if (p.health <= 0) {
    p.health = 0;
    G.mode = 'end';
    G.endKind = 'wasted';
    audio.missionFail();
  }
};
G.busted = () => {
  if (G.mode !== 'playing') return;
  G.mode = 'end';
  G.endKind = 'busted';
  G.player.cash = Math.max(0, G.player.cash - 200);
  audio.busted();
};
G.onKill = (ped) => onMissionKill(G);
G.missionMarker = () => missionMarker(G);
G.objectiveText = () => objectiveText(G);
G.spawnTargetCar = (x, y, modelIdx) => {
  const car = makeCar(rng, x, y, 0, modelIdx, { parked: true });
  G.cars.push(car);
  return car;
};

// Populate the streets around the player.
function populate(cx, cy) {
  G.peds = spawnPeds(city, rng, 26, cx, cy, 800);
  G.cars = [
    ...spawnTraffic(city, rng, 16, cx, cy, 900),
    ...spawnParked(city, rng, 6, cx, cy, 700),
  ];
}

populate(G.player.x, G.player.y);

function startGame(fromSave) {
  G.player = createPlayer(city.spots.plaza.x, city.spots.plaza.y);
  G.wanted = createWanted();
  G.combat = createCombat();
  G.missions = createMissionState();
  G.cops = [];
  G.explosions = [];
  G.time = 0;
  populate(G.player.x, G.player.y);
  if (fromSave) {
    const data = loadSave();
    if (data) {
      applySave(G, data);
      if (data.missionIndex < MISSIONS.length) startMission(G, data.missionIndex);
      G.missions.step = data.missionStep || 0;
      G.message('Welcome back to Azura Bay.', '#7ad87a');
    }
  } else {
    startMission(G, 0);
  }
  G.mode = 'playing';
  audio.unlock();
}

function respawnAfterEnd() {
  const p = G.player;
  p.health = p.maxHealth;
  p.hurtFlash = 0;
  p.bustTimer = 0;
  G.wanted = createWanted();
  G.cops = [];
  if (G.endKind === 'wasted') {
    p.x = city.spots.plaza.x;
    p.y = city.spots.plaza.y;
    if (p.car) { p.car = null; p.onFoot = true; }
  }
  G.mode = 'playing';
}

// ---- screenshot scenes (?shot=title|drive|chase|mission) ----
function applyShotScene() {
  if (!shot) return;
  if (shot === 'title') { G.mode = 'title'; return; }
  startGame(false);
  const p = G.player;
  if (shot === 'drive') {
    const car = G.spawnTargetCar(p.x + 60, p.y, 1);
    car.parked = false;
    p.car = car; p.onFoot = false;
    p.x = car.x; p.y = car.y;
    car.speed = 180;
    car.angle = 0;
    p.x = city.spots.neonMile.x; p.y = city.spots.neonMile.y;
    car.x = p.x; car.y = p.y;
    populate(p.x, p.y);
    // Put the stolen car back under the player after repopulating, on a road.
    const c2 = G.spawnTargetCar(p.x, p.y, 1);
    c2.parked = false;
    p.car = c2; p.onFoot = false;
    c2.x = nearestRoadCenterX(p.x);
    c2.y = nearestRoadCenterY(p.y);
    p.x = c2.x; p.y = c2.y;
    c2.speed = 170; c2.angle = Math.PI / 2;
  } else if (shot === 'chase') {
    const car = G.spawnTargetCar(p.x, p.y, 1);
    car.parked = false;
    p.car = car; p.onFoot = false;
    car.speed = 220; car.angle = 0;
    G.wanted.heat = 3.4; G.wanted.level = 3;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const cx = p.x + Math.cos(a) * 320, cy = p.y + Math.sin(a) * 320;
      const cop = makeCar(rng, cx, cy, Math.atan2(p.y - cy, p.x - cx), 1, { kind: 'cop', color: '#2a4a8a' });
      cop.topSpeed = 320;
      cop.speed = 260;
      G.cars.push(cop);
      G.cops.push({ kind: 'car', car: cop, stuck: 0 });
    }
  } else if (shot === 'mission') {
    p.x = city.spots.docks.x + 150;
    p.y = city.spots.docks.y + 60;
    populate(p.x, p.y);
  }
  G.mode = 'playing';
}

// ---- per-frame update ----
function update(dt) {
  if (G.mode === 'title') {
    if (input.hit('Enter')) startGame(false);
    else if (input.hit('KeyC') && G.hasSave) startGame(true);
    return;
  }
  if (G.mode === 'paused') {
    if (input.hit('KeyP') || input.hit('Escape')) G.mode = 'playing';
    else if (input.hit('KeyG')) saveGame(G);
    else if (input.hit('KeyR')) startGame(false);
    return;
  }
  if (G.mode === 'end') {
    if (input.hit('Enter')) respawnAfterEnd();
    return;
  }
  // Playing.
  G.time += dt;
  if (input.hit('KeyP') || input.hit('Escape')) { G.mode = 'paused'; return; }
  if (input.hit('KeyG')) saveGame(G);
  if (input.hit('KeyM')) {
    const muted = audio.toggleMute();
    G.message(muted ? 'Sound off (M to turn back on)' : 'Sound on', '#9fb3d1');
  }
  // Enter / exit cars.
  if (input.hit('KeyE')) {
    if (G.player.onFoot) {
      const car = nearestCar(G, G.player.x, G.player.y, 70);
      if (car) stealCar(G, car);
    } else {
      exitCar(G);
    }
  }
  // Shooting (mouse hold).
  if (input.mouse.down) playerShoot(G);
  // Mouse world position for aiming.
  const rect = canvas.getBoundingClientRect();
  const sx = canvas.width / Math.max(1, rect.width);
  const sy = canvas.height / Math.max(1, rect.height);
  G.input.mouse.wx = G.cam.x + input.mouse.x * sx;
  G.input.mouse.wy = G.cam.y + input.mouse.y * sy;

  if (G.player.onFoot) updatePlayerOnFoot(G, dt);
  else updatePlayerCar(G, dt);
  updatePeds(G, dt);
  updateTraffic(G, dt);
  updateWanted(G, dt);
  updateCombat(G, dt);
  updateMissions(G, dt);
  // Clinic heals on touch; gun store tops up the pistol.
  const p = G.player;
  const clinic = city.spots.clinic;
  if (Math.hypot(p.x - clinic.x, p.y - clinic.y) < 60 && p.health < p.maxHealth) {
    p.health = Math.min(p.maxHealth, p.health + 30 * dt);
  }
}

// ---- rendering ----
const SERVICE_ICONS = [
  { key: 'clinic', label: 'Clinic', color: '#4ad86a', glyph: '+' },
  { key: 'gunstore', label: 'Iron & Lead', color: '#e8a13a', glyph: '◉' },
  { key: 'garage', label: "Vega's Garage", color: '#4a8aff', glyph: '⚙' },
  { key: 'bank', label: 'Bank', color: '#ffd23a', glyph: '$' },
  { key: 'docks', label: 'Docks', color: '#7ad8d8', glyph: '⚓' },
  { key: 'boat', label: 'Boat', color: '#ff7a3a', glyph: '⛵' },
];

function drawServiceIcons(ctx, cam) {
  ctx.textAlign = 'center';
  for (const s of SERVICE_ICONS) {
    const spot = city.spots[s.key];
    if (!spot) continue;
    if (spot.x < cam.x - 40 || spot.x > cam.x + cam.w + 40 || spot.y < cam.y - 40 || spot.y > cam.y + cam.h + 40) continue;
    const pulse = 1 + Math.sin(G.time * 3) * 0.08;
    ctx.fillStyle = s.color;
    ctx.beginPath();
    ctx.arc(spot.x, spot.y, 13 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#101018';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(s.glyph, spot.x, spot.y + 5);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '11px sans-serif';
    ctx.fillText(s.label, spot.x, spot.y + 28);
  }
  ctx.textAlign = 'left';
}

function drawMarker(ctx) {
  const marker = missionMarker(G);
  if (!marker) return;
  const pulse = 1 + Math.sin(G.time * 5) * 0.15;
  ctx.strokeStyle = '#ffd23a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(marker.x, marker.y, 34 * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,210,58,0.18)';
  ctx.beginPath();
  ctx.arc(marker.x, marker.y, 34 * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffd23a';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(marker.label, marker.x, marker.y - 44);
  ctx.textAlign = 'left';
}

function render() {
  const vw = canvas.width, vh = canvas.height;
  const p = G.player;
  if (G.mode === 'title') {
    // Slow pan over the city behind the title.
    const tx = (Math.sin(G.time * 0.05) * 0.5 + 0.5) * (WORLD - vw);
    const ty = WORLD * 0.3 + Math.sin(G.time * 0.03) * 200;
    const cam = { x: tx, y: Math.max(0, ty), w: vw, h: vh };
    ctx.save();
    ctx.translate(-cam.x, -cam.y);
    drawCity(ctx, city, cam);
    ctx.restore();
    drawTitle(ctx, G, vw, vh);
    return;
  }
  const cam = {
    x: Math.max(0, Math.min(WORLD - vw, p.x - vw / 2)),
    y: Math.max(0, Math.min(WORLD - vh, p.y - vh / 2)),
    w: vw, h: vh,
  };
  G.cam = cam;
  ctx.save();
  ctx.translate(-cam.x, -cam.y);
  drawCity(ctx, city, cam);
  drawServiceIcons(ctx, cam);
  drawMarker(ctx);
  // Cars, low to high so nearer ones overlap.
  const civCars = G.cars.filter((c) => c.kind !== 'cop').sort((a, b) => a.y - b.y);
  for (const car of civCars) drawCar(ctx, car, G.time);
  drawCops(ctx, G);
  const copPeds = new Set(G.cops.filter((c) => c.kind === 'foot').map((c) => c.ped));
  for (const ped of G.peds) {
    if (copPeds.has(ped)) continue;
    if (ped.state === 'dead') {
      ctx.fillStyle = '#5a3a3a';
      ctx.beginPath();
      ctx.ellipse(ped.x, ped.y, 12, 7, ped.angle, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    drawPerson(ctx, ped.x, ped.y, ped.angle, ped.color, ped.shirt, ped.walkCycle, 1);
  }
  if (p.onFoot) drawPlayer(ctx, G);
  drawCombat(ctx, G);
  ctx.restore();
  drawObjectiveArrow(ctx, G, vw, vh, cam);
  drawHud(ctx, G, vw, vh);
  if (G.mode === 'paused') drawPause(ctx, vw, vh);
  if (G.mode === 'end') drawEnd(ctx, G, vw, vh, G.endKind);
  // Hurt vignette.
  if (p.hurtFlash > 0) {
    ctx.fillStyle = `rgba(255,30,30,${p.hurtFlash * 0.5})`;
    ctx.fillRect(0, 0, vw, vh);
  }
}

// ---- main loop ----
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  G.time += G.mode === 'title' ? dt : 0;
  update(dt);
  render();
  G.frames++;
  if (G.frames === 5) {
    window.__shotReady = true;
    if (statusEl) statusEl.textContent = `Azura Bay — ${G.mode} — $${G.player.cash} — wanted ${G.wanted.level}`;
  }
  input.endFrame();
  requestAnimationFrame(frame);
}

G.cam = { x: 0, y: 0, w: canvas.width, h: canvas.height };
applyShotScene();
if (!shot) G.mode = 'title';
requestAnimationFrame(frame);

// Debug / playtest handle.
window.__azuraBay = {
  state() {
    const p = G.player;
    return {
      mode: G.mode, x: Math.round(p.x), y: Math.round(p.y),
      cash: p.cash, health: Math.round(p.health),
      wanted: G.wanted.level, mission: G.missions.index, missionStep: G.missions.step,
      missionDone: G.missions.done, inCar: !p.onFoot,
      cars: G.cars.length, peds: G.peds.length, cops: G.cops.length,
      kills: G.combat.kills, time: Math.round(G.time),
    };
  },
  G,
};
