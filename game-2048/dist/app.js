(function () {
  'use strict';

  var SIZE = 4;
  var GAP = 8;
  var STORAGE_KEY = 'game2048.v1.state';
  var Engine = window.Game2048Engine;
  var ANIM_MS = 140;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    ANIM_MS = 0;
  }

  var board = document.getElementById('board');
  var tilesLayer = document.getElementById('tiles');
  var scoreEl = document.getElementById('score');
  var bestEl = document.getElementById('best');
  var newGameBtn = document.getElementById('new-game');
  var undoBtn = document.getElementById('undo');
  var overlay = document.getElementById('overlay');
  var overlayTitle = document.getElementById('overlay-title');
  var overlayDesc = document.getElementById('overlay-desc');
  var overlayPrimary = document.getElementById('overlay-primary');
  var overlaySecondary = document.getElementById('overlay-secondary');
  var saveStatus = document.getElementById('save-status');
  var sfxBtn = document.getElementById('toggle-sfx');
  var bgmBtn = document.getElementById('toggle-bgm');

  var cells = Engine ? Engine.emptyGrid(SIZE) : [];
  var tilesById = {};
  var nextId = 1;
  var score = 0;
  var best = 0;
  var won = false;
  var keepPlaying = false;
  var over = false;
  var loading = false;
  var animating = false;
  var animTimer = null;
  var generation = 0;
  var undoState = null;
  var overlayMode = null;

  var loadToken = 0;
  var saveTimer = null;
  var pendingSave = null;
  var saving = false;

  var sound = { sfx: true, bgm: false };
  var audio = {
    ctx: null,
    master: null,
    bgmTimer: null,
    bgmStep: 0,
    bgmRunning: false,
    bgmToken: 0
  };

  function getMiniTool() {
    return window.xhs && window.xhs.miniTool;
  }

  function canStorage() {
    var miniTool = getMiniTool();
    return !!(miniTool &&
      typeof miniTool.setStorage === 'function' &&
      typeof miniTool.getStorage === 'function');
  }

  function apiCall(name, options) {
    var miniTool = getMiniTool();
    if (!miniTool || typeof miniTool[name] !== 'function') {
      return Promise.reject(new Error('unsupported'));
    }
    return new Promise(function (resolve, reject) {
      var settled = false;
      function ok(result) {
        if (!settled) {
          settled = true;
          resolve(result);
        }
      }
      function bad(error) {
        if (!settled) {
          settled = true;
          reject(error || new Error('failed'));
        }
      }
      var opts = {};
      var key;
      for (key in options) {
        if (Object.prototype.hasOwnProperty.call(options, key)) {
          opts[key] = options[key];
        }
      }
      opts.success = ok;
      opts.fail = bad;
      var ret;
      try {
        ret = miniTool[name](opts);
      } catch (error) {
        bad(error);
        return;
      }
      if (ret && typeof ret.then === 'function') {
        ret.then(ok, bad);
      }
    });
  }

  function setSaveStatus(kind) {
    var texts = {
      idle: '进度会自动保存在当前小工具。',
      loading: '正在读取本地进度…',
      saving: '正在保存…',
      saved: '已保存到本机。',
      error: '保存失败，进度仅保留在当前页面。',
      unsupported: '当前客户端不支持本地保存，进度仅在本次打开有效。'
    };
    saveStatus.textContent = texts[kind] || texts.idle;
    if (kind === 'error') {
      saveStatus.className = 'save-status is-error';
    } else if (kind === 'unsupported') {
      saveStatus.className = 'save-status is-warn';
    } else {
      saveStatus.className = 'save-status';
    }
  }

  /* ---------- 声音 ---------- */

  function audioSupported() {
    return !!(window.AudioContext || window.webkitAudioContext);
  }

  function ensureAudio() {
    if (!audioSupported()) return null;
    if (!audio.ctx) {
      var Ctor = window.AudioContext || window.webkitAudioContext;
      try {
        audio.ctx = new Ctor();
        audio.master = audio.ctx.createGain();
        audio.master.gain.value = 0.7;
        audio.master.connect(audio.ctx.destination);
      } catch (error) {
        audio.ctx = null;
        return null;
      }
    }
    if (audio.ctx.state === 'suspended' && typeof audio.ctx.resume === 'function') {
      try {
        var ret = audio.ctx.resume();
        if (ret && typeof ret.catch === 'function') {
          ret.catch(function () { /* 等下一次手势 */ });
        }
      } catch (error) {
        /* 等下一次手势 */
      }
    }
    return audio.ctx;
  }

  function midiFreq(note) {
    return 440 * Math.pow(2, (note - 69) / 12);
  }

  function tone(freq, start, duration, type, volume) {
    var ctx = ensureAudio();
    if (!ctx || !audio.master) return;
    try {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      var t0 = ctx.currentTime + (start || 0);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume || 0.07), t0 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + (duration || 0.12));
      osc.connect(gain);
      gain.connect(audio.master);
      osc.start(t0);
      osc.stop(t0 + (duration || 0.12) + 0.03);
    } catch (error) {
      /* 音频失败不影响游戏 */
    }
  }

  function playSfx(kind, value) {
    if (!sound.sfx) return;
    if (kind === 'move') {
      tone(196, 0, 0.05, 'sine', 0.035);
      tone(294, 0.02, 0.05, 'sine', 0.02);
    } else if (kind === 'merge') {
      var level = Math.max(0, Math.min(10, Math.round(Math.log(value) / Math.LN2) - 1));
      var note = 60 + level * 2;
      tone(midiFreq(note), 0, 0.16, 'triangle', 0.08);
      tone(midiFreq(note + 7), 0.05, 0.2, 'triangle', 0.055);
    } else if (kind === 'win') {
      var winNotes = [72, 76, 79, 84];
      for (var i = 0; i < winNotes.length; i += 1) {
        tone(midiFreq(winNotes[i]), i * 0.12, 0.34, 'triangle', 0.085);
      }
    } else if (kind === 'over') {
      var overNotes = [67, 63, 60, 55];
      for (var j = 0; j < overNotes.length; j += 1) {
        tone(midiFreq(overNotes[j]), j * 0.16, 0.3, 'sine', 0.07);
      }
    } else if (kind === 'toggle') {
      tone(660, 0, 0.1, 'sine', 0.05);
    }
  }

  var BGM_MELODY = [76, 0, 72, 0, 74, 0, 76, 0, 79, 0, 76, 0, 74, 0, 72, 0];
  var BGM_BASS = [48, 0, 0, 0, 55, 0, 0, 0, 53, 0, 0, 0, 50, 0, 0, 0];
  var BGM_STEP_MS = 260;

  function startBgm() {
    if (!sound.bgm || audio.bgmRunning || !audioSupported()) return;
    var ctx = ensureAudio();
    if (!ctx) return;
    audio.bgmRunning = true;
    audio.bgmStep = 0;
    audio.bgmToken += 1;
    var token = audio.bgmToken;

    function step() {
      if (!audio.bgmRunning || token !== audio.bgmToken) return;
      var index = audio.bgmStep % 16;
      if (BGM_MELODY[index]) {
        tone(midiFreq(BGM_MELODY[index]), 0, 0.22, 'triangle', 0.035);
      }
      if (BGM_BASS[index]) {
        tone(midiFreq(BGM_BASS[index]), 0, 0.5, 'sine', 0.03);
      }
      audio.bgmStep += 1;
      audio.bgmTimer = window.setTimeout(step, BGM_STEP_MS);
    }
    step();
  }

  function stopBgm() {
    audio.bgmRunning = false;
    audio.bgmToken += 1;
    if (audio.bgmTimer) {
      window.clearTimeout(audio.bgmTimer);
      audio.bgmTimer = null;
    }
  }

  function warmAudio() {
    ensureAudio();
    if (sound.bgm && !audio.bgmRunning) {
      startBgm();
    }
  }

  function renderSoundUi() {
    if (sfxBtn) {
      sfxBtn.className = sound.sfx ? 'sound-toggle is-on' : 'sound-toggle';
      sfxBtn.setAttribute('aria-checked', sound.sfx ? 'true' : 'false');
    }
    if (bgmBtn) {
      bgmBtn.className = sound.bgm ? 'sound-toggle is-on' : 'sound-toggle';
      bgmBtn.setAttribute('aria-checked', sound.bgm ? 'true' : 'false');
    }
  }

  function updateSoundButtons() {
    var disabled = loading || !audioSupported();
    if (sfxBtn) sfxBtn.disabled = disabled;
    if (bgmBtn) bgmBtn.disabled = disabled;
    if (!audioSupported()) {
      if (sfxBtn) sfxBtn.title = '当前设备不支持声音';
      if (bgmBtn) bgmBtn.title = '当前设备不支持声音';
    }
  }

  function valueClass(value) {
    return value <= 2048 ? 'v' + value : 'v-super';
  }

  function positionTile(tile) {
    var x = tile.c * 100;
    var y = tile.r * 100;
    var xPx = tile.c * GAP;
    var yPx = tile.r * GAP;
    tile.el.style.transform = 'translate(calc(' + x + '% + ' + xPx + 'px), calc(' + y + '% + ' + yPx + 'px))';
  }

  function createTile(value, row, col, isNew) {
    var id = nextId;
    nextId += 1;
    var el = document.createElement('div');
    el.className = 'tile';
    var inner = document.createElement('div');
    inner.className = 'tile-inner ' + valueClass(value);
    inner.textContent = String(value);
    el.appendChild(inner);

    var tile = { id: id, value: value, r: row, c: col, el: el, inner: inner };
    positionTile(tile);
    tilesLayer.appendChild(el);
    tilesById[id] = tile;
    cells[row][col] = tile;

    if (isNew) {
      inner.className += ' is-new';
      window.setTimeout(function () {
        if (inner.className.indexOf('is-new') !== -1) {
          inner.className = inner.className.replace(/\s*is-new/g, '');
        }
      }, 180);
    }
    return tile;
  }

  function updateTileFace(tile) {
    tile.inner.className = 'tile-inner ' + valueClass(tile.value);
    tile.inner.textContent = String(tile.value);
  }

  function popTile(tile) {
    tile.inner.className += ' is-merged';
    window.setTimeout(function () {
      if (tile.inner.className.indexOf('is-merged') !== -1) {
        tile.inner.className = tile.inner.className.replace(/\s*is-merged/g, '');
      }
    }, 200);
  }

  function removeTile(tile) {
    if (tile.el.parentNode) {
      tile.el.parentNode.removeChild(tile.el);
    }
    if (tilesById[tile.id]) {
      delete tilesById[tile.id];
    }
  }

  function clearTiles() {
    while (tilesLayer.firstChild) {
      tilesLayer.removeChild(tilesLayer.firstChild);
    }
    tilesById = {};
    cells = Engine.emptyGrid(SIZE);
  }

  function updateScoreDisplay() {
    scoreEl.textContent = String(score);
    bestEl.textContent = String(best);
  }

  function addScore(amount) {
    score += amount;
    scoreEl.textContent = String(score);
    scoreEl.classList.remove('is-bumped');
    /* 读取一次布局，让重复的加分动画可以重新播放。 */
    if (scoreEl.offsetWidth) {
      scoreEl.classList.add('is-bumped');
    }
    window.setTimeout(function () {
      scoreEl.classList.remove('is-bumped');
    }, 220);
    if (score > best) {
      best = score;
      bestEl.textContent = String(best);
    }
  }

  function getValues() {
    var values = [];
    for (var r = 0; r < SIZE; r += 1) {
      var row = [];
      for (var c = 0; c < SIZE; c += 1) {
        row.push(cells[r][c] ? cells[r][c].value : 0);
      }
      values.push(row);
    }
    return values;
  }

  function captureSnapshot() {
    return {
      values: getValues(),
      score: score,
      won: won,
      keepPlaying: keepPlaying,
      sound: { sfx: sound.sfx, bgm: sound.bgm }
    };
  }

  function rebuildFromValues(values) {
    clearTiles();
    for (var r = 0; r < SIZE; r += 1) {
      for (var c = 0; c < SIZE; c += 1) {
        if (values[r][c]) {
          createTile(values[r][c], r, c, false);
        }
      }
    }
  }

  function spawnTile() {
    var empty = [];
    for (var r = 0; r < SIZE; r += 1) {
      for (var c = 0; c < SIZE; c += 1) {
        if (!cells[r][c]) {
          empty.push([r, c]);
        }
      }
    }
    if (!empty.length) {
      return null;
    }
    var pick = empty[Math.floor(Math.random() * empty.length)];
    var value = Math.random() < 0.9 ? 2 : 4;
    return createTile(value, pick[0], pick[1], true);
  }

  function updateUndoButton() {
    undoBtn.disabled = !undoState || animating || loading;
  }

  function showWin() {
    overlayMode = 'win';
    overlayTitle.textContent = '2048 达成！';
    overlayDesc.textContent = '继续挑战更高的数字，或者开始新的一局。';
    overlayPrimary.textContent = '继续挑战';
    overlaySecondary.textContent = '新游戏';
    overlaySecondary.hidden = false;
    overlay.hidden = false;
  }

  function showGameOver() {
    overlayMode = 'over';
    overlayTitle.textContent = '没有可移动的方块了';
    overlayDesc.textContent = '本局得分 ' + score + ' 分。';
    if (undoState) {
      overlayPrimary.textContent = '撤销一步';
      overlaySecondary.hidden = false;
    } else {
      overlayPrimary.textContent = '再来一局';
      overlaySecondary.hidden = true;
    }
    overlaySecondary.textContent = '新游戏';
    overlay.hidden = false;
  }

  function hideOverlay() {
    overlay.hidden = true;
    overlayMode = null;
  }

  function tryMove(direction) {
    if (!Engine || animating || loading || over || (won && !keepPlaying)) {
      return false;
    }
    var snapshot = captureSnapshot();
    var result = Engine.computeMove(cells, direction, SIZE);
    if (!result.moved) {
      return false;
    }

    var gen = generation;
    var mergedSources = [];
    var i;

    undoState = snapshot;
    animating = true;
    updateUndoButton();

    for (i = 0; i < result.moves.length; i += 1) {
      var move = result.moves[i];
      move.tile.r = move.toR;
      move.tile.c = move.toC;
      positionTile(move.tile);
      if (move.merged) {
        move.tile.el.style.zIndex = '2';
        mergedSources.push(move.tile);
      } else {
        move.tile.el.style.zIndex = '1';
      }
    }
    cells = result.cells;

    if (result.gained > 0) {
      addScore(result.gained);
    }

    var maxMerged = 0;
    for (i = 0; i < result.merges.length; i += 1) {
      if (result.merges[i].newValue > maxMerged) {
        maxMerged = result.merges[i].newValue;
      }
    }
    if (maxMerged) {
      playSfx('merge', maxMerged);
    } else {
      playSfx('move');
    }

    var reached2048 = false;
    for (i = 0; i < result.merges.length; i += 1) {
      if (result.merges[i].newValue >= 2048) {
        reached2048 = true;
      }
    }

    animTimer = window.setTimeout(function () {
      animTimer = null;
      if (gen !== generation) {
        return;
      }

      for (i = 0; i < result.merges.length; i += 1) {
        updateTileFace(result.merges[i].tile);
        popTile(result.merges[i].tile);
      }
      for (i = 0; i < mergedSources.length; i += 1) {
        removeTile(mergedSources[i]);
      }

      if (reached2048 && !won) {
        won = true;
        playSfx('win');
      }

      spawnTile();
      over = !Engine.hasMoves(cells, SIZE);
      animating = false;
      updateUndoButton();

      if (won && !keepPlaying && !over) {
        showWin();
      } else if (over) {
        showGameOver();
        playSfx('over');
      }
      saveNow();
    }, ANIM_MS);

    return true;
  }

  function undo() {
    if (!undoState || animating || loading) {
      return;
    }
    generation += 1;
    if (animTimer) {
      window.clearTimeout(animTimer);
      animTimer = null;
    }
    animating = false;
    var snapshot = undoState;
    undoState = null;
    rebuildFromValues(snapshot.values);
    score = snapshot.score;
    won = snapshot.won;
    keepPlaying = snapshot.keepPlaying;
    over = false;
    updateScoreDisplay();
    hideOverlay();
    updateUndoButton();
    saveNow();
  }

  function newGame(force) {
    if (!force && score > 0 && !window.confirm('开始新游戏？当前进度会丢失。')) {
      return;
    }
    generation += 1;
    loadToken += 1;
    loading = false;
    if (animTimer) {
      window.clearTimeout(animTimer);
      animTimer = null;
    }
    animating = false;
    over = false;
    won = false;
    keepPlaying = false;
    undoState = null;
    score = 0;
    clearTiles();
    updateScoreDisplay();
    hideOverlay();
    updateUndoButton();
    spawnTile();
    spawnTile();
    saveNow();
  }

  function buildState() {
    return {
      v: 1,
      values: getValues(),
      score: score,
      best: best,
      won: won,
      keepPlaying: keepPlaying,
      sound: { sfx: sound.sfx, bgm: sound.bgm }
    };
  }

  function flushSave() {
    if (!canStorage() || saving || !pendingSave) {
      return;
    }
    var job = pendingSave;
    pendingSave = null;
    saving = true;
    setSaveStatus('saving');
    apiCall('setStorage', {
      key: STORAGE_KEY,
      data: JSON.stringify(job)
    }).then(function (result) {
      saving = false;
      if (result && result.errMsg && String(result.errMsg).indexOf(':ok') === -1) {
        setSaveStatus('error');
        return;
      }
      setSaveStatus('saved');
      flushSave();
    }).catch(function () {
      saving = false;
      setSaveStatus('error');
    });
  }

  function saveNow() {
    if (saveTimer) {
      window.clearTimeout(saveTimer);
      saveTimer = null;
    }
    if (!canStorage()) {
      setSaveStatus('unsupported');
      return;
    }
    pendingSave = buildState();
    flushSave();
  }

  function validState(state) {
    if (!state || !state.values || state.values.length !== SIZE) {
      return false;
    }
    var hasTile = false;
    for (var r = 0; r < SIZE; r += 1) {
      var row = state.values[r];
      if (!row || row.length !== SIZE) {
        return false;
      }
      for (var c = 0; c < SIZE; c += 1) {
        var value = row[c];
        if (typeof value !== 'number' || !isFinite(value) || value < 0) {
          return false;
        }
        if (value > 0) {
          if (value < 2 || (value & (value - 1)) !== 0) {
            return false;
          }
          hasTile = true;
        }
      }
    }
    if (!hasTile) {
      return false;
    }
    if (typeof state.score !== 'number' || !isFinite(state.score) || state.score < 0) {
      return false;
    }
    if (state.best !== undefined && (typeof state.best !== 'number' || !isFinite(state.best) || state.best < 0)) {
      return false;
    }
    return true;
  }

  function restoreState(state) {
    clearTiles();
    for (var r = 0; r < SIZE; r += 1) {
      for (var c = 0; c < SIZE; c += 1) {
        if (state.values[r][c]) {
          createTile(state.values[r][c], r, c, false);
        }
      }
    }
    score = Math.floor(state.score);
    best = Math.max(score, Math.floor(state.best || 0));
    won = !!state.won;
    keepPlaying = !!state.keepPlaying;
    if (state.sound && typeof state.sound === 'object') {
      sound.sfx = state.sound.sfx !== false;
      sound.bgm = !!state.sound.bgm;
    }
    renderSoundUi();
    over = !Engine.hasMoves(cells, SIZE);
    updateScoreDisplay();
    updateUndoButton();
    if (won && !keepPlaying && !over) {
      showWin();
    } else if (over) {
      showGameOver();
    }
  }

  function loadState() {
    if (!canStorage()) {
      newGame(true);
      setSaveStatus('unsupported');
      return;
    }
    var token = loadToken + 1;
    loadToken = token;
    loading = true;
    updateUndoButton();
    updateSoundButtons();
    setSaveStatus('loading');

    var timeout = window.setTimeout(function () {
      if (token !== loadToken) {
        return;
      }
      loadToken = token + 1;
      loading = false;
      updateSoundButtons();
      newGame(true);
    }, 3000);

    apiCall('getStorage', { key: STORAGE_KEY }).then(function (result) {
      if (token !== loadToken) {
        return;
      }
      window.clearTimeout(timeout);
      var parsed = null;
      var raw = result && result.data;
      if (typeof raw === 'string' && raw) {
        try {
          parsed = JSON.parse(raw);
        } catch (error) {
          parsed = null;
        }
      }
      loading = false;
      updateSoundButtons();
      if (validState(parsed)) {
        restoreState(parsed);
        setSaveStatus('saved');
      } else {
        newGame(true);
      }
    }).catch(function () {
      if (token !== loadToken) {
        return;
      }
      window.clearTimeout(timeout);
      loading = false;
      updateSoundButtons();
      newGame(true);
    });
  }

  function swipeDirection(dx, dy) {
    var ax = Math.abs(dx);
    var ay = Math.abs(dy);
    if (Math.max(ax, ay) < 24) {
      return '';
    }
    if (ax > ay) {
      return dx > 0 ? 'right' : 'left';
    }
    return dy > 0 ? 'down' : 'up';
  }

  function bindPointerInput() {
    var start = null;

    board.addEventListener('pointerdown', function (event) {
      if (!overlay.hidden) {
        return;
      }
      if (event.button !== undefined && event.button !== 0) {
        return;
      }
      start = { x: event.clientX, y: event.clientY };
      if (event.cancelable) {
        event.preventDefault();
      }
      if (board.setPointerCapture) {
        try {
          board.setPointerCapture(event.pointerId);
        } catch (error) {
          /* ignore */
        }
      }
    });

    board.addEventListener('pointerup', function (event) {
      if (!start) {
        return;
      }
      var dx = event.clientX - start.x;
      var dy = event.clientY - start.y;
      start = null;
      var direction = swipeDirection(dx, dy);
      if (direction) {
        tryMove(direction);
      }
    });

    board.addEventListener('pointercancel', function () {
      start = null;
    });
  }

  function bindTouchInput() {
    var start = null;

    board.addEventListener('touchstart', function (event) {
      if (!overlay.hidden || !event.touches.length) {
        return;
      }
      start = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    }, false);

    board.addEventListener('touchend', function (event) {
      if (!start || !event.changedTouches.length) {
        return;
      }
      var touch = event.changedTouches[0];
      var dx = touch.clientX - start.x;
      var dy = touch.clientY - start.y;
      start = null;
      var direction = swipeDirection(dx, dy);
      if (direction) {
        tryMove(direction);
      }
    }, false);

    board.addEventListener('touchcancel', function () {
      start = null;
    }, false);
  }

  function bindMouseInput() {
    var start = null;

    board.addEventListener('mousedown', function (event) {
      if (!overlay.hidden || event.button !== 0) {
        return;
      }
      event.preventDefault();
      start = { x: event.clientX, y: event.clientY };
    });

    document.addEventListener('mouseup', function (event) {
      if (!start) {
        return;
      }
      var dx = event.clientX - start.x;
      var dy = event.clientY - start.y;
      start = null;
      var direction = swipeDirection(dx, dy);
      if (direction) {
        tryMove(direction);
      }
    });
  }

  function bindKeyboard() {
    var map = {
      ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
      a: 'left', d: 'right', w: 'up', s: 'down',
      A: 'left', D: 'right', W: 'up', S: 'down'
    };
    var byCode = { 37: 'left', 38: 'up', 39: 'right', 40: 'down' };

    document.addEventListener('keydown', function (event) {
      var direction = map[event.key] || byCode[event.keyCode];
      if (!direction) {
        return;
      }
      event.preventDefault();
      tryMove(direction);
    });
  }

  function bindEvents() {
    if (sfxBtn) {
      sfxBtn.addEventListener('click', function () {
        sound.sfx = !sound.sfx;
        renderSoundUi();
        if (sound.sfx) playSfx('toggle');
        saveNow();
      });
    }
    if (bgmBtn) {
      bgmBtn.addEventListener('click', function () {
        sound.bgm = !sound.bgm;
        renderSoundUi();
        if (sound.bgm) startBgm();
        else stopBgm();
        saveNow();
      });
    }

    document.addEventListener('pointerdown', warmAudio, true);
    document.addEventListener('keydown', warmAudio, true);

    newGameBtn.addEventListener('click', function () {
      newGame(false);
    });
    undoBtn.addEventListener('click', undo);

    overlayPrimary.addEventListener('click', function () {
      if (overlayMode === 'win') {
        keepPlaying = true;
        hideOverlay();
        saveNow();
      } else if (undoState) {
        undo();
      } else {
        newGame(true);
      }
    });
    overlaySecondary.addEventListener('click', function () {
      newGame(true);
    });

    if (window.PointerEvent) {
      bindPointerInput();
    } else {
      bindTouchInput();
      bindMouseInput();
    }
    bindKeyboard();

    window.addEventListener('pagehide', function () {
      stopBgm();
      if (saveTimer) {
        window.clearTimeout(saveTimer);
        saveTimer = null;
      }
      if (canStorage() && !loading) {
        pendingSave = buildState();
        flushSave();
      }
    });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') {
        stopBgm();
      }
      if (document.visibilityState === 'hidden' && canStorage() && !loading) {
        if (saveTimer) {
          window.clearTimeout(saveTimer);
          saveTimer = null;
        }
        pendingSave = buildState();
        flushSave();
      }
    });
  }

  function init() {
    if (!Engine) {
      tilesLayer.textContent = '';
      var message = document.createElement('p');
      message.className = 'board-loading';
      message.textContent = '游戏引擎加载失败，请退出后重新打开。';
      tilesLayer.appendChild(message);
      setSaveStatus('error');
      return;
    }
    tilesLayer.textContent = '';
    bindEvents();
    renderSoundUi();
    updateSoundButtons();
    updateScoreDisplay();
    loadState();
  }

  init();
}());
