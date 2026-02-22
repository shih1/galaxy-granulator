/**
 * waveform.js
 * Sample waveform canvas display with grain position overlays
 * and scrub-to-set-position interaction.
 */

import { state, setWorkletParam } from './state.js';
import { drawKnob } from './knobs.js';

// ─── Canvas ────────────────────────────────────────────────────────────────

const waveCanvas = document.getElementById('waveform');

export function resizeWaveform() {
  waveCanvas.width = waveCanvas.offsetWidth;
}

export function drawWaveform() {
  const ctx  = waveCanvas.getContext('2d');
  const W    = waveCanvas.width;
  const H    = waveCanvas.height;
  const data = state.waveformData;

  ctx.clearRect(0, 0, W, H);

  if (!data) {
    ctx.fillStyle = 'rgba(255,149,0,0.03)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle  = '#2a3a4a';
    ctx.font       = '10px Share Tech Mono';
    ctx.textAlign  = 'center';
    ctx.fillText('NO SAMPLE LOADED', W / 2, H / 2 + 3);
    return;
  }

  // Waveform shape
  const step = data.length / W;
  ctx.beginPath();
  for (let x = 0; x < W; x++) {
    let mn = 1, mx = -1;
    const s   = Math.floor(x * step);
    const end = Math.floor((x + 1) * step);
    for (let i = s; i < end && i < data.length; i++) {
      if (data[i] < mn) mn = data[i];
      if (data[i] > mx) mx = data[i];
    }
    const yMn = (1 - (mn + 1) / 2) * H;
    const yMx = (1 - (mx + 1) / 2) * H;
    if (x === 0) ctx.moveTo(x, yMn);
    ctx.lineTo(x, yMx);
    ctx.lineTo(x, yMn);
  }

  const fg = ctx.createLinearGradient(0, 0, 0, H);
  fg.addColorStop(0,   'rgba(255,149,0,0.15)');
  fg.addColorStop(0.5, 'rgba(255,149,0,0.25)');
  fg.addColorStop(1,   'rgba(255,149,0,0.15)');
  ctx.strokeStyle = fg;
  ctx.lineWidth   = 1;
  ctx.stroke();

  // Active grain overlays — only while playing
  if (state.isPlaying) {
    for (const gp of state.grainPositions) {
      const gx = (gp.sampleStart / data.length) * W;
      const gl = (gp.length * 44100) / data.length * W;
      ctx.fillStyle = 'rgba(0,212,255,0.05)';
      ctx.fillRect(gx, 0, gl, H);
      const px = gx + gp.phase * gl;
      ctx.strokeStyle = 'rgba(0,212,255,0.6)';
      ctx.lineWidth   = 1;
      ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, H); ctx.stroke();
    }
  }

  // Position marker
  const posX = state.params.position * W;
  ctx.strokeStyle = 'rgba(255,149,0,0.9)';
  ctx.lineWidth   = 2;
  ctx.setLineDash([4, 3]);
  ctx.beginPath(); ctx.moveTo(posX, 0); ctx.lineTo(posX, H); ctx.stroke();
  ctx.setLineDash([]);

  // Scatter region
  ctx.fillStyle = 'rgba(255,149,0,0.04)';
  ctx.fillRect(posX - state.params.scatter * W, 0, state.params.scatter * W * 2, H);

  // Centre line
  ctx.strokeStyle = 'rgba(30,42,56,0.8)';
  ctx.lineWidth   = 1;
  ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();
}

// ─── Scrub interaction ─────────────────────────────────────────────────────

function scrubWaveform(e) {
  if (!state.waveformData) return;
  const rect = waveCanvas.getBoundingClientRect();
  const pos  = Math.max(0, Math.min(1, (e.clientX - rect.left) / waveCanvas.width));

  const wrap = document.getElementById('knob-position');
  wrap.dataset.val                 = pos;
  state.params.position            = pos;

  drawKnob(wrap.querySelector('canvas'), pos, '#ff9500');
  wrap.querySelector('.knob-value').textContent = Math.round(pos * 100) + '%';
  setWorkletParam('position', pos);
}

export function initWaveform() {
  resizeWaveform();
  window.addEventListener('resize', resizeWaveform);
  waveCanvas.addEventListener('mousedown', scrubWaveform);
  waveCanvas.addEventListener('mousemove', (e) => { if (e.buttons === 1) scrubWaveform(e); });
}
