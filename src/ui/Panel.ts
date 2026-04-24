import { AudioEngine } from '../audio/AudioEngine';
import { Sequencer } from '../sequencer/Sequencer';
import { Memory } from '../sequencer/Memory';
import type { EngineParams } from '../audio/types';
import type { SequenceData } from '../sequencer/types';
import { Knob } from './Knob';
import { StepButton } from './StepButton';
import { Display } from './Display';

type SlotIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

// Default params matching knob initial positions.
const DEFAULT_PARAMS: EngineParams = {
  vco: { waveform: 'sawtooth', pitchOffsets: [0, 0, 0], groupingMode: 3, mutes: [false, false, false] },
  vcf: { cutoff: 0.6, resonance: 0.3, egIntensity: 0.5 },
  eg: { attack: 0, decay: 500, sustainOn: false },
  lfo: { rate: 5, waveform: 'triangle', intensity: 0, targets: new Set() },
  vca: { masterVolume: 0.8 },
};

// Note pitch labels for chromatic scale, using flat notation for accidentals.
const NOTE_DISPLAY: string[] = [
  'C', 'db', 'd', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'bb', 'b',
];
const NOTE_IS_NATURAL = [true, false, true, false, true, true, false, true, false, true, false, true];

function midiToDisplay(midi: number): string {
  const note = midi % 12;
  const oct = Math.floor(midi / 12) - 1;
  const octStr = String(Math.max(0, oct));
  const name = NOTE_DISPLAY[note] ?? 'A';
  if (NOTE_IS_NATURAL[note]) {
    return (name + ' ' + octStr + ' ').slice(0, 4);
  }
  return (name + octStr + ' ').slice(0, 4);
}

function makeDefaultSequence(): SequenceData {
  const notes = [45, 48, 52, 55, 57, 55, 52, 48]; // A2 C3 E3 G3 A3 G3 E3 C3
  const makeVco = () => ({
    steps: Array.from({ length: 16 }, (_, i) => ({
      active: i < 8,
      enabled: i < 8,
      midiNote: notes[i] ?? 60,
      slide: i === 1 || i === 3,
    })) as SequenceData['vco'][0]['steps'],
  });
  return { groupingMode: 3, vco: [makeVco(), makeVco(), makeVco()] };
}

export class Panel {
  readonly element: HTMLElement;

  private engine: AudioEngine;
  private sequencer: Sequencer | null = null;
  private memory: Memory;

  private initialized = false;
  private isPlaying = false;
  private keyboardMode = false;
  private funcHeld = false;
  private selectedVco: 0 | 1 | 2 = 0;
  private currentStep = -1;
  private baseOctave = 1;
  private vcoMutes: [boolean, boolean, boolean] = [false, false, false];
  private activeKeyPads = new Set<number>();
  private tempo = 120;

  private display: Display;
  private stepButtons: StepButton[] = [];
  private knobs: Map<string, Knob> = new Map();

  private playBtn!: HTMLButtonElement;
  private stopBtn!: HTMLButtonElement;
  private funcBtn!: HTMLButtonElement;
  private stepModeBtn!: HTMLButtonElement;
  private vcoButtons: HTMLButtonElement[] = [];
  private memorySlotBtns: HTMLButtonElement[] = [];
  private octaveNumEl!: HTMLElement;

