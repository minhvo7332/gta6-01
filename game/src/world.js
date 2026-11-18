// The world: one state object and one fixed step that wires every system
// together — the city, the player on foot and in a car, traffic, pedestrians,
// the police, missions, combat and pickups. No drawing and no browser calls
// in here.

import { CAR, PLAYER, POLICE_RAM_DAMAGE, START_CASH, STEP, WORLD, WANTED } from './config.js';
import { buildCity, collideBuildings, districtAt, randomRoadPoint } from './city.js';
import { spawnTraffic, stepTraffic, stepPlayerCar, nearestCar } from './vehicles.js';
import { spawnPeds, stepPeds } from './people.js';
import { createPolice, stepPolice, addHeat, wantedStars } from './police.js';
import {
  createMissionState, stepMissions, stepSideJob, tryStartMission, startSideJob,
} from './missions.js';
import { createCombat, stepBullets, tryPunch, tryShoot, enemyShoot, spawnPickups, stepPickups } from './combat.js';
import { clamp, distance } from './random.js';

export const EVENT_BUSTED = 1;
export const EVENT_WASTED = 2;
export const EVENT_CRASH = 4;
export const EVENT_MISSION_DONE = 8;
export const EVENT_MISSION_FAIL = 16;
export const EVENT_STEAL = 32;

const HOME_X = 640;
const HOME_Y = 640;
const DAY_START_MINUTES = 9 * 60 + 20; // 09:20 — a sun-soaked morning in Solara Bay
const CRASH_DAMAGE = 6;
const MIN_ALIVE_PEDS = 24;
const RESPAWN_DIST = 1500;
const TRAFFIC_RESPAWN_DIST = 1600;

