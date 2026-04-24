const SEGS = ['a', 'b', 'c', 'd', 'e', 'f', 'g'] as const;
type Seg = typeof SEGS[number];

// Maps printable characters to the segments that should be lit.
const SEG_MAP: Partial<Record<string, Seg[]>> = {
  '0': ['a','b','c','d','e','f'],
  '1': ['b','c'],
  '2': ['a','b','d','e','g'],
  '3': ['a','b','c','d','g'],
  '4': ['b','c','f','g'],
  '5': ['a','c','d','f','g'],
  '6': ['a','c','d','e','f','g'],
  '7': ['a','b','c'],
  '8': ['a','b','c','d','e','f','g'],
  '9': ['a','b','c','d','f','g'],
  'A': ['a','b','c','e','f','g'],
  'b': ['c','d','e','f','g'],
  'C': ['a','d','e','f'],
  'd': ['b','c','d','e','g'],
  'E': ['a','d','e','f','g'],
  'F': ['a','e','f','g'],
  'G': ['a','c','d','e','f'],
  'H': ['b','c','e','f','g'],
  'L': ['d','e','f'],
  'n': ['c','e','g'],
  'o': ['c','d','e','g'],
  'P': ['a','b','e','f','g'],
  'r': ['e','g'],
  'S': ['a','c','d','f','g'],
  't': ['d','e','f','g'],
  'U': ['b','c','d','e','f'],
  '-': ['g'],
  '.': ['a','b','c','d','e','f','g'], // fallback: all on
  ' ': [],
};

export class Display {
  readonly element: HTMLElement;
  private digitEls: HTMLElement[] = [];

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'display';
    for (let i = 0; i < 4; i++) {
      const d = this.makeDigit();
      this.digitEls.push(d);
      this.element.appendChild(d);
    }
    this.show('----');
  }

  private makeDigit(): HTMLElement {
    const d = document.createElement('div');
    d.className = 'seg-digit';
    for (const s of SEGS) {
      const seg = document.createElement('div');
      seg.className = `seg seg-${s}`;
      d.appendChild(seg);
    }
    return d;
  }

  /** Display up to 4 characters. Pads with spaces on the right. */
  show(text: string): void {
    const padded = text.padEnd(4, ' ').slice(0, 4);
    for (let i = 0; i < 4; i++) {
      this.setDigit(i, padded[i] ?? ' ');
    }
  }

  private setDigit(pos: number, char: string): void {
    const d = this.digitEls[pos];
    const on = new Set<Seg>(SEG_MAP[char] ?? []);
    for (const s of SEGS) {
      const el = d.querySelector(`.seg-${s}`) as HTMLElement;
      el.classList.toggle('on', on.has(s));
    }
  }
}