  constructor() {
    this.engine = new AudioEngine(DEFAULT_PARAMS);
    this.memory = new Memory();
    this.display = new Display();

    this.element = document.createElement('div');
    this.element.className = 'volca-panel';
    this.build();
    this.updateStepLeds();
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  private build(): void {
    this.buildHeader();
    this.buildKnobs();
    this.buildControls();
    this.buildSteps();
  }

  private buildHeader(): void {
    const header = document.createElement('div');
    header.className = 'panel-header';

    // Brand
    const brand = document.createElement('div');
    brand.className = 'panel-brand';
    brand.innerHTML = '<span class="brand-korg">KORG</span><span class="brand-model">volca bass</span>';

    // Display
    const displayWrap = document.createElement('div');
    displayWrap.className = 'panel-display-wrap';
    const displayLabel = document.createElement('div');
    displayLabel.className = 'display-label';
    displayLabel.textContent = 'DISPLAY';
    displayWrap.append(displayLabel, this.display.element);

    // Memory slots
    const memWrap = document.createElement('div');
    memWrap.className = 'panel-memory-wrap';
    const memLabel = document.createElement('div');
    memLabel.className = 'section-label';
    memLabel.textContent = 'MEMORY';
    const memSlots = document.createElement('div');
    memSlots.className = 'memory-slots';
    for (let i = 0; i < 8; i++) {
      const btn = document.createElement('button');
      btn.className = 'mem-slot-btn';
      btn.type = 'button';
      btn.textContent = String(i + 1);
      btn.title = `Slot ${i + 1}`;
      btn.addEventListener('click', () => { this.handleMemorySlot(i as SlotIndex); });
      this.memorySlotBtns.push(btn);
      memSlots.appendChild(btn);
    }
    memWrap.append(memLabel, memSlots);
    this.updateMemorySlotBtns();

    // Transport
    const transport = document.createElement('div');
    transport.className = 'panel-transport';

    this.playBtn = document.createElement('button');
    this.playBtn.className = 'hw-btn play-btn';
    this.playBtn.type = 'button';
    this.playBtn.textContent = '▶ PLAY';
    this.playBtn.addEventListener('click', () => { this.handlePlay(); });

    this.stopBtn = document.createElement('button');
    this.stopBtn.className = 'hw-btn stop-btn';
    this.stopBtn.type = 'button';
    this.stopBtn.textContent = '■ STOP';
    this.stopBtn.addEventListener('click', () => { this.handleStop(); });

    transport.append(this.playBtn, this.stopBtn);

    header.append(brand, displayWrap, memWrap, transport);
    this.element.appendChild(header);
  }

  private buildKnobs(): void {
    const section = document.createElement('div');
    section.className = 'panel-knobs-section';

    const groups: Array<{ label: string; knobs: Array<{ id: string; label: string; value: number }> }> = [
      {
        label: 'TEMPO',
        knobs: [{ id: 'tempo', label: 'TEMPO', value: (this.tempo - 40) / 200 }],
      },
      {
        label: 'VCO',
        knobs: [
          { id: 'pitch1', label: 'VCO1', value: 0.5 },
          { id: 'pitch2', label: 'VCO2', value: 0.5 },
          { id: 'pitch3', label: 'VCO3', value: 0.5 },
        ],
      },
      {
        label: 'LFO',
        knobs: [
          { id: 'lfoRate', label: 'RATE', value: (5 - 0.1) / 29.9 },
          { id: 'lfoInt', label: 'INT', value: 0 },
        ],
      },
      {
        label: 'EG',
        knobs: [
          { id: 'attack', label: 'ATTACK', value: 0 },
          { id: 'decay', label: 'DECAY', value: 500 / 2000 },
        ],
      },
      {
        label: 'VCF',
        knobs: [
          { id: 'cutoff', label: 'CUTOFF', value: 0.6 },
          { id: 'peak', label: 'PEAK', value: 0.3 },
        ],
      },
      {
        label: 'VCA',
        knobs: [{ id: 'volume', label: 'VOLUME', value: 0.8 }],
      },
    ];

    for (const group of groups) {
      const groupEl = document.createElement('div');
      groupEl.className = 'knob-group';

      const groupLabel = document.createElement('div');
      groupLabel.className = 'knob-group-label';
      groupLabel.textContent = group.label;
      groupEl.appendChild(groupLabel);

      const row = document.createElement('div');
      row.className = 'knobs-row';

      for (const cfg of group.knobs) {
        const knob = new Knob(cfg.label, cfg.value);
        this.knobs.set(cfg.id, knob);
        knob.element.addEventListener('knob-change', (e) => {
          this.handleKnob(cfg.id, (e as CustomEvent<{ value: number }>).detail.value);
        });
        row.appendChild(knob.element);
      }

      groupEl.appendChild(row);
      section.appendChild(groupEl);
    }

    this.element.appendChild(section);
  }
private buildControls(): void {
    const row = document.createElement('div');
    row.className = 'panel-controls';

    // VCO select
    const vcoLabel = document.createElement('span');
    vcoLabel.className = 'control-label';
    vcoLabel.textContent = 'VCO';
    row.appendChild(vcoLabel);

    for (let i = 0; i < 3; i++) {
      const btn = document.createElement('button');
      btn.className = 'hw-btn vco-btn' + (i === 0 ? ' active' : '');
      btn.type = 'button';
      btn.textContent = `VCO${i + 1}`;
      btn.addEventListener('click', () => { this.handleVcoButton(i as 0 | 1 | 2); });
      this.vcoButtons.push(btn);
      row.appendChild(btn);
    }

    const sep1 = document.createElement('div');
    sep1.className = 'flex-spacer';
    row.appendChild(sep1);

    // FUNC
    this.funcBtn = document.createElement('button');
    this.funcBtn.className = 'hw-btn func-btn';
    this.funcBtn.type = 'button';
    this.funcBtn.textContent = 'FUNC';
    this.funcBtn.addEventListener('mousedown', () => {
      this.funcHeld = true;
      this.funcBtn.classList.add('active');
    });
    this.funcBtn.addEventListener('mouseup', () => { this.clearFunc(); });
    this.funcBtn.addEventListener('mouseleave', () => { this.clearFunc(); });
    this.funcBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.funcHeld = true;
      this.funcBtn.classList.add('active');
    }, { passive: false });
    this.funcBtn.addEventListener('touchend', () => { this.clearFunc(); });
    row.appendChild(this.funcBtn);

