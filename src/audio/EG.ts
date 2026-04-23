import type { EgParams } from './types.ts';
 
export class EG {
  private params: EgParams;
 
  // Single ConstantSourceNode whose offset is animated 0→1→0 for the envelope shape.
  // Both vcaOutput and vcfOutput tap from it independently via fan-out.
  private readonly egSource: ConstantSourceNode;
 
  // Separate GainNode per destination so AudioEngine can connect each to its target
  // without sharing a single connection point that could interfere with gain scaling.
  readonly vcaOutput: GainNode;
  readonly vcfOutput: GainNode;
 
  constructor(ctx: AudioContext, params: EgParams) {
    this.params = { ...params };
 
    this.egSource = ctx.createConstantSource();
    this.egSource.offset.value = 0;
 
    this.vcaOutput = ctx.createGain();
    this.vcaOutput.gain.value = 1;
 
    this.vcfOutput = ctx.createGain();
    this.vcfOutput.gain.value = 1;
 
    this.egSource.connect(this.vcaOutput);
    this.egSource.connect(this.vcfOutput);
  }
 
  // Must be called once after AudioEngine wires the graph — ConstantSourceNode
  // produces no output until started.
  start(): void {
    this.egSource.start();
  }
 
  noteOn(time: number): void {
    const { attack, decay, sustainOn } = this.params;
    // Enforce 1ms floor so linearRamp never schedules two events at the same time,
    // which causes undefined behavior across browser implementations.
    const attackSec = Math.max(attack / 1000, 0.001);
    const decaySec = Math.max(decay / 1000, 0.001);
    const offset = this.egSource.offset;
 
    // Reset any in-flight envelope from a previous note before scheduling the new one.
    offset.cancelScheduledValues(time);
    offset.setValueAtTime(0, time);
    offset.linearRampToValueAtTime(1, time + attackSec);
 
    if (!sustainOn) {
      // AD mode: decay to 0 immediately after attack peak regardless of note-off.
      offset.linearRampToValueAtTime(0, time + attackSec + decaySec);
    }
    // Sustain mode: hold at 1 until noteOff() schedules the release.
  }
 
  noteOff(time: number): void {
    // AD mode has no release — the envelope already decayed during note-on scheduling.
    if (!this.params.sustainOn) return;
 
    const decaySec = Math.max(this.params.decay / 1000, 0.001);
    const offset = this.egSource.offset;
 
    // cancelAndHoldAtTime preserves the current animated value at the cut point,
    // avoiding the abrupt jump that cancelScheduledValues + setValueAtTime would cause
    // when note-off arrives mid-attack.
    offset.cancelAndHoldAtTime(time);
    offset.linearRampToValueAtTime(0, time + decaySec);
  }
 
  setAttack(ms: number): void { this.params.attack = ms; }
  setDecay(ms: number): void  { this.params.decay = ms; }
  setSustain(on: boolean): void { this.params.sustainOn = on; }
 
  dispose(): void {
    try { this.egSource.stop(); } catch { /* already stopped or never started */ }
    this.egSource.disconnect();
    this.vcaOutput.disconnect();
    this.vcfOutput.disconnect();
  }
}