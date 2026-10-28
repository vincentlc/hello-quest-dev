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
//
// Panel/text HEIGHT is derived from content, not guessed independently
// of it -- a real bug found after shipping: a text plane's canvas
// pixel-aspect-ratio has to match its PlaneGeometry's physical
// width/height aspect-ratio, or the texture gets non-uniformly
// stretched (reported: "se ve como aplastado verticalmente" -- a short,
// wide body plane squashing its own text vertically because its canvas
// was authored much taller, proportionally, than the plane it was
// mapped onto). Rather than hand-pick a world-meters height and a
// canvas pixel height separately and hope they stay in proportion,
// both title and body height are computed FROM their font size and a
// line-count budget, using one shared width-derived pixel density
// (pxPerMeter) -- so the canvas and the plane it's painted on are
// aspect-matched by construction, for any width/font-size/line-count
// combination, not just the ones tested so far.
// ---------------------------------------------------------------------
export function buildPanel(parentEl, opts) {
  var w = opts.width;
  var borderColor = opts.borderColor;
  var contentWidth = w - 0.2;
  var pxPerMeter = 1024 / contentWidth; // shared logical (pre-RESOLUTION_SCALE) density

  var titleFontSize = opts.titleFontSize || 104;
  var titleMaxLines = opts.titleMaxLines || 2; // headroom for an unexpectedly long title to wrap without clipping
  var titleCanvasHeight = Math.round(titleFontSize * 1.3 * titleMaxLines + titleFontSize * 0.5);
  var titleHeight = titleCanvasHeight / pxPerMeter;

  // Subtitle is optional (0 lines = not built at all) -- only
  // welcome-screen uses it today (the "Snoworld Copito" tagline under
  // the title), end-screen doesn't pass it and gets no subtitle plane
  // or extra height for one.
  var subtitleFontSize = opts.subtitleFontSize || 34;
  var subtitleMaxLines = opts.subtitleMaxLines || 0;
  var subtitleCanvasHeight = subtitleMaxLines > 0
    ? Math.round(subtitleFontSize * 1.3 * subtitleMaxLines + subtitleFontSize * 0.5) : 0;
  var subtitleHeight = subtitleCanvasHeight / pxPerMeter;
  var subtitleGap = subtitleMaxLines > 0 ? (opts.subtitleGap !== undefined ? opts.subtitleGap : 0.03) : 0;

  var bodyFontSize = opts.bodyFontSize || 56;
  var bodyMaxLines = opts.bodyMaxLines || 6;
  var bodyCanvasHeight = Math.round(bodyFontSize * 1.3 * bodyMaxLines + bodyFontSize * 0.5);
  var bodyHeight = bodyCanvasHeight / pxPerMeter;

  var topMargin = opts.topMargin !== undefined ? opts.topMargin : 0.12;
  var bottomMargin = opts.bottomMargin !== undefined ? opts.bottomMargin : 0.12;
  var titleBodyGap = opts.titleBodyGap !== undefined ? opts.titleBodyGap : 0.05;
  var extraBottom = opts.extraBottom || 0; // reserved space below the body (e.g. welcome's controller icon)

  var h = topMargin + titleHeight + subtitleGap + subtitleHeight + titleBodyGap + bodyHeight + bottomMargin + extraBottom;

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

  var titleY = h / 2 - topMargin - titleHeight / 2;
  var titlePlane = createTextPlane({
    width: contentWidth, height: titleHeight,
    canvasWidth: 1024, canvasHeight: titleCanvasHeight,
    text: '', align: 'center', color: borderColor, fontSize: titleFontSize, bold: true
  });
  titlePlane.mesh.position.set(0, titleY, 0.01);
  titlePlane.mesh.renderOrder = 1;
  panel.object3D.add(titlePlane.mesh);

  var subtitlePlane = null;
  var afterTitleY = titleY - titleHeight / 2;
  if (subtitleMaxLines > 0) {
    var subtitleY = afterTitleY - subtitleGap - subtitleHeight / 2;
    subtitlePlane = createTextPlane({
      width: contentWidth, height: subtitleHeight,
      canvasWidth: 1024, canvasHeight: subtitleCanvasHeight,
      text: '', align: 'center', color: '#CFEFFF', fontSize: subtitleFontSize
    });
    subtitlePlane.mesh.position.set(0, subtitleY, 0.01);
    subtitlePlane.mesh.renderOrder = 1;
    panel.object3D.add(subtitlePlane.mesh);
    afterTitleY = subtitleY - subtitleHeight / 2;
  }

  var bodyY = afterTitleY - titleBodyGap - bodyHeight / 2;
  var bodyPlane = createTextPlane({
    width: contentWidth, height: bodyHeight,
    canvasWidth: 1024, canvasHeight: bodyCanvasHeight,
    text: '', align: 'center', color: '#FFFFFF', fontSize: bodyFontSize
  });
  bodyPlane.mesh.position.set(0, bodyY, 0.01);
  bodyPlane.mesh.renderOrder = 1;
  panel.object3D.add(bodyPlane.mesh);

  parentEl.appendChild(panel);
  return {
    panel: panel,
    border: border,
    backdrop: backdrop,
    height: h,
    bodyBottomY: bodyY - bodyHeight / 2,
    setTitle: function (text) { titlePlane.setText(text); },
    setSubtitle: function (text) { if (subtitlePlane) subtitlePlane.setText(text); },
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
