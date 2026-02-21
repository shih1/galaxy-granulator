/**
 * solar.js
 * N-body gravitational simulation ("Celestial Engine") for parameter modulation.
 * Planets orbit a central sun; their X/Y/V positions map to synth parameters.
 */

import { state } from './state.js';

// ─── Constants ─────────────────────────────────────────────────────────────

const MAX_BOUNDS = 270;
const TRAIL_LEN  = 180;
const PLANET_COLORS = ['#a855f7', '#34d399', '#f97316', '#60a5fa', '#f472b6', '#facc15'];
const SUN        = { mass: 180_000 };

const STARS = Array.from({ length: 160 }, () => ({
  rx: Math.random(), ry: Math.random(),
  r:  Math.random() * 1.4 + 0.3,
  b:  Math.random(),
}));

// ─── State ─────────────────────────────────────────────────────────────────

export let solarEnabled  = true;
export let solarGravity  = 0.0015;
export let solarSimSpeed = 1;
export let solarDepth    = 0.3;
export let solarMapX     = 0;
export let solarMapY     = 1;
export let solarMapV     = 3;

let bodies  = [];
let pidx    = 0;

// Drag state
let isDrag = false;
let dragS  = null;
let dragE  = null;

// ─── Physics ───────────────────────────────────────────────────────────────

export function getSolarSimSpeed() { return solarSimSpeed; }
export function setSolarGravity(v)  { solarGravity  = v; }
export function setSolarSimSpeed(v) { solarSimSpeed = v; }
export function setSolarDepth(v)    { solarDepth    = v; }

export function addPlanet(x, y, vx, vy) {
  bodies.push({
    id: pidx++, mass: 100 + Math.random() * 200,
    x, y, z: 0, vx, vy, vz: 0,
    trail: [], color: PLANET_COLORS[pidx % PLANET_COLORS.length],
  });
  updatePlanetList();
}

export function clearPlanets() {
  bodies = [];
  pidx   = 0;
  updatePlanetList();
}

export function initPlanets() {
  addPlanet(180, 0, 0, -1.8);
  addPlanet(-120, 80, 1.4, 1.0);
}

export function stepPhysics(steps) {
  const G = solarGravity;
  for (let s = 0; s < steps; s++) {
    for (const p of bodies) {
      const dsq = p.x * p.x + p.y * p.y + 0.01;
      const d   = Math.sqrt(dsq);
      const f   = (G * SUN.mass) / dsq;
      p.vx -= (p.x / d) * f;
      p.vy -= (p.y / d) * f;

      for (const q of bodies) {
        if (q.id === p.id) continue;
        const dx  = q.x - p.x, dy = q.y - p.y;
        const dq  = dx * dx + dy * dy + 0.01;
        const dqd = Math.sqrt(dq);
        const fq  = (G * q.mass) / dq;
        p.vx += (dx / dqd) * fq;
        p.vy += (dy / dqd) * fq;
      }

      p.x += p.vx;
      p.y += p.vy;
      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > TRAIL_LEN) p.trail.shift();

      const B = MAX_BOUNDS;
      if (Math.abs(p.x) > B) { p.vx *= -0.6; p.x = Math.sign(p.x) * B; }
      if (Math.abs(p.y) > B) { p.vy *= -0.6; p.y = Math.sign(p.y) * B; }
    }
  }
}

function computeSolarMods() {
  const mods = [0, 0, 0, 0, 0, 0];
  if (!bodies.length) return mods;
  const p  = bodies[0];
  const nx = Math.max(-1, Math.min(1, p.x / MAX_BOUNDS));
  const ny = Math.max(-1, Math.min(1, p.y / MAX_BOUNDS));
  const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
  const nv  = Math.max(-1, Math.min(1, (spd / 4) * 2 - 1));
  if (solarMapX >= 0 && solarMapX < 6) mods[solarMapX] += nx * solarDepth;
  if (solarMapY >= 0 && solarMapY < 6) mods[solarMapY] += ny * solarDepth;
  if (solarMapV >= 0 && solarMapV < 6) mods[solarMapV] += nv * solarDepth;
  return mods;
}

export function pushSolarMod() {
  if (!state.workletNode) return;
  state.workletNode.port.postMessage({
    type:    'SOLAR_MOD',
    enabled: solarEnabled && state.activeTab === 'solar',
    mods:    computeSolarMods(),
  });
}

