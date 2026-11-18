// The story: "The Tide Job". Dana Vega, ex-mechanic, runs five jobs for
// fixer Marlo Crane across Azura Bay — deliveries, a boosted car, a gang
// problem, a police heatwave and one last bank job. Each job pays cash;
// finishing one starts the next.
import { dist2 } from './rng.js';
import { spawnGang } from './combat.js';
import { CAR_MODELS } from './vehicles.js';

export const MISSIONS = [
  {
    id: 'first-delivery', title: 'First Delivery', pay: 500,
    briefing: 'Marlo Crane needs a package moved. Pick it up at the Harbor Docks and drop it on the Neon Mile. Keep it quiet.',
  },
  {
    id: 'hot-wheels', title: 'Hot Wheels', pay: 800,
    briefing: 'A Comet GT is parked by the garage district. Boost it and bring it to Vega\'s Garage. The owner will not miss it. Much.',
  },
  {
    id: 'loud-neighbors', title: 'Loud Neighbors', pay: 1200,
    briefing: 'The Green Jackets are muscling into the Ironworks Yard. Marlo wants three of them gone. Loud is fine.',
  },
  {
    id: 'heat-wave', title: 'Heat Wave', pay: 1500,
    briefing: 'The APD is crawling all over the Mile. Stay hot for sixty seconds and slip away clean. Do not get busted.',
  },
  {
    id: 'tide-job', title: 'The Tide Job', pay: 3000,
    briefing: 'The big one. Hit the Azura National Bank, grab the tide money, and run for the escape boat on Coral Keys beach.',
  },
];

export function createMissionState() {
  return { index: 0, step: 0, timer: 0, kills: 0, banner: '', bannerAt: 0, cooldown: 0, done: false, grabTimer: 0 };
}

function spot(G, name) { return G.city.spots[name]; }

export function startMission(G, idx) {
  const m = G.missions;
  m.index = idx; m.step = 0; m.timer = 0; m.kills = 0; m.grabTimer = 0;
  const def = MISSIONS[idx];
  if (!def) { m.done = true; return; }
  G.message(`New job: ${def.title}`, '#ffd23a');
  if (def.id === 'hot-wheels') {
    // Park the target Comet GT near the garage.
    const s = spot(G, 'garage');
    const car = G.spawnTargetCar(s.x + 120, s.y + 40, 1);
    m.targetCar = car;
  }
  if (def.id === 'loud-neighbors') {
    const s = spot(G, 'ironworks');
    m.gang = spawnGang(G, s.x, s.y, 4);
  }
  if (def.id === 'heat-wave') {
    G.wanted.heat = 2.2; G.wanted.level = 2;
    G.message('The APD is on you! Survive 60 seconds.', '#ff4a4a');
  }
  if (def.id === 'tide-job') {
    G.wanted.heat = 0; G.wanted.level = 0;
  }
}

// The current objective marker, or null when between jobs.
export function missionMarker(G) {
  const m = G.missions;
  if (m.done || m.cooldown > 0) return null;
  const def = MISSIONS[m.index];
  if (!def) return null;
  const p = G.player;
  if (def.id === 'first-delivery') {
    return m.step === 0 ? { ...spot(G, 'docks'), label: 'Pick up the package' }
      : { ...spot(G, 'neonMile'), label: 'Deliver the package' };
  }
  if (def.id === 'hot-wheels') {
    if (m.step === 0) return { x: m.targetCar.x, y: m.targetCar.y, label: 'Steal the Comet GT', car: m.targetCar };
    return { ...spot(G, 'garage'), label: "Bring it to Vega's Garage" };
  }
  if (def.id === 'loud-neighbors') {
    return { ...spot(G, 'ironworks'), label: `Deal with the Green Jackets (${m.kills}/3)` };
  }
  if (def.id === 'heat-wave') {
    return { x: p.x, y: p.y, label: `Stay alive — ${Math.ceil(60 - m.timer)}s of heat left` };
  }
  if (def.id === 'tide-job') {
    return m.step === 0 ? { ...spot(G, 'bank'), label: 'Hit the bank — hold position to crack the vault' }
      : { ...spot(G, 'boat'), label: 'Run for the escape boat!' };
  }
  return null;
}

