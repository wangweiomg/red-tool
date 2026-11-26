/* 课间十分钟 · 贪吃蛇 · 原型 */
(function () {
  'use strict';

  var Engine = window.BreakSnakeEngine;
  if (!Engine) return;

  var canvas = document.getElementById('scene');
  var startOverlay = document.getElementById('start-overlay');
  var resultOverlay = document.getElementById('result-overlay');
  var startBtn = document.getElementById('start-btn');
  var againBtn = document.getElementById('again-btn');
  var hudTime = document.getElementById('hud-time');
  var hudEaten = document.getElementById('hud-eaten');
  var hudScore = document.getElementById('hud-score');
  var hudBest = document.getElementById('hud-best');
  var bestLabel = document.getElementById('best-label');
  var resultKicker = document.getElementById('result-kicker');
  var resultScore = document.getElementById('result-score');
  var resultTitle = document.getElementById('result-title');
  var resultBest = document.getElementById('result-best');
  var statusEl = document.getElementById('status');
  var sfxBtn = document.getElementById('toggle-sfx');
  var bgmBtn = document.getElementById('toggle-bgm');
  var saveCardBtn = document.getElementById('save-card');
  var shareCardBtn = document.getElementById('share-card');
  var postNoteBtn = document.getElementById('post-note');
  var shareStatusEl = document.getElementById('share-status');

  var CELL = 18;
  var W = Engine.COLS * CELL;
  var H = Engine.ROWS * CELL;
  var BEST_KEY = 'snakebreak.v1.best';

  var state = {
    game: null,
    idle: null,
    running: false,
    best: 0,
    cardUrl: '',
    shareBusy: false,
    plays: 0,
    lastTime: 0,
    pop: null,
    ctx: null,
    dpr: 1
  };
  var sound = { sfx: true, bgm: true };
  var audio = {
    ctx: null, master: null,
    bgmRunning: false, bgmTimer: null, bgmStep: 0, bgmToken: 0
  };
  var pointerStart = null;

  /* ---------- 平台与存储 ---------- */

  function getMiniTool() {
    return window.xhs && window.xhs.miniTool;
  }

  function apiCall(name, options) {
    var miniTool = getMiniTool();
    if (!miniTool || typeof miniTool[name] !== 'function') {
      return Promise.reject(new Error('unsupported'));
    }
    return new Promise(function (resolve, reject) {
      var settled = false;
      function ok(result) {
        if (!settled) { settled = true; resolve(result); }
      }
      function bad(error) {
        if (!settled) { settled = true; reject(error || new Error('failed')); }
      }
      var opts = {};
      var key;
      for (key in options) {
        if (Object.prototype.hasOwnProperty.call(options, key)) opts[key] = options[key];
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
      if (ret && typeof ret.then === 'function') ret.then(ok, bad);
    });
  }

  function loadBest() {
    if (!getMiniTool() || typeof getMiniTool().getStorage !== 'function') return;
    apiCall('getStorage', { key: BEST_KEY }).then(function (result) {
      var raw = result && result.data;
      if (typeof raw !== 'string' || !raw) return;
      try {
        var saved = JSON.parse(raw);
        if (saved && saved.v === 1) {
          state.best = Math.max(0, Math.floor(saved.best || 0));
          state.plays = Math.max(0, Math.floor(saved.plays || 0));
          if (saved.sound && typeof saved.sound === 'object') {
            sound.sfx = saved.sound.sfx !== false;
            sound.bgm = saved.sound.bgm !== false;
          }
          renderBest();
          renderSound();
        }
      } catch (error) {
        /* 忽略 */
      }
    }).catch(function () {});
  }

  function saveBest() {
    if (!getMiniTool() || typeof getMiniTool().setStorage !== 'function') return;
    apiCall('setStorage', {
      key: BEST_KEY,
      data: JSON.stringify({
        v: 1,
        best: state.best,
        plays: state.plays,
        sound: { sfx: sound.sfx, bgm: sound.bgm }
      })
    }).catch(function () {});
  }

  function renderBest() {
    if (bestLabel) {
      bestLabel.textContent = state.plays ?
        '最佳 ' + state.best + ' 分 · 已玩 ' + state.plays + ' 局' :
        '还没有记录，先吃一局。';
    }
    if (hudBest) hudBest.textContent = '最佳 ' + state.best;
  }

  /* ---------- 音效 ---------- */

  function ensureAudio() {
    if (!(window.AudioContext || window.webkitAudioContext)) return null;
    if (!audio.ctx) {
      var Ctor = window.AudioContext || window.webkitAudioContext;
      try {
        audio.ctx = new Ctor();
        audio.master = audio.ctx.createGain();
        audio.master.gain.value = 0.6;
        audio.master.connect(audio.ctx.destination);
      } catch (error) {
        audio.ctx = null;
        return null;
      }
    }
    if (audio.ctx.state === 'suspended' && typeof audio.ctx.resume === 'function') {
      try {
        var ret = audio.ctx.resume();
        if (ret && typeof ret.catch === 'function') ret.catch(function () {});
      } catch (error) {
        /* 等下一次手势 */
      }
    }
    return audio.ctx;
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
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume || 0.05), t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + (duration || 0.1));
      osc.connect(gain);
      gain.connect(audio.master);
      osc.start(t0);
      osc.stop(t0 + (duration || 0.1) + 0.02);
    } catch (error) {
      /* 忽略 */
    }
  }

  function sfxEat(food) {
    if (!sound.sfx) return;
    if (food === 'cookie') {
      tone(660, 0, 0.08, 'triangle', 0.06);
      tone(880, 0.05, 0.1, 'triangle', 0.05);
    } else if (food === 'candy') {
      tone(988, 0, 0.07, 'sine', 0.055);
      tone(1319, 0.05, 0.12, 'sine', 0.045);
    } else {
      tone(520, 0, 0.06, 'triangle', 0.05);
    }
  }

  function sfxCaught() {
    if (!sound.sfx) return;
    tone(180, 0, 0.22, 'square', 0.05);
    tone(120, 0.12, 0.28, 'square', 0.04);
  }

  function sfxBell() {
    if (!sound.sfx) return;
    tone(1046, 0, 0.4, 'sine', 0.05);
    tone(784, 0.2, 0.5, 'sine', 0.045);
  }

  function sfxStart() {
    if (!sound.sfx) return;
    tone(523, 0, 0.1, 'triangle', 0.05);
    tone(659, 0.08, 0.12, 'triangle', 0.05);
    tone(784, 0.16, 0.16, 'triangle', 0.045);
  }

  /* 舒缓背景音乐：G 大调五声音阶的音乐盒旋律 + G–Em–C–D 慢速和弦铺底。
   * 32 步、每步 0.38 秒，约 12.2 秒一循环；全部 Web Audio 合成，无音频文件。 */
  var BGM_STEP_MS = 380;
  var BGM_MELODY = [
    493.88, 0, 587.33, 659.25, 0, 587.33, 0, 493.88,
    493.88, 0, 440, 392, 0, 392, 0, 0,
    587.33, 0, 783.99, 659.25, 0, 587.33, 0, 493.88,
    587.33, 0, 493.88, 440, 0, 392, 0, 0
  ];
  var BGM_CHORDS = [
    [196, 246.94, 293.66],
    [164.81, 196, 246.94],
    [130.81, 164.81, 196],
    [146.83, 185, 220]
  ];

  function startBgm() {
    if (!sound.bgm || audio.bgmRunning) return;
    var ctx = ensureAudio();
    if (!ctx) return;
    audio.bgmRunning = true;
    audio.bgmStep = 0;
    audio.bgmToken += 1;
    var token = audio.bgmToken;

    function step() {
      if (!audio.bgmRunning || token !== audio.bgmToken) return;
      var index = audio.bgmStep % 32;
      var note = BGM_MELODY[index];
      if (note) {
        tone(note, 0, 1.0, 'sine', 0.03);
      }
      if (index % 8 === 0) {
        var chord = BGM_CHORDS[(index / 8) % 4];
        for (var i = 0; i < chord.length; i += 1) {
          tone(chord[i], i * 0.04, 2.4, 'sine', i === 0 ? 0.02 : 0.013);
        }
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

  function renderSound() {
    if (sfxBtn) {
      sfxBtn.className = sound.sfx ? 'sound-toggle is-on' : 'sound-toggle';
      sfxBtn.setAttribute('aria-checked', sound.sfx ? 'true' : 'false');
    }
    if (bgmBtn) {
      bgmBtn.className = sound.bgm ? 'sound-toggle is-on' : 'sound-toggle';
      bgmBtn.setAttribute('aria-checked', sound.bgm ? 'true' : 'false');
    }
  }

  /* ---------- 绘制 ---------- */

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function drawDesk(ctx) {
    ctx.fillStyle = '#e7d3ae';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(120, 90, 50, 0.06)';
    ctx.lineWidth = 1;
    for (var y = 24; y < H; y += 36) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y + 6);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(47, 74, 58, 0.28)';
    ctx.lineWidth = 4;
    ctx.strokeRect(6, 6, W - 12, H - 12);
  }

  function drawFood(ctx, food) {
    if (!food) return;
    var x = food.x * CELL;
    var y = food.y * CELL;
    var cx = x + CELL / 2;
    var cy = y + CELL / 2;

    if (food.type === 'cookie') {
      ctx.fillStyle = '#d9a45b';
      ctx.beginPath();
      ctx.arc(cx, cy, 7, 0, Math.PI * 2, false);
      ctx.fill();
      ctx.fillStyle = '#7a4a26';
      var dots = [[-2.5, -2], [2.5, -2], [0, 2.5], [-2, 3]];
      for (var i = 0; i < dots.length; i += 1) {
        ctx.beginPath();
        ctx.arc(cx + dots[i][0], cy + dots[i][1], 1.3, 0, Math.PI * 2, false);
        ctx.fill();
      }
    } else if (food.type === 'candy') {
      ctx.fillStyle = '#e07a8a';
      ctx.beginPath();
      ctx.arc(cx, cy, 5.5, 0, Math.PI * 2, false);
      ctx.fill();
      ctx.fillStyle = '#f0a6b2';
      ctx.beginPath();
      ctx.moveTo(cx - 5, cy);
      ctx.lineTo(cx - 9, cy - 4);
      ctx.lineTo(cx - 9, cy + 4);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx + 5, cy);
      ctx.lineTo(cx + 9, cy - 4);
      ctx.lineTo(cx + 9, cy + 4);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = '#c94f3d';
      roundRect(ctx, cx - 3.5, cy - 8, 7, 16, 3.5);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 214, 170, 0.55)';
      roundRect(ctx, cx - 1.2, cy - 6, 2.4, 12, 1.2);
      ctx.fill();
    }
  }

  function drawSnake(ctx, game) {
    var snake = game.snake;
    for (var i = snake.length - 1; i >= 0; i -= 1) {
      var seg = snake[i];
      var isHead = i === 0;
      ctx.fillStyle = isHead ? '#b4553f' : (i % 2 ? '#d98a3c' : '#cf7a2e');
      roundRect(ctx, seg.x * CELL + 1.5, seg.y * CELL + 1.5, CELL - 3, CELL - 3, 5);
      ctx.fill();

      if (isHead) {
        var cx = seg.x * CELL + CELL / 2;
        var cy = seg.y * CELL + CELL / 2;
        var dx = game.dir.x;
        var dy = game.dir.y;
        var e1x = cx + dx * 3.5 - dy * 3;
        var e1y = cy + dy * 3.5 + dx * 3;
        var e2x = cx + dx * 3.5 + dy * 3;
        var e2y = cy + dy * 3.5 - dx * 3;
        ctx.fillStyle = '#fff7e6';
        ctx.beginPath();
        ctx.arc(e1x, e1y, 2.1, 0, Math.PI * 2, false);
        ctx.arc(e2x, e2y, 2.1, 0, Math.PI * 2, false);
        ctx.fill();
        ctx.fillStyle = '#2b2420';
        ctx.beginPath();
        ctx.arc(e1x + dx * 0.6, e1y + dy * 0.6, 0.9, 0, Math.PI * 2, false);
        ctx.arc(e2x + dx * 0.6, e2y + dy * 0.6, 0.9, 0, Math.PI * 2, false);
        ctx.fill();
      }
    }
  }

  function render(game) {
    var ctx = state.ctx;
    if (!ctx) return;
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    drawDesk(ctx);
    if (!game) return;
    drawFood(ctx, game.food);
    drawSnake(ctx, game);

    if (state.pop && state.pop.life > 0) {
      ctx.globalAlpha = Math.min(1, state.pop.life * 2);
      ctx.fillStyle = '#8a5a1c';
      ctx.font = '700 14px "Noto Sans CJK SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(state.pop.text, state.pop.x, state.pop.y);
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
    }
  }

  /* ---------- HUD ---------- */

  function updateHud(game) {
    var secs = Math.max(0, Math.ceil(game.timeLeft));
    hudTime.textContent = secs + 's';
    hudTime.className = 'hud-item hud-time' + (secs <= 10 ? ' is-low' : '');
    hudEaten.textContent = '零食 ' + game.eaten;
    hudScore.textContent = '得分 ' + game.score;
    hudBest.textContent = '最佳 ' + state.best;
  }

  function setStatus(text, kind) {
    statusEl.textContent = text;
    statusEl.className = 'status' + (kind ? ' is-' + kind : '');
  }

  /* ---------- 流程 ---------- */

  function startGame() {
    ensureAudio();
    if (sound.bgm) startBgm();
    sfxStart();
    state.game = Engine.create(Math.random);
    state.running = true;
    state.pop = null;
    state.lastTime = 0;
    startOverlay.hidden = true;
    resultOverlay.hidden = true;
    setShareStatus('', false);
    setStatus('准备……看准方向再出发。', 'ok');
    updateHud(state.game);
    render(state.game);
  }

  function handleEvents(game) {
    for (var i = 0; i < game.events.length; i += 1) {
      var event = game.events[i];
      if (event.type === 'eat') {
        sfxEat(event.food);
        var head = game.snake[0];
        state.pop = {
          x: head.x * CELL + CELL / 2,
          y: head.y * CELL - 2,
          text: '+' + event.score,
          life: 0.7
        };
        setStatus(event.food === 'candy' ? '水果糖，时间 +2 秒。' :
          (event.food === 'cookie' ? '饼干，+2 分。' : '辣条，+1 分。'), 'ok');
      } else if (event.type === 'caught') {
        sfxCaught();
        setStatus(event.reason === 'wall' ? '撞到墙，被老师发现了。' : '撞到自己，被老师发现了。', 'danger');
      } else if (event.type === 'timeup') {
        sfxBell();
        setStatus('下课铃响了。', 'ok');
      } else if (event.type === 'go') {
        setStatus('滑动或按方向键转向，别撞墙。', 'ok');
      }
    }
  }

  function finishGame(game) {
    state.running = false;
    var reason = 'timeup';
    for (var i = 0; i < game.events.length; i += 1) {
      if (game.events[i].type === 'caught') reason = 'caught';
      if (game.events[i].type === 'timeup') reason = 'timeup';
    }
    var isBest = game.score > state.best;
    if (isBest) state.best = game.score;
    state.plays += 1;
    saveBest();
    renderBest();

    resultKicker.textContent = reason === 'caught' ? '被老师发现了' : '下课铃响了';
    resultScore.textContent = String(game.score);
    resultTitle.textContent = reason === 'caught' ? '下次藏好点' : '课间结束';
    resultBest.textContent = '本局零食 ' + game.eaten + ' 个 · 最佳 ' + state.best + ' 分 · 已玩 ' + state.plays + ' 局' +
      (isBest ? ' · 新纪录' : '');
    state.cardUrl = generateCard(game, reason, isBest);
    updateShareButtons();
    setShareStatus('', false);
    resultOverlay.hidden = false;
  }

  /* ---------- 成绩卡 ---------- */

  function cardRound(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.lineTo(x + w - r, y);
    g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r);
    g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    g.lineTo(x + r, y + h);
    g.quadraticCurveTo(x, y + h, x, y + h - r);
    g.lineTo(x, y + r);
    g.quadraticCurveTo(x, y, x + r, y);
    g.closePath();
  }

  function cardSnack(g, x, y, type) {
    if (type === 'cookie') {
      g.fillStyle = '#d9a45b';
      g.beginPath();
      g.arc(x, y, 20, 0, Math.PI * 2, false);
      g.fill();
      g.fillStyle = '#7a4a26';
      var dots = [[-6, -5], [6, -5], [0, 6], [-7, 7]];
      for (var i = 0; i < dots.length; i += 1) {
        g.beginPath();
        g.arc(x + dots[i][0], y + dots[i][1], 3.4, 0, Math.PI * 2, false);
        g.fill();
      }
    } else if (type === 'candy') {
      g.fillStyle = '#e07a8a';
      g.beginPath();
      g.arc(x, y, 16, 0, Math.PI * 2, false);
      g.fill();
      g.fillStyle = '#f0a6b2';
      g.beginPath();
      g.moveTo(x - 14, y);
      g.lineTo(x - 27, y - 11);
      g.lineTo(x - 27, y + 11);
      g.closePath();
      g.fill();
      g.beginPath();
      g.moveTo(x + 14, y);
      g.lineTo(x + 27, y - 11);
      g.lineTo(x + 27, y + 11);
      g.closePath();
      g.fill();
    } else {
      g.fillStyle = '#c94f3d';
      cardRound(g, x - 10, y - 22, 20, 44, 9);
      g.fill();
      g.fillStyle = 'rgba(255, 214, 170, 0.55)';
      cardRound(g, x - 3.5, y - 17, 7, 34, 3.5);
      g.fill();
    }
  }

  function generateCard(game, reason, isBest) {
    var c = document.createElement('canvas');
    c.width = 900;
    c.height = 1200;
    var g = c.getContext && c.getContext('2d');
    if (!g) return '';
    var bg = g.createLinearGradient(0, 0, 0, 1200);
    bg.addColorStop(0, '#fffaf0');
    bg.addColorStop(0.6, '#f7edd9');
    bg.addColorStop(1, '#efe0c4');
    g.fillStyle = bg;
    g.fillRect(0, 0, 900, 1200);

    g.fillStyle = 'rgba(47, 74, 58, 0.10)';
    g.beginPath();
    g.arc(760, 150, 190, 0, Math.PI * 2, false);
    g.fill();
    g.fillStyle = 'rgba(216, 154, 60, 0.14)';
    g.beginPath();
    g.arc(120, 1060, 210, 0, Math.PI * 2, false);
    g.fill();

    g.textAlign = 'center';
    g.fillStyle = '#8a6a2f';
    g.font = '600 20px "Noto Sans CJK SC", sans-serif';
    g.fillText('BREAK TIME SNAKE', 450, 92);
    g.fillStyle = '#3f352b';
    g.font = '800 46px "Noto Sans CJK SC", sans-serif';
    g.fillText('课间十分钟 · 贪吃蛇', 450, 156);

    if (isBest) {
      g.fillStyle = '#d89a3c';
      cardRound(g, 676, 42, 140, 44, 22);
      g.fill();
      g.fillStyle = '#fff8ea';
      g.font = '700 22px "Noto Sans CJK SC", sans-serif';
      g.fillText('新纪录', 746, 71);
    }

    var px = 70;
    var py = 200;
    var pw = 760;
    var ph = 360;
    g.fillStyle = '#e7d3ae';
    cardRound(g, px, py, pw, ph, 26);
    g.fill();
    g.strokeStyle = 'rgba(47, 74, 58, 0.32)';
    g.lineWidth = 5;
    cardRound(g, px + 12, py + 12, pw - 24, ph - 24, 20);
    g.stroke();
    g.strokeStyle = 'rgba(120, 90, 50, 0.10)';
    g.lineWidth = 2;
    for (var gy = py + 42; gy < py + ph - 20; gy += 38) {
      g.beginPath();
      g.moveTo(px + 30, gy);
      g.lineTo(px + pw - 30, gy + 6);
      g.stroke();
    }

    var cell = 64;
    var sx = px + 150;
    var sy = py + 96;
    var blocks = [
      [2, 1, '#b4553f'],
      [1, 1, '#d98a3c'],
      [0, 1, '#cf7a2e'],
      [0, 0, '#d98a3c']
    ];
    for (var b = 0; b < blocks.length; b += 1) {
      g.fillStyle = blocks[b][2];
      cardRound(g, sx + blocks[b][0] * cell + 3, sy + blocks[b][1] * cell + 3, cell - 6, cell - 6, 14);
      g.fill();
    }
    var hx = sx + 2 * cell + cell / 2;
    var hy = sy + 1 * cell + cell / 2;
    g.fillStyle = '#fff7e6';
    g.beginPath();
    g.arc(hx + 8, hy - 9, 6.5, 0, Math.PI * 2, false);
    g.arc(hx + 8, hy + 9, 6.5, 0, Math.PI * 2, false);
    g.fill();
    g.fillStyle = '#2b2420';
    g.beginPath();
    g.arc(hx + 10, hy - 9, 2.6, 0, Math.PI * 2, false);
    g.arc(hx + 10, hy + 9, 2.6, 0, Math.PI * 2, false);
    g.fill();

    cardSnack(g, sx + 4.4 * cell, sy + 0.5 * cell, 'cookie');
    cardSnack(g, sx + 4.4 * cell, sy + 2.4 * cell, 'spicy');
    cardSnack(g, sx + 3.2 * cell, sy + 3.1 * cell, 'candy');

    var bx = px + pw - 92;
    var by = py + 70;
    g.fillStyle = '#b4553f';
    g.beginPath();
    g.arc(bx, by, 26, Math.PI, 0, false);
    g.lineTo(bx + 32, by + 8);
    g.lineTo(bx - 32, by + 8);
    g.closePath();
    g.fill();
    g.fillStyle = '#8a3f30';
    g.beginPath();
    g.arc(bx, by + 14, 7, 0, Math.PI * 2, false);
    g.fill();

    g.fillStyle = '#e8890c';
    g.font = '800 120px "Noto Sans CJK SC", sans-serif';
    g.fillText(String(game.score), 450, 690);
    g.fillStyle = '#8a7a68';
    g.font = '26px "Noto Sans CJK SC", sans-serif';
    g.fillText('分', 450, 732);

    g.fillStyle = '#3f352b';
    g.font = '800 34px "Noto Sans CJK SC", sans-serif';
    g.fillText(reason === 'caught' ? '被老师发现了' : '下课铃响了', 450, 800);

    g.fillStyle = '#8a7a68';
    g.font = '26px "Noto Sans CJK SC", sans-serif';
    g.fillText('本局零食 ' + game.eaten + ' 个 · 最佳 ' + state.best + ' 分', 450, 852);

    g.fillStyle = '#b08a5a';
    g.font = '22px "Noto Sans CJK SC", sans-serif';
    g.fillText('下课铃响前，把课桌里的零食吃个够', 450, 1060);
    g.fillText('课间十分钟 · 贪吃蛇', 450, 1102);
    g.textAlign = 'left';

    try {
      return c.toDataURL('image/jpeg', 0.9);
    } catch (error) {
      return '';
    }
  }

  function updateShareButtons() {
    var miniTool = getMiniTool();
    var canSave = !!miniTool && typeof miniTool.saveImageToPhotosAlbum === 'function';
    var canShare = !!miniTool && typeof miniTool.share === 'function';
    var canPost = !!miniTool && typeof miniTool.postNote === 'function';
    saveCardBtn.hidden = !canSave;
    shareCardBtn.hidden = !canShare;
    postNoteBtn.hidden = !canPost;
    if (!canSave && !canShare && !canPost) {
      setShareStatus('当前版本不支持保存、分享或发布笔记，可截图结果页。', true);
    }
  }

  function setShareStatus(text, isError) {
    shareStatusEl.textContent = text || '';
    shareStatusEl.className = isError ? 'share-status is-error' : 'share-status';
  }

  function saveCard() {
    if (!state.cardUrl || state.shareBusy) return;
    var miniTool = getMiniTool();
    if (!miniTool || typeof miniTool.saveImageToPhotosAlbum !== 'function') {
      setShareStatus('当前版本不支持保存到相册，可截图结果页。', true);
      return;
    }
    state.shareBusy = true;
    saveCardBtn.disabled = true;
    setShareStatus('正在保存…', false);
    apiCall('saveImageToPhotosAlbum', { filePath: state.cardUrl }).then(function () {
      state.shareBusy = false;
      saveCardBtn.disabled = false;
      setShareStatus('已保存到相册。', false);
    }).catch(function (error) {
      state.shareBusy = false;
      saveCardBtn.disabled = false;
      setShareStatus('保存失败' + (error && error.errCode ? '（' + error.errCode + '）' : '') + '，可截图结果页。', true);
    });
  }

  function shareCard() {
    if (!state.cardUrl || state.shareBusy) return;
    var miniTool = getMiniTool();
    if (!miniTool || typeof miniTool.share !== 'function') {
      setShareStatus('当前版本不支持直接分享，请先保存成绩卡。', true);
      return;
    }
    state.shareBusy = true;
    shareCardBtn.disabled = true;
    setShareStatus('正在打开分享…', false);
    apiCall('share', { type: 'image', image_resource: state.cardUrl }).then(function () {
      state.shareBusy = false;
      shareCardBtn.disabled = false;
      setShareStatus('已打开分享面板（成功仅表示流程已启动）。', false);
    }).catch(function (error) {
      state.shareBusy = false;
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

  function postNote() {
    if (!state.cardUrl || state.shareBusy) return;
    var miniTool = getMiniTool();
    if (!miniTool || typeof miniTool.postNote !== 'function') {
      setShareStatus('当前版本不支持发布笔记，请先保存成绩卡。', true);
      return;
    }
    var game = state.game;
    state.shareBusy = true;
    postNoteBtn.disabled = true;
    setShareStatus('正在打开笔记发布页…', false);
    apiCall('postNote', {
      title: '课间十分钟：吃了 ' + (game ? game.eaten : 0) + ' 个零食',
      content: '我在「课间十分钟 · 贪吃蛇」里吃了 ' + (game ? game.eaten : 0) + ' 个零食，得了 ' +
        (game ? game.score : 0) + ' 分。下课铃响前，把课桌里的零食吃个够。',
      pageType: 'photo_publish',
      mediaInfo: { image_resources: [{ url: state.cardUrl }] }
    }).then(function () {
      state.shareBusy = false;
      postNoteBtn.disabled = false;
      setShareStatus('已打开笔记发布页，发布结果以平台为准。', false);
    }).catch(function (error) {
      state.shareBusy = false;
      postNoteBtn.disabled = false;
      setShareStatus('打开笔记发布页失败' + (error && error.errCode ? '（' + error.errCode + '）' : '') +
        '，可先保存图片。', true);
    });
  }

  /* ---------- 输入 ---------- */

  function turn(dx, dy) {
    if (!state.running || !state.game) return;
    Engine.turn(state.game, dx, dy);
  }

  function bindPointer() {
    canvas.addEventListener('pointerdown', function (event) {
      if (event.cancelable) event.preventDefault();
      pointerStart = { x: event.clientX, y: event.clientY, t: Date.now() };
    });

    canvas.addEventListener('pointerup', function (event) {
      if (!pointerStart) return;
      var dx = event.clientX - pointerStart.x;
      var dy = event.clientY - pointerStart.y;
      pointerStart = null;
      if (Math.abs(dx) < 16 && Math.abs(dy) < 16) return;
      if (Math.abs(dx) > Math.abs(dy)) {
        turn(dx > 0 ? 1 : -1, 0);
      } else {
        turn(0, dy > 0 ? 1 : -1);
      }
    });

    canvas.addEventListener('pointercancel', function () {
      pointerStart = null;
    });
  }

  function bindPad() {
    var buttons = document.querySelectorAll('.pad-btn');
    for (var i = 0; i < buttons.length; i += 1) {
      (function (btn) {
        function press(event) {
          if (event && event.cancelable) event.preventDefault();
          turn(Number(btn.getAttribute('data-dx')), Number(btn.getAttribute('data-dy')));
        }
        btn.addEventListener('pointerdown', press);
        btn.addEventListener('click', function (event) {
          if (event && event.preventDefault) event.preventDefault();
          press(null);
        });
      }(buttons[i]));
    }
  }

  function bindKeys() {
    document.addEventListener('keydown', function (event) {
      var code = event.code || '';
      var key = event.key || '';
      if (code === 'ArrowUp' || key === 'w' || key === 'W') { turn(0, -1); }
      else if (code === 'ArrowDown' || key === 's' || key === 'S') { turn(0, 1); }
      else if (code === 'ArrowLeft' || key === 'a' || key === 'A') { turn(-1, 0); }
      else if (code === 'ArrowRight' || key === 'd' || key === 'D') { turn(1, 0); }
      else return;
      if (state.running && event.cancelable) event.preventDefault();
    });
  }

  function bind() {
    startBtn.addEventListener('click', startGame);
    againBtn.addEventListener('click', startGame);
    saveCardBtn.addEventListener('click', saveCard);
    shareCardBtn.addEventListener('click', shareCard);
    postNoteBtn.addEventListener('click', postNote);
    if (sfxBtn) {
      sfxBtn.addEventListener('click', function () {
        sound.sfx = !sound.sfx;
        renderSound();
        saveBest();
        if (sound.sfx) tone(660, 0, 0.08, 'sine', 0.05);
      });
    }
    if (bgmBtn) {
      bgmBtn.addEventListener('click', function () {
        sound.bgm = !sound.bgm;
        renderSound();
        saveBest();
        if (sound.bgm) {
          ensureAudio();
          startBgm();
        } else {
          stopBgm();
        }
      });
    }
    bindPointer();
    bindPad();
    bindKeys();
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        pointerStart = null;
        stopBgm();
      } else if (sound.bgm) {
        startBgm();
      }
    });
  }

  /* ---------- 主循环 ---------- */

  function frame(t) {
    var now = t || Date.now();
    var dt = state.lastTime ? Math.min(0.1, (now - state.lastTime) / 1000) : 0.016;
    state.lastTime = now;

    if (state.running && state.game) {
      Engine.update(state.game, dt, Math.random);
      handleEvents(state.game);
      updateHud(state.game);
      render(state.game);
      if (state.pop) {
        state.pop.life -= dt;
        if (state.pop.life < 0) state.pop = null;
      }
      if (state.game.phase === 'over') finishGame(state.game);
    } else if (state.game) {
      if (state.pop) {
        state.pop.life -= dt;
        if (state.pop.life < 0) state.pop = null;
      }
      render(state.game);
    } else if (state.idle) {
      render(state.idle);
    }
    window.requestAnimationFrame(frame);
  }

  function boot() {
    var ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx) {
      setStatus('当前环境无法绘制画布。', 'danger');
      return;
    }
    state.ctx = ctx;
    state.dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * state.dpr;
    canvas.height = H * state.dpr;
    canvas.style.width = '100%';
    canvas.style.height = 'auto';

    state.idle = Engine.create(Math.random);
    bind();
    renderSound();
    updateHud(state.idle);
    render(state.idle);
    renderBest();
    loadBest();
    window.requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}());
