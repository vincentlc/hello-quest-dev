import { I18N, LANG } from '../i18n.js';

// ---------------------------------------------------------------------
// wave-hud: a minimal, head-locked HUD -- a small wave/score text
// panel, so there's *some* answer to "where's the level/score" in VR
// (a 2D page overlay like #credit isn't visible inside the headset).
// Goes on the camera entity: as its child, the text panel inherits the
// camera's transform every frame for free, no per-frame positioning
// code needed, the same way trajectory-preview's hand dots inherit
// their source entity's transform.
//
// Deliberately placed low and off-center (see the position below), not
// dead-center in view: a panel locked to the exact center of a VR
// headset's view is the classic "head-locked UI" discomfort case (no
// parallax, feels pasted onto your eyeballs rather than part of the
// world) -- peripheral placement reads more like a corner HUD in a
// normal game. This is intentionally the *small* version per the
// user's ask; step 7 owns the full HUD (i18n-complete, accent-glyph
// checked, multi-language) this will likely be folded into or replaced
// by.
//
// No tick() here either, same reasoning as wave-director: this only
// needs to change when wave-director's own 'wave-state-changed' event
// says something actually changed, never on a per-frame basis.
// ---------------------------------------------------------------------
AFRAME.registerComponent('wave-hud', {
  init: function () {
    this.panel = document.createElement('a-entity');
    this.panel.setAttribute('position', '0.55 -0.35 -1.2');
    this.panel.setAttribute('text', {
      value: '',
      align: 'right',
      width: 1.4,
      color: '#FFFFFF',
      baseline: 'top'
    });
    this.el.appendChild(this.panel);

    var attach = () => {
      this.el.sceneEl.addEventListener('wave-state-changed', (evt) => this.updateText(evt.detail));
    };
    if (this.el.sceneEl.hasLoaded) attach();
    else this.el.sceneEl.addEventListener('loaded', attach);
  },

  updateText: function (detail) {
    var lang = I18N[LANG];
    this.panel.setAttribute('text', 'value',
      lang.wave + ' ' + (detail.waveIndex + 1) + '\n' + lang.score + ': ' + Math.round(detail.score));
  }
});
