export async function initPWA(): Promise<void> {
  if (navigator.storage?.persist) {
    await navigator.storage.persist();
  }
}

export function isRunningAsPWA(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}
