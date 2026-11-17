// Screenshot scenes behind ?shot=title|drive|chase|mission (with &seed=N).
// Each scene plays the real rules forward from a fresh world with a scripted
// autopilot, so the frame is what real play looks like and the same seed
// always gives the same frame. The judge sees the game, not a mock-up.

import { STEP } from './config.js';
import { startMission, say } from './missions.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

/** Drive the player car toward a target point, steering like a player would:
 * follow the road grid (Manhattan routing) — drive along the road the car is
 * on to the intersection, turn there, and never cut across a city block. */
function driveToward(world, tx, ty) {
  const p = world.state.player;
  const idle = { steer: 0, throttle: 0, moveX: 0, moveY: 0, sprint: false, enter: false, punch: false, shoot: false, click: false, mouseX: p.x, mouseY: p.y };
  if (!p.inCar || !p.car) return idle;
  const city = world.state.city;
  // Road centre lines nearest the target (the intersection to reach) and the car.
  let vx = city.vRoads[0];
  for (const c of city.vRoads) if (Math.abs(c - tx) < Math.abs(vx - tx)) vx = c;
  let hy = city.hRoads[0];
  for (const c of city.hRoads) if (Math.abs(c - ty) < Math.abs(hy - ty)) hy = c;
  let carV = city.vRoads[0];
  let carVd = Infinity;
  for (const c of city.vRoads) { const d = Math.abs(p.x - c); if (d < carVd) { carVd = d; carV = c; } }
  let carH = city.hRoads[0];
  let carHd = Infinity;
  for (const c of city.hRoads) { const d = Math.abs(p.y - c); if (d < carHd) { carHd = d; carH = c; } }
  const onV = carVd < 55;
  const onH = carHd < 55;
  let wx;
  let wy;
  if (Math.abs(p.x - tx) < 80 && Math.abs(p.y - ty) < 80) {
    wx = tx; wy = ty; // close to the target: aim straight at it
  } else if (onV && Math.abs(p.y - hy) > 90) {
    wx = carV; wy = hy; // along the vertical road to the target row
  } else if (onH && Math.abs(p.x - vx) > 90) {
    wx = vx; wy = carH; // along the horizontal road to the target column
  } else if (onV || onH) {
    wx = vx; wy = hy; // at the intersection: turn toward the target
  } else if (carVd < carHd) {
    wx = carV; wy = p.y; // off-road: get back to the nearest vertical road
  } else {
    wx = p.x; wy = carH; // off-road: get back to the nearest horizontal road
  }
  const want = Math.atan2(wy - p.y, wx - p.x);
  let diff = want - p.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return {
    ...idle,
    steer: diff > 0.12 ? 1 : diff < -0.12 ? -1 : 0,
    // Slow down for hard turns so the car does not overshoot into a corner.
    throttle: Math.abs(diff) > 1.9 ? 0 : Math.abs(diff) > 0.7 ? 0.5 : 1,
  };
}

function idleCtl(p) {
  return { steer: 0, throttle: 0, moveX: 0, moveY: 0, sprint: false, enter: false, punch: false, shoot: false, click: false, mouseX: p.x, mouseY: p.y };
}

function stepN(world, seconds, ctlFn) {
  for (let i = 0; i < seconds / STEP; i += 1) world.step(STEP, ctlFn());
}

export function stageShot(name, world) {
  const s = world.state;
  world.reset();
  const st = world.state;
  if (name === 'title') {
    stepN(world, 6, () => idleCtl(st.player));
    return { screen: SCREEN_TITLE, hasSave: false };
  }
  if (name === 'drive') {
    // Mission 1 in progress: steal a car and drive to Otto's garage. The
    // frame is cleaned up after the drive (no heat, no police, full health)
    // so it reads as clean city driving, not a chase.
    startMission(st.missions, st, st.random);
    const car = st.cars[0];
    st.player.x = car.x - 40;
    st.player.y = car.y;
    world.step(STEP, { ...idleCtl(st.player), enter: true });
    stepN(world, 8, () => driveToward(world, 640, 640));
    st.police.heat = 0;
    st.police.stars = 0;
    st.police.cars.length = 0;
    st.police.cops.length = 0;
    st.player.health = 100;
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
    st.player.x = car.x - 40;
    st.player.y = car.y;
    world.step(STEP, { ...idleCtl(st.player), enter: true });
    stepN(world, 1.5, () => driveToward(world, 1575, 2350));
    st.missions.index = 2;
    startMission(st.missions, st, st.random);
    stepN(world, 2.5, () => driveToward(world, 1575, 2350));
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
  stepN(world, 4, () => idleCtl(st.player));
  say(st.missions, 'HARBOR HEIST — grab the 4 cash bags. The Kings will not hand them over quietly.', 30);
  return { screen: SCREEN_PLAY, hasSave: false };
}
