/**
 * keyboard-vis.js
 * Full QWERTY keyboard visualizer — mirrors the layout from KeyboardVisualizer.jsx.
 * Active note keys light up amber when held.
 */

import { activeKeys } from './keyboard.js';

// ─── Note labels for mapped keys ────────────────────────────────────────────

const NOTE_NAMES = {
  w: 'C#4', e: 'D#4', t: 'F#4', y: 'G#4', u: 'A#4', o: 'C#5', p: 'D#5',
  a: 'C4',  s: 'D4',  d: 'E4',  f: 'F4',  g: 'G4',  h: 'A4',  j: 'B4',
  k: 'C5',  l: 'D5',
};

// ─── Layout (mirrors KeyboardVisualizer.jsx row order, top → bottom) ─────────

const ROWS = [
  [
    { code: 'Backquote',    label: '`'  },
    { code: 'Digit1',       label: '1'  },
    { code: 'Digit2',       label: '2'  },
    { code: 'Digit3',       label: '3'  },
    { code: 'Digit4',       label: '4'  },
    { code: 'Digit5',       label: '5'  },
    { code: 'Digit6',       label: '6'  },
    { code: 'Digit7',       label: '7'  },
    { code: 'Digit8',       label: '8'  },
    { code: 'Digit9',       label: '9'  },
    { code: 'Digit0',       label: '0'  },
    { code: 'Minus',        label: '-'  },
    { code: 'Equal',        label: '='  },
    { code: 'Backspace',    label: '⌫', wide: true },
  ],
  [
    { code: 'Tab',          label: '⇥', wide: true },
    { code: 'KeyQ',         label: 'Q', key: 'q'  },
    { code: 'KeyW',         label: 'W', key: 'w'  },
    { code: 'KeyE',         label: 'E', key: 'e'  },
    { code: 'KeyR',         label: 'R', key: 'r'  },
    { code: 'KeyT',         label: 'T', key: 't'  },
    { code: 'KeyY',         label: 'Y', key: 'y'  },
    { code: 'KeyU',         label: 'U', key: 'u'  },
    { code: 'KeyI',         label: 'I', key: 'i'  },
    { code: 'KeyO',         label: 'O', key: 'o'  },
    { code: 'KeyP',         label: 'P', key: 'p'  },
    { code: 'BracketLeft',  label: '['  },
    { code: 'BracketRight', label: ']'  },
    { code: 'Backslash',    label: '\\' },
  ],
  [
    { code: 'CapsLock',     label: '⇪', wide: true },
    { code: 'KeyA',         label: 'A', key: 'a'  },
    { code: 'KeyS',         label: 'S', key: 's'  },
    { code: 'KeyD',         label: 'D', key: 'd'  },
    { code: 'KeyF',         label: 'F', key: 'f'  },
    { code: 'KeyG',         label: 'G', key: 'g'  },
    { code: 'KeyH',         label: 'H', key: 'h'  },
    { code: 'KeyJ',         label: 'J', key: 'j'  },
    { code: 'KeyK',         label: 'K', key: 'k'  },
    { code: 'KeyL',         label: 'L', key: 'l'  },
    { code: 'Semicolon',    label: ';'  },
    { code: 'Quote',        label: "'"  },
    { code: 'Enter',        label: '⏎', wide: true },
  ],
  [
    { code: 'ShiftLeft',    label: '⇧', extraWide: true },
    { code: 'KeyZ',         label: 'Z', key: 'z'  },
    { code: 'KeyX',         label: 'X', key: 'x'  },
    { code: 'KeyC',         label: 'C', key: 'c'  },
    { code: 'KeyV',         label: 'V', key: 'v'  },
    { code: 'KeyB',         label: 'B', key: 'b'  },
    { code: 'KeyN',         label: 'N', key: 'n'  },
    { code: 'KeyM',         label: 'M', key: 'm'  },
    { code: 'Comma',        label: ','  },
    { code: 'Period',       label: '.'  },
    { code: 'Slash',        label: '/'  },
    { code: 'ShiftRight',   label: '⇧', extraWide: true },
  ],
];

// code → DOM element
const keyEls = {};

// ─── Public API ─────────────────────────────────────────────────────────────

export function initKeyboardVis() {
  const container = document.getElementById('kbd-rows');
  if (!container) return;

  for (const row of ROWS) {
    const rowEl = document.createElement('div');
    rowEl.className = 'kbd-row';

    for (const k of row) {
      const el    = document.createElement('div');
      const note  = k.key ? NOTE_NAMES[k.key] : null;
      const capable = note != null;

      el.className = 'kbd-key'
        + (k.wide      ? ' kbd-wide'       : '')
        + (k.extraWide ? ' kbd-extra-wide'  : '')
        + (!capable    ? ' kbd-disabled'    : ' kbd-capable');

      if (capable) {
        el.innerHTML =
          `<span class="kbd-note">${note}</span>` +
          `<span class="kbd-label">${k.label}</span>`;
      } else {
        el.innerHTML = `<span class="kbd-label">${k.label}</span>`;
      }

      rowEl.appendChild(el);
      keyEls[k.code] = { el, key: k.key, capable };
    }

    container.appendChild(rowEl);
  }
}

export function drawKeyboardVis() {
  for (const { el, key, capable } of Object.values(keyEls)) {
    if (!capable) continue;
    const pressed = activeKeys.has(key);
    el.classList.toggle('kbd-pressed', pressed);
  }
}
