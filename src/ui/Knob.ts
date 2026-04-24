const SVG_NS = 'http://www.w3.org/2000/svg';

// Arc endpoints for 270° track: from 135° to 45° clockwise in SVG coords.
// Center (26,26), radius 19. Computed: cos/sin(135°)=±0.7071, ×19≈13.43
const TRACK_D = 'M 12.57 39.43 A 19 19 0 1 1 39.43 39.43';

export class Knob {
  readonly element: HTMLElement;
  private value: number;
  private indicatorEl!: SVGLineElement;
  private isDragging = false;
  private dragStartY = 0;
  private dragStartValue = 0;

  constructor(private readonly label: string, initialValue = 0.5) {
    this.value = Math.max(0, Math.min(1, initialValue));
    this.element = document.createElement('div');
    this.element.className = 'knob';
    this.build();
    this.bindEvents();
  }

  private build(): void {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 52 52');
    svg.setAttribute('width', '52');
    svg.setAttribute('height', '52');
    svg.classList.add('knob-svg');

    const track = document.createElementNS(SVG_NS, 'path');
    track.setAttribute('d', TRACK_D);
    track.classList.add('knob-track');

    const body = document.createElementNS(SVG_NS, 'circle');
    body.setAttribute('cx', '26');
    body.setAttribute('cy', '26');
    body.setAttribute('r', '17');
    body.classList.add('knob-body');

    // Indicator: line from center pointing up (12 o'clock = value 0.5)
    const indicator = document.createElementNS(SVG_NS, 'line');
    indicator.setAttribute('x1', '26');
    indicator.setAttribute('y1', '26');
    indicator.setAttribute('x2', '26');
    indicator.setAttribute('y2', '11');
    indicator.classList.add('knob-indicator');
    this.indicatorEl = indicator as SVGLineElement;

    svg.append(track, body, indicator);

    const labelEl = document.createElement('span');
    labelEl.className = 'knob-label';
    labelEl.textContent = this.label;

    this.element.append(svg, labelEl);
    this.updateVisual();
  }

  private updateVisual(): void {
    const angle = -135 + this.value * 270;
    this.indicatorEl.style.transformOrigin = '26px 26px';
    this.indicatorEl.style.transform = `rotate(${angle}deg)`;
  }

  private bindEvents(): void {
    this.element.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.isDragging = true;
      this.dragStartY = e.clientY;
      this.dragStartValue = this.value;
      this.element.classList.add('dragging');
      document.addEventListener('mousemove', this.onMouseMove);
      document.addEventListener('mouseup', this.onMouseUp);
    });

    this.element.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      this.isDragging = true;
      this.dragStartY = t.clientY;
      this.dragStartValue = this.value;
      document.addEventListener('touchmove', this.onTouchMove, { passive: false });
      document.addEventListener('touchend', this.onTouchEnd);
    }, { passive: false });
  }

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.isDragging) return;
    this.applyDelta(this.dragStartY - e.clientY);
  };

  private onMouseUp = (): void => {
    this.isDragging = false;
    this.element.classList.remove('dragging');
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);
  };

  private onTouchMove = (e: TouchEvent): void => {
    e.preventDefault();
    if (!this.isDragging || e.touches.length === 0) return;
    this.applyDelta(this.dragStartY - e.touches[0].clientY);
  };

  private onTouchEnd = (): void => {
    this.isDragging = false;
    document.removeEventListener('touchmove', this.onTouchMove);
    document.removeEventListener('touchend', this.onTouchEnd);
  };

  private applyDelta(dy: number): void {
    const newVal = Math.max(0, Math.min(1, this.dragStartValue + dy / 150));
    if (newVal === this.value) return;
    this.value = newVal;
    this.updateVisual();
    this.element.dispatchEvent(new CustomEvent('knob-change', {
      bubbles: true,
      detail: { value: this.value },
    }));
  }

  setValue(v: number): void {
    this.value = Math.max(0, Math.min(1, v));
    this.updateVisual();
  }

  getValue(): number { return this.value; }
}