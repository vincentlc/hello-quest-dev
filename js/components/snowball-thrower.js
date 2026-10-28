import { CONFIG } from '../config.js';
import { DesktopAim } from '../core/desktop-aim.js';
import { pulseHaptics } from '../core/haptics.js';
import { copitoRegistry } from '../registry/copito-registry.js';

// ---------------------------------------------------------------------
// snowball-thrower: lives on <a-scene>. Owns the pooled snowball
// entities, listens for throw input from both hands and the desktop
// mouse, and runs the shared ballistic tick for every live snowball.
// One pool, pre-created once and reused by round-robin index, per the
// no-create/destroy-per-throw budget.
// ---------------------------------------------------------------------
AFRAME.registerComponent('snowball-thrower', {
  init: function () {
    var THREE = AFRAME.THREE;
    this.lastTickTime = 0;
    this.cooldownUntil = {}; // per source key ('left'/'right'/'desktop')
    this.scratchOrigin = new THREE.Vector3();
    this.scratchDir = new THREE.Vector3();
    this.scratchCopitoPos = new THREE.Vector3();
    this.raycaster = new THREE.Raycaster();

    this.buildPool();

    this.leftHand = this.el.querySelector('#leftHand');
    this.rightHand = this.el.querySelector('#rightHand');

    this.leftHand.addEventListener('triggerdown', () => this.throwFromHand(this.leftHand, 'left'));
    this.rightHand.addEventListener('triggerdown', () => this.throwFromHand(this.rightHand, 'right'));

    // this.el.canvas only exists once the scene has finished loading.
    if (this.el.hasLoaded) {
      this.attachDesktopInput();
    } else {
      this.el.addEventListener('loaded', () => this.attachDesktopInput());
    }
  },

  attachDesktopInput: function () {
    this.el.canvas.addEventListener('mousedown', () => this.throwFromDesktop());
  },

  buildPool: function () {
    var THREE = AFRAME.THREE;
    this.pool = [];
    this.nextIndex = 0;
    this.nextThrowId = 0;
    // FIFO of currently-landed slots, oldest first -- bounded by
    // CONFIG.maxLandedSnowballs (see land()/evictOldestLanded()).
    this.landed = [];
    for (var i = 0; i < CONFIG.maxSnowballs; i++) {
      var el = document.createElement('a-sphere');
      el.setAttribute('radius', CONFIG.snowballRadius);
      el.setAttribute('segments-width', 8);
      el.setAttribute('segments-height', 8);
      el.setAttribute('material', 'color: ' + CONFIG.colors.snowball + '; roughness: 0.6; metalness: 0');
      el.setAttribute('visible', false);
      this.el.appendChild(el);
      // state: 'free' (available to throw) | 'flying' (ballistic, gets
      // physics + hit checks) | 'landed' (static, packed into the
      // ground, just sitting there until its slot is reused).
      this.pool.push({ el: el, state: 'free', velocity: new THREE.Vector3(), spawnTime: 0, landTime: 0 });
    }
  },

  throwFromHand: function (handEl, sourceKey) {
    if (!this.canThrow(sourceKey)) return;
    handEl.components['controller-aim'].getAimRay(this.scratchOrigin, this.scratchDir);
    this.spawn(this.scratchOrigin, this.scratchDir);
    pulseHaptics(handEl, CONFIG.haptics.throw[0], CONFIG.haptics.throw[1]);
  },

  throwFromDesktop: function () {
    if (!this.canThrow('desktop')) return;
    var camera = this.el.camera;
    if (!camera) return;
    this.raycaster.setFromCamera({ x: DesktopAim.x, y: DesktopAim.y }, camera);
    this.spawn(this.raycaster.ray.origin, this.raycaster.ray.direction);
  },

  canThrow: function (sourceKey) {
    var now = this.lastTickTime;
    if (this.cooldownUntil[sourceKey] !== undefined && now < this.cooldownUntil[sourceKey]) return false;
    this.cooldownUntil[sourceKey] = now + CONFIG.throwCooldown * 1000;
    return true;
  },

  spawn: function (origin, direction) {
    var sb = this.pool[this.nextIndex];
    this.nextIndex = (this.nextIndex + 1) % this.pool.length;

    // Reusing a slot that's currently sitting packed on the ground --
    // free it (and anything stacked on top of it, see freeLanded) since
    // it's about to fly again.
    if (sb.state === 'landed') this.freeLanded(sb);

    sb.state = 'flying';
    sb.spawnTime = this.lastTickTime;
    sb.throwId = ++this.nextThrowId;
    sb.el.object3D.position.copy(origin);
    sb.el.object3D.scale.set(1, 1, 1);
    sb.el.object3D.visible = true;

    sb.velocity.copy(direction).normalize().multiplyScalar(CONFIG.throwSpeed);
    sb.velocity.y += CONFIG.throwUpBias;

    // Step 7: end-screen.js listens for this on the scene to know when
    // to restart the run (any throw, while its post-credits freeze is
    // active -- not an aimed hit on the panel itself, since requiring
    // precise aim right after reading an end screen isn't the point).
    this.el.emit('snowball-thrown', { throwId: sb.throwId });
  },

  deactivate: function (sb) {
    sb.state = 'free';
    sb.el.object3D.visible = false;
  },

  // A miss that reaches the ground packs flat and stays there (reads as
  // snow piling up) instead of vanishing. A landing close to an
  // existing pile (landedStackRadius) stacks vertically on top of it
  // instead of overlapping at ground level. Bounded by
  // maxLandedSnowballs: once full, the oldest landed ball is freed back
  // to the pool so the round-robin in spawn() can reuse its slot
  // immediately.
  land: function (sb) {
    var pos = sb.el.object3D.position;
    var unit = CONFIG.snowballRadius * CONFIG.landedSquashY; // squashed half-height
    var base = this.findStackBase(pos);

    sb.state = 'landed';
    sb.landTime = this.lastTickTime;
    sb.velocity.set(0, 0, 0);

    if (base) {
      var basePos = base.el.object3D.position;
      pos.x = basePos.x;
      pos.z = basePos.z;
      pos.y = basePos.y + unit * 2; // sits directly on top of base's packed height
    } else {
      pos.y = unit;
    }

    this.landed.push(sb);
    if (this.landed.length > CONFIG.maxLandedSnowballs) {
      this.evictForCap();
    }
  },

  // The landed ball (if any) directly under a new impact point, i.e.
  // the current top of whatever pile is already at that spot.
  findStackBase: function (pos) {
    var best = null;
    for (var i = 0; i < this.landed.length; i++) {
      var other = this.landed[i];
      var otherPos = other.el.object3D.position;
      var dx = otherPos.x - pos.x;
      var dz = otherPos.z - pos.z;
      if (dx * dx + dz * dz > CONFIG.landedStackRadius * CONFIG.landedStackRadius) continue;
      if (!best || otherPos.y > best.el.object3D.position.y) best = other;
    }
    return best;
  },

  // True if some other landed ball sits directly on top of sb (i.e. sb
  // is currently buried, not the top of its pile).
  hasSupportAbove: function (sb) {
    var pos = sb.el.object3D.position;
    return this.landed.some((other) => {
      if (other === sb) return false;
      var otherPos = other.el.object3D.position;
      var dx = otherPos.x - pos.x;
      var dz = otherPos.z - pos.z;
      return dx * dx + dz * dz <= CONFIG.landedStackRadius * CONFIG.landedStackRadius &&
        otherPos.y > pos.y;
    });
  },

  // Cap eviction always targets the oldest ball that's currently the
  // TOP of its own pile -- never a buried one. A tall single stack at
  // one spot caps out instead of periodically collapsing wholesale
  // (which freeing a buried base would otherwise do, see freeLanded).
  evictForCap: function () {
    for (var i = 0; i < this.landed.length; i++) {
      if (!this.hasSupportAbove(this.landed[i])) {
        this.freeLanded(this.landed[i]);
        return;
      }
    }
    this.freeLanded(this.landed[0]); // every ball buried somehow -- shouldn't happen, but don't get stuck
  },

  // Frees a landed ball back to the pool. If other landed balls are
  // stacked directly on top of it, they'd be left floating once it's
  // gone -- so they're freed too (the pile topples along with its
  // base), recursively up the stack. Reached from two places: a direct
  // slot steal in spawn() (no choice which ball), and evictForCap's
  // fallback -- evictForCap's normal path only ever targets topmost
  // balls, so this recursion is a no-op there in practice.
  freeLanded: function (sb) {
    var idx = this.landed.indexOf(sb);
    if (idx !== -1) this.landed.splice(idx, 1);

    var pos = sb.el.object3D.position;
    var above = this.landed.filter((other) => {
      var otherPos = other.el.object3D.position;
      var dx = otherPos.x - pos.x;
      var dz = otherPos.z - pos.z;
      return dx * dx + dz * dz <= CONFIG.landedStackRadius * CONFIG.landedStackRadius &&
        otherPos.y > pos.y;
    });
    above.forEach((other) => this.freeLanded(other));

    this.deactivate(sb);
  },

  // Ballistic update for every live snowball (Euler integration, scratch
  // vectors reused, no per-frame allocation) + the proximity "hit"
  // check against every registered snowman (see copitoRegistry) that
  // hands off to step 4 via the `snowball-hit` DOM event on whichever
  // one got hit.
  tick: function (time, delta) {
    this.lastTickTime = time;
    var dt = Math.min(delta / 1000, 0.05);

    for (var i = 0; i < this.pool.length; i++) {
      var sb = this.pool[i];

      if (sb.state === 'landed') {
        // Ease the squash in over landedSquashTime instead of snapping,
        // so it still reads as a soft "pack" rather than a pop.
        var sinceLand = (time - sb.landTime) / 1000;
        var squashT = Math.min(sinceLand / CONFIG.landedSquashTime, 1);
        sb.el.object3D.scale.set(
          1 + (CONFIG.landedSquashXZ - 1) * squashT,
          1 + (CONFIG.landedSquashY - 1) * squashT,
          1 + (CONFIG.landedSquashXZ - 1) * squashT
        );
        continue;
      }

      if (sb.state !== 'flying') continue;

      sb.velocity.y -= CONFIG.gravity * dt;
      sb.el.object3D.position.addScaledVector(sb.velocity, dt);

      var pos = sb.el.object3D.position;
      var hitSnowman = this.findHitSnowman(pos);
      if (hitSnowman) {
        this.el.emit('snowball-hit-registered', { throwId: sb.throwId });
        hitSnowman.el.emit('snowball-hit', { point: { x: pos.x, y: pos.y, z: pos.z } });
        this.deactivate(sb);
        continue;
      }

      if (pos.y <= CONFIG.snowballRadius) {
        this.land(sb);
        continue;
      }

      if ((time - sb.spawnTime) / 1000 > CONFIG.snowballLifetime) {
        this.deactivate(sb);
      }
    }
  },

  // Capsule check (horizontal radius + a height range, not a single
  // sphere) against every registered snowman, not just one hardcoded
  // entity -- a sphere centered on a snowman's root (his feet) would
  // miss anything near the head/hat, since that's a full snowmanHeight
  // above the check point. Generous on purpose so aiming slightly off
  // still reads as a hit. Returns the first snowman hit, or null.
  findHitSnowman: function (pos) {
    for (var i = 0; i < copitoRegistry.length; i++) {
      var snowman = copitoRegistry[i];
      // Mid-explosion/respawn, this snowman isn't a valid target --
      // skip it instead of letting a snowball register a hit on a
      // hidden, already-dead body (see copito.startExplosion/alive).
      if (!snowman.alive) continue;
      snowman.el.object3D.getWorldPosition(this.scratchCopitoPos);
      var dx = pos.x - this.scratchCopitoPos.x;
      var dz = pos.z - this.scratchCopitoPos.z;
      var horizontalDist = Math.sqrt(dx * dx + dz * dz);
      var withinHeight = pos.y >= this.scratchCopitoPos.y &&
        pos.y <= this.scratchCopitoPos.y + (CONFIG.snowmanHeight + CONFIG.hitHeightMargin) * snowman.sizeScale;
      if (horizontalDist <= CONFIG.snowballHitRadius * snowman.sizeScale && withinHeight) return snowman;
    }
    return null;
  }
});
