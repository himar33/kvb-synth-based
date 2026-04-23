import type { VcfParams } from './types'
 
// Maximum frequency contribution from EG modulation in Hz.
// At egIntensity=1 the EG can add up to this much above the base cutoff,
// giving strong filter sweeps without always slamming into the Nyquist ceiling.
const MAX_EG_FREQ_HZ = 10_000;
 
export class VCF {
  readonly filter: BiquadFilterNode;
 
  // EG.vcfOutput connects here as an audio input; egInputGain then forwards
  // the scaled 0–1 signal to filter.frequency as an AudioParam connection.
  readonly egInputGain: GainNode;
 
  // Alias exposed so AudioEngine can hand it to LFO without leaking filter internals.
  readonly lfoFreqParam: AudioParam;
 
  // Drives the base cutoff frequency. Kept as a ConstantSourceNode so that
  // EG and LFO contributions can be additive AudioParam connections without
  // fighting automation calls on filter.frequency itself.
  private readonly baseCutoffSource: ConstantSourceNode;
 
  constructor(ctx: AudioContext, params: VcfParams) {
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    // Keep intrinsic value at 0; all frequency input arrives via connected nodes.
    this.filter.frequency.value = 0;
    this.filter.Q.value = resonanceToQ(params.resonance);
 
    this.baseCutoffSource = ctx.createConstantSource();
    this.baseCutoffSource.offset.value = cutoffToHz(params.cutoff);
    this.baseCutoffSource.connect(this.filter.frequency);
 
    this.egInputGain = ctx.createGain();
    this.egInputGain.gain.value = params.egIntensity * MAX_EG_FREQ_HZ;
    this.egInputGain.connect(this.filter.frequency);
 
    this.lfoFreqParam = this.filter.frequency;
  }
 
  // Must be called once by AudioEngine — ConstantSourceNode needs start() to emit.
  start(): void {
    this.baseCutoffSource.start();
  }
 
  setCutoff(normalized: number): void {
    this.baseCutoffSource.offset.value = cutoffToHz(normalized);
  }
 
  setResonance(normalized: number): void {
    this.filter.Q.value = resonanceToQ(normalized);
  }
 
  setEgIntensity(normalized: number): void {
    this.egInputGain.gain.value = Math.max(0, Math.min(1, normalized)) * MAX_EG_FREQ_HZ;
  }
 
  dispose(): void {
    try { this.baseCutoffSource.stop(); } catch { /* already stopped or never started */ }
    this.baseCutoffSource.disconnect();
    this.egInputGain.disconnect();
    this.filter.disconnect();
  }
}
 
// Exponential mapping gives perceptually linear knob response for frequency.
// At 0 → 20 Hz, at 0.5 → ~632 Hz, at 1 → 20 000 Hz.
function cutoffToHz(normalized: number): number {
  return 20 * Math.pow(1000, Math.max(0, Math.min(1, normalized)));
}
 
function resonanceToQ(normalized: number): number {
  return 0.1 + Math.max(0, Math.min(1, normalized)) * 19.9;
}