export function createWorld(random, audio) {
  const city = buildCity(random);
  const state = {
    random,
    audio: audio || null,
    city,
    player: {
      x: HOME_X,
      y: HOME_Y,
      angle: -Math.PI / 2,
      r: PLAYER.radius,
      health: PLAYER.health,
      ammo: PLAYER.startAmmo,
      inCar: false,
      car: null,
      carSpeed: 0,
      danger: 0,
      nearCarSpeed: 0,
      nearCarX: HOME_X,
      nearCarY: HOME_Y,
    },
    cars: spawnTraffic(city, random, 26),
    peds: spawnPeds(city, random, 42),
    police: createPolice(),
    missions: createMissionState(),
    combat: createCombat(),
    pickups: spawnPickups(random, 18),
    cash: START_CASH,
    elapsed: 0,
    dayMinutes: DAY_START_MINUTES,
    camera: { x: HOME_X, y: HOME_Y },
    stats: { carsStolen: 0, missionsDone: 0, distanceDriven: 0 },
    district: 'Old Town',
    nearCar: null,
  };

  function reset() {
    // Rebuild every field of this same state object from a fresh world, so
    // holders of the old reference (the renderer, the loop) keep working.
    const fresh = createWorld(random, audio);
    for (const key of Object.keys(state)) delete state[key];
    Object.assign(state, fresh.state);
  }

  /** Steal the nearest car, or step out of the one being driven. */
  function tryEnterCar(ctl) {
    const p = state.player;
    if (!ctl.enter) return 0;
    if (!p.inCar) {
      const car = nearestCar(state.cars, p.x, p.y);
      if (!car) return 0;
      car.traffic = false;
      car.isPlayer = true;
      p.inCar = true;
      p.car = car;
      p.carSpeed = 0;
      state.stats.carsStolen += 1;
      addHeat(state.police, WANTED.stealHeat);
      if (state.audio) state.audio.crash();
      return EVENT_STEAL;
    }
    if (!p.car) return 0;
    const car = p.car;
    car.isPlayer = false;
    p.inCar = false;
    p.car = null;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 44;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 44;
    p.angle = car.angle;
    car.speed = 0;
    return 0;
  }

  /** Drive the stolen car; returns EVENT_CRASH when it hits a building hard. */
  function driveCar(ctl, dt) {
    const p = state.player;
    const car = p.car;
    const crashed = stepPlayerCar(car, ctl.steer, ctl.throttle, dt, state.city);
    let events = 0;
    if (crashed) {
      events |= EVENT_CRASH;
      p.health = Math.max(0, p.health - CRASH_DAMAGE);
      if (state.audio) state.audio.crash();
    }
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    p.carSpeed = car.speed;
    state.stats.distanceDriven += Math.abs(car.speed) * dt;
    if (Math.abs(car.speed) > 120) p.danger = 0.5;
    // Running over a pedestrian in a car is a crime.
    for (const ped of state.peds) {
      if (ped.dead) continue;
      if (distance(p.x, p.y, ped.x, ped.y) < 34 && Math.abs(car.speed) > 150) {
        ped.dead = true;
        addHeat(state.police, WANTED.hitPedHeat);
        if (state.audio) state.audio.crash();
      }
    }
    return events;
  }

  /** Walk, punch and shoot on foot. */
  function walkOnFoot(ctl, dt) {
    const p = state.player;
    p.carSpeed = 0;
    const speed = ctl.sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
    const mx = ctl.moveX;
    const my = ctl.moveY;
    const len = Math.hypot(mx, my);
    if (len > 0) {
      p.x += (mx / len) * speed * dt;
      p.y += (my / len) * speed * dt;
      p.angle = Math.atan2(my, mx);
    }
    p.x = clamp(p.x, 30, WORLD.width - 30);
    p.y = clamp(p.y, 30, WORLD.height - 30);
    const body = { x: p.x, y: p.y, r: p.r };
    if (collideBuildings(state.city, body)) {
      p.x = body.x;
      p.y = body.y;
    }
    if (ctl.punch) tryPunch(state.combat, state, state.audio);
    if (ctl.shoot || ctl.click) {
      tryShoot(state.combat, state, state.audio, ctl.mouseX, ctl.mouseY);
    }
    if (ctl.shoot) p.danger = 0.5;
  }

  /** Bump traffic cars, and find the fastest one near the player (peds flee it). */
  function scanNearbyTraffic() {
    const p = state.player;
    if (p.inCar && p.car) {
      for (const car of state.cars) {
        if (car === p.car || !car.traffic) continue;
        if (distance(p.car.x, p.car.y, car.x, car.y) < 56) {
          p.car.speed *= 0.94;
          car.speed *= 0.8;
        }
      }
    }
    let fastest = 0;
    let fx = p.x;
    let fy = p.y;
    for (const car of state.cars) {
      if (!car.traffic) continue;
      const d = distance(car.x, car.y, p.x, p.y);
      if (d < 400 && Math.abs(car.speed) > fastest) {
        fastest = Math.abs(car.speed);
        fx = car.x;
        fy = car.y;
      }
    }
    p.nearCarSpeed = fastest;
    p.nearCarX = fx;
    p.nearCarY = fy;
  }

  /** Keep the streets alive near the player: respawn far traffic, far peds,
   * and replace dead peds so the city never empties out. */
  function repopulateStreets() {
    const p = state.player;
    for (const car of state.cars) {
      if (!car.traffic) continue;
      if (distance(car.x, car.y, p.x, p.y) <= TRAFFIC_RESPAWN_DIST) continue;
      const pt = randomRoadPoint(state.city, random);
      car.x = clamp(p.x + (pt.x - p.x) * 0.4, 60, WORLD.width - 60);
      car.y = clamp(p.y + (pt.y - p.y) * 0.4, 60, WORLD.height - 60);
    }
    for (const ped of state.peds) {
      if (ped.dead) continue;
      if (distance(ped.x, ped.y, p.x, p.y) <= RESPAWN_DIST) continue;
      const pt = randomRoadPoint(state.city, random);
      ped.x = clamp(p.x + (pt.x - p.x) * 0.3, 60, WORLD.width - 60);
      ped.y = clamp(p.y + (pt.y - p.y) * 0.3, 60, WORLD.height - 60);
    }
    const alive = state.peds.filter((ped) => !ped.dead).length;
    if (alive < MIN_ALIVE_PEDS) {
      const fresh = spawnPeds(state.city, random, 1)[0];
      fresh.x = clamp(p.x + random.range(-600, 600), 60, WORLD.width - 60);
      fresh.y = clamp(p.y + random.range(-600, 600), 60, WORLD.height - 60);
      state.peds.push(fresh);
    }
  }

  function followPlayer(dt) {
    const p = state.player;
    state.district = districtAt(p.x, p.y);
    const targetX = clamp(p.x, 640, WORLD.width - 640);
    const targetY = clamp(p.y, 360, WORLD.height - 360);
    const ease = Math.min(1, dt * 4);
    state.camera.x += (targetX - state.camera.x) * ease;
    state.camera.y += (targetY - state.camera.y) * ease;
  }

  function step(dt, ctl) {
    let events = 0;
    const p = state.player;
    state.elapsed += dt;
    state.dayMinutes = (DAY_START_MINUTES + state.elapsed / 60) % (24 * 60);
    if (p.danger > 0) p.danger -= dt;

    events |= tryEnterCar(ctl);
    if (p.inCar && p.car) events |= driveCar(ctl, dt);
    else walkOnFoot(ctl, dt);

    // Traffic, pedestrians, police.
    stepTraffic(state.cars, state.city, dt, random);
    scanNearbyTraffic();
    stepPeds(state.peds, state.city, p, dt, random);
    // Gang enemies from the active mission also walk and shoot.
    if (state.missions.enemies.length) {
      stepPeds(state.missions.enemies, state.city, p, dt, random);
      enemyShoot(state.combat, state, dt);
    }
    const policeResult = stepPolice(state.police, state.city, p, dt, random, state.audio);
    if (policeResult.rammed) {
      p.health = Math.max(0, p.health - POLICE_RAM_DAMAGE);
      if (state.audio) state.audio.crash();
    }
    if (policeResult.arrested) events |= EVENT_BUSTED;

    // Combat, pickups, missions.
    stepBullets(state.combat, state, dt);
    stepPickups(state.pickups, state, dt, state.audio);
    const missionResult = stepMissions(state.missions, state, dt, random);
    if (missionResult === 'done') {
      events |= EVENT_MISSION_DONE;
      state.stats.missionsDone += 1;
    }
    if (missionResult === 'failed') events |= EVENT_MISSION_FAIL;
    stepSideJob(state.missions, state, dt);

    repopulateStreets();
    followPlayer(dt);

    if (p.health <= 0) events |= EVENT_WASTED;
    return events;
  }

  return {
    state,
    reset,
    step,
    tryStartMission: () => tryStartMission(state.missions, state, random),
    startSideJob: () => startSideJob(state.missions, state, random),
  };
}

export { wantedStars };
export { STEP };
