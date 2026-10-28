import { CONFIG } from '../config.js';
import { getWaveConfig } from '../data/wave-table.js';
import { pickSpawnPoints } from '../core/spawn-placement.js';

// ---------------------------------------------------------------------
// wave-director (step 5 bis, new -- not in the original spec): lives on
// <a-scene>. Turns the single always-present snowman into a wave-based
// level: waves 1-2 spawn one snowman each at a different point; from
// wave 3 on, several spawn at once and the mix gets tougher (see
// data/wave-table.js's WAVE_TABLE/getWaveConfig). Reacts only to the
// 'snowman-destroyed' event `copito` already emits (step 4's contract,
// reused again here) and the new 'snowman-cleared' event (emitted once
// a managed snowman's explosion fx are fully done, see
// snowman-explosion.js's updateRespawnTimer) -- never reaches into
// copito's internals beyond reading its `hitsToExplode` for scoring.
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
  // No tick() here on purpose -- every state change this component
  // cares about is event- or timer-driven (a kill, a cleared pool slot,
  // an intermission timeout), never a per-frame update, so there's
  // nothing a tick() would buy it. Timing runs on performance.now() and
  // setTimeout instead (see startWave/scheduleNextWave).
  init: function () {
    this.waveIndex = -1;
    this.score = 0;
    this.aliveThisWave = 0;
    this.waveStartAt = 0;
    this.pools = {}; // hitsToExplode -> [{el, inUse}], see getPoolEntity

    this.el.addEventListener('snowman-destroyed', (evt) => this.onSnowmanDestroyed(evt));
    this.el.addEventListener('snowman-cleared', (evt) => this.onSnowmanCleared(evt));
    // end-screen.js re-emits this once a snowball is thrown while the
    // post-credits freeze is active (see scheduleNextWave below) --
    // restart is just "start over at wave 1 with the score reset".
    this.el.addEventListener('restart-game', () => this.restart());

    // Deferred a macrotask past init (not called directly here):
    // startWave appends new DOM entities (the pool, see
    // getPoolEntity), and this component's own init() still runs
    // synchronously during the scene's initial attach pass, before the
    // first real frame -- the same early-timing window that caused the
    // camera race above. A plain setTimeout(0) reliably lands after it.
    setTimeout(() => this.startWave(0), 0);
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
    this.score += CONFIG.waveDestroyBonusPerLife * component.hitsToExplode;
    this.aliveThisWave--;
    this.emitState();
    if (this.aliveThisWave <= 0) this.scheduleNextWave();
  },

  // One small event, fired whenever waveIndex or score changes
  // (wave start, a kill, a wave-clear bonus) -- the HUD (wave-hud,
  // see wave-hud.js) listens on this same scene element rather than
  // polling it every frame. Kept to a single event name/shape so any
  // later display (step 7's real HUD) can reuse it without
  // wave-director needing to know who's listening.
  emitState: function () {
    this.el.emit('wave-state-changed', { waveIndex: this.waveIndex, score: this.score });
  },

  // A managed snowman's explosion fx have fully finished and it's back
  // to being hidden/inert (see snowman-explosion.js's
  // updateRespawnTimer) -- free its pool slot so a later wave can reuse
  // it.
  onSnowmanCleared: function (evt) {
    var entry = evt.target.wavePoolEntry;
    if (entry) entry.inUse = false;
  },

  // Soft time bonus, scaled to the wave's own size (step 7 improvement
  // -- originally a flat budget regardless of snowman count, which
  // unfairly squeezed later/bigger waves against the same clock as
  // wave 1's single snowman). Each snowman in the wave grants
  // `waveSoftTimerSecondsPerSnowman` seconds of "free" time before the
  // bonus starts decaying, and raises the max bonus pool by
  // `waveSoftTimerBonusPerSnowman` -- a 7-snowman wave can earn up to
  // 7x a 1-snowman wave's bonus, with proportionally more time to earn
  // it in, instead of competing for the exact same fixed pool/window.
  scheduleNextWave: function () {
    var secondsTaken = (performance.now() - this.waveStartAt) / 1000;
    var allowedSeconds = CONFIG.waveSoftTimerSecondsPerSnowman * this.waveSnowmanCount;
    var maxBonus = CONFIG.waveSoftTimerBonusPerSnowman * this.waveSnowmanCount;
    var overTime = Math.max(0, secondsTaken - allowedSeconds);
    var softBonus = Math.max(0, maxBonus - overTime * CONFIG.waveSoftTimerDecayPerSecond);
    this.score += CONFIG.waveClearBonus + softBonus;
    console.log('[wave-director] wave ' + (this.waveIndex + 1) + ' cleared, score ' + Math.round(this.score));
    this.emitState();

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
    setTimeout(() => this.startWave(nextIndex), CONFIG.waveIntermissionDelay * 1000);
  },

  restart: function () {
    this.score = 0;
    this.startWave(0);
  }
});
