import { CONFIG } from '../config.js';
import { DesktopAim } from '../core/desktop-aim.js';
import { getCircleSpriteTexture } from '../core/textures.js';

// ---------------------------------------------------------------------
// trajectory-preview: one dotted arc per aim source (each hand entity,
// plus one on the camera for desktop). Dot positions come from the same
// ballistic formula snowball-thrower uses, so the preview actually
// matches where a thrown snowball will go. Hidden while that source's
// trigger/mouse button is held down.
// ---------------------------------------------------------------------
AFRAME.registerComponent('trajectory-preview', {
  schema: { source: { default: 'hand' } }, // 'hand' or 'desktop'

  init: function () {
    var THREE = AFRAME.THREE;
    this.held = false;
    this.scratchOrigin = new THREE.Vector3();
    this.scratchDir = new THREE.Vector3();
    this.raycaster = new THREE.Raycaster();

    var n = CONFIG.trajectoryDots;
    var geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));

    this.points = new THREE.Points(geometry, new THREE.PointsMaterial({
      color: new THREE.Color(CONFIG.colors.snowball),
      size: 0.055,
      sizeAttenuation: true,
      map: getCircleSpriteTexture(),
      alphaTest: 0.1, // discards the texture's transparent corners instead of just blending them, so depthWrite can stay accurate
      transparent: true,
      opacity: 0.9,
      depthWrite: false
    }));
    // A thin line through the same dots so the arc reads as one curve,
    // not a scatter of separate points. Shares the Points' geometry
    // (same position attribute, one update moves both) rather than
    // duplicating the buffer.
    this.line = new THREE.Line(geometry, new THREE.LineBasicMaterial({
      color: new THREE.Color(CONFIG.colors.snowball),
      transparent: true,
      opacity: 0.35,
      depthWrite: false
    }));
    // World-space points/line: positions below are computed in world
    // space directly, so these attach to the scene root rather than
    // `el`, independent of the aim source's own transform.
    this.el.sceneEl.object3D.add(this.points);
    this.el.sceneEl.object3D.add(this.line);

    if (this.data.source === 'hand') {
      this.el.addEventListener('triggerdown', () => { this.held = true; });
      this.el.addEventListener('triggerup', () => { this.held = false; });
    } else {
      var attach = () => {
        this.el.sceneEl.canvas.addEventListener('mousedown', () => { this.held = true; });
        this.el.sceneEl.canvas.addEventListener('mouseup', () => { this.held = false; });
      };
      if (this.el.sceneEl.hasLoaded) attach();
      else this.el.sceneEl.addEventListener('loaded', attach);
    }
  },

  tick: function () {
    var hideForVR = this.data.source === 'desktop' && this.el.sceneEl.is('vr-mode');
    if (!CONFIG.showTrajectory || this.held || hideForVR) {
      this.setVisible(false);
      return;
    }

    if (this.data.source === 'hand') {
      this.el.components['controller-aim'].getAimRay(this.scratchOrigin, this.scratchDir);
    } else {
      var camera = this.el.sceneEl.camera;
      if (!camera) { this.setVisible(false); return; }
      this.raycaster.setFromCamera({ x: DesktopAim.x, y: DesktopAim.y }, camera);
      this.scratchOrigin.copy(this.raycaster.ray.origin);
      this.scratchDir.copy(this.raycaster.ray.direction);
    }

    // Guards against a one-frame-only condition seen in testing: on the
    // very first tick, before the camera's projection matrix has a real
    // (non-zero) canvas size to work from, Raycaster.setFromCamera can
    // momentarily unproject to a non-finite direction. Writing that into
    // the dots buffer would be a one-time cosmetic console error (THREE
    // caches a geometry's boundingSphere once computed, NaN or not, so
    // a single bad write lingers as a permanent warning even though
    // every later frame's data is fine) -- skip this frame instead.
    if (!isFinite(this.scratchOrigin.x) || !isFinite(this.scratchDir.x)) {
      this.setVisible(false);
      return;
    }

    this.setVisible(true);
    this.updateDots();
  },

  setVisible: function (visible) {
    this.points.visible = visible;
    this.line.visible = visible;
  },

  updateDots: function () {
    var positions = this.points.geometry.attributes.position.array;
    var vx = this.scratchDir.x * CONFIG.throwSpeed;
    var vy = this.scratchDir.y * CONFIG.throwSpeed + CONFIG.throwUpBias;
    var vz = this.scratchDir.z * CONFIG.throwSpeed;

    for (var i = 0; i < CONFIG.trajectoryDots; i++) {
      var t = (i + 1) * CONFIG.trajectoryDotInterval;
      positions[i * 3] = this.scratchOrigin.x + vx * t;
      positions[i * 3 + 1] = this.scratchOrigin.y + vy * t - 0.5 * CONFIG.gravity * t * t;
      positions[i * 3 + 2] = this.scratchOrigin.z + vz * t;
    }

    this.points.geometry.attributes.position.needsUpdate = true;
  }
});
