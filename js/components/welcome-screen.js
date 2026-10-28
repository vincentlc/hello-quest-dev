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
// by the player's own first throw (snowball-thrower emits
// 'snowball-thrown' on every spawn(), see that file) -- a natural "do
// the thing to continue" affordance -- or after
// CONFIG.welcomeAutoHideSeconds if they never throw, so it never
// lingers forever.
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

    this.built = buildPanel(this.el, {
      width: CONFIG.welcomePanelWidth,
      height: CONFIG.welcomePanelHeight,
      borderColor: CONFIG.colors.crownCyan,
      bodyY: 0.06,
      bodyHeight: 0.3
    });
    this.panel = this.built.panel;

    var THREE = AFRAME.THREE;
    this.icon = new THREE.Mesh(
      new THREE.PlaneGeometry(0.3, 0.3),
      new THREE.MeshBasicMaterial({ map: getControllerIconTexture(), transparent: true, depthWrite: false })
    );
    this.icon.position.set(0, -CONFIG.welcomePanelHeight / 2 + 0.17, 0.02);
    this.icon.renderOrder = 1; // draw after the backdrop -- see vr-panel.js's renderOrder note
    this.panel.object3D.add(this.icon);

    this.el.addEventListener('enter-vr', () => this.refreshText());
    this.el.addEventListener('exit-vr', () => this.refreshText());
    this.el.addEventListener('snowball-thrown', () => this.dismiss());

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
    this.shownAt = performance.now();
  },

  refreshText: function () {
    var lang = I18N[LANG];
    this.built.setTitle(lang.welcomeTitle);
    this.built.setBody(this.el.is('vr-mode') ? lang.instructionVR : lang.instructionDesktop);
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
    if ((time - this.shownAt) / 1000 > CONFIG.welcomeAutoHideSeconds) this.dismiss();
  }
});
