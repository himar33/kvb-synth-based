import type { VcaParams } from './types'
 
export class VCA {
  // EG animates this gain (0→1) exclusively. Keeping it separate from tremolo
  // ensures the envelope shape is never distorted by LFO modulation.
  readonly envGain: GainNode;
 
  // LFO tremolo connects to lfoTremoloGain.gain (intrinsic value = 1).
  // Placing it after envGain means LFO modulates the already-shaped signal,
  // not the raw oscillator mix.
  readonly lfoTremoloGain: GainNode;
 
  readonly masterGain: GainNode;
 
  constructor(ctx: AudioContext, params: VcaParams) {
    this.envGain = ctx.createGain();
    this.envGain.gain.value = 0; // silent until EG fires
 
    this.lfoTremoloGain = ctx.createGain();
    this.lfoTremoloGain.gain.value = 1; // full pass-through; LFO adds ±depth on top
 
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = params.masterVolume;
 
    this.envGain.connect(this.lfoTremoloGain);
    this.lfoTremoloGain.connect(this.masterGain);
  }
 
  setMasterVolume(v: number): void {
    this.masterGain.gain.value = Math.max(0, Math.min(1, v));
  }
 
  dispose(): void {
    this.envGain.disconnect();
    this.lfoTremoloGain.disconnect();
    this.masterGain.disconnect();
  }
}