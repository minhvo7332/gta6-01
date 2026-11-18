// The HUD: health, cash, wanted stars, mission objective, messages, the
// minimap, and every screen that is not the city itself — title, pause,
// busted and wasted.
import { WORLD, districtNameAt } from './citymap.js';
import { MISSIONS } from './missions.js';

export function drawHud(ctx, G, vw, vh) {
  const p = G.player;
  const w = G.wanted;
  // --- top left: wanted stars + health ---
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  for (let i = 0; i < 5; i++) {
    ctx.font = '26px sans-serif';
    ctx.fillStyle = i < w.level ? '#ffd23a' : 'rgba(255,255,255,0.25)';
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 3;
    const sx = 18 + i * 30, sy = 34;
    ctx.strokeText('★', sx, sy);
    ctx.fillText('★', sx, sy);
  }
  // Health bar.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(16, 44, 170, 16);
  ctx.fillStyle = p.health > 40 ? '#4ad86a' : '#ff4a4a';
  ctx.fillRect(18, 46, 166 * (p.health / p.maxHealth), 12);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText(`HEALTH ${Math.ceil(p.health)}`, 20, 57);
  // Bust progress warning.
  if (w.bustProgress > 0) {
    ctx.fillStyle = '#ff4a4a';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BREAK FREE! The cop has you!', vw / 2, 120);
    ctx.textAlign = 'left';
  }
  // --- top centre: objective ---
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  const obj = G.objectiveText();
  ctx.font = 'bold 15px sans-serif';
  const ow = ctx.measureText(obj).width + 28;
  ctx.fillRect(vw / 2 - ow / 2, 10, ow, 28);
  ctx.fillStyle = '#ffd23a';
  ctx.fillText(obj, vw / 2, 29);
  ctx.textAlign = 'left';
  // --- top right: cash + district ---
  ctx.textAlign = 'right';
  ctx.fillStyle = '#7ad87a';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(`$${p.cash.toLocaleString()}`, vw - 16, 32);
  ctx.fillStyle = '#fff';
  ctx.font = '13px sans-serif';
  ctx.fillText(districtNameAt(p.x, p.y), vw - 16, 50);
  ctx.fillStyle = '#9fb3d1';
  ctx.font = '12px sans-serif';
  ctx.fillText(G.missions.done ? 'Story complete' : `Job ${G.missions.index + 1}/5 — ${MISSIONS[G.missions.index]?.title || ''}`, vw - 16, 66);
  ctx.textAlign = 'left';
  // --- bottom left: controls hint ---
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '12px sans-serif';
  ctx.fillText(p.onFoot ? 'WASD move · Shift run · Click shoot · E steal car · G save · P pause · M mute' : 'W/S drive · A/D steer · Space handbrake · E get out · Click shoot · G save · P pause', 16, vh - 14);
  // --- messages ---
  if (G.msgText && G.time - G.msgAt < 4) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 17px sans-serif';
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    const mw = ctx.measureText(G.msgText).width + 30;
    ctx.fillRect(vw / 2 - mw / 2, vh - 96, mw, 30);
    ctx.fillStyle = G.msgColor || '#fff';
    ctx.fillText(G.msgText, vw / 2, vh - 75);
    ctx.textAlign = 'left';
  }
  // --- mission banner ---
  if (G.missions.banner && G.time - G.missions.bannerAt < 3) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillStyle = '#ffd23a';
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.lineWidth = 5;
    ctx.strokeText(G.missions.banner, vw / 2, vh / 2 - 60);
    ctx.fillText(G.missions.banner, vw / 2, vh / 2 - 60);
    ctx.textAlign = 'left';
  }
  drawMinimap(ctx, G, vw, vh);
}

export function drawMinimap(ctx, G, vw, vh) {
  const size = 168;
  const x0 = vw - size - 14, y0 = vh - size - 14;
  const scale = size / WORLD;
  ctx.save();
  ctx.fillStyle = 'rgba(8,12,24,0.82)';
  ctx.fillRect(x0 - 4, y0 - 4, size + 8, size + 8);
  ctx.strokeStyle = '#ffd23a';
  ctx.lineWidth = 2;
  ctx.strokeRect(x0 - 4, y0 - 4, size + 8, size + 8);
  ctx.beginPath();
  ctx.rect(x0, y0, size, size);
  ctx.clip();
  // Ground: water, sand, city.
  ctx.fillStyle = '#1d5f8a';
  ctx.fillRect(x0, y0 + size * 0.94, size, size * 0.06);
  ctx.fillStyle = '#e0c892';
  ctx.fillRect(x0, y0 + size * 0.86, size, size * 0.08);
  ctx.fillStyle = '#3a3f4a';
  ctx.fillRect(x0, y0, size, size * 0.86);
  // Roads.
  ctx.strokeStyle = '#7a7f8a';
  ctx.lineWidth = 1;
  for (let i = 0; i < 12; i++) {
    const rx = x0 + ((i * 6 + 1) * 48) * scale;
    const ry = y0 + ((i * 6 + 1) * 48) * scale;
    ctx.beginPath(); ctx.moveTo(rx, y0); ctx.lineTo(rx, y0 + size * 0.86); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x0, ry); ctx.lineTo(x0 + size, ry); ctx.stroke();
  }
  const marker = G.missionMarker();
  if (marker) {
    const mx = x0 + marker.x * scale, my = y0 + marker.y * scale;
    const pulse = 4 + Math.sin(G.time * 5) * 2;
    ctx.fillStyle = '#ffd23a';
    ctx.beginPath(); ctx.arc(mx, my, pulse, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(mx, my, pulse + 3, 0, Math.PI * 2); ctx.stroke();
  }
  // Cops as blue dots, player as a white arrow.
  for (const cop of G.cops) {
    const cx = cop.kind === 'car' ? cop.car.x : cop.ped.x;
    const cy = cop.kind === 'car' ? cop.car.y : cop.ped.y;
    ctx.fillStyle = '#4a8aff';
    ctx.fillRect(x0 + cx * scale - 2, y0 + cy * scale - 2, 4, 4);
  }
  const p = G.player;
  ctx.save();
  ctx.translate(x0 + p.x * scale, y0 + p.y * scale);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5); ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
  // North label.
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('N', x0 + size / 2 - 3, y0 + 12);
}

