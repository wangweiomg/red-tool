(function () {
  'use strict';

  var Engine = window.GameHuarongEngine;
  var STORAGE_KEY = 'huarongdao.v1.state';
  var ROWS = 5;
  var COLS = 4;

  var board = document.getElementById('board');
  var boardInner = document.querySelector('.board-inner');
  var blocksLayer = document.getElementById('blocks');
  var movesEl = document.getElementById('moves');
  var bestEl = document.getElementById('best');
  var undoBtn = document.getElementById('undo');
  var restartBtn = document.getElementById('restart');
  var overlay = document.getElementById('overlay');
  var overlayTitle = document.getElementById('overlay-title');
  var overlayDesc = document.getElementById('overlay-desc');
  var overlayPrimary = document.getElementById('overlay-primary');
  var overlaySecondary = document.getElementById('overlay-secondary');
  var saveStatus = document.getElementById('save-status');
  var sfxBtn = document.getElementById('toggle-sfx');
  var bgmBtn = document.getElementById('toggle-bgm');

  var blocks = Engine ? Engine.createInitial() : [];
  var blockEls = {};
  var selectedId = 'cao';
  var moveCount = 0;
  var best = null;
  var history = [];
  var solved = false;
  var loading = false;
  var drag = null;
  var winTimer = null;

  var loadToken = 0;
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
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume || 0.06), t0 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + (duration || 0.12));
      osc.connect(gain);
      gain.connect(audio.master);
      osc.start(t0);
      osc.stop(t0 + (duration || 0.12) + 0.03);
    } catch (error) {
      /* 音频失败不影响游戏 */
    }
  }

  function playSfx(kind) {
    if (!sound.sfx) return;
    if (kind === 'select') {
      tone(520, 0, 0.06, 'sine', 0.04);
    } else if (kind === 'move') {
      tone(170, 0, 0.06, 'triangle', 0.05);
      tone(255, 0.015, 0.07, 'sine', 0.03);
    } else if (kind === 'blocked') {
      tone(110, 0, 0.08, 'sine', 0.045);
    } else if (kind === 'win') {
      var notes = [62, 66, 69, 74];
      for (var i = 0; i < notes.length; i += 1) {
        tone(midiFreq(notes[i]), i * 0.15, 0.45, 'triangle', 0.075);
      }
    } else if (kind === 'undo') {
      tone(330, 0, 0.08, 'sine', 0.035);
      tone(262, 0.06, 0.1, 'sine', 0.03);
    } else if (kind === 'toggle') {
      tone(660, 0, 0.1, 'sine', 0.05);
    }
  }

  // 帕赫贝尔《卡农》和弦进行（D A Bm F#m G D G A）的舒缓改编
  var BGM_CHORDS = [
    { tones: [62, 66, 69], bass: 38, melody: 78 },
    { tones: [57, 61, 64], bass: 45, melody: 76 },
    { tones: [59, 62, 66], bass: 47, melody: 74 },
    { tones: [54, 57, 61], bass: 42, melody: 73 },
    { tones: [55, 59, 62], bass: 43, melody: 71 },
    { tones: [50, 54, 57], bass: 38, melody: 69 },
    { tones: [55, 59, 62], bass: 43, melody: 71 },
    { tones: [57, 61, 64], bass: 45, melody: 73 }
  ];
  var BGM_PATTERN = [0, 1, 2, 1, 0, 1, 2, 1];
  var BGM_STEP_MS = 380;

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
      var stepIndex = audio.bgmStep;
      var chordIndex = Math.floor(stepIndex / 8) % BGM_CHORDS.length;
      var chord = BGM_CHORDS[chordIndex];
      var inChord = stepIndex % 8;
      tone(midiFreq(chord.tones[BGM_PATTERN[inChord]]), 0, 0.55, 'triangle', 0.022);
      if (inChord === 0) {
        tone(midiFreq(chord.bass), 0, 2.6, 'sine', 0.028);
        tone(midiFreq(chord.melody), 0.08, 2.2, 'sine', 0.03);
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
      unsupported: '当前客户端不支持本地保存，进度仅在本次打开有效。',
      'load-error': '读取本地进度超时，可继续游戏；保存会覆盖本地记录。'
    };
    saveStatus.textContent = texts[kind] || texts.idle;
    if (kind === 'error' || kind === 'load-error') {
      saveStatus.className = 'save-status is-error';
    } else if (kind === 'unsupported') {
      saveStatus.className = 'save-status is-warn';
    } else {
      saveStatus.className = 'save-status';
    }
  }

  function positionElement(el, block) {
    if (!el) {
      return;
    }
    el.style.left = (block.c * 25) + '%';
    el.style.top = (block.r * 20) + '%';
    el.style.width = (block.w * 25) + '%';
    el.style.height = (block.h * 20) + '%';
    el.setAttribute('aria-label',
      block.name + '，' + block.w + ' 列 ' + block.h + ' 行，第 ' +
      (block.r + 1) + ' 行第 ' + (block.c + 1) + ' 列');
    el.setAttribute('aria-pressed', block.id === selectedId ? 'true' : 'false');
  }

  function createBlockElement(block) {
    var el = document.createElement('button');
    el.type = 'button';
    el.className = 'block kind-' + block.kind + ' b-' + block.id;
    el.setAttribute('data-block', block.id);
    var inner = document.createElement('span');
    inner.className = 'block-inner';
    inner.textContent = block.name;
    el.appendChild(inner);
    positionElement(el, block);
    blocksLayer.appendChild(el);
    blockEls[block.id] = el;
    return el;
  }

  function rebuildBlocks() {
    blocksLayer.textContent = '';
    blockEls = {};
    for (var i = 0; i < blocks.length; i += 1) {
      createBlockElement(blocks[i]);
    }
    updateSelection();
  }

  function updateSelection() {
    for (var id in blockEls) {
      if (Object.prototype.hasOwnProperty.call(blockEls, id)) {
        var el = blockEls[id];
        if (id === selectedId) {
          el.className = el.className.replace(/\s*is-selected/g, '') + ' is-selected';
        } else {
          el.className = el.className.replace(/\s*is-selected/g, '');
        }
        el.setAttribute('aria-pressed', id === selectedId ? 'true' : 'false');
      }
    }
  }

  function updateStats() {
    movesEl.textContent = String(moveCount);
    bestEl.textContent = best === null ? '—' : String(best);
  }

  function updateUndoButton() {
    undoBtn.disabled = history.length === 0 || loading;
  }

  function snapshot() {
    return {
      positions: Engine.serialize(blocks),
      moves: moveCount
    };
  }

  function applySnapshot(state) {
    for (var i = 0; i < blocks.length; i += 1) {
      var block = blocks[i];
      var pos = state.positions[block.id];
      if (pos) {
        block.r = pos.r;
        block.c = pos.c;
      }
      positionElement(blockEls[block.id], block);
    }
    moveCount = state.moves;
  }

  function clearWinTimer() {
    if (winTimer) {
      window.clearTimeout(winTimer);
      winTimer = null;
    }
  }

  function showWin() {
    overlayTitle.textContent = '曹操出逃成功！';
    overlayDesc.textContent = '用了 ' + moveCount + ' 步完成。最少步数：' +
      (best === null ? '—' : best) + '。';
    overlaySecondary.hidden = history.length === 0;
    overlay.hidden = false;
  }

  function hideOverlay() {
    overlay.hidden = true;
  }

  function scheduleWin() {
    clearWinTimer();
    winTimer = window.setTimeout(function () {
      winTimer = null;
      if (solved) {
        playSfx('win');
        showWin();
      }
    }, 240);
  }

  function attemptMove(blockId, dr, dc) {
    if (!Engine || loading || solved) {
      return false;
    }
    if (!Engine.canMove(blocks, blockId, dr, dc)) {
      playSfx('blocked');
      return false;
    }

    history.push(snapshot());
    if (history.length > 200) {
      history.shift();
    }

    var block = Engine.findBlock(blocks, blockId);
    block.r += dr;
    block.c += dc;
    positionElement(blockEls[blockId], block);
    playSfx('move');

    selectedId = blockId;
    moveCount += 1;
    updateStats();
    updateSelection();
    updateUndoButton();

    if (Engine.isSolved(blocks)) {
      solved = true;
      if (best === null || moveCount < best) {
        best = moveCount;
        updateStats();
      }
      scheduleWin();
    }

    saveNow();
    return true;
  }

  function undo() {
    if (!history.length || loading) {
      return;
    }
    clearWinTimer();
    var state = history.pop();
    applySnapshot(state);
    solved = false;
    hideOverlay();
    updateStats();
    updateUndoButton();
    updateSelection();
    saveNow();
  }

  function restart(force) {
    if (!force && moveCount > 0 && !window.confirm('重新开始？当前步数会清零。')) {
      return;
    }
    clearWinTimer();
    blocks = Engine.createInitial();
    moveCount = 0;
    history = [];
    solved = false;
    selectedId = 'cao';
    rebuildBlocks();
    updateStats();
    updateUndoButton();
    hideOverlay();
    saveNow();
  }

  function buildState() {
    return {
      v: 1,
      positions: Engine.serialize(blocks),
      moves: moveCount,
      best: best,
      solved: solved,
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
    if (!canStorage()) {
      setSaveStatus('unsupported');
      return;
    }
    pendingSave = buildState();
    flushSave();
  }

  function isInteger(value) {
    return typeof value === 'number' && isFinite(value) && Math.floor(value) === value;
  }

  function parseStoredState(raw) {
    if (typeof raw !== 'string' || !raw) {
      return null;
    }
    var data;
    try {
      data = JSON.parse(raw);
    } catch (error) {
      return null;
    }
    if (!data || !data.positions) {
      return null;
    }

    var restored = Engine.createInitial();
    for (var i = 0; i < restored.length; i += 1) {
      var block = restored[i];
      var pos = data.positions[block.id];
      if (!pos || !isInteger(pos.r) || !isInteger(pos.c)) {
        return null;
      }
      block.r = pos.r;
      block.c = pos.c;
    }
    if (!Engine.isValidLayout(restored)) {
      return null;
    }

    var moves = isInteger(data.moves) && data.moves >= 0 ? data.moves : 0;
    var bestValue = null;
    if (isInteger(data.best) && data.best >= 0) {
      bestValue = data.best;
    }
    if (Engine.isSolved(restored) && bestValue === null) {
      bestValue = moves;
    }

    var soundState = null;
    if (data.sound && typeof data.sound === 'object') {
      soundState = {
        sfx: data.sound.sfx !== false,
        bgm: !!data.sound.bgm
      };
    }

    return {
      blocks: restored,
      moves: moves,
      best: bestValue,
      sound: soundState
    };
  }

  function restoreState(state) {
    blocks = state.blocks;
    moveCount = state.moves;
    best = state.best;
    history = [];
    selectedId = 'cao';
    if (state.sound) {
      sound.sfx = state.sound.sfx !== false;
      sound.bgm = !!state.sound.bgm;
    }
    renderSoundUi();
    solved = Engine.isSolved(blocks);
    rebuildBlocks();
    updateStats();
    updateUndoButton();
    if (solved) {
      showWin();
    } else {
      hideOverlay();
    }
  }

  function resetToInitial() {
    blocks = Engine.createInitial();
    moveCount = 0;
    best = null;
    history = [];
    selectedId = 'cao';
    solved = false;
    rebuildBlocks();
    updateStats();
    updateUndoButton();
    hideOverlay();
  }

  function loadState() {
    if (!canStorage()) {
      resetToInitial();
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
      resetToInitial();
      setSaveStatus('load-error');
    }, 3000);

    apiCall('getStorage', { key: STORAGE_KEY }).then(function (result) {
      if (token !== loadToken) {
        return;
      }
      window.clearTimeout(timeout);
      loading = false;
      updateSoundButtons();
      var state = parseStoredState(result && result.data);
      if (state) {
        restoreState(state);
        setSaveStatus('saved');
      } else {
        resetToInitial();
        setSaveStatus('idle');
      }
    }).catch(function () {
      if (token !== loadToken) {
        return;
      }
      window.clearTimeout(timeout);
      loading = false;
      updateSoundButtons();
      resetToInitial();
      setSaveStatus('idle');
    });
  }

  function closestWithAttr(node, attr, boundary) {
    while (node && node !== boundary) {
      if (node.nodeType === 1 && node.getAttribute && node.getAttribute(attr) !== null) {
        return node;
      }
      node = node.parentNode;
    }
    return null;
  }

  function beginDrag(blockId, x, y) {
    var rect = boardInner.getBoundingClientRect();
    drag = {
      id: blockId,
      lastX: x,
      lastY: y,
      stepX: rect.width / COLS * 0.42,
      stepY: rect.height / ROWS * 0.42
    };
    selectedId = blockId;
    updateSelection();
    var el = blockEls[blockId];
    if (el && el.focus) {
      el.focus();
    }
  }

  function moveDrag(x, y) {
    if (!drag) {
      return;
    }
    var steps = 0;
    while (steps < 3) {
      var dx = x - drag.lastX;
      var dy = y - drag.lastY;
      var absX = Math.abs(dx);
      var absY = Math.abs(dy);

      if (absX >= drag.stepX && absX >= absY) {
        var signX = dx > 0 ? 1 : -1;
        if (attemptMove(drag.id, 0, signX)) {
          drag.lastX += signX * drag.stepX;
          drag.lastY = y;
          steps += 1;
        } else {
          drag.lastX = x;
          drag.lastY = y;
          break;
        }
      } else if (absY >= drag.stepY && absY > absX) {
        var signY = dy > 0 ? 1 : -1;
        if (attemptMove(drag.id, signY, 0)) {
          drag.lastY += signY * drag.stepY;
          drag.lastX = x;
          steps += 1;
        } else {
          drag.lastX = x;
          drag.lastY = y;
          break;
        }
      } else {
        break;
      }
    }
  }

  function endDrag() {
    drag = null;
  }

  function bindPointerInput() {
    blocksLayer.addEventListener('pointerdown', function (event) {
      if (event.button !== undefined && event.button !== 0) {
        return;
      }
      var el = closestWithAttr(event.target, 'data-block', blocksLayer);
      if (!el) {
        return;
      }
      if (event.cancelable) {
        event.preventDefault();
      }
      if (blocksLayer.setPointerCapture) {
        try {
          blocksLayer.setPointerCapture(event.pointerId);
        } catch (error) {
          /* ignore */
        }
      }
      beginDrag(el.getAttribute('data-block'), event.clientX, event.clientY);
    });

    blocksLayer.addEventListener('pointermove', function (event) {
      if (!drag) {
        return;
      }
      if (event.cancelable) {
        event.preventDefault();
      }
      moveDrag(event.clientX, event.clientY);
    });

    blocksLayer.addEventListener('pointerup', function (event) {
      moveDrag(event.clientX, event.clientY);
      endDrag();
    });
    blocksLayer.addEventListener('pointercancel', endDrag);
  }

  function bindTouchInput() {
    blocksLayer.addEventListener('touchstart', function (event) {
      if (!event.touches.length) {
        return;
      }
      var el = closestWithAttr(event.target, 'data-block', blocksLayer);
      if (!el) {
        return;
      }
      if (event.cancelable) {
        event.preventDefault();
      }
      var touch = event.touches[0];
      beginDrag(el.getAttribute('data-block'), touch.clientX, touch.clientY);
    }, false);

    blocksLayer.addEventListener('touchmove', function (event) {
      if (!drag || !event.touches.length) {
        return;
      }
      if (event.cancelable) {
        event.preventDefault();
      }
      moveDrag(event.touches[0].clientX, event.touches[0].clientY);
    }, false);

    blocksLayer.addEventListener('touchend', function (event) {
      if (drag && event.changedTouches.length) {
        moveDrag(event.changedTouches[0].clientX, event.changedTouches[0].clientY);
      }
      endDrag();
    }, false);
    blocksLayer.addEventListener('touchcancel', endDrag, false);
  }

  function bindMouseInput() {
    blocksLayer.addEventListener('mousedown', function (event) {
      if (event.button !== 0) {
        return;
      }
      var el = closestWithAttr(event.target, 'data-block', blocksLayer);
      if (!el) {
        return;
      }
      event.preventDefault();
      beginDrag(el.getAttribute('data-block'), event.clientX, event.clientY);
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });

    function onMouseMove(event) {
      moveDrag(event.clientX, event.clientY);
    }

    function onMouseUp(event) {
      moveDrag(event.clientX, event.clientY);
      endDrag();
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }
  }

  function bindKeyboard() {
    var map = {
      ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0],
      a: [0, -1], d: [0, 1], w: [-1, 0], s: [1, 0],
      A: [0, -1], D: [0, 1], W: [-1, 0], S: [1, 0]
    };
    var byCode = {
      37: [0, -1], 38: [-1, 0], 39: [0, 1], 40: [1, 0]
    };

    document.addEventListener('keydown', function (event) {
      var move = map[event.key] || byCode[event.keyCode];
      if (!move) {
        return;
      }
      event.preventDefault();
      if (!selectedId || !Engine.findBlock(blocks, selectedId)) {
        selectedId = 'cao';
        updateSelection();
      }
      attemptMove(selectedId, move[0], move[1]);
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

    undoBtn.addEventListener('click', undo);
    restartBtn.addEventListener('click', function () {
      restart(false);
    });

    overlayPrimary.addEventListener('click', function () {
      restart(true);
    });
    overlaySecondary.addEventListener('click', undo);

    blocksLayer.addEventListener('click', function (event) {
      var el = closestWithAttr(event.target, 'data-block', blocksLayer);
      if (!el) {
        return;
      }
      var nextSelected = el.getAttribute('data-block');
      if (nextSelected !== selectedId) {
        playSfx('select');
      }
      selectedId = nextSelected;
      updateSelection();
      if (el.focus) {
        el.focus();
      }
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
        pendingSave = buildState();
        flushSave();
      }
    });
  }

  function init() {
    if (!Engine) {
      blocksLayer.textContent = '';
      var message = document.createElement('p');
      message.className = 'board-loading';
      message.textContent = '游戏引擎加载失败，请退出后重新打开。';
      blocksLayer.appendChild(message);
      setSaveStatus('error');
      return;
    }
    blocksLayer.textContent = '';
    bindEvents();
    renderSoundUi();
    updateSoundButtons();
    rebuildBlocks();
    updateStats();
    updateUndoButton();
    loadState();
  }

  init();
}());
