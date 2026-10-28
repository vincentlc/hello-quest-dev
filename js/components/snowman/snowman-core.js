import { CONFIG } from '../../config.js';
import { copitoRegistry, nextCopitoInstanceId } from '../../registry/copito-registry.js';

// ---------------------------------------------------------------------
// snowman-core: the `copito` component's schema, lifecycle (init/tick),
// and the few small helpers tightly coupled to them. The rest of the
// component's behavior (idle sparkles, hit reactions, cracks, explosion
// + respawn/wave-pool lifecycle) lives in sibling files in this folder
// and gets merged onto this object in snowman-component.js -- see that
// file for why, and for the full picture of how the pieces fit
// together.
//
// The body is a CC-BY glTF model (see ASSETS.md for the required
// credit), not hand-built primitives. One consequence worth knowing:
// it's a single fused mesh (no separate "eye" or "crown" parts to
// address individually), so hit reactions (wobble, flash, cracks, etc.)
// are whole-model transforms and overlay effects instead of animating
// individual sub-parts.
// ---------------------------------------------------------------------
export default {
  // hitsToExplode: per-instance override of CONFIG.hitsToExplode (0
  // means "use the CONFIG default"), so wave-director (step 5 bis) can
  // give different snowmen different "lives" from the same wave table.
  // managed: true for entities owned by wave-director's pool -- see
  // snowman-explosion.js's activateForWave/updateRespawnTimer branch.
  // A managed snowman starts (and stays, between waves) hidden and
  // non-alive until the director activates it, and does not
  // self-respawn in place after exploding like a standalone one does.
  schema: {
    hitsToExplode: { type: 'int', default: 0 },
    managed: { default: false }
  },

  init: function () {
    var el = this.el;
    this.hitsToExplode = this.data.hitsToExplode || CONFIG.hitsToExplode;
    this.sizeScale = this.hitsToExplode === 7 ? CONFIG.bigSnowmanScaleMultiplier : 1;
    this.modelScale = CONFIG.copitoScale * this.sizeScale;
    this.hitPivotHeight = CONFIG.hitPivotHeight * this.sizeScale;

    // Unique per-instance id, used to namespace dynamically-created
    // <img> asset ids (blob shadow, crack textures) below -- with a
    // fixed id, two snowmen would collide on the same DOM id and the
    // second one's textures would silently resolve to the first one's.
    // Not needed with only one snowman today, but several on the map is
    // explicitly planned, so this is cheap to get right now.
    this.instanceId = nextCopitoInstanceId();
    copitoRegistry.push(this);

    // Soft round blob shadow so Copito doesn't look like he's floating.
    // A-Frame has no built-in radial-gradient material, so we paint one
    // on a small canvas once and use it as the plane's texture.
    var shadowImg = this.makeBlobShadowTexture();
    el.sceneEl.querySelector('a-assets').appendChild(shadowImg);
    var shadow = document.createElement('a-plane');
    shadow.setAttribute('rotation', '-90 0 0');
    shadow.setAttribute('position', '0 0.005 0');
    shadow.setAttribute('width', 1.3 * this.sizeScale);
    shadow.setAttribute('height', 1.3 * this.sizeScale);
    shadow.setAttribute('material', 'src: #' + shadowImg.id + '; transparent: true; shader: flat');
    el.appendChild(shadow);
    this.shadow = shadow; // referenced again in startExplosion/finishRespawn

    // hitPivot: a plain, well-centered rotation/scale point for the hit
    // squash + wobble (see CONFIG.hitPivotHeight's comment for why this
    // exists -- the model wrapper's own origin is a bad pivot). Sits
    // directly under `el`, in the same plain el-local meters as
    // everything else positioned there.
    this.hitPivot = document.createElement('a-entity');
    this.hitPivot.setAttribute('position', '0 ' + this.hitPivotHeight + ' 0');
    el.appendChild(this.hitPivot);

    // The model's own export has a messy internal transform (Sketchfab's
    // auto-converted FBX hierarchy: odd scale, off-center pivot). Rather
    // than fight that, we load it into a wrapper entity and correct it
    // with one scale + one position offset, both tunable from CONFIG.
    // Nested inside hitPivot (not `el` directly) now, with its position
    // adjusted by -hitPivot's own offset so nothing moves at rest (zero
    // squash/wobble) -- see hitPivotHeight's comment.
    this.model = document.createElement('a-entity');
    this.model.setAttribute('gltf-model', '#copitoModel');
    this.model.setAttribute('scale', this.modelScale + ' ' + this.modelScale + ' ' + this.modelScale);
    var offset = CONFIG.copitoOffset.split(' ').map((value) => Number(value) * this.sizeScale);
    this.model.setAttribute('position', offset[0] + ' ' + (offset[1] - this.hitPivotHeight) + ' ' + offset[2]);
    this.hitPivot.appendChild(this.model);

    // Two base positions, different frames:
    // - copitoOffsetVec: the scaled el-local offset. Used by
    //   worldToModelLocal to place crack decals in the larger model's
    //   local space.
    // - modelBasePosition: hitPivot-relative, used below for the idle
    //   bob/sway position-setting each tick (model's parent is now
    //   hitPivot, not `el`, so its base position must be too).
    this.copitoOffsetVec = { x: offset[0], y: offset[1], z: offset[2] };
    this.modelBasePosition = { x: offset[0], y: offset[1] - this.hitPivotHeight, z: offset[2] };

    this.scratchCameraPos = new AFRAME.THREE.Vector3(); // see updateFacing

    this.buildSparkles();

    // Hit reactions (step 4). hitCount drives three escalating stages;
    // see onHit. Materials are collected once the glTF is actually in
    // the scene graph (traversing before model-loaded finds nothing).
    this.hitCount = 0;
    this.lastTime = 0;
    this.materials = null;
    this.flashUntil = undefined;
    this.squashImpulse = { time: -Infinity, amplitude: 0 };
    this.wobbleImpulse = { time: -Infinity, amplitude: 0 };
    this.model.addEventListener('model-loaded', () => this.collectMaterials());
    this.buildSnowPuffs();
    this.buildCrackDecals();
    this.el.addEventListener('snowball-hit', (evt) => this.onHit(evt.detail));

    // Explosion + respawn (step 5). 'alive' gates hit detection
    // (snowball-thrower.findHitSnowman skips non-alive snowmen) so a
    // snowball can't score a hit on a hidden, mid-explosion body.
    // explosionState walks idle -> exploding -> respawning -> idle;
    // onHit's own 'snowman-destroyed' emit (its step 4-era hook) is
    // also what this component listens for to kick the state machine
    // off, keeping that event available for step 6/7 to hook into
    // independently (same pattern as snowball-hit).
    this.alive = true;
    this.explosionState = 'idle';
    this.explosionStartTime = -Infinity;
    this.destroyedCount = 0; // step 7's HUD will read this later
    this.buildExplosionChunks();
    this.buildExplosionBurst();
    this.buildExplosionLight();
    this.el.addEventListener('snowman-destroyed', (evt) => this.startExplosion(evt.detail.point));

    // Managed entities (wave-director's pool, step 5 bis) start hidden
    // and inert -- they only come alive once the director calls
    // activateForWave() the first time, same as between-wave reuse.
    if (this.data.managed) {
      this.alive = false;
      this.hitPivot.object3D.visible = false;
      this.shadow.object3D.visible = false;
      this.sparkles.visible = false;
    }
  },

  // copitoOffset/copitoScale correct the glTF's own messy raw-export
  // transform (see the class comment above), which means `this.model`'s
  // local space is that raw, pre-correction space -- not plain meters.
  // Anything parented inside it (the crack decals) needs its authored
  // "nice meters, same frame as copitoOffset" position converted into
  // that raw space once, at build time. After that one conversion, the
  // decal is a rigid child of the model wrapper and inherits every
  // subsequent animation (bob/sway/squash/wobble) automatically through
  // the normal parent-child transform hierarchy -- no per-frame syncing
  // needed, which is what kept the single old crack decal visually
  // detached from the body (it was parented to the non-animated outer
  // entity instead).
  // Keeps the snowman facing whoever's playing, every frame -- spawn
  // points vary now (wave-director), so a fixed spawn-time rotation
  // would leave most snowmen facing some arbitrary direction instead
  // of the player, breaking the "look at the threat" readability a
  // single always-ahead snowman got for free before. Yaw only (set on
  // `el` itself, not the model wrapper or hitPivot -- those stay free
  // for idle sway/hit wobble): the model's unrotated rest pose already
  // faces local +Z (confirmed visually -- the original static
  // placement with no rotation attribute faced the camera dead-on), so
  // rotating `el` by atan2(dx, dz) toward the camera's horizontal
  // offset points that same face at it from any spawn angle.
  updateFacing: function () {
    var camera = this.el.sceneEl.camera;
    if (!camera) return;
    camera.getWorldPosition(this.scratchCameraPos);
    var selfPos = this.el.object3D.position;
    var dx = this.scratchCameraPos.x - selfPos.x;
    var dz = this.scratchCameraPos.z - selfPos.z;
    if (dx * dx + dz * dz < 0.0001) return; // camera directly overhead -- keep the last valid facing
    this.el.object3D.rotation.y = Math.atan2(dx, dz);
  },

  worldToModelLocal: function (v) {
    return {
      x: (v.x - this.copitoOffsetVec.x) / this.modelScale,
      y: (v.y - this.copitoOffsetVec.y) / this.modelScale,
      z: (v.z - this.copitoOffsetVec.z) / this.modelScale
    };
  },

  // Idle bob (vertical sine) + slight sway (side-to-side tilt), applied
  // as deltas on top of the model's corrective offset position. Blink
  // is intentionally skipped: the model is a single fused mesh with no
  // separable eyes (see PROGRESS.md step 2), and the bob/sway/sparkles
  // combo already reads as alive without it.
  tick: function (time, delta) {
    this.lastTime = time;
    var dt = Math.min(delta / 1000, 0.05);

    // Face the camera every frame, not just at spawn -- runs in every
    // explosion state (cheap, and harmless while hidden) so a snowman
    // is already correctly oriented the instant it reappears. Applied
    // to `el` itself (yaw only), never touching the model
    // wrapper/hitPivot's own rotation -- those stay free for idle
    // sway and hit wobble, see updateFacing's comment.
    this.updateFacing();

    // Explosion fx (chunks/burst/light) run in every state -- a chunk
    // thrown mid-explosion keeps flying/fading through the respawn
    // delay and into the next 'idle' life, same as the original spec's
    // 1.5s post-bounce fade implies (it outlives the explosion state
    // itself for a snowman with a short respawnDelay).
    this.updateExplosionChunks(time, dt);
    this.updateExplosionBurst(time);
    this.updateExplosionLight(time);

    if (this.explosionState === 'exploding') {
      this.updateRespawnTimer(time);
      return; // body + idle/hit animation stay hidden, nothing else to do
    }

    var t = time / 1000;
    var bob = Math.sin((t / CONFIG.idleBobPeriod) * Math.PI * 2) * CONFIG.idleBobAmplitude;
    var sway = Math.sin((t / CONFIG.idleSwayPeriod) * Math.PI * 2) * CONFIG.idleSwayAmplitude;

    this.model.object3D.position.set(
      this.modelBasePosition.x,
      this.modelBasePosition.y + bob,
      this.modelBasePosition.z
    );
    this.model.object3D.rotation.z = sway;

    if (this.explosionState === 'respawning') {
      this.updateRespawnPop(time);
    } else {
      // Hit squash/wobble (step 4): decaying impulses applied on
      // hitPivot, not the model wrapper -- see CONFIG.hitPivotHeight's
      // comment for why (the wrapper's own origin is a bad pivot for
      // rotation/scale; hitPivot is a well-centered stand-in). Deltas on
      // top of its identity rest pose, same pattern as bob/sway above.
      // Skipped during 'respawning' -- the pop animation owns
      // hitPivot's scale for that window instead, see updateRespawnPop.
      var squash = this.computeImpulse(time, this.squashImpulse);
      var wobble = this.computeImpulse(time, this.wobbleImpulse);
      this.hitPivot.object3D.scale.set(1 + squash * 0.5, 1 - squash, 1 + squash * 0.5);
      this.hitPivot.object3D.rotation.z = wobble;
      this.hitPivot.object3D.rotation.x = wobble * 0.6;
    }

    this.revertFlashIfDone(time);
    this.updateSnowPuffs(time);
    this.updateSparkles(t);
  },

  // Paints a soft radial gradient (dark center, transparent edge) once
  // and returns it as an <img> ready to drop into <a-assets>.
  makeBlobShadowTexture: function () {
    var canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    var ctx = canvas.getContext('2d');
    var gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(10,40,40,0.35)');
    gradient.addColorStop(1, 'rgba(10,40,40,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);

    var img = document.createElement('img');
    img.id = 'blobShadow' + this.instanceId;
    img.src = canvas.toDataURL();
    return img;
  },

  remove: function () {
    var idx = copitoRegistry.indexOf(this);
    if (idx !== -1) copitoRegistry.splice(idx, 1);
  }
};
