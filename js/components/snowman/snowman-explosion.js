import { CONFIG } from '../../config.js';
import { lerp, easeOutBack } from '../../core/math-utils.js';
import { pulseHaptics } from '../../core/haptics.js';

// ---------------------------------------------------------------------
// snowman-explosion: explosion chunks (instanced debris), the sparkle
// burst, the light flash, and the explosion -> respawn (or, for a
// wave-director-managed instance, explosion -> pooled-idle) state
// machine. Merged into the `copito` component by snowman-component.js
// -- see snowman-core.js for the overall split.
//
// Three pooled fx systems built once, same no-create/destroy-per-
// explosion budget as the snowball pool and the snow-puff/sparkle
// systems: instanced chunks, a one-shot sparkle burst, and a point
// light flash.
// ---------------------------------------------------------------------
export default {
  // Two THREE.InstancedMesh pools (mint snow lumps, cyan ice shards),
  // split evenly across CONFIG.chunkCount and built once. this.model
  // has no separate "parts" to spawn chunks from (single fused mesh,
  // same constraint as steps 2/4), so spawnExplosionChunks distributes
  // them across the model's overall height band instead -- see there.
  buildExplosionChunks: function () {
    var THREE = AFRAME.THREE;
    this.chunkDummy = new THREE.Object3D();
    this.chunkPool = [];

    var n = CONFIG.chunkCount;
    var lumpCount = Math.ceil(n / 2);
    var shardCount = n - lumpCount;

    var lumpMat = new THREE.MeshStandardMaterial({ color: CONFIG.colors.snowBase, roughness: 0.85 });
    var shardMat = new THREE.MeshStandardMaterial({ color: CONFIG.colors.iceNose, roughness: 0.15, metalness: 0.1 });

    this.chunkMeshes = {
      lump: new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), lumpMat, lumpCount),
      shard: new THREE.InstancedMesh(new THREE.OctahedronGeometry(1, 0), shardMat, shardCount)
    };
    // Instances fly well outside the model's own local bounds (that's
    // the point), so the auto-computed bounding sphere used for
    // frustum culling would need recomputing every frame to be correct
    // -- simpler and cheap enough at this instance count to just
    // always draw them.
    this.chunkMeshes.lump.frustumCulled = false;
    this.chunkMeshes.shard.frustumCulled = false;
    this.el.sceneEl.object3D.add(this.chunkMeshes.lump);
    this.el.sceneEl.object3D.add(this.chunkMeshes.shard);

    var typeIndex = { lump: 0, shard: 0 };
    for (var i = 0; i < n; i++) {
      var type = i % 2 === 0 ? 'lump' : 'shard';
      var index = typeIndex[type]++;
      this.parkChunkInstance(type, index);
      this.chunkPool.push({
        type: type, index: index, active: false, bounced: false,
        velocity: new THREE.Vector3(), spin: new THREE.Vector3(),
        position: new THREE.Vector3(), rotation: new THREE.Euler(),
        radius: 0, spawnTime: 0, bounceTime: 0
      });
    }
  },

  // Scales an instance to 0 at a parked position -- cheaper than
  // juggling InstancedMesh.count, and correct either way since a
  // zero-scale instance renders nothing.
  parkChunkInstance: function (type, index) {
    this.chunkDummy.position.set(0, -1000, 0);
    this.chunkDummy.rotation.set(0, 0, 0);
    this.chunkDummy.scale.setScalar(0);
    this.chunkDummy.updateMatrix();
    this.chunkMeshes[type].setMatrixAt(index, this.chunkDummy.matrix);
  },

  // Mirrors any chunk direction that would point toward the camera
  // back away from it, in place. This is the actual comfort-rule
  // guarantee (not a per-frame distance check): since no chunk's
  // velocity is ever given a toward-camera component to begin with,
  // none can close distance toward the player as it flies/bounces --
  // "nothing within 1m of the head" follows structurally rather than
  // needing a continuous collision check against the camera. Not
  // verified on an actual headset yet (see PROGRESS.md step 5 notes).
  biasAwayFromCamera: function (dir, towardCamera) {
    var dot = dir.dot(towardCamera);
    if (dot > 0) dir.addScaledVector(towardCamera, -2 * dot);
    return dir;
  },

  // basePos: the snowman's own world position (feet/ground level),
  // used to distribute chunks across its height band -- not the exact
  // impact point, so the burst reads as "the whole body" rather than
  // just where the last snowball happened to land.
  spawnExplosionChunks: function (basePos) {
    var THREE = AFRAME.THREE;
    var camera = this.el.sceneEl.camera;
    var towardCamera = new THREE.Vector3(0, 0, 1);
    if (camera) {
      var camPos = new THREE.Vector3();
      camera.getWorldPosition(camPos);
      towardCamera.copy(camPos).sub(basePos);
      towardCamera.y = 0;
      if (towardCamera.lengthSq() > 0.0001) towardCamera.normalize();
      else towardCamera.set(0, 0, 1);
    }

    var dir = new THREE.Vector3();
    for (var i = 0; i < this.chunkPool.length; i++) {
      var chunk = this.chunkPool[i];
      dir.set(Math.random() * 2 - 1, 0, Math.random() * 2 - 1);
      if (dir.lengthSq() < 0.0001) dir.set(1, 0, 0);
      dir.normalize();
      this.biasAwayFromCamera(dir, towardCamera);

      var speed = lerp(CONFIG.chunkSpeedMin, CONFIG.chunkSpeedMax, Math.random());
      var upKick = lerp(CONFIG.chunkUpKickMin, CONFIG.chunkUpKickMax, Math.random());
      chunk.velocity.set(dir.x * speed, upKick, dir.z * speed);
      chunk.spin.set(
        (Math.random() * 2 - 1) * CONFIG.chunkSpinSpeedMax,
        (Math.random() * 2 - 1) * CONFIG.chunkSpinSpeedMax,
        (Math.random() * 2 - 1) * CONFIG.chunkSpinSpeedMax
      );
      chunk.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      chunk.radius = lerp(CONFIG.chunkRadiusMin, CONFIG.chunkRadiusMax, Math.random());
      // Height band across the model's overall bounding box, not a
      // per-part anchor -- see this method's class comment.
      chunk.position.set(
        basePos.x + (Math.random() * 2 - 1) * 0.15,
        basePos.y + Math.random() * CONFIG.snowmanHeight * this.sizeScale,
        basePos.z + (Math.random() * 2 - 1) * 0.15
      );
      chunk.active = true;
      chunk.bounced = false;
      chunk.bounceTime = 0;
      chunk.spawnTime = this.lastTime;
    }
  },

  // Euler-integrates gravity + velocity per active chunk (same pattern
  // as snowball-thrower's ballistic tick), bounces once at y=0 with
  // damping, then shrinks to 0 over chunkFadeDuration after the bounce
  // -- see CONFIG.chunkFadeDuration's comment for why shrinking stands
  // in for a true alpha fade here. Runs every tick regardless of
  // explosionState so a chunk that outlives the explosion window (a
  // short respawnDelay vs. the fade duration) keeps animating.
  updateExplosionChunks: function (time, dt) {
    var anyActive = false;
    var lumpMesh = this.chunkMeshes.lump;
    var shardMesh = this.chunkMeshes.shard;

    for (var i = 0; i < this.chunkPool.length; i++) {
      var chunk = this.chunkPool[i];
      if (!chunk.active) continue;
      anyActive = true;

      chunk.velocity.y -= CONFIG.gravity * dt;
      chunk.position.addScaledVector(chunk.velocity, dt);
      chunk.rotation.x += chunk.spin.x * dt;
      chunk.rotation.y += chunk.spin.y * dt;
      chunk.rotation.z += chunk.spin.z * dt;

      if (!chunk.bounced && chunk.position.y <= chunk.radius) {
        chunk.position.y = chunk.radius;
        chunk.velocity.y *= -CONFIG.chunkBounceDamping;
        chunk.velocity.x *= CONFIG.chunkBounceDamping;
        chunk.velocity.z *= CONFIG.chunkBounceDamping;
        chunk.bounced = true;
        chunk.bounceTime = time;
      }

      var scale = chunk.radius;
      if (chunk.bounced) {
        var fadeT = (time - chunk.bounceTime) / 1000 / CONFIG.chunkFadeDuration;
        if (fadeT >= 1) {
          chunk.active = false;
          this.parkChunkInstance(chunk.type, chunk.index);
          continue;
        }
        scale = chunk.radius * (1 - fadeT);
      }

      this.chunkDummy.position.copy(chunk.position);
      this.chunkDummy.rotation.copy(chunk.rotation);
      this.chunkDummy.scale.setScalar(scale);
      this.chunkDummy.updateMatrix();
      (chunk.type === 'lump' ? lumpMesh : shardMesh).setMatrixAt(chunk.index, this.chunkDummy.matrix);
    }

    if (anyActive) {
      lumpMesh.instanceMatrix.needsUpdate = true;
      shardMesh.instanceMatrix.needsUpdate = true;
    }
  },

  // One shared THREE.Points burst (200-300 additive sparkles, see
  // CONFIG.explosionSparkleCount), same reused-buffer pattern as
  // buildSnowPuffs but bigger and in world space at the impact point.
  buildExplosionBurst: function () {
    var THREE = AFRAME.THREE;
    var n = CONFIG.explosionSparkleCount;
    this.burstVelocities = [];
    this.burstSpawnTime = new Float32Array(n);
    this.burstOrigin = new THREE.Vector3();
    for (var i = 0; i < n; i++) this.burstVelocities.push(new THREE.Vector3());

    var geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));

    this.burst = new THREE.Points(geometry, new THREE.PointsMaterial({
      color: new THREE.Color(CONFIG.colors.sparkle),
      size: 0.05,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    }));
    this.burst.visible = false;
    this.el.sceneEl.object3D.add(this.burst);
  },

  spawnExplosionBurst: function (point) {
    var n = CONFIG.explosionSparkleCount;
    this.burstOrigin.copy(point);
    this.burstDuration = 1.0; // seconds, "expanding then fading" per spec
    for (var i = 0; i < n; i++) {
      this.burstVelocities[i].set(
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
        Math.random() * 2 - 1
      ).normalize().multiplyScalar(CONFIG.chunkSpeedMax * (0.3 + Math.random() * 0.7));
      this.burstSpawnTime[i] = this.lastTime;
    }
    this.burst.visible = true;
    this.burst.material.opacity = 0.9;
  },

  updateExplosionBurst: function (time) {
    if (!this.burst.visible) return;
    var n = CONFIG.explosionSparkleCount;
    var positions = this.burst.geometry.attributes.position.array;
    var anyAlive = false;

    for (var i = 0; i < n; i++) {
      var age = (time - this.burstSpawnTime[i]) / 1000;
      if (age > this.burstDuration) continue;
      anyAlive = true;
      positions[i * 3] = this.burstOrigin.x + this.burstVelocities[i].x * age;
      positions[i * 3 + 1] = this.burstOrigin.y + this.burstVelocities[i].y * age;
      positions[i * 3 + 2] = this.burstOrigin.z + this.burstVelocities[i].z * age;
    }

    this.burst.geometry.attributes.position.needsUpdate = true;
    if (anyAlive) {
      var oldestAge = (time - this.burstSpawnTime[0]) / 1000;
      this.burst.material.opacity = Math.max(0, 0.9 * (1 - oldestAge / this.burstDuration));
    } else {
      this.burst.visible = false;
    }
  },

  // Short point-light flash at the impact point (spec: "no full-screen
  // flash", so a real scene light spiking briefly instead of a 2D
  // overlay). intensity 0 doubles as "off" -- updateExplosionLight
  // only runs the decay math once it's been fired at least once.
  buildExplosionLight: function () {
    var THREE = AFRAME.THREE;
    this.explosionLight = new THREE.PointLight(0xBFF9FF, 0, 6);
    this.el.sceneEl.object3D.add(this.explosionLight);
    this.explosionLightUntil = -Infinity;
  },

  flashExplosionLight: function (point, time) {
    this.explosionLight.position.copy(point);
    this.explosionLight.intensity = CONFIG.explosionFlashIntensity;
    this.explosionLightUntil = time + CONFIG.explosionFlashDuration * 1000;
  },

  updateExplosionLight: function (time) {
    if (this.explosionLight.intensity === 0) return;
    var remaining = this.explosionLightUntil - time;
    if (remaining <= 0) { this.explosionLight.intensity = 0; return; }
    this.explosionLight.intensity = CONFIG.explosionFlashIntensity * (remaining / (CONFIG.explosionFlashDuration * 1000));
  },

  // Pulses both hand controllers (not just one, unlike throw/hit which
  // know which specific hand triggered them) -- an explosion isn't
  // attributable to a single hand, so both get the feedback. Guarded
  // the same way pulseHaptics itself is guarded for desktop (no
  // gamepad): querying a hand that doesn't exist or isn't connected is
  // a no-op, not an error.
  pulseExplosionHaptics: function () {
    var leftHand = document.querySelector('#leftHand');
    var rightHand = document.querySelector('#rightHand');
    if (leftHand) pulseHaptics(leftHand, CONFIG.haptics.explosion[0], CONFIG.haptics.explosion[1]);
    if (rightHand) pulseHaptics(rightHand, CONFIG.haptics.explosion[0], CONFIG.haptics.explosion[1]);
  },

  // Hides the body (hitPivot covers model + crack decals in one go,
  // since THREE.Object3D.visible=false stops the renderer from
  // traversing into children too -- shadow and the idle sparkles are
  // outside that subtree so they need their own hide), fires every fx
  // system, and flips 'alive' off so findHitSnowman stops considering
  // this snowman a valid target mid-explosion.
  startExplosion: function (point) {
    if (this.explosionState !== 'idle') return; // already exploding/respawning, ignore a duplicate trigger
    var THREE = AFRAME.THREE;
    this.alive = false;
    this.explosionState = 'exploding';
    this.explosionStartTime = this.lastTime;

    this.hitPivot.object3D.visible = false;
    this.shadow.object3D.visible = false;
    this.sparkles.visible = false;
    this.hideCrackDecals();
    // Force a clean (unflashed) material state regardless of whether
    // flashMaterials' own revert timer had already fired -- otherwise
    // a kill shot landing inside hitFlashDuration of this hit would
    // leave the respawned snowman stuck showing hitFlashColor forever.
    this.flashUntil = undefined;
    if (this.materials) this.materials.forEach((m) => m.material.color.copy(m.originalColor));

    var basePos = new THREE.Vector3();
    this.el.object3D.getWorldPosition(basePos);
    var impactPos = new THREE.Vector3(point.x, point.y, point.z);

    this.spawnExplosionChunks(basePos);
    this.spawnExplosionBurst(impactPos);
    this.flashExplosionLight(impactPos, this.lastTime);
    this.pulseExplosionHaptics();
  },

  // Runs only while explosionState === 'exploding' (see tick). Once
  // CONFIG.respawnDelay has elapsed: a standalone snowman shows its
  // body again and starts the pop-scale animation (updateRespawnPop)
  // rather than snapping straight back to full size. A managed one
  // (wave-director's pool, step 5 bis) instead stays hidden/non-alive
  // and just signals it's free to be reused -- the director decides
  // if/when/where it comes back via activateForWave, not this
  // component on its own.
  updateRespawnTimer: function (time) {
    if (time - this.explosionStartTime < CONFIG.respawnDelay * 1000) return;

    if (this.data.managed) {
      this.explosionState = 'idle';
      this.hitCount = 0;
      this.hideCrackDecals();
      this.el.emit('snowman-cleared');
      return;
    }

    this.explosionState = 'respawning';
    this.respawnStartTime = time;
    this.hitPivot.object3D.visible = true;
    this.shadow.object3D.visible = true;
    this.sparkles.visible = true;
  },

  // Scale 0 -> 1 with an overshoot "pop" on hitPivot -- safe to drive
  // directly (not as a delta like bob/sway/squash) because hitCount is
  // 0 and every hit impulse has long since decayed by the time this
  // runs, so nothing else is competing for hitPivot's scale right now.
  updateRespawnPop: function (time) {
    var t = (time - this.respawnStartTime) / 1000 / CONFIG.respawnPopDuration;
    if (t >= 1) {
      this.hitPivot.object3D.scale.set(1, 1, 1);
      this.finishRespawn();
      return;
    }
    var scale = Math.max(0, easeOutBack(t));
    this.hitPivot.object3D.scale.set(scale, scale, scale);
  },

  finishRespawn: function () {
    this.explosionState = 'idle';
    this.alive = true;
    this.hitCount = 0; // deferred here from onHit so the destroyed body stays visible for the full respawnDelay
    this.destroyedCount++; // step 7's HUD will read this later
  },

  // wave-director's activation call (step 5 bis), for a managed entity
  // only: places it at a fresh spawn point and brings it fully back to
  // a clean "just spawned" state, whether this is its very first
  // activation (still hidden/non-alive from init) or a reuse after a
  // previous wave's death (left hidden/non-alive by updateRespawnTimer
  // above). Mirrors finishRespawn's state reset plus the position set a
  // standalone snowman never needed (it's placed once, in the HTML).
  activateForWave: function (position) {
    this.el.object3D.position.set(position.x, position.y, position.z);
    this.hitCount = 0;
    this.alive = true;
    this.explosionState = 'idle';
    this.hitPivot.object3D.scale.set(1, 1, 1);
    this.hitPivot.object3D.visible = true;
    this.shadow.object3D.visible = true;
    this.sparkles.visible = true;
    this.hideCrackDecals();
  }
};
