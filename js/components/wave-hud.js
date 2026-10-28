import { I18N, LANG } from '../i18n.js';
import { createTextPlane } from '../core/canvas-text.js';

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
// normal game.
//
// Step 7 fix: the original position (0.55 -0.35 -1.2) put the panel
// about 25 degrees off-axis -- past the zone each lens renders crisply
// on a Quest 2, so on-device it showed up jammed into the very corner
// of the visible image instead of as a readable corner HUD (reported:
// "can see it in a corner... but not currently visible"). Pulled in to
// ~15-19 degrees off-axis (still clearly peripheral, not dead-center).
//
// Text is a canvas-texture plane (see canvas-text.js), not A-Frame's
// `text` component -- its bundled font turned out to have zero
// accented glyphs, and while today's "Oleada"/"Puntos" strings happen
// not to need any, this project's Spanish copy elsewhere does, and the
// canvas approach also lets the dark backing card be baked into the
// same texture (one mesh, no separate a-plane layered behind it).
//
// No tick() here either, same reasoning as wave-director: this only
// needs to change when wave-director's own 'wave-state-changed' event
// says something actually changed, never on a per-frame basis.
// ---------------------------------------------------------------------
AFRAME.registerComponent('wave-hud', {
  init: function () {
    this.panel = document.createElement('a-entity');
    this.panel.setAttribute('position', '0.3 -0.22 -1.1');
    this.el.appendChild(this.panel);

    this.card = createTextPlane({
      width: 0.46, height: 0.2,
      canvasWidth: 512, canvasHeight: 224,
      text: '', align: 'left', color: '#FFFFFF', fontSize: 52, paddingX: 26,
      background: 'rgba(6, 32, 30, 0.6)', backgroundRadius: 28
    });
    this.panel.object3D.add(this.card.mesh);

    var attach = () => {
      this.el.sceneEl.addEventListener('wave-state-changed', (evt) => this.updateText(evt.detail));
    };
    if (this.el.sceneEl.hasLoaded) attach();
    else this.el.sceneEl.addEventListener('loaded', attach);
  },

  updateText: function (detail) {
    var lang = I18N[LANG];
    this.card.setText(
      lang.wave + ' ' + (detail.waveIndex + 1) + '\n' + lang.score + ': ' + Math.round(detail.score));
  }
});
