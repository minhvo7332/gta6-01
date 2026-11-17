// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps, and the renderer paints what is there. Screens: title, play,
// paused, busted, wasted, story-complete.
// ?seed=N fixes the city. ?shot=title|drive|chase|mission (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import { STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BUSTED, EVENT_WASTED, EVENT_MISSION_DONE } from './world.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_HORN, ACTION_JOB, ACTION_MUTE, ACTION_PAUSE, ACTION_PUNCH, ACTION_SAVE, createInput } from './input.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_DONE, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WASTED } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';
import { saveGame, loadGame, hasSave, saveSummary } from './save.js';
import { currentMission } from './missions.js';
import { nearestCar } from './vehicles.js';

const MAX_FRAME = 0.25;
const BAIL = 200;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const audio = createAudio();
const world = createWorld(createRandom(seed), audio);
const renderer = createRenderer(canvas);

function announce(message) {
  status.textContent = message;
}

/** Screenshot mode: stage the scene, paint it twice, flag readiness. */
function runShot(name) {
  const scene = stageShot(name, world);
  // Debug handle for the screenshot harness (read-only inspection).
  window.__world = world;
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, { hasSave: scene.hasSave });
    painted += 1;
    if (painted >= 2) window.__shotReady = true;
  }
  // Paint at once (a screenshot tool may capture before the first animation
  // frame), again on the next frame, and again after any resize — resizing a
  // canvas wipes it, so a shot must survive a viewport change.
  paint();
  requestAnimationFrame(paint);
  window.addEventListener('resize', paint);
}

function runGame() {
  // Debug handle for play-testing (read-only inspection).
  window.__world = world;
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();
  // One-shot presses handleActions reads but step() must act on: queued here.
  let pendingEnter = false;
  let pendingPunch = false;

  function startNewGame() {
    world.reset();
    screen = SCREEN_PLAY;
    announce('Solara Bay. Mara Voss is back. Steal a car — press E near one.');
  }

  /** Apply a loaded save onto a fresh world, then start playing. */
  function applySave(data) {
    const s = world.state;
    s.cash = data.cash;
    s.missions.index = Math.min(data.missionIndex, 5);
    s.missions.completedCount = data.completedCount;
    s.player.health = data.health;
    s.player.ammo = data.ammo;
    s.player.x = data.x;
    s.player.y = data.y;
    s.player.angle = data.angle;
    s.camera.x = data.x;
    s.camera.y = data.y;
  }

  function continueGame() {
    const data = loadGame();
    if (!data) {
      startNewGame();
      return;
    }
    world.reset();
    applySave(data);
    screen = SCREEN_PLAY;
    announce(`Welcome back to Solara Bay. Cash $${world.state.cash}.`);
  }

  function doSave() {
    const ok = saveGame(world);
    announce(ok ? 'Game saved.' : 'Save failed — storage is off.');
  }

  /** The player was arrested: bail, cool the heat, hand Mara back her health. */
  function endBusted() {
    const s = world.state;
    screen = SCREEN_BUSTED;
    s.cash = Math.max(0, s.cash - BAIL);
    s.police.heat = 0;
    s.police.stars = 0;
    s.police.cars.length = 0;
    s.police.cops.length = 0;
    if (s.player.inCar) {
      s.player.car.isPlayer = false;
      s.player.inCar = false;
      s.player.car = null;
    }
    s.player.health = 100;
    audio.busted();
    announce('Busted. $200 bail. The heat cools off.');
  }

  /** The player went down: the hospital patches Mara up at Otto's garage. */
  function endWasted() {
    const s = world.state;
    screen = SCREEN_WASTED;
    s.player.health = 100;
    s.player.x = 640;
    s.player.y = 640;
    if (s.player.car) s.player.car.isPlayer = false;
    s.player.inCar = false;
    s.player.car = null;
    s.police.heat = 0;
    s.police.stars = 0;
    announce('Wasted. The hospital patches Mara up.');
  }

  /** One frame's one-shot presses, routed by the screen they land on. */
  function handleActions() {
    const { flags, clicked } = input.takeActions();
    if (flags & ACTION_ENTER) pendingEnter = true;
    if (flags & ACTION_PUNCH) pendingPunch = true;
    if (flags & ACTION_MUTE) {
      announce(audio.toggleMute() ? 'Sound off.' : 'Sound on.');
    }
    if (flags & ACTION_HORN && screen === SCREEN_PLAY && world.state.player.inCar) {
      audio.horn();
    }
    if (flags & ACTION_SAVE && screen === SCREEN_PLAY) doSave();
    if (flags & ACTION_JOB && screen === SCREEN_PLAY) {
      if (!world.tryStartMission()) world.startSideJob();
    }
    if (screen === SCREEN_TITLE) {
      if (flags & ACTION_CONFIRM || clicked) {
        audio.unlock();
        if (hasSave()) continueGame();
        else startNewGame();
      }
      return;
    }
    if (screen === SCREEN_PLAY) {
      if (flags & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      }
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (flags & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    if (screen === SCREEN_BUSTED || screen === SCREEN_WASTED || screen === SCREEN_DONE) {
      if (flags & ACTION_CONFIRM || clicked) {
        screen = SCREEN_PLAY;
        announce('Back in Solara Bay.');
      }
    }
  }

  /** Build this step's control block from the keyboard and the mouse. */
  function controlFromInput() {
    const p = world.state.player;
    const cam = world.state.camera;
    // Mouse position in world coordinates, for aiming the pistol: the renderer
    // scales the 1280x720 logical view to the canvas, so undo that transform.
    const ratio = window.devicePixelRatio || 1;
    const scale = Math.min(canvas.width / 1280, canvas.height / 720);
    const offX = (canvas.width - 1280 * scale) / 2;
    const offY = (canvas.height - 720 * scale) / 2;
    const logicalX = (input.mouse.x * ratio - offX) / scale;
    const logicalY = (input.mouse.y * ratio - offY) / scale;
    return {
      moveX: input.moveX(),
      moveY: input.moveY(),
      steer: input.steer(),
      throttle: input.throttle(),
      sprint: input.keys.sprint,
      shoot: input.keys.shoot,
      click: input.mouse.down,
      mouseX: cam.x - 640 + logicalX,
      mouseY: cam.y - 360 + logicalY,
      enter: false,
      punch: false,
    };
  }

  /** One fixed step, plus the screen changes its events cause. */
  function step() {
    const ctl = controlFromInput();
    ctl.enter = pendingEnter;
    ctl.punch = pendingPunch;
    pendingEnter = false;
    pendingPunch = false;
    if (screen === SCREEN_TITLE) {
      // The city lives behind the title screen.
      const idle = { ...ctl, enter: false, punch: false, shoot: false, click: false, moveX: 0, moveY: 0, throttle: 0, steer: 0 };
      world.step(STEP, idle);
      return;
    }
    // "Press E" hint: the nearest stealable car, for the renderer.
    world.state.nearCar = world.state.player.inCar
      ? null
      : nearestCar(world.state.cars, world.state.player.x, world.state.player.y);
    const events = world.step(STEP, ctl);
    if (events & EVENT_BUSTED) endBusted();
    else if (events & EVENT_WASTED) endWasted();
    else if (events & EVENT_MISSION_DONE && !currentMission(world.state.missions)) {
      screen = SCREEN_DONE;
      announce('Story complete — Solara Bay is yours.');
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, { hasSave: hasSave(), saveSummary: saveSummary() });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Solara Bay. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
