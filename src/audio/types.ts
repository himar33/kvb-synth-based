export type VcoGroupingMode = 1 | 2 | 3;
export type LfoWaveform = 'triangle' | 'square';
export type LfoTarget = 'amp' | 'pitch' | 'cutoff';
export type VcoWaveform = 'sawtooth' | 'square';
 
export interface VcoParams {
  waveform: VcoWaveform;
  pitchOffsets: [number, number, number]; // semitones per VCO
  groupingMode: VcoGroupingMode;
  mutes: [boolean, boolean, boolean];
}
 
export interface VcfParams {
  cutoff: number;      // 0–1 normalized
  resonance: number;   // 0–1 normalized
  egIntensity: number; // 0–1, scales EG contribution to filter cutoff
}
 
export interface EgParams {
  attack: number;     // ms, 0–2000
  decay: number;      // ms, 0–2000 (doubles as release when sustainOn=true)
  sustainOn: boolean; // Volca toggle: true = hold at peak until note-off
}
 
export interface LfoParams {
  rate: number;            // Hz, 0.1–30
  waveform: LfoWaveform;
  intensity: number;       // 0–1
  targets: Set<LfoTarget>;
}
 
export interface VcaParams {
  masterVolume: number; // 0–1
}
 
export interface EngineParams {
  vco: VcoParams;
  vcf: VcfParams;
  eg: EgParams;
  lfo: LfoParams;
  vca: VcaParams;
}