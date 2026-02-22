/**
 * effects.js
 * Post-processing chain: EQ → Clipper → Reverb.
 * Sits between gainNode and ctx.destination.
 *
 * Call buildFXChain(ctx) when a new AudioContext is created.
 * Call setFXParam(section, param, value) to update any knob.
 * Call initFXKnobs() once after the DOM is ready.
 */

import { drawKnob } from './knobs.js';

// ─── Persisted state (survives context resets) ──────────────────────────────

export const fxState = {
  reverb:  { wet: 0.25, decay: 2.5 },
  eq:      { low: 0, mid: 0, high: 0 },
  clipper: { drive: 1, mix: 0 },
};

// ─── Live audio nodes (rebuilt on each new context) ─────────────────────────

let _ctx        = null;
let _eqLow      = null;
let _eqMid      = null;
let _eqHigh     = null;
let _preGain    = null;   // drive gain before waveshaper
let _clipper    = null;   // WaveShaperNode
let _clipDry    = null;
let _clipWet    = null;
let _reverb     = null;   // ConvolverNode
let _reverbDry  = null;
let _reverbWet  = null;
let _irDebounce = null;

// ─── DSP helpers ────────────────────────────────────────────────────────────

function buildIR(ctx, decaySecs) {
  const len = Math.floor(ctx.sampleRate * Math.max(0.1, decaySecs));
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++)
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
  }
  return buf;
}

function makeSoftClipCurve(drive) {
  const n    = 512;
  const curve = new Float32Array(n);
  const d     = Math.max(1, drive);
  for (let i = 0; i < n; i++) {
    const x  = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * d) / Math.tanh(d);
  }
  return curve;
}

// ─── Public: build / rebuild the chain ──────────────────────────────────────

export function buildFXChain(ctx) {
  _ctx = ctx;

  // ── EQ ────────────────────────────────────────────────────────────────────
  _eqLow = ctx.createBiquadFilter();
  _eqLow.type = 'lowshelf';
  _eqLow.frequency.value = 200;
  _eqLow.gain.value = fxState.eq.low;

  _eqMid = ctx.createBiquadFilter();
  _eqMid.type = 'peaking';
  _eqMid.frequency.value = 1200;
  _eqMid.Q.value = 1.2;
  _eqMid.gain.value = fxState.eq.mid;

  _eqHigh = ctx.createBiquadFilter();
  _eqHigh.type = 'highshelf';
  _eqHigh.frequency.value = 7000;
  _eqHigh.gain.value = fxState.eq.high;

  // ── Clipper (parallel dry/wet) ────────────────────────────────────────────
  _preGain = ctx.createGain();
  _preGain.gain.value = fxState.clipper.drive;

  _clipper = ctx.createWaveShaper();
  _clipper.curve = makeSoftClipCurve(fxState.clipper.drive);
  _clipper.oversample = '4x';

  _clipDry = ctx.createGain();
  _clipDry.gain.value = 1 - fxState.clipper.mix;

  _clipWet = ctx.createGain();
  _clipWet.gain.value = fxState.clipper.mix;

  const _clipMerge = ctx.createGain(); // summing point

  // ── Reverb (parallel dry/wet) ─────────────────────────────────────────────
  _reverb = ctx.createConvolver();
  _reverb.buffer = buildIR(ctx, fxState.reverb.decay);

  _reverbDry = ctx.createGain();
  _reverbDry.gain.value = 1;

  _reverbWet = ctx.createGain();
  _reverbWet.gain.value = fxState.reverb.wet;

  // ── Routing ───────────────────────────────────────────────────────────────
  // inputNode → EQ → clipper blend → reverb blend → outputNode

  const inputNode  = ctx.createGain();
  const outputNode = ctx.createGain();

  inputNode.connect(_eqLow);
  _eqLow.connect(_eqMid);
  _eqMid.connect(_eqHigh);

  // Clipper parallel
  _eqHigh.connect(_clipDry);
  _eqHigh.connect(_preGain);
  _preGain.connect(_clipper);
  _clipper.connect(_clipWet);
  _clipDry.connect(_clipMerge);
  _clipWet.connect(_clipMerge);

  // Reverb parallel
  _clipMerge.connect(_reverbDry);
  _clipMerge.connect(_reverb);
  _reverb.connect(_reverbWet);
  _reverbDry.connect(outputNode);
  _reverbWet.connect(outputNode);

  return { inputNode, outputNode };
}

// ─── Public: param updates ───────────────────────────────────────────────────

export function setFXParam(section, param, value) {
  fxState[section][param] = value;
  if (!_ctx) return;

  if (section === 'eq') {
    if (param === 'low')  _eqLow.gain.value  = value;
    if (param === 'mid')  _eqMid.gain.value  = value;
    if (param === 'high') _eqHigh.gain.value = value;
  }

  if (section === 'clipper') {
    if (param === 'drive') {
      _preGain.gain.value = value;
      _clipper.curve = makeSoftClipCurve(value);
    }
    if (param === 'mix') {
      _clipDry.gain.value = 1 - value;
      _clipWet.gain.value = value;
    }
  }

  if (section === 'reverb') {
    if (param === 'wet') {
      _reverbWet.gain.value = value;
    }
    if (param === 'decay') {
      // Debounce IR rebuild — expensive
      clearTimeout(_irDebounce);
      _irDebounce = setTimeout(() => {
        if (_reverb && _ctx) _reverb.buffer = buildIR(_ctx, value);
      }, 300);
    }
  }

  drawAllFXVis();
}

