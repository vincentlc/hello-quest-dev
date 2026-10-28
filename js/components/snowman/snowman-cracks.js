import { CONFIG } from '../../config.js';
import { CRACK_SLOTS, getCrackSlotsForLives } from '../../data/crack-slots.js';
import { getCrackGlowTexture } from '../../core/textures.js';

// ---------------------------------------------------------------------
// snowman-cracks: builds and toggles the per-hit crack ribbon decals.
// Merged into the `copito` component by snowman-component.js -- see
// snowman-core.js for the overall split.
// ---------------------------------------------------------------------
export default {
  // One decal per active slot for this snowman's type
  // (getCrackSlotsForLives(this.hitsToExplode)), built once hidden
  // and just toggled visible as hitCount climbs / on reset, rather
  // than created and torn down each time. Each is a single THREE.Mesh
  // (a UV-mapped glow ribbon, see buildCrackRibbonMesh) added directly
  // to `this.model.object3D` -- a raw three.js object, not an a-frame
  // entity, since the geometry is custom-built per crack rather than
  // a plain primitive. Parented inside the model (not `this.el`) so
  // they move with every body animation, same reasoning as the
  // original flat-decal version: see worldToModelLocal's comment.
  buildCrackDecals: function () {
    this.activeCrackSlots = getCrackSlotsForLives(this.hitsToExplode);
    this.crackDecals = this.activeCrackSlots.map((slotKey) => this.buildCrackDecal(slotKey));
  },

  buildCrackDecal: function (slotKey) {
    var THREE = AFRAME.THREE;
    var slot = CRACK_SLOTS[slotKey];
    var isUpper = slot.group === 'upper';
    var centerCfg = isUpper ? CONFIG.crackUpperCenter : CONFIG.crackTorsoCenter;
    var radius = isUpper ? CONFIG.crackUpperRadius : CONFIG.crackTorsoRadius;
    var center = new THREE.Vector3(
      centerCfg.x * this.sizeScale,
      centerCfg.y * this.sizeScale,
      centerCfg.z * this.sizeScale
    );
    radius *= this.sizeScale;

    // Points + outward surface normals along an arc on an idealized
    // sphere (el-local meters) -- see CONFIG.crackTorsoCenter's
    // comment for why a sphere instead of the real mesh surface.
    var slotRad = THREE.MathUtils.degToRad(slot.angle);
    var curve = [];
    for (var i = 0; i < CONFIG.crackSamples; i++) {
      var t = i / (CONFIG.crackSamples - 1);
      var theta = THREE.MathUtils.degToRad(-slot.sweep / 2 + t * slot.sweep);
      var dir = new THREE.Vector3(0, 0, 1);
      dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), theta);
      dir.applyAxisAngle(new THREE.Vector3(0, 0, 1), slotRad);
      dir.normalize();
      curve.push({ point: center.clone().addScaledVector(dir, radius), normal: dir });
    }

    var mesh = this.buildCrackRibbonMesh(curve, CONFIG.crackWidth * this.sizeScale);
    mesh.visible = false;
    this.model.object3D.add(mesh);
    return mesh;
  },

  // One ribbon (ladder of quads following `curve`, crackWidth wide)
  // with a UV-mapped gradient glow texture (getCrackGlowTexture) and
  // additive blending -- this is what gives the crack its shine: a
  // true soft falloff (transparent edges -> glow color -> white-hot
  // center) reads as "glowing" in a way a flat solid-color translucent
  // mesh never does, even with the identical hex color. The
  // cross-section direction at each point uses that sample's own
  // outward normal, not a single fixed "up" vector -- a fixed axis
  // flips sign as the curve sweeps around the body and pinches the
  // ribbon into a bowtie; the normal varies smoothly with the curve
  // instead. Vertices are converted to the model's raw/pre-scale local
  // space (worldToModelLocal) so the mesh can be parented directly
  // inside `this.model.object3D`.
  buildCrackRibbonMesh: function (curve, width) {
    var THREE = AFRAME.THREE;
    var positions = [];
    var uvs = [];
    for (var i = 0; i < curve.length; i++) {
      var tangent = (i < curve.length - 1 ? curve[i + 1].point : curve[i].point).clone()
        .sub(i < curve.length - 1 ? curve[i].point : curve[i - 1].point).normalize();
      var side = new THREE.Vector3().crossVectors(tangent, curve[i].normal).normalize().multiplyScalar(width / 2);
      var edgeA = this.worldToModelLocal(curve[i].point.clone().add(side));
      var edgeB = this.worldToModelLocal(curve[i].point.clone().sub(side));
      positions.push(edgeA.x, edgeA.y, edgeA.z, edgeB.x, edgeB.y, edgeB.z);
      var u = i / (curve.length - 1);
      uvs.push(u, 0, u, 1);
    }
    var indices = [];
    for (var i = 0; i < curve.length - 1; i++) {
      var p = i * 2, q = i * 2 + 1, r = i * 2 + 2, s = i * 2 + 3;
      indices.push(p, q, r, q, s, r);
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    var mat = new THREE.MeshBasicMaterial({
      map: getCrackGlowTexture(), side: THREE.DoubleSide,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
    return new THREE.Mesh(geo, mat);
  },

  showCrackDecal: function (index) {
    this.crackDecals[index].visible = true;
  },

  hideCrackDecals: function () {
    this.crackDecals.forEach((d) => { d.visible = false; });
  }
};