    // STEP / KEY toggle
    this.stepModeBtn = document.createElement('button');
    this.stepModeBtn.className = 'hw-btn stepmode-btn';
    this.stepModeBtn.type = 'button';
    this.stepModeBtn.textContent = 'STEP';
    this.stepModeBtn.addEventListener('click', () => { this.toggleKeyboardMode(); });
    row.appendChild(this.stepModeBtn);

    const sep2 = document.createElement('div');
    sep2.className = 'flex-spacer';
    row.appendChild(sep2);

    // Octave
    const octGroup = document.createElement('div');
    octGroup.className = 'octave-control';

    const octLabel = document.createElement('span');
    octLabel.className = 'control-label';
    octLabel.textContent = 'OCT';

    const octDown = document.createElement('button');
    octDown.className = 'hw-btn oct-btn';
    octDown.type = 'button';
    octDown.textContent = '−';
    octDown.addEventListener('click', () => {
      this.baseOctave = Math.max(0, this.baseOctave - 1);
      if (this.octaveNumEl) this.octaveNumEl.textContent = String(this.baseOctave);
    });
    const octNum = document.createElement('span');
    octNum.className = 'octave-num';
    octNum.textContent = String(this.baseOctave);
    this.octaveNumEl = octNum;

    const octUp = document.createElement('button');
    octUp.className = 'hw-btn oct-btn';
    octUp.type = 'button';
    octUp.textContent = '+';
    octUp.addEventListener('click', () => {
      this.baseOctave = Math.min(5, this.baseOctave + 1);
      if (this.octaveNumEl) this.octaveNumEl.textContent = String(this.baseOctave);
    });

    octGroup.append(octLabel, octDown, octNum, octUp);
    row.appendChild(octGroup);

