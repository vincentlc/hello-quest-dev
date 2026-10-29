import { I18N, LANG } from '../i18n.js';
import { createTextPlane } from '../core/canvas-text.js';

AFRAME.registerComponent('round-celebration', {
  init: function () {
    var THREE = AFRAME.THREE;
    this.duration = 2600;
    this.particleDuration = 1700;
    this.startedAt = null;
    this.activeRound = null;
    this.group = new THREE.Group();
    this.group.visible = false;
    this.el.object3D.add(this.group);

    this.message = createTextPlane({
      width: 1.55,
      height: 0.42,
      canvasWidth: 768,
      canvasHeight: 208,
      text: '',
      color: '#FFFFFF',
      fontSize: 44,
      bold: true,
      background: 'rgba(6, 32, 30, 0.88)',
      backgroundRadius: 28
    });
    this.message.mesh.position.y = -0.08;
    this.group.add(this.message.mesh);

    this.cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
    this.cubes = [];
    var colors = [0xDDF8FF, 0xFFFFFF, 0xA8E8FF, 0xFFE9A8];
    for (var i = 0; i < 18; i++) {
      var material = new THREE.MeshBasicMaterial({
        color: colors[i % colors.length],
        transparent: true,
        depthWrite: false
      });
      var mesh = new THREE.Mesh(this.cubeGeometry, material);
      mesh.scale.setScalar(0.035 + Math.random() * 0.03);
      this.group.add(mesh);
      this.cubes.push({ mesh: mesh, material: material });
    }

    this.onRoundCleared = (evt) => this.show(evt.detail.roundNumber);
    this.onWaveStateChanged = (evt) => {
      if (this.activeRound !== null && evt.detail.waveIndex + 1 !== this.activeRound) {
        this.group.visible = false;
        this.startedAt = null;
        this.activeRound = null;
      }
    };
    this.el.addEventListener('round-cleared', this.onRoundCleared);
    this.el.addEventListener('wave-state-changed', this.onWaveStateChanged);
  },

  show: function (roundNumber) {
    var camera = this.el.camera;
    if (!camera) {
      throw new Error('[round-celebration] Expected a scene camera.');
    }
    var lang = I18N[LANG];
    var messageIndex = (roundNumber - 1) % lang.roundCelebrations.length;
    this.message.setText(
      lang.roundComplete.replace('{round}', roundNumber) + '\n' +
      lang.roundCelebrations[messageIndex]
    );

    var THREE = AFRAME.THREE;
    var cameraPosition = new THREE.Vector3();
    var forward = new THREE.Vector3();
    camera.getWorldPosition(cameraPosition);
    camera.getWorldDirection(forward);
    this.group.position.copy(cameraPosition).addScaledVector(forward, 1.8);
    this.group.position.y += 0.12;
    camera.getWorldQuaternion(this.group.quaternion);
    this.group.visible = true;
    this.startedAt = performance.now();
    this.activeRound = roundNumber;

    for (var i = 0; i < this.cubes.length; i++) {
      var cube = this.cubes[i];
      cube.mesh.position.set(
        (Math.random() - 0.5) * 0.12,
        0.28 + Math.random() * 0.12,
        (Math.random() - 0.5) * 0.08
      );
      cube.mesh.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      cube.material.opacity = 1;
      cube.velocity = {
        x: (Math.random() - 0.5) * 1.15,
        y: 0.45 + Math.random() * 0.65,
        z: (Math.random() - 0.5) * 0.55
      };
      cube.mesh.visible = true;
    }
  },

  tick: function (time, delta) {
    if (this.startedAt === null) return;
    var age = (performance.now() - this.startedAt) / 1000;
    if (age >= this.duration / 1000) {
      this.group.visible = false;
      this.startedAt = null;
      this.activeRound = null;
      return;
    }

    var particleProgress = Math.min(age / (this.particleDuration / 1000), 1);
    var frameTime = (delta || 1000 / 60) / 1000;
    for (var i = 0; i < this.cubes.length; i++) {
      var cube = this.cubes[i];
      if (particleProgress >= 1) {
        cube.mesh.visible = false;
        continue;
      }
      cube.mesh.position.x += cube.velocity.x * frameTime;
      cube.mesh.position.y += (cube.velocity.y - age * 1.1) * frameTime;
      cube.mesh.position.z += cube.velocity.z * frameTime;
      cube.mesh.rotation.x += 4.8 * frameTime;
      cube.mesh.rotation.y += 6 * frameTime;
      cube.material.opacity = 1 - particleProgress;
    }
  },

  remove: function () {
    this.el.removeEventListener('round-cleared', this.onRoundCleared);
    this.el.removeEventListener('wave-state-changed', this.onWaveStateChanged);
    for (var i = 0; i < this.cubes.length; i++) {
      this.cubes[i].material.dispose();
    }
    this.cubeGeometry.dispose();
    this.message.mesh.geometry.dispose();
    this.message.mesh.material.map.dispose();
    this.message.mesh.material.dispose();
    this.el.object3D.remove(this.group);
  }
});
