/**
 * ui.js
 * Tab switching, LED status updates, grain dot bar, dropzone,
 * window selector, and transport buttons.
 */

import { state, setWorkletParam, broadcastMessage } from './state.js';
import { lfoEnabled, pushLFOParams } from './lfo.js';
import { solarEnabled, pushSolarMod, resizeSolar } from './solar.js';
import { startGranulator, stopGranulator, loadAudioFile, togglePolyMode, resetAudioContext } from './audio.js';

// ─── Tabs ──────────────────────────────────────────────────────────────────

export function switchTab(tab) {
  state.activeTab = tab;

  document.getElementById('lfo-panel').style.display    = tab === 'lfo'    ? 'block' : 'none';
  document.getElementById('solar-panel').style.display  = tab === 'solar'  ? 'block' : 'none';
  document.getElementById('matrix-panel').style.display = tab === 'matrix' ? 'block' : 'none';
  document.getElementById('tab-lfo').className    = 'mod-tab' + (tab === 'lfo'    ? ' active-lfo'    : '');
  document.getElementById('tab-solar').className  = 'mod-tab' + (tab === 'solar'  ? ' active-solar'  : '');
  document.getElementById('tab-matrix').className = 'mod-tab' + (tab === 'matrix' ? ' active-matrix' : '');

  if (tab === 'lfo' && state.workletNode) {
    broadcastMessage({ type: 'SOLAR_MOD', enabled: false, mods: [0,0,0,0,0,0] });
    pushLFOParams();
  }
  if (tab === 'solar') {
    resizeSolar();
    if (state.workletNode) {
      broadcastMessage({ type: 'UPDATE_LFO_PARAMS', enabled: false });
      pushSolarMod();
    }
  }
  if (tab === 'matrix' && state.workletNode) {
    broadcastMessage({ type: 'SOLAR_MOD', enabled: false, mods: [0,0,0,0,0,0] });
    broadcastMessage({ type: 'UPDATE_LFO_PARAMS', enabled: false });
  }

  updateModLED();
}

// ─── LEDs ──────────────────────────────────────────────────────────────────

export function updateModLED() {
  const led = document.getElementById('led-mod');
  if      (state.activeTab === 'lfo'    && lfoEnabled)   led.className = 'led on-cyan';
  else if (state.activeTab === 'solar'  && solarEnabled) led.className = 'led on-violet';
  else if (state.activeTab === 'matrix')                 led.className = 'led on-amber';
  else                                                   led.className = 'led';
}

export function updateStatusLEDs() {
  document.getElementById('led-audio').className  = 'led' + (state.audioCtx  ? ' on-green' : '');
  document.getElementById('led-grains').className = 'led' + (state.grainCount > 0 ? ' on-green' : '');
  document.getElementById('led-mod').className; // handled by updateModLED
}

// ─── Grain dots ────────────────────────────────────────────────────────────

export function buildGrainDots() {
  const container = document.getElementById('grain-dots');
  for (let i = 0; i < 64; i++) {
    const dot = document.createElement('div');
    dot.className = 'gdot';
    container.appendChild(dot);
  }
}

export function updateGrainDots() {
  document.querySelectorAll('.gdot').forEach((d, i) =>
    d.classList.toggle('on', i < state.grainCount)
  );
  document.getElementById('grain-count').textContent = state.grainCount;
  document.getElementById('led-grains').className =
    'led' + (state.grainCount > 0 ? ' on-green' : '');
  document.getElementById('led-audio').className =
    'led' + (state.audioCtx ? ' on-green' : '');
}

// ─── Window selector ───────────────────────────────────────────────────────

export function initWindowSelector() {
  document.querySelectorAll('.sel-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sel-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const wt = parseInt(btn.dataset.win);
      state.params.windowType = wt;
      setWorkletParam('windowType', wt);
    });
  });
}

// ─── Transport ─────────────────────────────────────────────────────────────

export function initTransport() {
  document.getElementById('btn-play').addEventListener('click', () => {
    if (state.polyMode) return;  // keyboard is the input in poly mode
    state.isPlaying ? stopGranulator() : startGranulator();
  });
  document.getElementById('btn-stop').addEventListener('click', stopGranulator);
  document.getElementById('btn-poly').addEventListener('click', togglePolyMode);
  document.getElementById('btn-reset-ctx').addEventListener('click', resetAudioContext);
}

// ─── Dropzone ──────────────────────────────────────────────────────────────

export function initDropzone() {
  const dz = document.getElementById('dropzone');

  document.getElementById('file-input').addEventListener('change', (e) => {
    if (e.target.files[0]) loadAudioFile(e.target.files[0]);
  });

  dz.addEventListener('dragover',  (e) => { e.preventDefault(); dz.classList.add('dragover'); });
  dz.addEventListener('dragleave', ()  => dz.classList.remove('dragover'));
  dz.addEventListener('drop', (e) => {
    e.preventDefault();
    dz.classList.remove('dragover');
    const f = e.dataTransfer.files[0];
    if (f?.type.startsWith('audio/')) loadAudioFile(f);
  });
}

// ─── Phase display ─────────────────────────────────────────────────────────

export function updateLFOPhaseDisplay() {
  const el = document.getElementById('lfo-phase-display');
  if (el) el.textContent = 'PHASE: ' + state.lfoPhaseDisplay.toFixed(3);
}

// ─── Expose switchTab globally for inline onclick in HTML ──────────────────
window.switchTab = switchTab;
