// Keyboard and mouse input for Solara Bay.
// Held keys drive movement and steering. One-shot presses (enter car, punch,
// pause, mute, save, side job, horn, confirm) are latched into a flag word and
// taken exactly once by the game loop, so a press between two frames is never
// lost and never counted twice. The mouse aims the pistol.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_MUTE = 16;
export const ACTION_SAVE = 32;
export const ACTION_JOB = 64;
export const ACTION_HORN = 128;

/** Held-key slots, each with the codes that set it. */
const HELD = [
  { slot: 'up', codes: ['ArrowUp', 'KeyW'] },
  { slot: 'down', codes: ['ArrowDown', 'KeyS'] },
  { slot: 'left', codes: ['ArrowLeft', 'KeyA'] },
  { slot: 'right', codes: ['ArrowRight', 'KeyD'] },
  { slot: 'sprint', codes: ['ShiftLeft', 'ShiftRight'] },
  { slot: 'shoot', codes: ['Space'] },
];

/** One-shot presses, each with the codes that fire it. */
const ONE_SHOT = [
  { flag: ACTION_CONFIRM, codes: ['Enter'] },
  { flag: ACTION_PAUSE, codes: ['KeyP', 'Escape'] },
  { flag: ACTION_ENTER, codes: ['KeyE'] },
  { flag: ACTION_PUNCH, codes: ['KeyF'] },
  { flag: ACTION_MUTE, codes: ['KeyM'] },
  { flag: ACTION_SAVE, codes: ['KeyG'] },
  { flag: ACTION_JOB, codes: ['KeyQ'] },
  { flag: ACTION_HORN, codes: ['KeyH'] },
];

function slotForCode(code) {
  for (const entry of HELD) {
    if (entry.codes.includes(code)) return entry.slot;
  }
  return null;
}

function flagForCode(code) {
  for (const entry of ONE_SHOT) {
    if (entry.codes.includes(code)) return entry.flag;
  }
  return 0;
}

export function createInput(canvas) {
  const keys = { up: false, down: false, left: false, right: false, sprint: false, shoot: false };
  const mouse = { x: 0, y: 0, down: false, clicked: false };
  let pending = 0;

  function clearHeld() {
    keys.up = false;
    keys.down = false;
    keys.left = false;
    keys.right = false;
    keys.sprint = false;
    keys.shoot = false;
    mouse.down = false;
  }

  function trackPointer(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  }

  window.addEventListener('keydown', (event) => {
    const flag = flagForCode(event.code);
    if (flag !== 0) {
      if (!event.repeat) pending |= flag;
      return;
    }
    const slot = slotForCode(event.code);
    if (slot) {
      keys[slot] = true;
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    const slot = slotForCode(event.code);
    if (slot) keys[slot] = false;
  });
  window.addEventListener('blur', clearHeld);
  canvas.addEventListener('pointermove', trackPointer);
  canvas.addEventListener('pointerdown', (event) => {
    trackPointer(event);
    mouse.down = true;
    mouse.clicked = true;
    pending |= ACTION_CONFIRM;
  });
  canvas.addEventListener('pointerup', () => { mouse.down = false; });
  // Right-click must not open the browser menu mid-game.
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    keys,
    mouse,
    /** -1 / 0 / 1 steering: left is negative, right is positive. */
    steer() { return (keys.right ? 1 : 0) - (keys.left ? 1 : 0); },
    /** -1 / 0 / 1 throttle: up is positive, down is negative. */
    throttle() { return (keys.up ? 1 : 0) - (keys.down ? 1 : 0); },
    /** -1 / 0 / 1 on foot, x axis. */
    moveX() { return (keys.right ? 1 : 0) - (keys.left ? 1 : 0); },
    /** -1 / 0 / 1 on foot, y axis (down is positive). */
    moveY() { return (keys.down ? 1 : 0) - (keys.up ? 1 : 0); },
    /** One-shot presses since the last call, as ACTION_* flags, plus clicks. */
    takeActions() {
      const flags = pending;
      pending = 0;
      const clicked = mouse.clicked;
      mouse.clicked = false;
      return { flags, clicked };
    },
  };
}
