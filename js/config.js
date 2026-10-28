// ---------------------------------------------------------------------
// CONFIG: every tunable number in one place. Change these, reload, done.
// Units: meters, seconds, m/s.
// ---------------------------------------------------------------------
export var CONFIG = {
  // Snowman placement and size
  snowmanDistance: -5,      // meters in front of the player
  snowmanHeight: 1.6,       // approx total height, for reference when tuning parts
  // The downloaded model's own export has an odd internal transform
  // (off-center pivot, arbitrary scale) baked in by its Sketchfab/FBX
  // export. These two numbers were measured once (its raw bounding box,
  // read via THREE.Box3 in the browser) and solved so the model ends up
  // centered and standing on the ground at CONFIG.snowmanHeight tall.
  copitoScale: 0.6324,
  copitoOffset: '-4.206 0.0574 3.6008',

  // Idle animation (step 2): bob + sway are added on top of
  // copitoOffset as deltas on the model wrapper, not the declarative
  // `animation` component, so later steps (hit-wobble, respawn pop) can
  // drive the same transform without fighting over it. Periods are
  // deliberately different (not a shared multiple) so the motion reads
  // as organic drift rather than a mechanical loop.
  idleBobAmplitude: 0.02,   // meters, vertical
  idleBobPeriod: 2.5,       // seconds per full cycle
  idleSwayAmplitude: 0.035, // radians (~2deg), side-to-side tilt
  idleSwayPeriod: 3.2,      // seconds per full cycle

  // Throwing (step 3)
  throwSpeed: 9,
  throwUpBias: 0.15,
  gravity: 9.8,
  throwCooldown: 0.25,
  // 16 total, 12 of which can be sitting landed on the ground (see
  // maxLandedSnowballs below) -- the 4 extra over that give balls
  // actually in flight somewhere to live even when the ground is full,
  // instead of every single throw once-full fighting the pile for a slot.
  maxSnowballs: 16,
  snowballLifetime: 3,
  snowballRadius: 0.08,
  // "Hit" is a capsule check against Copito's position: within
  // snowballHitRadius horizontally, and between the ground and his full
  // height vertically -- not real collision geometry (step 3's event
  // contract note: the model is one fused mesh, so there are no
  // separate part hitboxes), but covers him head-to-foot (including the
  // hat) rather than only a sphere down at his feet. Generous on
  // purpose so aiming slightly off still reads as a hit.
  snowballHitRadius: 0.5,
  hitHeightMargin: 0.15, // extra headroom above snowmanHeight, for the hat tip
  showTrajectory: true,
  trajectoryDots: 12,
  trajectoryDotInterval: 0.08, // seconds of flight time between dots

  // Landed snowballs (step 4): a miss that reaches the ground packs
  // flat and stays there instead of vanishing, up to this many at once.
  // The pool's existing round-robin reuse (see snowball-thrower.spawn)
  // naturally evicts the oldest landed one once the cap is hit -- no
  // separate timer needed, it just gets thrown again like a fresh ball.
  // Landings close to an existing pile (landedStackRadius) stack
  // vertically on top of it instead of overlapping at ground level.
  maxLandedSnowballs: 12,
  landedStackRadius: 0.12, // how close counts as "the same spot"
  landedSquashY: 0.45,  // scale.y multiplier once packed into the ground
  landedSquashXZ: 1.3,  // scale.x/z multiplier (spreads out as it flattens)
  landedSquashTime: 0.12, // seconds to ease into the squashed shape

  // Hits and explosion (steps 4-5). hitsToExplode is the snowman's
  // "type"/lives, and is only ever 1, 3, 5, or 7 (see CRACK_MASTER_ORDER
  // and getCrackSlotsForLives below for why those specific values and
  // not any integer). One crack appears per hit up to the last one
  // (which explodes instead): type 1 explodes on the first hit with no
  // crack at all, type 3 shows 2 cracks, type 5 shows 4, type 7 shows
  // all 6. Default 3; designed to go up to 7 later for a bigger
  // snowman variant -- that bigger-body variant itself isn't built yet,
  // this just keeps the hit/crack system from hard-coding "exactly 2"
  // so raising this number alone will work.
  hitsToExplode: 3,
  chunkCount: 50,
  chunkSpeedMin: 2,
  chunkSpeedMax: 5,
  respawnDelay: 1,
  idleSparkleCount: 120,
  explosionSparkleCount: 250,

  // Explosion chunks (step 5): two THREE.InstancedMesh pools (mint snow
  // lumps, cyan ice shards), split evenly across chunkCount, built once
  // and reused every explosion rather than created/destroyed per
  // snowman death. Each chunk bounces once at y=0 (damped), then
  // shrinks to nothing over chunkFadeDuration -- "fade" is done by
  // scaling to 0 rather than true per-instance alpha, since
  // InstancedMesh shares one material across all instances and a real
  // opacity fade would need a custom shader; shrinking reads the same
  // at this chunk size and skips that complexity.
  chunkFadeDuration: 1.5,
  chunkRadiusMin: 0.05,
  chunkRadiusMax: 0.1,
  chunkSpinSpeedMax: 6,       // radians/sec, random per axis per chunk
  chunkBounceDamping: 0.35,   // vertical velocity multiplier on the one ground bounce
  chunkUpKickMin: 1.5,
  chunkUpKickMax: 3.5,
  // Comfort rule (VR requirement, not a style choice): every chunk's
  // outward direction is mirrored away from the camera if it would
  // otherwise point toward it (see copito.biasAwayFromCamera), so no
  // chunk is ever launched toward the player. Recomputed fresh from the
  // live camera position at explosion time, not a fixed +Z assumption,
  // so it still holds if the player has walked to a different spot.
  explosionFlashIntensity: 2.5,
  explosionFlashDuration: 0.15,
  respawnPopDuration: 0.6,

  // Hit reactions (step 4). Squash/wobble amplitude ramps linearly
  // across the hits leading up to the explosion (hit 1 at the low end,
  // the second-to-last hit at the high end) instead of a fixed
  // per-hit-index table, so it scales automatically with hitsToExplode.
  // Applied as decaying impulses on top of the idle bob/sway, same
  // pattern as those.
  hitSquashAmplitudeRange: [0.16, 0.34],
  hitWobbleAmplitudeRange: [0.0, 0.26], // wobble ramps in from none to a real shake
  hitImpulseDuration: 0.5,     // seconds for the squash/wobble to decay out
  hitImpulseFrequency: 4,     // Hz, how fast the squash/wobble oscillates while decaying
  hitFlashColor: '#FFFFFF',
  hitFlashDuration: 0.12,      // seconds the material stays flashed
  snowPuffCount: 24,
  snowPuffSpeed: 1.3,
  snowPuffLifetime: 0.45,

  // Crack decals (step 4): per the user's reference sketch, each active
  // crack is a curved band wrapping the body's roundness -- built as a
  // ribbon mesh of several short segments following an idealized
  // sphere approximating the torso (CRACK_MASTER_ORDER/CRACK_SLOTS has
  // the fixed per-slot crossing angle/sweep, getCrackSlotsForLives has
  // which slots a given hitsToExplode shows). A real mesh-hugging
  // version (raycasting the actual glTF surface) was tried first but
  // the scarf's surface detail made the fitted curve noisy/broken; an
  // idealized sphere is mathematically clean and the torso is close
  // enough to spherical that it still reads as hugging the body.
  // Centers/radii are in Copito's own el-local meters (same frame as
  // copitoOffset); each ribbon's vertices are converted to the model's
  // raw/pre-scale space at build time (see copito.worldToModelLocal)
  // so it can be parented inside the model wrapper and inherit every
  // animation (bob/sway/squash/wobble) for free, instead of drifting
  // separately like the very first (flat, non-curved) version did.
  crackTorsoCenter: { x: 0, y: 0.7, z: 0.03 },  // slots 1-4 cross here
  crackTorsoRadius: 0.41,
  // slots 6/7: a separate crossing point, lower than the face/eyes --
  // spans roughly chin-height down to the top of the scarf.
  crackUpperCenter: { x: 0, y: 0.88, z: -0.02 },
  crackUpperRadius: 0.27,
  crackSamples: 20,      // points per curve -- smooths the ribbon
  crackWidth: 0.09,      // meters -- broad, per the user's request

  // Hit squash/wobble (step 4) rotate/scale around this point instead
  // of the model wrapper's own raw origin. The wrapper's local origin
  // sits wherever the glTF's messy export transform happens to put it
  // (far from the visible mesh -- see copitoOffset's own comment), so
  // rotating/scaling it directly swings the whole body sideways by a
  // large distance instead of wobbling in place. This pivot is a plain
  // point in el-local meters, roughly mid-body height, with no such
  // baggage -- see the hitPivot setup in copito.init.
  hitPivotHeight: 0.8,

  // Wave director (step 5 bis, new -- not in the original spec): spawn
  // points are sampled in a band inside the fog-clear zone (<a-scene>'s
  // fog far: 7.9, above) and well inside the ground disc (<a-circle>'s
  // radius: 9.5, above), in an arc around wherever the camera is
  // currently facing (not a fixed world angle, so this still works if
  // the player ever gains locomotion -- see wave-director's class
  // comment). The arc widens with snowman count: small waves stay
  // frontal (so an early/easy wave doesn't surprise a new player from
  // behind), but once a wave is big enough (waveArcFullThreshold) it
  // opens to a full circle -- copito.updateFacing() means every
  // snowman still turns to face the player regardless of where it
  // spawned, so there's no risk of one spawning with its back turned;
  // the only effect of a wider arc is that the player has to actually
  // turn and check their surroundings on a tough wave, which is the
  // point.
  waveMinSpawnRadius: 3,
  waveMaxSpawnRadius: 7,
  waveMinSeparation: 1.4,        // meters between simultaneous spawn points in one wave
  waveArcNarrowDeg: 70,          // frontal arc for a single-snowman wave
  waveArcWideDeg: 150,           // frontal arc for a small multi-snowman wave
  waveArcFullDeg: 360,           // full circle -- can spawn behind the player
  waveArcFullThreshold: 5,       // snowman count at/above which the full-circle arc kicks in
  waveMaxConcurrentSnowmen: 8,   // cap once past the authored WAVE_TABLE (see getWaveConfig)
  waveIntermissionDelay: 2.5,    // seconds of calm between a wave clearing and the next starting
  waveDestroyBonusPerLife: 10,   // score per "life" (hitsToExplode) on a kill -- a type-7 kill is worth more than a type-1
  waveClearBonus: 50,
  // Soft, low-stakes time bonus for clearing a wave quickly -- no fail
  // state, no countdown UI, per the user ("could be soft time but not
  // too exigent... nor important for now"). Decays linearly to 0, never
  // negative.
  waveSoftTimerBonusMax: 30,
  waveSoftTimerDecayPerSecond: 1,

  // End-of-run credits screen (step 7). Modular on purpose: once
  // (waveIndex + 1) reaches this number, wave-director stops scheduling
  // further waves and emits 'game-complete' instead -- end-screen.js
  // freezes the game and shows a one-shot in-VR panel (score + credits)
  // until a 'snowball-thrown' event (any throw, see snowball-thrower's
  // spawn()) tells it to restart from wave 1. Raise this later for a
  // longer run without touching any other code.
  creditsAfterWave: 10,
  // World-space placement/size for that panel -- spawned once in front
  // of wherever the player is looking at the moment the game completes
  // (not head-locked, see end-screen.js), so it reads like a sign
  // placed in the world rather than UI glued to your eyes.
  creditsPanelDistance: 2.2,
  creditsPanelWidth: 1.7,
  creditsPanelHeight: 1.05,
  creditsParticleCount: 90,

  // Welcome/intro panel (step 7, new): shown once right after load,
  // explaining the throw control (desktop click vs the VR trigger,
  // picked live off vr-mode) with a small controller icon highlighting
  // the trigger -- see welcome-screen.js/controller-icon.js. Dismissed
  // by the player's own first throw, or this timeout if they never
  // throw, so it never lingers forever.
  welcomePanelDistance: 1.8,
  welcomePanelWidth: 1.3,
  welcomePanelHeight: 0.85,
  welcomeAutoHideSeconds: 14,

  // Sound volumes 0 to 1 (step 6)
  volume: {
    throw: 0.5,
    hit: 0.6,
    crack: 0.6,
    explosion: 0.8,
    respawn: 0.6,
    ambience: 0.25
  },

  // Haptic pulses: [intensity 0 to 1, duration ms] (step 6)
  haptics: {
    throw: [0.3, 40],
    hit: [0.6, 80],
    explosion: [1.0, 150]
  },

  // Copito's palette, so the whole look can be re-tinted from one place
  colors: {
    snowBase: '#CFF5EA',
    snowLight: '#E2FBF4',
    tealDark: '#0B3D3A',
    tealMid: '#17A2A0',
    teal: '#14B8A6',
    tealStripe: '#0F766E',
    iceNose: '#2EC4B6',
    crownCyan: '#7DF9FF',
    sparkle: '#B8FFF4',
    snowball: '#F4FFFD',
    // Crack ribbons (step 4): one icy glow color, same across every
    // slot (the user's call -- the earlier per-slot rainbow palette
    // didn't match their reference). The gradient texture itself (see
    // getCrackGlowTexture) fades this color out at the edges and up to
    // white-hot at the center, so no separate dark "core" color is
    // needed anymore.
    crackGlow: '#7DF9FF'
  }
};
