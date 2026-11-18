// HUD: the DOM readouts (health, money, wanted stars, objective, speed,
// ammo) and the live canvas minimap showing roads, districts, the player,
// the mission marker and police units.
import { DISTRICTS, WORLD_WIDTH, WORLD_HEIGHT } from './city.js';
import { missionObjectiveText } from './missions.js';

export function createHud(documentRef) {
  const $ = (id) => documentRef.getElementById(id);
  return {
    healthFill: $('health-fill'),
    healthText: $('health-text'),
    money: $('money'),
    stars: $('stars'),
    objective: $('objective-text'),
    speed: $('speed'),
    ammo: $('ammo'),
    district: $('district'),
    dialogue: $('dialogue'),
    toast: $('toast'),
    minimap: $('minimap'),
    toastTimer: 0,
  };
}

export function showToast(hud, text) {
  if (!hud.toast) return;
  hud.toast.textContent = text;
  hud.toast.classList.add('show');
  hud.toastTimer = 2.6;
}

export function updateHudDom(hud, player, state, districtName, dt) {
  if (hud.healthFill) {
    hud.healthFill.style.width = `${Math.max(0, player.health)}%`;
    hud.healthFill.style.background = player.health > 50 ? '#3aa86a' : player.health > 25 ? '#e8a832' : '#d84a4a';
  }
  if (hud.healthText) hud.healthText.textContent = `${Math.ceil(player.health)} HP`;
  if (hud.money) hud.money.textContent = `$${player.money}`;
  if (hud.stars) {
    let s = '';
    for (let i = 0; i < 5; i += 1) s += i < player.wanted ? '★' : '☆';
    hud.stars.textContent = s;
    hud.stars.classList.toggle('hot', player.wanted >= 3);
  }
  if (hud.objective) hud.objective.textContent = missionObjectiveText(state.missions);
  if (hud.speed) {
    const kmh = player.onFoot ? 0 : Math.round(Math.abs(player.car.speed) * 0.36);
    hud.speed.textContent = player.onFoot ? 'ON FOOT' : `${kmh} km/h`;
  }
  if (hud.ammo) hud.ammo.textContent = `Ammo ${player.ammo}`;
  if (hud.district) hud.district.textContent = districtName;
  if (hud.dialogue) {
    const line = state.missions.currentLine;
    if (line) {
      hud.dialogue.textContent = line;
      hud.dialogue.classList.add('show');
    } else {
      hud.dialogue.classList.remove('show');
    }
  }
  if (hud.toastTimer > 0) {
    hud.toastTimer -= dt;
    if (hud.toastTimer <= 0 && hud.toast) hud.toast.classList.remove('show');
  }
}

// Draw the minimap: district blocks, roads, water, marker, police, player.
export function drawMinimap(hud, city, player, people, marker) {
  const canvas = hud.minimap;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const sx = W / WORLD_WIDTH;
  const sy = H / WORLD_HEIGHT;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#101018';
  ctx.fillRect(0, 0, W, H);
  // District blocks.
  for (const d of DISTRICTS) {
    ctx.fillStyle = d.ground;
    ctx.globalAlpha = 0.55;
    ctx.fillRect(d.x * sx, d.y * sy, d.w * sx, d.h * sy);
  }
  ctx.globalAlpha = 1;
  // Water on the west edge and beach on the south.
  ctx.fillStyle = '#2e7d9e';
  ctx.fillRect(0, 0, 150 * sx, H);
  ctx.fillStyle = '#e8d8a0';
  ctx.fillRect(1066 * sx, 2280 * sy, 1067 * sx, H - 2280 * sy);
  // Roads.
  ctx.strokeStyle = '#e8e8e8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = 320; x < WORLD_WIDTH; x += 320) {
    ctx.moveTo(x * sx, 0);
    ctx.lineTo(x * sx, H);
  }
  for (let y = 320; y < WORLD_HEIGHT; y += 320) {
    ctx.moveTo(0, y * sy);
    ctx.lineTo(W, y * sy);
  }
  ctx.stroke();
  // Mission marker: yellow diamond (steady size so staged shots repeat).
  if (marker) {
    const pulse = 6;
    ctx.fillStyle = '#ffd832';
    ctx.beginPath();
    ctx.moveTo(marker.x * sx, marker.y * sy - pulse);
    ctx.lineTo(marker.x * sx + pulse, marker.y * sy);
    ctx.lineTo(marker.x * sx, marker.y * sy + pulse);
    ctx.lineTo(marker.x * sx - pulse, marker.y * sy);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#202020';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  // Police: red dots and blue/white cars.
  ctx.fillStyle = '#ff3a3a';
  for (const o of people.officers) {
    if (o.down) continue;
    ctx.beginPath();
    ctx.arc(o.x * sx, o.y * sy, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const c of people.policeCars) {
    ctx.fillStyle = '#3a6aff';
    ctx.fillRect(c.x * sx - 3, c.y * sy - 3, 6, 6);
    ctx.fillStyle = '#ff3a3a';
  }
  // Player: white dot with a dark ring, always on top.
  const px = player.onFoot ? player.x : player.car.x;
  const py = player.onFoot ? player.y : player.car.y;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(px * sx, py * sy, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#202020';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}
