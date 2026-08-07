// Captures the browser's native "install this app" prompt (Chrome/Edge on
// Android and desktop fire this; Safari/iOS never does — there's no
// programmatic install on iOS, only the manual Share → Add to Home Screen
// flow). Must be imported once, early, so the listener is registered before
// the browser decides to fire the event — see main.tsx.

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e as BeforeInstallPromptEvent;
  listeners.forEach((l) => l());
});

// Once a PWA is actually installed, drop the stale prompt reference.
window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  listeners.forEach((l) => l());
});

export function hasInstallPrompt(): boolean {
  return deferredPrompt !== null;
}

export function onInstallPromptChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export async function triggerInstallPrompt(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) return 'unavailable';
  await deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  deferredPrompt = null;
  return choice.outcome;
}
