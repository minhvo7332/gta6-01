// Drawing only: the city, the cars and people in it, and every screen — the HUD
// with its minimap, the title, pause, busted and wasted panels. The camera follows
// the player through a 1280 x 720 window onto the 3600 x 2600 city.

import { DISTRICTS, FONT, PALETTE, VIEW, WORLD, CAR_MODELS } from './config.js';
import { BEACH_Y, ROAD_WIDTH, SEA_Y } from './city.js';
import { currentMission, currentStage } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_DONE = 'done';

const MAP = { x: 1052, y: 14, w: 214, h: 154 };
const MAP_SCALE_X = MAP.w / WORLD.width;
const MAP_SCALE_Y = MAP.h / WORLD.height;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    view.scale = Math.min(canvas.width / VIEW.width, canvas.height / VIEW.height);
    view.x = (canvas.width - VIEW.width * view.scale) / 2;
    view.y = (canvas.height - VIEW.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align = 'left', weight = '') {
    const key = `${weight}${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight} ${size}px ${FONT}`);
    ctx.font = fonts.get(key);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }

  function visible(x, y, margin) {
    const cam = currentCamera;
    return x > cam.x - VIEW.width / 2 - margin && x < cam.x + VIEW.width / 2 + margin
      && y > cam.y - VIEW.height / 2 - margin && y < cam.y + VIEW.height / 2 + margin;
  }

  let currentCamera = { x: 640, y: 360 };

  function drawGround(state) {
    const city = state.city;
    const cam = state.camera;
    const x0 = cam.x - VIEW.width / 2;
    const y0 = cam.y - VIEW.height / 2;
    // Grass base.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(x0, y0, VIEW.width, VIEW.height);
    // Mown stripes for texture.
    ctx.fillStyle = PALETTE.grassDark;
    const stripe = 90;
    const first = Math.floor(y0 / stripe) * stripe;
    for (let y = first; y < y0 + VIEW.height; y += stripe * 2) {
      ctx.fillRect(x0, y, VIEW.width, stripe);
    }
    // Sea and sand at the south edge.
    if (y0 + VIEW.height > BEACH_Y) {
      ctx.fillStyle = PALETTE.sand;
      ctx.fillRect(x0, BEACH_Y, VIEW.width, SEA_Y - BEACH_Y);
      ctx.fillStyle = PALETTE.sea;
      ctx.fillRect(x0, SEA_Y, VIEW.width, y0 + VIEW.height - SEA_Y);
      ctx.fillStyle = PALETTE.seaDeep;
      for (let x = Math.floor(x0 / 260) * 260; x < x0 + VIEW.width; x += 260) {
        ctx.fillRect(x, SEA_Y + 40, 130, 10);
        ctx.fillRect(x + 60, SEA_Y + 120, 130, 10);
      }
    }
    // Parks.
    for (const park of city.parks) {
      ctx.fillStyle = PALETTE.park;
      ctx.fillRect(park.x, park.y, park.w, park.h);
      ctx.strokeStyle = '#4a7a3c';
      ctx.lineWidth = 4;
      ctx.strokeRect(park.x, park.y, park.w, park.h);
    }
    // Roads: asphalt, then centre dashes, then edge lines.
    for (const c of city.vRoads) {
      ctx.fillStyle = PALETTE.road;
      ctx.fillRect(c - ROAD_WIDTH / 2, y0, ROAD_WIDTH, VIEW.height);
      ctx.fillStyle = PALETTE.roadLine;
      for (let y = Math.floor(y0 / 60) * 60; y < y0 + VIEW.height; y += 60) ctx.fillRect(c - 2, y, 4, 28);
    }
    for (const c of city.hRoads) {
      ctx.fillStyle = PALETTE.road;
      ctx.fillRect(x0, c - ROAD_WIDTH / 2, VIEW.width, ROAD_WIDTH);
      ctx.fillStyle = PALETTE.roadLine;
      for (let x = Math.floor(x0 / 60) * 60; x < x0 + VIEW.width; x += 60) ctx.fillRect(x, c - 2, 28, 4);
    }
    // Crosswalks at intersections.
    ctx.fillStyle = 'rgba(240,240,230,0.75)';
    for (const vx of city.vRoads) {
      for (const hy of city.hRoads) {
        if (!visible(vx, hy, 200)) continue;
        for (let i = -3; i <= 3; i += 1) ctx.fillRect(vx + i * 12 - 4, hy - ROAD_WIDTH / 2 + 8, 8, 18);
      }
    }
    // Trees.
    for (const t of city.trees) {
      if (!visible(t.x, t.y, 40)) continue;
      ctx.fillStyle = '#3f7a34';
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5d9e4f';
      ctx.beginPath();
      ctx.arc(t.x - 3, t.y - 3, t.r * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
    // Buildings: shadow, roof, edge, label.
    for (const b of city.buildings) {
      if (!visible(b.x + b.w / 2, b.y + b.h / 2, 200)) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(b.x + 8, b.y + 10, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 3;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      if (b.tall) {
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, b.h * 0.3);
      }
      // Rooftop details: vents and skylights.
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(b.x + b.w * 0.2, b.y + b.h * 0.25, 14, 10);
      ctx.fillRect(b.x + b.w * 0.65, b.y + b.h * 0.6, 12, 12);
      if (b.name && b.w > 90) text(b.name, b.x + b.w / 2, b.y + b.h / 2 + 5, 13, 'rgba(255,255,255,0.85)', 'center', 'bold');
    }
    // District labels on the ground.
    for (const d of DISTRICTS) {
      if (!visible(d.x, d.y, 100)) continue;
      text(d.name.toUpperCase(), d.x, d.y, 22, 'rgba(255,255,255,0.55)', 'center', 'bold');
    }
  }

  function drawCarShape(car, isPlayer) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-30, -12, 62, 32);
    ctx.fillStyle = car.model.color;
    ctx.fillRect(-32, -15, 64, 30);
    ctx.fillStyle = '#20262e';
    ctx.fillRect(-8, -13, 20, 26); // cabin
    ctx.fillStyle = 'rgba(180,220,240,0.7)';
    ctx.fillRect(-4, -13, 12, 26); // windshield
    ctx.fillStyle = '#f5e6a0';
    ctx.fillRect(28, -12, 4, 7);
    ctx.fillRect(28, 5, 4, 7); // headlights
    ctx.fillStyle = '#e5534b';
    ctx.fillRect(-32, -12, 4, 7);
    ctx.fillRect(-32, 5, 4, 7); // taillights
    if (isPlayer) {
      ctx.strokeStyle = PALETTE.gold;
      ctx.lineWidth = 3;
      ctx.strokeRect(-32, -15, 64, 30);
    }
    ctx.restore();
  }

  function drawPoliceCar(car, flash) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-30, -12, 62, 32);
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(-32, -15, 64, 30);
    ctx.fillStyle = PALETTE.police;
    ctx.fillRect(-32, -15, 64, 8);
    ctx.fillStyle = '#20262e';
    ctx.fillRect(-8, -13, 20, 26);
    ctx.fillStyle = flash ? '#ff3b30' : '#3d7bd6';
    ctx.fillRect(-2, -19, 12, 8); // light bar
    ctx.fillStyle = flash ? '#3d7bd6' : '#ff3b30';
    ctx.fillRect(-2, 11, 12, 8);
    ctx.restore();
    text('POLICE', car.x, car.y - 26, 11, '#ffffff', 'center', 'bold');
  }

  function drawPerson(p, isPlayer, isCop, isGang) {
    if (p.dead) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = '#5a3a3a';
      ctx.fillRect(-12, -5, 24, 10);
      ctx.restore();
      return;
    }
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    // Shadow, body, head, facing tick.
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(2, 3, 12, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = isCop ? '#1f3a6e' : isGang ? '#3a3f46' : p.shirt;
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.skin || '#e8b88a';
    ctx.beginPath();
    ctx.arc(4, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    if (isPlayer) {
      ctx.fillStyle = '#7a2e2e';
      ctx.fillRect(-8, -8, 10, 4); // Mara's red jacket stripe
      ctx.strokeStyle = PALETTE.gold;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawMarker(x, y, color, label, pulse) {
    const r = 16 + (pulse ? Math.sin(performance.now() / 240) * 4 : 0);
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
    if (label) text(label, x, y - r - 8, 15, color, 'center', 'bold');
  }

  function drawWorld(state) {
    currentCamera = state.camera;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    ctx.save();
    const camX = state.camera.x - VIEW.width / 2;
    const camY = state.camera.y - VIEW.height / 2;
    ctx.translate(-camX, -camY);
    drawGround(state);
    // Pickups.
    for (const pk of state.pickups) {
      if (pk.taken || !visible(pk.x, pk.y, 40)) continue;
      const bob = Math.sin(pk.bob) * 3;
      ctx.fillStyle = pk.kind === 'health' ? '#ffffff' : pk.kind === 'ammo' ? '#f2c94c' : '#7ee081';
      ctx.beginPath();
      ctx.arc(pk.x, pk.y + bob, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = pk.kind === 'health' ? '#e5534b' : '#222';
      text(pk.kind === 'health' ? '+' : pk.kind === 'ammo' ? 'A' : '$', pk.x, pk.y + bob + 4, 12, pk.kind === 'health' ? '#e5534b' : '#222', 'center', 'bold');
    }
    // Mission cash bags.
    for (const bag of state.missions.bags) {
      if (bag.taken) continue;
      drawMarker(bag.x, bag.y, PALETTE.gold, '$', true);
    }
    // Mission / side-job markers.
    const stage = currentStage(state.missions);
    if (state.missions.active && stage && stage.kind === 'goto') {
      drawMarker(stage.x, stage.y, PALETTE.mission, '◆', true);
    }
    if (state.missions.sideJob) {
      drawMarker(state.missions.sideJob.x, state.missions.sideJob.y, '#7ee081', 'JOB', true);
    }
    if (!state.missions.active && currentMission(state.missions)) {
      // Otto's garage: where the next mission starts.
      drawMarker(640, 640, PALETTE.mission, 'OTTO', true);
    }
    // Cars, police, people, player.
    for (const car of state.cars) {
      if (!visible(car.x, car.y, 80)) continue;
      if (state.player.inCar && car === state.player.car) continue;
      drawCarShape(car, false);
    }
    if (state.player.inCar && state.player.car) drawCarShape(state.player.car, true);
    const flash = Math.floor(performance.now() / 300) % 2 === 0;
    for (const car of state.police.cars) {
      if (visible(car.x, car.y, 80)) drawPoliceCar(car, flash);
    }
    for (const ped of state.peds) {
      if (visible(ped.x, ped.y, 40)) drawPerson(ped, false, false, ped.gang);
    }
    for (const enemy of state.missions.enemies) {
      if (visible(enemy.x, enemy.y, 40)) drawPerson(enemy, false, false, true);
    }
    for (const cop of state.police.cops) {
      if (visible(cop.x, cop.y, 40)) drawPerson(cop, false, true, false);
    }
    if (!state.player.inCar) drawPerson(state.player, true, false, false);
    // Bullets and muzzle flash.
    ctx.strokeStyle = '#ffe9a0';
    ctx.lineWidth = 3;
    for (const b of state.combat.bullets) {
      ctx.beginPath();
      ctx.moveTo(b.x - Math.cos(b.angle) * 14, b.y - Math.sin(b.angle) * 14);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    if (state.combat.muzzle > 0 && !state.player.inCar) {
      ctx.fillStyle = '#ffd94d';
      ctx.beginPath();
      ctx.arc(state.player.x + Math.cos(state.player.angle) * 26, state.player.y + Math.sin(state.player.angle) * 26, 10, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawMinimap(state) {
    ctx.fillStyle = 'rgba(10,16,22,0.85)';
    ctx.fillRect(MAP.x, MAP.y, MAP.w, MAP.h);
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(MAP.x, MAP.y, MAP.w, MAP.h);
    const mx = (x) => MAP.x + x * MAP_SCALE_X;
    const my = (y) => MAP.y + y * MAP_SCALE_Y;
    // Sea.
    ctx.fillStyle = PALETTE.sea;
    ctx.fillRect(MAP.x, my(2460), MAP.w, MAP.y + MAP.h - my(2460));
    // Roads, drawn bright so the map reads at a glance.
    ctx.strokeStyle = 'rgba(235,235,225,0.95)';
    ctx.lineWidth = 2;
    for (const c of state.city.vRoads) {
      ctx.beginPath(); ctx.moveTo(mx(c), MAP.y); ctx.lineTo(mx(c), MAP.y + MAP.h); ctx.stroke();
    }
    for (const c of state.city.hRoads) {
      ctx.beginPath(); ctx.moveTo(MAP.x, my(c)); ctx.lineTo(MAP.x + MAP.w, my(c)); ctx.stroke();
    }
    // Parks as green blocks.
    ctx.fillStyle = 'rgba(93,158,79,0.9)';
    for (const park of state.city.parks) ctx.fillRect(mx(park.x), my(park.y), park.w * MAP_SCALE_X, park.h * MAP_SCALE_Y);
    // Mission marker.
    const stage = currentStage(state.missions);
    if (state.missions.active && stage && stage.kind === 'goto') {
      ctx.fillStyle = PALETTE.mission;
      ctx.beginPath(); ctx.arc(mx(stage.x), my(stage.y), 5, 0, Math.PI * 2); ctx.fill();
    }
    if (state.missions.sideJob) {
      ctx.fillStyle = '#7ee081';
      ctx.beginPath(); ctx.arc(mx(state.missions.sideJob.x), my(state.missions.sideJob.y), 4, 0, Math.PI * 2); ctx.fill();
    }
    // Police dots.
    ctx.fillStyle = '#5a9dff';
    for (const car of state.police.cars) { ctx.beginPath(); ctx.arc(mx(car.x), my(car.y), 3, 0, Math.PI * 2); ctx.fill(); }
    // Player arrow.
    ctx.save();
    ctx.translate(mx(state.player.x), my(state.player.y));
    ctx.rotate(state.player.angle);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5); ctx.closePath();
    ctx.fill();
    ctx.restore();
    text('SOLARA BAY', MAP.x + MAP.w / 2, MAP.y + MAP.h + 16, 11, 'rgba(255,255,255,0.7)', 'center', 'bold');
  }

  function drawHud(state) {
    const p = state.player;
    const stage = currentStage(state.missions);
    // Top-left: cash, health, ammo.
    ctx.fillStyle = 'rgba(10,16,22,0.72)';
    ctx.fillRect(14, 14, 250, 86);
    ctx.strokeStyle = 'rgba(242,201,76,0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(14, 14, 250, 86);
    text(`$${state.cash.toLocaleString('en-US')}`, 26, 44, 26, PALETTE.gold, 'left', 'bold');
    text(`MARA VOSS`, 26, 66, 13, PALETTE.muted, 'left', 'bold');
    // Health bar.
    ctx.fillStyle = '#333';
    ctx.fillRect(26, 74, 150, 12);
    ctx.fillStyle = p.health > 40 ? '#7ee081' : '#e5534b';
    ctx.fillRect(26, 74, 150 * Math.max(0, p.health / 100), 12);
    text('HP', 182, 86, 12, PALETTE.text, 'left', 'bold');
    text(`AMMO ${p.ammo}`, 196, 44, 15, PALETTE.text, 'left', 'bold');
    // Wanted stars, top centre.
    const stars = state.police.stars;
    if (stars > 0) {
      text('★'.repeat(stars) + '☆'.repeat(5 - stars), VIEW.width / 2, 44, 30, PALETTE.wanted, 'center', 'bold');
      text('WANTED', VIEW.width / 2, 66, 13, PALETTE.wanted, 'center', 'bold');
    } else {
      text('☆☆☆☆☆', VIEW.width / 2, 44, 30, 'rgba(255,255,255,0.35)', 'center', 'bold');
    }
    drawMinimap(state);
    // Clock + district under the minimap.
    const hh = Math.floor(state.dayMinutes / 60);
    const mm = Math.floor(state.dayMinutes % 60);
    text(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, MAP.x + MAP.w, MAP.y + MAP.h + 34, 16, PALETTE.text, 'right', 'bold');
    text((state.district || 'Solara Bay').toUpperCase(), MAP.x + MAP.w, MAP.y + MAP.h + 52, 12, PALETTE.muted, 'right', 'bold');
    // Mission panel, bottom-left.
    const mission = currentMission(state.missions);
    if (mission) {
      ctx.fillStyle = 'rgba(10,16,22,0.72)';
      ctx.fillRect(14, VIEW.height - 96, 470, 82);
      ctx.strokeStyle = 'rgba(242,201,76,0.6)';
      ctx.strokeRect(14, VIEW.height - 96, 470, 82);
      const stageText = state.missions.active && stage ? stage.text : `Next: ${mission.title} — go to OTTO (Q for a side job)`;
      text(`${mission.id}. ${mission.title}  •  $${mission.reward}`, 26, VIEW.height - 66, 17, PALETTE.mission, 'left', 'bold');
      text(stageText, 26, VIEW.height - 40, 15, PALETTE.text, 'left');
      if (state.missions.active && stage && stage.timer) {
        text(`${Math.ceil(state.missions.timer)}s`, 460, VIEW.height - 66, 17, '#ff9d6b', 'right', 'bold');
      }
      if (state.missions.active && stage && stage.survive) {
        text(`Survive ${Math.ceil(state.missions.survive)}s`, 460, VIEW.height - 40, 15, '#ff9d6b', 'right', 'bold');
      }
    } else {
      ctx.fillStyle = 'rgba(10,16,22,0.72)';
      ctx.fillRect(14, VIEW.height - 96, 470, 82);
      text('STORY COMPLETE — Solara Bay is yours.', 26, VIEW.height - 66, 17, PALETTE.gold, 'left', 'bold');
      text('Free roam: steal cars, dodge the police, take side jobs (Q).', 26, VIEW.height - 40, 15, PALETTE.text, 'left');
    }
    // Speed + controls, bottom-right.
    if (p.inCar) {
      const kmh = Math.round(Math.abs(p.carSpeed) * 0.36);
      text(`${kmh}`, VIEW.width - 26, VIEW.height - 40, 40, PALETTE.text, 'right', 'bold');
      text('km/h', VIEW.width - 26, VIEW.height - 16, 13, PALETTE.muted, 'right');
      text('E exit car', VIEW.width - 26, VIEW.height - 96, 14, PALETTE.muted, 'right');
    } else {
      text('WASD move • E steal car • F punch • Click shoot • Shift sprint', VIEW.width - 26, VIEW.height - 16, 13, PALETTE.muted, 'right');
    }
    // Dialogue / message bar, centre-bottom.
    if (state.missions.messageTimer > 0 && state.missions.message) {
      const msg = state.missions.message;
      ctx.fillStyle = 'rgba(10,16,22,0.85)';
      const w = Math.min(900, 40 + msg.length * 7.2);
      ctx.fillRect((VIEW.width - w) / 2, VIEW.height - 170, w, 52);
      ctx.strokeStyle = PALETTE.panelEdge;
      ctx.strokeRect((VIEW.width - w) / 2, VIEW.height - 170, w, 52);
      text(msg, VIEW.width / 2, VIEW.height - 136, 16, PALETTE.text, 'center');
    }
    // "Press E to steal" prompt.
    if (!p.inCar && state.nearCar) {
      text(`Press E to steal the ${state.nearCar.model.name}`, VIEW.width / 2, VIEW.height - 190, 18, PALETTE.gold, 'center', 'bold');
    }
  }

  function drawPanel(title, lines, prompt, accent) {
    const width = 720;
    const height = 150 + lines.length * 34 + 60;
    const x = (VIEW.width - width) / 2;
    const y = (VIEW.height - height) / 2;
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = accent || PALETTE.panelEdge;
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, width, height);
    text(title, VIEW.width / 2, y + 72, 52, accent || PALETTE.gold, 'center', 'bold');
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], VIEW.width / 2, y + 130 + i * 34, 20, PALETTE.text, 'center');
    }
    text(prompt, VIEW.width / 2, y + height - 30, 20, PALETTE.gold, 'center', 'bold');
  }

  function draw(state, screen, extra) {
    drawWorld(state);
    if (screen === SCREEN_TITLE) {
      ctx.fillStyle = 'rgba(8,14,20,0.55)';
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
      drawPanel('SOLARA BAY', [
        'Mara Voss is back in Solara Bay — broke, and owed a favour by Otto.',
        'Steal cars, outrun the police, run five story missions, survive the Bay.',
        'WASD move / drive • E steal car • F punch • Click to shoot • P pause • G save',
        '',
        'An original game. Its city, people and story are invented here —',
        'nothing is taken from any commercial game.',
        ...(extra && extra.saveSummary ? [extra.saveSummary] : []),
      ], extra && extra.hasSave ? 'Press Enter: Continue • N: New game' : 'Press Enter or click to start', PALETTE.gold);
      return;
    }
    drawHud(state);
    if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', ['The Bay waits for no one — except now.', `Cash $${state.cash.toLocaleString('en-US')} • Missions done ${state.missions.completedCount}/5`], 'Press P to resume • G to save');
    } else if (screen === SCREEN_BUSTED) {
      drawPanel('BUSTED', ['The Solara Bay police caught up with Mara.', 'You lose $200 bail and the heat cools off.'], 'Press Enter to get back out there', '#5a9dff');
    } else if (screen === SCREEN_WASTED) {
      drawPanel('WASTED', ['Mara went down in Solara Bay.', 'The story is not over — the hospital patches her up.'], 'Press Enter to continue', PALETTE.red);
    } else if (screen === SCREEN_DONE) {
      drawPanel('STORY COMPLETE', ['Mara Voss drives out of Solara Bay a legend — and free.', `Final cash $${state.cash.toLocaleString('en-US')} • Cars stolen ${state.stats.carsStolen}`], 'Press Enter to keep roaming free', PALETTE.gold);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
