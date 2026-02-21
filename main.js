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

// Seed with demo sample and initial planets
loadDemoSample();
initPlanets();

// ─── Animation loop ────────────────────────────────────────────────────────

let lastTimestamp = 0;

function animate(timestamp) {
  const dt = Math.min(timestamp - lastTimestamp, 50);

  if (state.activeTab === 'solar') {
    const steps = Math.max(1, Math.round(getSolarSimSpeed() * dt / 16));
    stepPhysics(steps);
    pushSolarMod();
    drawSolar();
    updatePlanetReadouts();
  } else {
    drawLFO();
  }

  drawWaveform();
  updateGrainDots();

  if (state.activeTab === 'lfo') updateLFOPhaseDisplay();

  updateModLED();
  lastTimestamp = timestamp;
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
