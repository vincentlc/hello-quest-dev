import { CONFIG } from '../config.js';

// ---------------------------------------------------------------------
// pickSpawnPoints: rejection-sampling spawn placement for one wave.
// Independent of wave-director itself so it's reusable elsewhere later
// (per the plan). Points land in a radius band (waveMinSpawnRadius to
// waveMaxSpawnRadius) around `origin`, inside an arc centered on
// `forward` that widens with `n` -- frontal-only for a small wave, a
// full circle (can spawn behind the player) once `n` reaches
// waveArcFullThreshold, see those CONFIG values' own comment -- with a
// minimum separation between points placed in the same call so
// simultaneous snowmen don't overlap or crowd one spot. `origin` and
// `forward` are read from the live camera at call time (not a fixed
// world constant), so this keeps working if/when the player gains
// locomotion -- today, with a stationary player, that's equivalent to
// the old hardcoded snowmanDistance.
// ---------------------------------------------------------------------
export function pickSpawnPoints(n, origin, forward, types) {
  var THREE = AFRAME.THREE;
  var flatForward = new THREE.Vector3(forward.x, 0, forward.z);
  if (flatForward.lengthSq() < 0.0001) flatForward.set(0, 0, -1);
  flatForward.normalize();

  var arcDeg = n <= 1 ? CONFIG.waveArcNarrowDeg :
    n >= CONFIG.waveArcFullThreshold ? CONFIG.waveArcFullDeg : CONFIG.waveArcWideDeg;
  var minR = CONFIG.waveMinSpawnRadius, maxR = CONFIG.waveMaxSpawnRadius;
  var up = new THREE.Vector3(0, 1, 0);
  var points = [];

  for (var i = 0; i < n; i++) {
    var candidate = null;
    var type = types && types.length ? types[i % types.length] : 0;
    var useFogBand = type >= CONFIG.fogSpawnMinType && Math.random() < CONFIG.fogSpawnChance;
    var radiusMin = useFogBand ? CONFIG.fogSpawnMinRadius : minR;
    // A handful of rejection-sampling attempts honoring minSeparation;
    // if none land clear (a crowded wave in a narrow arc), the last
    // attempt is kept anyway rather than silently spawning fewer
    // snowmen than the wave asked for.
    for (var attempt = 0; attempt < 30; attempt++) {
      var angle = (Math.random() * 2 - 1) * THREE.MathUtils.degToRad(arcDeg / 2);
      var radius = radiusMin + Math.random() * (maxR - radiusMin);
      var dir = flatForward.clone().applyAxisAngle(up, angle);
      candidate = new THREE.Vector3(origin.x + dir.x * radius, 0, origin.z + dir.z * radius);
      var tooClose = points.some((p) => candidate.distanceTo(p) < CONFIG.waveMinSeparation);
      if (!tooClose) break;
    }
    points.push(candidate);
  }
  return points;
}
