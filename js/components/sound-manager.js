import { CONFIG } from '../config.js';
import { pulseHaptics } from '../core/haptics.js';

AFRAME.registerComponent('sound-manager', {
  init: function () {
    this.soundEnabled = true;
    this.audioContext = null;
    this.masterGain = null;
    this.ambienceStarted = false;
    this.onSnowballThrown = () => {
      this.unlockAudio();
      this.playThrow();
    };
    this.onSnowballHit = (evt) => {
      var detail = evt.detail || {};
      var hand = detail.source === 'left' ? this.el.querySelector('#leftHand')
        : (detail.source === 'right' ? this.el.querySelector('#rightHand') : null);
      if (hand) pulseHaptics(hand, CONFIG.haptics.hit[0], CONFIG.haptics.hit[1]);
      this.playImpact();
    };
    this.onSnowmanHit = (evt) => {
      var detail = evt.detail || {};
      if (detail.hitCount < detail.hitsToExplode) this.playCrack();
    };
    this.onSnowmanDestroyed = () => this.playExplosion();
    this.onSnowmanRespawned = () => this.playRespawn();
    this.onKeyDown = (evt) => {
      if (evt.code !== 'KeyA' || evt.repeat || this.isEditableTarget(evt.target)) return;
      evt.preventDefault();
      this.toggleSound();
    };
    this.onControllerA = () => this.toggleSound();

    this.el.addEventListener('snowball-thrown', this.onSnowballThrown);
    this.el.addEventListener('snowball-hit-registered', this.onSnowballHit);
    this.el.addEventListener('snowman-hit', this.onSnowmanHit);
    this.el.addEventListener('snowman-destroyed', this.onSnowmanDestroyed);
    this.el.addEventListener('snowman-respawned', this.onSnowmanRespawned);
    window.addEventListener('keydown', this.onKeyDown);

    this.onSceneLoaded = () => this.attachController();
    if (this.el.hasLoaded) this.attachController();
    else this.el.addEventListener('loaded', this.onSceneLoaded, { once: true });
    this.emitSoundState();
  },

  attachController: function () {
    this.leftHand = this.el.querySelector('#leftHand');
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
    else this.updateMasterGain();
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
      this.audioContext.resume().then(() => {
        if (this.soundEnabled) this.startAmbience();
      }).catch((error) => {
        console.error('[sound-manager] Could not resume audio:', error);
      });
    } else if (this.soundEnabled) {
      this.startAmbience();
    }
    this.updateMasterGain();
  },

  updateMasterGain: function () {
    if (!this.masterGain) return;
    var now = this.audioContext.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setTargetAtTime(this.soundEnabled ? 1 : 0, now, 0.025);
  },

  startAmbience: function () {
    if (this.ambienceStarted || !this.soundEnabled) return;
    var context = this.audioContext;
    var buffer = context.createBuffer(1, context.sampleRate * 4, context.sampleRate);
    var samples = buffer.getChannelData(0);
    for (var i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;

    var source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    var filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 650;
    var gain = context.createGain();
    gain.gain.value = CONFIG.volume.ambience * 0.12;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    source.start();
    this.ambienceSource = source;
    this.ambienceStarted = true;
  },

  playTone: function (frequency, endFrequency, duration, volume, type) {
    if (!this.soundEnabled || !this.audioContext) return;
    var context = this.audioContext;
    var now = context.currentTime;
    var oscillator = context.createOscillator();
    var gain = context.createGain();
    oscillator.type = type || 'sine';
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(this.masterGain);
    oscillator.start(now);
    oscillator.stop(now + duration);
  },

  playNoise: function (duration, volume, filterType, startFrequency, endFrequency) {
    if (!this.soundEnabled || !this.audioContext) return;
    var context = this.audioContext;
    var now = context.currentTime;
    var buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
    var samples = buffer.getChannelData(0);
    for (var i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;

    var source = context.createBufferSource();
    source.buffer = buffer;
    var filter = context.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(startFrequency, now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), now + duration);
    var gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    source.start(now);
    source.stop(now + duration);
  },

  playThrow: function () {
    this.playNoise(0.28, CONFIG.volume.throw * 0.14, 'bandpass', 1500, 320);
    this.playTone(300, 110, 0.2, CONFIG.volume.throw * 0.1, 'triangle');
  },

  playImpact: function () {
    this.playNoise(0.12, CONFIG.volume.hit * 0.3, 'lowpass', 850, 170);
    this.playTone(190, 75, 0.13, CONFIG.volume.hit * 0.16, 'triangle');
  },

  playCrack: function () {
    this.playNoise(0.16, CONFIG.volume.crack * 0.22, 'bandpass', 1700, 420);
    this.playTone(480, 210, 0.14, CONFIG.volume.crack * 0.1, 'triangle');
  },

  playExplosion: function () {
    this.playNoise(0.55, CONFIG.volume.explosion * 0.35, 'lowpass', 950, 95);
    this.playTone(105, 38, 0.5, CONFIG.volume.explosion * 0.2, 'sawtooth');
  },

  playRespawn: function () {
    this.playTone(440, 660, 0.22, CONFIG.volume.respawn * 0.13, 'sine');
    this.playTone(660, 880, 0.32, CONFIG.volume.respawn * 0.1, 'sine');
  },

  remove: function () {
    this.el.removeEventListener('snowball-thrown', this.onSnowballThrown);
    this.el.removeEventListener('snowball-hit-registered', this.onSnowballHit);
    this.el.removeEventListener('snowman-hit', this.onSnowmanHit);
    this.el.removeEventListener('snowman-destroyed', this.onSnowmanDestroyed);
    this.el.removeEventListener('snowman-respawned', this.onSnowmanRespawned);
    this.el.removeEventListener('loaded', this.onSceneLoaded);
    window.removeEventListener('keydown', this.onKeyDown);
    if (this.rightHand) this.rightHand.removeEventListener('abuttondown', this.onControllerA);
    if (this.ambienceSource) this.ambienceSource.stop();
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch((error) => {
        console.error('[sound-manager] Could not close audio:', error);
      });
    }
  }
});
