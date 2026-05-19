export const haptics = {
  light:   () => navigator.vibrate?.(10),
  medium:  () => navigator.vibrate?.(25),
  heavy:   () => navigator.vibrate?.([30, 10, 30]),
  success: () => navigator.vibrate?.([10, 20, 10, 20, 40]),
  timer:   () => navigator.vibrate?.([50, 30, 50, 30, 100]),
  error:   () => navigator.vibrate?.([100, 50, 100]),
};
