import { CONFIG } from '../config.js';

// ---------------------------------------------------------------------
// WAVE_TABLE / getWaveConfig: the data-driven wave table wave-director
// walks through. Each row is {count, types}; `types` picks each
// snowman's "lives" via the existing 1/3/5/7 hitsToExplode system
// (CRACK_MASTER_ORDER/getCrackSlotsForLives, see data/crack-slots.js),
// reused per-instance -- no new toughness mechanic needed. Wave 1 is
// still a single type-1 snowman (a quick, readable intro), but the ramp
// afterward is steeper than the first cut of this table -- wave 2
// already brings a second snowman and type-3 shows up by wave 3, per
// the user's "start a bit harder" request. Not a hard cap: once the
// authored rows run out, getWaveConfig keeps generating further waves
// procedurally instead of looping back or stopping (per the user: the
// table "just keeps going if wanted later").
//
// Future-proofing note: this table (and this file) is the one place a
// future level/background change would add a second table for, since
// wave-director only ever asks getWaveConfig(index) for the next row --
// it never reads WAVE_TABLE directly.
// ---------------------------------------------------------------------
export var WAVE_TABLE = [
  { count: 1, types: [1] },
  { count: 2, types: [1, 1] },
  { count: 2, types: [1, 3] },
  { count: 3, types: [1, 3, 3] },
  { count: 3, types: [3, 3, 5] },
  { count: 4, types: [1, 3, 3, 5] },
  { count: 4, types: [3, 3, 5, 5] },
  { count: 5, types: [1, 3, 5, 5, 7] },
  { count: 5, types: [3, 5, 5, 7, 7] },
  { count: 6, types: [1, 3, 3, 5, 5, 7] },
  { count: 6, types: [3, 5, 5, 7, 7, 7] },
  { count: 7, types: [1, 3, 5, 5, 7, 7, 7] }
];

export function getWaveConfig(index) {
  if (index < WAVE_TABLE.length) return WAVE_TABLE[index];

  // Past the authored table: count keeps creeping up (capped at
  // waveMaxConcurrentSnowmen so the pool/scene don't grow unbounded),
  // and the type mix skews tougher the further past the table we go.
  var beyond = index - WAVE_TABLE.length + 1;
  var lastRow = WAVE_TABLE[WAVE_TABLE.length - 1];
  var count = Math.min(lastRow.count + Math.floor(beyond / 2), CONFIG.waveMaxConcurrentSnowmen);
  var toughPool = [1, 3, 5, 7];
  var toughBias = Math.min(toughPool.length, 2 + Math.floor(beyond / 4));
  var types = [];
  for (var i = 0; i < count; i++) {
    types.push(toughPool[Math.floor(Math.random() * toughBias)]);
  }
  return { count: count, types: types };
}
