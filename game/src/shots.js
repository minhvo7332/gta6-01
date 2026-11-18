// Screenshot staging: when the page is opened with ?shot=...&seed=...,
// the game jumps deterministically into a staged scene instead of the
// title screen, so screenshots are repeatable. The seed fixes the RNG,
// so repeated loads of the same URL look identical.
import { enterCar, nearestParkedCar } from './vehicles.js';
import { startMission } from './missions.js';
import { setWanted } from './player.js';
import { makePoliceCar } from './people.js';
import { nearestRoadPoint } from './city.js';

export function parseShotParams() {
  const q = new URLSearchParams(window.location.search);
  const shot = q.get('shot');
  const seedRaw = Number.parseInt(q.get('seed') || '7', 10);
  const seed = Number.isFinite(seedRaw) ? seedRaw : 7;
  return { shot, seed };
}

// Put a few traffic cars around a point so drive/chase shots feel busy.
function stageTrafficNear(state, x, y) {
  const rng = state.rng;
  for (let i = 0; i < 3; i += 1) {
    const car = state.vehicles.traffic[i % state.vehicles.traffic.length];
    if (!car) continue;
    car.x = x + rng.range(-260, 260);
    car.y = y + rng.range(-200, 200);
    car.speed = car.targetSpeed;
  }
}

export function applyShot(state, shot) {
  const { player, vehicles, people, missions, sound } = state;
  if (!shot) return false;

  if (shot === 'start') {
    state.screen = 'title';
    player.x = 1600;
    player.y = 640;
    state.camera.x = 1600;
    state.camera.y = 640;
    return true;
  }

  // Every other shot plays the game with the HUD and minimap visible.
  state.screen = 'playing';
  state.shotMode = true;

  if (shot === 'drive') {
    const car = nearestParkedCar(vehicles, 1600, 640, 900) || vehicles.parked[0];
    if (car) {
      enterCar(player, car, vehicles);
      // Snap onto the road centre heading east so the shot shows driving,
      // not a parked car nosed into a building.
      const rp = nearestRoadPoint(1200, 960);
      car.x = rp.x;
      car.y = rp.y;
      car.angle = 0;
      car.speed = 240;
      player.x = car.x;
      player.y = car.y;
    } else {
      player.x = 1600;
      player.y = 640;
    }
    stageTrafficNear(state, player.x, player.y);
    state.camera.x = player.x;
    state.camera.y = player.y;
    return true;
  }

  if (shot === 'chase') {
    const car = nearestParkedCar(vehicles, 1600, 640, 900) || vehicles.parked[0];
    if (car) {
      enterCar(player, car, vehicles);
      const rp = nearestRoadPoint(1400, 640);
      car.x = rp.x;
      car.y = rp.y;
      car.angle = 0;
      car.speed = 300;
      player.x = car.x;
      player.y = car.y;
    }
    setWanted(player, 3, null);
    // Police cars close behind on the same road, sirens on.
    const px = player.x;
    const py = player.y;
    people.policeCars.push(makePoliceCar(px - 260, py + 13, 0));
    people.policeCars.push(makePoliceCar(px - 180, py - 13, 0));
    people.policeCars[0].speed = 300;
    people.policeCars[1].speed = 280;
    // Staged pursuit cars trail the player instead of pinning the car.
    people.policeCars[0].targetSpeed = 250;
    people.policeCars[1].targetSpeed = 250;
    stageTrafficNear(state, px, py);
    missions.currentLine = 'DETECTIVE VOSS: Marlow! The whole bay is looking for you now.';
    state.camera.x = px;
    state.camera.y = py;
    return true;
  }

  if (shot === 'mission') {
    missions.completed = 1;
    startMission(missions, player, null);
    // Start the player driving west on a road toward the marina.
    player.x = 1100;
    player.y = 1760;
    const car = nearestParkedCar(vehicles, player.x, player.y, 900) || vehicles.parked[0];
    if (car) {
      enterCar(player, car, vehicles);
      const rp = nearestRoadPoint(player.x, player.y);
      car.x = rp.x;
      car.y = rp.y;
      car.angle = Math.PI;
      car.speed = 200;
      player.x = car.x;
      player.y = car.y;
    }
    stageTrafficNear(state, player.x, player.y);
    state.camera.x = player.x;
    state.camera.y = player.y;
    return true;
  }

  return false;
}
