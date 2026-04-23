import './style.css';
import { AudioEngine } from './audio/AudioEngine';
import { Sequencer } from './sequencer/Sequencer';
import type { EngineParams } from './audio/types';
import type { SequenceData } from './sequencer/types';
const defaultParams: EngineParams = {
  vco: {
    waveform: 'sawtooth',
    pitchOffsets: [0, 0, 0],
    groupingMode: 3,
    mutes: [false, false, false],
  },
  vcf: {
    cutoff: 0.6,
    resonance: 0.3,
    egIntensity: 0.5,
  },
  eg: {
    attack: 0,
    decay: 500,
    sustainOn: false,
  },
  lfo: {
    rate: 5,
    waveform: 'triangle',
    intensity: 0,
    targets: new Set(),
  },
  vca: {
    masterVolume: 0.8,
  },
};
// Test sequence: [A2, C3, E3, G3, A3, G3, E3, C3] across 8 steps in groupingMode 3.
// Steps 2 and 4 (index 1 and 3) have slide — EG is not retriggered on those steps.
function makeTestSequence(): SequenceData {
  const notes = [45, 48, 52, 55, 57, 55, 52, 48]; // A2 C3 E3 G3 A3 G3 E3 C3
  const makeVco = () => ({
    steps: Array.from({ length: 16 }, (_, i) => ({
      active: i < 8,
      enabled: i < 8,
      midiNote: notes[i] ?? 60,
      slide: i === 1 || i === 3, // steps 2 and 4 slide into the next note
    })) as SequenceData['vco'][0]['steps'],
  });
  return {
    groupingMode: 3,
    vco: [makeVco(), makeVco(), makeVco()],
  };
}
const engine = new AudioEngine(defaultParams);
let sequencer: Sequencer | null = null;
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
    <h1>Korg Volca Bass</h1>
    <p>Phase 2 — Sequencer test</p>
    <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
      <button id="test-btn" type="button">Test Note (A2)</button>
      <label>
        BPM
        <input id="tempo-input" type="number" value="120" min="10" max="600" style="width:70px">
      </label>
      <button id="play-btn" type="button">Play</button>
      <button id="stop-btn" type="button">Stop</button>
    </div>
    <p id="status" style="color:#888;font-size:0.9em">Stopped</p>
  </div>
`;
const statusEl = document.querySelector<HTMLParagraphElement>('#status')!;
document.querySelector<HTMLButtonElement>('#test-btn')!
  .addEventListener('click', () => {
    engine.init();
    engine.triggerNote(45, 0);
    // setTimeout is intentional: this is UI scheduling (when to release the
    // note in the test harness), not audio scheduling. Audio uses AudioParams.
    setTimeout(() => { engine.releaseNote(); }, 500);
  });
document.querySelector<HTMLButtonElement>('#play-btn')!
  .addEventListener('click', () => {
    engine.init();
    if (sequencer === null) {
      sequencer = new Sequencer(engine.getAudioContext(), engine);
      sequencer.setSequence(makeTestSequence());
    }
    const tempoInput = document.querySelector<HTMLInputElement>('#tempo-input')!;
    sequencer.setTempo(Number(tempoInput.value));
    sequencer.play();
    statusEl.textContent = 'Playing…';
  });
document.querySelector<HTMLButtonElement>('#stop-btn')!
  .addEventListener('click', () => {
    sequencer?.stop();
    statusEl.textContent = 'Stopped';
  });
document.querySelector<HTMLInputElement>('#tempo-input')!
  .addEventListener('input', (e) => {
    const bpm = Number((e.target as HTMLInputElement).value);
    sequencer?.setTempo(bpm);
  });