// Saving: cash, story progress, health, ammo and the player's position, in
// localStorage. A save is a plain JSON object; loading a corrupt save starts fresh.

import { SAVE_KEY } from './config.js';

export function saveGame(world) {
  const data = {
    version: 1,
    cash: world.cash,
    missionIndex: world.missions.index,
    completedCount: world.missions.completedCount,
    health: world.player.health,
    ammo: world.player.ammo,
    x: world.player.x,
    y: world.player.y,
    angle: world.player.angle,
    playSeconds: Math.round(world.elapsed),
  };
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1 || typeof data.cash !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function hasSave() {
  return loadGame() !== null;
}

/** One line about a save, for the title screen's continue prompt. */
export function saveSummary() {
  const data = loadGame();
  if (!data) return '';
  const minutes = Math.floor((data.playSeconds || 0) / 60);
  return `Continue — $${data.cash.toLocaleString('en-US')}, story ${Math.min(data.missionIndex, 5)}/5, ${minutes} min played`;
}

export function clearSave() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch { /* storage off */ }
}
