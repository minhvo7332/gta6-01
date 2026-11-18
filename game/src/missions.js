// Story missions for Solara Bay.
// Protagonist: Rey Marlow, a courier who owes money to the wrong people
// and drives her way out of debt, one job at a time. Five missions, each
// with an objective marker, on-screen dialogue, and a cash reward. A
// mission unlocks only after the previous one is finished.
export const MISSIONS = [
  {
    id: 'm1',
    title: 'First Pickup',
    reward: 150,
    blurb: 'Mara needs a package collected from Palm Plaza. Walk or drive there.',
    dialogue: [
      'MARA: Rey, you still owe me for the courier van. One pickup and we are even-ish.',
      'REY: Even-ish? Fine. Palm Plaza, right? I am on my way.',
    ],
    stages: [
      { type: 'goto', point: { x: 1600, y: 640 }, label: 'Reach Palm Plaza', radius: 70 },
    ],
  },
  {
    id: 'm2',
    title: 'Harbor Run',
    reward: 250,
    blurb: 'Drive the package to the marina before the tide turns. A car helps.',
    dialogue: [
      'MARA: The buyer waits at Harborlight Marina. Drive, do not stroll.',
      'REY: If the cops ask, this is just a very urgent lunch delivery.',
    ],
    stages: [
      { type: 'goto', point: { x: 320, y: 1760 }, label: 'Drive to Harborlight Marina', radius: 80 },
    ],
  },
  {
    id: 'm3',
    title: 'Hot Pursuit',
    reward: 400,
    blurb: 'The deal went loud. Lose the heat: reach two checkpoints while wanted.',
    dialogue: [
      'DETECTIVE VOSS: Marlow! The whole bay is looking for you now.',
      'REY: Then the whole bay can watch me disappear. Two stops and I am gone.',
    ],
    stages: [
      { type: 'goto', point: { x: 2720, y: 640 }, label: 'Escape to Foundry Gate', radius: 80 },
      { type: 'goto', point: { x: 480, y: 480 }, label: 'Escape to Vista Hill', radius: 80 },
    ],
    onStartWanted: 3,
  },
  {
    id: 'm4',
    title: 'Bay Delivery',
    reward: 350,
    blurb: 'Pick up the crate at the Old Bazaar, then deliver it to Coral Beach.',
    dialogue: [
      'SAL: Crate is at the Bazaar, Marlow. Heavy, fragile, and absolutely legal.',
      'REY: Sure it is. Bazaar first, beach after. No questions.',
    ],
    stages: [
      { type: 'goto', point: { x: 2720, y: 1760 }, label: 'Pick up the crate at Old Bazaar', radius: 70 },
      { type: 'goto', point: { x: 1600, y: 2220 }, label: 'Deliver the crate to Coral Beach', radius: 80 },
    ],
  },
  {
    id: 'm5',
    title: 'The Big Score',
    reward: 800,
    blurb: 'Grab the cash at Palm Plaza, then lose the heat and reach the hideout.',
    dialogue: [
      'MARA: Last job, Rey. The vault money, then we vanish. No more debts.',
      'REY: One last drive. Hideout by dawn, and Solara Bay owes me nothing.',
    ],
    stages: [
      { type: 'goto', point: { x: 1600, y: 640 }, label: 'Grab the cash at Palm Plaza', radius: 70 },
      { type: 'goto', point: { x: 480, y: 2080 }, label: 'Escape to the Hideout', radius: 80 },
    ],
    onStartWanted: 2,
    onPickupWanted: 4,
  },
];

export function createMissionState() {
  return {
    completed: 0, // number of missions finished
    activeIndex: -1, // index into MISSIONS, -1 = none active
    stage: 0,
    dialogueIndex: 0,
    dialogueTimer: 0,
    currentLine: '',
    done: false,
    justCompleted: null,
  };
}

export function currentMission(state) {
  if (state.activeIndex < 0 || state.activeIndex >= MISSIONS.length) return null;
  return MISSIONS[state.activeIndex];
}

export function missionObjectiveText(state) {
  const m = currentMission(state);
  if (!m) {
    if (state.completed >= MISSIONS.length) return 'All jobs done — Solara Bay is yours, Rey.';
    return 'No job active — press N to take the next job.';
  }
  const stage = m.stages[state.stage];
  return `${m.title}: ${stage ? stage.label : ''}`;
}

export function missionMarker(state) {
  const m = currentMission(state);
  if (!m) return null;
  const stage = m.stages[state.stage];
  return stage ? { x: stage.point.x, y: stage.point.y, label: stage.label } : null;
}

export function canStartNext(state) {
  return state.activeIndex === -1 && state.completed < MISSIONS.length;
}

export function startMission(state, player, sound) {
  if (!canStartNext(state)) return null;
  const index = state.completed;
  state.activeIndex = index;
  state.stage = 0;
  state.dialogueIndex = 0;
  state.dialogueTimer = 0;
  state.currentLine = MISSIONS[index].dialogue[0] || '';
  state.done = false;
  const m = MISSIONS[index];
  if (m.onStartWanted) {
    player.wanted = m.onStartWanted;
    player.heat = m.onStartWanted * 20;
  }
  if (sound) sound.playBlip();
  return m;
}

// Advance dialogue lines on a timer; returns true when a line changed.
export function updateMissionDialogue(state, dt) {
  const m = currentMission(state);
  if (!m) return false;
  state.dialogueTimer += dt;
  if (state.dialogueTimer < 4.2) return false;
  state.dialogueTimer = 0;
  if (state.dialogueIndex < m.dialogue.length - 1) {
    state.dialogueIndex += 1;
    state.currentLine = m.dialogue[state.dialogueIndex];
    return true;
  }
  if (state.currentLine !== '') {
    state.currentLine = '';
    return true;
  }
  return false;
}

// Check arrival at the current stage target. Returns 'stage' | 'done' | null.
export function updateMissionProgress(state, player, sound) {
  const m = currentMission(state);
  if (!m) return null;
  const stage = m.stages[state.stage];
  if (!stage) return null;
  const px = player.onFoot ? player.x : player.car.x;
  const py = player.onFoot ? player.y : player.car.y;
  if (Math.hypot(px - stage.point.x, py - stage.point.y) > stage.radius) return null;
  if (m.onPickupWanted && state.stage === 0) {
    player.wanted = m.onPickupWanted;
    player.heat = m.onPickupWanted * 20;
  }
  if (state.stage < m.stages.length - 1) {
    state.stage += 1;
    state.dialogueTimer = 0;
    if (sound) sound.playPickup();
    return 'stage';
  }
  // Mission complete: pay out and unlock the next.
  player.money += m.reward;
  state.completed += 1;
  state.justCompleted = m;
  state.activeIndex = -1;
  state.stage = 0;
  state.currentLine = `Job done: ${m.title} — $${m.reward} earned.`;
  state.dialogueTimer = 0;
  state.done = true;
  if (sound) sound.playMissionDone();
  return 'done';
}
