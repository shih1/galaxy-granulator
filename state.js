/**
 * state.js
 * Centralised application state. All modules import from here.
 * Avoids implicit globals and makes data flow explicit.
 */

export const state = {
  // ── Audio ──────────────────────────────────────────────────
  audioCtx:      null,
  workletNode:   null,
  gainNode:      null,
  isPlaying:     false,

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

/** Shortcut to set a worklet k-rate parameter */
export function setWorkletParam(name, value) {
  const { workletNode, audioCtx } = state;
  if (workletNode) {
    workletNode.parameters.get(name)?.setValueAtTime(value, audioCtx?.currentTime ?? 0);
  }
}