// ─── FX Visualizations ───────────────────────────────────────────────────────

let _visEQ     = null;
let _visClip   = null;
let _visReverb = null;

export function initFXVisualizations() {
  _visEQ     = document.getElementById('fx-vis-eq');
  _visClip   = document.getElementById('fx-vis-clip');
  _visReverb = document.getElementById('fx-vis-reverb');
  drawAllFXVis();
}

export function drawAllFXVis() {
  if (_visEQ)     _drawEQVis();
  if (_visClip)   _drawClipVis();
  if (_visReverb) _drawReverbVis();
}

function _drawEQVis() {
  const canvas = _visEQ;
  const W = canvas.offsetWidth || 200;
  const H = canvas.offsetHeight || 56;
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  // Background grid lines at 0 dB and ±6 dB
  ctx.strokeStyle = '#1e2a38';
  ctx.lineWidth   = 1;
  for (const db of [-12, -6, 0, 6, 12]) {
    const y = H / 2 - (db / 12) * (H / 2 - 4);
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // 0 dB line slightly brighter
  ctx.strokeStyle = '#2a3a4a';
  const y0 = H / 2;
  ctx.beginPath(); ctx.moveTo(0, y0); ctx.lineTo(W, y0); ctx.stroke();

  if (!_eqLow || !_eqMid || !_eqHigh) {
    // No context yet — draw flat line
    ctx.strokeStyle = '#00d4ff66';
    ctx.lineWidth   = 1.5;
    ctx.beginPath(); ctx.moveTo(0, y0); ctx.lineTo(W, y0); ctx.stroke();
    return;
  }

  const nBins = W;
  const freqs = new Float32Array(nBins);
  for (let i = 0; i < nBins; i++) {
    const logT = i / (nBins - 1);
    freqs[i] = Math.pow(10, Math.log10(20) + logT * (Math.log10(20000) - Math.log10(20)));
  }
  const magLow  = new Float32Array(nBins);
  const magMid  = new Float32Array(nBins);
  const magHigh = new Float32Array(nBins);
  const phase   = new Float32Array(nBins); // unused but required

  _eqLow.getFrequencyResponse(freqs, magLow,  phase);
  _eqMid.getFrequencyResponse(freqs, magMid,  phase);
  _eqHigh.getFrequencyResponse(freqs, magHigh, phase);

  const gradient = ctx.createLinearGradient(0, 0, W, 0);
  gradient.addColorStop(0,   '#004d5e');
  gradient.addColorStop(1,   '#00d4ff');

  ctx.beginPath();
  for (let i = 0; i < nBins; i++) {
    // Combined response: multiply linear magnitudes, convert to dB
    const mag = magLow[i] * magMid[i] * magHigh[i];
    const db  = 20 * Math.log10(Math.max(1e-6, mag));
    const y   = H / 2 - (db / 12) * (H / 2 - 4);
    if (i === 0) ctx.moveTo(0, y); else ctx.lineTo(i, y);
  }
  ctx.strokeStyle = gradient;
  ctx.lineWidth   = 2;
  ctx.stroke();

  // Glow pass
  ctx.beginPath();
  for (let i = 0; i < nBins; i++) {
    const mag = magLow[i] * magMid[i] * magHigh[i];
    const db  = 20 * Math.log10(Math.max(1e-6, mag));
    const y   = H / 2 - (db / 12) * (H / 2 - 4);
    if (i === 0) ctx.moveTo(0, y); else ctx.lineTo(i, y);
  }
  ctx.strokeStyle = '#00d4ff26';
  ctx.lineWidth   = 5;
  ctx.stroke();
}

function _drawClipVis() {
  const canvas = _visClip;
  const W = canvas.offsetWidth || 200;
  const H = canvas.offsetHeight || 56;
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  // Grid: axes
  ctx.strokeStyle = '#1e2a38';
  ctx.lineWidth   = 1;
  // Horizontal and vertical centre lines
  ctx.beginPath();
  ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2);
  ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H);
  ctx.stroke();

  // Linear (identity) reference
  ctx.strokeStyle = '#2a3a4a';
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(0, H); ctx.lineTo(W, 0);
  ctx.stroke();

  const drive = fxState.clipper.drive;
  const mix   = fxState.clipper.mix;
  const d     = Math.max(1, drive);

  const gradient = ctx.createLinearGradient(0, H, W, 0);
  gradient.addColorStop(0, '#7a4700');
  gradient.addColorStop(1, '#ff9500');

  ctx.beginPath();
  for (let i = 0; i < W; i++) {
    const x  = (i / (W - 1)) * 2 - 1;           // -1 … +1
    const wet = Math.tanh(x * d) / Math.tanh(d);
    const out = x * (1 - mix) + wet * mix;        // dry/wet blend
    const px  = i;
    const py  = H / 2 - out * (H / 2 - 2);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.strokeStyle = gradient;
  ctx.lineWidth   = 2;
  ctx.stroke();

  // Glow
  ctx.beginPath();
  for (let i = 0; i < W; i++) {
    const x   = (i / (W - 1)) * 2 - 1;
    const wet = Math.tanh(x * d) / Math.tanh(d);
    const out = x * (1 - mix) + wet * mix;
    const py  = H / 2 - out * (H / 2 - 2);
    if (i === 0) ctx.moveTo(i, py); else ctx.lineTo(i, py);
  }
  ctx.strokeStyle = '#ff950026';
  ctx.lineWidth   = 5;
  ctx.stroke();
}

