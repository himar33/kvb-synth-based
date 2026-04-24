import { Panel } from './ui/Panel';

const panel = new Panel();
document.querySelector<HTMLDivElement>('#app')!.appendChild(panel.element);