// ---------------------------------------------------------------------
// mirror-tile: makes a repeated ground texture seamless. A-Frame's
// `repeat` attribute tiles the texture, but plain repeating shows a
// visible seam every tile (the crop's edges don't match up). Mirroring
// every other tile fixes that for free, since a flipped copy of an
// image always lines up with itself at the seam -- no special texture
// needed. Not exposed as a plain HTML attribute, so it's a few lines
// of three.js instead.
// ---------------------------------------------------------------------
AFRAME.registerComponent('mirror-tile', {
  init: function () {
    this.el.addEventListener('materialtextureloaded', () => {
      var map = this.el.getObject3D('mesh').material.map;
      map.wrapS = map.wrapT = AFRAME.THREE.MirroredRepeatWrapping;
      map.needsUpdate = true;
    });
  }
});
