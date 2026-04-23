import type { VcoGroupingMode } from '../audio/types';
export interface StepData {
  active: boolean;     // whether a note was recorded at this step
  enabled: boolean;    // Active Step on/off (FUNC+PLAY on hardware)
  midiNote: number;    // 0–127
  slide: boolean;      // Slide on/off for this step
}
export type Steps16 = [
  StepData, StepData, StepData, StepData,
  StepData, StepData, StepData, StepData,
  StepData, StepData, StepData, StepData,
  StepData, StepData, StepData, StepData,
];
export interface VcoSequence {
  steps: Steps16;
}
export interface SequenceData {
  vco: [VcoSequence, VcoSequence, VcoSequence];
  groupingMode: VcoGroupingMode;
}
export interface MemorySlot {
  sequence: SequenceData;
  isEmpty: boolean;
}