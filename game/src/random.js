// Seeded randomness for Solara Bay: a small sfc32 generator plus the helpers
// the city, traffic and pedestrians use. One seed always builds the same city,
// so a screenshot taken from a seed is repeatable.

/** sfc32: four 32-bit state words, seeded from one number. */
export function createRandom(seed) {
  let a = seed | 0;
  let b = (seed ^ 0x9e3779b9) | 0;
  let c = Math.imul(seed, 0x85ebca6b) | 0;
  let d = Math.imul(seed, 0xc2b2ae35) | 0;
  function next() {
    const t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    const out = (t + d) | 0;
    c = (c + out) | 0;
    return (out >>> 0) / 4294967296;
  }
  // Warm the state up so early draws do not correlate with the seed.
  for (let i = 0; i < 12; i += 1) next();
  next.range = (lo, hi) => lo + next() * (hi - lo);
  next.int = (lo, hi) => Math.floor(next.range(lo, hi + 1));
  next.pick = (items) => items[Math.floor(next() * items.length)];
  next.chance = (p) => next() < p;
  /** Fisher-Yates shuffle, returning a shuffled copy of the list. */
  next.shuffle = (items) => {
    const copy = items.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(next() * (i + 1));
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  };
  return next;
}

/** Clamp `value` into the closed interval [lo, hi]. */
export function clamp(value, lo, hi) {
  if (value < lo) return lo;
  if (value > hi) return hi;
  return value;
}

/** Shortest signed turn from angle `from` to angle `to`, in (-PI, PI]. */
export function angleDiff(from, to) {
  const twoPi = Math.PI * 2;
  let d = (to - from) % twoPi;
  if (d > Math.PI) d -= twoPi;
  else if (d <= -Math.PI) d += twoPi;
  return d;
}

/** Straight-line distance between (ax, ay) and (bx, by). */
export function distance(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Square of the distance, for comparisons that need no square root. */
export function distanceSq(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}