// ─── Canvas ────────────────────────────────────────────────────────────────

const solarCanvas = document.getElementById('solar-canvas');
const sCtx        = solarCanvas.getContext('2d');

export function resizeSolar() {
  const wrap        = document.getElementById('solar-canvas-wrap');
  solarCanvas.width  = wrap.offsetWidth;
  solarCanvas.height = Math.max(260, wrap.offsetHeight);
}

function w2c(wx, wy) {
  const W  = solarCanvas.width, H = solarCanvas.height;
  const sc = W / (MAX_BOUNDS * 2.4);
  return { x: W / 2 + wx * sc, y: H / 2 - wy * sc };
}

function c2w(cx, cy) {
  const W  = solarCanvas.width, H = solarCanvas.height;
  const sc = W / (MAX_BOUNDS * 2.4);
  return { x: (cx - W / 2) / sc, y: -(cy - H / 2) / sc };
}

export function drawSolar() {
  const W = solarCanvas.width, H = solarCanvas.height;
  sCtx.clearRect(0, 0, W, H);

  // Background gradient
  const bg = sCtx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7);
  bg.addColorStop(0, '#06030f');
  bg.addColorStop(1, '#020108');
  sCtx.fillStyle = bg;
  sCtx.fillRect(0, 0, W, H);

  // Stars
  for (const s of STARS) {
    sCtx.beginPath();
    sCtx.arc(s.rx * W, s.ry * H, s.r, 0, Math.PI * 2);
    sCtx.fillStyle = `rgba(255,255,255,${0.25 + s.b * 0.5})`;
    sCtx.fill();
  }

  // Orbit rings
  const { x: ox, y: oy } = w2c(0, 0);
  sCtx.strokeStyle = 'rgba(168,85,247,0.05)';
  sCtx.lineWidth   = 1;
  const sc = W / (MAX_BOUNDS * 2.4);
  for (let r = 60; r <= MAX_BOUNDS * 1.2; r += 60) {
    sCtx.beginPath();
    sCtx.arc(ox, oy, r * sc, 0, Math.PI * 2);
    sCtx.stroke();
  }

  // Trails
  for (const p of bodies) {
    if (p.trail.length < 2) continue;
    sCtx.beginPath();
    for (let i = 0; i < p.trail.length; i++) {
      const { x, y } = w2c(p.trail[i].x, p.trail[i].y);
      i === 0 ? sCtx.moveTo(x, y) : sCtx.lineTo(x, y);
    }
    sCtx.strokeStyle = p.color + '70';
    sCtx.lineWidth   = 1.5;
    sCtx.stroke();
  }

  // Gravity lines (sun → planet)
  for (const p of bodies) {
    const { x: px, y: py } = w2c(p.x, p.y);
    const gl = sCtx.createLinearGradient(ox, oy, px, py);
    gl.addColorStop(0, 'rgba(168,85,247,0.12)');
    gl.addColorStop(1, 'transparent');
    sCtx.beginPath(); sCtx.moveTo(ox, oy); sCtx.lineTo(px, py);
    sCtx.strokeStyle = gl;
    sCtx.lineWidth   = 0.5;
    sCtx.stroke();
  }

  // Sun
  const sunG = sCtx.createRadialGradient(ox, oy, 0, ox, oy, 38);
  sunG.addColorStop(0, 'rgba(255,210,80,0.9)');
  sunG.addColorStop(0.3, 'rgba(255,149,0,0.4)');
  sunG.addColorStop(1, 'transparent');
  sCtx.fillStyle = sunG;
  sCtx.beginPath(); sCtx.arc(ox, oy, 38, 0, Math.PI * 2); sCtx.fill();

  const sc2 = sCtx.createRadialGradient(ox - 2, oy - 2, 0, ox, oy, 10);
  sc2.addColorStop(0, '#fff8e0');
  sc2.addColorStop(1, '#ff9500');
  sCtx.beginPath(); sCtx.arc(ox, oy, 10, 0, Math.PI * 2);
  sCtx.fillStyle = sc2; sCtx.fill();

  // Planets
  for (let i = 0; i < bodies.length; i++) {
    const p   = bodies[i];
    const { x: px, y: py } = w2c(p.x, p.y);
    const r   = 6 + Math.sqrt(p.mass / 100) * 2;

    // Glow halo
    const pg = sCtx.createRadialGradient(px, py, 0, px, py, r * 2.5);
    pg.addColorStop(0, p.color + '50'); pg.addColorStop(1, 'transparent');
    sCtx.beginPath(); sCtx.arc(px, py, r * 2.5, 0, Math.PI * 2);
    sCtx.fillStyle = pg; sCtx.fill();

    // Planet sphere
    const pc = sCtx.createRadialGradient(px - r * 0.3, py - r * 0.3, 0, px, py, r);
    pc.addColorStop(0, '#fff'); pc.addColorStop(0.4, p.color); pc.addColorStop(1, p.color + 'aa');
    sCtx.beginPath(); sCtx.arc(px, py, r, 0, Math.PI * 2);
    sCtx.fillStyle = pc; sCtx.fill();

    // Label
    sCtx.fillStyle  = 'rgba(168,85,247,0.55)';
    sCtx.font       = '8px Share Tech Mono';
    sCtx.textAlign  = 'center';
    sCtx.fillText('P' + (i + 1), px, py - r - 4);

    // Velocity arrow (planet 1 only)
    if (i === 0) {
      const as  = 20;
      const ax  = px + p.vx * as, ay = py - p.vy * as;
      const ang = Math.atan2(ay - py, ax - px);
      sCtx.strokeStyle = 'rgba(168,85,247,0.45)';
      sCtx.lineWidth   = 1.5;
      sCtx.beginPath(); sCtx.moveTo(px, py); sCtx.lineTo(ax, ay); sCtx.stroke();
      sCtx.beginPath();
      sCtx.moveTo(ax, ay);
      sCtx.lineTo(ax - 6 * Math.cos(ang - 0.4), ay - 6 * Math.sin(ang - 0.4));
      sCtx.lineTo(ax - 6 * Math.cos(ang + 0.4), ay - 6 * Math.sin(ang + 0.4));
      sCtx.closePath();
      sCtx.fillStyle = 'rgba(168,85,247,0.6)'; sCtx.fill();
    }
  }

  // Drag preview
  if (isDrag && dragS && dragE) {
    sCtx.strokeStyle = 'rgba(168,85,247,0.75)';
    sCtx.lineWidth   = 2;
    sCtx.setLineDash([5, 4]);
    sCtx.beginPath(); sCtx.moveTo(dragS.cx, dragS.cy); sCtx.lineTo(dragE.cx, dragE.cy); sCtx.stroke();
    sCtx.setLineDash([]);
    sCtx.beginPath(); sCtx.arc(dragS.cx, dragS.cy, 7, 0, Math.PI * 2);
    sCtx.fillStyle = 'rgba(168,85,247,0.3)'; sCtx.fill();
    sCtx.strokeStyle = '#a855f7'; sCtx.lineWidth = 1.5; sCtx.stroke();
    const dx = dragE.cx - dragS.cx, dy = dragE.cy - dragS.cy;
    const sp = Math.sqrt(dx * dx + dy * dy) * 0.05;
    sCtx.fillStyle  = 'rgba(168,85,247,0.55)';
    sCtx.font       = '8px Share Tech Mono';
    sCtx.textAlign  = 'left';
    sCtx.fillText('V:' + sp.toFixed(2), dragE.cx + 6, dragE.cy);
  }

  // Debug readout
  if (bodies.length > 0 && solarEnabled) {
    const p   = bodies[0];
    const nx  = (p.x / MAX_BOUNDS).toFixed(2);
    const ny  = (p.y / MAX_BOUNDS).toFixed(2);
    const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy).toFixed(3);
    sCtx.fillStyle = 'rgba(168,85,247,0.35)';
    sCtx.font      = '8px Share Tech Mono';
    sCtx.textAlign = 'left';
    sCtx.fillText('X:' + nx + ' Y:' + ny + ' V:' + spd, 8, H - 10);
  }
}