// Off-screen objective arrow at the viewport edge.
export function drawObjectiveArrow(ctx, G, vw, vh, cam) {
  const marker = G.missionMarker();
  if (!marker) return;
  const p = G.player;
  const dx = marker.x - p.x, dy = marker.y - p.y;
  const d = Math.hypot(dx, dy);
  if (d < 260) return; // marker is on screen already
  const cx = vw / 2 + (dx / d) * (Math.min(vw, vh) / 2 - 50);
  const cy = vh / 2 + (dy / d) * (Math.min(vw, vh) / 2 - 50);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.atan2(dy, dx));
  ctx.fillStyle = '#ffd23a';
  ctx.beginPath();
  ctx.moveTo(14, 0); ctx.lineTo(-8, -9); ctx.lineTo(-8, 9); ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#ffd23a';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(d)}m`, cx, cy + 26);
  ctx.textAlign = 'left';
}

export function drawTitle(ctx, G, vw, vh) {
  const grad = ctx.createLinearGradient(0, 0, 0, vh);
  grad.addColorStop(0, '#ff7a3a');
  grad.addColorStop(0.45, '#c23a6e');
  grad.addColorStop(1, '#1d2a5a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, vw, vh);
  // Sun and skyline silhouette.
  ctx.fillStyle = '#ffe9a0';
  ctx.beginPath(); ctx.arc(vw * 0.72, vh * 0.26, 64, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(20,16,40,0.85)';
  const base = vh * 0.78;
  let bx = 0;
  const rngHeights = [120, 200, 150, 260, 180, 300, 220, 160, 240, 130, 190, 280];
  for (let i = 0; i < rngHeights.length; i++) {
    const w = vw / rngHeights.length;
    ctx.fillRect(bx, base - rngHeights[i], w - 6, rngHeights[i]);
    bx += w;
  }
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, base, vw, vh - base);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 84px sans-serif';
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 8;
  ctx.strokeText('AZURA BAY', vw / 2, vh * 0.3);
  ctx.fillText('AZURA BAY', vw / 2, vh * 0.3);
  ctx.fillStyle = '#ffd23a';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('an open-world crime story', vw / 2, vh * 0.3 + 40);
  ctx.fillStyle = '#fff';
  ctx.font = '17px sans-serif';
  ctx.fillText('Steal cars. Outrun the APD. Run five jobs for Marlo Crane and take the Tide Job money.', vw / 2, vh * 0.52);
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(G.hasSave ? 'ENTER — New game      C — Continue saved game' : 'ENTER — Start the story', vw / 2, vh * 0.62);
  ctx.font = '15px sans-serif';
  ctx.fillStyle = '#d8e0f0';
  ctx.fillText('WASD move / drive · Mouse aim · Click shoot · E steal or enter a car · G save · P pause · M mute', vw / 2, vh * 0.7);
  ctx.fillText('An original game. No part of it comes from any commercial game.', vw / 2, vh * 0.78);
  ctx.textAlign = 'left';
}

export function drawPause(ctx, vw, vh) {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, vw, vh);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText('PAUSED', vw / 2, vh / 2 - 20);
  ctx.font = '18px sans-serif';
  ctx.fillText('P — resume · G — save · R — restart the story', vw / 2, vh / 2 + 24);
  ctx.textAlign = 'left';
}

export function drawEnd(ctx, G, vw, vh, kind) {
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(0, 0, vw, vh);
  ctx.textAlign = 'center';
  ctx.fillStyle = kind === 'busted' ? '#4a8aff' : '#ff4a4a';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText(kind === 'busted' ? 'BUSTED!' : 'WASTED', vw / 2, vh / 2 - 30);
  ctx.fillStyle = '#fff';
  ctx.font = '18px sans-serif';
  ctx.fillText(kind === 'busted'
    ? 'The APD took you in. Marlo posted bail — but the heat is still on.'
    : 'Dana went down. The city keeps moving without you.', vw / 2, vh / 2 + 10);
  ctx.fillText('ENTER — back to the streets (keep your cash and jobs)', vw / 2, vh / 2 + 44);
  ctx.textAlign = 'left';
}
