/* 课堂偷吃大作战 3D
 * 固定机位 Three.js 教室；规则来自 classroom-snack engine.js。
 */
(function () {
  'use strict';

  var Engine = window.ClassroomSnackEngine;
  var THREE = window.THREE;
  if (!Engine) return;

  var canvas = document.getElementById('scene');
  var startOverlay = document.getElementById('start-overlay');
  var resultOverlay = document.getElementById('result-overlay');
  var levelList = document.getElementById('level-list');
  var eatBtn = document.getElementById('eat-btn');
  var eatFill = document.getElementById('eat-fill');
  var statusEl = document.getElementById('status');
  var hudSnacks = document.getElementById('hud-snacks');
  var hudLives = document.getElementById('hud-lives');
  var hudPhase = document.getElementById('hud-phase');
  var bestLabel = document.getElementById('best-label');
  var resultKicker = document.getElementById('result-kicker');
  var resultStars = document.getElementById('result-stars');
  var resultSnacks = document.getElementById('result-snacks');
  var resultTitle = document.getElementById('result-title');
  var resultBest = document.getElementById('result-best');
  var nextBtn = document.getElementById('next-btn');
  var menuBtn = document.getElementById('menu-btn');
  var saveCardBtn = document.getElementById('save-card');
  var shareCardBtn = document.getElementById('share-card');
  var postNoteBtn = document.getElementById('post-note');
  var shareStatusEl = document.getElementById('share-status');
  var sfxBtn = document.getElementById('toggle-sfx');
  var bgmBtn = document.getElementById('toggle-bgm');

  var BEST_KEY = 'classroomsnack3d.v1.best';
  var LEVELS = Engine.LEVELS || [];

  var state = {
    game: null,
    running: false,
    levelIndex: 0,
    stars: {},
    pendingNext: 0,
    best: 0,
    plays: 0,
    cardUrl: '',
    shareBusy: false,
    lastTime: 0,
    chalkAcc: 0,
    crunchAcc: 0
  };
  var eatHeld = false;
  var sound = { sfx: true, bgm: true };
  var audio = {
    ctx: null,
    master: null,
    bgmRunning: false,
    bgmTimer: null,
    bgmStep: 0,
    bgmToken: 0
  };
  var poseBlend = 1;

  var LOOKS = {
    chinese: {
      shirt: 0xb06a52, shirtDark: 0x8f523e, shirtLight: 0xc98a70,
      trouser: 0x4a3f3a, shoe: 0x3a2f28, hair: 0x2f2620,
      vest: 0, glasses: false, hairStyle: 'long'
    },
    math: {
      shirt: 0x6f92b8, shirtDark: 0x42607f, shirtLight: 0x8aa8c6,
      trouser: 0x3b4658, shoe: 0x2f2b28, hair: 0x3a2f24,
      vest: 0, glasses: true, hairStyle: 'short'
    },
    english: {
      shirt: 0xe6d9bf, shirtDark: 0x5f7d57, shirtLight: 0xdad0b6,
      trouser: 0x45454a, shoe: 0x3a2f28, hair: 0x5a3b26,
      vest: 0x5f7d57, glasses: true, hairStyle: 'bun'
    },
    physics: {
      shirt: 0x5d6b7a, shirtDark: 0x46525e, shirtLight: 0x7c8a99,
      trouser: 0x33373d, shoe: 0x2f2b28, hair: 0x2b2622,
      vest: 0, glasses: true, hairStyle: 'short'
    },
    chemistry: {
      shirt: 0x8f7aa8, shirtDark: 0x71608a, shirtLight: 0xab97c2,
      trouser: 0x3c3844, shoe: 0x3a2f28, hair: 0x4a3a2c,
      vest: 0, glasses: true, hairStyle: 'long'
    },
    final: {
      shirt: 0x3f3a36, shirtDark: 0x2f2b28, shirtLight: 0x5a534d,
      trouser: 0x2b2b30, shoe: 0x241f1c, hair: 0x2a2522,
      vest: 0, glasses: true, hairStyle: 'short'
    }
  };
  var teacherParts = {
    shirt: [], shirtDark: [], shirtLight: [], trouser: [], hair: [], shoe: []
  };
  var teacherLookParts = {
    glasses: null, vest: null, vestMaterial: null, hairLong: null, hairBun: null
  };

  var renderer = null;
  var scene = null;
  var camera = null;
  var teacher = null;
  var teacherArm = null;
  var teacherElbow = null;
  var teacherHand = null;
  var teacherArmL = null;
  var teacherElbowL = null;
  var teacherChalk = null;
  var teacherHead = null;
  var brows = [];
  var fingers = [];
  var crumbs = [];
  var handGroup = null;
  var chip = null;
  var cookieWhole = null;
  var cookieBitten = null;
  var mouthGroup = null;
  var mouthOpening = null;
  var teeth = null;
  var exclaim = null;
  var clockTime = 0;
  var handTarget = null;
  var boardCanvas = null;
  var boardCtx = null;
  var boardTexture = null;
  var webglReady = false;

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
          if (saved.sound && typeof saved.sound === 'object') {
            sound.sfx = saved.sound.sfx !== false;
            sound.bgm = !!saved.sound.bgm;
          }
          if (saved.levels && typeof saved.levels === 'object') {
            for (var i = 0; i < LEVELS.length; i += 1) {
              var value = saved.levels[LEVELS[i].id];
              if (value) {
                state.stars[LEVELS[i].id] = Math.max(0, Math.min(3, Math.floor(value)));
              }
            }
          }
          renderBest();
          renderSoundUi();
          renderLevels();
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
        levels: state.stars,
        sound: { sfx: sound.sfx, bgm: sound.bgm }
      })
    }).catch(function () {});
  }

  function totalStars() {
    var sum = 0;
    for (var i = 0; i < LEVELS.length; i += 1) {
      sum += state.stars[LEVELS[i].id] || 0;
    }
    return sum;
  }

  function renderBest() {
    if (bestLabel) {
      bestLabel.textContent = state.plays ?
        '总星数 ' + totalStars() + ' / ' + (LEVELS.length * 3) + ' · 已玩 ' + state.plays + ' 局' :
        '还没有记录，先选一节课。';
    }
  }

  function levelStarsText(stars) {
    var text = '';
    for (var i = 0; i < 3; i += 1) {
      text += i < stars ? '★' : '☆';
    }
    return text;
  }

  function setStatus(text, kind) {
    statusEl.textContent = text;
    statusEl.className = 'status' + (kind ? ' is-' + kind : '');
  }

  function setShareStatus(text, isError) {
    shareStatusEl.textContent = text || '';
    shareStatusEl.className = isError ? 'share-status is-error' : 'share-status';
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

  function buzz(type) {
    var miniTool = getMiniTool();
    if (!miniTool || typeof miniTool.vibrateShort !== 'function') return;
    try {
      miniTool.vibrateShort({ type: type || 'medium' });
    } catch (error) {
      /* 忽略 */
    }
  }

  function audioSupported() {
    return !!(window.AudioContext || window.webkitAudioContext);
  }

  function midiFreq(note) {
    return 440 * Math.pow(2, (note - 69) / 12);
  }

  function sfxPause() {
    if (!sound.sfx) return;
    tone(360, 0, 0.06, 'sine', 0.025);
  }

  function sfxTurn() {
    if (!sound.sfx) return;
    tone(240, 0, 0.12, 'sine', 0.06);
    tone(180, 0.1, 0.16, 'sine', 0.05);
  }

  function sfxCaught() {
    if (!sound.sfx) return;
    tone(150, 0, 0.25, 'square', 0.05);
    tone(110, 0.12, 0.3, 'square', 0.04);
  }

  function sfxSnack() {
    if (!sound.sfx) return;
    tone(520, 0, 0.05, 'triangle', 0.04);
    tone(320, 0.05, 0.05, 'triangle', 0.03);
  }

  function sfxWin() {
    if (!sound.sfx) return;
    var notes = [523, 659, 784, 1047];
    for (var i = 0; i < notes.length; i += 1) {
      tone(notes[i], i * 0.12, 0.3, 'triangle', 0.06);
    }
  }

  function sfxOver() {
    if (!sound.sfx) return;
    var notes = [392, 330, 262];
    for (var i = 0; i < notes.length; i += 1) {
      tone(notes[i], i * 0.16, 0.28, 'sine', 0.05);
    }
  }

  /* 舒缓背景音乐：原创五声音阶摇篮曲，C – Am – F – G 慢速分解和弦。
   * 全部用 Web Audio 合成，不引入音频文件；每 360ms 一步，32 步约 11.5 秒一循环。 */
  var BGM_STEP_MS = 360;
  var BGM_MELODY = [
    76, 0, 79, 81, 0, 79, 0, 76,
    72, 0, 69, 76, 0, 72, 0, 0,
    81, 0, 84, 81, 0, 79, 0, 76,
    79, 0, 76, 74, 0, 72, 0, 0
  ];
  var BGM_CHORDS = [
    [48, 60, 64, 67],
    [45, 57, 60, 64],
    [41, 53, 57, 60],
    [43, 55, 59, 62]
  ];

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
      var index = audio.bgmStep % 32;
      var note = BGM_MELODY[index];
      if (note) {
        tone(midiFreq(note), 0, 1.1, 'sine', 0.024);
      }
      if (index % 8 === 0) {
        var chord = BGM_CHORDS[(index / 8) % 4];
        for (var i = 0; i < chord.length; i += 1) {
          tone(midiFreq(chord[i]), i * 0.04, 2.3, 'sine', i === 0 ? 0.018 : 0.011);
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

  function renderSoundUi() {
    var supported = audioSupported();
    if (sfxBtn) {
      sfxBtn.className = sound.sfx ? 'sound-toggle is-on' : 'sound-toggle';
      sfxBtn.setAttribute('aria-checked', sound.sfx ? 'true' : 'false');
      sfxBtn.disabled = !supported;
    }
    if (bgmBtn) {
      bgmBtn.className = sound.bgm ? 'sound-toggle is-on' : 'sound-toggle';
      bgmBtn.setAttribute('aria-checked', sound.bgm ? 'true' : 'false');
      bgmBtn.disabled = !supported;
    }
  }

  /* ---------- 3D 场景搭建 ---------- */

  function material(color) {
    return new THREE.MeshLambertMaterial({ color: color });
  }

  function box(w, h, d, color) {
    return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material(color));
  }

  function paintBoard(label) {
    var g = boardCtx;
    if (!g) return;
    g.fillStyle = '#2f4a3a';
    g.fillRect(0, 0, 512, 256);
    g.strokeStyle = 'rgba(207, 230, 214, 0.85)';
    g.lineWidth = 6;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(40, 60);
    g.lineTo(300, 56);
    g.moveTo(40, 100);
    g.lineTo(230, 98);
    g.stroke();
    g.beginPath();
    g.moveTo(40, 180);
    g.quadraticCurveTo(120, 150, 200, 178);
    g.quadraticCurveTo(280, 206, 380, 172);
    g.stroke();
    g.fillStyle = 'rgba(207, 230, 214, 0.9)';
    if (label === '数学课') {
      g.font = '700 38px "Noto Sans CJK SC", sans-serif';
      g.fillText('3 + 4 = 7', 286, 88);
      g.beginPath();
      g.moveTo(330, 158);
      g.lineTo(372, 158);
      g.lineTo(351, 118);
      g.closePath();
      g.stroke();
    } else if (label === '英语课') {
      g.font = '700 40px "Noto Sans CJK SC", sans-serif';
      g.fillText('A B C', 300, 88);
      g.beginPath();
      g.moveTo(300, 154);
      g.lineTo(364, 154);
      g.stroke();
    } else if (label === '物理课') {
      g.font = '700 38px "Noto Sans CJK SC", sans-serif';
      g.fillText('F = ma', 300, 88);
      g.strokeRect(298, 120, 66, 34);
      g.beginPath();
      g.arc(390, 137, 10, 0, Math.PI * 2, false);
      g.stroke();
    } else if (label === '化学课') {
      g.font = '700 38px "Noto Sans CJK SC", sans-serif';
      g.fillText('H2O', 300, 88);
      g.beginPath();
      g.moveTo(318, 170);
      g.lineTo(360, 170);
      g.lineTo(339, 128);
      g.closePath();
      g.stroke();
    } else if (label === '期末考试') {
      g.font = '700 32px "Noto Sans CJK SC", sans-serif';
      g.fillText('第 1 题', 300, 88);
      g.fillText('认真作答', 296, 132);
    }
    g.font = '700 44px "Noto Sans CJK SC", sans-serif';
    g.fillText(label || '语文课', 40, 236);
    if (boardTexture) boardTexture.needsUpdate = true;
  }

  function buildBlackboardTexture(label) {
    var c = document.createElement('canvas');
    c.width = 512;
    c.height = 256;
    boardCanvas = c;
    boardCtx = c.getContext('2d');
    paintBoard(label || '语文课');
    boardTexture = new THREE.CanvasTexture(c);
    return boardTexture;
  }

  function buildPosterTexture() {
    var c = document.createElement('canvas');
    c.width = 128;
    c.height = 96;
    var g = c.getContext('2d');
    g.fillStyle = '#fdf6e6';
    g.fillRect(0, 0, 128, 96);
    g.fillStyle = '#e8b04b';
    g.beginPath();
    g.arc(96, 28, 15, 0, Math.PI * 2, false);
    g.fill();
    g.fillStyle = '#5b7fa6';
    g.fillRect(14, 58, 100, 6);
    g.fillRect(14, 70, 76, 5);
    g.fillStyle = '#8a6a2f';
    g.font = '700 20px "Noto Sans CJK SC", sans-serif';
    g.fillText('好好学习', 12, 44);
    return new THREE.CanvasTexture(c);
  }

  function buildRoom() {
    var floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), material(0xb08a5f));
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    var backWall = new THREE.Mesh(new THREE.PlaneGeometry(12, 4.4), material(0xf0e4cf));
    backWall.position.set(0, 2.2, -3.6);
    scene.add(backWall);

    var leftWall = new THREE.Mesh(new THREE.PlaneGeometry(10, 4.4), material(0xe8d9bf));
    leftWall.position.set(-5.4, 2.2, 0);
    leftWall.rotation.y = Math.PI / 2;
    scene.add(leftWall);

    var rightWall = new THREE.Mesh(new THREE.PlaneGeometry(10, 4.4), material(0xe8d9bf));
    rightWall.position.set(5.4, 2.2, 0);
    rightWall.rotation.y = -Math.PI / 2;
    scene.add(rightWall);

    var frame = box(3.9, 1.72, 0.08, 0x8a6a4b);
    frame.position.set(0, 2.0, -3.53);
    scene.add(frame);

    var board = new THREE.Mesh(new THREE.PlaneGeometry(3.62, 1.5),
      new THREE.MeshBasicMaterial({ map: buildBlackboardTexture() }));
    board.position.set(0, 2.0, -3.48);
    scene.add(board);

    // 讲台移到左侧，给老师留出贴近黑板的站位
    var teacherDesk = box(1.7, 0.78, 0.56, 0xb98b63);
    teacherDesk.position.set(-2.55, 0.39, -2.95);
    teacherDesk.rotation.y = 0.2;
    scene.add(teacherDesk);
    var lecternBook = box(0.34, 0.06, 0.24, 0xd8c7a8);
    lecternBook.position.set(-2.5, 0.81, -2.95);
    lecternBook.rotation.y = 0.32;
    scene.add(lecternBook);

    function desk(x, z, scale) {
      var g = new THREE.Group();
      var top = box(1.5 * scale, 0.08, 0.68 * scale, 0xd8bb92);
      top.position.y = 0.72;
      g.add(top);
      for (var i = 0; i < 4; i += 1) {
        var leg = box(0.07, 0.72, 0.07, 0x8a6a4b);
        leg.position.set((i < 2 ? -1 : 1) * 0.64 * scale, 0.36, (i % 2 ? -1 : 1) * 0.26 * scale);
        g.add(leg);
      }
      g.position.set(x, 0, z);
      scene.add(g);
    }

    desk(-2.2, 0.7, 0.95);
    desk(2.2, 0.7, 0.95);
    desk(-2.2, 1.9, 1.05);
    desk(2.2, 1.9, 1.05);

    function deskBook(x, z, rot) {
      var book = box(0.34, 0.05, 0.24, 0xdfe8db);
      book.position.set(x, 0.785, z);
      book.rotation.y = rot;
      scene.add(book);
    }
    deskBook(-2.35, 0.6, 0.25);
    deskBook(2.05, 1.85, -0.18);

    // 玩家自己的课桌（前景）
    var playerDesk = box(3.5, 0.1, 0.9, 0xd8bb92);
    playerDesk.position.set(0, 0.66, 2.65);
    scene.add(playerDesk);
    var notebook = box(0.72, 0.03, 0.5, 0xffffff);
    notebook.position.set(0.66, 0.73, 2.55);
    notebook.rotation.y = 0.18;
    scene.add(notebook);
    var pencil = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.34, 6), material(0xe0a94b));
    pencil.rotation.z = Math.PI / 2;
    pencil.rotation.y = 0.3;
    pencil.position.set(-0.55, 0.74, 2.6);
    scene.add(pencil);

    // 墙上挂钟
    var clockFace = new THREE.Mesh(new THREE.CircleGeometry(0.22, 24), material(0xffffff));
    clockFace.position.set(2.65, 2.65, -3.57);
    scene.add(clockFace);
    var handHour = box(0.02, 0.12, 0.01, 0x2b2420);
    handHour.position.set(2.65, 2.70, -3.55);
    scene.add(handHour);
    var handMinute = box(0.015, 0.16, 0.01, 0x2b2420);
    handMinute.position.set(2.68, 2.64, -3.55);
    handMinute.rotation.z = -1.1;
    scene.add(handMinute);

    // 后墙海报
    var posterFrame = box(0.82, 0.62, 0.02, 0x8a6a4b);
    posterFrame.position.set(-2.7, 2.3, -3.56);
    scene.add(posterFrame);
    var poster = new THREE.Mesh(new THREE.PlaneGeometry(0.74, 0.54),
      new THREE.MeshBasicMaterial({ map: buildPosterTexture() }));
    poster.position.set(-2.7, 2.3, -3.545);
    scene.add(poster);

    // 黑板粉笔槽
    var tray = box(3.8, 0.06, 0.14, 0x7a5a3e);
    tray.position.set(0, 1.2, -3.42);
    scene.add(tray);
    var trayChalk = box(0.12, 0.035, 0.035, 0xffffff);
    trayChalk.position.set(-0.9, 1.25, -3.42);
    scene.add(trayChalk);
    var trayChalk2 = box(0.1, 0.035, 0.035, 0xf2c94c);
    trayChalk2.position.set(-0.7, 1.25, -3.42);
    scene.add(trayChalk2);

    // 桌面接触阴影
    var shadowMat = new THREE.MeshBasicMaterial({ color: 0x6b5335, transparent: true, opacity: 0.2 });
    var shadowGeo = new THREE.PlaneGeometry(1.7, 0.8);
    var shadowSpots = [[-2.2, 0.7], [2.2, 0.7], [-2.2, 1.9], [2.2, 1.9]];
    for (var sd = 0; sd < shadowSpots.length; sd += 1) {
      var sh = new THREE.Mesh(shadowGeo, shadowMat);
      sh.rotation.x = -Math.PI / 2;
      sh.position.set(shadowSpots[sd][0], 0.012, shadowSpots[sd][1]);
      scene.add(sh);
    }

    // 黑板擦与粉笔
    var eraser = box(0.24, 0.06, 0.12, 0x6f6a61);
    eraser.position.set(1.2, 1.05, -2.9);
    scene.add(eraser);
    var chalk = box(0.08, 0.04, 0.04, 0xffffff);
    chalk.position.set(1.42, 1.03, -2.88);
    scene.add(chalk);
  }

  function buildTeacher() {
    teacher = new THREE.Group();
    teacher.position.set(0, 0, -2.5);
    teacher.rotation.y = Math.PI;
    teacher.scale.set(1.18, 1.18, 1.18);

    var skin = 0xe8c9a8;
    var hairColor = 0x3a2f24;
    var shirtColor = 0x6f92b8;
    var shirtDark = 0x42607f;
    var shirtLight = 0x8aa8c6;
    var trouser = 0x3b4658;
    var shoeColor = 0x2f2b28;

    function add(mesh, x, y, z) {
      mesh.position.set(x, y, z);
      teacher.add(mesh);
      return mesh;
    }

    // 腿与鞋：裤腿略呈锥形，鞋头补圆角
    for (var s = 0; s < 2; s += 1) {
      var legSide = s ? 1 : -1;
      var pant = new THREE.Mesh(new THREE.CylinderGeometry(0.084, 0.066, 0.76, 10), material(trouser));
      pant.position.set(legSide * 0.13, 0.40, 0);
      teacher.add(pant);
      add(box(0.15, 0.085, 0.28, shoeColor), legSide * 0.13, 0.055, 0.05);
      var toe = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), material(shoeColor));
      toe.scale.set(1, 0.55, 1);
      toe.position.set(legSide * 0.13, 0.055, 0.185);
      teacher.add(toe);
    }

    // 胯部
    add(box(0.40, 0.20, 0.28, trouser), 0, 0.84, 0);
    add(box(0.42, 0.055, 0.30, 0x33302c), 0, 0.90, 0);

    // 躯干
    var torso = new THREE.Mesh(new THREE.CylinderGeometry(0.255, 0.30, 0.76, 16), material(shirtColor));
    torso.position.y = 1.15;
    teacher.add(torso);

    // 开衫马甲（英语老师）：背片 + 两片前襟
    var vestMaterial = new THREE.MeshLambertMaterial({ color: 0x5f7d57 });
    var vest = new THREE.Group();
    var vestBack = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.54, 0.03), vestMaterial);
    vestBack.position.set(0, 1.2, -0.3);
    vest.add(vestBack);
    var vestFrontL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.54, 0.03), vestMaterial);
    vestFrontL.position.set(-0.2, 1.2, 0.298);
    vest.add(vestFrontL);
    var vestFrontR = vestFrontL.clone();
    vestFrontR.position.x = 0.2;
    vest.add(vestFrontR);
    vest.visible = false;
    teacher.add(vest);

    // 门襟与纽扣
    add(box(0.05, 0.54, 0.015, shirtLight), 0, 1.18, 0.272);
    for (var b = 0; b < 3; b += 1) {
      var button = new THREE.Mesh(new THREE.SphereGeometry(0.013, 6, 6), material(0xf6efe2));
      button.position.set(0, 1.40 - b * 0.14, 0.268 - b * 0.004);
      teacher.add(button);
    }

    // 衬衫领口：两片领子拼成 V 形，贴在胸口表面
    var collarL = box(0.15, 0.055, 0.02, 0xf6efe2);
    collarL.position.set(-0.075, 1.515, 0.243);
    collarL.rotation.z = 0.5;
    teacher.add(collarL);
    var collarR = collarL.clone();
    collarR.position.x = 0.075;
    collarR.rotation.z = -0.5;
    teacher.add(collarR);

    // 肩部
    var shoulderL = new THREE.Mesh(new THREE.SphereGeometry(0.088, 10, 8), material(shirtDark));
    shoulderL.scale.set(1, 0.88, 0.95);
    shoulderL.position.set(-0.29, 1.44, 0);
    teacher.add(shoulderL);
    var shoulderR = shoulderL.clone();
    shoulderR.position.x = 0.29;
    teacher.add(shoulderR);

    // 脖子
    var neck = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.08, 0.15, 10), material(skin));
    neck.position.y = 1.60;
    teacher.add(neck);

    // 头
    teacherHead = new THREE.Group();
    teacherHead.position.set(0, 1.78, 0);
    teacher.add(teacherHead);

    var head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 20, 16), material(skin));
    teacherHead.add(head);

    // 耳朵
    var earL = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), material(skin));
    earL.position.set(-0.185, 0, 0);
    teacherHead.add(earL);
    var earR = earL.clone();
    earR.position.x = 0.185;
    teacherHead.add(earR);

    // 头发
    var hair = new THREE.Mesh(new THREE.SphereGeometry(0.20, 18, 14), material(hairColor));
    hair.scale.set(1.03, 0.72, 1.03);
    hair.position.set(0, 0.075, -0.02);
    teacherHead.add(hair);
    var fringe = box(0.30, 0.07, 0.06, hairColor);
    fringe.position.set(0, 0.15, 0.14);
    teacherHead.add(fringe);
    var sideburnL = box(0.035, 0.12, 0.05, hairColor);
    sideburnL.position.set(-0.165, 0.01, 0.09);
    teacherHead.add(sideburnL);
    var sideburnR = sideburnL.clone();
    sideburnR.position.x = 0.165;
    teacherHead.add(sideburnR);

    // 长发（语文老师）与发髻（英语老师），按关卡切换
    var hairLong = new THREE.Group();
    var backHair = box(0.34, 0.36, 0.10, hairColor);
    backHair.position.set(0, -0.12, -0.12);
    hairLong.add(backHair);
    var strandL = box(0.06, 0.28, 0.06, hairColor);
    strandL.position.set(-0.165, -0.14, 0.03);
    hairLong.add(strandL);
    var strandR = strandL.clone();
    strandR.position.x = 0.165;
    hairLong.add(strandR);
    hairLong.visible = false;
    teacherHead.add(hairLong);

    var hairBun = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), material(hairColor));
    hairBun.position.set(0, 0.16, -0.17);
    hairBun.visible = false;
    teacherHead.add(hairBun);

    // 眼睛
    var eyeWhiteL = new THREE.Mesh(new THREE.SphereGeometry(0.037, 10, 10), material(0xffffff));
    eyeWhiteL.position.set(-0.068, 0.012, 0.165);
    teacherHead.add(eyeWhiteL);
    var eyeWhiteR = eyeWhiteL.clone();
    eyeWhiteR.position.x = 0.068;
    teacherHead.add(eyeWhiteR);

    var pupilL = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), material(0x2b2420));
    pupilL.position.set(-0.068, 0.012, 0.196);
    teacherHead.add(pupilL);
    var pupilR = pupilL.clone();
    pupilR.position.x = 0.068;
    teacherHead.add(pupilR);

    // 眼镜：镜框、鼻梁与镜腿
    var glasses = new THREE.Group();
    var glassMat = new THREE.MeshBasicMaterial({ color: 0x6b5b4b, transparent: true, opacity: 0.9 });
    var ringL = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.007, 6, 16), glassMat);
    ringL.position.set(-0.068, 0.01, 0.19);
    glasses.add(ringL);
    var ringR = ringL.clone();
    ringR.position.x = 0.068;
    glasses.add(ringR);
    var bridge = box(0.05, 0.008, 0.008, 0x6b5b4b);
    bridge.position.set(0, 0.012, 0.195);
    glasses.add(bridge);
    var templeL = box(0.008, 0.008, 0.16, 0x6b5b4b);
    templeL.position.set(-0.118, 0.012, 0.1);
    glasses.add(templeL);
    var templeR = templeL.clone();
    templeR.position.x = 0.118;
    glasses.add(templeR);
    teacherHead.add(glasses);

    // 眉毛
    for (var i = 0; i < 2; i += 1) {
      var brow = box(0.08, 0.02, 0.02, hairColor);
      brow.position.set(i ? 0.068 : -0.068, 0.085, 0.17);
      brow.rotation.z = i ? -0.12 : 0.12;
      teacherHead.add(brow);
      brows.push(brow);
    }

    // 鼻子与嘴
    var nose = new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.07, 8), material(skin));
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, -0.025, 0.19);
    teacherHead.add(nose);

    var mouth = box(0.075, 0.018, 0.02, 0x9a5f4a);
    mouth.position.set(0, -0.085, 0.175);
    teacherHead.add(mouth);

    // 两段式手臂：肩 → 上臂（袖） → 肘 → 前臂（皮肤） → 手
    function buildArm(sideX) {
      var arm = new THREE.Group();
      arm.position.set(sideX, 1.44, 0);
      teacher.add(arm);

      var cap = new THREE.Mesh(new THREE.SphereGeometry(0.082, 10, 8), material(shirtDark));
      cap.scale.set(1, 0.92, 0.95);
      arm.add(cap);

      var sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.06, 0.25, 10), material(shirtDark));
      sleeve.position.y = -0.14;
      arm.add(sleeve);

      var cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.061, 0.061, 0.035, 10), material(shirtLight));
      cuff.position.y = -0.272;
      arm.add(cuff);

      var elbow = new THREE.Group();
      elbow.position.y = -0.29;
      arm.add(elbow);

      var fore = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.043, 0.26, 10), material(skin));
      fore.position.y = -0.13;
      elbow.add(fore);

      var wrist = new THREE.Mesh(new THREE.SphereGeometry(0.044, 8, 8), material(skin));
      wrist.position.y = -0.262;
      elbow.add(wrist);

      var hand = new THREE.Group();
      hand.position.y = -0.30;
      elbow.add(hand);

      var palm = box(0.088, 0.095, 0.058, skin);
      palm.position.y = -0.035;
      hand.add(palm);

      for (var f = 0; f < 4; f += 1) {
        var finger = box(0.024, 0.07, 0.03, skin);
        finger.position.set(-0.033 + f * 0.022, -0.112, 0.004);
        finger.rotation.x = -0.4;
        hand.add(finger);
      }
      var thumb = box(0.026, 0.058, 0.028, skin);
      thumb.position.set(-0.058, -0.06, 0.022);
      thumb.rotation.z = 0.6;
      hand.add(thumb);

      return { arm: arm, elbow: elbow, hand: hand };
    }

    // 右臂：写字手，粉笔夹在指间、笔尖朝向黑板
    var rightArm = buildArm(0.345);
    teacherArm = rightArm.arm;
    teacherElbow = rightArm.elbow;
    teacherHand = rightArm.hand;
    teacherArm.rotation.x = -1.28;
    teacherArm.rotation.z = 0.4;
    teacherElbow.rotation.x = -0.62;

    teacherChalk = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.011, 0.1, 6), material(0xffffff));
    teacherChalk.position.set(0.006, -0.13, 0.012);
    teacherHand.add(teacherChalk);

    // 左臂：自然下垂，略微外展、肘部微屈
    var leftArm = buildArm(-0.345);
    teacherArmL = leftArm.arm;
    teacherElbowL = leftArm.elbow;
    teacherArmL.rotation.x = 0.04;
    teacherArmL.rotation.z = -0.14;
    teacherElbowL.rotation.x = -0.2;

    // 脚下接触阴影
    var shadow = new THREE.Mesh(new THREE.CircleGeometry(0.45, 24),
      new THREE.MeshBasicMaterial({ color: 0x6b5335, transparent: true, opacity: 0.16 }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.012;
    teacher.add(shadow);

    scene.add(teacher);

    // 按颜色收集材质，供关卡切换老师形象时统一换色
    teacher.traverse(function (obj) {
      if (!obj.isMesh || !obj.material || !obj.material.color) return;
      var hex = obj.material.color.getHex();
      if (hex === shirtColor) teacherParts.shirt.push(obj.material);
      else if (hex === shirtDark) teacherParts.shirtDark.push(obj.material);
      else if (hex === shirtLight) teacherParts.shirtLight.push(obj.material);
      else if (hex === trouser) teacherParts.trouser.push(obj.material);
      else if (hex === hairColor) teacherParts.hair.push(obj.material);
      else if (hex === shoeColor) teacherParts.shoe.push(obj.material);
    });
    teacherLookParts.glasses = glasses;
    teacherLookParts.vest = vest;
    teacherLookParts.vestMaterial = vestMaterial;
    teacherLookParts.hairLong = hairLong;
    teacherLookParts.hairBun = hairBun;
  }

  function applyTeacherLook(levelId) {
    var look = LOOKS[levelId] || LOOKS.math;
    function paint(list, hex) {
      for (var i = 0; i < list.length; i += 1) {
        list[i].color.setHex(hex);
      }
    }
    paint(teacherParts.shirt, look.shirt);
    paint(teacherParts.shirtDark, look.shirtDark);
    paint(teacherParts.shirtLight, look.shirtLight);
    paint(teacherParts.trouser, look.trouser);
    paint(teacherParts.shoe, look.shoe);
    paint(teacherParts.hair, look.hair);
    if (teacherLookParts.glasses) {
      teacherLookParts.glasses.visible = !!look.glasses;
    }
    if (teacherLookParts.hairLong) {
      teacherLookParts.hairLong.visible = look.hairStyle === 'long';
    }
    if (teacherLookParts.hairBun) {
      teacherLookParts.hairBun.visible = look.hairStyle === 'bun';
    }
    if (teacherLookParts.vest) {
      teacherLookParts.vest.visible = !!look.vest;
      if (look.vest) teacherLookParts.vestMaterial.color.setHex(look.vest);
    }
  }

  function buildHand() {
    handGroup = new THREE.Group();
    handGroup.position.set(0.3, 0.88, 2.45);
    handGroup.scale.set(0.42, 0.42, 0.42);
    handGroup.rotation.z = -0.2;

    var sleeve = box(0.15, 0.36, 0.15, 0x6f8fb2);
    sleeve.position.y = 0.16;
    handGroup.add(sleeve);

    var forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.048, 0.32, 10), material(0xe8c9a8));
    forearm.position.y = 0.47;
    handGroup.add(forearm);

    var palm = box(0.15, 0.12, 0.12, 0xe8c9a8);
    palm.position.y = 0.67;
    handGroup.add(palm);

    // 四指 + 拇指
    var fingerGeo = new THREE.BoxGeometry(0.028, 0.1, 0.035);
    for (var i = 0; i < 4; i += 1) {
      var finger = new THREE.Mesh(fingerGeo, material(0xe8c9a8));
      finger.position.set(-0.052 + i * 0.035, 0.77, 0.035);
      finger.rotation.x = -0.2;
      handGroup.add(finger);
      fingers.push(finger);
    }
    var thumb = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.085, 0.035), material(0xe8c9a8));
    thumb.position.set(-0.085, 0.69, 0.055);
    thumb.rotation.z = 0.5;
    handGroup.add(thumb);

    // 饼干：完整与咬过两口两种形态
    chip = new THREE.Group();

    cookieWhole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.028, 18), material(0xe8b04b));
    cookieWhole.rotation.x = Math.PI / 2;
    chip.add(cookieWhole);
    for (var c = 0; c < 5; c += 1) {
      var dot = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 6), material(0x7a4a26));
      dot.position.set(Math.cos(c * 1.3) * 0.052, Math.sin(c * 1.3) * 0.052, 0.018);
      chip.add(dot);
    }

    var biteShape = new THREE.Shape();
    var biteR = 0.1;
    biteShape.absarc(0, 0, biteR, 0.6, Math.PI * 2 - 0.6, false);
    biteShape.quadraticCurveTo(biteR * 0.1, 0, Math.cos(0.6) * biteR, Math.sin(0.6) * biteR);
    var biteGeo = new THREE.ExtrudeGeometry(biteShape, {
      depth: 0.028, bevelEnabled: true, bevelSize: 0.004,
      bevelThickness: 0.004, bevelSegments: 2, curveSegments: 16
    });
    biteGeo.center();
    cookieBitten = new THREE.Mesh(biteGeo, material(0xe8b04b));
    cookieBitten.visible = false;
    chip.add(cookieBitten);

    chip.position.set(0, 0.8, 0.1);
    handGroup.add(chip);
    chip.visible = false;

    // 玩家视角的下巴与嘴（吃东西时出现）
    mouthGroup = new THREE.Group();
    mouthGroup.position.set(0, 1.22, 2.55);
    var chin = box(0.58, 0.3, 0.1, 0xe8c9a8);
    chin.position.set(0, -0.02, 0);
    mouthGroup.add(chin);
    var lowerLip = box(0.22, 0.045, 0.02, 0xb5695a);
    lowerLip.position.set(0, 0.035, 0.06);
    mouthGroup.add(lowerLip);
    var upperLip = box(0.2, 0.03, 0.02, 0xb5695a);
    upperLip.position.set(0, 0.075, 0.06);
    mouthGroup.add(upperLip);
    mouthOpening = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), material(0x3a1f1a));
    mouthOpening.scale.set(1.1, 0.25, 0.3);
    mouthOpening.position.set(0, 0.055, 0.075);
    mouthGroup.add(mouthOpening);
    teeth = box(0.14, 0.018, 0.012, 0xffffff);
    teeth.position.set(0, 0.058, 0.085);
    mouthGroup.add(teeth);
    mouthGroup.visible = false;
    // 第一人称嘴部会遮挡画面，这里只用手、饼干与碎屑表达
    // scene.add(mouthGroup);

    // 碎屑（挂在场景里，从嘴边掉落）
    for (var k = 0; k < 8; k += 1) {
      var crumb = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), material(0xd8780a));
      crumb.visible = false;
      scene.add(crumb);
      crumbs.push(crumb);
    }

    handGroup.visible = false;
    scene.add(handGroup);
    handTarget = new THREE.Vector3(0.3, 0.88, 2.45);

    // 转身提示
    var c2 = document.createElement('canvas');
    c2.width = 128;
    c2.height = 128;
    var g = c2.getContext('2d');
    g.fillStyle = '#b4553f';
    g.beginPath();
    g.arc(64, 64, 54, 0, Math.PI * 2, false);
    g.fill();
    g.fillStyle = '#fff7e6';
    g.font = '800 78px "Noto Sans CJK SC", sans-serif';
    g.textAlign = 'center';
    g.fillText('!', 64, 92);
    var texture = new THREE.CanvasTexture(c2);
    var sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
    sprite.scale.set(0.42, 0.42, 1);
    sprite.position.set(0, 2.42, -2.5);
    sprite.visible = false;
    scene.add(sprite);
    exclaim = sprite;
  }

  function initThree() {
    if (!THREE || !canvas) return false;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
    } catch (error) {
      renderer = null;
      return false;
    }
    if (!renderer || !renderer.getContext()) return false;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(800, 600, false);
    renderer.setClearColor(0xefe3cf, 1);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xefe3cf);
    camera = new THREE.PerspectiveCamera(52, 800 / 600, 0.1, 60);
    camera.position.set(0, 1.5, 3.15);
    camera.lookAt(0, 1.2, -2.1);

    scene.add(new THREE.AmbientLight(0xffffff, 0.72));
    var sun = new THREE.DirectionalLight(0xfff2dd, 0.62);
    sun.position.set(3, 5, 4);
    scene.add(sun);
    var fill = new THREE.DirectionalLight(0xffffff, 0.25);
    fill.position.set(-3, 2, 2);
    scene.add(fill);

    buildRoom();
    buildTeacher();
    buildHand();
    applyTeacherLook(LEVELS[0] ? LEVELS[0].id : 'math');
    webglReady = true;
    return true;
  }

  /* ---------- 每帧更新 ---------- */

  function mix(a, b) {
    return a + (b - a) * poseBlend;
  }

  function updateVisuals(dt) {
    if (!webglReady) return;
    clockTime += dt;
    var game = state.game;
    var active = !!(game && state.running);
    var writing = !game || game.phase === 'writing' || game.phase === 'pausing';
    var motion = game && game.phase === 'pausing' ? 0 : 1;
    poseBlend += ((writing ? 1 : 0) - poseBlend) * Math.min(1, dt * 5);
    var angry = !!(game && game.angry > 0);

    if (teacher) {
      var targetY = Math.PI;
      if (game) {
        if (game.phase === 'facing' || game.phase === 'over') targetY = 0;
        else if (game.phase === 'turning') {
          var p = 1 - game.phaseLeft / Engine.TURN_TIME;
          targetY = Math.PI * (1 - p);
        } else if (game.phase === 'faking') {
          var fp = 1 - game.phaseLeft / Engine.FAKE_TIME;
          var k;
          if (fp < 0.35) k = fp / 0.35;
          else if (fp < 0.6) k = 1;
          else k = Math.max(0, 1 - (fp - 0.6) / 0.4);
          var span = game.fakeSpan || 0.6;
          targetY = Math.PI * (1 - span * k);
        }
      }
      teacher.rotation.y += (targetY - teacher.rotation.y) * Math.min(1, dt * 14);

      // 写字手：肩部左右扫动 + 肘部起落 + 腕部轻摆
      if (teacherArm) {
        teacherArm.rotation.x = mix(-0.08, -1.28) + poseBlend * Math.sin(clockTime * 4.2) * 0.045 * motion;
        teacherArm.rotation.y = poseBlend * Math.sin(clockTime * 2.4) * 0.32 * motion;
        teacherArm.rotation.z = mix(0.14, 0.4);
      }
      if (teacherElbow) {
        teacherElbow.rotation.x = mix(-0.16, -0.62) + poseBlend * Math.sin(clockTime * 5.4) * 0.05 * motion;
        teacherElbow.rotation.y = poseBlend * Math.sin(clockTime * 2.0) * 0.05 * motion;
      }
      if (teacherHand) {
        teacherHand.rotation.x = poseBlend * Math.sin(clockTime * 3.1) * 0.12 * motion;
      }
      if (teacherChalk) {
        teacherChalk.visible = poseBlend > 0.35;
      }

      // 垂着的左手随呼吸轻摆
      if (teacherArmL) {
        teacherArmL.rotation.x = 0.04 + Math.sin(clockTime * 1.4) * 0.03;
        teacherArmL.rotation.y = Math.sin(clockTime * 0.9) * 0.02;
      }
      if (teacherElbowL) {
        teacherElbowL.rotation.x = -0.2 + Math.sin(clockTime * 1.1) * 0.04;
      }

      for (var i = 0; i < brows.length; i += 1) {
        brows[i].rotation.z = angry ? (i ? -0.5 : 0.5) : (i ? -0.15 : 0.15);
      }
      if (teacherHead) {
        teacherHead.rotation.x = angry ? 0.1 : poseBlend * (0.1 + Math.sin(clockTime * 1.8) * 0.015);
        teacherHead.rotation.y = Math.sin(clockTime * 1.05) * 0.05;
      }

      if (exclaim) {
        exclaim.visible = !!(game && (game.phase === 'turning' || game.phase === 'faking'));
        if (exclaim.visible) {
          exclaim.position.y = 2.35 + Math.sin(clockTime * 10) * 0.04;
        }
      }

      // 轻微呼吸
      teacher.position.y = Math.sin(clockTime * 1.6) * 0.008;
    }

    var chewing = !!(active && game.chewing > 0);
    var eating = !!(active && (game.progress > 0.02 || chewing));
    var lift = active ? (chewing ? 0.55 : Math.min(1, game.progress)) : 0;

    if (handGroup) {
      handGroup.visible = eating;
      if (eating) {
        if (chewing) {
          handTarget.set(0.1, 1.06, 2.45);
        } else {
          handTarget.set(
            0.3 - lift * 0.2,
            0.88 + lift * 0.2,
            2.45
          );
        }
        handGroup.position.lerp(handTarget, Math.min(1, dt * 12));
        handGroup.rotation.z = -0.2 + lift * 0.15;
      }
    }

    if (chip) {
      chip.visible = eating;
      if (chip.visible) {
        var bitten = chewing || game.progress > 0.72;
        if (cookieWhole) cookieWhole.visible = !bitten;
        if (cookieBitten) cookieBitten.visible = bitten;
        chip.rotation.x = -lift * 0.5 - (chewing ? 0.35 : 0);
        chip.rotation.z = Math.sin(clockTime * 3) * 0.08;
      }
    }

    for (var f = 0; f < fingers.length; f += 1) {
      fingers[f].rotation.x = -0.5 - lift * 0.7 +
        (chewing ? Math.sin(clockTime * 12 + f) * 0.16 : 0);
    }

    for (var cr = 0; cr < crumbs.length; cr += 1) {
      crumbs[cr].visible = chewing && game.chewing < 0.65;
      if (crumbs[cr].visible) {
        var fall = (clockTime * 1.1 + cr * 0.09) % 0.42;
        crumbs[cr].position.set(
          -0.02 + (cr % 3) * 0.03,
          1.2 - fall,
          2.6 + (cr % 2) * 0.03
        );
      }
    }
  }

  function render() {
    if (webglReady) renderer.render(scene, camera);
  }

  /* ---------- HUD 与状态 ---------- */

  function currentLevel() {
    return LEVELS[state.levelIndex] || LEVELS[0];
  }

  function updateHud() {
    var game = state.game;
    var level = game ? (game.level || currentLevel()) : currentLevel();
    if (!game) {
      hudSnacks.textContent = '零食 0 / ' + level.target;
      hudLives.textContent = '♥♥♥';
      hudPhase.textContent = '等待上课';
      return;
    }
    hudSnacks.textContent = '零食 ' + game.snacks + ' / ' + game.target;
    var lives = '';
    var maxLives = game.startLives || 3;
    for (var i = 0; i < maxLives; i += 1) {
      lives += i < game.lives ? '♥' : '♡';
    }
    hudLives.textContent = lives;
    if (game.phase === 'writing') {
      hudPhase.textContent = '老师写字中';
      hudPhase.className = 'hud-item hud-phase';
    } else if (game.phase === 'pausing') {
      hudPhase.textContent = '粉笔停了…';
      hudPhase.className = 'hud-item hud-phase is-danger';
    } else if (game.phase === 'turning' || game.phase === 'faking') {
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
      if (game.phase === 'facing') eatBtn.textContent = '别动！';
      else if (game.chewing > 0) eatBtn.textContent = '嚼嚼嚼…';
      else eatBtn.textContent = '按住吃';
    } else {
      eatBtn.disabled = true;
      eatBtn.textContent = '按住吃';
    }
  }

  function handleEvents(events) {
    for (var i = 0; i < events.length; i += 1) {
      var type = events[i].type;
      if (type === 'pause') {
        sfxPause();
        setStatus('粉笔停了……快松手！', 'danger');
      } else if (type === 'fake') {
        sfxTurn();
        setStatus('老师转身了，快停！', 'danger');
      } else if (type === 'turn') {
        sfxTurn();
        setStatus('老师要转身了，快停！', 'danger');
      } else if (type === 'facing') {
        setStatus('老师盯着你，别动。', 'danger');
      } else if (type === 'caught') {
        eatHeld = false;
        sfxCaught();
        buzz('medium');
        setStatus('被抓到了！嘴里还有东西。', 'danger');
      } else if (type === 'snack') {
        sfxSnack();
        setStatus('吃到一个，继续。', 'ok');
      } else if (type === 'resume') {
        setStatus('老师又写起来了，可以继续吃。', 'ok');
      } else if (type === 'write') {
        setStatus('老师转回去了，可以吃了。', 'ok');
      }
    }
  }

  /* ---------- 流程 ---------- */

  function renderLevels() {
    if (!levelList) return;
    while (levelList.firstChild) {
      levelList.removeChild(levelList.firstChild);
    }
    for (var i = 0; i < LEVELS.length; i += 1) {
      (function (index) {
        var level = LEVELS[index];
        var stars = state.stars[level.id] || 0;
        var unlocked = webglReady && (index === 0 || (state.stars[LEVELS[index - 1].id] || 0) > 0);

        var li = document.createElement('li');
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'level-card';
        btn.disabled = !unlocked;

        var top = document.createElement('span');
        top.className = 'level-top';
        var no = document.createElement('span');
        no.className = 'level-no';
        no.textContent = '第 ' + (index + 1) + ' 节';
        top.appendChild(no);
        var goal = document.createElement('span');
        goal.className = 'level-goal';
        goal.textContent = level.target + ' 个';
        top.appendChild(goal);
        btn.appendChild(top);

        var name = document.createElement('span');
        name.className = 'level-name';
        name.textContent = level.name;
        btn.appendChild(name);

        var star = document.createElement('span');
        star.className = 'level-stars';
        star.textContent = unlocked ? levelStarsText(stars) : '未解锁';
        btn.appendChild(star);

        btn.addEventListener('click', function () {
          if (!btn.disabled) startGame(index);
        });
        li.appendChild(btn);
        levelList.appendChild(li);
      }(i));
    }
  }

  function nextLevelIndex() {
    var next = state.levelIndex + 1;
    if (next >= LEVELS.length) return -1;
    var prev = LEVELS[state.levelIndex];
    return (state.stars[prev.id] || 0) > 0 ? next : -1;
  }

  function startGame(index) {
    if (!webglReady) {
      setStatus('当前设备不支持 WebGL，暂时无法运行 3D 教室。', 'danger');
      return;
    }
    var level = LEVELS[index];
    if (!level) return;
    state.levelIndex = index;
    state.pendingNext = index;
    ensureAudio();
    if (sound.bgm) startBgm();
    state.game = Engine.create(Math.random, level);
    state.running = true;
    eatHeld = false;
    state.chalkAcc = 0;
    state.crunchAcc = 0;
    applyTeacherLook(level.id);
    startOverlay.hidden = true;
    resultOverlay.hidden = true;
    eatBtn.disabled = false;
    setShareStatus('', false);
    paintBoard(level.board);
    setStatus('第 ' + (index + 1) + ' 节 · ' + level.name + '：' + (level.hint || '老师写字中，按住「吃」偷吃。'), 'ok');
    updateHud();
    updateEatUi();
    state.lastTime = 0;
  }

  function backToMenu() {
    state.running = false;
    state.game = null;
    eatHeld = false;
    resultOverlay.hidden = true;
    startOverlay.hidden = false;
    applyTeacherLook(currentLevel().id);
    paintBoard(currentLevel().board);
    renderLevels();
    renderBest();
    updateHud();
    updateEatUi();
    setStatus('选一节课开始，粉笔一停就松手。');
  }

  function finishGame() {
    var game = state.game;
    if (!game || !state.running) return;
    state.running = false;
    eatHeld = false;
    eatBtn.disabled = true;
    var won = game.phase === 'win';
    var level = game.level || currentLevel();
    var stars = Engine.starsFor(game);
    if (stars > (state.stars[level.id] || 0)) {
      state.stars[level.id] = stars;
    }
    if (game.snacks > state.best) state.best = game.snacks;
    state.plays += 1;
    saveBest();
    renderBest();
    renderLevels();

    if (won) {
      sfxWin();
      buzz('light');
    } else {
      sfxOver();
      buzz('medium');
    }

    resultKicker.textContent = '第 ' + (state.levelIndex + 1) + ' 节 · ' + level.name;
    resultStars.textContent = levelStarsText(stars);
    resultSnacks.textContent = String(game.snacks);
    resultTitle.textContent = won ? (stars === 3 ? '满分偷吃' : '课堂神偷') : '下次藏好点';
    resultBest.textContent = '本节最佳：' + (state.stars[level.id] || 0) + ' 星 · 总星数 ' +
      totalStars() + ' / ' + (LEVELS.length * 3);

    var next = won ? nextLevelIndex() : -1;
    if (next >= 0) {
      state.pendingNext = next;
      nextBtn.textContent = '下一节 · ' + LEVELS[next].name;
    } else {
      state.pendingNext = state.levelIndex;
      nextBtn.textContent = '再试一次';
    }

    state.cardUrl = generateCard(game, won, stars);
    updateShareButtons();
    resultOverlay.hidden = false;
    setStatus(won ?
      '吃满 ' + game.target + ' 个，第 ' + (state.levelIndex + 1) + ' 节下课！' :
      '这节课被抓了 ' + Math.max(0, level.lives - game.lives) + ' 次。', won ? 'ok' : 'danger');
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

  function generateCard(game, won, stars) {
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
    g.fillText('CLASSROOM SNACK 3D', 450, 96);
    g.fillStyle = '#3f352b';
    g.font = '800 50px "Noto Sans CJK SC", sans-serif';
    g.fillText('课堂偷吃大作战 3D', 450, 164);
    g.fillStyle = '#8a7a68';
    g.font = '24px "Noto Sans CJK SC", sans-serif';
    g.fillText('第 ' + (state.levelIndex + 1) + ' 节 · ' + (game.level ? game.level.name : '课堂'), 450, 208);

    g.fillStyle = '#e8890c';
    g.font = '800 130px "Noto Sans CJK SC", sans-serif';
    g.fillText(String(game.snacks), 450, 420);
    g.fillStyle = '#8a7a68';
    g.font = '26px "Noto Sans CJK SC", sans-serif';
    g.fillText('个零食', 450, 466);

    g.fillStyle = '#3f352b';
    g.font = '800 40px "Noto Sans CJK SC", sans-serif';
    g.fillText(won ? (stars === 3 ? '满分偷吃' : '课堂神偷') : '下次藏好点', 450, 550);

    var starText = '';
    for (var i = 0; i < 3; i += 1) starText += i < stars ? '★' : '☆';
    g.fillStyle = '#d89a3c';
    g.font = '46px "Noto Sans CJK SC", sans-serif';
    g.fillText(starText, 450, 620);

    g.fillStyle = '#8a7a68';
    g.font = '24px "Noto Sans CJK SC", sans-serif';
    g.fillText('老师转身前，咽下去', 450, 840);

    g.fillStyle = '#b08a5a';
    g.font = '22px "Noto Sans CJK SC", sans-serif';
    g.fillText('课堂偷吃大作战 · 3D 教室', 450, 1080);
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
    var level = game && game.level ? game.level.name : '课堂';
    var stars = game ? Engine.starsFor(game) : 0;
    state.shareBusy = true;
    postNoteBtn.disabled = true;
    setShareStatus('正在打开笔记发布页…', false);
    apiCall('postNote', {
      title: '课堂偷吃 3D：吃了 ' + (game ? game.snacks : 0) + ' 个零食',
      content: '我在「课堂偷吃大作战 3D」的' + level + '里' + (won ? '成功撑到下课' : '被老师抓包了') +
        '，吃了 ' + (game ? game.snacks : 0) + ' 个零食，拿到 ' + stars + ' 颗星。老师转身前，记得咽下去。',
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

      if (sound.sfx && state.game.phase === 'writing' && Math.random() < 0.4) {
        state.chalkAcc += dt;
        if (state.chalkAcc > 0.2) {
          state.chalkAcc = 0;
          tone(1200 + Math.random() * 500, 0, 0.015, 'square', 0.006);
        }
      }
      if (sound.sfx && eatHeld) {
        state.crunchAcc += dt;
        if (state.crunchAcc > 0.26) {
          state.crunchAcc = 0;
          tone(170, 0, 0.03, 'square', 0.018);
        }
      }
    }

    updateVisuals(dt);
    if (!document.hidden) render();
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
    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        startGame(state.pendingNext);
      });
    }
    if (menuBtn) menuBtn.addEventListener('click', backToMenu);

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
      if (event.code === 'Space' || event.key === ' ') releaseEat();
    });

    saveCardBtn.addEventListener('click', saveCard);
    shareCardBtn.addEventListener('click', shareCard);
    postNoteBtn.addEventListener('click', postNote);

    if (sfxBtn) {
      sfxBtn.addEventListener('click', function () {
        if (!audioSupported()) return;
        sound.sfx = !sound.sfx;
        renderSoundUi();
        saveBest();
        if (sound.sfx) {
          ensureAudio();
          tone(660, 0, 0.1, 'sine', 0.05);
        }
      });
    }

    if (bgmBtn) {
      bgmBtn.addEventListener('click', function () {
        if (!audioSupported()) return;
        sound.bgm = !sound.bgm;
        renderSoundUi();
        saveBest();
        if (sound.bgm) startBgm();
        else stopBgm();
      });
    }

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        releaseEat();
        stopBgm();
      } else if (sound.bgm) {
        startBgm();
      }
    });
  }

  function boot() {
    if (!initThree()) {
      webglReady = false;
      setStatus('当前设备不支持 WebGL，暂时无法运行 3D 教室。', 'danger');
      eatBtn.disabled = true;
      renderLevels();
      if (bestLabel) {
        bestLabel.textContent = '当前设备的 WebGL 不可用，请更新系统或在小红书最新版本中重试。';
      }
      return;
    }
    bind();
    renderSoundUi();
    renderLevels();
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
