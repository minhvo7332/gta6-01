// Save and load through localStorage. G saves cash, jobs, health and
// position; loading drops Dana back on the streets where she left off.
const KEY = 'azuraBaySaveV1';

export function saveGame(G) {
  try {
    const p = G.player;
    const data = {
      version: 1, savedAt: Date.now(),
      cash: p.cash, health: p.health,
      x: p.x, y: p.y,
      missionIndex: G.missions.index,
      missionStep: G.missions.step,
      kills: G.combat.kills,
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    G.message('Game saved.', '#7ad87a');
    return true;
  } catch {
    G.message('Save failed — storage is unavailable.', '#ff6a6a');
    return false;
  }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function hasSave() {
  return loadSave() !== null;
}

export function applySave(G, data) {
  const p = G.player;
  p.cash = data.cash ?? 120;
  p.health = data.health ?? 100;
  p.x = data.x ?? G.city.spots.plaza.x;
  p.y = data.y ?? G.city.spots.plaza.y;
  p.onFoot = true;
  p.car = null;
  G.combat.kills = data.kills ?? 0;
}
