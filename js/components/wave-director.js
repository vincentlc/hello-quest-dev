import { CONFIG } from '../config.js';
import { getWaveConfig } from '../data/wave-table.js';
import { pickSpawnPoints } from '../core/spawn-placement.js';
import { createTextPlane } from '../core/canvas-text.js';
import { I18N, LANG } from '../i18n.js';

// ---------------------------------------------------------------------
// wave-director (step 5 bis, new -- not in the original spec): lives on
// <a-scene>. Turns the single always-present snowman into a wave-based
// level: waves 1-2 spawn one snowman each at a different point; from
// wave 3 on, several spawn at once and the mix gets tougher (see
// data/wave-table.js's WAVE_TABLE/getWaveConfig). Reacts only to the
// 'snowman-destroyed' and 'snowman-cleared' events, plus the
// snowball-thrower events used for accuracy scoring -- never reaches
// into copito's internals beyond reading its hitsToExplode for scoring.
//
// Owns a pool of `copito` entities, keyed by type (hitsToExplode),
// created lazily and reused across waves by activating/deactivating
// them (copito.activateForWave) rather than creating/destroying DOM
// nodes per wave -- same no-create/destroy-per-use budget as every
// other pool in this project (snowball pool, explosion chunks, etc.),
// and it sidesteps having to tear down a managed instance's own
// per-type three.js objects (chunk InstancedMeshes, burst Points,
// explosion PointLight) that live directly on the scene's object3D.
// ---------------------------------------------------------------------
AFRAME.registerComponent('wave-director', {
  // The only per-frame work is advancing the small pool of floating
  // score popups. Wave state itself remains event- and timer-driven.
  init: function () {
    this.waveIndex = -1;
    this.score = 0;
    this.aliveThisWave = 0;
    this.waveStartAt = 0;
    this.gameStarted = false;
    this.waveThrows = 0;
    this.waveHits = 0;
    this.waveThrowIds = new Set();
    this.waveHitIds = new Set();
    this.waveDestroyScore = 0;
    this.pools = {}; // hitsToExplode -> [{el, inUse}], see getPoolEntity
    this.buildScorePopups();

    this.el.addEventListener('snowman-destroyed', (evt) => this.onSnowmanDestroyed(evt));
    this.el.addEventListener('snowman-cleared', (evt) => this.onSnowmanCleared(evt));
    this.el.addEventListener('snowball-thrown', (evt) => this.onSnowballThrown(evt));
    this.el.addEventListener('snowball-hit-registered', (evt) => this.onSnowballHit(evt));
    this.el.addEventListener('start-game', () => this.startFirstWave());
    this.el.addEventListener('restart-game', () => this.restart());
  },

  buildScorePopups: function () {
    this.scorePopups = [];
    for (var i = 0; i < CONFIG.waveMaxConcurrentSnowmen; i++) {
      var popup = createTextPlane({
        width: 0.8,
        height: 0.3,
        canvasWidth: 768,
        canvasHeight: 192,
        color: '#FFF5A6',
        fontSize: 72,
        bold: true,
        background: 'rgba(8, 39, 35, 0.88)',
        backgroundRadius: 28
      });
      popup.mesh.visible = false;
      popup.mesh.material.depthTest = false;
      popup.mesh.material.depthWrite = false;
      popup.mesh.material.fog = false;
      this.el.object3D.add(popup.mesh);
      this.scorePopups.push({ mesh: popup.mesh, setText: popup.setText, startedAt: 0 });
    }
  },

  startFirstWave: function () {
    if (this.gameStarted) return;
    this.gameStarted = true;
    this.startWave(0);
  },

  showScorePopup: function (snowman, text) {
    var now = performance.now();
    var popup = this.scorePopups.find((item) => !item.mesh.visible) ||
      this.scorePopups.reduce((oldest, item) => item.startedAt < oldest.startedAt ? item : oldest);
    snowman.el.object3D.getWorldPosition(popup.mesh.position);
    popup.mesh.position.y += CONFIG.snowmanHeight * snowman.sizeScale + CONFIG.scorePopupHeight;
    popup.startY = popup.mesh.position.y;
    popup.mesh.material.opacity = 1;
    popup.setText(text);
    popup.startedAt = now;
    popup.mesh.visible = true;
  },

  updateScorePopups: function () {
    var camera = this.el.camera;
    var now = performance.now();
    for (var i = 0; i < this.scorePopups.length; i++) {
      var popup = this.scorePopups[i];
      if (!popup.mesh.visible) continue;
      var age = (now - popup.startedAt) / 1000;
      if (age >= CONFIG.scorePopupDuration) {
        popup.mesh.visible = false;
        continue;
      }
      popup.mesh.position.y = popup.startY + age * 0.2;
      popup.mesh.material.opacity = 1 - age / CONFIG.scorePopupDuration;
      if (camera) camera.getWorldQuaternion(popup.mesh.quaternion);
    }
  },

  tick: function () {
    this.updateScorePopups();
  },

  // Finds a free pool entity of the given type, or grows that type's
  // pool by one if every existing one is currently in use.
  getPoolEntity: function (type) {
    if (!this.pools[type]) this.pools[type] = [];
    var pool = this.pools[type];
    for (var i = 0; i < pool.length; i++) {
      if (!pool[i].inUse) return pool[i];
    }
    var el = document.createElement('a-entity');
    el.setAttribute('copito', 'hitsToExplode: ' + type + '; managed: true');
    var entry = { el: el, inUse: false };
    el.wavePoolEntry = entry; // so onSnowmanCleared can free the right entry
    this.el.appendChild(el);
    pool.push(entry);
    return entry;
  },

  // Positions + activates a pool entry's copito instance. Newly created
  // entries haven't finished attaching their component yet (A-Frame
  // initializes a dynamically appended entity's components
  // asynchronously), so this waits for 'loaded' the first time; reused
  // entries are already loaded and activate immediately.
  activateEntry: function (entry, position) {
    var activate = () => entry.el.components.copito.activateForWave(position);
    if (entry.el.hasLoaded) activate();
    else entry.el.addEventListener('loaded', activate, { once: true });
  },

  startWave: function (index) {
    this.waveIndex = index;
    this.waveStartAt = performance.now();
    this.waveThrows = 0;
    this.waveHits = 0;
    this.waveThrowIds.clear();
    this.waveHitIds.clear();
    this.waveDestroyScore = 0;
    var waveCfg = getWaveConfig(index);

    var camera = this.el.camera;
    var origin = new AFRAME.THREE.Vector3(0, 0, 0);
    var forward = new AFRAME.THREE.Vector3(0, 0, -1);
    if (camera) {
      camera.updateMatrixWorld();
      camera.getWorldPosition(origin);
      camera.getWorldDirection(forward);
    }
    origin.y = 0;

    var points = pickSpawnPoints(waveCfg.count, origin, forward, waveCfg.types);

    this.aliveThisWave = waveCfg.count;
    // Remembered for scheduleNextWave's time-bonus calc below --
    // aliveThisWave itself is decremented to 0 by the time that runs,
    // so the snowman count needs its own copy.
    this.waveSnowmanCount = waveCfg.count;
    for (var i = 0; i < waveCfg.count; i++) {
      var type = waveCfg.types[i % waveCfg.types.length];
      var entry = this.getPoolEntity(type);
      entry.inUse = true;
      this.activateEntry(entry, points[i]);
    }

    console.log('[wave-director] wave ' + (index + 1) + ' started: ' +
      waveCfg.count + ' snowman(s), types [' + waveCfg.types.join(',') + ']');
    this.emitState();
  },

  // Scoring + wave-clear detection happen immediately on the kill
  // (not deferred to when that snowman's explosion fx finish) so the
  // next wave's intermission starts counting right away.
  onSnowmanDestroyed: function (evt) {
    var component = evt.target.components && evt.target.components.copito;
    if (!component) return;
    var points = CONFIG.waveDestroyBonusPerLife * component.hitsToExplode;
    this.score += points;
    this.waveDestroyScore += points;
    var lang = I18N[LANG];
    var hitLabel = component.hitsToExplode === 1 ? lang.hitLabelSingular : lang.hitLabel;
    this.showScorePopup(component, component.hitsToExplode + ' ' + hitLabel + ': +' + points);
    this.aliveThisWave--;
    this.emitState();
    if (this.aliveThisWave <= 0) this.scheduleNextWave();
  },

  onSnowballThrown: function (evt) {
    if (!this.gameStarted || this.aliveThisWave <= 0) return;
    var throwId = evt.detail && evt.detail.throwId;
    if (throwId === undefined || this.waveThrowIds.has(throwId)) return;
    this.waveThrowIds.add(throwId);
    this.waveThrows++;
  },

  onSnowballHit: function (evt) {
    var throwId = evt.detail && evt.detail.throwId;
    if (!this.gameStarted || this.aliveThisWave <= 0 ||
        !this.waveThrowIds.has(throwId) || this.waveHitIds.has(throwId)) return;
    this.waveHitIds.add(throwId);
    this.waveHits++;
  },

  // One small event, fired whenever waveIndex or score changes
  // (wave start, a kill, a wave-clear bonus) -- the HUD (wave-hud,
  // see wave-hud.js) listens on this same scene element rather than
  // polling it every frame. Kept to a single event name/shape so any
  // later display (step 7's real HUD) can reuse it without
  // wave-director needing to know who's listening.
  emitState: function (announcement) {
    this.el.emit('wave-state-changed', {
      waveIndex: this.waveIndex,
      score: this.score,
      totalRounds: CONFIG.creditsAfterWave,
      announcement: announcement || ''
    });
  },

  // A managed snowman's explosion fx have fully finished and it's back
  // to being hidden/inert (see snowman-explosion.js's
  // updateRespawnTimer) -- free its pool slot so a later wave can reuse
  // it.
  onSnowmanCleared: function (evt) {
    var entry = evt.target.wavePoolEntry;
    if (entry) entry.inUse = false;
  },

  // Wave-clear and time rewards begin at wave 5. Accuracy starts on the
  // first wave and scales with the proportion of throws that hit.
  scheduleNextWave: function () {
    var waveNumber = this.waveIndex + 1;
    var clearBonus = 0;
    var timeBonus = 0;
    var accuracyBonus = 0;
    var announcement = [];

    if (waveNumber >= CONFIG.waveBonusStartWave) {
      var wavesPastBonusStart = waveNumber - CONFIG.waveBonusStartWave;
      var secondsTaken = (performance.now() - this.waveStartAt) / 1000;
      var allowedSeconds = CONFIG.waveSoftTimerSecondsPerSnowman * this.waveSnowmanCount;
      var maxTimeBonus = CONFIG.waveSoftTimerBonusPerSnowman * this.waveSnowmanCount;
      var overTime = Math.max(0, secondsTaken - allowedSeconds);
      var timeProgression = 1 + wavesPastBonusStart * CONFIG.waveTimeBonusIncreasePerWave;
      clearBonus = CONFIG.waveClearBonus +
        wavesPastBonusStart * CONFIG.waveClearBonusIncreasePerWave;
      timeBonus = Math.round(Math.max(0,
        maxTimeBonus - overTime * CONFIG.waveSoftTimerDecayPerSecond) * timeProgression);
      announcement.push(I18N[LANG].waveBonus + ': +' + clearBonus);
      if (timeBonus > 0) announcement.push(I18N[LANG].timeBonus + ': +' + timeBonus);

    }

    if (waveNumber >= CONFIG.waveEfficiencyStartWave) {
      var accuracy = this.waveThrows > 0
        ? Math.min(1, this.waveHits / this.waveThrows)
        : 0;
      var efficiencyPercent = Math.min(
        CONFIG.waveEfficiencyBonusMax,
        CONFIG.waveEfficiencyBonusBase +
          (waveNumber - CONFIG.waveEfficiencyStartWave) *
          CONFIG.waveEfficiencyBonusIncreasePerWave
      );
      accuracyBonus = Math.round(this.waveDestroyScore * efficiencyPercent * accuracy);
      var accuracyBreakdown = I18N[LANG].accuracyBreakdown
        .replace('{hits}', this.waveHits)
        .replace('{throws}', this.waveThrows)
        .replace('{accuracy}', Math.round(accuracy * 100))
        .replace('{factor}', Math.round(efficiencyPercent * 100));
      announcement.push(I18N[LANG].accuracyBonus + ': ' +
        accuracyBreakdown + ': +' + accuracyBonus);
    }

    this.score += clearBonus + timeBonus + accuracyBonus;
    console.log('[wave-director] wave ' + (this.waveIndex + 1) + ' cleared, score ' + Math.round(this.score));
    this.emitState(announcement.join('\n'));

    // Step 7: once the configured run length is cleared, freeze instead
    // of letting getWaveConfig keep generating waves forever -- hand off
    // to end-screen.js (listens for this same event on this.el) to show
    // the in-VR credits panel. Nothing here assumes end-screen.js is
    // actually present/listening, so this still degrades safely (game
    // just stops spawning) if that component is ever removed.
    var nextIndex = this.waveIndex + 1;
    if (nextIndex >= CONFIG.creditsAfterWave) {
      this.el.emit('game-complete', { score: this.score });
      return;
    }
    this.el.emit('round-cleared', {
      roundNumber: waveNumber,
      totalRounds: CONFIG.creditsAfterWave
    });
    var rampDuration = Math.max(1, CONFIG.waveIntermissionFullDelayWave - 1);
    var rampProgress = Math.min(1, (waveNumber - 1) / rampDuration);
    var intermissionDelay = CONFIG.waveIntermissionStartDelay +
      (CONFIG.waveIntermissionDelay - CONFIG.waveIntermissionStartDelay) * rampProgress;
    setTimeout(() => this.startWave(nextIndex), intermissionDelay * 1000);
  },

  restart: function () {
    this.score = 0;
    this.startWave(0);
  }
});
