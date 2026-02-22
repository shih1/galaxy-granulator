/**
 * modmatrix.js
 * Modulation matrix: 9 planet sources × 8 granulator destinations.
 * Sources: P1/P2/P3 × X/Y/V  —  Destinations: POS SCAT DENS LEN PITCH P·RND PAN MIX
 */

import { state } from './state.js';
import { getPlanetSources, getBodyCount } from './solar.js';

const DST_LABELS = ['POS', 'SCAT', 'DENS', 'LEN', 'PITCH', 'P·RND', 'PAN', 'MIX'];
const SRC_LABELS = [
  'P1 X', 'P1 Y', 'P1 V',
  'P2 X', 'P2 Y', 'P2 V',
  'P3 X', 'P3 Y', 'P3 V',
];
const N_SRC = 9, N_DST = 8;

// ─── State ──────────────────────────────────────────────────────────────────

export const matrix = Array.from({ length: N_SRC }, () => new Float32Array(N_DST));
export let matrixEnabled = true;

// ─── DOM cache ──────────────────────────────────────────────────────────────

const cellEls  = Array.from({ length: N_SRC }, () => new Array(N_DST).fill(null));
const rowEls   = new Array(N_SRC).fill(null);
const meterEls = new Array(N_SRC).fill(null);

// ─── Drag state ─────────────────────────────────────────────────────────────

let dragState = null;
let didDrag   = false;

// ─── Push to worklet ────────────────────────────────────────────────────────

export function pushMatrixMod() {
  if (!state.workletNode) return;
  const sources = getPlanetSources();
  const mods    = new Float32Array(N_DST);
  for (let s = 0; s < N_SRC; s++) {
    if (sources[s] === 0) continue;
    for (let d = 0; d < N_DST; d++) {
      mods[d] += sources[s] * matrix[s][d];
    }
  }
  for (let d = 0; d < N_DST; d++) {
    mods[d] = Math.max(-1, Math.min(1, mods[d]));
  }
  state.workletNode.port.postMessage({ type: 'MOD_MATRIX', enabled: matrixEnabled, mods });
}

// ─── Display updates ────────────────────────────────────────────────────────

export function updateMatrixDisplay() {
  const sources   = getPlanetSources();
  const bodyCount = getBodyCount();
  for (let s = 0; s < N_SRC; s++) {
    const planet = Math.floor(s / 3);
    const active = planet < bodyCount;
    if (rowEls[s]) rowEls[s].style.opacity = active ? '1' : '0.3';
    const meterBar = meterEls[s];
    if (meterBar) {
      if (active) {
        const v    = sources[s];
        const axis = s % 3;
        if (axis === 2) {
          // V: unipolar 0..+1, fill from left
          meterBar.style.left  = '0%';
          meterBar.style.width = (v * 100) + '%';
        } else {
          // X/Y: bipolar −1..+1, extend from center
          const pct            = Math.abs(v) * 50;
          meterBar.style.left  = (v < 0 ? 50 - pct : 50) + '%';
          meterBar.style.width = pct + '%';
        }
      } else {
        meterBar.style.width = '0%';
      }
    }
  }
}

function updateCellDisplay(s, d) {
  const el = cellEls[s][d];
  if (!el) return;
  const v     = matrix[s][d];
  const bar   = el.querySelector('.mm-bar');
  const valEl = el.querySelector('.mm-val');
  if (Math.abs(v) < 0.005) {
    bar.style.width = '0%';
    valEl.textContent = '·';
    valEl.style.color = 'var(--text-dim)';
  } else {
    const pct      = Math.abs(v) * 50;
    bar.style.width = pct + '%';
    bar.style.left  = v < 0 ? (50 - pct) + '%' : '50%';
    bar.style.background = v > 0 ? 'var(--amber)' : 'var(--violet)';
    valEl.textContent  = (v >= 0 ? '+' : '') + v.toFixed(2);
    valEl.style.color  = v > 0 ? 'var(--amber)' : 'var(--violet)';
  }
}

// ─── Init ────────────────────────────────────────────────────────────────────

export function initModMatrix() {
  const tbody = document.getElementById('matrix-body');
  if (!tbody) return;

  for (let s = 0; s < N_SRC; s++) {
    const tr = document.createElement('tr');
    rowEls[s] = tr;

    // Source label + meter
    const tdLabel   = document.createElement('td');
    tdLabel.className = 'mm-src-label';
    const labelText = document.createElement('div');
    labelText.textContent = SRC_LABELS[s];
    const meterWrap = document.createElement('div');
    meterWrap.className = 'mm-meter-wrap';
    const meterBar  = document.createElement('div');
    meterBar.className = 'mm-meter-bar';
    meterEls[s] = meterBar;
    meterWrap.appendChild(meterBar);
    tdLabel.appendChild(labelText);
    tdLabel.appendChild(meterWrap);
    tr.appendChild(tdLabel);

    // Destination cells
    for (let d = 0; d < N_DST; d++) {
      const td  = document.createElement('td');
      td.className = 'mm-cell';

      const bar   = document.createElement('div');
      bar.className = 'mm-bar';

      const valEl = document.createElement('div');
      valEl.className = 'mm-val';
      valEl.textContent = '·';

      td.appendChild(bar);
      td.appendChild(valEl);
      cellEls[s][d] = td;

      // Capture s/d for event handlers
      (function (s, d) {
        td.addEventListener('mousedown', (e) => {
          e.preventDefault();
          dragState = { s, d, startY: e.clientY, startVal: matrix[s][d] };
          didDrag = false;
        });
        td.addEventListener('dblclick', (e) => {
          e.preventDefault();
          matrix[s][d] = 0;
          updateCellDisplay(s, d);
        });
      })(s, d);

      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }

  // Global drag handlers
  window.addEventListener('mousemove', (e) => {
    if (!dragState) return;
    const dy = dragState.startY - e.clientY;  // up = positive
    if (Math.abs(dy) > 3) didDrag = true;
    matrix[dragState.s][dragState.d] =
      Math.max(-1, Math.min(1, dragState.startVal + dy / 100));
    updateCellDisplay(dragState.s, dragState.d);
  });

  window.addEventListener('mouseup', () => {
    if (!dragState) return;
    if (!didDrag) {
      const { s, d } = dragState;
      matrix[s][d] = Math.abs(matrix[s][d]) < 0.01 ? 0.5 : 0;
      updateCellDisplay(s, d);
    }
    dragState = null;
  });

  // Clear all button
  document.getElementById('btn-matrix-clear').addEventListener('click', () => {
    for (let s = 0; s < N_SRC; s++) {
      for (let d = 0; d < N_DST; d++) {
        matrix[s][d] = 0;
        updateCellDisplay(s, d);
      }
    }
  });
}
