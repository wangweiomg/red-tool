/* 圣诞装饰树 · 交互与平台能力
 * 经典外置脚本；ES2017 / Chrome 61 基线。
 */
(function () {
  'use strict';

  var Data = window.ChristmasTreeData;
  var Engine = window.ChristmasTreeEngine;
  if (!Data || !Engine) {
    return;
  }

  var STORAGE_KEY = 'christmastree.v1';
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var ORN_SIZE_RATIO = 0.115;
  var DRAG_THRESHOLD = 7;

  var state = {
    screen: 'setup',
    themeId: 'blue',
    placed: [],
    result: null,
    selectedId: '',
    messageTimer: 0
  };
  var profile = { completed: 0, best: 0, favorite: '', sound: true };
  var draft = null;
  var history = [];
  var drag = null;
  var suppressClickUntil = 0;
  var cardDataUrl = '';
  var shareBusy = false;
  var loadToken = 0;
  var audioCtx = null;
  var lastPlacedSpot = '';

  var body = document.body;
  var setupScreen = document.getElementById('setup-screen');
  var stageScreen = document.getElementById('stage-screen');
  var resultScreen = document.getElementById('result-screen');
  var themeList = document.getElementById('theme-list');
  var startBtn = document.getElementById('start-btn');
  var resumeBtn = document.getElementById('resume-btn');
  var bestScoreEl = document.getElementById('best-score');
  var statCompletedEl = document.getElementById('stat-completed');
  var statBestEl = document.getElementById('stat-best');
  var statFavoriteEl = document.getElementById('stat-favorite');
  var toggleSoundBtn = document.getElementById('toggle-sound');
  var stageThemeEl = document.getElementById('stage-theme');
  var stageProgressEl = document.getElementById('stage-progress');
  var checklistEl = document.getElementById('checklist');
  var boardWrap = document.getElementById('board-wrap');
  var board = document.getElementById('board');
  var placedLayer = document.getElementById('placed-layer');
  var stageMessageEl = document.getElementById('stage-message');
  var trayEl = document.getElementById('tray');
  var undoBtn = document.getElementById('undo-btn');
  var clearBtn = document.getElementById('clear-btn');
  var doneBtn = document.getElementById('done-btn');
  var stageBackBtn = document.getElementById('stage-back');
  var resultKickerEl = document.getElementById('result-kicker');
  var resultScoreEl = document.getElementById('result-score');
  var resultTitleEl = document.getElementById('result-title');
  var resultNoteEl = document.getElementById('result-note');
  var resultPartsEl = document.getElementById('result-parts');
  var cardPreviewEl = document.getElementById('card-preview');
  var saveCardBtn = document.getElementById('save-card');
  var shareCardBtn = document.getElementById('share-card');
  var postNoteBtn = document.getElementById('post-note');
  var againBtn = document.getElementById('again-btn');
  var resultHomeBtn = document.getElementById('result-home');
  var shareStatusEl = document.getElementById('share-status');
  var saveStatusEl = document.getElementById('save-status');

  /* ---------- 平台能力封装 ---------- */

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
      saved: '已保存到本机。',
      error: '保存失败，进度仅保留在当前页面。',
      unsupported: '当前客户端不支持本地保存，进度仅在本次打开有效。',
      'load-error': '读取本地进度超时，可继续装饰。'
    };
    saveStatusEl.textContent = texts[kind] || texts.idle;
    if (kind === 'error' || kind === 'load-error') {
      saveStatusEl.className = 'save-status is-error';
    } else if (kind === 'unsupported') {
      saveStatusEl.className = 'save-status is-warn';
    } else {
      saveStatusEl.className = 'save-status';
    }
  }

  function setShareStatus(message, isError) {
    shareStatusEl.textContent = message || '';
    shareStatusEl.className = isError ? 'share-status is-error' : 'share-status';
  }

  function vibrate() {
    var miniTool = getMiniTool();
    if (!miniTool || typeof miniTool.vibrateShort !== 'function') return;
    try {
      var ret = miniTool.vibrateShort({ type: 'light' });
      if (ret && typeof ret.catch === 'function') ret.catch(function () {});
    } catch (error) {
      /* 忽略：振动只是反馈增强 */
    }
  }

  /* ---------- 音效（Web Audio 合成，不打包音频） ---------- */

  function ensureAudio() {
    if (!profile.sound) return null;
    var Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    if (!audioCtx) {
      try {
        audioCtx = new Ctor();
      } catch (error) {
        return null;
      }
    }
    if (audioCtx.state === 'suspended' && typeof audioCtx.resume === 'function') {
      try {
        audioCtx.resume();
      } catch (error) {
        /* 忽略：等待下次手势 */
      }
    }
    return audioCtx;
  }

  function tone(freq, start, duration, type, volume) {
    var ctx = ensureAudio();
    if (!ctx) return;
    try {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      var t0 = ctx.currentTime + start;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(volume || 0.12, t0 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + duration + 0.03);
    } catch (error) {
      /* 忽略：音频失败不影响装饰 */
    }
  }

  function playSfx(kind) {
    if (!profile.sound) return;
    if (kind === 'place') {
      tone(640, 0, 0.09, 'triangle', 0.09);
    } else if (kind === 'star') {
      tone(880, 0, 0.12, 'sine', 0.11);
      tone(1320, 0.1, 0.16, 'sine', 0.09);
    } else if (kind === 'remove') {
      tone(330, 0, 0.08, 'sine', 0.07);
    } else if (kind === 'complete') {
      tone(523, 0, 0.2, 'triangle', 0.1);
      tone(659, 0.1, 0.2, 'triangle', 0.1);
      tone(784, 0.2, 0.22, 'triangle', 0.1);
      tone(1047, 0.32, 0.3, 'triangle', 0.09);
    }
  }

  function renderSoundButton() {
    toggleSoundBtn.setAttribute('aria-pressed', profile.sound ? 'true' : 'false');
    toggleSoundBtn.setAttribute('aria-label', profile.sound ? '关闭音效' : '开启音效');
    if (profile.sound) {
      toggleSoundBtn.className = 'icon-btn';
    } else {
      toggleSoundBtn.className = 'icon-btn is-muted';
    }
  }

  /* ---------- 图形：SVG 挂饰 ---------- */

  function svgEl(name, attrs) {
    var el = document.createElementNS(SVG_NS, name);
    if (attrs) {
      var key;
      for (key in attrs) {
        if (Object.prototype.hasOwnProperty.call(attrs, key)) {
          el.setAttribute(key, attrs[key]);
        }
      }
    }
    return el;
  }

  function starPoints(cx, cy, outer, inner) {
    var points = [];
    var i;
    for (i = 0; i < 10; i += 1) {
      var radius = i % 2 === 0 ? outer : inner;
      var angle = -Math.PI / 2 + (Math.PI / 5) * i;
      points.push(
        (cx + Math.cos(angle) * radius).toFixed(2) + ',' +
        (cy + Math.sin(angle) * radius).toFixed(2)
      );
    }
    return points.join(' ');
  }

  function buildOrnamentIcon(def) {
    var svg = svgEl('svg', { viewBox: '0 0 64 64', 'aria-hidden': 'true', focusable: 'false' });
    var color = def.color;
    switch (def.type) {
      case 'ball':
        svg.appendChild(svgEl('line', {
          x1: 32, y1: 3, x2: 32, y2: 15, stroke: '#c9d6ea', 'stroke-width': 2
        }));
        svg.appendChild(svgEl('rect', {
          x: 28, y: 12, width: 8, height: 7, rx: 2, fill: '#e6edf8'
        }));
        svg.appendChild(svgEl('circle', { cx: 32, cy: 39, r: 20, fill: color }));
        svg.appendChild(svgEl('ellipse', {
          cx: 25, cy: 31, rx: 6, ry: 8, fill: '#ffffff', opacity: 0.32
        }));
        break;
      case 'star':
        svg.appendChild(svgEl('polygon', {
          points: starPoints(32, 34, 27, 11), fill: color
        }));
        svg.appendChild(svgEl('polygon', {
          points: starPoints(32, 34, 16, 6), fill: '#fff6cf', opacity: 0.75
        }));
        break;
      case 'bell':
        svg.appendChild(svgEl('path', {
          d: 'M32 10c-10 0-16 8-16 20v8H16v7h32v-7h-4v-8c0-12-6-20-16-20z',
          fill: color
        }));
        svg.appendChild(svgEl('rect', {
          x: 14, y: 45, width: 36, height: 6, rx: 3, fill: '#d9a93c'
        }));
        svg.appendChild(svgEl('circle', { cx: 32, cy: 55, r: 5, fill: '#d9a93c' }));
        svg.appendChild(svgEl('circle', { cx: 32, cy: 8, r: 4, fill: '#e6c05a' }));
        break;
      case 'candy':
        svg.appendChild(svgEl('path', {
          d: 'M23 52V31a9 9 0 0 1 18 0v3',
          fill: 'none', stroke: '#f7f2ea', 'stroke-width': 12, 'stroke-linecap': 'round'
        }));
        svg.appendChild(svgEl('path', {
          d: 'M23 52V31a9 9 0 0 1 18 0v3',
          fill: 'none', stroke: color, 'stroke-width': 12,
          'stroke-linecap': 'round', 'stroke-dasharray': '5 9'
        }));
        break;
      case 'gift':
        svg.appendChild(svgEl('rect', {
          x: 12, y: 27, width: 40, height: 29, rx: 5, fill: color
        }));
        svg.appendChild(svgEl('rect', { x: 28.5, y: 27, width: 7, height: 29, fill: '#ffd166' }));
        svg.appendChild(svgEl('rect', { x: 12, y: 35, width: 40, height: 6, fill: '#ffd166' }));
        svg.appendChild(svgEl('path', {
          d: 'M32 27c-4-8-11-12-15-8s1 9 8 8zm0 0c4-8 11-12 15-8s-1 9-8 8z',
          fill: '#ffd166'
        }));
        break;
      case 'snowman':
        svg.appendChild(svgEl('circle', { cx: 32, cy: 45, r: 16, fill: '#f2f8ff' }));
        svg.appendChild(svgEl('circle', { cx: 32, cy: 22, r: 11, fill: '#ffffff' }));
        svg.appendChild(svgEl('circle', { cx: 28, cy: 20, r: 1.7, fill: '#2b3a52' }));
        svg.appendChild(svgEl('circle', { cx: 36, cy: 20, r: 1.7, fill: '#2b3a52' }));
        svg.appendChild(svgEl('path', { d: 'M32 24l7 3-7 2z', fill: '#ff9f43' }));
        svg.appendChild(svgEl('path', { d: 'M32 12l6 4-6 4z', fill: '#d8354b' }));
        svg.appendChild(svgEl('rect', { x: 22, y: 33, width: 20, height: 6, rx: 3, fill: '#4f8ef7' }));
        break;
      default:
        svg.appendChild(svgEl('circle', { cx: 32, cy: 32, r: 18, fill: color }));
        break;
    }
    return svg;
  }

  /* ---------- 渲染：主题列表 ---------- */

  function renderThemeSelection() {
    var cards = themeList.querySelectorAll('[data-theme]');
    var i;
    for (i = 0; i < cards.length; i += 1) {
      var card = cards[i];
      var active = card.getAttribute('data-theme') === state.themeId;
      card.className = active ? 'theme-card is-active' : 'theme-card';
      card.setAttribute('aria-checked', active ? 'true' : 'false');
    }
  }

  function renderStats() {
    bestScoreEl.textContent = profile.best ? String(profile.best) : '—';
    statCompletedEl.textContent = String(profile.completed);
    statBestEl.textContent = profile.best ? String(profile.best) : '0';
    var theme = Data.findTheme(profile.favorite);
    statFavoriteEl.textContent = profile.favorite ? theme.name : '—';
  }

  function renderResume() {
    if (draft && draft.placed.length) {
      resumeBtn.hidden = false;
      resumeBtn.textContent = '继续上次的装饰（' + draft.placed.length + ' 件）';
    } else {
      resumeBtn.hidden = true;
    }
  }

  function renderSetup() {
    renderThemeSelection();
    renderStats();
    renderResume();
    startBtn.disabled = false;
  }

  /* ---------- 舞台渲染 ---------- */

  function currentTheme() {
    return Data.findTheme(state.themeId);
  }

  function hasPlacedStar() {
    for (var i = 0; i < state.placed.length; i += 1) {
      if (state.placed[i].type === 'star') return true;
    }
    return false;
  }

  function renderChecklist() {
    var theme = currentTheme();
    checklistEl.textContent = '';
    if (!theme.requirements.length) {
      var freeChip = document.createElement('span');
      freeChip.className = 'check-chip is-done';
      freeChip.textContent = '自由发挥 · 已挂 ' + state.placed.length + ' 件';
      checklistEl.appendChild(freeChip);
      return;
    }
    var progress = Engine.requirementProgress(theme, state.placed);
    for (var i = 0; i < progress.length; i += 1) {
      var item = progress[i];
      var chip = document.createElement('span');
      chip.className = item.done ? 'check-chip is-done' : 'check-chip';
      chip.textContent = item.label + ' ' + item.have + '/' + item.need;
      checklistEl.appendChild(chip);
    }
  }

  function updateStageProgress() {
    var theme = currentTheme();
    if (!theme.requirements.length) {
      stageProgressEl.textContent = '已挂 ' + state.placed.length + ' 件';
    } else {
      var progress = Engine.requirementProgress(theme, state.placed);
      var have = 0;
      var need = 0;
      for (var i = 0; i < progress.length; i += 1) {
        have += progress[i].have;
        need += progress[i].need;
      }
      stageProgressEl.textContent = have + ' / ' + need + ' 项';
    }
  }

  function buildTray() {
    trayEl.textContent = '';
    for (var i = 0; i < Data.ornaments.length; i += 1) {
      var def = Data.ornaments[i];
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tray-item';
      btn.setAttribute('data-ornament', def.id);
      btn.setAttribute('aria-label', def.name);
      var iconWrap = document.createElement('span');
      iconWrap.className = 'tray-icon';
      iconWrap.appendChild(buildOrnamentIcon(def));
      var label = document.createElement('span');
      label.textContent = def.name;
      btn.appendChild(iconWrap);
      btn.appendChild(label);
      trayEl.appendChild(btn);
    }
  }

  function renderTraySelection() {
    var items = trayEl.querySelectorAll('[data-ornament]');
    for (var i = 0; i < items.length; i += 1) {
      var id = items[i].getAttribute('data-ornament');
      var selected = id === state.selectedId;
      items[i].className = selected ? 'tray-item is-selected' : 'tray-item';
      items[i].setAttribute('aria-pressed', selected ? 'true' : 'false');
    }
  }

  function renderPlaced() {
    placedLayer.textContent = '';
    for (var i = 0; i < state.placed.length; i += 1) {
      (function (item, index) {
        var def = Data.findOrnament(item.ornamentId) || {
          id: item.ornamentId, name: '挂饰', type: item.type, color: item.color
        };
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'orn' + (item.type === 'star' ? ' orn-star' : '');
        if (item.spotId === lastPlacedSpot) {
          btn.className += ' is-new';
        }
        btn.style.left = (item.x * 100).toFixed(2) + '%';
        btn.style.top = (item.y * 100).toFixed(2) + '%';
        btn.setAttribute('aria-label', '取下' + def.name);
        btn.appendChild(buildOrnamentIcon(def));
        btn.addEventListener('click', function (event) {
          event.stopPropagation();
          removeAt(index);
        });
        placedLayer.appendChild(btn);
      }(state.placed[i], i));
    }
    lastPlacedSpot = '';
    renderHints();
  }

  function renderHints() {
    var old = placedLayer.querySelectorAll('.orn-hint');
    var i;
    for (i = 0; i < old.length; i += 1) {
      placedLayer.removeChild(old[i]);
    }
    if (!state.selectedId) return;
    var def = Data.findOrnament(state.selectedId);
    if (!def) return;
    var spots = def.type === 'star' ? [Data.topSpot] : Data.spots;
    for (i = 0; i < spots.length; i += 1) {
      var spot = spots[i];
      if (!Engine.canPlace(def, spot)) continue;
      var occupied = false;
      for (var j = 0; j < state.placed.length; j += 1) {
        if (state.placed[j].spotId === spot.id) occupied = true;
      }
      if (occupied) continue;
      var hint = document.createElement('span');
      hint.className = 'orn-hint';
      hint.style.left = (spot.x * 100).toFixed(2) + '%';
      hint.style.top = (spot.y * 100).toFixed(2) + '%';
      placedLayer.appendChild(hint);
    }
  }

  function layoutBoard() {
    var w = boardWrap.clientWidth;
    var h = boardWrap.clientHeight;
    if (!w || !h) return;
    var width = Math.min(w, h * 0.75);
    var height = width / 0.75;
    board.style.width = Math.round(width) + 'px';
    board.style.height = Math.round(height) + 'px';
    var size = Math.max(26, Math.round(width * ORN_SIZE_RATIO));
    board.style.setProperty('--orn-size', size + 'px');
  }

  function renderStage() {
    var theme = currentTheme();
    stageThemeEl.textContent = theme.name;
    buildTray();
    renderTraySelection();
    renderPlaced();
    renderChecklist();
    updateStageProgress();
    stageMessageEl.className = 'stage-message';
    stageMessageEl.textContent = theme.requirements.length ?
      '把挂饰拖到树上，或者先点挂饰再点树上的虚线位置。' :
      '自由发挥：挂 8 件以上、左右对称，更容易拿高分。';
  }

  /* ---------- 消息与音效反馈 ---------- */

  function message(text, isWarn) {
    stageMessageEl.textContent = text;
    stageMessageEl.className = isWarn ? 'stage-message is-warn' : 'stage-message';
    if (state.messageTimer) {
      clearTimeout(state.messageTimer);
    }
    state.messageTimer = setTimeout(function () {
      state.messageTimer = 0;
      stageMessageEl.className = 'stage-message';
      var theme = currentTheme();
      stageMessageEl.textContent = theme.requirements.length ?
        '把挂饰拖到树上，或者先点挂饰再点树上的虚线位置。' :
        '自由发挥：挂 8 件以上、左右对称，更容易拿高分。';
    }, 2600);
  }

  /* ---------- 放置 / 移除 / 撤销 ---------- */

  function pushHistory() {
    history.push(state.placed.slice());
    if (history.length > 40) history.shift();
  }

  function pickSpotAt(def, nx, ny, maxDistance) {
    if (def.type === 'star') {
      return hasPlacedStar() ? null : Data.topSpot;
    }
    var pool = [];
    for (var i = 0; i < Data.spots.length; i += 1) {
      if (Engine.canPlace(def, Data.spots[i])) pool.push(Data.spots[i]);
    }
    return Engine.findSpot(pool, nx, ny, state.placed, maxDistance);
  }

  function placeOrnament(def, spot) {
    if (!def) return;
    if (!spot) {
      if (def.type === 'star' && hasPlacedStar()) {
        message('树顶已经有一颗星星了。', false);
      } else if (def.type === 'star') {
        message('星星挂在树顶。', false);
      } else {
        message('这棵树上没有空位了，先取下一件吧。', true);
      }
      return;
    }
    var next = Engine.placeAt(state.placed, def, spot);
    if (!next) {
      message(def.type === 'star' ? '星星只能挂在树顶。' : '树顶留给星星吧。', true);
      return;
    }
    pushHistory();
    state.placed = next;
    lastPlacedSpot = spot.id;
    state.selectedId = '';
    renderPlaced();
    renderChecklist();
    updateStageProgress();
    renderTraySelection();
    playSfx(def.type === 'star' ? 'star' : 'place');
    vibrate();
    persistSoon();
    if (def.type === 'star') {
      message('树顶亮起来了。', false);
    } else {
      message('挂好了，继续挑下一件吧。', false);
    }
    if (state.placed.length >= Data.spots.length + 1) {
      message('整棵树都挂满了，可以点「完成装饰」。', false);
    }
  }

  function removeAt(index) {
    if (index < 0 || index >= state.placed.length) return;
    pushHistory();
    state.placed.splice(index, 1);
    renderPlaced();
    renderChecklist();
    updateStageProgress();
    playSfx('remove');
    vibrate();
    persistSoon();
    message('已取下，点「撤销」可以放回来。', false);
  }

  /* ---------- 拖拽 ---------- */

  function onTrayPointerDown(event) {
    var target = event.target;
    while (target && target !== trayEl && !target.getAttribute('data-ornament')) {
      target = target.parentNode;
    }
    if (!target || target === trayEl) return;
    var id = target.getAttribute('data-ornament');
    var def = Data.findOrnament(id);
    if (!def) return;
    event.preventDefault();
    drag = {
      def: def,
      id: id,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      ghost: null,
      pointerId: event.pointerId,
      source: target
    };
    document.addEventListener('pointermove', onDragMove);
    document.addEventListener('pointerup', onDragEnd);
    document.addEventListener('pointercancel', onDragCancel);
  }

  function buildGhost(def) {
    var ghost = document.createElement('div');
    ghost.className = 'drag-ghost';
    ghost.appendChild(buildOrnamentIcon(def));
    body.appendChild(ghost);
    return ghost;
  }

  function moveGhost(clientX, clientY) {
    drag.ghost.style.transform = 'translate3d(' + clientX + 'px,' + clientY + 'px,0)';
  }

  function onDragMove(event) {
    if (!drag) return;
    var dx = event.clientX - drag.startX;
    var dy = event.clientY - drag.startY;
    if (!drag.moved && Math.sqrt(dx * dx + dy * dy) >= DRAG_THRESHOLD) {
      drag.moved = true;
      drag.ghost = buildGhost(drag.def);
    }
    if (drag.moved) {
      event.preventDefault();
      moveGhost(event.clientX, event.clientY);
    }
  }

  function endDragListeners() {
    document.removeEventListener('pointermove', onDragMove);
    document.removeEventListener('pointerup', onDragEnd);
    document.removeEventListener('pointercancel', onDragCancel);
  }

  function dropAt(clientX, clientY) {
    var rect = board.getBoundingClientRect();
    var inside = clientX >= rect.left && clientX <= rect.right &&
      clientY >= rect.top && clientY <= rect.bottom;
    if (!inside) {
      message('拖到树上才会挂上去。', true);
      return;
    }
    var nx = (clientX - rect.left) / rect.width;
    var ny = (clientY - rect.top) / rect.height;
    var spot = pickSpotAt(drag.def, nx, ny, 0.32);
    if (!spot) {
      message('这里挂不上，换个空位试试。', true);
      return;
    }
    placeOrnament(drag.def, spot);
  }

  function onDragEnd(event) {
    if (!drag) return;
    var current = drag;
    endDragListeners();
    if (current.ghost && current.ghost.parentNode) {
      current.ghost.parentNode.removeChild(current.ghost);
    }
    if (current.moved) {
      suppressClickUntil = Date.now() + 350;
      dropAt(event.clientX, event.clientY);
    } else {
      selectOrnament(current.id);
    }
    drag = null;
  }

  function onDragCancel() {
    if (!drag) return;
    endDragListeners();
    if (drag.ghost && drag.ghost.parentNode) {
      drag.ghost.parentNode.removeChild(drag.ghost);
    }
    drag = null;
  }

  function selectOrnament(id) {
    if (state.selectedId === id) {
      state.selectedId = '';
    } else {
      state.selectedId = id;
    }
    renderTraySelection();
    renderHints();
    var def = Data.findOrnament(state.selectedId);
    if (def) {
      message(def.type === 'star' ?
        '点树顶放上星星。' : '点树上任意虚线位置放下' + def.name + '。', false);
    } else {
      message('已取消选择。', false);
    }
  }

  function onBoardClick(event) {
    if (Date.now() < suppressClickUntil) return;
    var target = event.target;
    while (target && target !== board) {
      if (target.className && String(target.className).indexOf('orn') !== -1) return;
      target = target.parentNode;
    }
    if (!state.selectedId) return;
    var def = Data.findOrnament(state.selectedId);
    if (!def) return;
    var rect = board.getBoundingClientRect();
    var nx = (event.clientX - rect.left) / rect.width;
    var ny = (event.clientY - rect.top) / rect.height;
    if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return;
    var spot = pickSpotAt(def, nx, ny, 0.3);
    placeOrnament(def, spot);
  }

  /* ---------- 完成与评分 ---------- */

  function finishDecoration() {
    if (!state.placed.length) {
      message('先挂几件挂饰再完成吧。', true);
      return;
    }
    var theme = currentTheme();
    var result = Engine.scoreBuild(theme, state.placed);
    state.result = result;

    profile.completed += 1;
    if (result.score > profile.best) profile.best = result.score;
    profile.favorite = theme.id;
    draft = null;
    playSfx('complete');
    vibrate();

    renderResult();
    showScreen('result');
    persistSoon();
    window.scrollTo(0, 0);
  }

  function renderResult() {
    var theme = currentTheme();
    var result = state.result;
    resultKickerEl.textContent = theme.name + ' · 完成';
    resultScoreEl.textContent = String(result.score);
    resultTitleEl.textContent = result.title;
    resultNoteEl.textContent = result.note;

    resultPartsEl.textContent = '';
    for (var i = 0; i < result.parts.length; i += 1) {
      var part = result.parts[i];
      var chip = document.createElement('div');
      chip.className = 'part-chip';
      var label = document.createElement('span');
      label.textContent = part.label;
      var value = document.createElement('strong');
      value.textContent = part.percent + '%';
      chip.appendChild(label);
      chip.appendChild(value);
      resultPartsEl.appendChild(chip);
    }

    var miniTool = getMiniTool();
    var canSave = !!miniTool && typeof miniTool.saveImageToPhotosAlbum === 'function';
    var canShare = !!miniTool && typeof miniTool.share === 'function';
    var canPost = !!miniTool && typeof miniTool.postNote === 'function';
    saveCardBtn.hidden = !canSave;
    shareCardBtn.hidden = !canShare;
    postNoteBtn.hidden = !canPost;
    if (!canSave && !canShare && !canPost) {
      setShareStatus('当前版本不支持直接保存、分享或发布笔记，可截图明信片。', true);
    } else {
      setShareStatus('', false);
    }

    cardDataUrl = generateCard(theme, result);
    if (cardDataUrl) {
      cardPreviewEl.src = cardDataUrl;
      cardPreviewEl.hidden = false;
      saveCardBtn.disabled = false;
      shareCardBtn.disabled = false;
      postNoteBtn.disabled = false;
    } else {
      cardPreviewEl.hidden = true;
      setShareStatus('当前环境无法生成明信片，可截图结果页。', true);
    }
  }

  /* ---------- 明信片绘制 ---------- */

  function roundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.arcTo(x + width, y, x + width, y + radius, radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
    ctx.lineTo(x + radius, y + height);
    ctx.arcTo(x, y + height, x, y + height - radius, radius);
    ctx.lineTo(x, y + radius);
    ctx.arcTo(x, y, x + radius, y, radius);
    ctx.closePath();
  }

  function starPath(ctx, cx, cy, outer, inner) {
    var i;
    ctx.beginPath();
    for (i = 0; i < 10; i += 1) {
      var radius = i % 2 === 0 ? outer : inner;
      var angle = -Math.PI / 2 + (Math.PI / 5) * i;
      var x = cx + Math.cos(angle) * radius;
      var y = cy + Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function snowNoise(seed) {
    var value = Math.sin(seed * 12.9898) * 43758.5453;
    return value - Math.floor(value);
  }

  function drawOrnamentCanvas(ctx, item, x, y, size) {
    var s = size;
    var color = item.color;
    if (item.type === 'ball') {
      var r = s * 0.32;
      ctx.strokeStyle = '#c9d6ea';
      ctx.lineWidth = Math.max(1, s * 0.035);
      ctx.beginPath();
      ctx.moveTo(x, y - s * 0.52);
      ctx.lineTo(x, y - r - s * 0.06);
      ctx.stroke();
      ctx.fillStyle = '#e6edf8';
      ctx.fillRect(x - s * 0.06, y - r - s * 0.1, s * 0.12, s * 0.1);
      var gradient = ctx.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.15, x, y, r);
      gradient.addColorStop(0, '#ffffff');
      gradient.addColorStop(0.35, color);
      gradient.addColorStop(1, color);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2, false);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.ellipse(x - r * 0.38, y - r * 0.38, r * 0.22, r * 0.3, -0.5, 0, Math.PI * 2, false);
      ctx.fill();
    } else if (item.type === 'star') {
      ctx.fillStyle = color;
      starPath(ctx, x, y, s * 0.44, s * 0.18);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,246,207,0.75)';
      starPath(ctx, x, y, s * 0.26, s * 0.1);
      ctx.fill();
    } else if (item.type === 'bell') {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x - s * 0.28, y + s * 0.18);
      ctx.quadraticCurveTo(x - s * 0.3, y - s * 0.34, x, y - s * 0.34);
      ctx.quadraticCurveTo(x + s * 0.3, y - s * 0.34, x + s * 0.28, y + s * 0.18);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#d9a93c';
      ctx.fillRect(x - s * 0.32, y + s * 0.18, s * 0.64, s * 0.1);
      ctx.beginPath();
      ctx.arc(x, y + s * 0.36, s * 0.08, 0, Math.PI * 2, false);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y - s * 0.38, s * 0.06, 0, Math.PI * 2, false);
      ctx.fill();
    } else if (item.type === 'candy') {
      ctx.lineCap = 'round';
      ctx.lineWidth = s * 0.18;
      ctx.strokeStyle = '#f7f2ea';
      ctx.beginPath();
      ctx.moveTo(x - s * 0.12, y + s * 0.36);
      ctx.lineTo(x - s * 0.12, y - s * 0.06);
      ctx.arc(x + s * 0.02, y - s * 0.06, s * 0.14, Math.PI, 0, false);
      ctx.lineTo(x + s * 0.16, y + s * 0.16);
      ctx.stroke();
      ctx.strokeStyle = color;
      ctx.setLineDash([s * 0.06, s * 0.11]);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (item.type === 'gift') {
      ctx.fillStyle = color;
      roundedRect(ctx, x - s * 0.32, y - s * 0.1, s * 0.64, s * 0.46, s * 0.05);
      ctx.fill();
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(x - s * 0.055, y - s * 0.1, s * 0.11, s * 0.46);
      ctx.fillRect(x - s * 0.32, y + s * 0.04, s * 0.64, s * 0.09);
      ctx.beginPath();
      ctx.moveTo(x, y - s * 0.1);
      ctx.quadraticCurveTo(x - s * 0.34, y - s * 0.42, x - s * 0.3, y - s * 0.2);
      ctx.quadraticCurveTo(x - s * 0.24, y - s * 0.08, x, y - s * 0.1);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x, y - s * 0.1);
      ctx.quadraticCurveTo(x + s * 0.34, y - s * 0.42, x + s * 0.3, y - s * 0.2);
      ctx.quadraticCurveTo(x + s * 0.24, y - s * 0.08, x, y - s * 0.1);
      ctx.fill();
    } else if (item.type === 'snowman') {
      ctx.fillStyle = '#f2f8ff';
      ctx.beginPath();
      ctx.arc(x, y + s * 0.2, s * 0.24, 0, Math.PI * 2, false);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x, y - s * 0.16, s * 0.17, 0, Math.PI * 2, false);
      ctx.fill();
      ctx.fillStyle = '#2b3a52';
      ctx.beginPath();
      ctx.arc(x - s * 0.06, y - s * 0.2, s * 0.025, 0, Math.PI * 2, false);
      ctx.arc(x + s * 0.06, y - s * 0.2, s * 0.025, 0, Math.PI * 2, false);
      ctx.fill();
      ctx.fillStyle = '#ff9f43';
      ctx.beginPath();
      ctx.moveTo(x, y - s * 0.14);
      ctx.lineTo(x + s * 0.12, y - s * 0.1);
      ctx.lineTo(x, y - s * 0.08);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#d8354b';
      ctx.beginPath();
      ctx.moveTo(x, y - s * 0.32);
      ctx.lineTo(x + s * 0.12, y - s * 0.26);
      ctx.lineTo(x, y - s * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#4f8ef7';
      ctx.fillRect(x - s * 0.16, y - s * 0.02, s * 0.32, s * 0.07);
    } else {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, s * 0.3, 0, Math.PI * 2, false);
      ctx.fill();
    }
  }

  function todayLabel() {
    var date = new Date();
    var month = date.getMonth() + 1;
    var day = date.getDate();
    return date.getFullYear() + '.' + (month < 10 ? '0' : '') + month + '.' +
      (day < 10 ? '0' : '') + day;
  }

  function generateCard(theme, result) {
    var canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 1200;
    var ctx;
    try {
      ctx = canvas.getContext && canvas.getContext('2d');
    } catch (error) {
      ctx = null;
    }
    if (!ctx) return '';

    var background = ctx.createLinearGradient(0, 0, 0, 1200);
    background.addColorStop(0, '#122343');
    background.addColorStop(0.55, '#0d1930');
    background.addColorStop(1, '#070f1c');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, 900, 1200);

    var glow = ctx.createRadialGradient(450, 210, 30, 450, 210, 520);
    glow.addColorStop(0, 'rgba(111, 177, 255, 0.22)');
    glow.addColorStop(1, 'rgba(111, 177, 255, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 900, 900);

    var i;
    for (i = 0; i < 46; i += 1) {
      var sx = snowNoise(i + 1) * 900;
      var sy = snowNoise(i + 51) * 860;
      var sr = 0.8 + snowNoise(i + 101) * 1.9;
      ctx.fillStyle = 'rgba(255, 255, 255, ' + (0.16 + snowNoise(i + 151) * 0.45).toFixed(2) + ')';
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2, false);
      ctx.fill();
    }

    ctx.textAlign = 'left';
    ctx.fillStyle = '#8fe3c0';
    ctx.font = '600 19px "Noto Sans CJK SC", sans-serif';
    ctx.fillText('MERRY CHRISTMAS', 70, 96);

    ctx.fillStyle = '#ffffff';
    ctx.font = '800 46px "Noto Sans CJK SC", sans-serif';
    ctx.fillText('圣诞装饰树', 70, 150);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#a9b8d6';
    ctx.font = '22px "Noto Sans CJK SC", sans-serif';
    ctx.fillText(todayLabel(), 830, 96);
    ctx.textAlign = 'left';

    ctx.fillStyle = theme.accent;
    ctx.font = '600 26px "Noto Sans CJK SC", sans-serif';
    ctx.fillText('主题 · ' + theme.name, 70, 200);

    var area = { x: 165, y: 236, w: 570, h: 760 };

    function px(nx) { return area.x + nx * area.w; }
    function py(ny) { return area.y + ny * area.h; }

    ctx.fillStyle = 'rgba(10, 28, 46, 0.9)';
    ctx.beginPath();
    ctx.ellipse(px(0.5), py(0.955), area.w * 0.46, area.h * 0.022, 0, 0, Math.PI * 2, false);
    ctx.fill();

    var layers = Data.tree.layers;
    for (i = 0; i < layers.length; i += 1) {
      var layer = layers[i];
      ctx.beginPath();
      ctx.moveTo(px(0.5), py(layer.apexY));
      ctx.lineTo(px(0.5 - layer.halfBase), py(layer.baseY));
      ctx.lineTo(px(0.5 + layer.halfBase), py(layer.baseY));
      ctx.closePath();
      ctx.fillStyle = layer.fill;
      ctx.fill();
      ctx.strokeStyle = layer.edge;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    var trunk = Data.tree.trunk;
    ctx.fillStyle = '#7a4a26';
    ctx.fillRect(px(trunk.x), py(trunk.y), trunk.width * area.w, trunk.height * area.h);
    ctx.fillStyle = '#8d582e';
    ctx.fillRect(px(trunk.x), py(trunk.y), trunk.width * area.w * 0.4, trunk.height * area.h);

    var ornSize = area.w * 0.115;
    for (i = 0; i < state.placed.length; i += 1) {
      var item = state.placed[i];
      drawOrnamentCanvas(ctx, item, px(item.x), py(item.y), ornSize);
    }

    ctx.textAlign = 'center';
    var scoreText = String(result.score);
    ctx.font = '800 92px "Noto Sans CJK SC", sans-serif';
    var scoreWidth = ctx.measureText(scoreText).width;
    ctx.font = '600 26px "Noto Sans CJK SC", sans-serif';
    var unitWidth = ctx.measureText('分').width;
    var startX = 450 - (scoreWidth + 10 + unitWidth) / 2;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffd166';
    ctx.font = '800 92px "Noto Sans CJK SC", sans-serif';
    ctx.fillText(scoreText, startX, 1070);
    ctx.fillStyle = '#a9b8d6';
    ctx.font = '600 26px "Noto Sans CJK SC", sans-serif';
    ctx.fillText('分', startX + scoreWidth + 10, 1070);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 38px "Noto Sans CJK SC", sans-serif';
    ctx.fillText(result.title, 450, 1126);

    ctx.fillStyle = '#a9b8d6';
    ctx.font = '22px "Noto Sans CJK SC", sans-serif';
    ctx.fillText(result.note, 450, 1162);

    ctx.fillStyle = '#5f7093';
    ctx.font = '18px "Noto Sans CJK SC", sans-serif';
    ctx.fillText('圣诞装饰树 · 我的圣诞树', 450, 1192);

    try {
      return canvas.toDataURL('image/jpeg', 0.9);
    } catch (error) {
      return '';
    }
  }

  /* ---------- 保存 / 分享 / 发布笔记 ---------- */

  function saveCard() {
    if (!cardDataUrl || shareBusy) return;
    var miniTool = getMiniTool();
    if (!miniTool || typeof miniTool.saveImageToPhotosAlbum !== 'function') {
      setShareStatus('当前版本不支持保存到相册，可截图明信片。', true);
      return;
    }
    shareBusy = true;
    saveCardBtn.disabled = true;
    setShareStatus('正在保存…', false);
    apiCall('saveImageToPhotosAlbum', { filePath: cardDataUrl }).then(function () {
      shareBusy = false;
      saveCardBtn.disabled = false;
      setShareStatus('已保存到相册。', false);
    }).catch(function (error) {
      shareBusy = false;
      saveCardBtn.disabled = false;
      setShareStatus('保存失败' + (error && error.errCode ? '（' + error.errCode + '）' : '') + '，可截图明信片。', true);
    });
  }

  function shareCard() {
    if (!cardDataUrl || shareBusy) return;
    var miniTool = getMiniTool();
    if (!miniTool || typeof miniTool.share !== 'function') {
      setShareStatus('当前版本不支持直接分享，请先保存明信片。', true);
      return;
    }
    shareBusy = true;
    shareCardBtn.disabled = true;
    setShareStatus('正在打开分享…', false);
    apiCall('share', { type: 'image', image_resource: cardDataUrl }).then(function () {
      shareBusy = false;
      shareCardBtn.disabled = false;
      setShareStatus('已打开分享面板（成功仅表示流程已启动）。', false);
    }).catch(function (error) {
      shareBusy = false;
      shareCardBtn.disabled = false;
      var code = error && error.errCode;
      if (code === 15503) {
        setShareStatus('今天的分享次数已用完，可保存图片后手动分享。', true);
      } else if (code === 15502) {
        setShareStatus('分享面板未打开，请在小工具全屏中重试，或保存图片。', true);
      } else {
        setShareStatus('分享失败，可保存图片后手动分享。', true);
      }
    });
  }

  function publishNote() {
    if (!cardDataUrl || shareBusy) return;
    var miniTool = getMiniTool();
    if (!miniTool || typeof miniTool.postNote !== 'function') {
      setShareStatus('当前版本不支持发布笔记，请先保存明信片。', true);
      return;
    }
    var theme = currentTheme();
    var result = state.result;
    var title = '我的圣诞树：' + theme.name;
    var content = '我在「圣诞装饰树」按「' + theme.name + '」装饰了一棵圣诞树，得了 ' +
      result.score + ' 分（' + result.title + '）。来挂一棵你的？';
    shareBusy = true;
    postNoteBtn.disabled = true;
    setShareStatus('正在打开笔记发布页…', false);
    apiCall('postNote', {
      title: title,
      content: content,
      pageType: 'photo_publish',
      mediaInfo: { image_resources: [{ url: cardDataUrl }] }
    }).then(function () {
      shareBusy = false;
      postNoteBtn.disabled = false;
      setShareStatus('已打开笔记发布页，发布结果以平台为准。', false);
    }).catch(function (error) {
      shareBusy = false;
      postNoteBtn.disabled = false;
      setShareStatus('打开笔记发布页失败' + (error && error.errCode ? '（' + error.errCode + '）' : '') + '，可先保存图片。', true);
    });
  }

  /* ---------- 本地存储 ---------- */

  var saveTimer = 0;
  var saving = false;
  var pendingPayload = '';

  function sanitizePlaced(raw) {
    if (!Array.isArray(raw)) return [];
    var list = [];
    for (var i = 0; i < raw.length && list.length < Data.spots.length + 1; i += 1) {
      var item = raw[i];
      if (!item || !item.spotId) continue;
      var def = Data.findOrnament(item.ornamentId);
      if (!def) continue;
      var spot = item.spotId === Data.topSpot.id ? Data.topSpot : null;
      if (!spot) {
        for (var j = 0; j < Data.spots.length; j += 1) {
          if (Data.spots[j].id === item.spotId) spot = Data.spots[j];
        }
      }
      if (!spot || !Engine.canPlace(def, spot)) continue;
      var duplicate = false;
      for (var k = 0; k < list.length; k += 1) {
        if (list[k].spotId === spot.id) duplicate = true;
      }
      if (duplicate) continue;
      list.push({
        ornamentId: def.id,
        type: def.type,
        color: def.color,
        spotId: spot.id,
        x: spot.x,
        y: spot.y
      });
    }
    return list;
  }

  function sanitizeProfile(raw) {
    if (!raw || typeof raw !== 'object') return;
    if (typeof raw.completed === 'number' && isFinite(raw.completed) && raw.completed >= 0) {
      profile.completed = Math.floor(raw.completed);
    }
    if (typeof raw.best === 'number' && isFinite(raw.best)) {
      profile.best = Math.max(0, Math.min(100, Math.round(raw.best)));
    }
    if (typeof raw.favorite === 'string' && Data.findTheme(raw.favorite).id === raw.favorite) {
      profile.favorite = raw.favorite;
    }
    profile.sound = raw.sound !== false;
  }

  function buildPayload() {
    var savedDraft = null;
    if (state.screen === 'stage' && state.placed.length) {
      savedDraft = { themeId: state.themeId, placed: state.placed };
    } else if (draft && draft.placed.length) {
      savedDraft = { themeId: draft.themeId, placed: draft.placed };
    }
    return {
      v: 1,
      profile: {
        completed: profile.completed,
        best: profile.best,
        favorite: profile.favorite,
        sound: profile.sound
      },
      draft: savedDraft
    };
  }

  function flushSave() {
    if (!canStorage() || saving || !pendingPayload) return;
    var payload = pendingPayload;
    pendingPayload = '';
    saving = true;
    apiCall('setStorage', { key: STORAGE_KEY, data: payload }).then(function (result) {
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

  function persistSoon() {
    if (!canStorage()) {
      setSaveStatus('unsupported');
      return;
    }
    pendingPayload = JSON.stringify(buildPayload());
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      saveTimer = 0;
      flushSave();
    }, 250);
  }

  function loadSaved() {
    if (!canStorage()) {
      setSaveStatus('unsupported');
      return;
    }
    var token = ++loadToken;
    setSaveStatus('loading');
    apiCall('getStorage', { key: STORAGE_KEY }).then(function (result) {
      if (token !== loadToken) return;
      var raw = result && result.data;
      if (typeof raw !== 'string' || !raw) {
        setSaveStatus('idle');
        return;
      }
      var saved;
      try {
        saved = JSON.parse(raw);
      } catch (error) {
        setSaveStatus('idle');
        return;
      }
      if (!saved || saved.v !== 1) {
        setSaveStatus('idle');
        return;
      }
      sanitizeProfile(saved.profile);
      if (saved.draft && typeof saved.draft === 'object') {
        var placed = sanitizePlaced(saved.draft.placed);
        if (placed.length) {
          var theme = Data.findTheme(saved.draft.themeId);
          draft = { themeId: theme.id, placed: placed };
        }
      }
      renderSoundButton();
      renderSetup();
      setSaveStatus('saved');
    }).catch(function () {
      if (token !== loadToken) return;
      setSaveStatus('load-error');
    });
  }

  /* ---------- 屏幕切换 ---------- */

  function showScreen(name) {
    state.screen = name;
    setupScreen.hidden = name !== 'setup';
    stageScreen.hidden = name !== 'stage';
    resultScreen.hidden = name !== 'result';
    if (name === 'stage') {
      body.classList.add('in-stage');
    } else {
      body.classList.remove('in-stage');
    }
    if (name === 'stage') {
      window.setTimeout(layoutBoard, 0);
      window.requestAnimationFrame(layoutBoard);
    }
  }

  function startTheme(themeId, resumeDraft) {
    var theme = Data.findTheme(themeId);
    state.themeId = theme.id;
    state.result = null;
    state.selectedId = '';
    history = [];
    if (resumeDraft && draft && draft.themeId === theme.id) {
      state.placed = draft.placed.slice();
    } else {
      state.placed = [];
    }
    draft = null;
    showScreen('stage');
    renderStage();
    persistSoon();
  }

  function goHome() {
    if (state.screen === 'stage' && state.placed.length) {
      draft = { themeId: state.themeId, placed: state.placed.slice() };
    }
    state.screen = 'setup';
    state.selectedId = '';
    state.placed = [];
    state.result = null;
    renderSetup();
    showScreen('setup');
    persistSoon();
    window.scrollTo(0, 0);
  }

  /* ---------- 事件绑定 ---------- */

  function bindEvents() {
    themeList.addEventListener('click', function (event) {
      var target = event.target;
      while (target && target !== themeList && !target.getAttribute('data-theme')) {
        target = target.parentNode;
      }
      if (!target || target === themeList) return;
      var id = target.getAttribute('data-theme');
      if (!Data.findTheme(id)) return;
      state.themeId = id;
      renderThemeSelection();
      startBtn.textContent = id === 'free' ? '开始自由装饰' : '开始装饰';
    });

    startBtn.addEventListener('click', function () {
      startTheme(state.themeId, false);
    });

    resumeBtn.addEventListener('click', function () {
      if (!draft) return;
      startTheme(draft.themeId, true);
    });

    toggleSoundBtn.addEventListener('click', function () {
      profile.sound = !profile.sound;
      renderSoundButton();
      if (!profile.sound && audioCtx && typeof audioCtx.suspend === 'function') {
        try {
          audioCtx.suspend();
        } catch (error) {
          /* 忽略 */
        }
      } else if (profile.sound) {
        tone(880, 0, 0.1, 'sine', 0.08);
      }
      persistSoon();
    });

    trayEl.addEventListener('pointerdown', onTrayPointerDown);
    board.addEventListener('click', onBoardClick);

    undoBtn.addEventListener('click', function () {
      if (!history.length) {
        message('还没有可以撤销的步骤。', false);
        return;
      }
      state.placed = history.pop();
      renderPlaced();
      renderChecklist();
      updateStageProgress();
      renderTraySelection();
      persistSoon();
      message('已撤销上一步。', false);
    });

    clearBtn.addEventListener('click', function () {
      if (!state.placed.length) {
        message('树上还是空的。', false);
        return;
      }
      pushHistory();
      state.placed = [];
      state.selectedId = '';
      renderPlaced();
      renderTraySelection();
      renderChecklist();
      updateStageProgress();
      persistSoon();
      message('已经清空，点「撤销」可以恢复。', false);
    });

    doneBtn.addEventListener('click', finishDecoration);
    stageBackBtn.addEventListener('click', goHome);

    saveCardBtn.addEventListener('click', saveCard);
    shareCardBtn.addEventListener('click', shareCard);
    postNoteBtn.addEventListener('click', publishNote);

    againBtn.addEventListener('click', function () {
      startTheme(state.themeId, false);
    });

    resultHomeBtn.addEventListener('click', goHome);

    var resizeTimer = 0;
    function onResize() {
      updateAppHeight();
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(layoutBoard, 120);
    }
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
  }

  function updateAppHeight() {
    var height = window.innerHeight || document.documentElement.clientHeight;
    if (height) {
      document.documentElement.style.setProperty('--app-height', height + 'px');
    }
  }

  /* ---------- 启动 ---------- */

  function boot() {
    updateAppHeight();
    renderSoundButton();
    renderSetup();
    bindEvents();
    loadSaved();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}());
