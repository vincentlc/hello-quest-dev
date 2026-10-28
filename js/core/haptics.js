// Shared by snowball-thrower (throw) and the snowman component
// (explosion) -- was a snowball-thrower-only method, hoisted here once a
// second caller needed the exact same guarded gamepad lookup.
export function pulseHaptics(handEl, intensity, durationMs) {
  var tracked = handEl.components['tracked-controls'];
  var gamepad = tracked && tracked.controller && tracked.controller.gamepad;
  var actuator = gamepad && gamepad.hapticActuators && gamepad.hapticActuators[0];
  if (actuator) actuator.pulse(intensity, durationMs);
}
