/**
 * keyboard.js
 * Piano-style keyboard input.
 *
 * White keys:  A  S  D  F  G  H  J  K  L
 *              C  D  E  F  G  A  B  C  D
 *
 * Black keys:  W  E     T  Y  U     O  P
 *              C# D#    F# G# A#    C# D#
 *
 * Keydown → set pitch + start granulator (if not already playing).
 * Keyup   → stop granulator.
 */

import { state, setWorkletParam } from './state.js';
import { startGranulator, stopGranulator } from './audio.js';
import { drawKnob } from './knobs.js';

// ─── Key → semitone offset (relative to C) ─────────────────────────────────

const KEY_SEMITONES = {
  a:  0,   // C
  w:  1,   // C#
  s:  2,   // D
  e:  3,   // D#
  d:  4,   // E
  f:  5,   // F
  t:  6,   // F#
  g:  7,   // G
  y:  8,   // G#
  h:  9,   // A
  u: 10,   // A#
  j: 11,   // B
  k: 12,   // C (octave up)
  o: 13,   // C#
  l: 14,   // D
  p: 15,   // D#
};

// ─── Internal ───────────────────────────────────────────────────────────────

let activeKey = null;

function updatePitchKnob(semitones) {
  const wrap = document.getElementById('knob-pitch');
  if (!wrap) return;

  wrap.dataset.val = semitones;
  state.params.pitch = semitones;

  const canvas = wrap.querySelector('canvas');
  const min = parseFloat(wrap.dataset.min); // -24
  const max = parseFloat(wrap.dataset.max); // +24
  drawKnob(canvas, (semitones - min) / (max - min));

  const valEl = wrap.querySelector('.knob-value');
  if (valEl) valEl.textContent = (semitones >= 0 ? '+' : '') + semitones.toFixed(1) + 'st';
}

// ─── Public API ─────────────────────────────────────────────────────────────

export function initKeyboard() {
  document.addEventListener('keydown', (e) => {
    // Don't intercept when typing in a form field
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    // Ignore key-repeat events
    if (e.repeat) return;

    const key = e.key.toLowerCase();
    if (!(key in KEY_SEMITONES)) return;

    e.preventDefault();
    activeKey = key;

    const semitones = KEY_SEMITONES[key];
    updatePitchKnob(semitones);
    setWorkletParam('pitch', semitones);

    if (!state.isPlaying) startGranulator();
  });

  document.addEventListener('keyup', (e) => {
    if (e.key.toLowerCase() !== activeKey) return;
    activeKey = null;
    stopGranulator();
  });
}
