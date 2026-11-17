// Drawing only: the city, the cars and people in it, and every screen — the
// HUD with its minimap, the title, pause, busted and wasted panels. The camera
// follows the player through a 1280 by 720 window onto the 3600 by 2600 city.

import { DISTRICTS, FONT, PALETTE, VIEW, WORLD } from './config.js';
import { BEACH_Y, ROAD_WIDTH, SEA_Y } from './city.js';
import { currentMission, currentStage } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_DONE = 'done';

const MINIMAP = { x: 1052, y: 14, w: 214, h: 154 };
const MAP_SX = MINIMAP.w / WORLD.width;
const MAP_SY = MINIMAP.h / WORLD.height;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fontCache = new Map();
  let cam = { x: 640, y: 360 };

  /** Fit the 1280x720 logical view into the real canvas, letterboxed. */
  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    view.scale = Math.min(canvas.width / VIEW.width, canvas.height / VIEW.height);
    view.x = (canvas.width - VIEW.width * view.scale) / 2;
    view.y = (canvas.height - VIEW.height * view.scale) / 2;
  }

  function label(value, x, y, size, color, align = 'left', weight = '') {
    const key = `${weight}|${size}`;
    if (!fontCache.has(key)) fontCache.set(key, `${weight} ${size}px ${FONT}`);
    ctx.font = fontCache.get(key);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }

  /** True when a world point is inside (or near) the camera's view. */
  function inView(x, y, margin) {
    return x > cam.x - VIEW.width / 2 - margin && x < cam.x + VIEW.width / 2 + margin
      && y > cam.y - VIEW.height / 2 - margin && y < cam.y + VIEW.height / 2 + margin;
  }

  function rect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }

  function circle(x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function paintTerrain(state) {
    const city = state.city;
    const x0 = cam.x - VIEW.width / 2;
    const y0 = cam.y - VIEW.height / 2;
    rect(x0, y0, VIEW.width, VIEW.height, PALETTE.grass);
    // Mown stripes for texture.
    const stripe = 90;
    const first = Math.floor(y0 / stripe) * stripe;
    for (let y = first; y < y0 + VIEW.height; y += stripe * 2) {
      rect(x0, y, VIEW.width, stripe, PALETTE.grassDark);
    }
    // Sea and sand at the south edge.
    if (y0 + VIEW.height > BEACH_Y) {
      rect(x0, BEACH_Y, VIEW.width, SEA_Y - BEACH_Y, PALETTE.sand);
      rect(x0, SEA_Y, VIEW.width, y0 + VIEW.height - SEA_Y, PALETTE.sea);
      rect(x0, SEA_Y + 40, VIEW.width, 10, PALETTE.seaDeep);
      for (let x = Math.floor(x0 / 260) * 260; x < x0 + VIEW.width; x += 260) {
        rect(x, SEA_Y + 40, 130, 10, PALETTE.seaDeep);
        rect(x + 60, SEA_Y + 120, 130, 10, PALETTE.seaDeep);
      }
    }
    // Parks.
    for (const park of city.parks) {
      rect(park.x, park.y, park.w, park.h, PALETTE.park);
      ctx.strokeStyle = '#4a7a3c';
      ctx.lineWidth = 4;
      ctx.strokeRect(park.x, park.y, park.w, park.h);
    }
    // Roads: asphalt, centre dashes, then crosswalks at intersections.
    for (const c of city.vRoads) {
      rect(c - ROAD_WIDTH / 2, y0, ROAD_WIDTH, VIEW.height, PALETTE.road);
      for (let y = Math.floor(y0 / 60) * 60; y < y0 + VIEW.height; y += 60) {
        rect(c - 2, y, 4, 28, PALETTE.roadLine);
      }
    }
    for (const c of city.hRoads) {
      rect(x0, c - ROAD_WIDTH / 2, VIEW.width, ROAD_WIDTH, PALETTE.road);
      for (let x = Math.floor(x0 / 60) * 60; x < x0 + VIEW.width; x += 60) {
        rect(x, c - 2, 28, 4, PALETTE.roadLine);
      }
    }
    ctx.fillStyle = 'rgba(240,240,230,0.75)';
    for (const vx of city.vRoads) {
      for (const hy of city.hRoads) {
        if (!inView(vx, hy, 200)) continue;
        for (let i = -3; i <= 3; i += 1) ctx.fillRect(vx + i * 12 - 4, hy - ROAD_WIDTH / 2 + 8, 8, 18);
      }
    }
    // Trees.
    for (const t of city.trees) {
      if (!inView(t.x, t.y, 40)) continue;
      circle(t.x, t.y, t.r, '#3f7a34');
      circle(t.x - 3, t.y - 3, t.r * 0.7, '#5d9e4f');
    }
    // Buildings: shadow, roof, edge, rooftop details, label.
    for (const b of city.buildings) {
      if (!inView(b.x + b.w / 2, b.y + b.h / 2, 200)) continue;
      rect(b.x + 8, b.y + 10, b.w, b.h, 'rgba(0,0,0,0.25)');
      rect(b.x, b.y, b.w, b.h, b.color);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 3;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      if (b.tall) rect(b.x + 8, b.y + 8, b.w - 16, b.h * 0.3, 'rgba(255,255,255,0.18)');
      rect(b.x + b.w * 0.2, b.y + b.h * 0.25, 14, 10, 'rgba(0,0,0,0.22)');
      rect(b.x + b.w * 0.65, b.y + b.h * 0.6, 12, 12, 'rgba(0,0,0,0.22)');
      if (b.name && b.w > 90) label(b.name, b.x + b.w / 2, b.y + b.h / 2 + 5, 13, 'rgba(255,255,255,0.85)', 'center', 'bold');
    }
    // District names painted on the ground.
    for (const d of DISTRICTS) {
      if (!inView(d.x, d.y, 100)) continue;
      label(d.name.toUpperCase(), d.x, d.y, 22, 'rgba(255,255,255,0.55)', 'center', 'bold');
    }
  }

  /** A pulsing ring marker: mission targets, cash bags, Otto's garage. */
  function ring(x, y, color, caption, pulse) {
    const r = 16 + (pulse ? Math.sin(performance.now() / 240) * 4 : 0);
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    circle(x, y, 6, color);
    if (caption) label(caption, x, y - r - 8, 15, color, 'center', 'bold');
  }

  function paintCar(car, isPlayer) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    rect(-30, -12, 62, 32, 'rgba(0,0,0,0.3)');
    rect(-32, -15, 64, 30, car.model.color);
    rect(-8, -13, 20, 26, '#20262e'); // cabin
    rect(-4, -13, 12, 26, 'rgba(180,220,240,0.7)'); // windshield
    rect(28, -12, 4, 7, '#f5e6a0');
    rect(28, 5, 4, 7, '#f5e6a0'); // headlights
    rect(-32, -12, 4, 7, '#e5534b');
    rect(-32, 5, 4, 7, '#e5534b'); // taillights
    if (isPlayer) {
      ctx.strokeStyle = PALETTE.gold;
      ctx.lineWidth = 3;
      ctx.strokeRect(-32, -15, 64, 30);
    }
    ctx.restore();
  }

  function paintPoliceCar(car, flash) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    rect(-30, -12, 62, 32, 'rgba(0,0,0,0.3)');
    rect(-32, -15, 64, 30, '#e8e8e8');
    rect(-32, -15, 64, 8, PALETTE.police);
    rect(-8, -13, 20, 26, '#20262e');
    rect(-2, -19, 12, 8, flash ? '#ff3b30' : '#3d7bd6'); // light bar, left
    rect(-2, 11, 12, 8, flash ? '#3d7bd6' : '#ff3b30'); // light bar, right
    ctx.restore();
    label('POLICE', car.x, car.y - 26, 11, '#ffffff', 'center', 'bold');
  }

  function paintPerson(p, isPlayer, isCop, isGang) {
    if (p.dead) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      rect(-12, -5, 24, 10, '#5a3a3a');
      ctx.restore();
      return;
    }
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(2, 3, 12, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    circle(0, 0, 11, isCop ? '#1f3a6e' : isGang ? '#3a3f46' : p.shirt);
    circle(4, 0, 6, p.skin || '#e8b88a');
    if (isPlayer) {
      rect(-8, -8, 10, 4, '#7a2e2e'); // Mara's red jacket stripe
      ctx.strokeStyle = PALETTE.gold;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function paintMarkers(state) {
    for (const pk of state.pickups) {
      if (pk.taken || !inView(pk.x, pk.y, 40)) continue;
      const bob = Math.sin(pk.bob) * 3;
      const dot = pk.kind === 'health' ? '#ffffff' : pk.kind === 'ammo' ? '#f2c94c' : '#7ee081';
      circle(pk.x, pk.y + bob, 10, dot);
      label(pk.kind === 'health' ? '+' : pk.kind === 'ammo' ? 'A' : '$', pk.x, pk.y + bob + 4, 12, pk.kind === 'health' ? '#e5534b' : '#222', 'center', 'bold');
    }
    for (const bag of state.missions.bags) {
      if (!bag.taken) ring(bag.x, bag.y, PALETTE.gold, '$', true);
    }
    const stage = currentStage(state.missions);
    if (state.missions.active && stage && stage.kind === 'goto') {
      ring(stage.x, stage.y, PALETTE.mission, '◆', true);
    }
    if (state.missions.sideJob) {
      ring(state.missions.sideJob.x, state.missions.sideJob.y, '#7ee081', 'JOB', true);
    }
    if (!state.missions.active && currentMission(state.missions)) {
      // Otto's garage: where the next mission starts.
      ring(640, 640, PALETTE.mission, 'OTTO', true);
    }
  }

  function paintActors(state) {
    for (const car of state.cars) {
      if (!inView(car.x, car.y, 80)) continue;
      if (state.player.inCar && car === state.player.car) continue;
      paintCar(car, false);
    }
    if (state.player.inCar && state.player.car) paintCar(state.player.car, true);
    const flash = Math.floor(performance.now() / 300) % 2 === 0;
    for (const car of state.police.cars) {
      if (inView(car.x, car.y, 80)) paintPoliceCar(car, flash);
    }
    for (const ped of state.peds) {
      if (inView(ped.x, ped.y, 40)) paintPerson(ped, false, false, ped.gang);
    }
    for (const enemy of state.missions.enemies) {
      if (inView(enemy.x, enemy.y, 40)) paintPerson(enemy, false, false, true);
    }
    for (const cop of state.police.cops) {
      if (inView(cop.x, cop.y, 40)) paintPerson(cop, false, true, false);
    }
    if (!state.player.inCar) paintPerson(state.player, true, false, false);
  }

  function paintShots(state) {
    ctx.strokeStyle = '#ffe9a0';
    ctx.lineWidth = 3;
    for (const b of state.combat.bullets) {
      ctx.beginPath();
      ctx.moveTo(b.x - Math.cos(b.angle) * 14, b.y - Math.sin(b.angle) * 14);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    if (state.combat.muzzle > 0 && !state.player.inCar) {
      circle(
        state.player.x + Math.cos(state.player.angle) * 26,
        state.player.y + Math.sin(state.player.angle) * 26,
        10, '#ffd94d',
      );
    }
  }

  function paintWorld(state) {
    cam = state.camera;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    rect(0, 0, canvas.width, canvas.height, PALETTE.backdrop);
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    ctx.save();
    ctx.translate(-(cam.x - VIEW.width / 2), -(cam.y - VIEW.height / 2));
    paintTerrain(state);
    paintMarkers(state);
    paintActors(state);
    paintShots(state);
    ctx.restore();
  }

  function paintMinimap(state) {
    const mx = (x) => MINIMAP.x + x * MAP_SX;
    const my = (y) => MINIMAP.y + y * MAP_SY;
    rect(MINIMAP.x, MINIMAP.y, MINIMAP.w, MINIMAP.h, 'rgba(10,16,22,0.85)');
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(MINIMAP.x, MINIMAP.y, MINIMAP.w, MINIMAP.h);
    rect(MINIMAP.x, my(2460), MINIMAP.w, MINIMAP.y + MINIMAP.h - my(2460), PALETTE.sea);
    ctx.strokeStyle = 'rgba(235,235,225,0.95)';
    ctx.lineWidth = 2;
    for (const c of state.city.vRoads) {
      ctx.beginPath();
      ctx.moveTo(mx(c), MINIMAP.y);
      ctx.lineTo(mx(c), MINIMAP.y + MINIMAP.h);
      ctx.stroke();
    }
    for (const c of state.city.hRoads) {
      ctx.beginPath();
      ctx.moveTo(MINIMAP.x, my(c));
      ctx.lineTo(MINIMAP.x + MINIMAP.w, my(c));
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(93,158,79,0.9)';
    for (const park of state.city.parks) {
      ctx.fillRect(mx(park.x), my(park.y), park.w * MAP_SX, park.h * MAP_SY);
    }
    const stage = currentStage(state.missions);
    if (state.missions.active && stage && stage.kind === 'goto') {
      circle(mx(stage.x), my(stage.y), 5, PALETTE.mission);
    }
    if (state.missions.sideJob) {
      circle(mx(state.missions.sideJob.x), my(state.missions.sideJob.y), 4, '#7ee081');
    }
    ctx.fillStyle = '#5a9dff';
    for (const car of state.police.cars) {
      ctx.beginPath();
      ctx.arc(mx(car.x), my(car.y), 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.save();
    ctx.translate(mx(state.player.x), my(state.player.y));
    ctx.rotate(state.player.angle);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-5, -5);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    label('SOLARA BAY', MINIMAP.x + MINIMAP.w / 2, MINIMAP.y + MINIMAP.h + 16, 11, 'rgba(255,255,255,0.7)', 'center', 'bold');
  }

  /** Wanted stars, top centre: filled stars for the heat, empty for the rest. */
  function paintStars(stars) {
    const row = '★'.repeat(stars) + '☆'.repeat(5 - stars);
    label(row, VIEW.width / 2, 44, 30, stars > 0 ? PALETTE.wanted : 'rgba(255,255,255,0.35)', 'center', 'bold');
    if (stars > 0) label('WANTED', VIEW.width / 2, 66, 13, PALETTE.wanted, 'center', 'bold');
  }

  function paintHud(state) {
    const p = state.player;
    const stage = currentStage(state.missions);
    // Top-left: cash, name, health bar, ammo.
    rect(14, 14, 250, 86, 'rgba(10,16,22,0.72)');
    ctx.strokeStyle = 'rgba(242,201,76,0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(14, 14, 250, 86);
    label(`$${state.cash.toLocaleString('en-US')}`, 26, 44, 26, PALETTE.gold, 'left', 'bold');
    label('MARA VOSS', 26, 66, 13, PALETTE.muted, 'left', 'bold');
    rect(26, 74, 150, 12, '#333');
    rect(26, 74, 150 * Math.max(0, p.health / 100), 12, p.health > 40 ? '#7ee081' : '#e5534b');
    label('HP', 182, 86, 12, PALETTE.text, 'left', 'bold');
    label(`AMMO ${p.ammo}`, 196, 44, 15, PALETTE.text, 'left', 'bold');
    paintStars(state.police.stars);
    paintMinimap(state);
    // Clock and district under the minimap.
    const hh = Math.floor(state.dayMinutes / 60);
    const mm = Math.floor(state.dayMinutes % 60);
    label(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, MINIMAP.x + MINIMAP.w, MINIMAP.y + MINIMAP.h + 34, 16, PALETTE.text, 'right', 'bold');
    label((state.district || 'Solara Bay').toUpperCase(), MINIMAP.x + MINIMAP.w, MINIMAP.y + MINIMAP.h + 52, 12, PALETTE.muted, 'right', 'bold');
    // Mission panel, bottom-left.
    const mission = currentMission(state.missions);
    rect(14, VIEW.height - 96, 470, 82, 'rgba(10,16,22,0.72)');
    ctx.strokeStyle = 'rgba(242,201,76,0.6)';
    ctx.strokeRect(14, VIEW.height - 96, 470, 82);
    if (mission) {
      const stageText = state.missions.active && stage ? stage.text : `Next: ${mission.title} — go to OTTO (Q for a side job)`;
      label(`${mission.id}. ${mission.title}  •  $${mission.reward}`, 26, VIEW.height - 66, 17, PALETTE.mission, 'left', 'bold');
      label(stageText, 26, VIEW.height - 40, 15, PALETTE.text, 'left');
      if (state.missions.active && stage && stage.timer) {
        label(`${Math.ceil(state.missions.timer)}s`, 460, VIEW.height - 66, 17, '#ff9d6b', 'right', 'bold');
      }
      if (state.missions.active && stage && stage.survive) {
        label(`Survive ${Math.ceil(state.missions.survive)}s`, 460, VIEW.height - 40, 15, '#ff9d6b', 'right', 'bold');
      }
    } else {
      label('STORY COMPLETE — Solara Bay is yours.', 26, VIEW.height - 66, 17, PALETTE.gold, 'left', 'bold');
      label('Free roam: steal cars, dodge the police, take side jobs (Q).', 26, VIEW.height - 40, 15, PALETTE.text, 'left');
    }
    // Speed and controls, bottom-right.
    if (p.inCar) {
      const kmh = Math.round(Math.abs(p.carSpeed) * 0.36);
      label(`${kmh}`, VIEW.width - 26, VIEW.height - 40, 40, PALETTE.text, 'right', 'bold');
      label('km/h', VIEW.width - 26, VIEW.height - 16, 13, PALETTE.muted, 'right');
      label('E exit car', VIEW.width - 26, VIEW.height - 96, 14, PALETTE.muted, 'right');
    } else {
      label('WASD move • E steal car • F punch • Click shoot • Shift sprint', VIEW.width - 26, VIEW.height - 16, 13, PALETTE.muted, 'right');
    }
    // Dialogue / message bar, centre-bottom.
    if (state.missions.messageTimer > 0 && state.missions.message) {
      const msg = state.missions.message;
      const w = Math.min(900, 40 + msg.length * 7.2);
      rect((VIEW.width - w) / 2, VIEW.height - 170, w, 52, 'rgba(10,16,22,0.85)');
      ctx.strokeStyle = PALETTE.panelEdge;
      ctx.strokeRect((VIEW.width - w) / 2, VIEW.height - 170, w, 52);
      label(msg, VIEW.width / 2, VIEW.height - 136, 16, PALETTE.text, 'center');
    }
    // "Press E to steal" prompt.
    if (!p.inCar && state.nearCar) {
      label(`Press E to steal the ${state.nearCar.model.name}`, VIEW.width / 2, VIEW.height - 190, 18, PALETTE.gold, 'center', 'bold');
    }
  }

  /** A centred panel with a big title, lines of text and a prompt at the foot. */
  function paintPanel(title, lines, prompt, accent) {
    const width = 720;
    const height = 150 + lines.length * 34 + 60;
    const x = (VIEW.width - width) / 2;
    const y = (VIEW.height - height) / 2;
    rect(x, y, width, height, PALETTE.panel);
    ctx.strokeStyle = accent || PALETTE.panelEdge;
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, width, height);
    label(title, VIEW.width / 2, y + 72, 52, accent || PALETTE.gold, 'center', 'bold');
    for (let i = 0; i < lines.length; i += 1) {
      label(lines[i], VIEW.width / 2, y + 130 + i * 34, 20, PALETTE.text, 'center');
    }
    label(prompt, VIEW.width / 2, y + height - 30, 20, PALETTE.gold, 'center', 'bold');
  }

  function draw(state, screen, extra) {
    paintWorld(state);
    if (screen === SCREEN_TITLE) {
      rect(0, 0, VIEW.width, VIEW.height, 'rgba(8,14,20,0.55)');
      const saveLine = extra && extra.saveSummary ? [extra.saveSummary] : [];
      paintPanel('SOLARA BAY', [
        'Mara Voss is back in Solara Bay — broke, and owed a favour by Otto.',
        'Steal cars, outrun the police, run five story missions, survive the Bay.',
        'WASD move / drive • E steal car • F punch • Click to shoot • P pause • G save',
        '',
        'An original game. Its city, people and story are invented here —',
        'nothing is taken from any commercial game.',
        ...saveLine,
      ], extra && extra.hasSave ? 'Press Enter: Continue • N: New game' : 'Press Enter or click to start', PALETTE.gold);
      return;
    }
    paintHud(state);
    if (screen === SCREEN_PAUSED) {
      paintPanel('PAUSED', [
        'The Bay waits for no one — except now.',
        `Cash $${state.cash.toLocaleString('en-US')} • Missions done ${state.missions.completedCount}/5`,
      ], 'Press P to resume • G to save');
    } else if (screen === SCREEN_BUSTED) {
      paintPanel('BUSTED', [
        'The Solara Bay police caught up with Mara.',
        'You lose $200 bail and the heat cools off.',
      ], 'Press Enter to get back out there', '#5a9dff');
    } else if (screen === SCREEN_WASTED) {
      paintPanel('WASTED', [
        'Mara went down in Solara Bay.',
        'The story is not over — the hospital patches her up.',
      ], 'Press Enter to continue', PALETTE.red);
    } else if (screen === SCREEN_DONE) {
      paintPanel('STORY COMPLETE', [
        'Mara Voss drives out of Solara Bay a legend — and free.',
        `Final cash $${state.cash.toLocaleString('en-US')} • Cars stolen ${state.stats.carsStolen}`,
      ], 'Press Enter to keep roaming free', PALETTE.gold);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
