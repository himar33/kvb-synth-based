import type { SequenceData, MemorySlot, VcoSequence } from './types'
const STORAGE_KEY = 'volca-bass-memory';
const SLOT_COUNT = 8;
type SlotIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
type Slots = [MemorySlot, MemorySlot, MemorySlot, MemorySlot,
              MemorySlot, MemorySlot, MemorySlot, MemorySlot];
function makeEmptySlot(): MemorySlot {
  const makeVcoSeq = (): VcoSequence => ({
    steps: Array.from({ length: 16 }, () => ({
      active: false, enabled: true, midiNote: 60, slide: false,
    })) as VcoSequence['steps'],
  });
  return {
    isEmpty: true,
    sequence: {
      vco: [makeVcoSeq(), makeVcoSeq(), makeVcoSeq()],
      groupingMode: 3,
    },
  };
}
function loadFromStorage(): Slots {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw) as MemorySlot[];
      return Array.from({ length: SLOT_COUNT }, (_, i) => parsed[i] ?? makeEmptySlot()) as Slots;
    }
  } catch {
    // Corrupted storage — fall through to defaults.
  }
  return Array.from({ length: SLOT_COUNT }, makeEmptySlot) as Slots;
}
export class Memory {
  private readonly slots: Slots;
  constructor() {
    this.slots = loadFromStorage();
  }
  save(slot: SlotIndex, sequence: SequenceData): void {
    this.slots[slot] = { sequence, isEmpty: false };
    this.persist();
  }
  load(slot: SlotIndex): SequenceData | null {
    const s = this.slots[slot];
    return s.isEmpty ? null : s.sequence;
  }
  isEmpty(slot: SlotIndex): boolean {
    return this.slots[slot].isEmpty;
  }
  private persist(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.slots));
  }
}