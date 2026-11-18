// Missions and the story: five jobs from Otto, plus repeatable side deliveries.
// A mission is a list of stages; each stage is one check (steal a car, reach a
// marker, collect bags, survive a chase). Finishing a stage pays the reward and
// unlocks the next mission. The story is Mara Voss, an original character.

import { MISSION_DEFS, SIDE_JOB } from './config.js';
import { distance } from './random.js';

const BAG_CASH = 150;
const ARRIVE_DIST = 70;
const BAG_DIST = 44;

/** Fresh mission state: which job, which stage, bags, gang, messages. */
export function createMissionState() {
  return {
    index: 0, // which mission is next (0-based); MISSION_DEFS.length = story done
    stage: 0,
    active: false,
    timer: 0,
    survive: 0,
    arrived: false,
    collected: 0,
    bags: [], // {x, y, taken}
    enemies: [], // gang peds spawned by the current mission
    message: '',
    messageTimer: 0,
    sideJob: null, // {x, y, timer, active}
    completedCount: 0,
  };
}

export function currentMission(missions) {
  return missions.index < MISSION_DEFS.length ? MISSION_DEFS[missions.index] : null;
}

export function currentStage(missions) {
  const def = currentMission(missions);
  return def ? def.stages[missions.stage] : null;
}

/** Show a line in the dialogue bar for a few seconds. */
export function say(missions, text, seconds = 6) {
  missions.message = text;
  missions.messageTimer = seconds;
}

/** Heat for a stage that demands a wanted level: 3 stars or 4 stars. */
function heatForStars(wanted) {
  return wanted === 3 ? 120 : 200;
}

function placeBags(missions, stage, random) {
  missions.bags = [];
  for (let i = 0; i < stage.count; i += 1) {
    missions.bags.push({
      x: stage.x + random.range(-160, 160),
      y: stage.y + random.range(-120, 120),
      taken: false,
    });
  }
}

function placeGang(missions, stage, random) {
  missions.enemies = [];
  for (let i = 0; i < 4; i += 1) {
    missions.enemies.push({
      x: stage.x + random.range(-220, 220),
      y: stage.y + random.range(-180, 180),
      angle: 0,
      speed: 70,
      shirt: '#3a3f46',
      skin: '#c98a5a',
      gang: true,
      health: 60,
      flee: 0,
      targetX: stage.x,
      targetY: stage.y,
      retarget: 3,
      shootTimer: random.range(0.5, 2),
      dead: false,
    });
  }
}

/** Apply a stage's opening conditions: heat, timer, survive clock, bags, gang. */
function prepareStage(missions, world, stage, random) {
  if (!stage) return;
  if (stage.kind === 'collect' && stage.count > 0) {
    placeBags(missions, stage, random);
    placeGang(missions, stage, random);
  }
  if (stage.wanted) world.police.heat = Math.max(world.police.heat, heatForStars(stage.wanted));
  if (stage.timer) missions.timer = stage.timer;
  if (stage.survive) missions.survive = stage.survive;
}

export function startMission(missions, world, random) {
  const def = currentMission(missions);
  if (!def) return;
  missions.active = true;
  missions.stage = 0;
  missions.arrived = false;
  missions.collected = 0;
  missions.bags = [];
  missions.enemies = [];
  prepareStage(missions, world, def.stages[0], random);
  say(missions, `${def.title}: ${def.brief}`);
}

/** Move to the next stage, or finish the mission and pay out. */
function advance(missions, world, def) {
  missions.stage += 1;
  missions.arrived = false;
  if (missions.stage < def.stages.length) {
    const next = def.stages[missions.stage];
    prepareStage(missions, world, next, world.random);
    say(missions, next.text, 6);
    return null;
  }
  // Mission complete: pay, unlock the next one.
  world.cash += def.reward;
  missions.completedCount += 1;
  missions.index += 1;
  missions.active = false;
  if (world.audio) world.audio.mission();
  say(missions, `MISSION COMPLETE — ${def.title}. ${def.outro}`, 8);
  return 'done';
}

function failMission(missions, reason) {
  missions.active = false;
  // A failed job leaves nothing behind: clear its bags and its gang.
  missions.bags = [];
  missions.enemies = [];
  say(missions, `${reason} Talk to Otto to try again.`, 7);
  return 'failed';
}

function checkStealStage(missions, world, def) {
  if (world.player.inCar) return advance(missions, world, def);
  return null;
}

function checkGotoStage(missions, world, def, stage, dt) {
  if (stage.timer) {
    missions.timer -= dt;
    if (missions.timer <= 0) return failMission(missions, 'Too slow — the job fell through.');
  }
  const player = world.player;
  if (!missions.arrived && distance(player.x, player.y, stage.x, stage.y) < ARRIVE_DIST) {
    missions.arrived = true;
    if (stage.survive) say(missions, `Hold the gate — survive ${stage.survive}s of chase!`, 4);
  }
  if (!missions.arrived) return null;
  if (stage.survive) {
    // Survive the chase timer once arrived, wherever the player drives.
    missions.survive -= dt;
    if (missions.survive <= 0) return advance(missions, world, def);
    return null;
  }
  return advance(missions, world, def);
}

function checkCollectStage(missions, world, def, stage) {
  for (const bag of missions.bags) {
    if (bag.taken) continue;
    if (distance(world.player.x, world.player.y, bag.x, bag.y) >= BAG_DIST) continue;
    bag.taken = true;
    missions.collected += 1;
    world.cash += BAG_CASH;
    if (world.audio) world.audio.cash();
    say(missions, `Cash bag ${missions.collected}/${stage.count} — keep moving!`, 3);
  }
  if (missions.collected >= stage.count) return advance(missions, world, def);
  return null;
}

/** Advance the active stage; returns 'done' | 'failed' | null. */
export function stepMissions(missions, world, dt, random) {
  if (missions.messageTimer > 0) missions.messageTimer -= dt;
  if (!missions.active) return null;
  const def = currentMission(missions);
  if (!def) {
    missions.active = false;
    return null;
  }
  const stage = def.stages[missions.stage];
  if (!stage) return null;
  if (stage.kind === 'steal') return checkStealStage(missions, world, def);
  if (stage.kind === 'goto') return checkGotoStage(missions, world, def, stage, dt);
  if (stage.kind === 'collect') return checkCollectStage(missions, world, def, stage);
  return null;
}

/** Start the next mission (walk to Otto's marker, or press Q in free roam). */
export function tryStartMission(missions, world, random) {
  if (missions.active) return false;
  if (!currentMission(missions)) return false;
  startMission(missions, world, random);
  return true;
}

/** A repeatable side delivery: a parcel marker appears elsewhere in the city. */
export function startSideJob(missions, world, random) {
  if (missions.active || missions.sideJob) return false;
  const x = 300 + random.range(0, 3000);
  const y = 300 + random.range(0, 1900);
  missions.sideJob = { x, y, timer: SIDE_JOB.time, active: true };
  say(missions, SIDE_JOB.text, 6);
  return true;
}

export function stepSideJob(missions, world, dt) {
  const job = missions.sideJob;
  if (!job) return;
  job.timer -= dt;
  if (job.timer <= 0) {
    missions.sideJob = null;
    say(missions, 'Side job expired — the parcel went to someone else.', 5);
    return;
  }
  if (distance(world.player.x, world.player.y, job.x, job.y) < ARRIVE_DIST) {
    world.cash += SIDE_JOB.reward;
    missions.sideJob = null;
    if (world.audio) world.audio.cash();
    say(missions, `Side job done. +$${SIDE_JOB.reward}`, 5);
  }
}
