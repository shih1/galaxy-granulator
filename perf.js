/**
 * perf.js
 * Floating performance monitor overlay — click to open/close.
 */

import { state } from './state.js';

const HISTORY = 90; // frames of rolling history

let open       = false;
let frameTimes = [];
let lastTs     = 0;
let el         = null;
let bodyEl     = null;
let headerEl   = null;
let sparkCanvas = null;
let sparkCtx   = null;
const rows     = {};

// ─── Build DOM ─────────────────────────────────────────────────────────────

function createUI() {
  el = document.createElement('div');
  el.id = 'perf-monitor';

  // ── Header (always visible, click to toggle) ──────────────────────────
  headerEl = document.createElement('div');
  headerEl.id = 'perf-header';
  headerEl.innerHTML = '<span id="perf-header-fps">—</span><span class="perf-title">PERF ▾</span>';
  headerEl.onclick = toggle;
  el.appendChild(headerEl);

  // ── Body (hidden by default) ──────────────────────────────────────────
  bodyEl = document.createElement('div');
  bodyEl.id = 'perf-body';

  // Sparkline canvas
  const sparkWrap = document.createElement('div');
  sparkWrap.id = 'perf-spark-wrap';
  sparkCanvas = document.createElement('canvas');
  sparkCanvas.id = 'perf-spark';
  sparkCanvas.width  = 220;
  sparkCanvas.height = 36;
  sparkCtx = sparkCanvas.getContext('2d');
  sparkWrap.appendChild(sparkCanvas);
  bodyEl.appendChild(sparkWrap);

  const divider = document.createElement('div');
  divider.className = 'perf-divider';
  bodyEl.appendChild(divider);

  // Metric rows
  const metrics = [
    ['fps',    'AVG FPS'],
    ['fpsmin', 'MIN FPS'],
    ['fpsmax', 'MAX FPS'],
    ['ft',     'FRAME TIME'],
    [null,     null],           // spacer
    ['mem',    'HEAP USED'],
    ['memtot', 'HEAP LIMIT'],
    [null,     null],
    ['grains', 'GRAINS'],
    ['voices', 'VOICES'],
    [null,     null],
    ['audio',  'AUDIO CTX'],
    ['sr',     'SAMPLE RATE'],
    ['buf',    'BUFFER SIZE'],
    [null,     null],
  ];

  for (const [key, label] of metrics) {
    if (key === null) {
      const sp = document.createElement('div');
      sp.className = 'perf-spacer';
      bodyEl.appendChild(sp);
      continue;
    }
    const row = document.createElement('div');
    row.className = 'perf-row';

    const lbl = document.createElement('span');
    lbl.className = 'perf-label';
    lbl.textContent = label;

    const val = document.createElement('span');
    val.className = 'perf-val';
    val.textContent = '—';

    row.appendChild(lbl);
    row.appendChild(val);
    bodyEl.appendChild(row);
    rows[key] = val;
  }

  bodyEl.style.display = 'none';
  el.appendChild(bodyEl);
  document.body.appendChild(el);
}

function toggle() {
  open = !open;
  bodyEl.style.display = open ? 'block' : 'none';
  headerEl.classList.toggle('open', open);
  const arrow = headerEl.querySelector('.perf-title');
  if (arrow) arrow.textContent = open ? 'PERF ▴' : 'PERF ▾';
}

// ─── Sparkline ─────────────────────────────────────────────────────────────

function drawSparkline() {
  const w = sparkCanvas.width;
  const h = sparkCanvas.height;
  sparkCtx.clearRect(0, 0, w, h);

  if (frameTimes.length < 2) return;

  const fpsSeries = frameTimes.map(dt => Math.min(1000 / dt, 144));
  const lo  = 0;
  const hi  = 144;
  const pad = 2;

  // Grid lines at 30, 60, 120
  sparkCtx.strokeStyle = 'rgba(255,149,0,0.12)';
  sparkCtx.lineWidth = 1;
  for (const target of [30, 60, 120]) {
    const y = h - pad - ((target - lo) / (hi - lo)) * (h - pad * 2);
    sparkCtx.beginPath();
    sparkCtx.moveTo(0, y);
    sparkCtx.lineTo(w, y);
    sparkCtx.stroke();
  }

  // FPS curve
  const avgFps = fpsSeries.reduce((a, b) => a + b, 0) / fpsSeries.length;
  const color  = avgFps >= 50
    ? '#30d158'
    : avgFps >= 30
      ? '#ff9500'
      : '#ff3b30';

  sparkCtx.beginPath();
  sparkCtx.strokeStyle = color;
  sparkCtx.lineWidth   = 1.5;
  for (let i = 0; i < fpsSeries.length; i++) {
    const x = pad + (i / (fpsSeries.length - 1)) * (w - pad * 2);
    const y = h - pad - ((fpsSeries[i] - lo) / (hi - lo)) * (h - pad * 2);
    i === 0 ? sparkCtx.moveTo(x, y) : sparkCtx.lineTo(x, y);
  }
  sparkCtx.stroke();

  // Fill under curve
  sparkCtx.lineTo(pad + (w - pad * 2), h);
  sparkCtx.lineTo(pad, h);
  sparkCtx.closePath();
  sparkCtx.fillStyle = color.replace(')', ', 0.08)').replace('rgb', 'rgba').replace('#30d158', 'rgba(48,209,88,0.08)').replace('#ff9500', 'rgba(255,149,0,0.08)').replace('#ff3b30', 'rgba(255,59,48,0.08)');
  // Simple fill
  sparkCtx.globalAlpha = 0.12;
  sparkCtx.fillStyle = color;
  sparkCtx.fill();
  sparkCtx.globalAlpha = 1;
}

