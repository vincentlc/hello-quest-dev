import { CONFIG } from '../config.js';

function getTransitionThresholds(waveCount, landscapeCount) {
  var transitionCount = Math.min(landscapeCount - 1, waveCount - 1);
  if (transitionCount <= 0) return [];

  var ratio = CONFIG.landscapeTransitionRatios.secondAt10Waves;
  var ratioProgress = Math.max(0, Math.min(1, (waveCount - 10) / 10));
  ratio += (CONFIG.landscapeTransitionRatios.secondAt20Waves - ratio) * ratioProgress;

  var desiredThresholds = [
    Math.ceil(waveCount * CONFIG.landscapeTransitionRatios.first) - 1,
    Math.ceil(waveCount * ratio) - 1
  ];
  var thresholds = [];
  for (var i = 0; i < transitionCount; i++) {
    var minimum = i === 0 ? 0 : thresholds[i - 1] + 1;
    var maximum = waveCount - (transitionCount - i) - 1;
    thresholds.push(Math.max(minimum, Math.min(maximum, desiredThresholds[i])));
  }
  return thresholds;
}

AFRAME.registerComponent('landscape-director', {
  init: function () {
    if (!Array.isArray(CONFIG.landscapes) || CONFIG.landscapes.length === 0) {
      throw new Error('[landscape-director] CONFIG.landscapes must contain the starting landscape.');
    }
    if (CONFIG.landscapes.length > 3) {
      throw new Error('[landscape-director] Progression currently supports up to three landscapes.');
    }
    if (!Number.isInteger(CONFIG.creditsAfterWave) || CONFIG.creditsAfterWave < 1) {
      throw new Error('[landscape-director] CONFIG.creditsAfterWave must be a positive integer.');
    }

    this.currentLandscapeIndex = 0;
    this.fadeOutDuration = 500;
    this.blackHoldDuration = 200;
    this.fadeInDuration = 950;
    this.transitionStartedAt = null;
    this.pendingLandscapeIndex = null;
    this.delayedStart = null;
    this.transitionThresholds = getTransitionThresholds(
      CONFIG.creditsAfterWave,
      CONFIG.landscapes.length
    );
    this.onSceneLoaded = () => this.createFadeOverlay();
    if (this.el.hasLoaded) this.createFadeOverlay();
    else this.el.addEventListener('loaded', this.onSceneLoaded, { once: true });
  },

  landscapeIndexForWave: function (waveIndex) {
    var landscapeIndex = 0;
    for (var i = 0; i < this.transitionThresholds.length; i++) {
      if (waveIndex < this.transitionThresholds[i]) break;
      landscapeIndex++;
    }
    return landscapeIndex;
  },

  isTransitioning: function () {
    return this.delayedStart !== null || this.transitionStartedAt !== null;
  },

  // Called by wave-director before a round starts. Starts the fade to the
  // landscape that round needs (after delayMs) and returns true while a
  // transition is scheduled or running, so the caller waits for
  // 'landscape-changed' before spawning snowmen.
  prepareForWave: function (waveIndex, delayMs) {
    var landscapeIndex = this.landscapeIndexForWave(waveIndex);
    if (this.isTransitioning()) {
      if (this.transitionStartedAt === null || this.pendingLandscapeIndex !== null) {
        this.pendingLandscapeIndex = landscapeIndex;
        this.transitionWaveIndex = waveIndex;
      }
      return true;
    }
    if (landscapeIndex === this.currentLandscapeIndex) return false;

    this.pendingLandscapeIndex = landscapeIndex;
    this.transitionWaveIndex = waveIndex;
    this.delayedStart = setTimeout(() => {
      this.delayedStart = null;
      this.transitionStartedAt = performance.now();
      if (this.fadeOverlay) this.fadeOverlay.visible = true;
    }, delayMs || 0);
    return true;
  },

  createFadeOverlay: function () {
    var camera = this.el.querySelector('[camera]');
    if (!camera) {
      throw new Error('[landscape-director] Expected a camera entity for the fade transition.');
    }
    var THREE = AFRAME.THREE;
    this.fadeMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    this.fadeOverlay = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), this.fadeMaterial);
    this.fadeOverlay.position.z = -1.5;
    this.fadeOverlay.renderOrder = 10000;
    this.fadeOverlay.frustumCulled = false;
    this.fadeOverlay.visible = false;
    camera.object3D.add(this.fadeOverlay);
  },

  tick: function () {
    if (this.transitionStartedAt === null || !this.fadeOverlay) return;
    var elapsed = performance.now() - this.transitionStartedAt;
    if (elapsed < this.fadeOutDuration) {
      this.fadeMaterial.opacity = elapsed / this.fadeOutDuration;
      return;
    }

    this.fadeMaterial.opacity = 1;
    if (this.pendingLandscapeIndex !== null) {
      this.applyLandscape(CONFIG.landscapes[this.pendingLandscapeIndex]);
      this.currentLandscapeIndex = this.pendingLandscapeIndex;
      this.pendingLandscapeIndex = null;
    }

    var fadeInElapsed = elapsed - this.fadeOutDuration;
    if (fadeInElapsed < this.blackHoldDuration) {
      this.fadeMaterial.opacity = 1;
      return;
    }
    fadeInElapsed -= this.blackHoldDuration;
    if (fadeInElapsed < this.fadeInDuration) {
      this.fadeMaterial.opacity = 1 - fadeInElapsed / this.fadeInDuration;
      return;
    }
    this.fadeMaterial.opacity = 0;
    this.fadeOverlay.visible = false;
    this.transitionStartedAt = null;
    this.el.emit('landscape-changed', {
      landscapeIndex: this.currentLandscapeIndex,
      waveIndex: this.transitionWaveIndex
    });
  },

  applyLandscape: function (landscape) {
    var sky = this.el.querySelector('a-sky');
    var ground = this.el.querySelector('a-circle');
    var skyAsset = document.querySelector(landscape.skyAsset);
    var groundAsset = document.querySelector(landscape.groundAsset);
    if (!sky || !ground) {
      throw new Error('[landscape-director] Expected a-sky and a-circle in the scene.');
    }
    if (!skyAsset || !groundAsset) {
      throw new Error('[landscape-director] Landscape image asset is missing: ' +
        landscape.skyAsset + ' or ' + landscape.groundAsset);
    }

    sky.setAttribute('src', landscape.skyAsset);
    sky.setAttribute('rotation', landscape.rotation);
    ground.setAttribute('material', 'src', landscape.groundAsset);
    this.el.setAttribute('fog', landscape.fog);
  },

  remove: function () {
    if (this.delayedStart !== null) clearTimeout(this.delayedStart);
    this.el.removeEventListener('loaded', this.onSceneLoaded);
    if (this.fadeOverlay) {
      this.fadeOverlay.parent.remove(this.fadeOverlay);
      this.fadeOverlay.geometry.dispose();
      this.fadeMaterial.dispose();
    }
  }
});
