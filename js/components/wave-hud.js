import { I18N, LANG } from '../i18n.js';
import { createTextPlane } from '../core/canvas-text.js';

// ---------------------------------------------------------------------
// wave-hud: a minimal, head-locked HUD -- a small wave/score/bonus text
// panel, so there's *some* answer to "where's the level/score" in VR
// (a 2D page overlay like #credit isn't visible inside the headset).
// Goes on the camera entity: as its child, the text panel inherits the
// camera's transform every frame for free, no per-frame positioning
// code needed, the same way trajectory-preview's hand dots inherit
// their source entity's transform.
//
// Deliberately placed near the upper edge, not dead-center in view: a
// panel locked to the exact center of a VR headset's view is the
// classic "head-locked UI" discomfort case (no parallax, feels pasted
// onto your eyeballs rather than part of the world). This also keeps it
// clear of the snowmen's hats and painted hit-count numbers.
//
// Step 7 fix: the original position (0.55 -0.35 -1.2) put the panel
// about 25 degrees off-axis -- past the zone each lens renders crisply
// on a Quest 2. It was pulled in to ~15-19 degrees; this upper-center
// placement preserves that readable angle without covering snowmen.
//
// Text is a canvas-texture plane (see canvas-text.js), not A-Frame's
// `text` component -- its bundled font turned out to have zero
// accented glyphs, and while today's "Ronda"/"Puntos" strings happen
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
    this.panel.setAttribute('position', '0 0.38 -1.3');
    this.el.appendChild(this.panel);

    this.baseText = '';
    this.announcementTimeout = null;
    this.card = createTextPlane({
      width: 0.46, height: 0.2,
      canvasWidth: 512, canvasHeight: 224,
      text: '', align: 'left', color: '#FFFFFF', fontSize: 52, paddingX: 26,
      background: 'rgba(6, 32, 30, 0.6)', backgroundRadius: 28,
      autoSizeHeight: true, autoSizeAnchorTop: true
    });
    this.panel.object3D.add(this.card.mesh);
    // Mute hint sits just above the card (whose top edge stays at
    // y = +0.1, see autoSizeAnchorTop), so the card can grow downward
    // with announcements without covering it. Text is ~3.2 cm tall in
    // world space (original was ~1.4 cm), about 70% of the card text.
    // Canvas and plane share the same aspect ratio (1024/112 = 0.64/0.07).
    this.soundHint = createTextPlane({
      width: 0.64, height: 0.07,
      canvasWidth: 1024, canvasHeight: 112,
      text: '', align: 'center', color: '#E2FBF4', fontSize: 52,
      background: 'rgba(6, 32, 30, 0.55)', backgroundRadius: 24
    });
    this.soundHint.mesh.position.y = 0.1 + 0.012 + 0.07 / 2;
    this.soundHint.mesh.material.opacity = 0.9;
    this.panel.object3D.add(this.soundHint.mesh);

    var attach = () => {
      this.onWaveStateChanged = (evt) => this.updateText(evt.detail);
      this.onSoundStateChanged = (evt) => this.updateSoundHint(evt.detail.enabled);
      this.el.sceneEl.addEventListener('wave-state-changed', this.onWaveStateChanged);
      this.el.sceneEl.addEventListener('sound-state-changed', this.onSoundStateChanged);
      var soundManager = this.el.sceneEl.components['sound-manager'];
      if (soundManager) this.updateSoundHint(soundManager.soundEnabled);
    };
    if (this.el.sceneEl.hasLoaded) attach();
    else this.el.sceneEl.addEventListener('loaded', attach);
  },

  updateSoundHint: function (enabled) {
    var lang = I18N[LANG];
    this.soundHint.setText(enabled ? lang.muteSoundHint : lang.unmuteSoundHint);
  },

  updateText: function (detail) {
    var lang = I18N[LANG];
    this.baseText = lang.wave + ' ' + (detail.waveIndex + 1) + '/' + detail.totalRounds +
      '\n' + lang.score + ': ' + Math.round(detail.score);
    if (this.announcementTimeout !== null) {
      clearTimeout(this.announcementTimeout);
      this.announcementTimeout = null;
    }

    if (!detail.announcement) {
      this.card.setText(this.baseText);
      return;
    }

    this.card.setText(this.baseText + '\n' + detail.announcement.replace(/ \| /g, '\n'));
    this.announcementTimeout = setTimeout(() => {
      this.announcementTimeout = null;
      this.card.setText(this.baseText);
    }, 5000);
  },

  remove: function () {
    if (this.onWaveStateChanged) {
      this.el.sceneEl.removeEventListener('wave-state-changed', this.onWaveStateChanged);
      this.el.sceneEl.removeEventListener('sound-state-changed', this.onSoundStateChanged);
    }
    if (this.announcementTimeout !== null) clearTimeout(this.announcementTimeout);
    this.card.mesh.geometry.dispose();
    this.card.mesh.material.map.dispose();
    this.card.mesh.material.dispose();
    this.soundHint.mesh.geometry.dispose();
    this.soundHint.mesh.material.map.dispose();
    this.soundHint.mesh.material.dispose();
  }
});
