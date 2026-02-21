/**
 * lfo.js
 * MSEG LFO — node editor (drag/add/delete), tension handles,
 * LUT compilation, and worklet communication.
 */

import { state } from './state.js';

// ─── State ─────────────────────────────────────────────────────────────────

export let lfoNodes    = [{ x: 0, y: 0.5 }, { x: 0.25, y: 1 }, { x: 0.75, y: 0 }, { x: 1, y: 0.5 }];
export let lfoTensions = [0, 0, 0];

export let lfoBPM     = 120;
export let lfoBeats   = 1;
export let lfoTarget  = 0;
export let lfoBipolar = true;
export let lfoEnabled = true;
export let lfoSnapDiv = 16;

// ─── LUT compilation ───────────────────────────────────────────────────────

export function evalLFO(ph) {
  let si = lfoNodes.length - 2;
  for (let n = 0; n < lfoNodes.length - 1; n++) {
    if (ph >= lfoNodes[n].x && ph <= lfoNodes[n + 1].x) { si = n; break; }
  }
  const a  = lfoNodes[si];
  const b  = lfoNodes[si + 1] ?? lfoNodes[si];
  const tn = lfoTensions[si] ?? 0;
  let t = (ph - a.x) / (b.x - a.x);
  if (!isFinite(t)) t = 1;
  t = Math.max(0, Math.min(1, t));
  const shaped = tn > 0 ? Math.pow(t, 1 + tn * 4) : 1 - Math.pow(1 - t, 1 + Math.abs(tn) * 4);
  return a.y + (b.y - a.y) * shaped;
}

function compileLFO() {
  const lut = new Float32Array(2048);
  for (let i = 0; i < 2048; i++) lut[i] = evalLFO(i / 2047);
  return lut;
}

export function pushLFOLUT() {
  if (!state.workletNode || state.activeTab !== 'lfo') return;
  const lut = compileLFO();
  state.workletNode.port.postMessage({ type: 'UPDATE_LFO_LUT', lut: lut.buffer }, [lut.buffer.slice(0)]);
}

export function pushLFOParams(overrides = {}) {
  if (!state.workletNode || state.activeTab !== 'lfo') return;
  const freq = (lfoBPM / 60) / lfoBeats;
  state.workletNode.port.postMessage({
    type: 'UPDATE_LFO_PARAMS',
    freq,
    target:  lfoTarget,
    bipolar: lfoBipolar,
    enabled: lfoEnabled,
    ...overrides,
  });
  const dw = document.getElementById('knob-modDepth');
  if (dw) {
    state.workletNode.parameters.get('modDepth')
      ?.setValueAtTime(parseFloat(dw.dataset.val), state.audioCtx?.currentTime ?? 0);
  }
}

// ─── Canvas ────────────────────────────────────────────────────────────────

const canvas = document.getElementById('lfo-canvas');
const ctx    = canvas.getContext('2d');
const NR     = 7; // node radius
const TR     = 5; // tension diamond half-size

export function resizeLFO() {
  canvas.width = canvas.offsetWidth;
}

function n2c(nd) {
  return { x: nd.x * canvas.width, y: (1 - nd.y) * canvas.height };
}
function c2n(cx, cy) {
  return {
    x: Math.max(0, Math.min(1, cx / canvas.width)),
    y: Math.max(0, Math.min(1, 1 - cy / canvas.height)),
  };
}
function tensionHandlePos(si) {
  const a  = lfoNodes[si], b = lfoNodes[si + 1];
  const mx = (a.x + b.x) / 2;
  const ry = evalLFO(mx);
  return { x: mx * canvas.width, y: (1 - ry) * canvas.height };
}

function hitTest(cx, cy) {
  for (let i = 0; i < lfoNodes.length; i++) {
    const { x, y } = n2c(lfoNodes[i]);
    if (Math.hypot(cx - x, cy - y) <= NR + 3) return { type: 'node', idx: i };
  }
  for (let si = 0; si < lfoNodes.length - 1; si++) {
    const tp = tensionHandlePos(si);
    if (Math.hypot(cx - tp.x, cy - tp.y) <= TR + 4) return { type: 'tension', idx: si };
  }
  return null;
}

