import { CONFIG } from '../config.js';
import { pulseHaptics } from '../core/haptics.js';

// ---------------------------------------------------------------------
// sound-manager (step 6, sound polish pass)
//
// - Throws and snowball impacts are synthesized in plain JS into a few
//   pre-rendered AudioBuffer variants at audio unlock, then picked at
//   random with small pitch/volume changes so no two sound identical.
//   Snow is granular (many tiny crystals breaking), so the impact is
//   built from soft grains + a low "pomf" body with a 12 ms attack. The
//   old version used one sharp-decaying noise burst for everything,
//   which read as a knock on wood.
// - Impacts are spatialized at the hit point (HRTF panner). The inverse
//   distance model with refDistance = impactRefDistance caps loudness:
//   any hit closer than that sounds like it is at that distance. Far
//   hits also lose highs (air + snow absorption).
// - Footsteps are real CC0 snow-step recordings (see ASSETS.md), picked
//   at random without immediate repeats, softened with a lowpass.
// - Birds play short excerpts of two unmodified xeno-canto recordings.
//   They are CC BY-NC-ND 4.0: the files ship untouched and every fade,
//   filter and 3D placement is applied only at playback time.
// - A very quiet generated wind bed runs from audio unlock so incoming
//   sounds never appear out of dead silence.
// ---------------------------------------------------------------------

