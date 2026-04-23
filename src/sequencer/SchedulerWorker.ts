// Runs in a dedicated Worker context. Emits 'tick' messages at a fixed interval
// so the main thread can run the lookahead scheduler without setInterval jitter.
// Deliberately has no access to AudioContext — timing is the browser's domain.
let intervalId: ReturnType<typeof setInterval> | null = null;
addEventListener('message', (e: MessageEvent<{ type: 'start' | 'stop'; intervalMs: number }>) => {
  if (e.data.type === 'start') {
    intervalId = setInterval(() => { postMessage('tick'); }, e.data.intervalMs);
  } else {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }
});