export function drawLFO() {
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#060910';
  ctx.fillRect(0, 0, W, H);

  // Grid lines
  ctx.strokeStyle = 'rgba(30,42,56,0.8)';
  ctx.lineWidth   = 1;
  for (const y of [0, 0.25, 0.5, 0.75, 1]) {
    const py = (1 - y) * H;
    ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(W, py); ctx.stroke();
  }

  // Snap grid
  if (lfoSnapDiv > 0) {
    ctx.strokeStyle = 'rgba(0,212,255,0.05)';
    for (let i = 1; i < lfoSnapDiv; i++) {
      const px = (i / lfoSnapDiv) * W;
      ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, H); ctx.stroke();
    }
  }

  // Bipolar centre line
  ctx.strokeStyle = lfoBipolar ? 'rgba(0,212,255,0.12)' : 'transparent';
  ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(0, H * 0.5); ctx.lineTo(W, H * 0.5); ctx.stroke();
  ctx.setLineDash([]);

  // Filled curve
  ctx.beginPath();
  for (let px = 0; px <= W; px++) {
    const y  = evalLFO(px / W);
    const cy = (1 - y) * H;
    px === 0 ? ctx.moveTo(px, cy) : ctx.lineTo(px, cy);
  }
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
  const fill = ctx.createLinearGradient(0, 0, 0, H);
  fill.addColorStop(0, 'rgba(0,212,255,0.16)');
  fill.addColorStop(1, 'rgba(0,212,255,0.02)');
  ctx.fillStyle = fill;
  ctx.fill();

  // Curve stroke
  ctx.beginPath();
  for (let px = 0; px <= W; px++) {
    const y  = evalLFO(px / W);
    const cy = (1 - y) * H;
    px === 0 ? ctx.moveTo(px, cy) : ctx.lineTo(px, cy);
  }
  ctx.strokeStyle = '#00d4ff';
  ctx.lineWidth   = 2;
  ctx.stroke();

  // Tension diamonds
  for (let si = 0; si < lfoNodes.length - 1; si++) {
    const tp  = tensionHandlePos(si);
    const tn  = lfoTensions[si];
    ctx.save();
    ctx.translate(tp.x, tp.y);
    ctx.rotate(Math.PI / 4);
    ctx.strokeStyle = Math.abs(tn) > 0.01 ? '#00d4ff' : '#2a3a4a';
    ctx.fillStyle   = Math.abs(tn) > 0.01 ? 'rgba(0,212,255,0.18)' : '#141a22';
    ctx.lineWidth   = 1.5;
    ctx.beginPath(); ctx.rect(-4, -4, 8, 8); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  // Node circles
  lfoNodes.forEach((nd, idx) => {
    const { x: px, y: py } = n2c(nd);
    const gr = ctx.createRadialGradient(px - 1, py - 1, 0, px, py, NR);
    gr.addColorStop(0, '#3af');
    gr.addColorStop(1, '#006080');
    ctx.beginPath();
    ctx.arc(px, py, NR, 0, Math.PI * 2);
    ctx.fillStyle   = gr;
    ctx.fill();
    ctx.strokeStyle = '#00d4ff';
    ctx.lineWidth   = 1.5;
    ctx.stroke();
    if (idx === 0 || idx === lfoNodes.length - 1) {
      ctx.beginPath();
      ctx.arc(px, py, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
    }
  });

  // Phase playhead
  if (lfoEnabled && state.activeTab === 'lfo') {
    const phX = state.lfoPhaseDisplay * W;
    ctx.strokeStyle = 'rgba(255,149,0,0.8)';
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(phX, 0); ctx.lineTo(phX, H); ctx.stroke();
    ctx.setLineDash([]);
    const cy2 = (1 - evalLFO(state.lfoPhaseDisplay)) * H;
    ctx.beginPath();
    ctx.arc(phX, cy2, 4, 0, Math.PI * 2);
    ctx.fillStyle   = '#ff9500';
    ctx.shadowColor = '#ff9500';
    ctx.shadowBlur  = 8;
    ctx.fill();
    ctx.shadowBlur  = 0;
  }
}

// ─── Mouse interaction ─────────────────────────────────────────────────────

let dragItem = null;

function getScaledCoords(e) {
  const rect = canvas.getBoundingClientRect();
  const sx   = canvas.width  / rect.width;
  const sy   = canvas.height / rect.height;
  return { cx: (e.clientX - rect.left) * sx, cy: (e.clientY - rect.top) * sy };
}

canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const { cx, cy } = getScaledCoords(e);
  const hit = hitTest(cx, cy);
  if (hit?.type === 'node' && hit.idx !== 0 && hit.idx !== lfoNodes.length - 1) {
    lfoNodes.splice(hit.idx, 1);
    lfoTensions.splice(Math.min(hit.idx, lfoTensions.length - 1), 1);
    pushLFOLUT();
  }
});

