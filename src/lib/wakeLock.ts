import NoSleep from 'nosleep.js';

const noSleep = new NoSleep();

export const enableWakeLock  = () => noSleep.enable().catch(() => {});
export const disableWakeLock = () => noSleep.disable();
