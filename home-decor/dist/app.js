/* 装修实验室 · 2.5D 原型
 * Canvas 2D 等距渲染；硬装 → 软装分阶段；点选放置、旋转、移除、撤销。
 * 所有画面由代码绘制，不加载外部图片。
 */
(function () {
  'use strict';

  var Data = window.HomeDecorData;
  var Engine = window.HomeDecorEngine;
  if (!Data || !Engine) return;

  var SIZE = Engine.SIZE;
  var TW = 64;
  var TH = 32;
  var WALL_H = 104;
  var STORAGE_KEY = 'homedecor.v1.state';

  var state = {
    screen: 'setup',
    stage: 'hard',
    floor: 'oak',
    wall: 'cream',
    light: 'warm',
    items: [],
    selectedTray: '',
    selectedItem: '',
    trayRot: 0,
    history: [],
    uid: 1
  };

  var canvas = document.getElementById('room');
  var ctx = null;
  try {
    ctx = canvas.getContext && canvas.getContext('2d');
  } catch (error) {
    ctx = null;
  }

  var cssW = 0;
  var cssH = 0;
  var scale = 1;
  var tx = 0;
  var ty = 0;
  var dpr = 1;

  var setupScreen = document.getElementById('setup-screen');
  var stageScreen = document.getElementById('stage-screen');
  var resultScreen = document.getElementById('result-screen');
  var hardPanel = document.getElementById('hard-panel');
  var softPanel = document.getElementById('soft-panel');
  var trayEl = document.getElementById('tray');
  var trayHintEl = document.getElementById('tray-hint');
  var placementTipEl = document.getElementById('placement-tip');
  var autoBtn = document.getElementById('auto-btn');
  var messageEl = document.getElementById('message');
  var stepHard = document.getElementById('step-hard');
  var stepSoft = document.getElementById('step-soft');
  var rotateBtn = document.getElementById('rotate-btn');
  var removeBtn = document.getElementById('remove-btn');
  var undoBtn = document.getElementById('undo-btn');
  var finishBtn = document.getElementById('finish-btn');
  var startBtn = document.getElementById('start-btn');
  var backBtn = document.getElementById('back-btn');
  var toSoftBtn = document.getElementById('to-soft');
  var resultSubEl = document.getElementById('result-sub');
  var cardPreviewEl = document.getElementById('card-preview');
  var saveCardBtn = document.getElementById('save-card');
  var shareCardBtn = document.getElementById('share-card');
  var postNoteBtn = document.getElementById('post-note');
  var againBtn = document.getElementById('again-btn');
  var homeBtn = document.getElementById('home-btn');
  var shareStatusEl = document.getElementById('share-status');
  var saveStatusEl = document.getElementById('save-status');
  var marketScreen = document.getElementById('market-screen');
  var marketBtn = document.getElementById('market-btn');
  var marketLink = document.getElementById('market-link');
  var marketBack = document.getElementById('market-back');
  var marketBudgetEl = document.getElementById('market-budget');
  var marketCatsEl = document.getElementById('market-cats');
  var marketListEl = document.getElementById('market-list');
  var marketModal = document.getElementById('market-modal');
  var modalMask = document.getElementById('modal-mask');
  var modalClose = document.getElementById('modal-close');
  var modalCat = document.getElementById('modal-cat');
  var modalPhoto = document.getElementById('modal-photo');
  var modalName = document.getElementById('modal-name');
  var modalPrice = document.getElementById('modal-price');
  var modalSpecs = document.getElementById('modal-specs');
  var modalTip = document.getElementById('modal-tip');
  var modalBuy = document.getElementById('modal-buy');
  var sfxBtn = document.getElementById('toggle-sfx');
  var bgmBtn = document.getElementById('toggle-bgm');

  var cardDataUrl = '';
  var shareBusy = false;
  var saveTimer = 0;

  var market = { budget: 30000, owned: [] };
  var marketCat = 'paint';
  var marketReturn = 'setup';
  var detailItem = null;

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
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume || 0.05), t0 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + (duration || 0.12));
      osc.connect(gain);
      gain.connect(audio.master);
      osc.start(t0);
      osc.stop(t0 + (duration || 0.12) + 0.03);
    } catch (error) {
      /* 音频失败不影响装修 */
    }
  }

  function playSfx(kind) {
    if (!sound.sfx) return;
    if (kind === 'select') {
      tone(620, 0, 0.05, 'sine', 0.035);
    } else if (kind === 'place') {
      tone(520, 0, 0.06, 'triangle', 0.045);
      tone(780, 0.04, 0.08, 'triangle', 0.035);
    } else if (kind === 'rotate') {
      tone(480, 0, 0.05, 'sine', 0.035);
    } else if (kind === 'remove') {
      tone(300, 0, 0.08, 'sine', 0.045);
    } else if (kind === 'undo') {
      tone(420, 0, 0.06, 'sine', 0.035);
      tone(330, 0.05, 0.08, 'sine', 0.03);
    } else if (kind === 'material') {
      tone(720, 0, 0.09, 'sine', 0.04);
      tone(960, 0.05, 0.1, 'sine', 0.03);
    } else if (kind === 'finish') {
      var notes = [62, 66, 69, 74];
      for (var i = 0; i < notes.length; i += 1) {
        tone(midiFreq(notes[i]), i * 0.13, 0.42, 'triangle', 0.07);
      }
    } else if (kind === 'toggle') {
      tone(660, 0, 0.08, 'sine', 0.04);
    }
  }

  // 萨蒂《裸体歌舞》第一首的舒缓三拍子改编（公有领域作品）
  var BGM_BARS = [
    { bass: 43, tones: [59, 62, 66, 71], melody: 78 },
    { bass: 43, tones: [59, 62, 66, 71], melody: 81 },
    { bass: 50, tones: [57, 62, 66, 69], melody: 79 },
    { bass: 50, tones: [57, 62, 66, 69], melody: 78 },
    { bass: 43, tones: [59, 62, 66, 71], melody: 76 },
    { bass: 43, tones: [59, 62, 66, 71], melody: 74 },
    { bass: 50, tones: [57, 62, 66, 69], melody: 73 },
    { bass: 50, tones: [57, 62, 66, 69], melody: 74 }
  ];
  var BGM_PATTERN = [0, 1, 2, 3, 2, 1];
  var BGM_STEP_MS = 420;

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
      var barIndex = Math.floor(stepIndex / 6) % BGM_BARS.length;
      var inBar = stepIndex % 6;
      var bar = BGM_BARS[barIndex];
      tone(midiFreq(bar.tones[BGM_PATTERN[inBar]]), 0, 0.6, 'triangle', 0.018);
      if (inBar === 0) {
        tone(midiFreq(bar.bass), 0, 2.4, 'sine', 0.026);
        tone(midiFreq(bar.melody), 0.1, 2.2, 'sine', 0.028);
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
    if (sound.bgm && !audio.bgmRunning) startBgm();
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
    var disabled = !audioSupported();
    if (sfxBtn) sfxBtn.disabled = disabled;
    if (bgmBtn) bgmBtn.disabled = disabled;
    if (!audioSupported()) {
      if (sfxBtn) sfxBtn.title = '当前设备不支持声音';
      if (bgmBtn) bgmBtn.title = '当前设备不支持声音';
    }
  }

  /* ---------- 平台与存储 ---------- */

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
      'load-error': '读取本地进度超时，可以继续装修。'
    };
    saveStatusEl.textContent = texts[kind] || texts.idle;
    saveStatusEl.className = kind === 'error' || kind === 'load-error' ?
      'save-status is-error' : (kind === 'unsupported' ? 'save-status is-warn' : 'save-status');
  }

  function buildSave() {
    return {
      v: 1,
      stage: state.stage,
      floor: state.floor,
      wall: state.wall,
      light: state.light,
      items: state.items,
      uid: state.uid,
      sound: { sfx: sound.sfx, bgm: sound.bgm },
      market: { budget: market.budget, owned: market.owned }
    };
  }

  function saveNow() {
    if (!canStorage()) {
      setSaveStatus('unsupported');
      return;
    }
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = 0;
    }
    saveTimer = setTimeout(function () {
      saveTimer = 0;
      setSaveStatus('saved');
      apiCall('setStorage', {
        key: STORAGE_KEY,
        data: JSON.stringify(buildSave())
      }).catch(function () {
        setSaveStatus('error');
      });
    }, 200);
  }

  function sanitizeItems(raw, uidStart) {
    var items = [];
    var uid = uidStart || 1;
    if (!Array.isArray(raw)) return { items: items, uid: uid };
    for (var i = 0; i < raw.length; i += 1) {
      var entry = raw[i];
      if (!entry || typeof entry !== 'object') continue;
      var def = Data.findItem(entry.type);
      if (!def) continue;
      if (def.wall) {
        if ((entry.wall === 'left' || entry.wall === 'right') &&
            Engine.canPlaceWall(items, def, entry.wall, entry.pos)) {
          items.push({
            uid: 'u' + uid,
            type: def.id,
            wall: entry.wall,
            pos: entry.pos,
            w: def.w
          });
          uid += 1;
        }
      } else {
        var rot = entry.rot === 90 ? 90 : 0;
        if (Engine.canPlaceFloor(items, def, entry.x, entry.y, rot)) {
          var size = Engine.footprint(def, rot);
          items.push({
            uid: 'u' + uid,
            type: def.id,
            x: entry.x,
            y: entry.y,
            rot: rot,
            w: size.w,
            d: size.d
          });
          uid += 1;
        }
      }
    }
    return { items: items, uid: uid };
  }

  function loadSaved() {
    if (!canStorage()) {
      setSaveStatus('unsupported');
      return;
    }
    setSaveStatus('loading');
    apiCall('getStorage', { key: STORAGE_KEY }).then(function (result) {
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
      state.floor = Data.findMaterial('floor', saved.floor).id;
      state.wall = Data.findMaterial('wall', saved.wall).id;
      state.light = Data.findMaterial('light', saved.light).id;
      if (saved.sound && typeof saved.sound === 'object') {
        sound.sfx = saved.sound.sfx !== false;
        sound.bgm = !!saved.sound.bgm;
      }
      if (saved.market && typeof saved.market === 'object') {
        if (typeof saved.market.budget === 'number' && isFinite(saved.market.budget) &&
            saved.market.budget >= 0) {
          market.budget = Math.floor(saved.market.budget);
        }
        if (Array.isArray(saved.market.owned)) {
          var owned = [];
          for (var mi = 0; mi < saved.market.owned.length; mi += 1) {
            var oid = saved.market.owned[mi];
            for (var mj = 0; mj < Data.marketItems.length; mj += 1) {
              if (Data.marketItems[mj].id === oid) owned.push(oid);
            }
          }
          market.owned = owned;
        }
      }
      ensureUnlockedStyle('floor');
      ensureUnlockedStyle('wall');
      ensureUnlockedStyle('light');
      renderSoundUi();
      state.stage = saved.stage === 'soft' ? 'soft' : 'hard';
      var clean = sanitizeItems(saved.items, saved.uid);
      state.items = clean.items;
      state.uid = clean.uid;
      if (state.items.length || state.stage === 'soft') {
        showScreen('stage');
        renderStage();
        setSaveStatus('saved');
      } else {
        setSaveStatus('idle');
      }
    }).catch(function () {
      setSaveStatus('load-error');
    });
  }

  function isOwned(marketId) {
    return market.owned.indexOf(marketId) !== -1;
  }

  function availableStyles(kind) {
    var list = kind === 'floor' ? Data.floorStyles :
      (kind === 'wall' ? Data.wallStyles : Data.lightStyles);
    var result = [];
    for (var i = 0; i < list.length; i += 1) {
      if (!list[i].marketId || isOwned(list[i].marketId)) result.push(list[i]);
    }
    return result;
  }

  function ensureUnlockedStyle(kind) {
    var list = availableStyles(kind);
    var current = kind === 'floor' ? state.floor : (kind === 'wall' ? state.wall : state.light);
    for (var i = 0; i < list.length; i += 1) {
      if (list[i].id === current) return;
    }
    if (list.length) {
      if (kind === 'floor') state.floor = list[0].id;
      else if (kind === 'wall') state.wall = list[0].id;
      else state.light = list[0].id;
    }
  }

  /* ---------- 画布与等距绘制 ---------- */

  function pt(x, y) {
    return { x: (x - y) * TW / 2, y: (x + y) * TH / 2 };
  }

  function poly(g, points, fill, stroke, lineWidth) {
    g.beginPath();
    g.moveTo(points[0].x, points[0].y);
    for (var i = 1; i < points.length; i += 1) {
      g.lineTo(points[i].x, points[i].y);
    }
    g.closePath();
    if (fill) {
      g.fillStyle = fill;
      g.fill();
    }
    if (stroke) {
      g.strokeStyle = stroke;
      g.lineWidth = lineWidth || 1;
      g.stroke();
    }
  }

  function parseColor(color) {
    if (typeof color !== 'string') return null;
    var value = color.trim();
    var match = value.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
    if (match) {
      var hex = match[1];
      if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
      }
      var num = parseInt(hex, 16);
      return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
    }
    match = value.match(/^rgba?\(([^)]+)\)$/);
    if (match) {
      var parts = match[1].split(',');
      if (parts.length >= 3) {
        return [
          parseInt(parts[0], 10),
          parseInt(parts[1], 10),
          parseInt(parts[2], 10)
        ];
      }
    }
    return null;
  }

  function shade(color, amount) {
    var rgb = parseColor(color);
    if (!rgb) return color;
    function clamp(n) { return Math.max(0, Math.min(255, Math.round(n))); }
    return 'rgb(' + clamp(rgb[0] + amount) + ',' + clamp(rgb[1] + amount) + ',' + clamp(rgb[2] + amount) + ')';
  }

  function box(g, x, y, w, d, h, top, left, right) {
    var p00 = pt(x, y);
    var p10 = pt(x + w, y);
    var p11 = pt(x + w, y + d);
    var p01 = pt(x, y + d);
    function up(p) { return { x: p.x, y: p.y - h }; }
    poly(g, [p01, p11, up(p11), up(p01)], left || shade(top, -18));
    poly(g, [p10, p11, up(p11), up(p10)], right || shade(top, -34));
    poly(g, [up(p00), up(p10), up(p11), up(p01)], top);
  }

  function fitCanvas() {
    if (!canvas || !ctx) return;
    var wrap = canvas.parentNode;
    cssW = wrap.clientWidth;
    if (!cssW) return;
    cssH = Math.round(cssW * 0.78);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.height = cssH + 'px';
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var pad = 12;
    var scaleX = (cssW - pad * 2) / (SIZE * TW);
    var scaleY = (cssH - pad * 2) / (SIZE * TH + WALL_H);
    scale = Math.min(scaleX, scaleY);
    tx = cssW / 2;
    ty = (cssH - (SIZE * TH + WALL_H) * scale) / 2 + WALL_H * scale;
  }

  function drawScene(g, options) {
    var opts = options || {};
    var floorStyle = Data.findMaterial('floor', state.floor);
    var wallStyle = Data.findMaterial('wall', state.wall);
    var lightStyle = Data.findMaterial('light', state.light);

    drawFloor(g, floorStyle);
    if (state.selectedTray && !opts.plain) drawPlacementHighlight(g);
    drawWalls(g, wallStyle);

    if (opts.grid) drawGrid(g);
    drawWallItems(g, wallStyle);
    drawFloorItems(g);

    if (lightStyle && !opts.plain) {
      var center = pt(SIZE / 2, SIZE / 2);
      var glow = g.createRadialGradient(center.x, center.y - 30, 20, center.x, center.y - 30, SIZE * TW * 0.62);
      glow.addColorStop(0, lightStyle.glow);
      glow.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = glow;
      g.beginPath();
      g.arc(center.x, center.y - 30, SIZE * TW * 0.62, 0, Math.PI * 2, false);
      g.fill();
    }
    if (opts.selection) drawSelection(g);
  }

  function drawFloor(g, style) {
    for (var row = 0; row < SIZE; row += 1) {
      for (var col = 0; col < SIZE; col += 1) {
        var p1 = pt(col, row);
        var p2 = pt(col + 1, row);
        var p3 = pt(col + 1, row + 1);
        var p4 = pt(col, row + 1);
        var fill = (col + row) % 2 === 0 ? style.base : style.accent;
        poly(g, [p1, p2, p3, p4], fill, style.line, 0.6);
      }
    }
    if (style.id === 'oak') {
      g.strokeStyle = 'rgba(150, 110, 70, 0.25)';
      g.lineWidth = 0.8;
      for (var i = 1; i < SIZE; i += 1) {
        var a = pt(i, 0);
        var b = pt(i, SIZE);
        g.beginPath();
        g.moveTo(a.x, a.y);
        g.lineTo(b.x, b.y);
        g.stroke();
      }
    } else if (style.id === 'terrazzo') {
      g.fillStyle = 'rgba(130, 120, 100, 0.22)';
      for (var k = 0; k < 40; k += 1) {
        var x = (k * 37 % 100) / 100 * SIZE;
        var y = (k * 61 % 100) / 100 * SIZE;
        var dot = pt(x, y);
        g.beginPath();
        g.arc(dot.x, dot.y, 1.2, 0, Math.PI * 2, false);
        g.fill();
      }
    }
  }

  function drawPlacementHighlight(g) {
    var used = Engine.occupiedMap(state.items);
    for (var row = 0; row < SIZE; row += 1) {
      for (var col = 0; col < SIZE; col += 1) {
        if (used[col + ',' + row]) continue;
        var p1 = pt(col, row);
        var p2 = pt(col + 1, row);
        var p3 = pt(col + 1, row + 1);
        var p4 = pt(col, row + 1);
        poly(g, [p1, p2, p3, p4], 'rgba(255, 196, 96, 0.28)', 'rgba(200, 140, 50, 0.45)', 1);
      }
    }
  }

  function drawWalls(g, style) {
    var corner = pt(0, 0);
    var rightEnd = pt(SIZE, 0);
    var leftEnd = pt(0, SIZE);
    var top = function (p) { return { x: p.x, y: p.y - WALL_H }; };

    poly(g, [corner, rightEnd, top(rightEnd), top(corner)], style.base, style.line, 1);
    poly(g, [corner, leftEnd, top(leftEnd), top(corner)], shade(style.base, -8), style.line, 1);

    // 顶部与底部线条
    g.strokeStyle = style.line;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(top(corner).x, top(corner).y);
    g.lineTo(top(rightEnd).x, top(rightEnd).y);
    g.moveTo(top(corner).x, top(corner).y);
    g.lineTo(top(leftEnd).x, top(leftEnd).y);
    g.stroke();

    // 踢脚线
    var plinth = 7;
    poly(g, [corner, rightEnd, { x: rightEnd.x, y: rightEnd.y - plinth }, { x: corner.x, y: corner.y - plinth }],
      shade(style.shade, -14));
    poly(g, [corner, leftEnd, { x: leftEnd.x, y: leftEnd.y - plinth }, { x: corner.x, y: corner.y - plinth }],
      shade(style.shade, -22));
  }

  function drawGrid(g) {
    g.strokeStyle = 'rgba(120, 95, 65, 0.18)';
    g.lineWidth = 0.7;
    for (var i = 0; i <= SIZE; i += 1) {
      var a = pt(i, 0);
      var b = pt(i, SIZE);
      g.beginPath();
      g.moveTo(a.x, a.y);
      g.lineTo(b.x, b.y);
      g.stroke();
      var c = pt(0, i);
      var d = pt(SIZE, i);
      g.beginPath();
      g.moveTo(c.x, c.y);
      g.lineTo(d.x, d.y);
      g.stroke();
    }
  }

  function sortFloorItems() {
    return state.items.filter(function (item) {
      return !item.wall;
    }).sort(function (a, b) {
      return (a.x + a.y + (a.w + a.d) / 2) - (b.x + b.y + (b.w + b.d) / 2);
    });
  }

  function drawFloorItems(g) {
    var list = sortFloorItems();
    for (var i = 0; i < list.length; i += 1) {
      drawFloorItem(g, list[i]);
    }
  }

  function drawFloorItem(g, item) {
    var def = Data.findItem(item.type);
    if (!def) return;
    var x = item.x;
    var y = item.y;
    var w = item.w;
    var d = item.d;
    var rot = item.rot;
    if (def.id === 'rug') {
      var p1 = pt(x + 0.06, y + 0.06);
      var p2 = pt(x + w - 0.06, y + 0.06);
      var p3 = pt(x + w - 0.06, y + d - 0.06);
      var p4 = pt(x + 0.06, y + d - 0.06);
      poly(g, [p1, p2, p3, p4], def.color, def.accent, 1);
      var q1 = pt(x + 0.35, y + 0.35);
      var q2 = pt(x + w - 0.35, y + 0.35);
      var q3 = pt(x + w - 0.35, y + d - 0.35);
      var q4 = pt(x + 0.35, y + d - 0.35);
      poly(g, [q1, q2, q3, q4], 'rgba(255,255,255,0.25)', def.accent, 0.8);
    } else if (def.id === 'sofa') {
      box(g, x, y, w, d, 16, def.color, shade(def.color, -10), shade(def.color, -24));
      if (rot === 90) {
        box(g, x, y, w * 0.32, d, 38, def.accent);
        box(g, x + w * 0.32, y, w * 0.68, d * 0.16, 26, shade(def.color, 6));
        box(g, x + w * 0.32, y + d * 0.84, w * 0.68, d * 0.16, 26, shade(def.color, 6));
        box(g, x + w * 0.36, y + d * 0.2, w * 0.56, d * 0.28, 22, '#f6efe2');
        box(g, x + w * 0.36, y + d * 0.52, w * 0.56, d * 0.28, 22, '#f6efe2');
      } else {
        box(g, x, y, w, d * 0.32, 38, def.accent);
        box(g, x, y + d * 0.32, w * 0.16, d * 0.68, 26, shade(def.color, 6));
        box(g, x + w * 0.84, y + d * 0.32, w * 0.16, d * 0.68, 26, shade(def.color, 6));
        box(g, x + w * 0.2, y + d * 0.36, w * 0.28, d * 0.56, 22, '#f6efe2');
        box(g, x + w * 0.52, y + d * 0.36, w * 0.28, d * 0.56, 22, '#f6efe2');
      }
    } else if (def.id === 'bed') {
      box(g, x, y, w, d, 12, '#c9a87c', shade('#c9a87c', -8), shade('#c9a87c', -20));
      box(g, x + 0.06, y + 0.06, w - 0.12, d - 0.12, 10, def.color);
      box(g, x + 0.12, y + 0.1, w * 0.32, d * 0.26, 8, '#ffffff');
      box(g, x + 0.56, y + 0.1, w * 0.32, d * 0.26, 8, '#ffffff');
      box(g, x + 0.06, y + d * 0.42, w - 0.12, d * 0.5, 6, def.accent);
    } else if (def.id === 'coffee') {
      box(g, x + 0.14, y + 0.14, w - 0.28, d - 0.28, 14, def.color, shade(def.color, -8), shade(def.color, -22));
      box(g, x + 0.08, y + 0.08, w - 0.16, d - 0.16, 3, shade(def.color, 16));
    } else if (def.id === 'shelf') {
      box(g, x + 0.08, y + 0.08, w - 0.16, d - 0.16, def.h, def.color, shade(def.color, -10), shade(def.color, -24));
      for (var i = 1; i <= 3; i += 1) {
        var hline = def.h * i / 4;
        g.strokeStyle = shade(def.color, -30);
        g.lineWidth = 1;
        var a = pt(x + 0.08, y + d - 0.08);
        var b = pt(x + w - 0.08, y + d - 0.08);
        g.beginPath();
        g.moveTo(a.x, a.y - hline);
        g.lineTo(b.x, b.y - hline);
        g.stroke();
      }
    } else if (def.id === 'tv') {
      box(g, x + 0.05, y + 0.2, w - 0.1, d - 0.3, 16, def.color, shade(def.color, -8), shade(def.color, -20));
      var sx = x + w * 0.12;
      var sy = y + d * 0.28;
      box(g, sx, sy, w * 0.76, d * 0.16, 30, '#2f3a42', '#1f272d', '#141a1f');
    } else if (def.id === 'chair') {
      box(g, x + 0.15, y + 0.15, w - 0.3, d - 0.3, 16, def.color, shade(def.color, -8), shade(def.color, -20));
      box(g, x + 0.15, y + 0.12, w - 0.3, d * 0.16, 36, def.accent);
    } else if (def.id === 'side') {
      box(g, x + 0.15, y + 0.15, w - 0.3, d - 0.3, 18, def.color, shade(def.color, -8), shade(def.color, -20));
      box(g, x + 0.1, y + 0.1, w - 0.2, d - 0.2, 3, shade(def.color, 14));
    } else if (def.id === 'plant') {
      box(g, x + 0.3, y + 0.3, w - 0.6, d - 0.6, 14, '#b98b63', '#a3774f', '#8c6541');
      var center = pt(x + w / 2, y + d / 2);
      g.fillStyle = def.accent;
      for (var k = 0; k < 5; k += 1) {
        var angle = -Math.PI / 2 + (k - 2) * 0.5;
        g.beginPath();
        g.ellipse(center.x + Math.cos(angle) * 12, center.y - 34 + Math.sin(angle) * 8,
          9, 15, angle + Math.PI / 2, 0, Math.PI * 2, false);
        g.fill();
      }
      g.fillStyle = def.color;
      g.beginPath();
      g.ellipse(center.x, center.y - 44, 11, 16, 0, 0, Math.PI * 2, false);
      g.fill();
    } else if (def.id === 'lamp') {
      var base = pt(x + w / 2, y + d / 2);
      box(g, x + 0.4, y + 0.4, w - 0.8, d - 0.8, 4, '#c9b08c');
      g.strokeStyle = '#b99a6a';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(base.x, base.y);
      g.lineTo(base.x, base.y - def.h + 10);
      g.stroke();
      poly(g, [
        { x: base.x - 16, y: base.y - def.h + 10 },
        { x: base.x + 16, y: base.y - def.h + 10 },
        { x: base.x + 10, y: base.y - def.h - 4 },
        { x: base.x - 10, y: base.y - def.h - 4 }
      ], def.color, '#c9ae7d');
    }
  }

  function drawWallItems(g, wallStyle) {
    for (var i = 0; i < state.items.length; i += 1) {
      var item = state.items[i];
      if (!item.wall) continue;
      var def = Data.findItem(item.type);
      if (!def) continue;
      if (def.id === 'art') {
        var h1 = 40;
        var h2 = h1 + def.h;
        var outer = wallQuad(item.wall, item.pos, item.pos + item.w, h1, h2);
        poly(g, outer, '#ffffff', def.accent, 1.5);
        var inner = wallQuad(item.wall, item.pos + 0.2, item.pos + item.w - 0.2, h1 + 8, h2 - 8);
        poly(g, inner, def.color, def.accent, 1);
        var dot = wallPoint(item.wall, item.pos + item.w / 2, (h1 + h2) / 2);
        g.fillStyle = 'rgba(160, 120, 70, 0.35)';
        g.beginPath();
        g.arc(dot.x, dot.y, 7, 0, Math.PI * 2, false);
        g.fill();
      } else if (def.id === 'curtain') {
        var topH = 100;
        var quad = wallQuad(item.wall, item.pos, item.pos + item.w, 0, topH);
        poly(g, quad, 'rgba(250, 244, 232, 0.82)', 'rgba(200, 180, 150, 0.5)', 1);
        g.strokeStyle = 'rgba(190, 165, 130, 0.35)';
        g.lineWidth = 1;
        for (var k = 1; k < 6; k += 1) {
          var p = item.pos + item.w * k / 6;
          var bottom = wallPoint(item.wall, p, 0);
          var top = wallPoint(item.wall, p, topH);
          g.beginPath();
          g.moveTo(bottom.x, bottom.y);
          g.lineTo(top.x, top.y);
          g.stroke();
        }
      }
    }
  }

  function wallPoint(wall, pos, height) {
    var base = wall === 'left' ? pt(pos, 0) : pt(0, pos);
    return { x: base.x, y: base.y - height };
  }

  function wallQuad(wall, start, end, h1, h2) {
    return [
      wallPoint(wall, start, h1),
      wallPoint(wall, end, h1),
      wallPoint(wall, end, h2),
      wallPoint(wall, start, h2)
    ];
  }

  function drawSelection(g) {
    if (!state.selectedItem) return;
    var item = Engine.findItem(state.items, state.selectedItem);
    if (!item) return;
    g.strokeStyle = '#d89a3c';
    g.lineWidth = 2;
    if (item.wall) {
      var quad = wallQuad(item.wall, item.pos, item.pos + item.w, 0, 90);
      poly(g, quad, null, '#d89a3c', 2);
    } else {
      var p1 = pt(item.x, item.y);
      var p2 = pt(item.x + item.w, item.y);
      var p3 = pt(item.x + item.w, item.y + item.d);
      var p4 = pt(item.x, item.y + item.d);
      poly(g, [p1, p2, p3, p4], 'rgba(255, 209, 102, 0.18)', '#d89a3c', 2);
    }
  }

  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, cssW, cssH);
    var bg = ctx.createLinearGradient(0, 0, 0, cssH);
    bg.addColorStop(0, '#fffdf8');
    bg.addColorStop(1, '#f6ecdc');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, cssW, cssH);

    ctx.save();
    ctx.translate(tx, ty);
    ctx.scale(scale, scale);
    drawScene(ctx, { grid: state.stage === 'soft', selection: true });
    ctx.restore();

    // 底部投影
    ctx.fillStyle = 'rgba(150, 120, 85, 0.10)';
    ctx.beginPath();
    ctx.ellipse(tx, ty + SIZE * TH * scale + 6, SIZE * TW * scale * 0.32, 10, 0, 0, Math.PI * 2, false);
    ctx.fill();
  }

  /* ---------- 放置与交互 ---------- */

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function canvasPoint(event) {
    var rect = canvas.getBoundingClientRect();
    var px = event.clientX - rect.left;
    var py = event.clientY - rect.top;
    var wx = (px - tx) / scale;
    var wy = (py - ty) / scale;
    var fx = (wx / (TW / 2) + wy / (TH / 2)) / 2;
    var fy = (wy / (TH / 2) - wx / (TW / 2)) / 2;
    return { x: fx, y: fy };
  }

  function message(text, isWarn) {
    messageEl.textContent = text;
    messageEl.className = isWarn ? 'message is-warn' : 'message';
  }

  function pushHistory() {
    state.history.push(state.items.slice());
    if (state.history.length > 60) state.history.shift();
  }

  function updateButtons() {
    removeBtn.disabled = !state.selectedItem;
    undoBtn.disabled = !state.history.length;
    finishBtn.disabled = false;
    if (autoBtn) autoBtn.disabled = !state.selectedTray;
  }

  function updateSelection() {
    updateButtons();
    draw();
  }

  function placeSelectedTrayItem(event) {
    var def = Data.findItem(state.selectedTray);
    if (!def) return;
    var coords = canvasPoint(event);
    var next = null;
    if (def.wall) {
      var wall = '';
      var pos = 0;
      if (coords.y < -0.2 && Math.abs(coords.y) >= Math.abs(coords.x)) {
        wall = 'left';
        pos = clamp(Math.floor(coords.x), 0, SIZE - def.w);
      } else if (coords.x < -0.2) {
        wall = 'right';
        pos = clamp(Math.floor(coords.y), 0, SIZE - def.w);
      } else {
        message('挂画和窗帘要点墙面放置。', true);
        return;
      }
      if (!Engine.canPlaceWall(state.items, def, wall, pos)) {
        message('这里放不下，换个墙面位置吧。', true);
        return;
      }
      pushHistory();
      next = Engine.placeWall(state.items, def, wall, pos, 'u' + state.uid);
      if (!next) return;
      state.uid += 1;
      state.items = next;
      playSfx('place');
      message('挂好了。点它可以选择旋转或移除。', false);
    } else {
      var tileX = Math.floor(coords.x);
      var tileY = Math.floor(coords.y);
      if (tileX < 0 || tileY < 0 || tileX >= SIZE || tileY >= SIZE) {
        message('点到房间里才能放置。', true);
        return;
      }
      if (!Engine.canPlaceFloor(state.items, def, tileX, tileY, state.trayRot)) {
        message('这里放不下，换个位置试试。', true);
        return;
      }
      pushHistory();
      next = Engine.placeFloor(state.items, def, tileX, tileY, state.trayRot, 'u' + state.uid);
      if (!next) return;
      state.uid += 1;
      state.items = next;
      playSfx('place');
      message('放好了，继续挑下一件吧。', false);
    }
    state.selectedTray = '';
    state.selectedItem = '';
    state.trayRot = 0;
    renderTray();
    updateSelection();
    saveNow();
  }

  function selectAt(event) {
    var coords = canvasPoint(event);
    if (coords.y < -0.2 && Math.abs(coords.y) >= Math.abs(coords.x)) {
      var pos = clamp(Math.floor(coords.x), 0, SIZE - 1);
      for (var i = 0; i < state.items.length; i += 1) {
        var item = state.items[i];
        if (item.wall === 'left' && pos >= item.pos && pos < item.pos + item.w) {
          state.selectedItem = item.uid;
          state.selectedTray = '';
          message('已选中挂饰，可以旋转或移除。', false);
          renderTray();
          updateSelection();
          return;
        }
      }
    } else if (coords.x < -0.2) {
      var pos2 = clamp(Math.floor(coords.y), 0, SIZE - 1);
      for (var j = 0; j < state.items.length; j += 1) {
        var item2 = state.items[j];
        if (item2.wall === 'right' && pos2 >= item2.pos && pos2 < item2.pos + item2.w) {
          state.selectedItem = item2.uid;
          state.selectedTray = '';
          message('已选中挂饰，可以旋转或移除。', false);
          renderTray();
          updateSelection();
          return;
        }
      }
    } else {
      var tileX = Math.floor(coords.x);
      var tileY = Math.floor(coords.y);
      var found = Engine.findAt(state.items, tileX, tileY);
      if (found) {
        state.selectedItem = found.uid;
        state.selectedTray = '';
        message('已选中家具，可以旋转或移除。', false);
        renderTray();
        updateSelection();
        return;
      }
    }
    if (state.selectedItem) {
      state.selectedItem = '';
      updateSelection();
    }
  }

  /* ---------- 界面渲染 ---------- */

  function renderMaterialRows() {
    var rowConfig = [
      { kind: 'floor', label: '地板', list: availableStyles('floor') },
      { kind: 'wall', label: '墙面', list: availableStyles('wall') },
      { kind: 'light', label: '灯光', list: availableStyles('light') }
    ];
    for (var i = 0; i < rowConfig.length; i += 1) {
      var config = rowConfig[i];
      var row = hardPanel.querySelector('[data-kind="' + config.kind + '"]');
      if (!row) continue;
      row.textContent = '';
      var label = document.createElement('span');
      label.className = 'material-label';
      label.textContent = config.label;
      row.appendChild(label);
      for (var j = 0; j < config.list.length; j += 1) {
        var entry = config.list[j];
        var chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'material-chip' + (state[config.kind] === entry.id ? ' is-active' : '');
        chip.setAttribute('data-kind', config.kind);
        chip.setAttribute('data-id', entry.id);
        var dot = document.createElement('span');
        dot.className = 'swatch';
        dot.style.background = config.kind === 'light' ? (entry.glow || entry.tint) : entry.base;
        chip.appendChild(dot);
        chip.appendChild(document.createTextNode(entry.name));
        row.appendChild(chip);
      }
    }
  }

  var lastTrayTap = { id: '', time: 0 };

  function renderTray() {
    trayEl.textContent = '';
    for (var i = 0; i < Data.items.length; i += 1) {
      var def = Data.items[i];
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'tray-chip' + (state.selectedTray === def.id ? ' is-active' : '');
      chip.setAttribute('data-item', def.id);
      var dot = document.createElement('span');
      dot.className = 'tray-dot';
      dot.style.background = def.color;
      chip.appendChild(dot);
      chip.appendChild(document.createTextNode(def.name));
      trayEl.appendChild(chip);
    }
    if (trayHintEl) {
      var chosen = state.selectedTray ? Data.findItem(state.selectedTray) : null;
      if (chosen) {
        trayHintEl.textContent = '已选：' + chosen.name +
          (chosen.wall ? ' · 点墙面放置' : ' · 点地面放置');
        trayHintEl.className = 'tray-hint is-active';
      } else {
        trayHintEl.textContent = '点一件家具开始布置';
        trayHintEl.className = 'tray-hint';
      }
    }
    if (placementTipEl) {
      var tipDef = state.selectedTray ? Data.findItem(state.selectedTray) : null;
      if (tipDef) {
        placementTipEl.textContent = '点' + (tipDef.wall ? '墙面' : '地面') +
          '放置「' + tipDef.name + '」，或点「放到空位」';
        placementTipEl.hidden = false;
      } else {
        placementTipEl.textContent = '';
        placementTipEl.hidden = true;
      }
    }
  }

  function handleTrayTap(id) {
    if (!id) return;
    var now = Date.now();
    // pointerup 与 click 可能先后触发，600ms 内同一件只响应一次
    if (id === lastTrayTap.id && now - lastTrayTap.time < 600) return;
    lastTrayTap = { id: id, time: now };

    state.selectedTray = state.selectedTray === id ? '' : id;
    state.selectedItem = '';
    state.trayRot = 0;
    renderTray();
    updateSelection();
    if (state.selectedTray) {
      var def = Data.findItem(state.selectedTray);
      playSfx('select');
      message('已选「' + def.name + '」，点' + (def.wall ? '墙面' : '地面') + '放置。', false);
    } else {
      message('已取消选择。', false);
    }
  }

  function onTrayTap(event) {
    var target = event.target;
    while (target && target !== trayEl && !(target.getAttribute && target.getAttribute('data-item'))) {
      target = target.parentNode;
    }
    if (!target || target === trayEl) return;
    handleTrayTap(target.getAttribute('data-item'));
  }

  function renderSteps() {
    stepHard.className = state.stage === 'hard' ? 'step is-active' : 'step';
    stepSoft.className = state.stage === 'soft' ? 'step is-active' : 'step';
  }

  function renderStage() {
    hardPanel.hidden = state.stage !== 'hard';
    softPanel.hidden = state.stage !== 'soft';
    renderSteps();
    renderMaterialRows();
    if (state.stage === 'soft') {
      renderTray();
      message('点家具再点地面放置；目录可左右滑动，挂画和窗帘点墙面。', false);
    } else {
      message('先选地板、墙面和灯光，再进入软装。', false);
    }
    updateSelection();
    fitCanvas();
    draw();
  }

  function formatPrice(value) {
    return '¥' + String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function marketCategoryName(id) {
    for (var i = 0; i < Data.marketCategories.length; i += 1) {
      if (Data.marketCategories[i].id === id) return Data.marketCategories[i].name;
    }
    return '';
  }

  function findMarketItem(id) {
    for (var i = 0; i < Data.marketItems.length; i += 1) {
      if (Data.marketItems[i].id === id) return Data.marketItems[i];
    }
    return null;
  }

  function renderMarket() {
    if (!marketBudgetEl) return;
    marketBudgetEl.textContent = formatPrice(market.budget);

    marketCatsEl.textContent = '';
    for (var i = 0; i < Data.marketCategories.length; i += 1) {
      var cat = Data.marketCategories[i];
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'market-cat' + (marketCat === cat.id ? ' is-active' : '');
      chip.setAttribute('data-cat', cat.id);
      chip.setAttribute('role', 'tab');
      chip.setAttribute('aria-selected', marketCat === cat.id ? 'true' : 'false');
      chip.textContent = cat.name;
      marketCatsEl.appendChild(chip);
    }

    marketListEl.textContent = '';
    for (var j = 0; j < Data.marketItems.length; j += 1) {
      var item = Data.marketItems[j];
      if (item.cat !== marketCat) continue;
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'market-card';
      card.setAttribute('data-item', item.id);

      var thumb = document.createElement('img');
      thumb.className = 'market-thumb';
      thumb.src = './assets/market/' + item.id + '.svg';
      thumb.alt = '';
      card.appendChild(thumb);

      var cardBody = document.createElement('span');
      cardBody.className = 'market-card-body';

      var head = document.createElement('span');
      head.className = 'market-card-head';
      var name = document.createElement('span');
      name.className = 'market-card-name';
      name.textContent = item.name;
      if (isOwned(item.id)) {
        var badge = document.createElement('span');
        badge.className = 'market-owned';
        badge.textContent = '已购';
        name.appendChild(badge);
      }
      var price = document.createElement('span');
      price.className = 'market-card-price';
      price.textContent = formatPrice(item.price);
      head.appendChild(name);
      head.appendChild(price);

      var meta = document.createElement('span');
      meta.className = 'market-card-meta';
      meta.textContent = item.material + ' · ' + item.grade;

      cardBody.appendChild(head);
      cardBody.appendChild(meta);
      card.appendChild(cardBody);
      marketListEl.appendChild(card);
    }
  }

  function openMarketDetail(item) {
    if (!item || !marketModal) return;
    detailItem = item;
    modalCat.textContent = marketCategoryName(item.cat);
    if (modalPhoto) {
      modalPhoto.src = './assets/market/' + item.id + '.svg';
      modalPhoto.alt = item.name + '示意图';
    }
    modalName.textContent = item.name;
    modalPrice.textContent = formatPrice(item.price) + ' / ' + item.unit;

    modalSpecs.textContent = '';
    var rows = [
      ['材质', item.material],
      ['环保等级', item.grade],
      ['适用空间', item.usage]
    ];
    for (var i = 0; i < rows.length; i += 1) {
      var dt = document.createElement('dt');
      dt.textContent = rows[i][0];
      var dd = document.createElement('dd');
      dd.textContent = rows[i][1];
      modalSpecs.appendChild(dt);
      modalSpecs.appendChild(dd);
    }
    modalTip.textContent = '选购提示：' + item.tip;

    if (isOwned(item.id)) {
      modalBuy.textContent = '已购买';
      modalBuy.disabled = true;
    } else if (market.budget < item.price) {
      modalBuy.textContent = '预算不足（还差 ' + formatPrice(item.price - market.budget) + '）';
      modalBuy.disabled = true;
    } else {
      modalBuy.textContent = '购买（' + formatPrice(item.price) + '）';
      modalBuy.disabled = false;
    }
    marketModal.hidden = false;
    playSfx('select');
  }

  function closeMarketDetail() {
    if (marketModal) marketModal.hidden = true;
    detailItem = null;
  }

  function buyDetailItem() {
    var item = detailItem;
    if (!item || isOwned(item.id) || market.budget < item.price) return;
    market.budget -= item.price;
    market.owned.push(item.id);
    playSfx('material');
    renderMarket();
    renderMaterialRows();
    saveNow();
    openMarketDetail(item);
  }

  function openMarket(returnTo) {
    marketReturn = returnTo || 'setup';
    showScreen('market');
    renderMarket();
    window.scrollTo(0, 0);
  }

  function renderResult() {
    var stats = Engine.stats(state.items);
    var floorName = Data.findMaterial('floor', state.floor).name;
    var wallName = Data.findMaterial('wall', state.wall).name;
    var lightName = Data.findMaterial('light', state.light).name;
    resultSubEl.textContent = '家具 ' + stats.floor + ' 件 · 挂饰 ' + stats.wall +
      ' 件 · ' + floorName + '/' + wallName + '/' + lightName;
    cardDataUrl = generateCard(stats, floorName, wallName, lightName);
    if (cardDataUrl) {
      cardPreviewEl.src = cardDataUrl;
      cardPreviewEl.hidden = false;
    } else {
      cardPreviewEl.hidden = true;
    }
    var miniTool = getMiniTool();
    var canSave = !!miniTool && typeof miniTool.saveImageToPhotosAlbum === 'function';
    var canShare = !!miniTool && typeof miniTool.share === 'function';
    var canPost = !!miniTool && typeof miniTool.postNote === 'function';
    saveCardBtn.hidden = !canSave;
    shareCardBtn.hidden = !canShare;
    postNoteBtn.hidden = !canPost;
    if (!canSave && !canShare && !canPost) {
      setShareStatus('当前版本不支持保存、分享或发布笔记，可截图明信片。', true);
    } else {
      setShareStatus('', false);
    }
  }

  function setShareStatus(text, isError) {
    shareStatusEl.textContent = text || '';
    shareStatusEl.className = isError ? 'share-status is-error' : 'share-status';
  }

  function showScreen(name) {
    state.screen = name;
    setupScreen.hidden = name !== 'setup';
    stageScreen.hidden = name !== 'stage';
    resultScreen.hidden = name !== 'result';
    marketScreen.hidden = name !== 'market';
    if (name === 'stage') {
      setTimeout(function () {
        fitCanvas();
        draw();
      }, 0);
    }
    window.scrollTo(0, 0);
  }

  /* ---------- 明信片 ---------- */

  function generateCard(stats, floorName, wallName, lightName) {
    var c = document.createElement('canvas');
    c.width = 900;
    c.height = 1200;
    var g = c.getContext && c.getContext('2d');
    if (!g) return '';
    var bg = g.createLinearGradient(0, 0, 0, 1200);
    bg.addColorStop(0, '#fffdf8');
    bg.addColorStop(0.6, '#f8f1e3');
    bg.addColorStop(1, '#efe5d4');
    g.fillStyle = bg;
    g.fillRect(0, 0, 900, 1200);
    g.fillStyle = 'rgba(224, 190, 130, 0.18)';
    g.beginPath();
    g.arc(810, 120, 220, 0, Math.PI * 2, false);
    g.fill();
    g.fillStyle = 'rgba(160, 200, 170, 0.16)';
    g.beginPath();
    g.arc(80, 1080, 230, 0, Math.PI * 2, false);
    g.fill();

    g.fillStyle = '#a08055';
    g.font = '600 20px "Noto Sans CJK SC", sans-serif';
    g.textAlign = 'center';
    g.fillText('ISOMETRIC DECOR', 450, 96);
    g.fillStyle = '#3a2f24';
    g.font = '800 52px "Noto Sans CJK SC", sans-serif';
    g.fillText('我的理想家', 450, 164);
    g.fillStyle = '#8a7a68';
    g.font = '24px "Noto Sans CJK SC", sans-serif';
    g.fillText('装修实验室 · 奶油一居室', 450, 208);
    g.textAlign = 'left';

    var area = { x: 70, y: 250, w: 760, h: 600 };
    var contentW = SIZE * TW;
    var contentH = SIZE * TH + WALL_H;
    var cardScale = Math.min(area.w / contentW, area.h / contentH);
    var cardTx = area.x + area.w / 2;
    var cardTy = area.y + (area.h - contentH * cardScale) / 2 + WALL_H * cardScale;

    g.save();
    g.translate(cardTx, cardTy);
    g.scale(cardScale, cardScale);
    drawScene(g, { grid: false, selection: false, plain: true });
    g.restore();

    g.fillStyle = '#3a2f24';
    g.font = '700 30px "Noto Sans CJK SC", sans-serif';
    g.textAlign = 'center';
    g.fillText('家具 ' + stats.floor + ' 件 · 挂饰 ' + stats.wall + ' 件', 450, 930);
    g.fillStyle = '#8a7a68';
    g.font = '24px "Noto Sans CJK SC", sans-serif';
    g.fillText(floorName + ' 地板 · ' + wallName + ' 墙面 · ' + lightName, 450, 976);
    g.fillStyle = '#b08a5a';
    g.font = '22px "Noto Sans CJK SC", sans-serif';
    g.fillText('一步步搭出理想家', 450, 1090);
    g.fillStyle = '#b6a68f';
    g.font = '18px "Noto Sans CJK SC", sans-serif';
    g.fillText('装修实验室 · 2.5D 原型', 450, 1130);
    g.textAlign = 'left';

    try {
      return c.toDataURL('image/jpeg', 0.9);
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
      setShareStatus('保存失败' + (error && error.errCode ? '（' + error.errCode + '）' : '') +
        '，可截图明信片。', true);
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
    var stats = Engine.stats(state.items);
    shareBusy = true;
    postNoteBtn.disabled = true;
    setShareStatus('正在打开笔记发布页…', false);
    apiCall('postNote', {
      title: '我的理想家：' + Data.findMaterial('floor', state.floor).name + '一居室',
      content: '我在「装修实验室」用 2.5D 等距视角搭了一间奶油一居室：' +
        stats.floor + ' 件家具、' + stats.wall + ' 件挂饰。来搭一间你的？',
      pageType: 'photo_publish',
      mediaInfo: { image_resources: [{ url: cardDataUrl }] }
    }).then(function () {
      shareBusy = false;
      postNoteBtn.disabled = false;
      setShareStatus('已打开笔记发布页，发布结果以平台为准。', false);
    }).catch(function (error) {
      shareBusy = false;
      postNoteBtn.disabled = false;
      setShareStatus('打开笔记发布页失败' + (error && error.errCode ? '（' + error.errCode + '）' : '') +
        '，可先保存图片。', true);
    });
  }

  /* ---------- 流程 ---------- */

  function startDecorate() {
    state.stage = 'hard';
    state.items = [];
    state.history = [];
    state.uid = 1;
    state.selectedTray = '';
    state.selectedItem = '';
    showScreen('stage');
    renderStage();
    saveNow();
  }

  function toSoft() {
    state.stage = 'soft';
    playSfx('material');
    renderStage();
    saveNow();
  }

  function placeAtFirstFree() {
    var def = Data.findItem(state.selectedTray);
    if (!def) {
      message('先在目录里选一件家具。', true);
      return;
    }
    var placed = null;
    if (def.wall) {
      var walls = ['left', 'right'];
      for (var wi = 0; wi < walls.length && !placed; wi += 1) {
        for (var pos = 0; pos <= SIZE - def.w; pos += 1) {
          if (Engine.canPlaceWall(state.items, def, walls[wi], pos)) {
            placed = Engine.placeWall(state.items, def, walls[wi], pos, 'u' + state.uid);
            break;
          }
        }
      }
    } else {
      for (var y = 0; y < SIZE && !placed; y += 1) {
        for (var x = 0; x < SIZE; x += 1) {
          if (Engine.canPlaceFloor(state.items, def, x, y, state.trayRot)) {
            placed = Engine.placeFloor(state.items, def, x, y, state.trayRot, 'u' + state.uid);
            break;
          }
        }
      }
    }
    if (!placed) {
      message('没有空位了，先移除一件再试。', true);
      return;
    }
    pushHistory();
    state.items = placed;
    state.uid += 1;
    state.selectedTray = '';
    state.selectedItem = '';
    state.trayRot = 0;
    renderTray();
    updateSelection();
    saveNow();
    playSfx('place');
    message('已放到空位，点它可以选择、旋转或移除。', false);
  }

  function rotateSelected() {
    if (state.selectedItem) {
      var selected = Engine.findItem(state.items, state.selectedItem);
      if (selected && selected.wall) {
        message('挂画和窗帘不需要旋转。', false);
        return;
      }
      var next = Engine.rotate(state.items, Data.items, state.selectedItem);
      if (!next) {
        message('旋转后会放不下，先挪个位置吧。', true);
        return;
      }
      pushHistory();
      state.items = next;
      playSfx('rotate');
      message('已旋转。', false);
      updateSelection();
      saveNow();
      return;
    }
    if (state.selectedTray) {
      var trayDef = Data.findItem(state.selectedTray);
      if (trayDef && trayDef.wall) {
        message('挂画和窗帘不需要旋转。', false);
        return;
      }
      state.trayRot = state.trayRot === 90 ? 0 : 90;
      playSfx('rotate');
      message('下一次放置会按 ' + (state.trayRot === 90 ? '横向' : '纵向') + '摆放。', false);
      return;
    }
    message('先选一件家具，或点选已放置的家具。', true);
  }

  function removeSelected() {
    if (!state.selectedItem) return;
    pushHistory();
    state.items = Engine.remove(state.items, state.selectedItem);
    state.selectedItem = '';
    playSfx('remove');
    message('已移除。', false);
    updateSelection();
    saveNow();
  }

  function undo() {
    if (!state.history.length) return;
    state.items = state.history.pop();
    state.selectedItem = '';
    state.selectedTray = '';
    playSfx('undo');
    message('已撤销上一步。', false);
    renderTray();
    updateSelection();
    saveNow();
  }

  function finishDecorate() {
    var stats = Engine.stats(state.items);
    if (stats.total < 3) {
      message('再放几件家具吧，至少 3 件才能完工。', true);
      return;
    }
    state.selectedTray = '';
    state.selectedItem = '';
    playSfx('finish');
    renderResult();
    showScreen('result');
    saveNow();
  }

  function again() {
    startDecorate();
    showScreen('stage');
  }

  function goHome() {
    showScreen('setup');
  }

  /* ---------- 事件绑定 ---------- */

  function bind() {
    startBtn.addEventListener('click', startDecorate);
    marketBtn.addEventListener('click', function () {
      openMarket('setup');
    });
    marketLink.addEventListener('click', function () {
      openMarket('stage');
    });
    marketBack.addEventListener('click', function () {
      var target = marketReturn === 'stage' ? 'stage' : 'setup';
      showScreen(target);
      if (target === 'stage') {
        renderStage();
      }
    });
    marketCatsEl.addEventListener('click', function (event) {
      var target = event.target;
      while (target && target !== marketCatsEl && !(target.getAttribute && target.getAttribute('data-cat'))) {
        target = target.parentNode;
      }
      if (!target || target === marketCatsEl) return;
      marketCat = target.getAttribute('data-cat');
      renderMarket();
    });
    marketListEl.addEventListener('click', function (event) {
      var target = event.target;
      while (target && target !== marketListEl && !(target.getAttribute && target.getAttribute('data-item'))) {
        target = target.parentNode;
      }
      if (!target || target === marketListEl) return;
      openMarketDetail(findMarketItem(target.getAttribute('data-item')));
    });
    modalClose.addEventListener('click', closeMarketDetail);
    modalMask.addEventListener('click', closeMarketDetail);
    modalBuy.addEventListener('click', buyDetailItem);
    backBtn.addEventListener('click', goHome);
    toSoftBtn.addEventListener('click', toSoft);
    autoBtn.addEventListener('click', placeAtFirstFree);
    rotateBtn.addEventListener('click', rotateSelected);
    removeBtn.addEventListener('click', removeSelected);
    undoBtn.addEventListener('click', undo);
    finishBtn.addEventListener('click', finishDecorate);
    againBtn.addEventListener('click', again);
    homeBtn.addEventListener('click', goHome);

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

    saveCardBtn.addEventListener('click', saveCard);
    shareCardBtn.addEventListener('click', shareCard);
    postNoteBtn.addEventListener('click', publishNote);

    hardPanel.addEventListener('click', function (event) {
      var target = event.target;
      while (target && target !== hardPanel &&
             !(target.getAttribute && target.getAttribute('data-kind'))) {
        target = target.parentNode;
      }
      if (!target || target === hardPanel) return;
      var kind = target.getAttribute('data-kind');
      var id = target.getAttribute('data-id');
      if (!kind || !id) return;
      state[kind] = id;
      playSfx('material');
      renderMaterialRows();
      draw();
      saveNow();
    });

    trayEl.addEventListener('click', onTrayTap);
    trayEl.addEventListener('pointerup', onTrayTap);

    var lastCanvasTap = { time: 0, x: 0, y: 0 };
    function handleCanvasTap(event) {
      if (state.stage !== 'soft') return;
      var now = Date.now();
      if (now - lastCanvasTap.time < 600 &&
          Math.abs(event.clientX - lastCanvasTap.x) < 8 &&
          Math.abs(event.clientY - lastCanvasTap.y) < 8) {
        return;
      }
      lastCanvasTap = { time: now, x: event.clientX, y: event.clientY };
      if (state.selectedTray) {
        placeSelectedTrayItem(event);
      } else {
        selectAt(event);
      }
    }
    canvas.addEventListener('click', handleCanvasTap);
    canvas.addEventListener('pointerup', handleCanvasTap);
    if (!window.PointerEvent) {
      canvas.addEventListener('touchend', function (event) {
        if (event.changedTouches && event.changedTouches.length) {
          handleCanvasTap(event.changedTouches[0]);
        }
      });
    }

    window.addEventListener('resize', function () {
      fitCanvas();
      draw();
    });

    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') {
        stopBgm();
        saveNow();
      }
    });
    window.addEventListener('pagehide', stopBgm);
  }

  function boot() {
    if (!ctx) {
      return;
    }
    bind();
    renderSoundUi();
    updateSoundButtons();
    renderMaterialRows();
    renderTray();
    showScreen('setup');
    fitCanvas();
    draw();
    loadSaved();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}());
