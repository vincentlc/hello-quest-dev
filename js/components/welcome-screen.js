import { CONFIG } from '../config.js';
import { I18N, LANG } from '../i18n.js';
import { buildPanel, placeFacingCamera } from '../core/vr-panel.js';
import { getControllerIconTexture } from '../core/controller-icon.js';

// ---------------------------------------------------------------------
// welcome-screen (step 7, new): lives on <a-scene>. Shows a one-shot
// in-VR intro panel right after load -- explains what to do (aim and
// pull the trigger in VR, click on desktop) with a small controller
// icon highlighting the trigger, since a brand-new player dropped into
// a snowy field with no UI otherwise has no way to know that. Dismissed
// after three throws (snowball-thrower emits 'snowball-thrown' on every
// spawn(), see that file). The count remains visible until then, so an
// accidental first shot cannot dismiss the instructions.
//
// Text swaps live between the VR and desktop phrasing if the player
// enters/exits VR while the panel is still up: entering VR needs its
// own user gesture, so vr-mode is usually still false at the instant
// this panel first shows, even on a headset that's about to be used.
// ---------------------------------------------------------------------
AFRAME.registerComponent('welcome-screen', {
  init: function () {
    this.active = false;
    this.dismissed = false;
    this.shotsThrown = 0;

    var iconSize = 0.4;
    var iconGap = 0.12;
    this.built = buildPanel(this.el, {
      width: CONFIG.welcomePanelWidth,
      borderColor: CONFIG.colors.crownCyan,
      subtitleMaxLines: 3, // the "Snoworld Copito" tagline, may wrap a couple times
      bodyMaxLines: 2, // instruction and shot count
      extraBottom: iconGap + iconSize + 0.08 // reserve room below the body for the controller icon
    });
    this.panel = this.built.panel;

    var THREE = AFRAME.THREE;
    this.icon = new THREE.Mesh(
      new THREE.PlaneGeometry(iconSize, iconSize),
      new THREE.MeshBasicMaterial({ map: getControllerIconTexture(), transparent: true, depthWrite: false })
    );
    this.icon.position.set(0, this.built.bodyBottomY - iconGap - iconSize / 2, 0.02);
    this.icon.renderOrder = 1; // draw after the backdrop -- see vr-panel.js's renderOrder note
    this.panel.object3D.add(this.icon);

    this.el.addEventListener('enter-vr', () => this.refreshText());
    this.el.addEventListener('exit-vr', () => this.refreshText());
    this.el.addEventListener('snowball-thrown', () => this.onSnowballThrown());

    var attach = () => setTimeout(() => this.show(), 300);
    if (this.el.hasLoaded) attach();
    else this.el.addEventListener('loaded', attach);
  },

  show: function () {
    var camera = this.el.camera;
    if (!camera) return;
    placeFacingCamera(this.panel, camera, CONFIG.welcomePanelDistance, -0.05);
    this.refreshText();
    this.panel.setAttribute('visible', true);
    this.active = true;
  },

  refreshText: function () {
    var lang = I18N[LANG];
    this.built.setTitle(lang.welcomeTitle);
    this.built.setSubtitle(lang.welcomeSubtitle);
    this.built.setBody(
      (this.el.is('vr-mode') ? lang.instructionVR : lang.instructionDesktop) + '\n' +
      lang.shotsProgress + ': ' + this.shotsThrown + '/' + CONFIG.welcomeShotsToStart
    );
  },

  onSnowballThrown: function () {
    if (!this.active || this.dismissed) return;
    this.shotsThrown++;
    if (this.shotsThrown >= CONFIG.welcomeShotsToStart) {
      this.dismiss();
      this.el.emit('start-game');
      return;
    }
    this.refreshText();
  },

  dismiss: function () {
    if (this.dismissed) return;
    this.dismissed = true;
    this.active = false;
    this.panel.setAttribute('visible', false);
  },

  tick: function (time) {
    if (!this.active) return;
    this.icon.material.opacity = 0.75 + 0.25 * Math.sin(time / 300);
  }
});
