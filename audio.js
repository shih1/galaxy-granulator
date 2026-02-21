/**
 * audio.js
 * Handles AudioContext lifecycle, worklet loading, sample decoding,
 * and play/stop transport.
 */

import { state, setWorkletParam } from './state.js';
import { pushLFOLUT, pushLFOParams } from './lfo.js';
import { pushSolarMod } from './solar.js';

// ─── Internal ──────────────────────────────────────────────────────────────

async function _loadWorklet(ctx) {
  const response = await fetch('./js/granular-processor.worklet.js');
  const code     = await response.text();
  const blob     = new Blob([code], { type: 'application/javascript' });
  const url      = URL.createObjectURL(blob);
  await ctx.audioWorklet.addModule(url);
  URL.revokeObjectURL(url);
}

async function _ensureAudioCtx() {
  if (state.audioCtx) return;
  const ctx          = new AudioContext({ sampleRate: 44100 });
  state.audioCtx     = ctx;
  await _loadWorklet(ctx);
  state.gainNode     = ctx.createGain();
  state.gainNode.gain.value = 0.7;
  state.gainNode.connect(ctx.destination);
}

function _createWorkletNode() {
  const { audioCtx, gainNode, params } = state;
  const node = new AudioWorkletNode(audioCtx, 'granular-processor', {
    numberOfOutputs:    1,
    outputChannelCount: [2],
  });

  node.port.onmessage = (e) => {
    if (e.data.type === 'status') {
      state.grainCount      = e.data.count;
      state.grainPositions  = e.data.positions ?? [];
      if (e.data.lfoPhase !== undefined) state.lfoPhaseDisplay = e.data.lfoPhase;
    }
  };

  // Push initial parameter values
  for (const [k, v] of Object.entries(params)) {
    node.parameters.get(k)?.setValueAtTime(v, audioCtx.currentTime);
  }

  // Re-send sample if one is already loaded
  if (state.sampleBuffer) {
    node.port.postMessage({ type: 'loadBuffer', buffer: state.sampleBuffer.buffer.slice(0) });
  }

  node.connect(gainNode);
  return node;
}

// ─── Public API ────────────────────────────────────────────────────────────

export async function startGranulator() {
  await _ensureAudioCtx();
  if (state.audioCtx.state === 'suspended') await state.audioCtx.resume();

  if (state.workletNode) {
    state.workletNode.disconnect();
    state.workletNode = null;
  }

  state.workletNode = _createWorkletNode();
  pushLFOLUT();
  pushLFOParams();
  pushSolarMod();

  state.isPlaying = true;
  document.getElementById('btn-play').classList.add('active');
}

export function stopGranulator() {
  if (state.workletNode) {
    state.workletNode.disconnect();
    state.workletNode = null;
  }
  state.isPlaying      = false;
  state.grainCount     = 0;
  state.grainPositions = [];
  document.getElementById('btn-play').classList.remove('active');
}

export async function loadAudioFile(file) {
  await _ensureAudioCtx();

  const arrayBuffer = await file.arrayBuffer();
  const decoded     = await state.audioCtx.decodeAudioData(arrayBuffer);

  // Down-mix to mono
  const mono = new Float32Array(decoded.length);
  for (let ch = 0; ch < decoded.numberOfChannels; ch++) {
    const cd = decoded.getChannelData(ch);
    for (let i = 0; i < decoded.length; i++) mono[i] += cd[i] / decoded.numberOfChannels;
  }

  state.sampleBuffer = mono;
  state.waveformData = mono;

  // Update UI stats
  document.getElementById('stat-name').textContent = file.name.slice(0, 20);
  document.getElementById('stat-dur').textContent  = decoded.duration.toFixed(2) + 's';
  document.getElementById('stat-sr').textContent   = decoded.sampleRate + 'Hz';
  document.getElementById('drop-text').innerHTML   =
    `&#10003; <strong>${file.name}</strong> &mdash; ${decoded.duration.toFixed(2)}s loaded`;
  document.getElementById('led-sample').className  = 'led on-amber';

  // Hot-swap buffer into running worklet
  if (state.isPlaying && state.workletNode) {
    state.workletNode.port.postMessage({ type: 'loadBuffer', buffer: mono.buffer.slice(0) });
  }
}

export function loadDemoSample() {
  const sr   = 44100;
  const n    = sr * 3;
  const demo = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    demo[i] = (
      Math.sin(2 * Math.PI * 220 * t) * 0.30 +
      Math.sin(2 * Math.PI * 330 * t) * 0.20 +
      Math.sin(2 * Math.PI * 440 * t) * 0.15 +
      Math.sin(2 * Math.PI * 110 * t) * 0.25 +
      (Math.random() * 2 - 1)         * 0.05
    ) * Math.sin(Math.PI * (i / n));
  }
  state.sampleBuffer = demo;
  state.waveformData = demo;

  document.getElementById('stat-name').textContent = 'DEMO TONE';
  document.getElementById('stat-dur').textContent  = '3.00s';
  document.getElementById('stat-sr').textContent   = '44100Hz';
  document.getElementById('drop-text').innerHTML   =
    'Demo tone loaded &mdash; <strong>DROP YOUR OWN FILE</strong> to replace';
  document.getElementById('led-sample').className  = 'led on-amber';
}
