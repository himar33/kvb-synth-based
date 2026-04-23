import type { EngineParams, VcoWaveform, VcoGroupingMode, LfoWaveform, LfoTarget } from './types.ts';
import { VCO } from './VCO.ts';
import { VCF } from './VCF.ts';
import { EG }  from './EG.ts';
import { LFO } from './LFO.ts';
import { VCA } from './VCA.ts';
 
export class AudioEngine {
  // Null until init() is called inside a user gesture. AudioContext construction
  // outside a gesture leaves it suspended on all modern browsers.
  private ctx: AudioContext | null = null;
  private vco: VCO | null = null;
  private vcf: VCF | null = null;
  private eg:  EG  | null = null;
  private lfo: LFO | null = null;
  private vca: VCA | null = null;
 
  private readonly params: EngineParams;
 
  constructor(params: EngineParams) {
    this.params = params;
  }
 
  // Call this inside a user gesture (e.g. button click) to satisfy autoplay policy.
  // Idempotent — safe to call on every click handler.
  init(): void {
    if (this.ctx !== null) return;
 
    const ctx = new AudioContext();
    void ctx.resume(); // resume() returns a Promise; void discards it intentionally
    this.ctx = ctx;
 
    const vca = new VCA(ctx, this.params.vca);
    const vcf = new VCF(ctx, this.params.vcf);
    const eg  = new EG(ctx,  this.params.eg);
    const lfo = new LFO(ctx, this.params.lfo);
    const vco = new VCO(ctx, this.params.vco);
 
    this.vca = vca;
    this.vcf = vcf;
    this.eg  = eg;
    this.lfo = lfo;
    this.vco = vco;
 
    // ── Main audio path ────────────────────────────────────────────────────
    vco.output.connect(vcf.filter);
    vcf.filter.connect(vca.envGain);
    vca.masterGain.connect(ctx.destination);
    // (VCA internal chain: envGain → lfoTremoloGain → masterGain)
 
    // ── EG → VCA ──────────────────────────────────────────────────────────
    // EG signal (0→1) connects to envGain.gain AudioParam. Intrinsic gain is 0,
    // so effective gain = 0 + EG = envelope shape. VCA is silent when EG = 0.
    eg.vcaOutput.connect(vca.envGain.gain);
 
    // ── EG → VCF ──────────────────────────────────────────────────────────
    // EG (0→1) feeds VCF's scaling GainNode, which converts to Hz and adds
    // to filter.frequency. The 0 intrinsic on filter.frequency means all
    // frequency input is purely from connected nodes (base + EG + LFO).
    eg.vcfOutput.connect(vcf.egInputGain);
 
    // ── LFO connections ───────────────────────────────────────────────────
    lfo.connectAmp(vca.lfoTremoloGain.gain);
    lfo.connectPitch(vco.getDetuneParam(0));
    lfo.connectPitch(vco.getDetuneParam(1));
    lfo.connectPitch(vco.getDetuneParam(2));
    lfo.connectCutoff(vcf.lfoFreqParam);
 
    // ── Start all source nodes ────────────────────────────────────────────
    vco.start();
    lfo.start();
    vcf.start(); // starts baseCutoffSource ConstantSourceNode
    eg.start();  // starts egSource ConstantSourceNode
  }
 
  triggerNote(pitch: number, _velocity: number): void {
    // _velocity: Volca Bass hardware ignores velocity; parameter kept for API completeness.
    const { ctx, vco, lfo, eg } = this.require();
    vco.setNote(pitch);
    lfo.retrigger();
    eg.noteOn(ctx.currentTime);
  }
 
  releaseNote(): void {
    const { ctx, eg } = this.require();
    eg.noteOff(ctx.currentTime);
  }
 
  // ── VCO setters ─────────────────────────────────────────────────────────
 
  setVcoWaveform(w: VcoWaveform): void {
    this.require().vco.setWaveform(w);
  }
 
  setVcoPitchOffset(idx: 0 | 1 | 2, semitones: number): void {
    this.require().vco.setPitchOffset(idx, semitones);
  }
 
  setVcoGroupingMode(mode: VcoGroupingMode): void {
    this.require().vco.setGroupingMode(mode);
  }
 
  setVcoMute(idx: 0 | 1 | 2, muted: boolean): void {
    this.require().vco.setMute(idx, muted);
  }
 
  // ── VCF setters ─────────────────────────────────────────────────────────
 
  setVcfCutoff(normalized: number): void {
    this.require().vcf.setCutoff(normalized);
  }
 
  setVcfResonance(normalized: number): void {
    this.require().vcf.setResonance(normalized);
  }
 
  setVcfEgIntensity(normalized: number): void {
    this.require().vcf.setEgIntensity(normalized);
  }
 
  // ── EG setters ──────────────────────────────────────────────────────────
 
  setEgAttack(ms: number): void  { this.require().eg.setAttack(ms); }
  setEgDecay(ms: number): void   { this.require().eg.setDecay(ms); }
  setEgSustain(on: boolean): void { this.require().eg.setSustain(on); }
 
  // ── LFO setters ─────────────────────────────────────────────────────────
 
  setLfoRate(hz: number): void           { this.require().lfo.setRate(hz); }
  setLfoWaveform(w: LfoWaveform): void   { this.require().lfo.setWaveform(w); }
  setLfoIntensity(n: number): void       { this.require().lfo.setIntensity(n); }
  setLfoTargets(t: Set<LfoTarget>): void { this.require().lfo.setTargets(t); }
 
  // ── VCA setter ──────────────────────────────────────────────────────────
 
  setMasterVolume(v: number): void { this.require().vca.setMasterVolume(v); }
 
  dispose(): void {
    this.vco?.dispose();
    this.vcf?.dispose();
    this.eg?.dispose();
    this.lfo?.dispose();
    this.vca?.dispose();
    void this.ctx?.close();
    this.ctx = null;
    this.vco = null;
    this.vcf = null;
    this.eg  = null;
    this.lfo = null;
    this.vca = null;
  }
 
  private require(): { ctx: AudioContext; vco: VCO; vcf: VCF; eg: EG; lfo: LFO; vca: VCA } {
    if (!this.ctx || !this.vco || !this.vcf || !this.eg || !this.lfo || !this.vca) {
      throw new Error('AudioEngine: call init() before using the engine');
    }
    return { ctx: this.ctx, vco: this.vco, vcf: this.vcf, eg: this.eg, lfo: this.lfo, vca: this.vca };
  }
}