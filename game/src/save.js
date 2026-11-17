// Saving Solara Bay: cash, story progress, health, ammo and where Mara stands,
// in localStorage as one plain JSON object. A missing or corrupt save simply
// means a fresh game — loading never throws.

import { SAVE_KEY } from './config.js';

const SAVE_VERSION = 1;

/** Pick the fields a save carries out of the live world state. */
function snapshot(world) {
  const p = world.player;
  const m = world.missions;
  return {
    version: SAVE_VERSION,
    cash: world.cash,
    missionIndex: m.index,
    completedCount: m.completedCount,
    health: p.health,
    ammo: p.ammo,
    x: p.x,
    y: p.y,
    angle: p.angle,
    playSeconds: Math.round(world.elapsed),
  };
}

export function saveGame(world) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot(world)));
    return true;
  } catch {
    return false; // storage off or full
  }
}

/** The saved data, or null when there is no usable save. */
export function loadGame() {
  let raw = null;
  try {
    raw = window.localStorage.getItem(SAVE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  let data = null;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  const ok = data && data.version === SAVE_VERSION
    && typeof data.cash === 'number'
    && typeof data.missionIndex === 'number'
    && data.missionIndex >= 0 && data.missionIndex <= 5
    && typeof data.health === 'number';
  return ok ? data : null;
}

export function hasSave() {
  return loadGame() !== null;
}

/** One line about the save, for the title screen's continue prompt. */
export function saveSummary() {
  const data = loadGame();
  if (!data) return '';
  const minutes = Math.floor((data.playSeconds || 0) / 60);
  const story = Math.min(data.missionIndex, 5);
  return `Continue — $${data.cash.toLocaleString('en-US')}, story ${story}/5, ${minutes} min played`;
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // storage off; nothing to clear
  }
}
