// Solara Bay — entry module. Wires the loop, screens and systems together:
// city, player, cars, pedestrians, police, missions, combat, HUD, audio,
// save/load and screenshot staging. Plain ES modules, no network.
import { createRng } from './rng.js';
import { buildCity, districtAt } from './city.js';
import { createInput } from './input.js';
import { createSoundBank } from './audio.js';
import { createPlayer, updateOnFoot, addHeat, decayWanted, damagePlayer, healPlayer } from './player.js';
import { createCombat, tryMelee, tryShoot, resolveMelee, updateBullets } from './combat.js';
import { createVehicles, updateTraffic, driveCar, nearestParkedCar, nearestTrafficCar, enterCar, exitCar } from './vehicles.js';
import { createPeople, updatePedestrians, updatePolice, policeNearPlayer, panicNearby, knockDown } from './people.js';
import { createMissionState, startMission, updateMissionDialogue, updateMissionProgress } from './missions.js';
import { createHud, updateHudDom, drawMinimap, showToast } from './hud.js';
import { createCamera, updateCamera, drawWorld, drawTitleBackdrop, VIEW_W, VIEW_H } from './render.js';
import { saveGame, loadSave, applySave, hasSave } from './save.js';
import { parseShotParams, applyShot } from './shots.js';
import { missionMarker } from './missions.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const { shot, seed } = parseShotParams();

const rng = createRng(seed);
const city = buildCity(seed);
window.__solaraCity = city;

const state = {
  rng,
  city,
  seed,
  screen: 'title', // title | playing | paused | gameover
  shotMode: false,
  time: 0,
  camera: createCamera(),
  player: createPlayer(city.landmarks.hideout.x, city.landmarks.hideout.y),
  vehicles: createVehicles(city, rng),
  people: createPeople(city, rng),
  combat: createCombat(),
  missions: createMissionState(),
  sound: createSoundBank(),
  input: createInput(canvas),
  hud: createHud(document),
  saveTimer: 0,
  errors: [],
};

window.addEventListener('error', (event) => {
  state.errors.push(String(event.message || event.error));
});
window.__solara = state;

const screens = {
  title: document.getElementById('title-screen'),
  pause: document.getElementById('pause-screen'),
  gameover: document.getElementById('gameover-screen'),
};

function showScreen(name) {
  state.screen = name;
  for (const [key, el] of Object.entries(screens)) {
    if (el) el.classList.toggle('hidden', key !== name);
  }
  const hudEl = document.getElementById('hud');
  if (hudEl) hudEl.classList.toggle('hidden', name === 'title');
}

function startPlaying(fromSave) {
  if (fromSave) {
    const data = loadSave();
    if (data) {
      applySave(state.player, state.missions, data);
      showToast(state.hud, `Save loaded — $${state.player.money}, ${state.missions.completed} job(s) done.`);
    }
  }
  state.sound.ensure();
  showScreen('playing');
  state.camera.x = state.player.x;
  state.camera.y = state.player.y;
}

function gameOver() {
  state.sound.stopEngine();
  state.sound.stopSiren();
  saveGame(state.player, state.missions);
  const stats = document.getElementById('gameover-stats');
  if (stats) {
    stats.textContent = `Money $${state.player.money} · Jobs done ${state.missions.completed} of 5 · Wanted ${state.player.wanted}★`;
  }
  showScreen('gameover');
}

