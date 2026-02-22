/**
 * state.js
 * Centralised application state. All modules import from here.
 * Avoids implicit globals and makes data flow explicit.
 */

export const state = {
  // ── Audio ──────────────────────────────────────────────────
  audioCtx:      null,
  workletNode:   null,   // mono: the single node; poly: most-recently-created voice
  gainNode:      null,
  isPlaying:     false,

  // ── Polyphony ──────────────────────────────────────────────
  polyMode:         false,
  voices:           new Map(),  // key string → AudioWorkletNode
  voiceGrainCounts: {},         // key string → grain count

  // ── Sample ─────────────────────────────────────────────────
  sampleBuffer:  null,
  waveformData:  null,

  // ── Grain display ──────────────────────────────────────────
  grainCount:    0,
  grainPositions: [],
  lfoPhaseDisplay: 0,

  // ── Tab ────────────────────────────────────────────────────
  activeTab: 'lfo',

  // ── Synth parameters (mirrored from worklet) ───────────────
  params: {
    position:    0.5,
    scatter:     0.05,
    density:     12,
    grainLength: 0.1,
    pitch:       0,
    pitchRand:   0,
    panSpread:   0.3,
    windowType:  0,
    direction:   1,
    mix:         1,
    modDepth:    0.25,
  },
};

/** Set a k-rate param on all active nodes (mono or poly). */
export function setWorkletParam(name, value) {
  const { audioCtx, polyMode, voices, workletNode } = state;
  const t     = audioCtx?.currentTime ?? 0;
  const nodes = polyMode ? [...voices.values()] : (workletNode ? [workletNode] : []);
  for (const node of nodes) node.parameters.get(name)?.setValueAtTime(value, t);
}

/** Post a message to all active nodes (mono or poly). */
export function broadcastMessage(msg) {
  const { polyMode, voices, workletNode } = state;
  const nodes = polyMode ? [...voices.values()] : (workletNode ? [workletNode] : []);
  for (const node of nodes) node.port.postMessage(msg);
}
