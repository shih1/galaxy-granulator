/**
 * main.js
 * Entry point — wires everything together and runs the RAF animation loop.
 */

import { state } from './state.js';
import { initKnobs } from './knobs.js';
import { initWaveform, drawWaveform } from './waveform.js';
import { initLFOControls, drawLFO, resizeLFO } from './lfo.js';
import { initSolarControls, initPlanets, stepPhysics, drawSolar,
         updatePlanetReadouts, pushSolarMod, resizeSolar,
         getSolarSimSpeed } from './solar.js';
import {
  buildGrainDots, updateGrainDots, initWindowSelector,
  initTransport, initDropzone, updateLFOPhaseDisplay, updateModLED,
} from './ui.js';
import { loadDemoSample } from './audio.js';
import { initKeyboard } from './keyboard.js';
import { initModMatrix, pushMatrixMod, updateMatrixDisplay } from './modmatrix.js';
import { initPerfMonitor, updatePerfMonitor } from './perf.js';
import { initKeyboardVis, drawKeyboardVis } from './keyboard-vis.js';
import { initFXKnobs, initFXVisualizations } from './effects.js';

// ─── Initialise ────────────────────────────────────────────────────────────

initKnobs();
initWaveform();
initLFOControls();
initSolarControls();
initWindowSelector();
initTransport();
initDropzone();
buildGrainDots();

initKeyboard();
initModMatrix();
initPerfMonitor();
initKeyboardVis();
initFXKnobs();

const _fxPanel = document.getElementById('fx-panel');
const _fxBtn   = document.getElementById('btn-fx');
let _fxVisInited = false;
_fxBtn.addEventListener('click', () => {
  const open = _fxPanel.classList.toggle('fx-open');
  _fxBtn.classList.toggle('fx-active', open);
  if (open && !_fxVisInited) {
    _fxVisInited = true;
    // Defer until after the CSS transition reveals the canvases so
    // offsetWidth is non-zero when we size them
    setTimeout(initFXVisualizations, 40);
  }
});

// Seed with demo sample and initial planets
loadDemoSample();
initPlanets();

// ─── Animation loop ────────────────────────────────────────────────────────

let lastTimestamp = 0;

function animate(timestamp) {
  const dt = Math.min(timestamp - lastTimestamp, 50);

  // Physics always runs — matrix sources need live planet data regardless of tab
  const steps = Math.max(1, Math.round(getSolarSimSpeed() * dt / 16));
  stepPhysics(steps);
  pushMatrixMod();

  if (state.activeTab === 'solar') {
    pushSolarMod();
    drawSolar();
    updatePlanetReadouts();
  } else if (state.activeTab === 'lfo') {
    drawLFO();
  } else if (state.activeTab === 'matrix') {
    updateMatrixDisplay();
  }

  drawWaveform();
  updateGrainDots();

  if (state.activeTab === 'lfo') updateLFOPhaseDisplay();

  updateModLED();
  drawKeyboardVis();
  updatePerfMonitor(timestamp);
  lastTimestamp = timestamp;
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
