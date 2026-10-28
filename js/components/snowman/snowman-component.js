import core from './snowman-core.js';
import idleSparkles from './snowman-idle-sparkles.js';
import hitReactions from './snowman-hit-reactions.js';
import cracks from './snowman-cracks.js';
import explosion from './snowman-explosion.js';

// ---------------------------------------------------------------------
// copito: Copito's look, idle animation, and hit/explosion/respawn (or
// wave-pool) state, assembled from the sibling files in this folder.
//
// Split by responsibility instead of one ~700-line object so each
// concern (build/lifecycle, idle sparkles, hit reactions, cracks,
// explosion+respawn) is its own small, readable file -- this is purely
// a file-organization change: every method below is untouched from the
// single-file version, just relocated and merged back together here
// via Object.assign. Cross-file calls (e.g. tick(), in snowman-core.js,
// calling updateExplosionChunks() from snowman-explosion.js) work
// exactly as before because AFRAME.registerComponent still gets one
// flat object with all of them on it -- `this` resolves across the
// merged methods at runtime same as if they'd always been siblings on
// one object literal.
//
// Future-proofing note: a future "snowman design" (different crack
// layout, different build/materials, a size variant) is a matter of
// swapping which group(s) get merged in here -- e.g. a different
// `cracks` module per type -- without touching the others.
// ---------------------------------------------------------------------
AFRAME.registerComponent('copito', Object.assign(
  {},
  core,
  idleSparkles,
  hitReactions,
  cracks,
  explosion
));
