// ---------------------------------------------------------------------
// controller-aim: two jobs, both about the raycaster meta-touch-controls
// auto-attaches to the hand entity as soon as a controller connects
// (confirmed by grepping vendor/aframe.min.js -- its internal per-vendor
// mapping merges `{showLine: true}` as the default).
//
// 1. Hide its line. The dotted trajectory arc is the only aim visual
//    this demo wants (it shows the real gravity drop, a straight laser
//    doesn't, and the original spec's own note says to keep
//    hello_quest's laser hidden since it fights with the arc), so this
//    flips the auto-added line back off every time the library turns
//    it on.
// 2. Capture the controller's real pointing direction. `tracked-controls`
//    drives the hand entity's own object3D from the WebXR *grip* pose
//    (grepped vendor/aframe.min.js: its tick() calls
//    `frame.getPose(controller.gripSpace, ...)`), whose forward axis
//    points straight down the handle -- not out through the buttons the
//    way a laser pointer / remote naturally points. The correct
//    local-space offset for that (`rayOrigin: {origin, direction}`) is
//    emitted separately, per connected controller model, on the
//    `controllermodelready` event (same vendor source: meta-touch-
//    controls computes it from the WebXR "target ray" pose and emits it
//    once its model has loaded) -- it's the same data laser-controls
//    itself forwards into a raycaster, grabbed here directly so we don't
//    have to pull in laser-controls' cursor/model-swap baggage just for
//    this one number. snowball-thrower and trajectory-preview call
//    getAimRay() instead of reading object3D's forward axis directly.
// ---------------------------------------------------------------------
AFRAME.registerComponent('controller-aim', {
  init: function () {
    var THREE = AFRAME.THREE;
    var hide = () => this.el.setAttribute('raycaster', 'showLine', false);
    this.el.addEventListener('controllerconnected', hide);
    this.el.addEventListener('controllermodelready', (evt) => {
      hide();
      var rayOrigin = evt.detail && evt.detail.rayOrigin;
      if (!rayOrigin) return;
      this.rayOrigin = {
        origin: new THREE.Vector3().copy(rayOrigin.origin),
        direction: new THREE.Vector3().copy(rayOrigin.direction).normalize()
      };
    });
  },

  // Writes the world-space aim origin/direction into the given
  // THREE.Vector3 outputs. Uses the controller's real pointing offset
  // once known (after its model has loaded); falls back to the
  // entity's own forward axis before that (e.g. the brief window right
  // after connecting).
  getAimRay: function (originOut, dirOut) {
    if (this.rayOrigin) {
      this.el.object3D.updateMatrixWorld();
      originOut.copy(this.rayOrigin.origin);
      this.el.object3D.localToWorld(originOut);
      dirOut.copy(this.rayOrigin.direction).transformDirection(this.el.object3D.matrixWorld).normalize();
    } else {
      this.el.object3D.getWorldPosition(originOut);
      this.el.object3D.getWorldDirection(dirOut);
    }
  }
});