export function objectiveText(G) {
  const m = G.missions;
  if (m.done) return 'Story complete — Azura Bay is yours. Free roam!';
  if (m.cooldown > 0) return 'Job done. Marlo is lining up the next one…';
  const marker = missionMarker(G);
  const def = MISSIONS[m.index];
  return marker ? `${def.title}: ${marker.label}` : def.title;
}

export function onMissionKill(G) {
  const m = G.missions;
  if (m.done) return;
  const def = MISSIONS[m.index];
  if (def && def.id === 'loud-neighbors') {
    m.kills++;
    if (m.kills >= 3) completeMission(G);
  }
}

function completeMission(G) {
  const m = G.missions;
  const def = MISSIONS[m.index];
  G.player.cash += def.pay;
  G.audio.missionOk();
  m.banner = `JOB DONE — ${def.title}  +$${def.pay}`;
  m.bannerAt = G.time;
  m.cooldown = 3;
  G.message(`Marlo paid you $${def.pay}.`, '#7ad87a');
}

export function updateMissions(G, dt) {
  const m = G.missions;
  const p = G.player;
  if (m.done) return;
  if (m.cooldown > 0) {
    m.cooldown -= dt;
    if (m.cooldown <= 0) {
      if (m.index + 1 >= MISSIONS.length) {
        m.done = true;
        m.banner = 'THE TIDE JOB IS DONE — AZURA BAY IS YOURS';
        m.bannerAt = G.time;
      } else {
        startMission(G, m.index + 1);
      }
    }
    return;
  }
  const def = MISSIONS[m.index];
  if (!def) return;
  const marker = missionMarker(G);
  if (!marker) return;

  if (def.id === 'first-delivery') {
    if (dist2(p.x, p.y, marker.x, marker.y) < 70 * 70) {
      if (m.step === 0) {
        m.step = 1;
        G.audio.pickup();
        G.message('Package secured. Now the Neon Mile.', '#ffd23a');
      } else {
        completeMission(G);
      }
    }
  } else if (def.id === 'hot-wheels') {
    if (m.step === 0 && p.car === m.targetCar) {
      m.step = 1;
      G.message('That is the one. Get it to the garage.', '#ffd23a');
    } else if (m.step === 1 && p.car === m.targetCar && dist2(p.x, p.y, marker.x, marker.y) < 80 * 80) {
      completeMission(G);
    }
  } else if (def.id === 'heat-wave') {
    if (G.wanted.level >= 2) {
      m.timer += dt;
      if (m.timer >= 60) {
        G.wanted.heat = 0; G.wanted.level = 0;
        G.cops = [];
        completeMission(G);
      }
    }
  } else if (def.id === 'tide-job') {
    if (m.step === 0) {
      if (dist2(p.x, p.y, marker.x, marker.y) < 80 * 80) {
        m.grabTimer += dt;
        if (Math.floor(m.grabTimer * 2) !== Math.floor((m.grabTimer - dt) * 2)) {
          G.message(`Cracking the vault… ${Math.ceil(4 - m.grabTimer)}s`, '#ffd23a');
        }
        if (m.grabTimer >= 4) {
          m.step = 1;
          G.wanted.heat = 3.2; G.wanted.level = 3;
          G.audio.siren();
          G.message('Vault open! The alarm is screaming — RUN to the boat!', '#ff4a4a');
        }
      } else {
        m.grabTimer = Math.max(0, m.grabTimer - dt);
      }
    } else if (dist2(p.x, p.y, marker.x, marker.y) < 70 * 70) {
      completeMission(G);
    }
  }
  // 'loud-neighbors' completes from onMissionKill.
}
