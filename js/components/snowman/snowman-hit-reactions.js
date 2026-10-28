import { CONFIG } from '../../config.js';
import { lerp } from '../../core/math-utils.js';

// ---------------------------------------------------------------------
// snowman-hit-reactions: per-hit squash/wobble impulse math, material
// flash, and the snow-puff burst at the impact point. Merged into the
// `copito` component by snowman-component.js -- see snowman-core.js for
// the overall split. Calls into the cracks group (this.showCrackDecal,
// this.crackDecals) and emits 'snowman-destroyed' for the explosion
// group to pick up, same as before the split.
// ---------------------------------------------------------------------
export default {
  // A damped, decaying oscillation starting at full amplitude the
  // instant it's triggered (impulse.time) and settling back to 0 by
  // CONFIG.hitImpulseDuration later. Shared by the squash and wobble
  // impulses -- same shape, different amplitude/axis.
  computeImpulse: function (time, impulse) {
    var elapsed = (time - impulse.time) / 1000;
    if (elapsed < 0 || elapsed > CONFIG.hitImpulseDuration || impulse.amplitude === 0) return 0;
    var decay = 1 - elapsed / CONFIG.hitImpulseDuration;
    return impulse.amplitude * decay * -Math.cos(elapsed * CONFIG.hitImpulseFrequency * Math.PI * 2);
  },

  // Escalating reaction per hit: every hit gets squash+flash+puff+one
  // more crack (a new one each time, scaling with hitsToExplode -- see
  // its CONFIG comment), with squash/wobble amplitude ramping up
  // (computeImpulse's lerp below) as the hit count climbs toward the
  // last one. The last hit (hitCount reaches hitsToExplode) emits
  // snowman-destroyed, which this same component also listens for (see
  // snowman-core.js's init) to actually run the explosion -- hitCount/
  // crack reset moved to respawn completion (updateRespawnPop's
  // finishRespawn) instead of happening immediately here, so Copito
  // stays visibly destroyed for the full respawnDelay rather than
  // snapping back instantly.
  onHit: function (detail) {
    if (!this.alive) return; // mid-explosion/respawn, ignore stray hits
    var time = this.lastTime;
    this.hitCount++;

    this.spawnSnowPuff(detail.point);
    this.flashMaterials(time);

    // 0 at hit 1, 1 at the last hit before the explosion -- how far
    // along the escalation this hit is, for the amplitude ramps below.
    var crackStages = Math.max(1, this.hitsToExplode - 1);
    var progress = Math.min(this.hitCount - 1, crackStages - 1) / Math.max(1, crackStages - 1);

    this.squashImpulse.time = time;
    this.squashImpulse.amplitude = lerp(CONFIG.hitSquashAmplitudeRange[0], CONFIG.hitSquashAmplitudeRange[1], progress);

    if (this.hitCount < this.hitsToExplode) {
      this.wobbleImpulse.time = time;
      this.wobbleImpulse.amplitude = lerp(CONFIG.hitWobbleAmplitudeRange[0], CONFIG.hitWobbleAmplitudeRange[1], progress);
      var crackIndex = this.hitCount - 1;
      if (this.crackDecals[crackIndex]) this.showCrackDecal(crackIndex);
    }

    if (this.hitCount >= this.hitsToExplode) {
      this.el.emit('snowman-destroyed', { point: detail.point });
    }
  },

  collectMaterials: function () {
    var mesh = this.model.getObject3D('mesh');
    if (!mesh) return;
    this.materials = [];
    var seen = {};
    mesh.traverse((node) => {
      if (!node.material) return;
      var mats = Array.isArray(node.material) ? node.material : [node.material];
      mats.forEach((mat) => {
        if (seen[mat.uuid] || !mat.color) return;
        seen[mat.uuid] = true;
        this.materials.push({ material: mat, originalColor: mat.color.clone() });
      });
    });
  },

  flashMaterials: function (time) {
    if (!this.materials) return;
    this.flashUntil = time + CONFIG.hitFlashDuration * 1000;
    this.materials.forEach((m) => m.material.color.set(CONFIG.hitFlashColor));
  },

  revertFlashIfDone: function (time) {
    if (this.flashUntil === undefined || time < this.flashUntil) return;
    this.materials.forEach((m) => m.material.color.copy(m.originalColor));
    this.flashUntil = undefined;
  },

  // One shared THREE.Points burst (not per-hit entities) placed in world
  // space at the impact point, reused every hit -- particles beyond
  // their lifetime just stop being written to visible positions.
  buildSnowPuffs: function () {
    var THREE = AFRAME.THREE;
    var n = CONFIG.snowPuffCount;
    this.puffVelocities = [];
    this.puffSpawnTime = new Float32Array(n);
    this.puffOrigin = new THREE.Vector3();
    for (var i = 0; i < n; i++) this.puffVelocities.push(new THREE.Vector3());

    var geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));

    this.snowPuffs = new THREE.Points(geometry, new THREE.PointsMaterial({
      color: new THREE.Color(CONFIG.colors.snowLight),
      size: 0.05,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false
    }));
    this.snowPuffs.visible = false;
    this.el.sceneEl.object3D.add(this.snowPuffs);
  },

  spawnSnowPuff: function (point) {
    var n = CONFIG.snowPuffCount;
    this.puffOrigin.set(point.x, point.y, point.z);
    for (var i = 0; i < n; i++) {
      this.puffVelocities[i].set(
        Math.random() * 2 - 1,
        0.2 + Math.random() * 1.2,
        Math.random() * 2 - 1
      ).normalize().multiplyScalar(CONFIG.snowPuffSpeed * (0.5 + Math.random() * 0.5));
      this.puffSpawnTime[i] = this.lastTime;
    }
    this.snowPuffs.visible = true;
    this.snowPuffs.material.opacity = 0.9;
  },

  updateSnowPuffs: function (time) {
    if (!this.snowPuffs.visible) return;
    var n = CONFIG.snowPuffCount;
    var positions = this.snowPuffs.geometry.attributes.position.array;
    var anyAlive = false;

    for (var i = 0; i < n; i++) {
      var age = (time - this.puffSpawnTime[i]) / 1000;
      if (age > CONFIG.snowPuffLifetime) continue;
      anyAlive = true;
      // Light gravity droop (a fraction of real gravity) so the puff
      // reads as soft snow drifting, not a heavy ballistic snowball.
      positions[i * 3] = this.puffOrigin.x + this.puffVelocities[i].x * age;
      positions[i * 3 + 1] = this.puffOrigin.y + this.puffVelocities[i].y * age - 0.5 * (CONFIG.gravity * 0.3) * age * age;
      positions[i * 3 + 2] = this.puffOrigin.z + this.puffVelocities[i].z * age;
    }

    this.snowPuffs.geometry.attributes.position.needsUpdate = true;
    if (!anyAlive) this.snowPuffs.visible = false;
  }
};