// ─── Public API ─────────────────────────────────────────────────────────────

export function initPerfMonitor() {
  createUI();
}

export function updatePerfMonitor(timestamp) {
  if (!el) return;

  const dt = timestamp - lastTs;
  lastTs   = timestamp;
  if (dt > 0 && dt < 500) frameTimes.push(dt);
  if (frameTimes.length > HISTORY) frameTimes.shift();

  // Always update the compact FPS in the header
  if (frameTimes.length > 0) {
    const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
    const fps = 1000 / avg;
    const headerFpsEl = document.getElementById('perf-header-fps');
    if (headerFpsEl) {
      headerFpsEl.textContent = fps.toFixed(0) + ' FPS';
      headerFpsEl.style.color = fps >= 50
        ? 'var(--green)'
        : fps >= 30
          ? 'var(--amber)'
          : 'var(--red)';
    }
  }

  if (!open || frameTimes.length === 0) return;

  // ── FPS ────────────────────────────────────────────────────────────────
  const fpsSeries = frameTimes.map(dt => 1000 / dt);
  const avgFps    = fpsSeries.reduce((a, b) => a + b, 0) / fpsSeries.length;
  const minFps    = Math.min(...fpsSeries);
  const maxFps    = Math.max(...fpsSeries);
  const avgDt     = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;

  const fpsColor = avgFps >= 50
    ? 'var(--green)'
    : avgFps >= 30
      ? 'var(--amber)'
      : 'var(--red)';

  rows.fps.textContent    = avgFps.toFixed(1);
  rows.fps.style.color    = fpsColor;
  rows.fpsmin.textContent = minFps.toFixed(1);
  rows.fpsmin.style.color = minFps < 30 ? 'var(--red)' : 'var(--text-dim)';
  rows.fpsmax.textContent = maxFps.toFixed(1);
  rows.ft.textContent     = avgDt.toFixed(2) + ' ms';

  drawSparkline();

  // ── Memory (Chrome / Edge only) ────────────────────────────────────────
  if (performance.memory) {
    const used  = performance.memory.usedJSHeapSize  / 1_048_576;
    const limit = performance.memory.jsHeapSizeLimit  / 1_048_576;
    rows.mem.textContent    = used.toFixed(1)  + ' MB';
    rows.memtot.textContent = limit.toFixed(0) + ' MB';
    const pct = used / limit;
    rows.mem.style.color = pct > 0.8
      ? 'var(--red)'
      : pct > 0.5
        ? 'var(--amber)'
        : 'var(--cyan)';
  } else {
    rows.mem.textContent    = 'N/A';
    rows.memtot.textContent = 'N/A';
  }

  // ── Granulator state ───────────────────────────────────────────────────
  rows.grains.textContent = state.grainCount ?? 0;
  rows.grains.style.color = (state.grainCount > 0) ? 'var(--amber)' : 'var(--text-dim)';

  if (state.polyMode) {
    const n = state.voices?.size ?? 0;
    rows.voices.textContent = `${n} / 8 (POLY)`;
    rows.voices.style.color = n > 0 ? 'var(--amber)' : 'var(--text-dim)';
  } else {
    rows.voices.textContent = state.isPlaying ? '1 (MONO)' : '0';
    rows.voices.style.color = state.isPlaying ? 'var(--amber)' : 'var(--text-dim)';
  }

  // ── AudioContext ───────────────────────────────────────────────────────
  const ctx = state.audioCtx;
  if (ctx) {
    rows.audio.textContent = ctx.state.toUpperCase();
    rows.audio.style.color = ctx.state === 'running'
      ? 'var(--green)'
      : 'var(--amber)';
    rows.sr.textContent  = ctx.sampleRate.toLocaleString() + ' Hz';
  } else {
    rows.audio.textContent = 'INACTIVE';
    rows.audio.style.color = 'var(--text-dim)';
    rows.sr.textContent    = '—';
  }

  // ── Sample buffer ──────────────────────────────────────────────────────
  if (state.sampleBuffer) {
    const secs = state.sampleBuffer.length / (ctx?.sampleRate ?? 44100);
    rows.buf.textContent = `${(state.sampleBuffer.length / 1000).toFixed(0)}k smp / ${secs.toFixed(2)}s`;
  } else {
    rows.buf.textContent = '—';
  }
}
