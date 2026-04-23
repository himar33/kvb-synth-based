import './style.css';
import { AudioEngine } from './audio/AudioEngine.ts';
import type { EngineParams } from './audio/types.ts';
// Default parameters matching the Korg Volca Bass factory settings described in the manual.
const defaultParams: EngineParams = {
  vco: {
    waveform: 'sawtooth',
    pitchOffsets: [0, 0, 0],
    groupingMode: 3,           // all three VCOs follow the same pitch
    mutes: [false, false, false],
  },
  vcf: {
    cutoff: 0.6,               // ~2000 Hz — open but not fully bright
    resonance: 0.3,            // Q ≈ 6 — mild peak
    egIntensity: 0.5,
  },
  eg: {
    attack: 0,                 // instant attack
    decay: 500,                // 500 ms decay/release
    sustainOn: false,          // AD envelope (no sustain phase)
  },
  lfo: {
    rate: 5,
    waveform: 'triangle',
    intensity: 0,              // no modulation by default
    targets: new Set(),
  },
  vca: {
    masterVolume: 0.8,
  },
};
const engine = new AudioEngine(defaultParams);
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
    <h1>Korg Volca Bass</h1>
    <p>Phase 1 — Audio Engine test</p>
    <button id="test-btn" type="button">Test Note (A2 · 110 Hz)</button>
  </div>
`;
document.querySelector<HTMLButtonElement>('#test-btn')!
  .addEventListener('click', () => {
    // init() creates the AudioContext inside the click handler to satisfy the
    // browser autoplay policy. Safe to call on every click — it's idempotent.
    engine.init();
    // MIDI note 45 = A2 = 110 Hz
    engine.triggerNote(45, 100);
    // setTimeout is intentional here: this is UI scheduling (when to release the
    // note), not audio scheduling. Audio timing inside the engine uses AudioParams.
    setTimeout(() => {
      engine.releaseNote();
    }, 500);
  });
