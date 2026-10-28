// ---------------------------------------------------------------------
// CRACK_MASTER_ORDER / CRACK_SLOTS / getCrackSlotsForLives: the user's
// reference sketch -- six possible crack "slots", each a fixed crossing
// angle/sweep/group, all one shared glow color (CONFIG.colors.crackGlow).
// Slots 1-4 cross through the torso's central point
// (group 'torso'); 6/7 cross through a separate, lower point near the
// chin/scarf (group 'upper') -- not all six piling onto one spot, which
// looked too busy once several were active at once. A snowman's type
// (CONFIG.hitsToExplode: 1, 3, 5, or 7 lives -- no other value makes
// sense here) determines how many of the six are active, and they're
// always a SUFFIX of this one master order, not an arbitrary subset:
// slots 1/2 are always the final pair shown right before death, 3/4 are
// added before that for type 5+, and 6/7 are added before even those
// for type 7. So a tougher snowman gets earlier cracks prepended, never
// new ones appended at the end -- "cracks 1, 2, then dies" stays true
// for every type that reaches them.
//
// Future-proofing note: this is the one place a different snowman
// "design" would plug in its own crack layout/count -- everything that
// reads this module only ever asks for `getCrackSlotsForLives(lives)`,
// never reaches into CRACK_SLOTS directly.
// ---------------------------------------------------------------------
export var CRACK_MASTER_ORDER = [6, 7, 3, 4, 1, 2];
export var CRACK_SLOTS = {
  1: { angle: -20, sweep: 100, group: 'torso' },
  2: { angle: 20, sweep: 100, group: 'torso' },
  3: { angle: -45, sweep: 85, group: 'torso' },
  4: { angle: 45, sweep: 85, group: 'torso' },
  6: { angle: -45, sweep: 60, group: 'upper' },
  7: { angle: 45, sweep: 60, group: 'upper' }
};

export function getCrackSlotsForLives(lives) {
  // Snaps to the nearest valid type (1/3/5/7) instead of silently
  // producing a broken partial set (e.g. lives=4 would otherwise cut a
  // pair in half) if CONFIG is ever set to something else by mistake.
  var valid = [1, 3, 5, 7];
  var snapped = valid.reduce((a, b) => Math.abs(b - lives) < Math.abs(a - lives) ? b : a);
  var count = Math.max(0, snapped - 1);
  return CRACK_MASTER_ORDER.slice(CRACK_MASTER_ORDER.length - count);
}
