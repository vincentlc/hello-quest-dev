import { CONFIG } from '../config.js';
import { pulseHaptics } from '../core/haptics.js';

var BIRD_CALL_CLIPS = [
  { start: 1.7, duration: 1.3 },
  { start: 10.4, duration: 1.0 },
  { start: 12.3, duration: 1.4 },
  { start: 31, duration: 2.0 },
  { start: 32.7, duration: 1.3 },
  { start: 35.1, duration: 1.5 }
];

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

AFRAME.registerComponent('sound-manager', {
  init: function () {
    this.soundEnabled = true;
    this.audioContext = null;
    this.masterGain = null;
    this.birdCallBuffer = null;
    this.birdCallLoadPromise = null;
    this.birdSource = null;
    this.birdTimer = null;
    this.landscapeIndex = 0;
    this.cameraPosition = new AFRAME.THREE.Vector3();
    this.cameraForward = new AFRAME.THREE.Vector3();
    this.lastFootstepPosition = new AFRAME.THREE.Vector3();
    this.hasFootstepPosition = false;
    this.lastFootstepAt = -Infinity;

    this.onSnowballThrown = () => {
      this.unlockAudio();
      this.playThrow();
    };
    this.onSnowballHit = (evt) => {
      var detail = evt.detail || {};
      var hand = detail.source === 'left' ? this.el.querySelector('#leftHand')
        : (detail.source === 'right' ? this.el.querySelector('#rightHand') : null);
      if (hand) pulseHaptics(hand, CONFIG.haptics.hit[0], CONFIG.haptics.hit[1]);
    };
    this.onSnowmanHit = (evt) => {
      var detail = evt.detail || {};
      if (detail.hitCount >= detail.hitsToExplode) this.playSnowFall();
      else this.playSnowCrunch(CONFIG.volume.hit);
    };
    this.onLandscapeChanged = (evt) => this.changeLandscape(evt.detail.landscapeIndex);
    this.onKeyDown = (evt) => {
      if (evt.code !== 'KeyA' || evt.repeat || this.isEditableTarget(evt.target)) return;
      evt.preventDefault();
      this.toggleSound();
    };
    this.onControllerA = () => this.toggleSound();

    this.el.addEventListener('snowball-thrown', this.onSnowballThrown);
    this.el.addEventListener('snowball-hit-registered', this.onSnowballHit);
    this.el.addEventListener('snowman-hit', this.onSnowmanHit);
    this.el.addEventListener('landscape-changed', this.onLandscapeChanged);
    window.addEventListener('keydown', this.onKeyDown);

    this.onSceneLoaded = () => this.attachController();
    if (this.el.hasLoaded) this.attachController();
    else this.el.addEventListener('loaded', this.onSceneLoaded, { once: true });
    this.emitSoundState();
  },

  attachController: function () {
    this.rightHand = this.el.querySelector('#rightHand');
    if (!this.rightHand) {
      throw new Error('[sound-manager] Expected a right-hand controller for the A-button toggle.');
    }
    this.rightHand.addEventListener('abuttondown', this.onControllerA);
  },

  isEditableTarget: function (target) {
    return target instanceof HTMLElement &&
      (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
  },

  toggleSound: function () {
    this.soundEnabled = !this.soundEnabled;
    this.emitSoundState();
    if (this.soundEnabled) this.unlockAudio();
    else {
      this.stopBirdCalls();
      this.updateMasterGain();
    }
  },

  emitSoundState: function () {
    this.el.emit('sound-state-changed', { enabled: this.soundEnabled });
  },

  unlockAudio: function () {
    if (!this.audioContext) {
      var AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error('[sound-manager] Web Audio API is not supported in this browser.');
      }
      this.audioContext = new AudioContextClass();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = this.soundEnabled ? 1 : 0;
      this.masterGain.connect(this.audioContext.destination);
    }

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().then(() => this.onAudioReady()).catch((error) => {
        console.error('[sound-manager] Could not resume audio:', error);
      });
    } else {
      this.onAudioReady();
    }
    this.updateMasterGain();
  },

  onAudioReady: function () {
    if (this.soundEnabled && this.landscapeIndex > 0) this.scheduleBirdCall();
  },

  updateMasterGain: function () {
    if (!this.masterGain) return;
    var now = this.audioContext.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setTargetAtTime(this.soundEnabled ? 1 : 0, now, 0.025);
  },

  playTexturedNoise: function (duration, volume, lowFrequency, highFrequency, delay, isCrunch) {
    if (!this.soundEnabled || !this.audioContext) return;

    var context = this.audioContext;
    var now = context.currentTime + (delay || 0);
    var length = Math.ceil(context.sampleRate * duration);
    var buffer = context.createBuffer(1, length, context.sampleRate);
    var samples = buffer.getChannelData(0);
    for (var i = 0; i < length; i++) {
      var progress = i / length;
      var envelope = isCrunch
        ? Math.pow(1 - progress, 3) * (0.25 + Math.random() * 0.75)
        : Math.pow(Math.sin(Math.PI * progress), 0.7);
      samples[i] = (Math.random() * 2 - 1) * envelope;
    }

    var source = context.createBufferSource();
    source.buffer = buffer;
    var filter = context.createBiquadFilter();
    filter.type = isCrunch ? 'lowpass' : 'bandpass';
    filter.Q.value = 0.6;
    filter.frequency.setValueAtTime(lowFrequency, now);
    filter.frequency.exponentialRampToValueAtTime(highFrequency, now + duration);
    var gain = context.createGain();
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    source.start(now);
    source.stop(now + duration);
  },

  playThrow: function () {
    this.playTexturedNoise(0.32, CONFIG.volume.throw, 1500, 420, 0, false);
  },

  playSnowCrunch: function (volume) {
    this.playTexturedNoise(0.16, volume, 1050, 450, 0, true);
  },

  playSnowFall: function () {
    var volume = CONFIG.volume.explosion * 0.32;
    this.playTexturedNoise(0.23, volume, 1250, 500, 0, true);
    this.playTexturedNoise(0.2, volume * 0.65, 900, 380, 0.07, true);
    this.playTexturedNoise(0.18, volume * 0.4, 750, 300, 0.15, true);
  },

  updateFootsteps: function (time) {
    if (!this.el.camera) return;
    this.el.camera.getWorldPosition(this.cameraPosition);
    if (!this.hasFootstepPosition) {
      this.lastFootstepPosition.copy(this.cameraPosition);
      this.hasFootstepPosition = true;
      return;
    }

    var dx = this.cameraPosition.x - this.lastFootstepPosition.x;
    var dz = this.cameraPosition.z - this.lastFootstepPosition.z;
    if (dx * dx + dz * dz < CONFIG.sound.footstepDistance * CONFIG.sound.footstepDistance) return;

    if (!this.soundEnabled || !this.audioContext) {
      this.lastFootstepPosition.copy(this.cameraPosition);
      return;
    }
    if (time - this.lastFootstepAt < CONFIG.sound.footstepMinInterval) return;
    this.lastFootstepPosition.copy(this.cameraPosition);
    this.lastFootstepAt = time;
    this.playSnowCrunch(CONFIG.volume.footstep);
  },

  updateAudioListener: function () {
    if (!this.audioContext || !this.el.camera) return;
    var listener = this.audioContext.listener;
    this.el.camera.getWorldPosition(this.cameraPosition);
    this.el.camera.getWorldDirection(this.cameraForward);

    if (listener.positionX) {
      listener.positionX.value = this.cameraPosition.x;
      listener.positionY.value = this.cameraPosition.y;
      listener.positionZ.value = this.cameraPosition.z;
      listener.forwardX.value = this.cameraForward.x;
      listener.forwardY.value = this.cameraForward.y;
      listener.forwardZ.value = this.cameraForward.z;
      listener.upX.value = 0;
      listener.upY.value = 1;
      listener.upZ.value = 0;
    } else if (listener.setPosition) {
      listener.setPosition(this.cameraPosition.x, this.cameraPosition.y, this.cameraPosition.z);
      listener.setOrientation(
        this.cameraForward.x, this.cameraForward.y, this.cameraForward.z,
        0, 1, 0
      );
    }
  },

  changeLandscape: function (landscapeIndex) {
    this.landscapeIndex = landscapeIndex;
    this.stopBirdCalls();
    if (this.soundEnabled && this.audioContext && landscapeIndex > 0) {
      this.scheduleBirdCall(randomBetween(
        CONFIG.sound.birdFirstDelayMin,
        CONFIG.sound.birdFirstDelayMax
      ));
    }
  },

  loadBirdCall: function () {
    if (this.birdCallBuffer) return Promise.resolve(this.birdCallBuffer);
    if (this.birdCallLoadPromise) return this.birdCallLoadPromise;

    this.birdCallLoadPromise = fetch(CONFIG.sound.forestBirdCall)
      .then((response) => {
        if (!response.ok) {
          throw new Error('Could not load bird call (' + response.status + '): ' +
            CONFIG.sound.forestBirdCall);
        }
        return response.arrayBuffer();
      })
      .then((bytes) => this.audioContext.decodeAudioData(bytes))
      .then((buffer) => {
        this.birdCallBuffer = buffer;
        this.birdCallLoadPromise = null;
        return buffer;
      })
      .catch((error) => {
        this.birdCallLoadPromise = null;
        console.error('[sound-manager] Could not decode bird call:', error);
        return null;
      });
    return this.birdCallLoadPromise;
  },

  scheduleBirdCall: function (delay) {
    if (this.birdTimer !== null || !this.soundEnabled ||
        !this.audioContext || this.landscapeIndex === 0) return;

    var wait = delay === undefined
      ? randomBetween(CONFIG.sound.birdRepeatDelayMin, CONFIG.sound.birdRepeatDelayMax)
      : delay;
    this.birdTimer = setTimeout(() => {
      this.birdTimer = null;
      this.loadBirdCall().then((buffer) => {
        if (!buffer || !this.soundEnabled || this.landscapeIndex === 0) return;
        this.playBirdCall(buffer);
        this.scheduleBirdCall(randomBetween(
          CONFIG.sound.birdRepeatDelayMin,
          CONFIG.sound.birdRepeatDelayMax
        ));
      });
    }, wait);
  },

  playBirdCall: function (buffer) {
    var context = this.audioContext;
    var clip = BIRD_CALL_CLIPS[Math.floor(Math.random() * BIRD_CALL_CLIPS.length)];
    var duration = Math.min(clip.duration, buffer.duration - clip.start);
    if (duration <= 0) {
      throw new Error('[sound-manager] Bird-call excerpt is longer than its recording.');
    }

    var camera = this.el.camera;
    if (camera) camera.getWorldPosition(this.cameraPosition);
    var angle = Math.random() * Math.PI * 2;
    var distance = randomBetween(9, 15);
    var panner = context.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 1;
    panner.rolloffFactor = 0.25;
    panner.maxDistance = 40;
    var x = this.cameraPosition.x + Math.cos(angle) * distance;
    var z = this.cameraPosition.z + Math.sin(angle) * distance;
    if (panner.positionX) {
      panner.positionX.value = x;
      panner.positionY.value = this.cameraPosition.y + 1;
      panner.positionZ.value = z;
    } else {
      panner.setPosition(x, this.cameraPosition.y + 1, z);
    }

    var gain = context.createGain();
    gain.gain.value = CONFIG.volume.forestBird;
    var source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(panner);
    panner.connect(gain);
    gain.connect(this.masterGain);
    source.onended = () => {
      if (this.birdSource === source) this.birdSource = null;
      source.disconnect();
      panner.disconnect();
      gain.disconnect();
    };
    this.birdSource = source;
    source.start(0, clip.start, duration);
  },

  stopBirdCalls: function () {
    if (this.birdTimer !== null) {
      clearTimeout(this.birdTimer);
      this.birdTimer = null;
    }
    if (this.birdSource) {
      this.birdSource.stop();
      this.birdSource = null;
    }
  },

  tick: function (time) {
    this.updateFootsteps(time);
    this.updateAudioListener();
  },

  remove: function () {
    this.el.removeEventListener('snowball-thrown', this.onSnowballThrown);
    this.el.removeEventListener('snowball-hit-registered', this.onSnowballHit);
    this.el.removeEventListener('snowman-hit', this.onSnowmanHit);
    this.el.removeEventListener('landscape-changed', this.onLandscapeChanged);
    this.el.removeEventListener('loaded', this.onSceneLoaded);
    window.removeEventListener('keydown', this.onKeyDown);
    if (this.rightHand) this.rightHand.removeEventListener('abuttondown', this.onControllerA);
    this.stopBirdCalls();
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch((error) => {
        console.error('[sound-manager] Could not close audio:', error);
      });
    }
  }
});
