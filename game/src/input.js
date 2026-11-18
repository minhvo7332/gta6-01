// Keyboard and mouse input for Solara Bay.
// Tracks held keys, edge-triggered presses (so one keypress = one action),
// and mouse clicks on the canvas for shooting.
export class Input {
  constructor() {
    this.held = new Set();
    this.pressed = new Set();
    this.mouse = { x: 0, y: 0, clicked: false, down: false };
    this.onKey = null; // optional callback for menu keys
    this._down = (event) => {
      if (event.repeat) return;
      this.held.add(event.code);
      this.pressed.add(event.code);
      if (this.onKey) this.onKey(event.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
        event.preventDefault();
      }
    };
    this._up = (event) => {
      this.held.delete(event.code);
    };
    this._blur = () => {
      this.held.clear();
      this.pressed.clear();
      this.mouse.down = false;
    };
    this._mouseDown = (event) => {
      this.mouse.down = true;
      this.mouse.clicked = true;
      this.mouse.x = event.offsetX;
      this.mouse.y = event.offsetY;
    };
    this._mouseUp = () => {
      this.mouse.down = false;
    };
    this._mouseMove = (event) => {
      this.mouse.x = event.offsetX;
      this.mouse.y = event.offsetY;
    };
  }

  attach(canvas) {
    window.addEventListener('keydown', this._down);
    window.addEventListener('keyup', this._up);
    window.addEventListener('blur', this._blur);
    if (canvas) {
      canvas.addEventListener('mousedown', this._mouseDown);
      canvas.addEventListener('mouseup', this._mouseUp);
      canvas.addEventListener('mousemove', this._mouseMove);
    }
    this.canvas = canvas;
  }

  isDown(code) {
    return this.held.has(code);
  }

  // True once per physical press; consumed at the end of each frame.
  wasPressed(code) {
    return this.pressed.has(code);
  }

  anyPressed(codes) {
    return codes.some((c) => this.pressed.has(c));
  }

  // Movement axes from WASD or arrows. Returns {x, y} in -1..1.
  moveAxis() {
    let x = 0;
    let y = 0;
    if (this.isDown('KeyA') || this.isDown('ArrowLeft')) x -= 1;
    if (this.isDown('KeyD') || this.isDown('ArrowRight')) x += 1;
    if (this.isDown('KeyW') || this.isDown('ArrowUp')) y -= 1;
    if (this.isDown('KeyS') || this.isDown('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      const inv = 1 / Math.sqrt(2);
      x *= inv;
      y *= inv;
    }
    return { x, y };
  }

  endFrame() {
    this.pressed.clear();
    this.mouse.clicked = false;
  }
}

export function createInput(canvas) {
  const input = new Input();
  input.attach(canvas);
  return input;
}
