import type { AudioEngine } from '../audio/AudioEngine.ts';
import type { SequenceData, StepData, VcoSequence } from './types.ts';
const GATE_RATIO = 0.8;
function makeDefaultStep(): StepData {
  return { active: false, enabled: true, midiNote: 60, slide: false };
}
function makeEmptySequence(): SequenceData {
  const makeVcoSeq = (): VcoSequence => ({
    steps: Array.from({ length: 16 }, makeDefaultStep) as VcoSequence['steps'],
  });
  return {
    vco: [makeVcoSeq(), makeVcoSeq(), makeVcoSeq()],
    groupingMode: 3,
  };
}
export class Sequencer {
  onStep: ((stepIndex: number) => void) | null = null;
  private currentStep = 0;
  private nextStepTime = 0;
  private isPlaying = false;
  private tempo = 120;
  private sequence: SequenceData;
  private worker: Worker | null = null;
  private lastScheduledStep: StepData | null = null;
  constructor(
    private readonly audioCtx: AudioContext,
    private readonly engine: AudioEngine,
    private readonly lookahead = 0.1,
    private readonly scheduleInterval = 25,
  ) {
    this.sequence = makeEmptySequence();
  }
  play(): void {
    if (this.isPlaying) return;
    void this.audioCtx.resume();
    this.currentStep = 0;
    this.nextStepTime = this.audioCtx.currentTime + 0.05;
    this.lastScheduledStep = null;
    this.isPlaying = true;
    this.startWorker();
  }
  stop(): void {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    this.stopWorker();
    this.currentStep = 0;
    this.lastScheduledStep = null;
    this.engine.releaseNote();
  }
  setTempo(bpm: number): void {
    this.tempo = Math.max(10, Math.min(600, bpm));
  }
  setSequence(seq: SequenceData): void {
    this.sequence = seq;
  }
  getSequence(): SequenceData {
    return this.sequence;
  }
  toggleStep(vcoIndex: 0 | 1 | 2, stepIndex: number): void {
    const step = this.sequence.vco[vcoIndex].steps[stepIndex];
    step.enabled = !step.enabled;
  }
  toggleSlide(vcoIndex: 0 | 1 | 2, stepIndex: number): void {
    const step = this.sequence.vco[vcoIndex].steps[stepIndex];
    step.slide = !step.slide;
  }
  setStepNote(vcoIndex: 0 | 1 | 2, stepIndex: number, midiNote: number): void {
    this.sequence.vco[vcoIndex].steps[stepIndex].midiNote = midiNote;
  }
  private startWorker(): void {
    this.worker = new Worker(
      new URL('./SchedulerWorker.ts', import.meta.url),
      { type: 'module' },
    );
    this.worker.onmessage = () => { this.schedule(); };
    this.worker.postMessage({ type: 'start', intervalMs: this.scheduleInterval });
  }
  private stopWorker(): void {
    if (this.worker !== null) {
      this.worker.postMessage({ type: 'stop', intervalMs: 0 });
      this.worker.terminate();
      this.worker = null;
    }
  }
  private schedule(): void {
    if (!this.isPlaying) return;
    const enabledIndices = this.getEnabledStepIndices();
    const cycleLen = enabledIndices.length;
    // Guard against currentStep going out of range if sequence changed mid-play.
    if (this.currentStep >= cycleLen) this.currentStep = 0;
    const scheduleUntil = this.audioCtx.currentTime + this.lookahead;
    while (this.nextStepTime < scheduleUntil) {
      const actualIndex = enabledIndices[this.currentStep];
      this.scheduleStep(actualIndex, this.nextStepTime);
      this.currentStep = (this.currentStep + 1) % cycleLen;
      this.nextStepTime += this.getStepDuration();
    }
  }
  private scheduleStep(stepIndex: number, time: number): void {
    const step = this.sequence.vco[0].steps[stepIndex];
    const stepDuration = this.getStepDuration();
    const prevHasSlide =
      this.lastScheduledStep !== null &&
      this.lastScheduledStep.active &&
      this.lastScheduledStep.enabled &&
      this.lastScheduledStep.slide;
    if (step.active && step.enabled) {
      if (prevHasSlide) {
        // Slide: only retune the VCO — do not retrigger EG or LFO.
        this.engine.triggerNoteSlide(step.midiNote);
      } else {
        this.engine.triggerNote(step.midiNote, 0, time);
      }
      this.engine.releaseNote(time + stepDuration * GATE_RATIO);
    } else {
      // Inactive/disabled step: silence.
      this.engine.releaseNote(time);
    }
    this.lastScheduledStep = step;
    if (this.onStep !== null) {
      const delay = Math.max(0, (time - this.audioCtx.currentTime) * 1000);
      const cb = this.onStep;
      setTimeout(() => { cb(stepIndex); }, delay);
    }
  }
  private getStepDuration(): number {
    // One 16th note at current tempo.
    return 60 / (this.tempo * 4);
  }
  // Returns indices of enabled steps in order. Falls back to all 16 if none enabled.
  private getEnabledStepIndices(): number[] {
    const steps = this.sequence.vco[0].steps;
    const indices: number[] = [];
    for (let i = 0; i < 16; i++) {
      if (steps[i].enabled) indices.push(i);
    }
    if (indices.length === 0) {
      return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
    }
    return indices;
  }
}