function _drawReverbVis() {
  const canvas = _visReverb;
  const W = canvas.offsetWidth || 200;
  const H = canvas.offsetHeight || 56;
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  const decay = fxState.reverb.decay;
  const wet   = fxState.reverb.wet;

  // Visualise the envelope: y = wet * (1 - t)^2.5   (matches IR formula)
  const gradient = ctx.createLinearGradient(0, 0, W, 0);
  gradient.addColorStop(0, '#a855f7');
  gradient.addColorStop(1, '#4c1d95');

  // Fill under the curve
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let i = 0; i < W; i++) {
    const t  = i / (W - 1);
    const env = wet * Math.pow(1 - t, 2.5);
    const y   = H - env * (H - 2);
    ctx.lineTo(i, y);
  }
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fillStyle = '#a855f715';
  ctx.fill();

  // Stroke the envelope
  ctx.beginPath();
  for (let i = 0; i < W; i++) {
    const t   = i / (W - 1);
    const env = wet * Math.pow(1 - t, 2.5);
    const y   = H - env * (H - 2);
    if (i === 0) ctx.moveTo(0, y); else ctx.lineTo(i, y);
  }
  ctx.strokeStyle = gradient;
  ctx.lineWidth   = 2;
  ctx.stroke();

  // Glow
  ctx.beginPath();
  for (let i = 0; i < W; i++) {
    const t   = i / (W - 1);
    const env = wet * Math.pow(1 - t, 2.5);
    const y   = H - env * (H - 2);
    if (i === 0) ctx.moveTo(0, y); else ctx.lineTo(i, y);
  }
  ctx.strokeStyle = '#a855f726';
  ctx.lineWidth   = 5;
  ctx.stroke();

  // Decay time label
  ctx.fillStyle = '#a855f7aa';
  ctx.font      = '8px monospace';
  ctx.fillText(decay.toFixed(1) + 's', W - 28, 12);
}

// ─── Knob formatting ─────────────────────────────────────────────────────────

function formatFX(fmt, val) {
  if (fmt === 'pct') return Math.round(val * 100) + '%';
  if (fmt === 'db')  return (val >= 0 ? '+' : '') + val.toFixed(1) + ' dB';
  if (fmt === 's')   return val.toFixed(1) + 's';
  if (fmt === 'x')   return val.toFixed(1) + 'x';
  return val.toFixed(2);
}

// ─── Knob init ───────────────────────────────────────────────────────────────

export function initFXKnobs() {
  document.querySelectorAll('.fx-knob').forEach(wrap => {
    const canvas  = wrap.querySelector('canvas');
    const valEl   = wrap.querySelector('.knob-value');
    const section = wrap.dataset.fxSection;
    const param   = wrap.dataset.fxParam;
    const fmt     = wrap.dataset.fmt;
    const min     = parseFloat(wrap.dataset.min);
    const max     = parseFloat(wrap.dataset.max);

    const color = fmt === 'db' ? '#00d4ff' : '#ff9500';

    function refresh(val) {
      drawKnob(canvas, (val - min) / (max - min), color);
      if (valEl) valEl.textContent = formatFX(fmt, val);
    }

    // Draw initial state
    refresh(parseFloat(wrap.dataset.val));

    let isDragging = false, startY = 0, startVal = 0;

    wrap.addEventListener('mousedown', e => {
      isDragging = true;
      startY     = e.clientY;
      startVal   = parseFloat(wrap.dataset.val);
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup',   onUp);
    });

    function onMove(e) {
      if (!isDragging) return;
      const delta = (e.clientY - startY) / 160;
      const val   = Math.max(min, Math.min(max, startVal - delta * (max - min)));
      wrap.dataset.val = val;
      setFXParam(section, param, val);
      refresh(val);
    }

    function onUp() {
      isDragging = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
    }

    wrap.addEventListener('dblclick', () => {
      const def = parseFloat(wrap.dataset.default ?? wrap.dataset.val);
      wrap.dataset.val = def;
      setFXParam(section, param, def);
      refresh(def);
    });
  });
}