// [start, end] seconds inside the original recordings.
// gain: per-species level on top of CONFIG.volume.forestBird (the chucao
// sings lower and reads quieter at distance, so it gets a boost).
var BIRD_SPECIES = [
  { key: 'rayadito', highpass: 1200, gain: 1, clips: [[2.9, 5.45], [5.35, 7.15], [2.9, 7.15]] },
  { key: 'chucao', highpass: 150, gain: 1.5, clips: [[4.3, 5.7], [5.75, 6.95], [4.3, 6.95]] }
];
var BIRD_FADE = 0.15;
var IMPACT_VARIANTS = 6;
var THROW_VARIANTS = 4;
var WIND_SECONDS = 20;

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function gaussian() {
  var u = 1 - Math.random();
  var v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// RBJ-cookbook biquad applied in place. Two cascaded sections with the
// Butterworth Q pair give a 4th-order slope.
function biquad(samples, type, frequency, q, sampleRate) {
  var w = 2 * Math.PI * frequency / sampleRate;
  var cos = Math.cos(w);
  var alpha = Math.sin(w) / (2 * q);
  var b0, b1, b2;
  if (type === 'lowpass') {
    b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = b0;
  } else if (type === 'highpass') {
    b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = b0;
  } else {
    throw new Error('[sound-manager] Unknown filter type: ' + type);
  }
  var a0 = 1 + alpha;
  var a1 = -2 * cos;
  var a2 = 1 - alpha;
  b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0;
  var x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (var i = 0; i < samples.length; i++) {
    var x0 = samples[i];
    var y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    samples[i] = y0;
    x2 = x1; x1 = x0; y2 = y1; y1 = y0;
  }
  return samples;
}

function lowpass(samples, frequency, sampleRate, steep) {
  if (steep) {
    biquad(samples, 'lowpass', frequency, 0.5412, sampleRate);
    return biquad(samples, 'lowpass', frequency, 1.3066, sampleRate);
  }
  return biquad(samples, 'lowpass', frequency, Math.SQRT1_2, sampleRate);
}

function highpass(samples, frequency, sampleRate) {
  return biquad(samples, 'highpass', frequency, Math.SQRT1_2, sampleRate);
}

function bandpass(samples, low, high, sampleRate) {
  highpass(samples, low, sampleRate);
  return lowpass(samples, high, sampleRate);
}

function normalize(samples, peak) {
  var max = 0;
  for (var i = 0; i < samples.length; i++) max = Math.max(max, Math.abs(samples[i]));
  if (max === 0) return samples;
  var scale = peak / max;
  for (var j = 0; j < samples.length; j++) samples[j] *= scale;
  return samples;
}

function whiteNoise(length) {
  var samples = new Float32Array(length);
  for (var i = 0; i < length; i++) samples[i] = gaussian();
  return samples;
}

// Soft granular crackle: many short Hann-windowed noise grains, denser
// where rateAt(t) is high. Long-ish grains with soft edges avoid the
// "pixelated" clicks of very short grains.
function softGrains(length, sampleRate, rateAt, low, high, minGrain, maxGrain) {
  var samples = new Float32Array(length);
  var duration = length / sampleRate;
  var t = 0;
  while (true) {
    t += -Math.log(1 - Math.random()) / Math.max(rateAt(t), 1);
    if (t >= duration) break;
    var grainLength = Math.floor(sampleRate * randomBetween(minGrain, maxGrain));
    var start = Math.floor(t * sampleRate);
    var amplitude = Math.exp(0.35 * gaussian());
    for (var i = 0; i < grainLength && start + i < length; i++) {
      var window = Math.pow(Math.sin(Math.PI * i / grainLength), 1.4);
      samples[start + i] += gaussian() * window * amplitude;
    }
  }
  bandpass(samples, low, high, sampleRate);
  return lowpass(samples, high * 0.8, sampleRate);
}

function mixInto(target, layer, gain) {
  for (var i = 0; i < target.length; i++) target[i] += layer[i] * gain;
}

function renderImpact(sampleRate) {
  var length = Math.floor(sampleRate * 0.5);
  var body = lowpass(whiteNoise(length), 180, sampleRate, true);
  var air = bandpass(whiteNoise(length), 300, 1200, sampleRate);
  for (var i = 0; i < length; i++) {
    var t = i / sampleRate;
    var attack = Math.pow(Math.min(t / 0.012, 1), 2);
    body[i] *= Math.exp(-t / 0.09) * attack;
    air[i] *= Math.exp(-t / 0.06) * attack;
  }
  var crunch = softGrains(length, sampleRate, (t) => 20000 * Math.exp(-t / 0.04),
    500, 1800, 0.002, 0.008);
  var spray = softGrains(length, sampleRate, (t) => 6000 * Math.exp(-t / 0.15),
    1500, 4500, 0.003, 0.01);
  var out = new Float32Array(length);
  mixInto(out, normalize(body, 1), 0.6);
  mixInto(out, normalize(air, 1), 0.35);
  mixInto(out, normalize(crunch, 1), 0.35);
  mixInto(out, normalize(spray, 1), 0.15);
  return normalize(out, 0.9);
}

// Soft arm/sleeve swish. The envelope reaches true zero before the
// buffer ends, so there is no click at the end.
function renderThrow(sampleRate) {
  var duration = 0.5;
  var length = Math.floor(sampleRate * duration);
  var noise = new Float32Array(length);
  var walk = 0;
  for (var i = 0; i < length; i++) {
    walk += gaussian();
    noise[i] = walk;
  }
  highpass(noise, 80, sampleRate);
  bandpass(noise, 250, 1100, sampleRate);
  lowpass(noise, 900, sampleRate);
  for (var j = 0; j < length; j++) {
    var t = j / sampleRate;
    var envelope = t < 0.18 ? Math.pow(t / 0.18, 2) : Math.exp(-(t - 0.18) / 0.06);
    envelope *= Math.pow(Math.min(Math.max((duration - t) / 0.12, 0), 1), 2);
    noise[j] *= envelope;
  }
  return normalize(noise, 0.9);
}

// Loopable wind: brown noise lowpassed to a soft rumble, plus a faint
// branch/needle hiss, both swelling with slow gusts. Gust periods divide
// the loop length, and the last second is crossfaded into the first,
// so the loop point is seamless.
function renderWind(sampleRate) {
  var fade = sampleRate;
  var length = sampleRate * WIND_SECONDS;
  var total = length + fade;
  var rumble = new Float32Array(total);
  var walk = 0;
  for (var i = 0; i < total; i++) {
    walk += gaussian();
    rumble[i] = walk;
  }
  highpass(rumble, 25, sampleRate);
  lowpass(rumble, 380, sampleRate);
  normalize(rumble, 1);
  var hiss = bandpass(whiteNoise(total), 1800, 5000, sampleRate);
  normalize(hiss, 1);

  var out = new Float32Array(length);
  for (var j = 0; j < total; j++) {
    var t = j / sampleRate;
    var gust = 0.55 + 0.45 * Math.sin(2 * Math.PI * t / (WIND_SECONDS / 3)) *
      Math.sin(2 * Math.PI * t / (WIND_SECONDS / 6) + 1);
    var value = rumble[j] * gust + hiss[j] * 0.12 * (0.3 + 0.7 * gust * gust);
    if (j < length) out[j] += j < fade ? value * (j / fade) : value;
    else out[j - length] += value * (1 - (j - length) / fade);
  }
  return normalize(out, 0.9);
}

AFRAME.registerComponent('sound-manager', {
  init: function () {
    this.soundEnabled = true;
    this.audioContext = null;
    this.masterGain = null;
    this.impactBuffers = [];
    this.throwBuffers = [];
    this.footstepBuffers = [];
    this.lastFootstepIndex = -1;
    this.windSource = null;
    this.birdBuffers = {};
    this.birdLoadPromise = null;
    this.birdSource = null;
    this.birdGain = null;
    this.birdTimer = null;
    this.lastBirdSpecies = -1;
    this.sameBirdStreak = 0;
    this.currentWaveNumber = 0;
    this.waveScheduleVersion = 0;
    this.nextBirdSide = -1;
    this.cameraPosition = new AFRAME.THREE.Vector3();
    this.cameraForward = new AFRAME.THREE.Vector3();
    this.cameraQuaternion = new AFRAME.THREE.Quaternion();
    this.birdDirection = new AFRAME.THREE.Vector3();
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
      if (detail.hitCount >= detail.hitsToExplode) this.playSnowFall(detail.point);
      else this.playImpact(detail.point, CONFIG.volume.hit, 0);
    };
    this.onWaveStateChanged = (evt) => this.changeWave(evt.detail.waveIndex + 1);
    this.onKeyDown = (evt) => {
      if (evt.code !== 'KeyA' || evt.repeat || this.isEditableTarget(evt.target)) return;
      evt.preventDefault();
      this.toggleSound();
    };
    this.onControllerA = () => this.toggleSound();

    this.el.addEventListener('snowball-thrown', this.onSnowballThrown);
    this.el.addEventListener('snowball-hit-registered', this.onSnowballHit);
    this.el.addEventListener('snowman-hit', this.onSnowmanHit);
    this.el.addEventListener('wave-state-changed', this.onWaveStateChanged);
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
      // Gentle safety limiter: several hits landing at once never clip.
      var limiter = this.audioContext.createDynamicsCompressor();
      limiter.threshold.value = -10;
      limiter.knee.value = 10;
      limiter.ratio.value = 3;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.25;
      limiter.connect(this.audioContext.destination);
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = this.soundEnabled ? CONFIG.volume.master : 0;
      this.masterGain.connect(limiter);
      this.renderSynthBuffers();
      this.loadFootsteps();
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

  renderSynthBuffers: function () {
    var context = this.audioContext;
    var toBuffer = (samples) => {
      var buffer = context.createBuffer(1, samples.length, context.sampleRate);
      buffer.copyToChannel(samples, 0);
      return buffer;
    };
    // One variant of each right away (the first throw needs it), the rest
    // spread over the next frames so rendering never causes a VR hitch.
    var jobs = [];
    for (var i = 0; i < IMPACT_VARIANTS; i++) {
      jobs.push(() => this.impactBuffers.push(toBuffer(renderImpact(context.sampleRate))));
    }
    for (var j = 0; j < THROW_VARIANTS; j++) {
      jobs.push(() => this.throwBuffers.push(toBuffer(renderThrow(context.sampleRate))));
    }
    jobs.push(() => {
      this.windBuffer = toBuffer(renderWind(context.sampleRate));
      if (this.soundEnabled) this.startWind();
    });
    jobs[0]();
    jobs[IMPACT_VARIANTS]();
    var rest = jobs.filter((job, index) => index !== 0 && index !== IMPACT_VARIANTS);
    rest.forEach((job, index) => setTimeout(job, 60 * (index + 1)));
  },

  loadAudio: function (url) {
    return fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error('Could not load ' + url + ' (' + response.status + ')');
        return response.arrayBuffer();
      })
      .then((bytes) => this.audioContext.decodeAudioData(bytes));
  },

  loadFootsteps: function () {
    Promise.all(CONFIG.sound.footstepSamples.map((url) => this.loadAudio(url)))
      .then((buffers) => { this.footstepBuffers = buffers; })
      .catch((error) => console.error('[sound-manager] Could not load footsteps:', error));
  },

  onAudioReady: function () {
    if (!this.soundEnabled) return;
    this.startWind();
    if (this.currentWaveNumber >= CONFIG.sound.birdCallStartWave) this.scheduleBirdCall();
  },

  startWind: function () {
    if (this.windSource || !this.windBuffer) return;
    var context = this.audioContext;
    var source = context.createBufferSource();
    source.buffer = this.windBuffer;
    source.loop = true;
    var gain = context.createGain();
    var now = context.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(CONFIG.volume.wind, now + 3);
    source.connect(gain);
    gain.connect(this.masterGain);
    source.start(now, Math.random() * WIND_SECONDS);
    this.windSource = source;
  },

  updateMasterGain: function () {
    if (!this.masterGain) return;
    var now = this.audioContext.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setTargetAtTime(this.soundEnabled ? CONFIG.volume.master : 0, now, 0.025);
  },

  pick: function (list) {
    return list[Math.floor(Math.random() * list.length)];
  },

  setPannerPosition: function (panner, x, y, z) {
    if (panner.positionX) {
      panner.positionX.value = x;
      panner.positionY.value = y;
      panner.positionZ.value = z;
    } else {
      panner.setPosition(x, y, z);
    }
  },

  playThrow: function () {
    if (!this.soundEnabled || !this.audioContext || !this.throwBuffers.length) return;
    var context = this.audioContext;
    var source = context.createBufferSource();
    source.buffer = this.pick(this.throwBuffers);
    source.playbackRate.value = randomBetween(0.94, 1.06);
    var gain = context.createGain();
    gain.gain.value = CONFIG.volume.throw * randomBetween(0.85, 1);
    source.connect(gain);
    gain.connect(this.masterGain);
    source.start();
  },

  // point: world-space hit position. Without one (should not happen), the
  // hit is placed a few meters ahead so it still plays.
  playImpact: function (point, volume, delay) {
    if (!this.soundEnabled || !this.audioContext || !this.impactBuffers.length) return;
    if (!this.el.camera) return;
    var context = this.audioContext;
    this.el.camera.getWorldPosition(this.cameraPosition);
    var position = point;
    if (!position) {
      this.el.camera.getWorldDirection(this.cameraForward);
      position = this.cameraPosition.clone().addScaledVector(this.cameraForward, 4);
    }
    var distance = Math.max(this.cameraPosition.distanceTo(position), 0.1);

    var source = context.createBufferSource();
    source.buffer = this.pick(this.impactBuffers);
    source.playbackRate.value = randomBetween(0.95, 1.05);
    var gain = context.createGain();
    gain.gain.value = volume * randomBetween(0.85, 1);
    var absorption = context.createBiquadFilter();
    absorption.type = 'lowpass';
    absorption.frequency.value = Math.max(900, 9000 / (1 + Math.max(distance, 2) / 2.5));
    var panner = context.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = CONFIG.sound.impactRefDistance;
    panner.rolloffFactor = 1;
    panner.maxDistance = 60;
    this.setPannerPosition(panner, position.x, position.y, position.z);

    source.connect(gain);
    gain.connect(absorption);
    absorption.connect(panner);
    panner.connect(this.masterGain);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      absorption.disconnect();
      panner.disconnect();
    };
    source.start(context.currentTime + (delay || 0));
  },

  playSnowFall: function (point) {
    var volume = CONFIG.volume.explosion;
    this.playImpact(point, volume, 0);
    this.playImpact(point, volume * 0.6, 0.07);
    this.playImpact(point, volume * 0.35, 0.16);
  },

  playFootstep: function () {
    if (!this.footstepBuffers.length) return;
    var context = this.audioContext;
    var index = Math.floor(Math.random() * this.footstepBuffers.length);
    if (index === this.lastFootstepIndex) index = (index + 1) % this.footstepBuffers.length;
    this.lastFootstepIndex = index;

    var source = context.createBufferSource();
    source.buffer = this.footstepBuffers[index];
    source.playbackRate.value = randomBetween(0.96, 1.04);
    var soften = context.createBiquadFilter();
    soften.type = 'lowpass';
    soften.frequency.value = 3500;
    var gain = context.createGain();
    gain.gain.value = CONFIG.volume.footstep * randomBetween(0.85, 1);
    source.connect(soften);
    soften.connect(gain);
    gain.connect(this.masterGain);
    source.start();
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
    this.playFootstep();
  },

  updateAudioListener: function () {
    if (!this.audioContext || !this.el.camera) return;
    var listener = this.audioContext.listener;
    this.el.camera.getWorldPosition(this.cameraPosition);
    this.el.camera.getWorldDirection(this.cameraForward);
    // getWorldDirection on a camera returns the -Z (view) direction.
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

  changeWave: function (waveNumber) {
    if (waveNumber === this.currentWaveNumber) return;
    this.currentWaveNumber = waveNumber;
    this.waveScheduleVersion++;
    this.stopBirdCalls();
    if (waveNumber >= CONFIG.sound.birdCallStartWave && this.soundEnabled && this.audioContext) {
      this.scheduleBirdCall();
    }
  },

  loadBirds: function () {
    if (this.birdLoadPromise) return this.birdLoadPromise;
    var urls = CONFIG.sound.birdRecordings;
    this.birdLoadPromise = Promise.all(BIRD_SPECIES.map((species) =>
      this.loadAudio(urls[species.key]).then((buffer) => {
        this.birdBuffers[species.key] = buffer;
      })
    )).then(() => true).catch((error) => {
      this.birdLoadPromise = null;
      console.error('[sound-manager] Could not load bird recordings:', error);
      return false;
    });
    return this.birdLoadPromise;
  },

  scheduleBirdCall: function (delay) {
    if (this.birdTimer !== null || !this.soundEnabled ||
        !this.audioContext || this.currentWaveNumber < CONFIG.sound.birdCallStartWave) return;

    var wait = delay === undefined
      ? randomBetween(CONFIG.sound.birdRoundDelayMin, CONFIG.sound.birdRoundDelayMax)
      : delay;
    var scheduledWave = this.currentWaveNumber;
    var scheduleVersion = this.waveScheduleVersion;
    this.birdTimer = setTimeout(() => {
      this.birdTimer = null;
      this.loadBirds().then((loaded) => {
        if (!loaded || !this.soundEnabled ||
            scheduledWave !== this.currentWaveNumber ||
            scheduleVersion !== this.waveScheduleVersion) return;
        this.playBirdCall();
      });
    }, wait);
  },

  playBirdCall: function () {
    var context = this.audioContext;
    // Mostly chucao, but never three calls in a row from the same bird.
    var chucaoIndex = 1;
    var speciesIndex = Math.random() < CONFIG.sound.chucaoShare ? chucaoIndex : 0;
    if (speciesIndex === this.lastBirdSpecies && this.sameBirdStreak >= 2) {
      speciesIndex = 1 - speciesIndex;
    }
    this.sameBirdStreak = speciesIndex === this.lastBirdSpecies ? this.sameBirdStreak + 1 : 1;
    this.lastBirdSpecies = speciesIndex;
    var species = BIRD_SPECIES[speciesIndex];
    var buffer = this.birdBuffers[species.key];
    var clip = this.pick(species.clips);
    var duration = Math.min(clip[1], buffer.duration) - clip[0];
    if (duration <= 2 * BIRD_FADE) {
      throw new Error('[sound-manager] Bird excerpt does not fit its recording: ' + species.key);
    }

    var camera = this.el.camera;
    if (!camera) throw new Error('[sound-manager] A camera is required to spatialize bird calls.');
    camera.getWorldPosition(this.cameraPosition);
    camera.getWorldQuaternion(this.cameraQuaternion);
    var side = this.nextBirdSide;
    this.nextBirdSide *= -1;
    var direction = this.birdDirection.set(side, 0, 0).applyQuaternion(this.cameraQuaternion);
    var distance = randomBetween(10, 15);

    var source = context.createBufferSource();
    source.buffer = buffer;
    var cleanup = context.createBiquadFilter();
    cleanup.type = 'highpass';
    cleanup.frequency.value = species.highpass;
    var air = context.createBiquadFilter();
    air.type = 'lowpass';
    air.frequency.value = Math.max(2500, 14000 / (1 + distance / 8));
    var gain = context.createGain();
    var now = context.currentTime;
    var volume = CONFIG.volume.forestBird * species.gain;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + BIRD_FADE);
    gain.gain.setValueAtTime(volume, now + duration - BIRD_FADE);
    gain.gain.linearRampToValueAtTime(0, now + duration);
    var panner = context.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 4;
    panner.rolloffFactor = 1;
    panner.maxDistance = 60;
    this.setPannerPosition(panner,
      this.cameraPosition.x + direction.x * distance,
      this.cameraPosition.y + 1.5,
      this.cameraPosition.z + direction.z * distance);

    source.connect(cleanup);
    cleanup.connect(air);
    air.connect(gain);
    gain.connect(panner);
    panner.connect(this.masterGain);
    source.onended = () => {
      if (this.birdSource === source) {
        this.birdSource = null;
        this.birdGain = null;
        this.scheduleBirdCall(randomBetween(
          CONFIG.sound.birdRepeatDelayMin, CONFIG.sound.birdRepeatDelayMax));
      }
      source.disconnect();
      cleanup.disconnect();
      air.disconnect();
      gain.disconnect();
      panner.disconnect();
    };
    this.birdSource = source;
    this.birdGain = gain;
    source.start(now, clip[0], duration);
  },

  stopBirdCalls: function () {
    if (this.birdTimer !== null) {
      clearTimeout(this.birdTimer);
      this.birdTimer = null;
    }
    if (this.birdSource) {
      // Short fade instead of a hard cut when a round changes mid-call.
      var now = this.audioContext.currentTime;
      this.birdGain.gain.cancelScheduledValues(now);
      this.birdGain.gain.setTargetAtTime(0, now, 0.03);
      this.birdSource.stop(now + 0.15);
      this.birdSource = null;
      this.birdGain = null;
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
    this.el.removeEventListener('wave-state-changed', this.onWaveStateChanged);
    this.el.removeEventListener('loaded', this.onSceneLoaded);
    window.removeEventListener('keydown', this.onKeyDown);
    if (this.rightHand) this.rightHand.removeEventListener('abuttondown', this.onControllerA);
    this.stopBirdCalls();
    if (this.windSource) this.windSource.stop();
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch((error) => {
        console.error('[sound-manager] Could not close audio:', error);
      });
    }
  }
});
