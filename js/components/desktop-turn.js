import { CONFIG } from '../config.js';

var TURN_DIRECTIONS = {
  ArrowLeft: 1,
  KeyA: 1,
  ArrowRight: -1,
  KeyD: -1
};

AFRAME.registerComponent('desktop-turn', {
  init: function () {
    this.keys = {};
    this.onKeyDown = (evt) => {
      if (!TURN_DIRECTIONS[evt.code]) return;
      this.keys[evt.code] = true;
      evt.preventDefault();
    };
    this.onKeyUp = (evt) => {
      if (!TURN_DIRECTIONS[evt.code]) return;
      delete this.keys[evt.code];
      evt.preventDefault();
    };
    this.onWindowBlur = () => {
      this.keys = {};
    };

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onWindowBlur);
  },

  remove: function () {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onWindowBlur);
  },

  tick: function (time, delta) {
    if (this.el.sceneEl.is('vr-mode')) {
      this.keys = {};
      return;
    }

    var left = this.keys.ArrowLeft || this.keys.KeyA ? 1 : 0;
    var right = this.keys.ArrowRight || this.keys.KeyD ? 1 : 0;
    var direction = left - right;
    if (!direction) return;

    var lookControls = this.el.components['look-controls'];
    lookControls.yawObject.rotation.y += direction *
      CONFIG.desktopTurnSpeedDegPerSec * delta / 1000 * (Math.PI / 180);
  }
});
