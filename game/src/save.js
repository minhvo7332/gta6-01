// Save and load: progress persists in localStorage as one JSON blob:
// money, missions completed, player position and health. Loading restores
// them onto a fresh world so a session can continue where it left off.
export const SAVE_KEY = 'solara-bay-save-v1';

export function saveGame(player, missions) {
  try {
    const data = {
      version: 1,
      money: player.money,
      missionsCompleted: missions.completed,
      health: player.health,
      ammo: player.ammo,
      x: Math.round(player.onFoot ? player.x : player.car.x),
      y: Math.round(player.onFoot ? player.y : player.car.y),
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    if (typeof data.money !== 'number' || typeof data.x !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function hasSave() {
  return loadSave() !== null;
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage unavailable; nothing to clear.
  }
}

// Apply a loaded save onto live player/mission state.
export function applySave(player, missions, data) {
  player.money = data.money;
  player.health = data.health || 100;
  player.ammo = data.ammo || 24;
  missions.completed = data.missionsCompleted || 0;
  player.x = data.x;
  player.y = data.y;
  player.onFoot = true;
  player.car = null;
  player.wanted = 0;
  player.heat = 0;
}
