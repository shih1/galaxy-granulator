/**
 * knobs.js
 * Canvas knob rendering and interaction (drag-to-change, dbl-click reset).
 */

import { state, setWorkletParam } from './state.js';
import { setSolarGravity, setSolarSimSpeed, setSolarDepth } from './solar.js';

// ─── Constants ─────────────────────────────────────────────────────────────

const DEFAULTS = {
  position:    0.5,
  scatter:     0.05,
  density:     12,
  grainLength: 0.1,
  pitch:       0,
  pitchRand:   0,
  panSpread:   0.3,
  mix:         1,
  modDepth:    0.25,
  gravity:     0.0015,
  simspeed:    1,
  solardepth:  0.3,
};

// ─── Drawing ───────────────────────────────────────────────────────────────

export function drawKnob(canvas, t, color = '#ff9500') {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2;
  const r  = W * 0.38;

  ctx.clearRect(0, 0, W, H);

  const startAngle = Math.PI * 0.75;
  const endAngle   = Math.PI * 2.25;
  const valAngle   = startAngle + t * (endAngle - startAngle);

  // Track arc (background)
  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, endAngle);
  ctx.strokeStyle = '#1e2a38';
  ctx.lineWidth   = 4;
  ctx.lineCap     = 'round';
  ctx.stroke();

  // Value arc (coloured)
  const dimColor = color === '#a855f7' ? '#4c1d95'
                 : color === '#00d4ff' ? '#004d5e'
                 : '#7a4700';
  const gradient = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
  gradient.addColorStop(0, dimColor);
  gradient.addColorStop(1, color);

  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, valAngle);
  ctx.strokeStyle = gradient;
  ctx.lineWidth   = 4;
  ctx.stroke();

  // Glow ring
  if (t > 0.01) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, valAngle);
    ctx.strokeStyle = color + '26';
    ctx.lineWidth   = 8;
    ctx.stroke();
  }

  // Knob face
  const face = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.2, 0, cx, cy, r * 0.7);
  face.addColorStop(0, '#2a3a4a');
  face.addColorStop(1, '#141a22');

  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.65, 0, Math.PI * 2);
  ctx.fillStyle   = face;
  ctx.fill();
  ctx.strokeStyle = '#2a3a4a';
  ctx.lineWidth   = 1;
  ctx.stroke();

  // Indicator dot
  const ix  = cx + Math.cos(valAngle) * r * 0.42;
  const iy  = cy + Math.sin(valAngle) * r * 0.42;
  const ox2 = cx + Math.cos(valAngle) * r * 0.58;
  const oy2 = cy + Math.sin(valAngle) * r * 0.58;

  ctx.beginPath();
  ctx.moveTo(ix, iy);
  ctx.lineTo(ox2, oy2);
  ctx.strokeStyle = color;
  ctx.lineWidth   = 2;
  ctx.lineCap     = 'round';
  ctx.stroke();
}

// ─── Formatting ────────────────────────────────────────────────────────────

function formatValue(wrap, val) {
  const fmt = wrap.dataset.fmt;
  if (fmt === 'pct')  return Math.round(val * 100) + '%';
  if (fmt === 'ms')   return Math.round(val * 1000) + 'ms';
  if (fmt === 'st')   return (val >= 0 ? '+' : '') + val.toFixed(1) + 'st';
  if (fmt === 'num')  return val.toFixed(1) + (wrap.dataset.unit ?? '');
  if (fmt === 'grav') return val.toFixed(4);
  if (fmt === 'spd')  return val.toFixed(1) + 'x';
  return val.toFixed(2);
}

// ─── Setup ─────────────────────────────────────────────────────────────────

export function setupKnob(wrap) {
  const canvas = wrap.querySelector('canvas');
  const valEl  = wrap.querySelector('.knob-value');
  const color  = valEl?.classList.contains('cyan')   ? '#00d4ff'
               : valEl?.classList.contains('violet') ? '#a855f7'
               : '#ff9500';

  let isDragging = false;
  let startY     = 0;
  let startVal   = 0;

  function refresh() {
    const min = parseFloat(wrap.dataset.min);
    const max = parseFloat(wrap.dataset.max);
    const val = parseFloat(wrap.dataset.val);
    drawKnob(canvas, (val - min) / (max - min), color);
    if (valEl) valEl.textContent = formatValue(wrap, val);
  }

  refresh();

  function onMouseMove(e) {
    if (!isDragging) return;
    const min   = parseFloat(wrap.dataset.min);
    const max   = parseFloat(wrap.dataset.max);
    const delta = (e.clientY - startY) / 160;
    const val   = Math.max(min, Math.min(max, startVal - delta * (max - min)));
    wrap.dataset.val = val;

    const param = wrap.dataset.param;
    state.params[param] = val;

    // Propagate special solar params
    if (param === 'gravity')    setSolarGravity(val);
    if (param === 'simspeed')   setSolarSimSpeed(val);
    if (param === 'solardepth') setSolarDepth(val);

    refresh();
    setWorkletParam(param, val);
  }

  function onMouseUp() {
    isDragging = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup',   onMouseUp);
  }

  wrap.addEventListener('mousedown', (e) => {
    isDragging = true;
    startY     = e.clientY;
    startVal   = parseFloat(wrap.dataset.val);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup',   onMouseUp);
  });

  wrap.addEventListener('dblclick', () => {
    const param = wrap.dataset.param;
    const def   = DEFAULTS[param];
    if (def === undefined) return;

    wrap.dataset.val    = def;
    state.params[param] = def;

    if (param === 'gravity')    setSolarGravity(def);
    if (param === 'simspeed')   setSolarSimSpeed(def);
    if (param === 'solardepth') setSolarDepth(def);

    refresh();
    setWorkletParam(param, def);
  });
}

export function initKnobs() {
  document.querySelectorAll('.knob-wrap').forEach(setupKnob);
}
