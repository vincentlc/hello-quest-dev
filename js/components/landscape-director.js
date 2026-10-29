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
    this.transitionThresholds = getTransitionThresholds(
      CONFIG.creditsAfterWave,
      CONFIG.landscapes.length
    );
    this.onWaveStateChanged = (evt) => this.updateLandscape(evt.detail.waveIndex);
    this.el.addEventListener('wave-state-changed', this.onWaveStateChanged);
  },

  updateLandscape: function (waveIndex) {
    var landscapeIndex = 0;
    for (var i = 0; i < this.transitionThresholds.length; i++) {
      if (waveIndex < this.transitionThresholds[i]) break;
      landscapeIndex++;
    }
    if (landscapeIndex === this.currentLandscapeIndex) return;

    this.applyLandscape(CONFIG.landscapes[landscapeIndex]);
    this.currentLandscapeIndex = landscapeIndex;
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
    this.el.removeEventListener('wave-state-changed', this.onWaveStateChanged);
  }
});
