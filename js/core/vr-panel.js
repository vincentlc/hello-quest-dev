import { createTextPlane } from './canvas-text.js';

// ---------------------------------------------------------------------
// vr-panel: shared builder for the small bordered world-space text
// cards used by both the intro (welcome-screen.js) and outro
// (end-screen.js) panels -- same framed-card look (teal border + dark
// backdrop + title/body text), just different content and triggers.
// Pulled into its own file once a second screen needed the exact same
// construction as the first, instead of duplicating it.
//
// Title/body are canvas-text planes (see canvas-text.js), not
// A-Frame's `text` component -- its bundled font is missing every
// accented glyph this project's Spanish copy needs (confirmed
// in-browser), so the border/backdrop stay plain a-plane entities but
// all actual text goes through the canvas fallback.
//
// renderOrder on the text planes (below) isn't decorative: A-Frame's
// material component leaves depthWrite at its three.js default (true)
// even on a semi-transparent plane, and whichever of backdrop/text
// three.js happens to draw second (same default renderOrder of 0 on
// both, so draw order fell out of DOM/scene-graph attach timing, not
// depth) paints over the other. Confirmed in-browser: without this,
// the backdrop silently drew after the text and nearly fully occluded
// it (titles rendered as a blank card) despite the text's pixels being
// correctly drawn into its own canvas the whole time. Explicit
// renderOrder forces text after backdrop/border regardless of attach
// timing.
// ---------------------------------------------------------------------
export function buildPanel(parentEl, opts) {
  var w = opts.width;
  var h = opts.height;
  var borderColor = opts.borderColor;

  var panel = document.createElement('a-entity');
  panel.setAttribute('visible', false);

  var border = document.createElement('a-plane');
  border.setAttribute('width', w + 0.05);
  border.setAttribute('height', h + 0.05);
  border.setAttribute('position', '0 0 -0.01');
  border.setAttribute('material', 'color: ' + borderColor + '; opacity: 0.85; shader: flat; side: double; fog: false');
  panel.appendChild(border);

  var backdrop = document.createElement('a-plane');
  backdrop.setAttribute('width', w);
  backdrop.setAttribute('height', h);
  backdrop.setAttribute('material', 'color: #06201E; opacity: 0.88; shader: flat; side: double; fog: false');
  panel.appendChild(backdrop);

  var titlePlane = createTextPlane({
    width: w - 0.2, height: 0.26,
    canvasWidth: 1024, canvasHeight: 256,
    text: '', align: 'center', color: borderColor, fontSize: 76, bold: true
  });
  titlePlane.mesh.position.set(0, h / 2 - 0.16, 0.01);
  titlePlane.mesh.renderOrder = 1;
  panel.object3D.add(titlePlane.mesh);

  var bodyHeight = opts.bodyHeight !== undefined ? opts.bodyHeight : h - 0.42;
  var bodyPlane = createTextPlane({
    width: w - 0.2, height: bodyHeight,
    canvasWidth: 1024, canvasHeight: 640,
    text: '', align: 'center', color: '#FFFFFF', fontSize: 42
  });
  bodyPlane.mesh.position.set(0, opts.bodyY !== undefined ? opts.bodyY : -0.02, 0.01);
  bodyPlane.mesh.renderOrder = 1;
  panel.object3D.add(bodyPlane.mesh);

  parentEl.appendChild(panel);
  return {
    panel: panel,
    border: border,
    backdrop: backdrop,
    setTitle: function (text) { titlePlane.setText(text); },
    setBody: function (text) { bodyPlane.setText(text); }
  };
}

// Places `panelEl` at `distance` meters in front of the camera's
// current horizontal facing, roughly at eye height (+ yOffset), and
// yaws it -- a one-shot placement, not a per-frame follow -- to face
// back toward the camera (same atan2(dx, dz) convention
// copito.updateFacing() uses). Shared by welcome-screen (shown at
// load) and end-screen (shown at game-complete) so a panel always
// reads like a sign placed in the world at that moment, not UI glued
// to the headset. Returns the placed world position (callers that
// also spawn effects there, like end-screen's particle burst, reuse
// it instead of re-deriving it).
export function placeFacingCamera(panelEl, camera, distance, yOffset) {
  var THREE = AFRAME.THREE;
  var camPos = new THREE.Vector3();
  var camDir = new THREE.Vector3();
  camera.getWorldPosition(camPos);
  camera.getWorldDirection(camDir);
  camDir.y = 0;
  if (camDir.lengthSq() < 0.0001) camDir.set(0, 0, -1);
  camDir.normalize();

  var panelPos = camPos.clone().addScaledVector(camDir, distance);
  panelPos.y = camPos.y + (yOffset || 0);

  panelEl.object3D.position.copy(panelPos);
  var dx = camPos.x - panelPos.x;
  var dz = camPos.z - panelPos.z;
  panelEl.object3D.rotation.y = Math.atan2(dx, dz);

  return panelPos;
}