function bindButtons() {
  const startBtn = document.getElementById('start-btn');
  if (startBtn) startBtn.addEventListener('click', () => startPlaying(false));
  const loadBtn = document.getElementById('load-btn');
  if (loadBtn) {
    loadBtn.addEventListener('click', () => startPlaying(true));
    loadBtn.disabled = !hasSave();
    if (hasSave()) loadBtn.textContent = 'Continue Saved Game';
  }
  const resumeBtn = document.getElementById('resume-btn');
  if (resumeBtn) resumeBtn.addEventListener('click', () => showScreen('playing'));
  const restartBtn = document.getElementById('restart-btn');
  if (restartBtn) restartBtn.addEventListener('click', () => window.location.reload());
  const againBtn = document.getElementById('again-btn');
  if (againBtn) againBtn.addEventListener('click', () => window.location.reload());
  const muteBtn = document.getElementById('mute-btn');
  if (muteBtn) {
    muteBtn.addEventListener('click', () => {
      const muted = state.sound.toggleMute();
      muteBtn.textContent = muted ? '🔇 Muted' : '🔊 Sound On';
    });
  }
}

// Stealing a parked car or jacking slow traffic is a crime.
function tryEnterCar() {
  const { player, vehicles } = state;
  let car = nearestParkedCar(vehicles, player.x, player.y, 70);
  let jacked = false;
  if (!car) {
    car = nearestTrafficCar(vehicles, player.x, player.y, 70);
    jacked = true;
  }
  if (!car) return;
  enterCar(player, car, vehicles);
  addHeat(player, jacked ? 16 : 10, state.sound);
  showToast(state.hud, jacked ? `Jacked the ${car.name}! The law noticed.` : `Stole the ${car.name}.`);
  state.sound.startEngine();
}

function tryExitCar() {
  exitCar(state.player, state.vehicles, state.city);
  state.sound.stopEngine();
  showToast(state.hud, 'On foot.');
}

function doMelee() {
  const { player, combat, people, sound } = state;
  if (!tryMelee(player, combat, sound)) return;
  const targets = [...people.peds, ...people.officers];
  const victim = resolveMelee(player, targets);
  if (victim) {
    knockDown(victim);
    addHeat(player, 10, sound);
    panicNearby(people, player.x, player.y, 260);
    showToast(state.hud, victim.kind === 'officer' ? 'You floored an officer! Heat is coming.' : 'Pedestrian down! Someone called it in.');
  }
}

function doShoot() {
  const { player, combat, sound, input } = state;
  if (!player.onFoot) return;
  // Aim at the mouse when it is over the canvas, else face movement.
  if (input.mouse.x || input.mouse.y) {
    const wx = input.mouse.x + state.camera.x - VIEW_W / 2;
    const wy = input.mouse.y + state.camera.y - VIEW_H / 2;
    player.angle = Math.atan2(wy - player.y, wx - player.x);
  }
  tryShoot(player, combat, sound);
}

