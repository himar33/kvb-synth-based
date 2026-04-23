import type { VcoParams, VcoWaveform, VcoGroupingMode } from './types.ts';
 
// Standard equal-temperament conversion. A4 (MIDI 69) = 440 Hz.
function midiToHz(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}
 
export class VCO {
  private params: VcoParams;
  private currentMidiNote: number = 69;
 
  // Three oscillators run continuously from start() onward — the VCA gate
  // handles silence, so we never stop/restart these nodes.
  private readonly oscillators: [OscillatorNode, OscillatorNode, OscillatorNode];
  private readonly muteGains:   [GainNode, GainNode, GainNode];
 
  // Normalizes the three-oscillator mix: gain = 1/3 prevents clipping when all
  // VCOs are active and avoids any per-mute recalculation.
  readonly output: GainNode;
 
  constructor(ctx: AudioContext, params: VcoParams) {
    this.params = {
      ...params,
      pitchOffsets: [...params.pitchOffsets] as [number, number, number],
      mutes: [...params.mutes] as [boolean, boolean, boolean],
    };
 
    this.oscillators = [
      ctx.createOscillator(),
      ctx.createOscillator(),
      ctx.createOscillator(),
    ];
 
    this.muteGains = [
      ctx.createGain(),
      ctx.createGain(),
      ctx.createGain(),
    ];
 
    this.output = ctx.createGain();
    this.output.gain.value = 1 / 3;
 
    for (let i = 0; i < 3; i++) {
      const osc  = this.oscillators[i];
      const mute = this.muteGains[i];
 
      osc.type = params.waveform;
      osc.frequency.value = midiToHz(69);
      osc.detune.value = params.pitchOffsets[i] * 100; // semitones → cents
 
      mute.gain.value = params.mutes[i] ? 0 : 1;
 
      osc.connect(mute);
      mute.connect(this.output);
    }
  }
 
  start(): void {
    this.oscillators.forEach(o => { o.start(); });
  }
 
  setNote(midiNote: number): void {
    this.currentMidiNote = midiNote;
    const hz = midiToHz(midiNote);
    const { groupingMode, pitchOffsets } = this.params;
 
    for (const idx of [0, 1, 2] as const) {
      this.oscillators[idx].frequency.value = hz;
      this.oscillators[idx].detune.value = resolveOffset(idx, groupingMode, pitchOffsets) * 100;
    }
  }
 
  setWaveform(w: VcoWaveform): void {
    this.params.waveform = w;
    this.oscillators.forEach(o => { o.type = w; });
  }
 
  setPitchOffset(idx: 0 | 1 | 2, semitones: number): void {
    this.params.pitchOffsets[idx] = semitones;
    this.setNote(this.currentMidiNote); // re-apply with updated offsets
  }
 
  setGroupingMode(mode: VcoGroupingMode): void {
    this.params.groupingMode = mode;
    this.setNote(this.currentMidiNote);
  }
 
  setMute(idx: 0 | 1 | 2, muted: boolean): void {
    this.params.mutes[idx] = muted;
    this.muteGains[idx].gain.value = muted ? 0 : 1;
  }
 
  // Exposed for LFO pitch modulation. Using detune (cents) instead of frequency (Hz)
  // keeps the modulation depth perceptually consistent across the pitch range.
  getDetuneParam(idx: 0 | 1 | 2): AudioParam {
    return this.oscillators[idx].detune;
  }
 
  dispose(): void {
    this.oscillators.forEach(o => {
      try { o.stop(); } catch { /* already stopped or never started */ }
      o.disconnect();
    });
    this.muteGains.forEach(g => { g.disconnect(); });
    this.output.disconnect();
  }
}
 
// Which pitch offset to apply to each VCO index under the active grouping mode.
// Mode 1: fully independent. Mode 2: VCO 0+1 share slot 0, VCO 2 uses slot 2.
// Mode 3: all three share slot 0 (classic Volca Bass unison detune behavior).
function resolveOffset(
  idx: 0 | 1 | 2,
  mode: VcoGroupingMode,
  offsets: [number, number, number],
): number {
  if (mode === 3) return offsets[0];
  if (mode === 2) return idx === 2 ? offsets[2] : offsets[0];
  return offsets[idx];
}