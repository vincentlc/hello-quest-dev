// ---------------------------------------------------------------------
// controller-icon: a small canvas-drawn icon of a Touch-style VR
// controller with its trigger highlighted, for the welcome panel
// (welcome-screen.js) -- same "draw it on a canvas, cache the texture"
// approach already used for the crack glow texture
// (snowman-cracks.js's getCrackGlowTexture), reused here for the same
// reason: a few lines of 2D drawing is simpler and cheaper than
// sourcing/loading an actual image asset for one small decorative
// icon. Module-level cached, built once regardless of how many times
// the page re-shows the welcome panel (it never does more than once
// per load today, but costs nothing to make that safe).
// ---------------------------------------------------------------------
var cached = null;

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function getControllerIconTexture() {
  if (cached) return cached;

  var size = 320;
  var canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  var ctx = canvas.getContext('2d');
  var cx = size * 0.5;

  // Tracking ring -- the halo loop above the handle on a real Touch
  // controller, just enough of a silhouette cue to read as "the VR
  // controller" at a glance rather than an abstract shape.
  ctx.strokeStyle = 'rgba(180, 230, 230, 0.9)';
  ctx.lineWidth = size * 0.035;
  ctx.beginPath();
  ctx.arc(cx, size * 0.34, size * 0.26, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();

  // Handle body
  ctx.fillStyle = 'rgba(20, 40, 38, 0.95)';
  roundedRect(ctx, cx - size * 0.1, size * 0.3, size * 0.2, size * 0.5, size * 0.09);
  ctx.fill();

  // Trigger highlight -- a soft glow where the index finger rests,
  // same accent color as the crack glow / wave-hud backing (keeps the
  // palette consistent across every UI element in the demo).
  var glow = ctx.createRadialGradient(cx - size * 0.03, size * 0.47, 2, cx - size * 0.03, size * 0.47, size * 0.16);
  glow.addColorStop(0, 'rgba(125, 249, 255, 0.95)');
  glow.addColorStop(1, 'rgba(125, 249, 255, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.ellipse(cx - size * 0.03, size * 0.47, size * 0.14, size * 0.1, -0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#0B2C2A';
  roundedRect(ctx, cx - size * 0.12, size * 0.42, size * 0.1, size * 0.12, size * 0.03);
  ctx.fill();

  // A curved "squeeze" arrow pointing into the trigger, to suggest the
  // pulling motion rather than just a static highlighted spot.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = size * 0.018;
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.3, size * 0.4);
  ctx.quadraticCurveTo(cx - size * 0.22, size * 0.48, cx - size * 0.15, size * 0.465);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.165, size * 0.425);
  ctx.lineTo(cx - size * 0.145, size * 0.465);
  ctx.lineTo(cx - size * 0.195, size * 0.48);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.fill();

  var texture = new AFRAME.THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  cached = texture;
  return texture;
}
