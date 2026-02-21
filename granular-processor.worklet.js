/**
 * granular-processor.worklet.js
 * AudioWorklet processor for real-time granular synthesis.
 * Handles grain spawning, windowing, LFO modulation, and solar modulation.
 */

class GranularProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.MAX = 128;
    this.grains = [];
    for (let i = 0; i < this.MAX; i++) {
      this.grains.push({
        active: false,
        phase: 0,
        sampleStart: 0,
        length: 0,
        rate: 1,
        wt: 0,
        panL: 0.707,
        panR: 0.707,
      });
    }

    this.buf = null;
    this.bufLen = 0;
    this.sinceSpawn = 0;

    // Pre-compute window lookup tables
    const N = 2048;
    const hann     = new Float32Array(N);
    const tri      = new Float32Array(N);
    const tukey    = new Float32Array(N);
    const gaussian = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const v = i / (N - 1);
      hann[i]     = 0.5 * (1 - Math.cos(2 * Math.PI * v));
      tri[i]      = v < 0.5 ? 2 * v : 2 * (1 - v);
      const a     = 0.5;
      tukey[i]    = v < a / 2 ? 0.5 * (1 - Math.cos(2 * Math.PI * v / a))
                  : v > 1 - a / 2 ? 0.5 * (1 - Math.cos(2 * Math.PI * (1 - v) / a))
                  : 1;
      gaussian[i] = Math.exp(-0.5 * Math.pow((v - 0.5) / 0.15, 2));
    }
    this.wluts = [hann, tri, tukey, gaussian];
    this.LN = N;

    // LFO state
    this.lfoLUT      = new Float32Array(2048).fill(0.5);
    this.lfoPhase    = 0;
    this.lfoFreq     = 2;
    this.lfoTarget   = 0;
    this.lfoBipolar  = true;
    this.lfoEnabled  = true;

    // Mod depth smoother
    this.depthS = 0;

    // Solar modulation state
    this.solarEnabled = false;
    this.solarMods    = [0, 0, 0, 0, 0, 0];

    this.reportTimer = 0;

    this.port.onmessage = (e) => {
      const d = e.data;
      if (d.type === 'loadBuffer') {
        this.buf    = new Float32Array(d.buffer);
        this.bufLen = this.buf.length;
      }
      if (d.type === 'UPDATE_LFO_LUT') {
        this.lfoLUT = new Float32Array(d.lut);
      }
      if (d.type === 'UPDATE_LFO_PARAMS') {
        if (d.freq     !== undefined) this.lfoFreq    = d.freq;
        if (d.target   !== undefined) this.lfoTarget  = d.target;
        if (d.bipolar  !== undefined) this.lfoBipolar = d.bipolar;
        if (d.enabled  !== undefined) this.lfoEnabled = d.enabled;
      }
      if (d.type === 'SOLAR_MOD') {
        this.solarEnabled = d.enabled;
        if (d.mods) this.solarMods = d.mods;
      }
    };
  }

  static get parameterDescriptors() {
    return [
      { name: 'position',    defaultValue: 0.5,  minValue: 0,    maxValue: 1,   automationRate: 'k-rate' },
      { name: 'density',     defaultValue: 12,   minValue: 0.5,  maxValue: 100, automationRate: 'k-rate' },
      { name: 'grainLength', defaultValue: 0.1,  minValue: 0.01, maxValue: 1,   automationRate: 'k-rate' },
      { name: 'pitch',       defaultValue: 0,    minValue: -24,  maxValue: 24,  automationRate: 'k-rate' },
      { name: 'pitchRand',   defaultValue: 0,    minValue: 0,    maxValue: 1,   automationRate: 'k-rate' },
      { name: 'scatter',     defaultValue: 0.05, minValue: 0,    maxValue: 1,   automationRate: 'k-rate' },
      { name: 'panSpread',   defaultValue: 0.3,  minValue: 0,    maxValue: 1,   automationRate: 'k-rate' },
      { name: 'windowType',  defaultValue: 0,    minValue: 0,    maxValue: 3,   automationRate: 'k-rate' },
      { name: 'direction',   defaultValue: 1,    minValue: 0,    maxValue: 1,   automationRate: 'k-rate' },
      { name: 'mix',         defaultValue: 1,    minValue: 0,    maxValue: 1,   automationRate: 'k-rate' },
      { name: 'modDepth',    defaultValue: 0.25, minValue: 0,    maxValue: 1,   automationRate: 'k-rate' },
    ];
  }

  /** Read window LUT with linear interpolation */
  readWindow(idx, phase) {
    const lut = this.wluts[idx | 0];
    const fp  = phase * (this.LN - 1);
    const i   = fp | 0;
    const fr  = fp - i;
    return i >= this.LN - 1 ? lut[this.LN - 1] : lut[i] * (1 - fr) + lut[i + 1] * fr;
  }

  /** Read LFO LUT with linear interpolation */
  readLFO(phase) {
    const fp = phase * 2047;
    const i0 = fp | 0;
    const fr = fp - i0;
    return this.lfoLUT[i0] * (1 - fr) + this.lfoLUT[(i0 + 1) % 2048] * fr;
  }

  /** Read sample buffer with linear interpolation */
  readSample(pos) {
    if (!this.buf) return 0;
    pos     = ((pos % this.bufLen) + this.bufLen) % this.bufLen;
    const i = pos | 0;
    const fr = pos - i;
    return this.buf[i] * (1 - fr) + this.buf[(i + 1) % this.bufLen] * fr;
  }

  /** Apply a modulation value to a specific parameter target */
  applyMod(p, target, mod) {
    switch (target) {
      case 0: p.position    = Math.max(0,    Math.min(1,   p.position    + mod));          break;
      case 1: p.density     = Math.max(0.5,  Math.min(100, p.density     + mod * 49.75));  break;
      case 2: p.grainLength = Math.max(0.01, Math.min(1,   p.grainLength + mod * 0.495));  break;
      case 3: p.pitch       = Math.max(-24,  Math.min(24,  p.pitch       + mod * 12));     break;
      case 4: p.panSpread   = Math.max(0,    Math.min(1,   p.panSpread   + mod));          break;
      case 5: p.scatter     = Math.max(0,    Math.min(1,   p.scatter     + Math.abs(mod)));break;
    }
  }

  /** Spawn a new grain using current parameter state */
  spawnGrain(p) {
    for (let i = 0; i < this.MAX; i++) {
      const g = this.grains[i];
      if (!g.active) {
        const sc = (Math.random() * 2 - 1) * p.scatter;
        const hp = Math.max(0, Math.min(1, p.position + sc));
        g.active      = true;
        g.phase       = 0;
        g.sampleStart = hp * this.bufLen;
        g.length      = p.grainLength;

        const semitones = p.pitch + (Math.random() * 2 - 1) * p.pitchRand * 12;
        g.rate = Math.pow(2, semitones / 12);
        if (Math.random() > p.direction) g.rate *= -1;

        g.wt = p.windowType | 0;
        const pan  = (Math.random() * 2 - 1) * p.panSpread;
        const ang  = (pan + 1) * 0.25 * Math.PI;
        g.panL = Math.cos(ang);
        g.panR = Math.sin(ang);
        return;
      }
    }
  }

  process(inputs, outputs, parameters) {
    const out = outputs[0];
    const L   = out[0];
    const R   = out[1];
    if (!L) return true;

    // Smooth mod depth
    this.depthS += (parameters.modDepth[0] - this.depthS) * 0.002;

    // Build mutable parameter snapshot for this block
    const p = {
      position:    parameters.position[0],
      density:     parameters.density[0],
      grainLength: parameters.grainLength[0],
      pitch:       parameters.pitch[0],
      pitchRand:   parameters.pitchRand[0],
      scatter:     parameters.scatter[0],
      panSpread:   parameters.panSpread[0],
      windowType:  parameters.windowType[0],
      direction:   parameters.direction[0],
      mix:         parameters.mix[0],
    };

    // Advance LFO and apply
    this.lfoPhase += this.lfoFreq / sampleRate;
    if (this.lfoPhase >= 1) this.lfoPhase -= 1;
    if (this.lfoEnabled) {
      const raw = this.readLFO(this.lfoPhase);
      const lv  = this.lfoBipolar ? (raw * 2 - 1) : raw;
      this.applyMod(p, this.lfoTarget, lv * this.depthS);
    }

    // Apply solar modulation
    if (this.solarEnabled) {
      for (let t = 0; t < this.solarMods.length; t++) {
        if (this.solarMods[t] !== 0) this.applyMod(p, t, this.solarMods[t]);
      }
    }

    const spawnInterval = sampleRate / p.density;

    for (let i = 0; i < L.length; i++) {
      this.sinceSpawn++;
      if (this.sinceSpawn >= spawnInterval) {
        if (this.bufLen > 0) this.spawnGrain(p);
        this.sinceSpawn = 0;
      }

      let sL = 0, sR = 0;
      for (let g = 0; g < this.MAX; g++) {
        const gr = this.grains[g];
        if (!gr.active) continue;
        gr.phase += (1 / (gr.length * sampleRate)) * Math.abs(gr.rate);
        if (gr.phase >= 1) { gr.active = false; continue; }
        const w  = this.readWindow(gr.wt, gr.phase);
        const sp = gr.sampleStart + gr.phase * gr.length * sampleRate * Math.sign(gr.rate);
        const s  = this.readSample(sp);
        sL += s * w * gr.panL;
        sR += s * w * gr.panR;
      }

      L[i] = sL * p.mix;
      if (R) R[i] = sR * p.mix;
    }

    // Periodic status report to main thread
    this.reportTimer++;
    if (this.reportTimer > 20) {
      this.reportTimer = 0;
      let cnt = 0;
      const positions = [];
      for (let g = 0; g < this.MAX; g++) {
        if (this.grains[g].active) {
          cnt++;
          positions.push({
            sampleStart: this.grains[g].sampleStart,
            phase:       this.grains[g].phase,
            length:      this.grains[g].length,
          });
        }
      }
      this.port.postMessage({ type: 'status', count: cnt, positions, lfoPhase: this.lfoPhase });
    }

    return true;
  }
}

registerProcessor('granular-processor', GranularProcessor);
