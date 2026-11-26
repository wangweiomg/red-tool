/* 课堂偷吃大作战 · 2.5D 原型
 * 固定第一人称课桌视角；Canvas 绘制教室、老师和粉笔黑板。
 * 规则在 engine.js，本文件负责渲染、输入、音效、存储与成绩卡。
 */
(function () {
  'use strict';

  var Engine = window.ClassroomSnackEngine;
  if (!Engine) return;

  var canvas = document.getElementById('scene');
  var ctx = null;
  try {
    ctx = canvas.getContext && canvas.getContext('2d');
  } catch (error) {
    ctx = null;
  }

  var startOverlay = document.getElementById('start-overlay');
  var resultOverlay = document.getElementById('result-overlay');
  var startBtn = document.getElementById('start-btn');
  var againBtn = document.getElementById('again-btn');
  var eatBtn = document.getElementById('eat-btn');
  var eatFill = document.getElementById('eat-fill');
  var statusEl = document.getElementById('status');
  var hudSnacks = document.getElementById('hud-snacks');
  var hudLives = document.getElementById('hud-lives');
  var hudPhase = document.getElementById('hud-phase');
  var bestLabel = document.getElementById('best-label');
  var resultKicker = document.getElementById('result-kicker');
  var resultSnacks = document.getElementById('result-snacks');
  var resultTitle = document.getElementById('result-title');
  var resultBest = document.getElementById('result-best');
  var saveCardBtn = document.getElementById('save-card');
  var shareCardBtn = document.getElementById('share-card');
  var postNoteBtn = document.getElementById('post-note');
  var shareStatusEl = document.getElementById('share-status');

  var BEST_KEY = 'classroomsnack.v1.best';

  var state = {
    game: null,
    running: false,
    best: 0,
    plays: 0,
    cardUrl: '',
    shareBusy: false,
    lastTime: 0,
    chalkAcc: 0,
    crunchAcc: 0
  };
  var eatHeld = false;
  var audio = { ctx: null, master: null };

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
          renderBest();
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
      data: JSON.stringify({ v: 1, best: state.best, plays: state.plays })
    }).catch(function () {});
  }

  function renderBest() {
    if (bestLabel) {
      bestLabel.textContent = state.plays ?
        '最佳：吃 ' + state.best + ' 个 · 已玩 ' + state.plays + ' 局' :
        '还没有记录，先来一局。';
    }
  }

  function setStatus(text, kind) {
    statusEl.textContent = text;
    statusEl.className = 'status' + (kind ? ' is-' + kind : '');
  }

  function setShareStatus(text, isError) {
    shareStatusEl.textContent = text || '';
    shareStatusEl.className = isError ? 'share-status is-error' : 'share-status';
  }

  /* ---------- 音效（Web Audio 合成） ---------- */

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
    var c = ensureAudio();
    if (!c || !audio.master) return;
    try {
      var osc = c.createOscillator();
      var gain = c.createGain();
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      var t0 = c.currentTime + (start || 0);
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

  function sfxTurn() {
    tone(240, 0, 0.12, 'sine', 0.06);
    tone(180, 0.1, 0.16, 'sine', 0.05);
  }

  function sfxCaught() {
    tone(150, 0, 0.25, 'square', 0.05);
    tone(110, 0.12, 0.3, 'square', 0.04);
  }

  function sfxSnack() {
    tone(520, 0, 0.05, 'triangle', 0.04);
    tone(320, 0.05, 0.05, 'triangle', 0.03);
  }

  function sfxWin() {
    var notes = [523, 659, 784, 1047];
    for (var i = 0; i < notes.length; i += 1) {
      tone(notes[i], i * 0.12, 0.3, 'triangle', 0.06);
    }
  }

  function sfxOver() {
    var notes = [392, 330, 262];
    for (var i = 0; i < notes.length; i += 1) {
      tone(notes[i], i * 0.16, 0.28, 'sine', 0.05);
    }
  }

  /* ---------- 绘制工具 ---------- */

  function roundedRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  function polygon(points, fill, stroke, lineWidth) {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (var i = 1; i < points.length; i += 1) {
      ctx.lineTo(points[i][0], points[i][1]);
    }
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth || 2;
      ctx.stroke();
    }
  }

  /* ---------- 场景 ---------- */

  function drawRoom() {
    var wall = ctx.createLinearGradient(0, 0, 0, 360);
    wall.addColorStop(0, '#f4ead7');
    wall.addColorStop(1, '#e6d6bb');
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, 800, 360);

    var floor = ctx.createLinearGradient(0, 360, 0, 600);
    floor.addColorStop(0, '#c9a87c');
    floor.addColorStop(1, '#a9865d');
    ctx.fillStyle = floor;
    ctx.fillRect(0, 360, 800, 240);

    ctx.strokeStyle = 'rgba(120, 90, 60, 0.28)';
    ctx.lineWidth = 2;
    for (var i = -4; i <= 4; i += 1) {
      ctx.beginPath();
      ctx.moveTo(400, 330);
      ctx.lineTo(400 + i * 140, 620);
      ctx.stroke();
    }
    for (var j = 1; j <= 5; j += 1) {
      var y = 360 + j * j * 9;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(800, y);
      ctx.stroke();
    }

    // 左侧窗户
    polygon([[30, 80], [150, 110], [150, 270], [30, 240]], '#cfe2ee', '#b9a488', 4);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(90, 95);
    ctx.lineTo(90, 255);
    ctx.moveTo(30, 160);
    ctx.lineTo(150, 190);
    ctx.stroke();

    // 黑板
    polygon([[190, 66], [610, 66], [610, 272], [190, 272]], '#8a6a4b');
    polygon([[202, 78], [598, 78], [598, 260], [202, 260]], '#2f4a3a');
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(202, 78, 396, 54);
    ctx.strokeStyle = 'rgba(207, 230, 214, 0.75)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(230, 112);
    ctx.lineTo(420, 110);
    ctx.moveTo(230, 142);
    ctx.lineTo(360, 141);
    ctx.stroke();

    var chalk = state.game && state.game.phase === 'writing' ?
      Math.sin(Date.now() / 140) * 3 : 0;
    ctx.strokeStyle = 'rgba(207, 230, 214, 0.55)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(230, 206);
    ctx.quadraticCurveTo(300 + chalk, 186, 360, 204);
    ctx.quadraticCurveTo(420, 224, 500 - chalk, 202);
    ctx.stroke();

    // 讲台
    polygon([[300, 320], [500, 320], [520, 356], [280, 356]], '#b98b63', '#8a6a4b', 3);
    ctx.fillStyle = '#c9a87c';
    ctx.fillRect(280, 352, 240, 10);
  }

  function drawDesk(cx, y, w, h) {
    polygon(
      [[cx - w / 2, y], [cx + w / 2, y], [cx + w / 2 + 12, y + h], [cx - w / 2 - 12, y + h]],
      '#d8bb92', '#a9865d', 2
    );
    ctx.fillStyle = '#8a6a4b';
    ctx.fillRect(cx - w / 2 + 8, y + h, 8, 34);
    ctx.fillRect(cx + w / 2 - 16, y + h, 8, 34);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.fillRect(cx - w / 2 + 10, y + 6, w - 20, 5);
  }

  function drawDesks() {
    drawDesk(150, 420, 150, 26);
    drawDesk(650, 420, 150, 26);
    drawDesk(150, 500, 180, 30);
    drawDesk(650, 500, 180, 30);
    drawDesk(400, 560, 240, 34);
    // 桌上文具
    ctx.fillStyle = '#6f9a76';
    ctx.fillRect(118, 404, 30, 8);
    ctx.fillStyle = '#e8890c';
    ctx.fillRect(630, 484, 34, 10);
    ctx.fillStyle = '#b4553f';
    ctx.beginPath();
    ctx.arc(382, 548, 10, 0, Math.PI * 2, false);
    ctx.fill();
  }

  function drawTeacherBack() {
    // 身体
    ctx.fillStyle = '#4f6d8c';
    roundedRect(-44, -108, 88, 108, 16);
    ctx.fill();
    ctx.fillStyle = '#3f5a75';
    ctx.fillRect(-44, -46, 88, 46);
    // 手臂写字
    var angle = Math.sin(Date.now() / 180) * 8;
    ctx.strokeStyle = '#e8c9a8';
    ctx.lineWidth = 13;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(38, -78);
    ctx.lineTo(78 + angle, -92);
    ctx.stroke();
    ctx.fillStyle = '#e8c9a8';
    ctx.beginPath();
    ctx.arc(80 + angle, -94, 8, 0, Math.PI * 2, false);
    ctx.fill();
    // 头
    ctx.fillStyle = '#e8c9a8';
    ctx.beginPath();
    ctx.arc(0, -140, 32, 0, Math.PI * 2, false);
    ctx.fill();
    ctx.fillStyle = '#3a2f24';
    ctx.beginPath();
    ctx.arc(0, -146, 34, Math.PI * 0.95, Math.PI * 2.05, false);
    ctx.fill();
    ctx.fillStyle = '#3a2f24';
    ctx.fillRect(-30, -150, 60, 16);
  }

  function drawTeacherFront() {
    var angry = state.game && state.game.angry > 0;
    ctx.fillStyle = '#4f6d8c';
    roundedRect(-44, -108, 88, 108, 16);
    ctx.fill();
    ctx.fillStyle = '#3f5a75';
    ctx.fillRect(-44, -46, 88, 46);
    // 手
    ctx.strokeStyle = '#e8c9a8';
    ctx.lineWidth = 13;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-38, -78);
    ctx.lineTo(-58, -44);
    ctx.moveTo(38, -78);
    ctx.lineTo(58, -44);
    ctx.stroke();
    // 头
    ctx.fillStyle = '#e8c9a8';
    ctx.beginPath();
    ctx.arc(0, -140, 32, 0, Math.PI * 2, false);
    ctx.fill();
    ctx.fillStyle = '#3a2f24';
    ctx.beginPath();
    ctx.arc(0, -146, 34, Math.PI, Math.PI * 2, false);
    ctx.fill();
    ctx.fillRect(-30, -150, 60, 14);
    // 眼睛
    ctx.fillStyle = '#2b2420';
    ctx.beginPath();
    ctx.arc(-12, -138, 3.6, 0, Math.PI * 2, false);
    ctx.arc(12, -138, 3.6, 0, Math.PI * 2, false);
    ctx.fill();
    // 眉毛
    ctx.strokeStyle = '#2b2420';
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (angry) {
      ctx.moveTo(-20, -150);
      ctx.lineTo(-5, -144);
      ctx.moveTo(20, -150);
      ctx.lineTo(5, -144);
    } else {
      ctx.moveTo(-20, -148);
      ctx.lineTo(-5, -149);
      ctx.moveTo(20, -148);
      ctx.lineTo(5, -149);
    }
    ctx.stroke();
    // 嘴
    ctx.beginPath();
    if (angry) {
      ctx.arc(0, -118, 8, Math.PI * 0.15, Math.PI * 0.85, false);
    } else {
      ctx.moveTo(-7, -120);
      ctx.lineTo(7, -120);
    }
    ctx.stroke();
  }

  function drawTeacher() {
    if (!state.game) return;
    var game = state.game;
    var sx = 1;
    var front = false;
    if (game.phase === 'facing') {
      front = true;
    } else if (game.phase === 'turning') {
      var p = 1 - game.phaseLeft / Engine.TURN_TIME;
      sx = Math.max(0.05, Math.abs(Math.cos(p * Math.PI)));
      front = p >= 0.5;
    }
    ctx.save();
    ctx.translate(400, 352);
    ctx.scale(sx, 1);
    if (front) drawTeacherFront();
    else drawTeacherBack();
    ctx.restore();

    if (game.phase === 'turning') {
      ctx.fillStyle = '#b4553f';
      ctx.font = '800 40px "Noto Sans CJK SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', 400, 180);
      ctx.textAlign = 'left';
    }
  }

  function drawEatHand() {
    if (!state.game) return;
    var game = state.game;
    var visible = game.progress > 0.02 || game.chewing > 0;
    if (!visible) return;
    var lift = Math.min(1, game.progress + (game.chewing > 0 ? 0.6 : 0));
    var hx = 690 - lift * 120;
    var hy = 600 - lift * 90 - (game.chewing > 0 ? 40 : 0);
    ctx.strokeStyle = '#e8c9a8';
    ctx.lineWidth = 26;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(760, 620);
    ctx.lineTo(hx, hy);
    ctx.stroke();
    ctx.fillStyle = '#f2b14b';
    ctx.beginPath();
    ctx.arc(hx, hy - 8, 18, 0, Math.PI * 2, false);
    ctx.fill();
    ctx.fillStyle = '#d8780a';
    ctx.beginPath();
    ctx.arc(hx - 4, hy - 12, 4, 0, Math.PI * 2, false);
    ctx.arc(hx + 6, hy - 6, 3, 0, Math.PI * 2, false);
    ctx.fill();
    if (game.chewing > 0) {
      ctx.fillStyle = 'rgba(232, 137, 12, 0.75)';
      for (var i = 0; i < 3; i += 1) {
        ctx.beginPath();
        ctx.arc(hx - 30 - i * 14, hy + 10 + (i % 2) * 8, 3, 0, Math.PI * 2, false);
        ctx.fill();
      }
    }
  }

  function drawVignette() {
    if (!state.game) return;
    var game = state.game;
    var danger = game.phase === 'facing' || game.phase === 'turning';
    var flash = game.caughtFlash > 0 ? Math.min(0.6, game.caughtFlash * 0.4) : 0;
    var alpha = (danger ? 0.22 : 0) + flash;
    if (alpha <= 0) return;
    var g = ctx.createRadialGradient(400, 300, 160, 400, 300, 470);
    g.addColorStop(0, 'rgba(180, 60, 45, 0)');
    g.addColorStop(1, 'rgba(180, 60, 45, ' + alpha.toFixed(2) + ')');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 800, 600);
  }

  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, 800, 600);
    drawRoom();
    drawDesks();
    drawTeacher();
    drawEatHand();
    drawVignette();
  }

  /* ---------- HUD 与状态 ---------- */

  function updateHud() {
    var game = state.game;
    if (!game) {
      hudSnacks.textContent = '零食 0 / ' + Engine.TARGET;
      hudLives.textContent = '♥♥♥';
      hudPhase.textContent = '等待上课';
      return;
    }
    hudSnacks.textContent = '零食 ' + game.snacks + ' / ' + Engine.TARGET;
    var lives = '';
    for (var i = 0; i < 3; i += 1) {
      lives += i < game.lives ? '♥' : '♡';
    }
    hudLives.textContent = lives;
    if (game.phase === 'writing') {
      hudPhase.textContent = '老师写字中';
      hudPhase.className = 'hud-item hud-phase';
    } else if (game.phase === 'turning') {
      hudPhase.textContent = '老师转身！';
      hudPhase.className = 'hud-item hud-phase is-danger';
    } else if (game.phase === 'facing') {
      hudPhase.textContent = '老师盯着你';
      hudPhase.className = 'hud-item hud-phase is-danger';
    } else {
      hudPhase.textContent = game.phase === 'win' ? '下课！' : '被抓住了';
      hudPhase.className = 'hud-item hud-phase';
    }
  }

  function updateEatUi() {
    var game = state.game;
    var progress = game ? game.progress : 0;
    eatFill.style.width = Math.round(Math.min(1, progress) * 100) + '%';
    if (state.running && game) {
      eatBtn.disabled = false;
      if (game.phase === 'facing') {
        eatBtn.textContent = '别动！';
      } else if (game.chewing > 0) {
        eatBtn.textContent = '嚼嚼嚼…';
      } else {
        eatBtn.textContent = '按住吃';
      }
    } else {
      eatBtn.disabled = true;
      eatBtn.textContent = '按住吃';
    }
  }

  function handleEvents(events) {
    for (var i = 0; i < events.length; i += 1) {
      var type = events[i].type;
      if (type === 'turn') {
        sfxTurn();
        setStatus('老师要转身了，快停！', 'danger');
      } else if (type === 'facing') {
        setStatus('老师盯着你，别动。', 'danger');
      } else if (type === 'caught') {
        eatHeld = false;
        sfxCaught();
        setStatus('被抓到了！嘴里还有东西。', 'danger');
      } else if (type === 'snack') {
        sfxSnack();
        setStatus('吃到一个，继续。', 'ok');
      } else if (type === 'write') {
        setStatus('老师转回去了，可以吃了。', 'ok');
      }
    }
  }

  /* ---------- 游戏流程 ---------- */

  function startGame() {
    ensureAudio();
    state.game = Engine.create(Math.random);
    state.running = true;
    eatHeld = false;
    state.chalkAcc = 0;
    state.crunchAcc = 0;
    startOverlay.hidden = true;
    resultOverlay.hidden = true;
    eatBtn.disabled = false;
    setShareStatus('', false);
    setStatus('老师写字中，按住「吃」偷吃。', 'ok');
    updateHud();
    updateEatUi();
    state.lastTime = 0;
  }

  function finishGame() {
    var game = state.game;
    if (!game || !state.running) return;
    state.running = false;
    eatHeld = false;
    eatBtn.disabled = true;
    var won = game.phase === 'win';
    if (game.snacks > state.best) state.best = game.snacks;
    state.plays += 1;
    saveBest();
    renderBest();

    if (won) sfxWin();
    else sfxOver();

    resultKicker.textContent = won ? '成功撑到下课' : '被老师抓包了';
    resultSnacks.textContent = String(game.snacks);
    resultTitle.textContent = won ? '课堂神偷' : '下次藏好点';
    resultBest.textContent = '最佳：' + state.best + ' 个 · 已玩 ' + state.plays + ' 局';

    state.cardUrl = generateCard(game, won);
    updateShareButtons();
    resultOverlay.hidden = false;
    setStatus(won ? '吃满 10 个，成功下课！' : '三条命用完，下课了。', won ? 'ok' : 'danger');
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

  /* ---------- 成绩卡 ---------- */

  function generateCard(game, won) {
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

    g.fillStyle = 'rgba(47, 74, 58, 0.12)';
    g.beginPath();
    g.arc(760, 170, 210, 0, Math.PI * 2, false);
    g.fill();
    g.fillStyle = 'rgba(216, 154, 60, 0.16)';
    g.beginPath();
    g.arc(120, 1040, 230, 0, Math.PI * 2, false);
    g.fill();

    g.textAlign = 'center';
    g.fillStyle = '#8a6a2f';
    g.font = '600 20px "Noto Sans CJK SC", sans-serif';
    g.fillText('CLASSROOM SNACK', 450, 96);
    g.fillStyle = '#3f352b';
    g.font = '800 50px "Noto Sans CJK SC", sans-serif';
    g.fillText('课堂偷吃大作战', 450, 164);
    g.fillStyle = '#8a7a68';
    g.font = '24px "Noto Sans CJK SC", sans-serif';
    g.fillText(won ? '成功撑到下课' : '被老师抓包了', 450, 208);

    g.fillStyle = '#e8890c';
    g.font = '800 130px "Noto Sans CJK SC", sans-serif';
    g.fillText(String(game.snacks), 450, 420);
    g.fillStyle = '#8a7a68';
    g.font = '26px "Noto Sans CJK SC", sans-serif';
    g.fillText('个零食', 450, 466);

    g.fillStyle = '#3f352b';
    g.font = '800 40px "Noto Sans CJK SC", sans-serif';
    g.fillText(won ? '课堂神偷' : '下次藏好点', 450, 550);

    var hearts = '';
    for (var i = 0; i < 3; i += 1) hearts += i < game.lives ? '♥ ' : '♡ ';
    g.fillStyle = '#b4553f';
    g.font = '34px "Noto Sans CJK SC", sans-serif';
    g.fillText(hearts, 450, 610);

    g.fillStyle = '#8a7a68';
    g.font = '24px "Noto Sans CJK SC", sans-serif';
    g.fillText('老师转身前，咽下去', 450, 840);

    g.fillStyle = '#b08a5a';
    g.font = '22px "Noto Sans CJK SC", sans-serif';
    g.fillText('课堂偷吃大作战 · 2.5D 原型', 450, 1080);
    g.textAlign = 'left';

    try {
      return c.toDataURL('image/jpeg', 0.9);
    } catch (error) {
      return '';
    }
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
    var won = game && game.phase === 'win';
    state.shareBusy = true;
    postNoteBtn.disabled = true;
    setShareStatus('正在打开笔记发布页…', false);
    apiCall('postNote', {
      title: '课堂偷吃：吃了 ' + (game ? game.snacks : 0) + ' 个',
      content: '我在「课堂偷吃大作战」里' + (won ? '成功撑到下课' : '被老师抓包了') +
        '，一共吃了 ' + (game ? game.snacks : 0) + ' 个零食。老师转身前，记得咽下去。',
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

  /* ---------- 主循环 ---------- */

  function frame(t) {
    var now = t || Date.now();
    var dt = state.lastTime ? Math.min(0.1, (now - state.lastTime) / 1000) : 0.016;
    state.lastTime = now;

    if (state.running && state.game) {
      Engine.setEating(state.game, eatHeld);
      Engine.tick(state.game, dt, Math.random);
      handleEvents(state.game.events);
      updateHud();
      updateEatUi();

      if (state.game.phase === 'over' || state.game.phase === 'win') {
        finishGame();
      }

      // 粉笔声
      if (state.game.phase === 'writing' && Math.random() < 0.4) {
        state.chalkAcc += dt;
        if (state.chalkAcc > 0.2) {
          state.chalkAcc = 0;
          tone(1200 + Math.random() * 500, 0, 0.015, 'square', 0.006);
        }
      }
      if (eatHeld) {
        state.crunchAcc += dt;
        if (state.crunchAcc > 0.26) {
          state.crunchAcc = 0;
          tone(170, 0, 0.03, 'square', 0.018);
        }
      }
    }

    draw();
    window.requestAnimationFrame(frame);
  }

  /* ---------- 事件 ---------- */

  function pressEat(event) {
    if (!state.running) return;
    ensureAudio();
    eatHeld = true;
    if (event && event.cancelable) event.preventDefault();
  }

  function releaseEat() {
    eatHeld = false;
  }

  function bind() {
    startBtn.addEventListener('click', startGame);
    againBtn.addEventListener('click', startGame);

    eatBtn.addEventListener('pointerdown', pressEat);
    eatBtn.addEventListener('pointerup', releaseEat);
    eatBtn.addEventListener('pointercancel', releaseEat);
    eatBtn.addEventListener('pointerleave', releaseEat);
    document.addEventListener('pointerup', releaseEat);

    document.addEventListener('keydown', function (event) {
      if (event.code === 'Space' || event.key === ' ') {
        if (state.running) {
          event.preventDefault();
          pressEat();
        }
      }
    });
    document.addEventListener('keyup', function (event) {
      if (event.code === 'Space' || event.key === ' ') {
        releaseEat();
      }
    });

    saveCardBtn.addEventListener('click', saveCard);
    shareCardBtn.addEventListener('click', shareCard);
    postNoteBtn.addEventListener('click', postNote);

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) releaseEat();
    });
  }

  function boot() {
    if (!ctx) {
      setStatus('当前环境无法创建画布，请换设备再试。', 'danger');
      return;
    }
    bind();
    loadBest();
    renderBest();
    updateHud();
    updateEatUi();
    window.requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}());