    this.element.appendChild(row);
  }

  private buildSteps(): void {
    const section = document.createElement('div');
    section.className = 'panel-steps-section';

    const modeBar = document.createElement('div');
    modeBar.className = 'steps-mode-bar';
    const ledInfo = document.createElement('span');
    ledInfo.className = 'led-info';
    ledInfo.innerHTML =
      '<span class="led-demo led-demo-active"></span> active &nbsp;' +
      '<span class="led-demo led-demo-playing"></span> playing &nbsp;' +
      '<span class="led-demo led-demo-kb"></span> keyboard';
    modeBar.appendChild(ledInfo);
    section.appendChild(modeBar);

    const grid = document.createElement('div');
    grid.className = 'panel-steps';

    for (let i = 0; i < 16; i++) {
      const btn = new StepButton(i);
      this.stepButtons.push(btn);

      btn.element.addEventListener('click', () => {
        if (!this.keyboardMode) this.handleStepClick(i);
      });

      btn.element.addEventListener('mousedown', (e) => {
        if (this.keyboardMode) {
          e.preventDefault();
          this.handlePadDown(i);
        }
      });
      btn.element.addEventListener('mouseup', () => {
        if (this.keyboardMode) this.handlePadUp(i);
      });
      btn.element.addEventListener('mouseleave', () => {
        if (this.keyboardMode) this.handlePadUp(i);
      });
      btn.element.addEventListener('touchstart', (e) => {
        if (this.keyboardMode) {
          e.preventDefault();
          this.handlePadDown(i);
        }
      }, { passive: false });
      btn.element.addEventListener('touchend', () => {
        if (this.keyboardMode) this.handlePadUp(i);
      });

      grid.appendChild(btn.element);
    }

    section.appendChild(grid);
    this.element.appendChild(section);
  }

  // ── Event handlers ────────────────────────────────────────────────────────

  private ensureInit(): void {
    if (this.initialized) return;
    this.engine.init();
    const ctx = this.engine.getAudioContext();
    this.sequencer = new Sequencer(ctx, this.engine);
    this.sequencer.setSequence(makeDefaultSequence());
    this.sequencer.onStep = (idx) => { this.onSequencerStep(idx); };
    this.initialized = true;
    this.syncAllKnobs();
  }
  private syncAllKnobs(): void {
    const e = this.engine;
    const s = this.sequencer!;

    const bpm = 40 + (this.knobs.get('tempo')?.getValue() ?? 0.4) * 200;
    this.tempo = bpm;
    s.setTempo(bpm);

    e.setVcfCutoff(this.knobs.get('cutoff')?.getValue() ?? 0.6);
    e.setVcfResonance(this.knobs.get('peak')?.getValue() ?? 0.3);
    e.setEgAttack((this.knobs.get('attack')?.getValue() ?? 0) * 2000);
    e.setEgDecay((this.knobs.get('decay')?.getValue() ?? 0.25) * 2000);
    e.setLfoRate(0.1 + (this.knobs.get('lfoRate')?.getValue() ?? 0.16) * 29.9);
    e.setLfoIntensity(this.knobs.get('lfoInt')?.getValue() ?? 0);
    e.setVcoPitchOffset(0, ((this.knobs.get('pitch1')?.getValue() ?? 0.5) - 0.5) * 24);
    e.setVcoPitchOffset(1, ((this.knobs.get('pitch2')?.getValue() ?? 0.5) - 0.5) * 24);
    e.setVcoPitchOffset(2, ((this.knobs.get('pitch3')?.getValue() ?? 0.5) - 0.5) * 24);
    e.setMasterVolume(this.knobs.get('volume')?.getValue() ?? 0.8);
  }

  private handleKnob(id: string, value: number): void {
    if (!this.initialized) return;
    const e = this.engine;
    const s = this.sequencer!;

    switch (id) {
      case 'tempo': {
        this.tempo = 40 + value * 200;
        s.setTempo(this.tempo);
        if (this.isPlaying) this.showBpm();
        break;
      }
      case 'cutoff':  e.setVcfCutoff(value); break;
      case 'peak':    e.setVcfResonance(value); break;
      case 'attack':  e.setEgAttack(value * 2000); break;
      case 'decay':   e.setEgDecay(value * 2000); break;
      case 'lfoRate': e.setLfoRate(0.1 + value * 29.9); break;
      case 'lfoInt':  e.setLfoIntensity(value); break;
      case 'pitch1':  e.setVcoPitchOffset(0, (value - 0.5) * 24); break;
      case 'pitch2':  e.setVcoPitchOffset(1, (value - 0.5) * 24); break;
      case 'pitch3':  e.setVcoPitchOffset(2, (value - 0.5) * 24); break;
      case 'volume':  e.setMasterVolume(value); break;
    }
  }

  private handlePlay(): void {
    this.ensureInit();
    this.sequencer!.setTempo(this.tempo);
    this.sequencer!.play();
    this.isPlaying = true;
    this.playBtn.classList.add('active');
    this.showBpm();
  }

  private handleStop(): void {
    this.sequencer?.stop();
    this.isPlaying = false;
    this.currentStep = -1;
    this.playBtn.classList.remove('active');
    this.updateStepLeds();
    this.display.show('----');
  }

  private handleVcoButton(idx: 0 | 1 | 2): void {
    if (this.funcHeld) {
      this.ensureInit();
      this.vcoMutes[idx] = !this.vcoMutes[idx];
      this.engine.setVcoMute(idx, this.vcoMutes[idx]);
      this.vcoButtons[idx].classList.toggle('muted', this.vcoMutes[idx]);
    } else {
      this.selectedVco = idx;
      this.vcoButtons.forEach((b, i) => b.classList.toggle('active', i === idx));
      this.updateStepLeds();
    }
  }

  private handleStepClick(index: number): void {
    this.ensureInit();
    const seq = this.sequencer!.getSequence();
    const step = seq.vco[this.selectedVco].steps[index];
    step.active = !step.active;
    step.enabled = step.active;
    this.sequencer!.setSequence(seq);
    this.updateStepLeds();
  }

  private handlePadDown(index: number): void {
    this.ensureInit();
    const note = this.padToMidi(index);
    this.activeKeyPads.add(index);
    this.engine.triggerNote(note, 64);
    this.stepButtons[index].setBottomLed(true);
    this.showNote(note);
  }

  private handlePadUp(index: number): void {
    if (!this.activeKeyPads.has(index)) return;
    this.activeKeyPads.delete(index);
    if (this.initialized) this.engine.releaseNote();
    this.stepButtons[index].setBottomLed(false);
    if (this.isPlaying) {
      this.showBpm();
    } else {
      this.display.show('----');
    }
  }
  private handleMemorySlot(slot: SlotIndex): void {
    this.ensureInit();
    if (this.funcHeld) {
      this.memory.save(slot, this.sequencer!.getSequence());
      this.updateMemorySlotBtns();
      this.display.show('SAUd'); // "SAVEd" approximation
      setTimeout(() => { this.restoreDisplay(); }, 900);
    } else {
      const seq = this.memory.load(slot);
      if (seq !== null) {
        this.sequencer!.setSequence(seq);
        this.updateStepLeds();
        this.display.show('LoAd');
        setTimeout(() => { this.restoreDisplay(); }, 900);
      }
    }
  }

  private clearFunc(): void {
    this.funcHeld = false;
    this.funcBtn.classList.remove('active');
  }

  private toggleKeyboardMode(): void {
    this.keyboardMode = !this.keyboardMode;
    this.stepModeBtn.textContent = this.keyboardMode ? 'KEY' : 'STEP';
    this.stepModeBtn.classList.toggle('active', this.keyboardMode);
    this.stepButtons.forEach(btn => {
      btn.element.classList.toggle('keyboard-mode', this.keyboardMode);
    });
    this.updateStepLeds();
    if (!this.isPlaying) this.display.show('----');
  }

  // ── Sequencer step callback ───────────────────────────────────────────────

  private onSequencerStep(stepIndex: number): void {
    if (!this.isPlaying) return;
    this.currentStep = stepIndex;
    this.updateStepLeds();
  }

  // ── Visual helpers ────────────────────────────────────────────────────────

  private updateStepLeds(): void {
    const seq = this.sequencer?.getSequence();
    for (let i = 0; i < 16; i++) {
      const btn = this.stepButtons[i];
      const isActive = seq !== undefined && seq.vco[this.selectedVco].steps[i].active;
      const isPlaying = i === this.currentStep && this.isPlaying;

      if (isPlaying) {
        btn.setTopLed('playing');
      } else if (isActive) {
        btn.setTopLed('active');
      } else {
        btn.setTopLed('off');
      }

      if (!this.keyboardMode) {
        btn.setBottomLed(false);
      }
    }
  }

  private showBpm(): void {
    this.display.show(String(Math.round(this.tempo)).padStart(4, ' '));
  }

  private showNote(midi: number): void {
    this.display.show(midiToDisplay(midi));
  }

  private restoreDisplay(): void {
    if (this.isPlaying) {
      this.showBpm();
    } else {
      this.display.show('----');
    }
  }

  private updateMemorySlotBtns(): void {
    this.memorySlotBtns.forEach((btn, i) => {
      const empty = this.memory.isEmpty(i as SlotIndex);
      btn.classList.toggle('has-data', !empty);
      btn.title = `Slot ${i + 1}: ${empty ? 'empty' : 'has data'}`;
    });
  }

  // ── Utilities ─────────────────────────────────────────────────────────────

  private padToMidi(padIndex: number): number {
    // A1 = MIDI 33; baseOctave shifts by 12 per octave.
    return 33 + this.baseOctave * 12 + padIndex;
  }
}