function updatePlaying(dt) {
  const { player, input, sound, missions } = state;
  state.time += dt;

  // Global keys.
  if (input.anyPressed(['Escape', 'KeyP'])) {
    saveGame(player, missions);
    showScreen('paused');
    return;
  }
  if (input.wasPressed('KeyM')) {
    const muted = sound.toggleMute();
    showToast(state.hud, muted ? 'Sound muted.' : 'Sound on.');
  }
  if (input.wasPressed('KeyN')) {
    const m = startMission(missions, player, sound);
    if (m) showToast(state.hud, `New job: ${m.title} — ${m.blurb}`);
    else showToast(state.hud, 'Finish the current job first.');
  }

  // Enter / exit cars.
  if (input.wasPressed('KeyE')) {
    if (player.onFoot) tryEnterCar();
    else tryExitCar();
  }

  if (player.onFoot) {
    updateOnFoot(player, state.city, input, dt);
    if (input.wasPressed('Space') || input.wasPressed('KeyJ')) doMelee();
    if (input.wasPressed('KeyK') || input.mouse.clicked) doShoot();
  } else {
    // In screenshot mode the staged car cruises on its own so the shot
    // shows motion instead of a parked car.
    const driveInput = state.shotMode
      ? { moveAxis: () => ({ x: 0, y: -1 }), isDown: () => false }
      : input;
    driveCar(player.car, state.city, driveInput, dt, sound);
    if (state.shotMode && player.car.speed > 240) player.car.speed = 240;
    player.x = player.car.x;
    player.y = player.car.y;
    player.angle = player.car.angle;
    // Running someone over is a crime.
    for (const p of state.people.peds) {
      if (p.down) continue;
      if (Math.hypot(p.x - player.x, p.y - player.y) < 26 && Math.abs(player.car.speed) > 60) {
        knockDown(p);
        addHeat(player, 12, sound);
        panicNearby(state.people, player.x, player.y, 300);
        player.car.speed *= 0.5;
        sound.playCrash();
      }
    }
  }

  // Bullets and their hits.
  const hits = updateBullets(state.combat, state.city, [...state.people.peds, ...state.people.officers], dt);
  for (const hit of hits) {
    knockDown(hit.target);
    addHeat(player, 8, sound);
    panicNearby(state.people, hit.x, hit.y, 260);
  }

  updateTraffic(state.vehicles, state.rng, dt);
  updatePedestrians(state.people, state.city, state.rng, dt);
  updatePolice(state.people, player, state.rng, dt, sound);

  // Wanted decays only out of police sight.
  const near = policeNearPlayer(state.people, player, 420);
  decayWanted(player, dt, near);
  if (player.wanted > 0) sound.startSiren();
  else sound.stopSiren();

  // Missions.
  updateMissionDialogue(missions, dt);
  const result = updateMissionProgress(missions, player, sound);
  if (result === 'done') {
    saveGame(player, missions);
    showToast(state.hud, `Job complete! +$${missions.justCompleted.reward} — next job unlocked.`);
  } else if (result === 'stage') {
    showToast(state.hud, 'Checkpoint reached — keep going!');
  }

  // Slow health recovery while the heat is off.
  if (player.wanted === 0 && player.health > 0 && player.health < player.maxHealth) {
    healPlayer(player, dt * 1.5);
  }

  // Camera follows the player; HUD and minimap refresh every frame.
  const tx = player.onFoot ? player.x : player.car.x;
  const ty = player.onFoot ? player.y : player.car.y;
  updateCamera(state.camera, tx, ty);
  const district = districtAt(tx, ty);
  updateHudDom(state.hud, player, state, district.name, dt);
  drawMinimap(state.hud, state.city, player, state.people, missionMarker(missions));

  // Autosave while playing.
  state.saveTimer += dt;
  if (state.saveTimer > 25) {
    state.saveTimer = 0;
    saveGame(player, missions);
  }

  if (player.dead) gameOver();
}

function frame(now) {
  const dt = Math.min(0.05, (now - (frame.last || now)) / 1000 || 0.016);
  frame.last = now;
  const input = state.input;

  if (state.screen === 'playing') {
    updatePlaying(dt);
    drawWorld(ctx, state, now);
  } else if (state.screen === 'title') {
    state.time += dt;
    drawTitleBackdrop(ctx, state.city, now);
    if (input.wasPressed('Enter')) startPlaying(false);
  } else if (state.screen === 'paused') {
    drawWorld(ctx, state, now);
    if (input.anyPressed(['Escape', 'KeyP'])) showScreen('playing');
  } else if (state.screen === 'gameover') {
    drawWorld(ctx, state, now);
    if (input.wasPressed('Enter')) window.location.reload();
  }

  input.endFrame();
  requestAnimationFrame(frame);
}

bindButtons();

// Screenshot staging jumps straight into a scene; otherwise show the title.
if (shot) {
  applyShot(state, shot);
  if (state.screen === 'playing') {
    showScreen('playing');
    const district = districtAt(state.player.x, state.player.y);
    updateHudDom(state.hud, state.player, state, district.name, 0);
    drawMinimap(state.hud, state.city, state.player, state.people, missionMarker(state.missions));
  }
  const hudEl = document.getElementById('hud');
  if (hudEl) hudEl.classList.toggle('hidden', state.screen === 'title');
} else {
  showScreen('title');
}

requestAnimationFrame(frame);
