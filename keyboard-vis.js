/**
 * keyboard-vis.js
 * Full QWERTY keyboard visualizer styled after a Mac keyboard.
 *
 * Every row totals 15 keyboard units so all rows fill the same width.
 * The stagger effect comes naturally from the left modifier keys being
 * different widths (Tab=1.5u, CapsLock=1.75u, LShift=2.25u), which
 * pushes each row's playable keys progressively to the right — just like
 * a real keyboard.
 *
 * Flex values mirror standard keyboard unit counts:
 *   Row 3: `(1) + 1-= (12×1) + ⌫(2)            = 15u
 *   Row 2: ⇥(1.5) + Q-](12×1) + \(1.5)          = 15u
 *   Row 1: ⇪(1.75) + A-'(11×1) + ⏎(2.25)        = 15u
 *   Row 0: ⇧(2.25) + Z-/(10×1) + ⇧(2.75)        = 15u
 */

import { activeKeys } from './keyboard.js';

// ─── Note labels ────────────────────────────────────────────────────────────

const NOTE_NAMES = {
  w: 'C#4', e: 'D#4', t: 'F#4', y: 'G#4', u: 'A#4', o: 'C#5', p: 'D#5',
  a: 'C4',  s: 'D4',  d: 'E4',  f: 'F4',  g: 'G4',  h: 'A4',  j: 'B4',
  k: 'C5',  l: 'D5',
};

// ─── Layout ─────────────────────────────────────────────────────────────────
// `flex` = keyboard unit width for that key

const ROWS = [
  [
    { code: 'Backquote',    label: '`',  flex: 1    },
    { code: 'Digit1',       label: '1',  flex: 1    },
    { code: 'Digit2',       label: '2',  flex: 1    },
    { code: 'Digit3',       label: '3',  flex: 1    },
    { code: 'Digit4',       label: '4',  flex: 1    },
    { code: 'Digit5',       label: '5',  flex: 1    },
    { code: 'Digit6',       label: '6',  flex: 1    },
    { code: 'Digit7',       label: '7',  flex: 1    },
    { code: 'Digit8',       label: '8',  flex: 1    },
    { code: 'Digit9',       label: '9',  flex: 1    },
    { code: 'Digit0',       label: '0',  flex: 1    },
    { code: 'Minus',        label: '-',  flex: 1    },
    { code: 'Equal',        label: '=',  flex: 1    },
    { code: 'Backspace',    label: '⌫',  flex: 2    },
  ],
  [
    { code: 'Tab',          label: '⇥',  flex: 1.5  },
    { code: 'KeyQ',         label: 'Q',  flex: 1, key: 'q' },
    { code: 'KeyW',         label: 'W',  flex: 1, key: 'w' },
    { code: 'KeyE',         label: 'E',  flex: 1, key: 'e' },
    { code: 'KeyR',         label: 'R',  flex: 1    },
    { code: 'KeyT',         label: 'T',  flex: 1, key: 't' },
    { code: 'KeyY',         label: 'Y',  flex: 1, key: 'y' },
    { code: 'KeyU',         label: 'U',  flex: 1, key: 'u' },
    { code: 'KeyI',         label: 'I',  flex: 1    },
    { code: 'KeyO',         label: 'O',  flex: 1, key: 'o' },
    { code: 'KeyP',         label: 'P',  flex: 1, key: 'p' },
    { code: 'BracketLeft',  label: '[',  flex: 1    },
    { code: 'BracketRight', label: ']',  flex: 1    },
    { code: 'Backslash',    label: '\\', flex: 1.5  },
  ],
  [
    { code: 'CapsLock',     label: '⇪',  flex: 1.75 },
    { code: 'KeyA',         label: 'A',  flex: 1, key: 'a' },
    { code: 'KeyS',         label: 'S',  flex: 1, key: 's' },
    { code: 'KeyD',         label: 'D',  flex: 1, key: 'd' },
    { code: 'KeyF',         label: 'F',  flex: 1, key: 'f' },
    { code: 'KeyG',         label: 'G',  flex: 1, key: 'g' },
    { code: 'KeyH',         label: 'H',  flex: 1, key: 'h' },
    { code: 'KeyJ',         label: 'J',  flex: 1, key: 'j' },
    { code: 'KeyK',         label: 'K',  flex: 1, key: 'k' },
    { code: 'KeyL',         label: 'L',  flex: 1, key: 'l' },
    { code: 'Semicolon',    label: ';',  flex: 1    },
    { code: 'Quote',        label: "'",  flex: 1    },
    { code: 'Enter',        label: '⏎',  flex: 2.25 },
  ],
  [
    { code: 'ShiftLeft',    label: '⇧',  flex: 2.25 },
    { code: 'KeyZ',         label: 'Z',  flex: 1    },
    { code: 'KeyX',         label: 'X',  flex: 1    },
    { code: 'KeyC',         label: 'C',  flex: 1    },
    { code: 'KeyV',         label: 'V',  flex: 1    },
    { code: 'KeyB',         label: 'B',  flex: 1    },
    { code: 'KeyN',         label: 'N',  flex: 1    },
    { code: 'KeyM',         label: 'M',  flex: 1    },
    { code: 'Comma',        label: ',',  flex: 1    },
    { code: 'Period',       label: '.',  flex: 1    },
    { code: 'Slash',        label: '/',  flex: 1    },
    { code: 'ShiftRight',   label: '⇧',  flex: 2.75 },
  ],
];

const keyEls = {};

// ─── Public API ─────────────────────────────────────────────────────────────

export function initKeyboardVis() {
  const container = document.getElementById('kbd-rows');
  if (!container) return;

  for (const row of ROWS) {
    const rowEl = document.createElement('div');
    rowEl.className = 'kbd-row';

    for (const k of row) {
      const note    = k.key ? NOTE_NAMES[k.key] : null;
      const capable = note != null;

      const el = document.createElement('div');
      el.className  = 'kbd-key' + (capable ? ' kbd-capable' : ' kbd-disabled');
      el.style.flex = k.flex;

      el.innerHTML = capable
        ? `<span class="kbd-note">${note}</span><span class="kbd-label">${k.label}</span>`
        : `<span class="kbd-label">${k.label}</span>`;

      rowEl.appendChild(el);
      keyEls[k.code] = { el, key: k.key, capable };
    }

    container.appendChild(rowEl);
  }
}

export function drawKeyboardVis() {
  for (const { el, key, capable } of Object.values(keyEls)) {
    if (!capable) continue;
    el.classList.toggle('kbd-pressed', activeKeys.has(key));
  }
}
