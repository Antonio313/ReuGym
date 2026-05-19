let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

export function playTimerEnd(): void {
  const context = getCtx();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.frequency.setValueAtTime(880, context.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(440, context.currentTime + 0.3);
  gain.gain.setValueAtTime(0.3, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.4);
  oscillator.start(context.currentTime);
  oscillator.stop(context.currentTime + 0.4);
}

export function playSetLogged(): void {
  const context = getCtx();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(660, context.currentTime);
  gain.gain.setValueAtTime(0.15, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.12);
  oscillator.start(context.currentTime);
  oscillator.stop(context.currentTime + 0.12);
}
