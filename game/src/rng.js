// Seeded random numbers for Solara Bay.
// The whole city is generated from one fixed seed, so the same seed always
// builds the same streets, buildings and parked cars. Nothing in world
// generation uses Math.random or the clock; gameplay uses this same stream.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class SeededRng {
  constructor(seed) {
    this.seed = seed >>> 0;
    this.nextFloat = mulberry32(this.seed);
  }
  // Float in [0, 1).
  next() {
    return this.nextFloat();
  }
  // Float in [min, max).
  range(min, max) {
    return min + this.next() * (max - min);
  }
  // Integer in [min, max] inclusive.
  int(min, max) {
    return min + Math.floor(this.next() * (max - min + 1));
  }
  // Pick one element of a non-empty array.
  pick(list) {
    return list[Math.floor(this.next() * list.length)];
  }
  // True with probability p (0..1).
  chance(p) {
    return this.next() < p;
  }
  // Deterministic shuffle returning a new array.
  shuffle(list) {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.next() * (i + 1));
      const tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }
}

export function createRng(seed) {
  return new SeededRng(seed);
}
