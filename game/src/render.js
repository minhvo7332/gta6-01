// World rendering: everything drawn on the main canvas, top-down.
// Camera follows the player. Draw order: ground, water and beach, roads,
// parks and trees, buildings, docks, cars, people, player, bullets and
// effects, then the mission beacon and the off-screen objective arrow.
import { DISTRICTS, WORLD_WIDTH, WORLD_HEIGHT, ROAD_WIDTH, roadXs, roadYs } from './city.js';
import { missionMarker } from './missions.js';

export const VIEW_W = 1280;
export const VIEW_H = 720;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCarShape(ctx, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  roundRect(ctx, -22, -9, 46, 22, 6);
  ctx.fill();
  // Body.
  ctx.fillStyle = car.police ? '#2a5ad8' : car.color;
  roundRect(ctx, -24, -11, 48, 22, 7);
  ctx.fill();
  if (car.police) {
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(-6, -11, 12, 22);
    ctx.fillStyle = '#d83232';
    ctx.fillRect(-2, -11, 4, 6);
    ctx.fillStyle = '#2a5ad8';
    ctx.fillRect(-2, 5, 4, 6);
  }
  // Cabin and windshield.
  ctx.fillStyle = 'rgba(30,40,60,0.85)';
  roundRect(ctx, -8, -9, 16, 18, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(180,220,255,0.7)';
  ctx.fillRect(10, -8, 5, 16);
  // Headlights.
  ctx.fillStyle = '#ffe9a0';
  ctx.fillRect(22, -9, 3, 4);
  ctx.fillRect(22, 5, 3, 4);
  // Brake lights.
  if (car.brakeLight) {
    ctx.fillStyle = '#ff2a2a';
    ctx.fillRect(-25, -9, 3, 4);
    ctx.fillRect(-25, 5, 3, 4);
  }
  ctx.restore();
}

function drawPerson(ctx, p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  if (p.down) {
    ctx.rotate(1.2);
    ctx.fillStyle = p.shirt;
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 5, 9, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  // Body and head.
  ctx.fillStyle = p.shirt;
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.arc(Math.cos(p.angle) * 3, Math.sin(p.angle) * 3 - 2, 5.5, 0, Math.PI * 2);
  ctx.fill();
  if (p.kind === 'officer') {
    ctx.fillStyle = '#101828';
    ctx.fillRect(-6, -10, 12, 4);
    ctx.fillStyle = '#ffd832';
    ctx.fillRect(-1, -6, 2, 3);
  }
  ctx.restore();
}

function drawBuilding(ctx, b, time) {
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(b.x + 4, b.y + 5, b.w, b.h);
  ctx.fillStyle = b.color;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  // Roof inset for tall towers.
  if (b.tall) {
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, 4);
  }
  // Windows: deterministic pattern from the building seed.
  const cols = Math.max(1, Math.floor(b.w / 22));
  const rows = Math.max(1, Math.floor(b.h / 22));
  for (let c = 0; c < cols; c += 1) {
    for (let r = 0; r < rows; r += 1) {
      const lit = ((b.seed + c * 7 + r * 13) % 5) === 0;
      ctx.fillStyle = lit ? '#ffe9a0' : 'rgba(30,40,60,0.55)';
      ctx.fillRect(b.x + 6 + c * ((b.w - 12) / cols), b.y + 6 + r * ((b.h - 12) / rows), 9, 11);
    }
  }
  void time;
}

export function createCamera() {
  return { x: 1600, y: 1200 };
}

export function updateCamera(camera, targetX, targetY) {
  const tx = Math.max(VIEW_W / 2, Math.min(WORLD_WIDTH - VIEW_W / 2, targetX));
  const ty = Math.max(VIEW_H / 2, Math.min(WORLD_HEIGHT - VIEW_H / 2, targetY));
  camera.x += (tx - camera.x) * 0.12;
  camera.y += (ty - camera.y) * 0.12;
}

export function drawWorld(ctx, state, time) {
  const { city, player, vehicles, people, combat } = state;
  const cam = state.camera;
  const left = cam.x - VIEW_W / 2;
  const top = cam.y - VIEW_H / 2;
  ctx.save();
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  // Sun-soaked sky tint behind everything at the map edge.
  ctx.fillStyle = '#ffe9b8';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.translate(-Math.round(left), -Math.round(top));

  // District ground.
  for (const d of DISTRICTS) {
    ctx.fillStyle = d.ground;
    ctx.fillRect(d.x, d.y, d.w, d.h);
    ctx.fillStyle = d.groundAlt;
    for (let gx = d.x; gx < d.x + d.w; gx += 96) {
      for (let gy = d.y; gy < d.y + d.h; gy += 96) {
        if (((gx + gy) / 96) % 2 === 0) ctx.fillRect(gx, gy, 48, 48);
      }
    }
  }
  // Water (west) and beach sand (south Coral Row).
  ctx.fillStyle = '#2e8ab0';
  ctx.fillRect(0, 0, 150, WORLD_HEIGHT);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(146, 0, 6, WORLD_HEIGHT);
  ctx.fillStyle = '#f0dc9e';
  ctx.fillRect(1066, 2280, 1067, 120);
  ctx.fillStyle = '#2e8ab0';
  ctx.fillRect(1066, 2360, 1067, 40);

  // Parks.
  for (const park of city.parks) {
    ctx.fillStyle = '#5da85a';
    ctx.fillRect(park.x, park.y, park.w, park.h);
    ctx.strokeStyle = '#3f7d4e';
    ctx.lineWidth = 3;
    ctx.strokeRect(park.x, park.y, park.w, park.h);
  }

  // Roads with centre dashes.
  for (const rx of roadXs()) {
    ctx.fillStyle = '#3f3f46';
    ctx.fillRect(rx - ROAD_WIDTH / 2, 0, ROAD_WIDTH, WORLD_HEIGHT);
  }
  for (const ry of roadYs()) {
    ctx.fillStyle = '#3f3f46';
    ctx.fillRect(0, ry - ROAD_WIDTH / 2, WORLD_WIDTH, ROAD_WIDTH);
  }
  ctx.fillStyle = '#e8d832';
  for (const rx of roadXs()) {
    for (let y = 0; y < WORLD_HEIGHT; y += 64) ctx.fillRect(rx - 2, y, 4, 28);
  }
  for (const ry of roadYs()) {
    for (let x = 0; x < WORLD_WIDTH; x += 64) ctx.fillRect(x, ry - 2, 28, 4);
  }

  // Marina docks and boats.
  for (const dock of city.docks) {
    ctx.fillStyle = '#8a6a4a';
    ctx.fillRect(dock.x, dock.y, dock.w, dock.h);
    ctx.fillStyle = '#f0f0f0';
    ctx.beginPath();
    ctx.ellipse(dock.x + dock.w + 26, dock.y + 8, 20, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d84a4a';
    ctx.fillRect(dock.x + dock.w + 14, dock.y - 2, 8, 12);
  }

  // Trees.
  for (const t of city.trees) {
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(t.x + 3, t.y + 4, t.r, t.r * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2e7d3a';
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4aa85a';
    ctx.beginPath();
    ctx.arc(t.x - 3, t.y - 3, t.r * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Buildings, culled to the visible area.
  for (const b of city.buildings) {
    if (b.x + b.w < left - 80 || b.x > left + VIEW_W + 80) continue;
    if (b.y + b.h < top - 80 || b.y > top + VIEW_H + 80) continue;
    drawBuilding(ctx, b, time);
  }

  // District labels on the ground.
  ctx.fillStyle = 'rgba(20,20,30,0.5)';
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'center';
  for (const d of DISTRICTS) {
    ctx.fillText(d.name.toUpperCase(), d.x + d.w / 2, d.y + d.h / 2);
  }
  ctx.textAlign = 'left';

  // Parked and traffic cars.
  for (const car of vehicles.parked) drawCarShape(ctx, car);
  for (const car of vehicles.traffic) drawCarShape(ctx, car);
  for (const car of people.policeCars) drawCarShape(ctx, car);

  // Pedestrians and officers.
  for (const p of people.peds) drawPerson(ctx, p);
  for (const o of people.officers) drawPerson(ctx, o);

  // Mission beacon: a tall light pillar and a ring at the target.
  const marker = missionMarker(state.missions);
  if (marker) {
    const pulse = 1 + Math.sin(time / 280) * 0.12;
    ctx.strokeStyle = '#ffd832';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, 34 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,216,50,0.25)';
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, 34 * pulse, 0, Math.PI * 2);
    ctx.fill();
    const grad = ctx.createLinearGradient(marker.x, marker.y - 260, marker.x, marker.y);
    grad.addColorStop(0, 'rgba(255,216,50,0)');
    grad.addColorStop(1, 'rgba(255,216,50,0.5)');
    ctx.fillStyle = grad;
    ctx.fillRect(marker.x - 8, marker.y - 260, 16, 260);
    ctx.fillStyle = '#202020';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(marker.label, marker.x, marker.y - 48);
    ctx.textAlign = 'left';
  }

  // Player car or player on foot.
  if (!player.onFoot && player.car) {
    drawCarShape(ctx, player.car);
  } else {
    // Player on foot: bright jacket, direction tick, melee swing arc.
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 6, 11, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    if (combat.swing > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, 0, 40, player.angle - 1.1, player.angle + 1.1);
      ctx.stroke();
    }
    ctx.fillStyle = '#ff5a2e';
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a2a34';
    ctx.beginPath();
    ctx.arc(Math.cos(player.angle) * 4, Math.sin(player.angle) * 4 - 2, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd832';
    ctx.beginPath();
    ctx.arc(Math.cos(player.angle) * 10, Math.sin(player.angle) * 10, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (combat.muzzle > 0) {
      ctx.fillStyle = '#ffe9a0';
      ctx.beginPath();
      ctx.arc(player.x + Math.cos(player.angle) * 26, player.y + Math.sin(player.angle) * 26, 7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Bullets.
  ctx.strokeStyle = '#ffe9a0';
  ctx.lineWidth = 3;
  for (const b of combat.bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  ctx.restore();

  // Off-screen objective arrow at the screen edge.
  if (marker) {
    const px = player.onFoot ? player.x : player.car.x;
    const py = player.onFoot ? player.y : player.car.y;
    const sx = marker.x - cam.x + VIEW_W / 2;
    const sy = marker.y - cam.y + VIEW_H / 2;
    if (sx < 60 || sx > VIEW_W - 60 || sy < 90 || sy > VIEW_H - 60) {
      const ang = Math.atan2(marker.y - py, marker.x - px);
      const ax = VIEW_W / 2 + Math.cos(ang) * 300;
      const ay = VIEW_H / 2 + Math.sin(ang) * 220;
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(ang);
      ctx.fillStyle = '#ffd832';
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(-10, -12);
      ctx.lineTo(-10, 12);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#ffd832';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(Math.hypot(marker.x - px, marker.y - py))}m`, ax, ay + 30);
      ctx.textAlign = 'left';
    }
  }

  // Hurt vignette.
  if (player.hurtFlash > 0) {
    ctx.fillStyle = `rgba(216,40,40,${player.hurtFlash * 0.45})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
}

// Title-screen backdrop: the city seen from a slow drifting camera.
export function drawTitleBackdrop(ctx, city, time) {
  const fake = {
    city,
    player: { x: 1600, y: 1200, onFoot: true, car: null, angle: 0, hurtFlash: 0 },
    vehicles: { parked: [], traffic: [] },
    people: { peds: [], officers: [], policeCars: [] },
    combat: { bullets: [], swing: 0, muzzle: 0 },
    missions: { activeIndex: -1, completed: 0, stage: 0, currentLine: '' },
    camera: { x: 1600 + Math.sin(time / 9000) * 500, y: 1200 + Math.cos(time / 11000) * 300 },
  };
  drawWorld(ctx, fake, time);
}
