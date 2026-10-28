export function lerp(a, b, t) { return a + (b - a) * t; }

// Standard overshoot-then-settle ease, used once: the respawn "pop"
// (scale 0 -> 1, see snowman-explosion.js's updateRespawnPop). Clamped
// since callers feed it a progress ratio that can tick slightly past 1
// on the frame that finishes the animation.
export function easeOutBack(t) {
  var c1 = 1.70158, c3 = c1 + 1;
  t = Math.min(Math.max(t, 0), 1);
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
