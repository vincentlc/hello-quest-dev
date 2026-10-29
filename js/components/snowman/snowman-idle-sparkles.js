import { CONFIG } from '../../config.js';

// ---------------------------------------------------------------------
// snowman-idle-sparkles: the ~120 orbiting ambient points around
// Copito's body. Merged into the `copito` component by
// snowman-component.js -- see snowman-core.js for the overall split.
// ---------------------------------------------------------------------
export default {
  // ~120 orbiting points around Copito's body, one THREE.Points buffer
  // (not N entities) to keep the draw-call budget flat. Attached to the
  // outer entity's object3D (ground level under Copito), independent of
  // the model wrapper's bob/sway above.
  buildSparkles: function () {
    var n = CONFIG.idleSparkleCount;
    var THREE = AFRAME.THREE;
    var positions = new Float32Array(n * 3);

    this.sparkleAngles = new Float32Array(n);
    this.sparkleSpeeds = new Float32Array(n);
    this.sparkleRadii = new Float32Array(n);
    this.sparkleHeights = new Float32Array(n);
    this.sparklePhases = new Float32Array(n);

    for (var i = 0; i < n; i++) {
      this.sparkleAngles[i] = Math.random() * Math.PI * 2;
      this.sparkleSpeeds[i] = 0.15 + Math.random() * 0.25;
      this.sparkleRadii[i] = (0.55 + Math.random() * 0.45) * this.sizeScale;
      this.sparkleHeights[i] = (0.15 + Math.random() * 1.3) * this.sizeScale;
      this.sparklePhases[i] = Math.random() * Math.PI * 2;
    }

    var geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    var material = new THREE.PointsMaterial({
      color: new THREE.Color(CONFIG.colors.sparkle),
      size: 0.035,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this.sparkles = new THREE.Points(geometry, material);
    this.el.object3D.add(this.sparkles);
    this.updateSparkles(0);
  },

  updateSparkles: function (t) {
    var n = CONFIG.idleSparkleCount;
    var positions = this.sparkles.geometry.attributes.position.array;

    for (var i = 0; i < n; i++) {
      var angle = this.sparkleAngles[i] + t * this.sparkleSpeeds[i];
      var radius = this.sparkleRadii[i];
      var bobOffset = Math.sin(t * 1.5 + this.sparklePhases[i]) * 0.08;

      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = this.sparkleHeights[i] + bobOffset;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
    }

    this.sparkles.geometry.attributes.position.needsUpdate = true;
  }
};
