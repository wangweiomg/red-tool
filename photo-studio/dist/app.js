/* 头像壁纸工坊 · 原型
 * 选图 → 模板合成 → 拖动/缩放 → 保存/分享/发布笔记。
 * 照片只在本机 Canvas 处理，不上传。Chrome 61 基线。
 */
(function () {
  'use strict';

  var Data = window.PhotoStudioData;
  var Engine = window.PhotoStudioEngine;
  if (!Data || !Engine) return;

  var canvas = document.getElementById('preview');
  var ctx = null;
  try {
    ctx = canvas.getContext && canvas.getContext('2d');
  } catch (error) {
    ctx = null;
  }

  var state = {
    mode: 'avatar',
    frame: 'wreath',
    theme: 'morning',
    img: null,
    imgUrl: '',
    scale: 1,
    ox: 0,
    oy: 0
  };

  var stage = document.getElementById('stage');
  var modeTabs = document.getElementById('mode-tabs');
  var chipsEl = document.getElementById('template-chips');
  var zoomEl = document.getElementById('zoom');
  var resetBtn = document.getElementById('reset');
  var pickInput = document.getElementById('photo-input');
  var saveBtn = document.getElementById('save');
  var shareBtn = document.getElementById('share');
  var postBtn = document.getElementById('post');
  var statusEl = document.getElementById('status');
  var hintEl = document.getElementById('hint');

  var busy = false;
  var drag = null;

  var sound = { sfx: true, bgm: false };
  var audio = {
    ctx: null,
    master: null,
    bgmTimer: null,
    bgmStep: 0,
    bgmRunning: false,
    bgmToken: 0
  };
  var SOUND_KEY = 'photostudio.v1.sound';

  var sfxBtn = document.getElementById('toggle-sfx');
  var bgmBtn = document.getElementById('toggle-bgm');

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
      /* 音频失败不影响出图 */
    }
  }

  function playSfx(kind) {
    if (!sound.sfx) return;
    if (kind === 'tap') {
      tone(520, 0, 0.05, 'sine', 0.032);
    } else if (kind === 'upload') {
      tone(660, 0, 0.08, 'triangle', 0.05);
      tone(880, 0.06, 0.1, 'triangle', 0.04);
    } else if (kind === 'save') {
      tone(midiFreq(72), 0, 0.16, 'triangle', 0.06);
      tone(midiFreq(76), 0.08, 0.22, 'triangle', 0.055);
    } else if (kind === 'reset') {
      tone(380, 0, 0.07, 'sine', 0.035);
    } else if (kind === 'toggle') {
      tone(660, 0, 0.08, 'sine', 0.04);
    }
  }

  // 贝多芬《致爱丽丝》主题的舒缓改编（公有领域作品）
  var BGM_BARS = [
    { bass: 45, tones: [45, 52, 57, 60], melody: 76 },
    { bass: 45, tones: [45, 52, 57, 60], melody: 75 },
    { bass: 45, tones: [45, 52, 57, 60], melody: 76 },
    { bass: 45, tones: [45, 52, 57, 60], melody: 75 },
    { bass: 40, tones: [40, 47, 52, 56], melody: 76 },
    { bass: 40, tones: [40, 47, 52, 56], melody: 71 },
    { bass: 45, tones: [45, 52, 57, 60], melody: 74 },
    { bass: 45, tones: [45, 52, 57, 60], melody: 72 }
  ];
  var BGM_PATTERN = [0, 1, 2, 3];
  var BGM_STEP_MS = 500;

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
      var barIndex = Math.floor(stepIndex / 4) % BGM_BARS.length;
      var inBar = stepIndex % 4;
      var bar = BGM_BARS[barIndex];
      tone(midiFreq(bar.tones[BGM_PATTERN[inBar]]), 0, 0.7, 'triangle', 0.016);
      if (inBar === 0) {
        tone(midiFreq(bar.bass), 0, 1.8, 'sine', 0.024);
        tone(midiFreq(bar.melody), 0.1, 1.6, 'sine', 0.026);
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

  /* ---------- 平台能力 ---------- */

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

  function canStorage() {
    var miniTool = getMiniTool();
    return !!(miniTool &&
      typeof miniTool.setStorage === 'function' &&
      typeof miniTool.getStorage === 'function');
  }

  function saveSound() {
    if (!canStorage()) return;
    apiCall('setStorage', {
      key: SOUND_KEY,
      data: JSON.stringify({ v: 1, sfx: sound.sfx, bgm: sound.bgm })
    }).catch(function () {});
  }

  function loadSound() {
    if (!canStorage()) return;
    apiCall('getStorage', { key: SOUND_KEY }).then(function (result) {
      var raw = result && result.data;
      if (typeof raw !== 'string' || !raw) return;
      try {
        var saved = JSON.parse(raw);
        if (saved && saved.v === 1) {
          sound.sfx = saved.sfx !== false;
          sound.bgm = !!saved.bgm;
          renderSoundUi();
        }
      } catch (error) {
        /* 忽略损坏数据 */
      }
    }).catch(function () {});
  }

  function setStatus(text, kind) {
    statusEl.textContent = text;
    statusEl.className = 'status' + (kind ? ' is-' + kind : '');
  }

  /* ---------- 尺寸与模板 ---------- */

  function boxSize() {
    return state.mode === 'avatar' ?
      { w: Data.avatarSize, h: Data.avatarSize } :
      { w: Data.wallpaperWidth, h: Data.wallpaperHeight };
  }

  function renderChips() {
    chipsEl.textContent = '';
    var list = state.mode === 'avatar' ? Data.avatarFrames : Data.wallpaperThemes;
    var current = state.mode === 'avatar' ? state.frame : state.theme;
    for (var i = 0; i < list.length; i += 1) {
      (function (item) {
        var chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'chip' + (current === item.id ? ' is-active' : '');
        chip.setAttribute('data-template', item.id);
        chip.textContent = item.name;
        chip.addEventListener('click', function () {
          playSfx('tap');
          if (state.mode === 'avatar') state.frame = item.id;
          else state.theme = item.id;
          renderChips();
          draw();
        });
        chipsEl.appendChild(chip);
      }(list[i]));
    }
  }

  function setMode(mode) {
    if (mode !== 'avatar' && mode !== 'wallpaper') return;
    state.mode = mode;
    state.scale = 1;
    state.ox = 0;
    state.oy = 0;
    zoomEl.value = '1';
    canvas.width = mode === 'avatar' ? Data.avatarSize : Data.wallpaperWidth;
    canvas.height = mode === 'avatar' ? Data.avatarSize : Data.wallpaperHeight;
    stage.className = 'stage ' + mode;
    for (var i = 0; i < modeTabs.children.length; i += 1) {
      var btn = modeTabs.children[i];
      var active = btn.getAttribute('data-mode') === mode;
      btn.className = active ? 'mode-tab is-active' : 'mode-tab';
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    }
    hintEl.textContent = mode === 'avatar' ?
      '拖动照片调整头像位置；用下方滑杆缩放。' :
      '拖动照片调整壁纸位置；用下方滑杆缩放。';
    renderChips();
    updateButtons();
    draw();
  }

  /* ---------- 绘制工具 ---------- */

  function circle(x, y, r, fill) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2, false);
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function softRing(x, y, r, color, width, blur) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    if (blur) {
      ctx.shadowColor = color;
      ctx.shadowBlur = blur;
    }
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2, false);
    ctx.stroke();
    ctx.restore();
  }

  function leafShape(cx, cy, angle, length, width, color) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.ellipse(0, 0, length, width, 0, 0, Math.PI * 2, false);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  function flowerShape(cx, cy, r, petal, core) {
    for (var i = 0; i < 5; i += 1) {
      var angle = -Math.PI / 2 + i * Math.PI * 2 / 5;
      circle(cx + Math.cos(angle) * r * 0.62, cy + Math.sin(angle) * r * 0.62, r * 0.52, petal);
    }
    circle(cx, cy, r * 0.34, core);
  }

  function sparkleShape(cx, cy, r, color) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.quadraticCurveTo(r * 0.18, -r * 0.18, r, 0);
    ctx.quadraticCurveTo(r * 0.18, r * 0.18, 0, r);
    ctx.quadraticCurveTo(-r * 0.18, r * 0.18, -r, 0);
    ctx.quadraticCurveTo(-r * 0.18, -r * 0.18, 0, -r);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function snowflakeShape(cx, cy, r, color) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, r * 0.16);
    ctx.lineCap = 'round';
    for (var i = 0; i < 6; i += 1) {
      ctx.rotate(Math.PI / 3);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -r);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.62);
      ctx.lineTo(r * 0.28, -r * 0.86);
      ctx.moveTo(0, -r * 0.62);
      ctx.lineTo(-r * 0.28, -r * 0.86);
      ctx.stroke();
    }
    ctx.restore();
  }

  function seeded(i) {
    var v = Math.sin(i * 12.9898) * 43758.5453;
    return v - Math.floor(v);
  }

  /* ---------- 头像框 ---------- */

  function drawAvatarPlaceholder() {
    var g = ctx.createLinearGradient(0, 0, 800, 800);
    g.addColorStop(0, '#f6e7cf');
    g.addColorStop(1, '#e5cfae');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 800, 800);
    circle(400, 400, 340, 'rgba(255, 255, 255, 0.55)');
    ctx.fillStyle = '#a08055';
    ctx.font = '600 34px "Noto Sans CJK SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('选择一张照片', 400, 400);
    ctx.font = '24px "Noto Sans CJK SC", sans-serif';
    ctx.fillStyle = '#b6a68f';
    ctx.fillText('会显示在这个圆框里', 400, 446);
    ctx.textAlign = 'left';
  }

  function drawAvatarPhoto(frame) {
    var rect = Engine.coverRect(state.img.width, state.img.height, 800, 800,
      state.scale, state.ox, state.oy);
    ctx.save();
    ctx.beginPath();
    ctx.arc(400, 400, 340, 0, Math.PI * 2, false);
    ctx.clip();
    ctx.drawImage(state.img, rect.x, rect.y, rect.width, rect.height);
    ctx.restore();

    // 圆内轻微高光
    var hl = ctx.createLinearGradient(140, 120, 520, 560);
    hl.addColorStop(0, 'rgba(255,255,255,0.16)');
    hl.addColorStop(0.5, 'rgba(255,255,255,0)');
    ctx.save();
    ctx.beginPath();
    ctx.arc(400, 400, 340, 0, Math.PI * 2, false);
    ctx.clip();
    ctx.fillStyle = hl;
    ctx.fillRect(60, 60, 680, 680);
    ctx.restore();
  }

  function drawAvatar() {
    ctx.clearRect(0, 0, 800, 800);
    var frame = Data.findFrame(state.frame);

    if (state.mode === 'avatar' && !state.img) {
      drawAvatarPlaceholder();
    } else {
      var bg = ctx.createLinearGradient(0, 0, 0, 800);
      bg.addColorStop(0, frame.flower);
      bg.addColorStop(1, frame.ring);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, 800, 800);
      drawAvatarPhoto(frame);
    }

    if (frame.id === 'neon') {
      var ng = ctx.createLinearGradient(120, 120, 680, 680);
      ng.addColorStop(0, '#8f7cf6');
      ng.addColorStop(0.5, '#4f8ef7');
      ng.addColorStop(1, '#6fe3c8');
      softRing(400, 400, 360, 'rgba(111, 227, 200, 0.35)', 26, 24);
      ctx.strokeStyle = ng;
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.arc(400, 400, 360, 0, Math.PI * 2, false);
      ctx.stroke();
    } else {
      softRing(400, 400, 362, 'rgba(90, 70, 45, 0.18)', 24, 10);
      softRing(400, 400, 360, frame.ring, 16, 0);
      softRing(400, 400, 344, frame.ringDark, 2, 0);
    }

    var count = frame.id === 'winter' ? 14 : 16;
    for (var i = 0; i < count; i += 1) {
      var angle = -Math.PI / 2 + i * Math.PI * 2 / count;
      var x = 400 + Math.cos(angle) * 374;
      var y = 400 + Math.sin(angle) * 374;
      if (frame.id === 'wreath') {
        leafShape(x, y, angle + Math.PI / 2, 20, 9, i % 2 ? frame.leaf : frame.leafDark);
        if (i % 4 === 0) flowerShape(x, y, 22, frame.flower, frame.flowerCore);
      } else if (frame.id === 'gold') {
        sparkleShape(x, y, i % 2 ? 16 : 10, frame.sparkle);
      } else if (frame.id === 'neon') {
        circle(x, y, i % 2 ? 7 : 4, frame.sparkle);
      } else {
        snowflakeShape(x, y, i % 2 ? 16 : 10, frame.sparkle);
      }
    }
  }

  /* ---------- 壁纸 ---------- */

  function drawWallpaperBase(theme) {
    if (state.img) {
      var rect = Engine.coverRect(state.img.width, state.img.height, 1080, 1920,
        state.scale, state.ox, state.oy);
      ctx.drawImage(state.img, rect.x, rect.y, rect.width, rect.height);
    } else {
      var g = ctx.createLinearGradient(0, 0, 0, 1920);
      g.addColorStop(0, theme.top);
      g.addColorStop(1, theme.bottom);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 1080, 1920);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = '600 40px "Noto Sans CJK SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('选择一张照片', 540, 900);
      ctx.font = '28px "Noto Sans CJK SC", sans-serif';
      ctx.fillStyle = 'rgba(120, 100, 75, 0.6)';
      ctx.fillText('作为壁纸背景', 540, 952);
      ctx.textAlign = 'left';
    }

    ctx.fillStyle = theme.overlay;
    ctx.fillRect(0, 0, 1080, 1920);

    var bottom = ctx.createLinearGradient(0, 1320, 0, 1920);
    bottom.addColorStop(0, 'rgba(255, 255, 255, 0)');
    bottom.addColorStop(1, theme.id === 'night' ?
      'rgba(10, 18, 38, 0.82)' : 'rgba(255, 250, 240, 0.88)');
    ctx.fillStyle = bottom;
    ctx.fillRect(0, 1320, 1080, 600);
  }

  function drawWallpaperDecor(theme) {
    var i;
    if (theme.id === 'morning') {
      var sun = ctx.createRadialGradient(840, 260, 20, 840, 260, 220);
      sun.addColorStop(0, 'rgba(255, 224, 160, 0.95)');
      sun.addColorStop(1, 'rgba(255, 224, 160, 0)');
      ctx.fillStyle = sun;
      ctx.beginPath();
      ctx.arc(840, 260, 220, 0, Math.PI * 2, false);
      ctx.fill();
      circle(840, 260, 110, 'rgba(255, 236, 190, 0.9)');
      for (i = 0; i < 6; i += 1) {
        leafShape(80 + i * 22, 300 + i * 46, -0.7 + i * 0.18, 34, 12, 'rgba(127, 174, 132, 0.55)');
        leafShape(990 - i * 18, 1180 + i * 40, 0.8 - i * 0.12, 30, 11, 'rgba(127, 174, 132, 0.45)');
      }
    } else if (theme.id === 'night') {
      for (i = 0; i < 70; i += 1) {
        var sx = seeded(i + 1) * 1080;
        var sy = seeded(i + 51) * 1300;
        var sr = 1.5 + seeded(i + 101) * 3;
        ctx.fillStyle = 'rgba(255, 255, 255, ' + (0.2 + seeded(i + 151) * 0.6).toFixed(2) + ')';
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2, false);
        ctx.fill();
      }
      var moonGlow = ctx.createRadialGradient(820, 300, 20, 820, 300, 180);
      moonGlow.addColorStop(0, 'rgba(255, 236, 180, 0.55)');
      moonGlow.addColorStop(1, 'rgba(255, 236, 180, 0)');
      ctx.fillStyle = moonGlow;
      ctx.beginPath();
      ctx.arc(820, 300, 180, 0, Math.PI * 2, false);
      ctx.fill();
      circle(820, 300, 86, '#fff3d2');
      ctx.fillStyle = 'rgba(214, 204, 176, 0.35)';
      circle(794, 272, 16, 'rgba(214, 204, 176, 0.35)');
      circle(846, 322, 11, 'rgba(214, 204, 176, 0.3)');
      circle(818, 336, 7, 'rgba(214, 204, 176, 0.28)');
    } else if (theme.id === 'sea') {
      ctx.strokeStyle = 'rgba(95, 163, 194, 0.35)';
      ctx.lineWidth = 6;
      for (i = 0; i < 5; i += 1) {
        ctx.beginPath();
        ctx.arc(540, 1720 - i * 46, 520 - i * 60, Math.PI * 1.08, Math.PI * 1.92, false);
        ctx.stroke();
      }
      circle(880, 250, 70, 'rgba(255, 255, 255, 0.45)');
    } else {
      for (i = 0; i < 5; i += 1) {
        var cx = 140 + i * 190;
        var cy = 240 + (i % 2) * 160;
        circle(cx, cy, 70 + (i % 3) * 18, 'rgba(232, 137, 12, 0.28)');
        ctx.strokeStyle = 'rgba(255, 250, 240, 0.55)';
        ctx.lineWidth = 4;
        for (var k = 0; k < 6; k += 1) {
          var a = k * Math.PI / 3;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + Math.cos(a) * 54, cy + Math.sin(a) * 54);
          ctx.stroke();
        }
      }
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = theme.text;
    ctx.font = '800 56px "Noto Sans CJK SC", sans-serif';
    ctx.fillText(theme.tagline, 540, 1690);
    ctx.fillStyle = theme.id === 'night' ? 'rgba(234, 240, 255, 0.6)' : 'rgba(122, 90, 51, 0.6)';
    ctx.font = '26px "Noto Sans CJK SC", sans-serif';
    ctx.fillText('头像壁纸工坊', 540, 1760);
    ctx.textAlign = 'left';
  }

  function drawWallpaper() {
    ctx.clearRect(0, 0, 1080, 1920);
    var theme = Data.findTheme(state.theme);
    drawWallpaperBase(theme);
    drawWallpaperDecor(theme);
  }

  function draw() {
    if (!ctx) return;
    if (state.mode === 'avatar') drawAvatar();
    else drawWallpaper();
  }

  function updateButtons() {
    var hasPhoto = !!state.img;
    saveBtn.disabled = !hasPhoto || busy;
    shareBtn.disabled = !hasPhoto || busy;
    postBtn.disabled = !hasPhoto || busy;
  }

  /* ---------- 照片与交互 ---------- */

  function resetTransform() {
    state.scale = 1;
    state.ox = 0;
    state.oy = 0;
    zoomEl.value = '1';
  }

  function loadFile(file) {
    if (!file) return;
    if (!/^image\//.test(file.type || '')) {
      setStatus('请选择图片文件。', 'error');
      return;
    }
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      if (state.imgUrl) URL.revokeObjectURL(state.imgUrl);
      state.imgUrl = url;
      state.img = img;
      resetTransform();
      updateButtons();
      draw();
      playSfx('upload');
      setStatus('照片已载入，拖动调整位置。', 'ok');
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      setStatus('这张图片无法读取，换一张试试。', 'error');
    };
    img.src = url;
  }

  function dragStart(event) {
    if (!state.img) return;
    drag = {
      x: event.clientX,
      y: event.clientY,
      ox: state.ox,
      oy: state.oy,
      id: event.pointerId
    };
    if (canvas.setPointerCapture) {
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch (error) {
        /* 忽略 */
      }
    }
    if (event.cancelable) event.preventDefault();
  }

  function dragMove(event) {
    if (!drag) return;
    var rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    var box = boxSize();
    var nextX = drag.ox + (event.clientX - drag.x) / rect.width;
    var nextY = drag.oy + (event.clientY - drag.y) / rect.height;
    var clamped = Engine.clampOffset(
      state.img.width, state.img.height, box.w, box.h, state.scale, nextX, nextY
    );
    state.ox = clamped.offsetX;
    state.oy = clamped.offsetY;
    if (event.cancelable) event.preventDefault();
    draw();
  }

  function dragEnd() {
    drag = null;
  }

  function getDataUrl() {
    try {
      return canvas.toDataURL('image/jpeg', 0.92);
    } catch (error) {
      return '';
    }
  }

  function saveImage() {
    if (busy || !state.img) return;
    var dataUrl = getDataUrl();
    if (!dataUrl) {
      setStatus('当前环境无法生成图片。', 'error');
      return;
    }
    var miniTool = getMiniTool();
    if (!miniTool || typeof miniTool.saveImageToPhotosAlbum !== 'function') {
      setStatus('当前版本不支持保存到相册，可截图预览。', 'error');
      return;
    }
    busy = true;
    updateButtons();
    setStatus('正在保存…');
    apiCall('saveImageToPhotosAlbum', { filePath: dataUrl }).then(function () {
      busy = false;
      updateButtons();
      playSfx('save');
      setStatus('已保存到相册。', 'ok');
    }).catch(function (error) {
      busy = false;
      updateButtons();
      setStatus('保存失败' + (error && error.errCode ? '（' + error.errCode + '）' : '') + '，可截图预览。', 'error');
    });
  }

  function shareImage() {
    if (busy || !state.img) return;
    var dataUrl = getDataUrl();
    var miniTool = getMiniTool();
    if (!miniTool || typeof miniTool.share !== 'function') {
      setStatus('当前版本不支持直接分享，请先保存图片。', 'error');
      return;
    }
    busy = true;
    updateButtons();
    setStatus('正在打开分享…');
    apiCall('share', { type: 'image', image_resource: dataUrl }).then(function () {
      busy = false;
      updateButtons();
      playSfx('save');
      setStatus('已打开分享面板（成功仅表示流程已启动）。', 'ok');
    }).catch(function (error) {
      busy = false;
      updateButtons();
      var code = error && error.errCode;
      if (code === 15503) {
        setStatus('今天的分享次数已用完，可保存图片后手动分享。', 'error');
      } else if (code === 15502) {
        setStatus('分享面板未打开，请在小工具全屏中重试，或保存图片。', 'error');
      } else {
        setStatus('分享失败，可保存图片后手动分享。', 'error');
      }
    });
  }

  function postNote() {
    if (busy || !state.img) return;
    var dataUrl = getDataUrl();
    var miniTool = getMiniTool();
    if (!miniTool || typeof miniTool.postNote !== 'function') {
      setStatus('当前版本不支持发布笔记，请先保存图片。', 'error');
      return;
    }
    var label = state.mode === 'avatar' ?
      '头像框｜' + Data.findFrame(state.frame).name :
      '壁纸｜' + Data.findTheme(state.theme).name;
    busy = true;
    updateButtons();
    setStatus('正在打开笔记发布页…');
    apiCall('postNote', {
      title: '我的新' + (state.mode === 'avatar' ? '头像' : '壁纸') + '：' + label.split('｜')[1],
      content: '我在「头像壁纸工坊」用一张照片做了' + label + '，照片只在本机处理。',
      pageType: 'photo_publish',
      mediaInfo: { image_resources: [{ url: dataUrl }] }
    }).then(function () {
      busy = false;
      updateButtons();
      setStatus('已打开笔记发布页，发布结果以平台为准。', 'ok');
    }).catch(function (error) {
      busy = false;
      updateButtons();
      setStatus('打开笔记发布页失败' + (error && error.errCode ? '（' + error.errCode + '）' : '') + '，可先保存图片。', 'error');
    });
  }

  /* ---------- 事件 ---------- */

  function bind() {
    modeTabs.addEventListener('click', function (event) {
      var target = event.target;
      while (target && target !== modeTabs && !(target.getAttribute && target.getAttribute('data-mode'))) {
        target = target.parentNode;
      }
      if (!target || target === modeTabs) return;
      playSfx('tap');
      setMode(target.getAttribute('data-mode'));
    });

    pickInput.addEventListener('change', function () {
      if (pickInput.files && pickInput.files[0]) {
        loadFile(pickInput.files[0]);
        pickInput.value = '';
      }
    });

    zoomEl.addEventListener('input', function () {
      state.scale = parseFloat(zoomEl.value) || 1;
      if (state.img) {
        var box = boxSize();
        var clamped = Engine.clampOffset(
          state.img.width, state.img.height, box.w, box.h, state.scale, state.ox, state.oy
        );
        state.ox = clamped.offsetX;
        state.oy = clamped.offsetY;
      }
      draw();
    });

    resetBtn.addEventListener('click', function () {
      playSfx('reset');
      resetTransform();
      draw();
    });

    if (sfxBtn) {
      sfxBtn.addEventListener('click', function () {
        sound.sfx = !sound.sfx;
        renderSoundUi();
        if (sound.sfx) playSfx('toggle');
        saveSound();
      });
    }
    if (bgmBtn) {
      bgmBtn.addEventListener('click', function () {
        sound.bgm = !sound.bgm;
        renderSoundUi();
        if (sound.bgm) startBgm();
        else stopBgm();
        saveSound();
      });
    }
    document.addEventListener('pointerdown', warmAudio, true);
    document.addEventListener('keydown', warmAudio, true);

    saveBtn.addEventListener('click', saveImage);
    shareBtn.addEventListener('click', shareImage);
    postBtn.addEventListener('click', postNote);

    canvas.addEventListener('pointerdown', dragStart);
    canvas.addEventListener('pointermove', dragMove);
    canvas.addEventListener('pointerup', dragEnd);
    canvas.addEventListener('pointercancel', dragEnd);

    window.addEventListener('pagehide', function () {
      stopBgm();
      if (state.imgUrl) {
        URL.revokeObjectURL(state.imgUrl);
        state.imgUrl = '';
      }
    });
  }

  function boot() {
    if (!ctx) {
      setStatus('当前环境无法创建画布，请换设备再试。', 'error');
      return;
    }
    bind();
    renderSoundUi();
    updateSoundButtons();
    loadSound();
    setMode('avatar');
    updateButtons();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}());
