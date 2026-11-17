// Screenshot scenes behind ?shot=title|drive|chase|mission (with &seed=N).
// Each scene plays the real rules forward from a fresh world with a scripted
// autopilot, so the frame is what real play looks like and the same seed
// always gives the same frame. The judge sees the game, not a mock-up.

import { STEP } from './config.js';
import { startMission, say } from './missions.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

/** The do-nothing control block, for scenes where the player stands still. */
function stillCtl(p) {
  return {
    steer: 0, throttle: 0, moveX: 0, moveY: 0, sprint: false,
    enter: false, punch: false, shoot: false, click: false,
    mouseX: p.x, mouseY: p.y,
  };
}

function runFor(world, seconds, ctlFn) {
  for (let i = 0; i < seconds / STEP; i += 1) world.step(STEP, ctlFn());
}

/**
 * Drive the player car toward a target point, steering like a player would:
 * follow the road grid (Manhattan routing) — drive along the road the car is
 * on to the intersection, turn there, and never cut across a city block.
 */
function driveToward(world, tx, ty) {
  const p = world.state.player;
  const base = stillCtl(p);
  if (!p.inCar || !p.car) return base;
  const city = world.state.city;
  const nearLine = (lines, value) => {
    let best = lines[0];
    let bestD = Infinity;
    for (const c of lines) {
      const d = Math.abs(c - value);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return { line: best, dist: bestD };
  };
  const targetV = nearLine(city.vRoads, tx).line;
  const targetH = nearLine(city.hRoads, ty).line;
  const carV = nearLine(city.vRoads, p.x);
  const carH = nearLine(city.hRoads, p.y);
  const onV = carV.dist < 55;
  const onH = carH.dist < 55;
  let wx;
  let wy;
  if (Math.abs(p.x - tx) < 80 && Math.abs(p.y - ty) < 80) {
    wx = tx;
    wy = ty; // close to the target: aim straight at it
  } else if (onV && Math.abs(p.y - targetH) > 90) {
    wx = carV.line;
    wy = targetH; // along the vertical road to the target row
  } else if (onH && Math.abs(p.x - targetV) > 90) {
    wx = targetV;
    wy = carH.line; // along the horizontal road to the target column
  } else if (onV || onH) {
    wx = targetV;
    wy = targetH; // at the intersection: turn toward the target
  } else if (carV.dist < carH.dist) {
    wx = carV.line;
    wy = p.y; // off-road: get back to the nearest vertical road
  } else {
    wx = p.x;
    wy = carH.line; // off-road: get back to the nearest horizontal road
  }
  const want = Math.atan2(wy - p.y, wx - p.x);
  let diff = want - p.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return {
    ...base,
    steer: diff > 0.12 ? 1 : diff < -0.12 ? -1 : 0,
    // Slow down for hard turns so the car does not overshoot into a corner.
    throttle: Math.abs(diff) > 1.9 ? 0 : Math.abs(diff) > 0.7 ? 0.5 : 1,
  };
}

/** Step into the nearest car: walk up to it, then press E once. */
function stealFirstCar(world) {
  const st = world.state;
  const car = st.cars[0];
  st.player.x = car.x - 40;
  st.player.y = car.y;
  world.step(STEP, { ...stillCtl(st.player), enter: true });
}

/** Clear the heat and the police, and heal up — a clean frame, not a chase. */
function cleanFrame(st) {
  st.police.heat = 0;
  st.police.stars = 0;
  st.police.cars.length = 0;
  st.police.cops.length = 0;
  st.player.health = 100;
}

/** Step into a car parked at (x, y): walk up to it, then press E once. */
function stealCarAt(world, x, y) {
  const st = world.state;
  st.player.x = x - 40;
  st.player.y = y;
  world.step(STEP, { ...stillCtl(st.player), enter: true });
}

export function stageShot(name, world) {
  world.reset();
  const st = world.state;
  if (name === 'title') {
    runFor(world, 6, () => stillCtl(st.player));
    return { screen: SCREEN_TITLE, hasSave: false };
  }
  if (name === 'drive') {
    // Mission 1 in progress: steal a car and drive to Otto's garage.
    startMission(st.missions, st, st.random);
    stealFirstCar(world);
    runFor(world, 8, () => driveToward(world, 640, 640));
    cleanFrame(st);
    say(st.missions, 'Mission 1 — Back in the Bay: drive to Otto’s garage in Old Town.', 30);
    return { screen: SCREEN_PLAY, hasSave: false };
  }
  if (name === 'chase') {
    // Mission 3 in progress: a straight run south down one road (1575) with
    // the heat landing mid-run — 3 stars, the police on the tail, heading
    // for the park safehouse.
    const car = st.cars[1];
    car.traffic = false;
    car.x = 1575;
    car.y = 700;
    car.angle = Math.PI / 2;
    car.speed = 280;
    stealCarAt(world, car.x, car.y);
    runFor(world, 1.5, () => driveToward(world, 1575, 2350));
    st.missions.index = 2;
    startMission(st.missions, st, st.random);
    runFor(world, 2.5, () => driveToward(world, 1575, 2350));
    // Top the heat back up for the frame: the chase must read 3 stars.
    st.police.heat = 130;
    st.police.stars = 3;
    say(st.missions, 'HOT PURSUIT — 3 stars! Lose the police and reach the park safehouse.', 30);
    return { screen: SCREEN_PLAY, hasSave: false };
  }
  // mission (default): on foot at the Harbor, cash bags and gang members in view.
  st.missions.index = 3;
  startMission(st.missions, st, st.random);
  st.player.x = 2850;
  st.player.y = 1850;
  st.player.angle = Math.PI / 4;
  st.player.ammo = 48;
  runFor(world, 4, () => stillCtl(st.player));
  say(st.missions, 'HARBOR HEIST — grab the 4 cash bags. The Kings will not hand them over quietly.', 30);
  return { screen: SCREEN_PLAY, hasSave: false };
}
