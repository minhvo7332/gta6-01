// Keyboard + mouse state, in world-independent terms. The game reads
// `keys` and `mouse` each frame; edge-triggered presses are queued.
export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false, wx: 0, wy: 0 };

  function onKeyDown(e) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!keys.has(e.code)) pressed.add(e.code);
    keys.add(e.code);
  }
  function onKeyUp(e) { keys.delete(e.code); }
  function onMove(e) {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  }
  function onDown(e) {
    onMove(e);
    mouse.down = true;
    mouse.clicked = true;
  }
  function onUp() { mouse.down = false; }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMove);
  canvas.addEventListener('mousedown', onDown);
  window.addEventListener('mouseup', onUp);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    keys, pressed, mouse,
    down(code) { return keys.has(code); },
    // True only on the frame the key went down.
    hit(code) { return pressed.has(code); },
    anyHit(codes) { return codes.some((c) => pressed.has(c)); },
    endFrame() { pressed.clear(); mouse.clicked = false; },
  };
}
