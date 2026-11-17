// Keyboard and mouse input. Held keys give movement and steering; one-shot presses
// (enter car, punch, pause, mute, save, mission) are queued as bit flags and taken once
// by the loop, so a press between two frames is never lost and never counted twice.
// The mouse aims the pistol: its world position is tracked for shooting.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_MUTE = 16;
export const ACTION_SAVE = 32;
export const ACTION_JOB = 64;
export const ACTION_HORN = 128;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER = new Set(['KeyE']);
const PUNCH = new Set(['KeyF']);
const MUTE = new Set(['KeyM']);
const SAVE = new Set(['KeyG']);
const JOB = new Set(['KeyQ']);
const HORN = new Set(['KeyH']);
const SPRINT = new Set(['ShiftLeft', 'ShiftRight']);
const SHOOT = new Set(['Space']);

export function createInput(canvas) {
  const keys = { up: false, down: false, left: false, right: false, sprint: false, shoot: false };
  let actions = 0;
  const mouse = { x: 0, y: 0, down: false, clicked: false };

  function setKey(code, value) {
    if (UP.has(code)) keys.up = value;
    else if (DOWN.has(code)) keys.down = value;
    else if (LEFT.has(code)) keys.left = value;
    else if (RIGHT.has(code)) keys.right = value;
    else if (SPRINT.has(code)) keys.sprint = value;
    else if (SHOOT.has(code)) keys.shoot = value;
  }

  window.addEventListener('keydown', (event) => {
    if (CONFIRM.has(event.code)) { if (!event.repeat) actions |= ACTION_CONFIRM; }
    else if (PAUSE.has(event.code)) { if (!event.repeat) actions |= ACTION_PAUSE; }
    else if (ENTER.has(event.code)) { if (!event.repeat) actions |= ACTION_ENTER; }
    else if (PUNCH.has(event.code)) { if (!event.repeat) actions |= ACTION_PUNCH; }
    else if (MUTE.has(event.code)) { if (!event.repeat) actions |= ACTION_MUTE; }
    else if (SAVE.has(event.code)) { if (!event.repeat) actions |= ACTION_SAVE; }
    else if (JOB.has(event.code)) { if (!event.repeat) actions |= ACTION_JOB; }
    else if (HORN.has(event.code)) { if (!event.repeat) actions |= ACTION_HORN; }
    else { setKey(event.code, true); }
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)
      || SHOOT.has(event.code) || SPRINT.has(event.code)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => setKey(event.code, false));
  window.addEventListener('blur', () => {
    keys.up = keys.down = keys.left = keys.right = keys.sprint = keys.shoot = false;
    mouse.down = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
    mouse.down = true;
    mouse.clicked = true;
    actions |= ACTION_CONFIRM;
  });
  canvas.addEventListener('pointerup', () => { mouse.down = false; });

  return {
    keys,
    mouse,
    /** -1/0/1 steering (left/right) and -1/0/1 throttle (up/down). */
    steer() { return (keys.right ? 1 : 0) - (keys.left ? 1 : 0); },
    throttle() { return (keys.up ? 1 : 0) - (keys.down ? 1 : 0); },
    moveX() { return (keys.right ? 1 : 0) - (keys.left ? 1 : 0); },
    moveY() { return (keys.down ? 1 : 0) - (keys.up ? 1 : 0); },
    /** One-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      const clicked = mouse.clicked;
      mouse.clicked = false;
      return { flags: taken, clicked };
    },
  };
}
