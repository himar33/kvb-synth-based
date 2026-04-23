import type { LfoParams, LfoWaveform, LfoTarget } from './types'
 
// Maximum LFO depth per target. These are hardware-inspired upper bounds —
// wide enough for expressive modulation without destroying the bass character.
const MAX_PITCH_CENTS = 1200; // ±1 octave
const MAX_CUTOFF_HZ   = 2000; // ±2000 Hz
 
export class LFO {
  private readonly ctx: AudioContext;
  private params: LfoParams;
 
  // Recreated on each retrigger for square wave (phase reset). Triangle is free-running.
  private osc: OscillatorNode | null = null;
 
  private readonly ampGain: GainNode;
  private readonly pitchGain: GainNode;
  private readonly cutoffGain: GainNode;
 
  // AudioParam refs stored so retrigger and setTargets can reconnect without
  // needing AudioEngine to pass them in again.
  private ampTarget: AudioParam | null = null;
  private pitchTargets: AudioParam[] = [];
  private cutoffTarget: AudioParam | null = null;
 
  constructor(ctx: AudioContext, params: LfoParams) {
    this.ctx = ctx;
    this.params = { ...params, targets: new Set(params.targets) };
 
    this.ampGain    = ctx.createGain();
    this.pitchGain  = ctx.createGain();
    this.cutoffGain = ctx.createGain();
 
    this.applyGains();
  }
 
  // AudioEngine calls these once during init() to wire the LFO to its targets.
  // Connections are made only if the target is active in params.targets.
  connectAmp(param: AudioParam): void {
    this.ampTarget = param;
    if (this.params.targets.has('amp')) this.ampGain.connect(param);
  }
 
  connectPitch(param: AudioParam): void {
    this.pitchTargets.push(param);
    if (this.params.targets.has('pitch')) this.pitchGain.connect(param);
  }
 
  connectCutoff(param: AudioParam): void {
    this.cutoffTarget = param;
    if (this.params.targets.has('cutoff')) this.cutoffGain.connect(param);
  }
 
  start(): void {
    this.osc = this.buildOsc();
    this.osc.start();
  }
 
  // Square LFO resets its phase on every note-on, matching hardware behavior.
  // Triangle is free-running — phase reset would cause an audible click.
  retrigger(): void {
    if (this.params.waveform !== 'square' || this.osc === null) return;
 
    const old = this.osc;
    old.stop();
    old.disconnect();
 
    this.osc = this.buildOsc();
    this.osc.start();
  }
 
  setRate(hz: number): void {
    this.params.rate = Math.max(0.1, Math.min(30, hz));
    if (this.osc !== null) this.osc.frequency.value = this.params.rate;
  }
 
  setWaveform(w: LfoWaveform): void {
    this.params.waveform = w;
    if (this.osc !== null) this.osc.type = w;
  }
 
  setIntensity(normalized: number): void {
    this.params.intensity = Math.max(0, Math.min(1, normalized));
    this.applyGains();
  }
 
  setTargets(targets: Set<LfoTarget>): void {
    const prev = this.params.targets;
    this.params.targets = new Set(targets);
 
    for (const t of targets) {
      if (!prev.has(t)) this.connectTarget(t);
    }
    for (const t of prev) {
      if (!targets.has(t)) this.disconnectTarget(t);
    }
  }
 
  dispose(): void {
    try { this.osc?.stop(); } catch { /* already stopped */ }
    this.osc?.disconnect();
    this.ampGain.disconnect();
    this.pitchGain.disconnect();
    this.cutoffGain.disconnect();
  }
 
  private buildOsc(): OscillatorNode {
    const osc = this.ctx.createOscillator();
    osc.type = this.params.waveform;
    osc.frequency.value = this.params.rate;
    osc.connect(this.ampGain);
    osc.connect(this.pitchGain);
    osc.connect(this.cutoffGain);
    return osc;
  }
 
  private applyGains(): void {
    const i = this.params.intensity;
    // Amp depth is unitless (adds to a gain AudioParam whose intrinsic value is 1).
    this.ampGain.gain.value    = i;
    // Pitch uses detune (cents), frequency-independent unlike Hz modulation.
    this.pitchGain.gain.value  = i * MAX_PITCH_CENTS;
    this.cutoffGain.gain.value = i * MAX_CUTOFF_HZ;
  }
 
  private connectTarget(t: LfoTarget): void {
    if (t === 'amp' && this.ampTarget !== null)
      this.ampGain.connect(this.ampTarget);
    if (t === 'pitch')
      this.pitchTargets.forEach(p => { this.pitchGain.connect(p); });
    if (t === 'cutoff' && this.cutoffTarget !== null)
      this.cutoffGain.connect(this.cutoffTarget);
  }
 
  private disconnectTarget(t: LfoTarget): void {
    try {
      if (t === 'amp' && this.ampTarget !== null)
        this.ampGain.disconnect(this.ampTarget);
      if (t === 'pitch')
        this.pitchTargets.forEach(p => { try { this.pitchGain.disconnect(p); } catch { /* ok */ } });
      if (t === 'cutoff' && this.cutoffTarget !== null)
        this.cutoffGain.disconnect(this.cutoffTarget);
    } catch { /* already disconnected */ }
  }
}