// ─── UI list updates ────────────────────────────────────────────────────────

export function updatePlanetList() {
  const list = document.getElementById('planet-list');
  list.innerHTML = '';
  document.getElementById('solar-body-count').textContent = bodies.length + ' BODIES';
  bodies.forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'planet-row';
    const nx = (p.x / MAX_BOUNDS).toFixed(2);
    const ny = (p.y / MAX_BOUNDS).toFixed(2);
    const sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy).toFixed(3);
    row.innerHTML = `
      <div class="planet-dot" style="background:${p.color};box-shadow:0 0 5px ${p.color}60"></div>
      <div class="planet-readout">P${i + 1} X:<span id="prx${i}">${nx}</span> Y:<span id="pry${i}">${ny}</span> V:<span id="prv${i}">${sp}</span></div>
    `;
    list.appendChild(row);
  });
}

export function updatePlanetReadouts() {
  bodies.forEach((p, i) => {
    const ex = document.getElementById('prx' + i);
    const ey = document.getElementById('pry' + i);
    const ev = document.getElementById('prv' + i);
    if (ex) ex.textContent = (p.x / MAX_BOUNDS).toFixed(2);
    if (ey) ey.textContent = (p.y / MAX_BOUNDS).toFixed(2);
    if (ev) ev.textContent = Math.sqrt(p.vx * p.vx + p.vy * p.vy).toFixed(3);
  });
  let ke = 0;
  bodies.forEach(p => ke += 0.5 * p.mass * (p.vx * p.vx + p.vy * p.vy));
  document.getElementById('solar-ke').textContent = 'KE: ' + ke.toFixed(1);
}

