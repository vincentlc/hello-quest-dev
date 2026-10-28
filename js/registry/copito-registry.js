// ---------------------------------------------------------------------
// copitoRegistry: every live `copito` component instance. Hit detection
// (snowball-thrower.findHitSnowman) loops this instead of looking up a
// single hardcoded `#copito` id, so multiple snowmen on the map (now
// used for real by wave-director) is a matter of adding more entities,
// not touching the throw/hit code.
// ---------------------------------------------------------------------
export var copitoRegistry = [];

// Unique id source for per-instance asset ids (blob shadow, crack
// textures), see snowman-core.js's init -- with a fixed id, two
// snowmen would collide on the same DOM id and the second one's
// textures would silently resolve to the first one's.
var copitoInstanceCounter = 0;
export function nextCopitoInstanceId() {
  return copitoInstanceCounter++;
}