canvas.addEventListener('dblclick', (e) => {
  const { cx, cy } = getScaledCoords(e);
  if (hitTest(cx, cy)) return;
  let { x, y } = c2n(cx, cy);
  if (lfoSnapDiv > 0) x = Math.round(x * lfoSnapDiv) / lfoSnapDiv;
  x = Math.max(0.01, Math.min(0.99, x));
  y = Math.max(0, Math.min(1, y));
  const insertIdx = lfoNodes.findIndex(n => n.x > x);
  const idx       = insertIdx === -1 ? lfoNodes.length - 1 : insertIdx;
  lfoNodes.splice(idx, 0, { x, y });
  lfoTensions.splice(idx, 0, 0);
  pushLFOLUT();
});

canvas.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  const { cx, cy } = getScaledCoords(e);
  const hit = hitTest(cx, cy);
  if (!hit) return;
  dragItem = { ...hit, startY: e.clientY, origTension: lfoTensions[hit.idx] };
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup',   onMouseUp);
});

function onMouseMove(e) {
  if (!dragItem) return;
  const { cx, cy } = getScaledCoords(e);
  if (dragItem.type === 'node') {
    const { idx } = dragItem;
    let { x, y } = c2n(cx, cy);
    y = Math.max(0, Math.min(1, y));
    if (idx === 0) {
      x = 0;
    } else if (idx === lfoNodes.length - 1) {
      x = 1;
    } else {
      if (lfoSnapDiv > 0) x = Math.round(x * lfoSnapDiv) / lfoSnapDiv;
      x = Math.max(lfoNodes[idx - 1].x + 0.001, Math.min(lfoNodes[idx + 1].x - 0.001, x));
    }
    lfoNodes[idx] = { x, y };
  } else {
    const dy = -(e.clientY - dragItem.startY) / 100;
    lfoTensions[dragItem.idx] = Math.max(-1, Math.min(1, dragItem.origTension + dy));
  }
  pushLFOLUT();
}

function onMouseUp() {
  dragItem = null;
  document.removeEventListener('mousemove', onMouseMove);
  document.removeEventListener('mouseup',   onMouseUp);
}

// ─── Control wiring ────────────────────────────────────────────────────────

export function initLFOControls() {
  resizeLFO();
  window.addEventListener('resize', resizeLFO);

  document.getElementById('rate-grid').querySelectorAll('.mini-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('rate-grid').querySelectorAll('.mini-btn').forEach(b => b.classList.remove('ac'));
      btn.classList.add('ac');
      lfoBeats = parseFloat(btn.dataset.beats);
      pushLFOParams();
    });
  });

  document.getElementById('bpm-input').addEventListener('input', (e) => {
    lfoBPM = Math.max(20, Math.min(300, parseInt(e.target.value) || 120));
    pushLFOParams();
  });

  document.getElementById('target-grid').querySelectorAll('.mini-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('target-grid').querySelectorAll('.mini-btn').forEach(b => b.classList.remove('ac'));
      btn.classList.add('ac');
      lfoTarget = parseInt(btn.dataset.target);
      pushLFOParams();
    });
  });

  document.getElementById('btn-bipolar').addEventListener('click', function () {
    lfoBipolar = !lfoBipolar;
    this.textContent = lfoBipolar ? '± BIPOLAR' : '+ UNIPOLAR';
    this.classList.toggle('ac-cyan', lfoBipolar);
    pushLFOParams();
  });

  document.getElementById('btn-lfo-bypass').addEventListener('click', function () {
    lfoEnabled = !lfoEnabled;
    this.textContent = lfoEnabled ? '● ACTIVE' : '○ BYPASS';
    this.classList.toggle('ac-cyan', lfoEnabled);
    pushLFOParams();
    updateModLED();
  });

  document.getElementById('snap-grid').querySelectorAll('.mini-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('snap-grid').querySelectorAll('.mini-btn').forEach(b => b.classList.remove('ac'));
      btn.classList.add('ac');
      lfoSnapDiv = parseInt(btn.dataset.snap);
    });
  });
}

function updateModLED() {
  // Re-exported here to avoid circular dep; tabs.js calls the canonical version
  const led = document.getElementById('led-mod');
  if (state.activeTab === 'lfo' && lfoEnabled) led.className = 'led on-cyan';
  else led.className = 'led';
}