// ─── Canvas interaction ────────────────────────────────────────────────────

solarCanvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const rect     = solarCanvas.getBoundingClientRect();
  let closest    = -1;
  let closestDSq = 40 * 40;
  for (let i = 0; i < bodies.length; i++) {
    const p  = bodies[i];
    const { x, y } = w2c(p.x, p.y);
    const dx = (e.clientX - rect.left) - x;
    const dy = (e.clientY - rect.top)  - y;
    const dd = dx * dx + dy * dy;
    if (dd < closestDSq) { closestDSq = dd; closest = i; }
  }
  if (closest >= 0) { bodies.splice(closest, 1); updatePlanetList(); }
});

solarCanvas.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  const rect = solarCanvas.getBoundingClientRect();
  const cx   = e.clientX - rect.left;
  const cy   = e.clientY - rect.top;
  dragS  = { cx, cy, world: c2w(cx, cy) };
  dragE  = { cx, cy };
  isDrag = true;
});

solarCanvas.addEventListener('mousemove', (e) => {
  if (!isDrag) return;
  const rect = solarCanvas.getBoundingClientRect();
  dragE = { cx: e.clientX - rect.left, cy: e.clientY - rect.top };
});

solarCanvas.addEventListener('mouseup', () => {
  if (!isDrag) return;
  isDrag = false;
  const dx   = dragE.cx - dragS.cx, dy = dragE.cy - dragS.cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const w    = dragS.world;
  if (dist < 6) {
    const d  = Math.sqrt(w.x * w.x + w.y * w.y) || 1;
    const sp = Math.sqrt(solarGravity * SUN.mass / d) * 0.95;
    addPlanet(w.x, w.y, (-w.y / d) * sp, (w.x / d) * sp);
  } else {
    addPlanet(w.x, w.y, dx * 0.05, -dy * 0.05);
  }
  dragS = null; dragE = null;
});

// ─── Control wiring ────────────────────────────────────────────────────────

export function initSolarControls() {
  setTimeout(resizeSolar, 0);

  document.getElementById('btn-add-planet').addEventListener('click', () => {
    const a   = Math.random() * Math.PI * 2;
    const d   = 80 + Math.random() * 160;
    const x   = Math.cos(a) * d, y = Math.sin(a) * d;
    const sp  = Math.sqrt(solarGravity * SUN.mass / d) * 0.95;
    addPlanet(x, y, -Math.sin(a) * sp, Math.cos(a) * sp);
  });

  document.getElementById('btn-clear-planets').addEventListener('click', clearPlanets);

  document.getElementById('btn-solar-bypass').addEventListener('click', function () {
    solarEnabled = !solarEnabled;
    this.textContent = solarEnabled ? '◉ ACTIVE' : '○ BYPASS';
    this.classList.toggle('ac-violet', solarEnabled);
    pushSolarMod();
  });

  document.getElementById('map-x').addEventListener('change', (e) => { solarMapX = parseInt(e.target.value); });
  document.getElementById('map-y').addEventListener('change', (e) => { solarMapY = parseInt(e.target.value); });
  document.getElementById('map-v').addEventListener('change', (e) => { solarMapV = parseInt(e.target.value); });
}
