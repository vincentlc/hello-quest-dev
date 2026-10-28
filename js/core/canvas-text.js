// ---------------------------------------------------------------------
// canvas-text: draws text directly onto a canvas texture, applied to a
// plane mesh, instead of using A-Frame's `text` component's default
// MSDF font ("roboto", bundled with A-Frame). Needed because that font
// has zero accented/special glyphs -- confirmed in-browser by reading
// its loaded character list: á, é, í, ó, ú, ñ, ¡ and ¿ are all simply
// missing, so they silently vanish from any rendered text ("Puntuación"
// rendered as "Puntuacin", etc). This project's Spanish-first copy
// (I18N's `es` block, the default language) depends on exactly those
// characters. A canvas 2D context draws with the real system font
// stack via fillText, which has full Unicode coverage, so this
// sidesteps the MSDF glyph atlas entirely rather than trying to
// find/vendor a bigger one -- the fallback step 7 was scoped to use
// (see PROGRESS.md).
// ---------------------------------------------------------------------
function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// RESOLUTION_SCALE: every text/icon canvas in this file is rendered at
// this multiple of its "logical" pixel size (callers keep passing the
// same canvasWidth/canvasHeight/fontSize/paddingX numbers as before --
// scaling happens internally). Found needed after shipping: at 1x, a
// close-up/zoomed look at the panel on a real display showed visibly
// blocky/pixelated glyph edges -- the canvas's own texel density was
// the limit, not blur from magnification filtering. Backing the same
// displayed (world-meters) size with ~4x the pixel area via this scale
// fixes that; three.js's default LinearFilter still smooths between
// those now-finer texels instead of a human seeing individual ones.
var RESOLUTION_SCALE = 2;

// opts: { width, height (world meters), canvasWidth, canvasHeight,
// text, align, color, fontSize, bold, background, backgroundRadius,
// paddingX, startY, autoSizeHeight, autoSizeAnchorTop }.
// canvasWidth/canvasHeight/fontSize/paddingX/startY
// are "logical" pixels -- RESOLUTION_SCALE is applied internally, so
// existing call sites don't need to change. Returns { mesh,
// setText(text, overrideOpts) }.
export function createTextPlane(opts) {
  var THREE = AFRAME.THREE;
  var baseOpts = opts;
  var canvas = document.createElement('canvas');
  canvas.width = (opts.canvasWidth || 1024) * RESOLUTION_SCALE;
  canvas.height = (opts.canvasHeight || 512) * RESOLUTION_SCALE;
  var ctx = canvas.getContext('2d');

  var texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  texture.anisotropy = 8; // sharper at the oblique angles a world-space panel is often viewed from

  var mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(opts.width, opts.height),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false })
  );

  function setText(text, overrideOpts) {
    var o = Object.assign({}, baseOpts, overrideOpts || {});
    var canvasResized = false;

    var fontSize = (o.fontSize || Math.round(canvas.height * 0.14 / RESOLUTION_SCALE)) * RESOLUTION_SCALE;
    var lineHeight = fontSize * 1.3;
    var align = o.align || 'center';
    var color = o.color || '#FFFFFF';
    var weight = o.bold ? 'bold ' : '';
    var paddingX = (o.paddingX !== undefined ? o.paddingX : 20) * RESOLUTION_SCALE;

    ctx.font = weight + fontSize + 'px "Trebuchet MS", "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = color;
    ctx.textBaseline = 'middle';
    ctx.textAlign = align;
    // Soft drop shadow -- the panel sits over a busy, bright snow/sky
    // background, and flat white text on a semi-transparent backdrop
    // read as faint/hard to read once actually tested (reported:
    // "no se lee muy bien el texto"). A dark shadow behind each glyph
    // gives it a crisp edge regardless of what's behind the panel.
    if (o.shadow !== false) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
      ctx.shadowBlur = fontSize * 0.08;
      ctx.shadowOffsetY = fontSize * 0.04;
    }

    // Word-wrap: explicit '\n's are kept as hard breaks (used for
    // blank-line spacing between sections, e.g. the end-screen's
    // score/credit/restart blocks), but any single line too wide for
    // the canvas gets soft-wrapped at word boundaries too -- found
    // this was needed when the Spanish VR instruction sentence
    // ("¡Apunta y aprieta...") rendered at 1001px of a 1024px canvas,
    // leaving only ~11px of margin: technically fit today, but too
    // fragile against any font-metric difference on a real device.
    var maxWidth = canvas.width - paddingX * 2;
    var lines = [];
    (text || '').split('\n').forEach(function (raw) {
      if (raw === '') { lines.push(''); return; }
      var words = raw.split(' ');
      var current = '';
      words.forEach(function (word) {
        var test = current ? current + ' ' + word : word;
        if (current && ctx.measureText(test).width > maxWidth) {
          lines.push(current);
          current = word;
        } else {
          current = test;
        }
      });
      if (current) lines.push(current);
    });

    if (o.autoSizeHeight) {
      var baseCanvasHeight = (baseOpts.canvasHeight || 512) * RESOLUTION_SCALE;
      var minHeight = baseCanvasHeight;
      var textHeight = (lines.length - 1) * lineHeight +
        (o.fontSize || Math.round(baseCanvasHeight * 0.14 / RESOLUTION_SCALE)) *
        RESOLUTION_SCALE * 2.5;
      var newCanvasHeight = Math.max(minHeight, Math.ceil(textHeight));
      if (newCanvasHeight !== canvas.height) {
        var oldGeometryHeight = mesh.geometry.parameters.height;
        canvas.height = newCanvasHeight;
        canvasResized = true;
        var newGeometryHeight = (o.height || baseOpts.height) * newCanvasHeight / baseCanvasHeight;
        mesh.geometry.dispose();
        mesh.geometry = new THREE.PlaneGeometry(o.width || baseOpts.width, newGeometryHeight);
        if (o.autoSizeAnchorTop) {
          mesh.position.y -= (newGeometryHeight - oldGeometryHeight) / 2;
        }
      }
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = weight + fontSize + 'px "Trebuchet MS", "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = color;
    ctx.textBaseline = 'middle';
    ctx.textAlign = align;

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    if (o.background) {
      ctx.fillStyle = o.background;
      roundRectPath(ctx, 0, 0, canvas.width, canvas.height, (o.backgroundRadius || 0) * RESOLUTION_SCALE);
      ctx.fill();
    }

    ctx.fillStyle = color;
    if (o.shadow !== false) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
      ctx.shadowBlur = fontSize * 0.08;
      ctx.shadowOffsetY = fontSize * 0.04;
    }

    var x = align === 'center' ? canvas.width / 2
      : (align === 'right' ? canvas.width - paddingX : paddingX);
    var startY = o.startY !== undefined ? o.startY * RESOLUTION_SCALE
      : canvas.height / 2 - (lines.length - 1) * lineHeight / 2;

    lines.forEach(function (line, i) {
      ctx.fillText(line, x, startY + i * lineHeight);
    });

    if (canvasResized) {
      var previousTexture = texture;
      texture = new THREE.CanvasTexture(canvas);
      texture.anisotropy = 8;
      mesh.material.map = texture;
      mesh.material.needsUpdate = true;
      previousTexture.dispose();
    }
    texture.needsUpdate = true;
  }

  if (opts.text !== undefined) setText(opts.text);

  return { mesh: mesh, setText: setText };
}
