import { CONFIG } from '../config.js';

// ---------------------------------------------------------------------
// crackGlowTexture: a soft cross-section gradient (transparent edges,
// glow color rising toward the middle, bright white-hot at the dead
// center) painted once and shared by every crack ribbon -- mapped
// along each ribbon's width (v: 0 to 1 edge to edge) and repeated
// uniformly along its length (u), it's what actually gives the ribbon
// its shine/glow. The earlier ribbon version used a flat solid color
// instead of this gradient and read as dull/flat by comparison even
// with identical hex colors -- a true soft falloff is what reads as
// "glowing", not just the right hue.
// ---------------------------------------------------------------------
var crackGlowTexture = null;
export function getCrackGlowTexture() {
  if (crackGlowTexture) return crackGlowTexture;
  var hex = CONFIG.colors.crackGlow;
  var r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  var glow = (a) => 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  var h = 128;
  var canvas = document.createElement('canvas');
  canvas.width = 8; canvas.height = h;
  var ctx = canvas.getContext('2d');
  var grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0.00, glow(0));
  grad.addColorStop(0.12, glow(0.25));
  grad.addColorStop(0.32, glow(0.55));
  grad.addColorStop(0.46, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.50, 'rgba(255,255,255,1)');
  grad.addColorStop(0.54, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.68, glow(0.55));
  grad.addColorStop(0.88, glow(0.25));
  grad.addColorStop(1.00, glow(0));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 8, h);
  crackGlowTexture = new AFRAME.THREE.CanvasTexture(canvas);
  crackGlowTexture.wrapS = AFRAME.THREE.ClampToEdgeWrapping;
  crackGlowTexture.wrapT = AFRAME.THREE.ClampToEdgeWrapping;
  return crackGlowTexture;
}

// ---------------------------------------------------------------------
// circleSpriteTexture: a small soft-edged white circle, painted once on
// a canvas and shared by every trajectory-preview instance. WebGL point
// sprites render as plain squares unless given a `map` texture (with
// alphaTest to cut out the corners) -- this is that texture, round
// instead of square.
// ---------------------------------------------------------------------
var circleSpriteTexture = null;
export function getCircleSpriteTexture() {
  if (circleSpriteTexture) return circleSpriteTexture;
  var canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  var ctx = canvas.getContext('2d');
  var gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.7, 'rgba(255,255,255,0.9)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  circleSpriteTexture = new AFRAME.THREE.CanvasTexture(canvas);
  return circleSpriteTexture;
}
