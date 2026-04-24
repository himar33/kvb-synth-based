export type StepLedState = 'off' | 'active' | 'playing';

export class StepButton {
  readonly element: HTMLButtonElement;
  private topLedEl!: HTMLElement;
  private bottomLedEl!: HTMLElement;

  constructor(readonly index: number) {
    this.element = document.createElement('button');
    this.element.className = 'step-btn';
    this.element.type = 'button';
    this.element.dataset['step'] = String(index);
    this.build();
  }

  private build(): void {
    const topLed = document.createElement('div');
    topLed.className = 'step-led step-led-top';

    const num = document.createElement('span');
    num.className = 'step-num';
    num.textContent = String(this.index + 1);

    const bottomLed = document.createElement('div');
    bottomLed.className = 'step-led step-led-bottom';

    this.topLedEl = topLed;
    this.bottomLedEl = bottomLed;
    this.element.append(topLed, num, bottomLed);
  }

  setTopLed(state: StepLedState): void {
    this.topLedEl.classList.toggle('led-active', state === 'active');
    this.topLedEl.classList.toggle('led-playing', state === 'playing');
  }

  setBottomLed(on: boolean): void {
    this.bottomLedEl.classList.toggle('led-active', on);
  }
}