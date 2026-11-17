// Solara Bay — tuning, palette, districts and story, all in one module.
// Original coastal city, 3600 by 2600, seen through a 1280 by 720 camera.
// Nothing in here comes from any commercial game.

export const STEP = 1 / 60;
export const WORLD = { width: 3600, height: 2600 };
export const VIEW = { width: 1280, height: 720 };

export const CITY_NAME = 'SOLARA BAY';
export const GAME_TITLE = 'SOLARA BAY';
export const GAME_SUBTITLE = 'an open-world crime story — an original game, no Rockstar content';
export const SAVE_KEY = 'solara-bay.save.v1';
export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Mara Voss, ex-getaway driver, comes home to Solara Bay. */
export const STORY = {
  hero: 'Mara Voss',
  fixer: 'Otto',
  rival: 'The Kings',
  intro: 'Mara Voss drove getaway cars for ten years, then walked away. Now she is back in Solara Bay, broke, with one name in her phone: Otto, the fixer who never forgets a debt.',
};

/** Six districts the minimap labels and the mission text name. */
export const DISTRICTS = [
  { name: 'Northside', x: 1800, y: 350, color: '#a8e6a1' },
  { name: 'Old Town', x: 700, y: 700, color: '#f2c94c' },
  { name: 'Marina', x: 2900, y: 500, color: '#7fd4e8' },
  { name: 'Downtown', x: 1800, y: 1200, color: '#ff9d6b' },
  { name: 'Harbor', x: 2900, y: 1900, color: '#9fb8ff' },
  { name: 'South Beach', x: 1200, y: 2350, color: '#ffd9a0' },
];

export const PLAYER = {
  radius: 14,
  walkSpeed: 210,
  sprintSpeed: 320,
  health: 100,
  punchDamage: 25,
  punchRange: 42,
  punchArc: 1.1,
  pistolDamage: 34,
  pistolRange: 420,
  fireCooldown: 0.28,
  startAmmo: 24,
};

export const CAR = {
  length: 64,
  width: 30,
  accel: 420,
  brake: 700,
  maxSpeed: 560,
  reverseMax: 180,
  steer: 2.6,
  drag: 0.55,
  stealRange: 70,
};

export const TRAFFIC_COUNT = 26;
export const PARKED_COUNT = 6;
export const PED_COUNT = 42;
export const START_CASH = 120;
export const MAX_POLICE_CARS = 6;
export const MAX_COPS = 8;
export const POLICE_RAM_DAMAGE = 8;

export const WANTED = {
  // Heat thresholds that raise the star level.
  thresholds: [0, 25, 60, 120, 200, 320],
  stealHeat: 30,
  hitPedHeat: 35,
  shootHeat: 20,
  killHeat: 50,
  decayPerSecond: 2.2,
  decayDelay: 6,
};

export const PALETTE = {
  backdrop: '#0e1a24',
  grass: '#7fae5a',
  grassDark: '#6f9e4e',
  sand: '#e8d39a',
  sea: '#2e7fa8',
  seaDeep: '#1f5f84',
  road: '#3a3f46',
  roadLine: '#e8d44d',
  sidewalk: '#9aa0a8',
  buildingRoof: ['#c96f4a', '#4a7a96', '#8a6f9e', '#b5893c', '#5d8a6a', '#a34a5e', '#6a7f8a', '#d08a4e'],
  buildingWall: '#5a4a3c',
  park: '#5d9e4f',
  text: '#f5f1e6',
  muted: '#c9c2ae',
  gold: '#f2c94c',
  red: '#e5534b',
  blue: '#4fc3f7',
  panel: 'rgba(12, 18, 26, 0.88)',
  panelEdge: '#f2c94c',
  wanted: '#ff5a4e',
  mission: '#ffd94d',
  police: '#3d7bd6',
};

export const CAR_MODELS = [
  { name: 'Sunrunner', color: '#e8b23c' },
  { name: 'Comet', color: '#c94a4a' },
  { name: 'Vanta', color: '#3a3f46' },
  { name: 'Marlin', color: '#4a7fb5' },
  { name: 'Dune', color: '#7fae5a' },
  { name: 'Pearl', color: '#e8e4da' },
  { name: 'Ember', color: '#d2691e' },
  { name: 'Lagoon', color: '#3fa8a0' },
];

/** One story job: an id, a title, a brief, a reward, stages and an outro line. */
function job(id, title, brief, reward, stages, outro) {
  return { id, title, brief, reward, stages, outro };
}

function go(text, x, y, extra = {}) {
  return { text, kind: 'goto', x, y, ...extra };
}

export const MISSION_DEFS = [
  job(1, 'Back in the Bay',
    'Otto needs wheels. Steal any car (walk up and press E) and bring it to his garage in Old Town.',
    500,
    [
      { text: 'Steal a car — walk up to one and press E', kind: 'steal' },
      go('Drive to Otto’s garage in Old Town', 640, 640),
    ],
    'Otto: "Still got the touch, Mara. The Bay missed you." +$500'),
  job(2, 'The Courier',
    'A package is waiting at the Marina. Pick it up and deliver it to Northside — 90 seconds, no questions.',
    800,
    [
      go('Pick up the package at the Marina', 3050, 420),
      go('Deliver to Northside — 90 seconds on the clock', 1800, 300, { timer: 90 }),
    ],
    'Delivered clean. The client pays in cash, always. +$800'),
  job(3, 'Hot Pursuit',
    'The Kings set you up. The police are on you — 3 stars. Lose them and reach the safehouse in the park.',
    1000,
    [
      go('Lose the heat — get to the park safehouse', 1800, 1300, { wanted: 3 }),
    ],
    'Otto: "They lost you in the park. Nice driving." +$1,000'),
  job(4, 'Harbor Heist',
    'The Kings stash their cash at the Harbor. Grab 4 bags — and they will not hand them over quietly.',
    1500,
    [
      { text: 'Collect the cash bags at the Harbor (0/4)', kind: 'collect', x: 2950, y: 1950, count: 4 },
    ],
    'Four bags, one very angry crew. Worth every dollar. +$1,500'),
  job(5, 'The Long Way Home',
    'Final job: the whole Bay is after you. Reach the highway gate at the north edge with the heat on and survive.',
    2500,
    [
      go('Reach the highway gate — survive the chase', 1800, 80, { wanted: 4, survive: 45 }),
    ],
    'Mara Voss drives out of Solara Bay a legend — and free. STORY COMPLETE. +$2,500'),
];

export const SIDE_JOB = {
  reward: 300,
  time: 75,
  text: 'Side job: deliver the parcel. $300 if you make it in time.',
};
