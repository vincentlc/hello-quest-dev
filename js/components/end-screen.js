import { CONFIG } from '../config.js';
import { I18N, LANG, MODEL_CREDIT } from '../i18n.js';
import { buildPanel, placeFacingCamera } from '../core/vr-panel.js';
import { getBestScore, updateBestScore } from '../core/best-score.js';

// ---------------------------------------------------------------------
// end-screen (step 7, new): lives on <a-scene>, alongside
// snowball-thrower/wave-director. Listens for wave-director's
// 'game-complete' event (fired once CONFIG.creditsAfterWave is cleared)
// and shows a one-shot in-VR panel -- final score, the "created by"
// line, and the CC-BY credit the snowman model's license requires (see
// ASSETS.md) -- so that credit is actually visible inside the headset,
// not just in the 2D page's #credit div.
//
// Panel construction/placement is shared with welcome-screen.js (see
// vr-panel.js) -- deliberately NOT head-locked like wave-hud: it's
// placed once, at 'game-complete' time, in front of wherever the
// player happens to be looking, then left alone (a world-space sign,
// not UI glued to the camera) -- avoids the "pasted to your eyeballs"
// discomfort a continuously head-locked full panel would cause.
//
// Restart: per the user's ask, any snowball throw while this panel is
// up (snowball-thrower emits 'snowball-thrown' on every spawn(), see
// that file) hides the panel and asks wave-director to restart from
// wave 1 -- not an aimed hit on the panel itself, since requiring
// precise aim right after reading an end screen isn't the point.
// ---------------------------------------------------------------------
AFRAME.registerComponent('end-screen', {
  init: function () {
    this.active = false;

    this.built = buildPanel(this.el, {
      width: CONFIG.creditsPanelWidth,
      borderColor: CONFIG.colors.crownCyan,
      // Worst-case content: score line, best-score/new-record line, a
      // blank line, the creator credit, the CC-BY model credit (may
      // wrap to 2), another blank line, then the restart hint (may
      // wrap to 2) -- budget 10 so nothing in that combination clips.
      bodyMaxLines: 10
    });
    this.panel = this.built.panel;

    this.buildParticles();

    this.el.addEventListener('game-complete', (evt) => this.show(evt.detail.score));
    this.el.addEventListener('snowball-thrown', () => this.onSnowballThrown());
  },

  // One shared THREE.Points burst (same reuse pattern as copito's
  // snow-puff particles), built once and replayed every time the panel
  // shows -- a brief celebratory flourish, not a continuous effect.
  buildParticles: function () {
    var THREE = AFRAME.THREE;
    var n = CONFIG.creditsParticleCount;
    this.particleVelocities = [];
    this.particleSpawnTime = new Float32Array(n);
    this.particleOrigin = new THREE.Vector3();
    this.particlesActive = false;
    this.particleBurstStart = 0;
    for (var i = 0; i < n; i++) this.particleVelocities.push(new THREE.Vector3());

    var geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));

    this.particles = new THREE.Points(geometry, new THREE.PointsMaterial({
      color: new THREE.Color(CONFIG.colors.sparkle),
      size: 0.07,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false
    }));
    this.particles.visible = false;
    this.el.object3D.add(this.particles);
  },

  spawnParticles: function (origin) {
    var n = CONFIG.creditsParticleCount;
    this.particleOrigin.copy(origin);
    var now = this.lastTime || performance.now();
    for (var i = 0; i < n; i++) {
      var angle = Math.random() * Math.PI * 2;
      var radial = 0.6 + Math.random() * 1.4;
      this.particleVelocities[i].set(
        Math.cos(angle) * radial,
        1 + Math.random() * 1.6,
        Math.sin(angle) * radial
      );
      this.particleSpawnTime[i] = now;
    }
    this.particleBurstStart = now;
    this.particles.visible = true;
    this.particles.material.opacity = 0.95;
    this.particlesActive = true;
  },

  updateParticles: function (time) {
    if (!this.particlesActive) return;
    var n = CONFIG.creditsParticleCount;
    var lifetime = 1.6;
    var positions = this.particles.geometry.attributes.position.array;
    var anyAlive = false;

    for (var i = 0; i < n; i++) {
      var age = (time - this.particleSpawnTime[i]) / 1000;
      if (age > lifetime) continue;
      anyAlive = true;
      positions[i * 3] = this.particleOrigin.x + this.particleVelocities[i].x * age;
      positions[i * 3 + 1] = this.particleOrigin.y + this.particleVelocities[i].y * age - 0.5 * (CONFIG.gravity * 0.25) * age * age;
      positions[i * 3 + 2] = this.particleOrigin.z + this.particleVelocities[i].z * age;
    }

    this.particles.geometry.attributes.position.needsUpdate = true;
    var burstAge = (time - this.particleBurstStart) / 1000;
    this.particles.material.opacity = 0.95 * Math.max(0, 1 - burstAge / lifetime);

    if (!anyAlive) {
      this.particles.visible = false;
      this.particlesActive = false;
    }
  },

  tick: function (time) {
    this.lastTime = time;
    this.updateParticles(time);
  },

  show: function (score) {
    var camera = this.el.camera;
    if (!camera) return;
    var panelPos = placeFacingCamera(this.panel, camera, CONFIG.creditsPanelDistance, -0.05);

    var lang = I18N[LANG];
    var isNewBest = updateBestScore(score);
    var bestLine = isNewBest ? lang.newRecord : lang.bestScore + ': ' + getBestScore();

    this.built.setTitle(lang.gameComplete);
    this.built.setBody(
      lang.finalScore + ': ' + Math.round(score) + '\n' + bestLine + '\n\n' +
      lang.createdBy + '\n' + MODEL_CREDIT + '\n\n' +
      lang.restartHint);

    this.panel.setAttribute('visible', true);
    this.active = true;
    this.spawnParticles(panelPos);
  },

  onSnowballThrown: function () {
    if (!this.active) return;
    this.active = false;
    this.panel.setAttribute('visible', false);
    this.el.emit('restart-game');
  }
});
