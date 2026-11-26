(function () {
  'use strict';

  var Data = window.IDIOM_DATA;
  var Engine = window.IdiomEngine;
  var STORAGE_KEY = 'idiom.v1.state';
  var QUESTION_COUNT = 5;

  var dateLabel = document.getElementById('date-label');
  var streakEl = document.getElementById('streak');
  var gameScreen = document.getElementById('game-screen');
  var resultScreen = document.getElementById('result-screen');
  var progressText = document.getElementById('progress-text');
  var progressDots = document.getElementById('progress-dots');
  var playArea = document.getElementById('play-area');
  var explain = document.getElementById('explain');
  var clueEl = document.getElementById('clue');
  var slotsEl = document.getElementById('slots');
  var tilesEl = document.getElementById('tiles');
  var submitBtn = document.getElementById('submit');
  var clearBtn = document.getElementById('clear');
  var feedback = document.getElementById('feedback');
  var explainKicker = document.getElementById('explain-kicker');
  var explainWord = document.getElementById('explain-word');
  var explainClue = document.getElementById('explain-clue');
  var explainNote = document.getElementById('explain-note');
  var explainPoints = document.getElementById('explain-points');
  var nextBtn = document.getElementById('next');
  var resultScoreEl = document.getElementById('result-score');
  var resultRows = document.getElementById('result-rows');
  var resultStreak = document.getElementById('result-streak');
  var sharePreview = document.getElementById('share-preview');
  var saveCardBtn = document.getElementById('save-card');
  var shareCardBtn = document.getElementById('share-card');
  var postNoteBtn = document.getElementById('post-note');
  var shareStatus = document.getElementById('share-status');
  var saveStatus = document.getElementById('save-status');
  var sfxBtn = document.getElementById('toggle-sfx');
  var bgmBtn = document.getElementById('toggle-bgm');

  var todayKey = Engine ? Engine.dateKeyOf(new Date()) : '';
  var state = null;
  var questions = [];
  var selection = [];
  var settled = false;
  var loading = false;
  var shareDataUrl = '';
  var shareBusy = false;

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
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume || 0.05), t0 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + (duration || 0.12));
      osc.connect(gain);
      gain.connect(audio.master);
      osc.start(t0);
      osc.stop(t0 + (duration || 0.12) + 0.03);
    } catch (error) {
      /* 音频失败不影响解谜 */
    }
  }

  function playSfx(kind) {
    if (!sound.sfx) return;
    if (kind === 'select') {
      tone(620, 0, 0.05, 'sine', 0.032);
    } else if (kind === 'deselect') {
      tone(420, 0, 0.05, 'sine', 0.028);
    } else if (kind === 'correct') {
      tone(midiFreq(72), 0, 0.18, 'triangle', 0.07);
      tone(midiFreq(76), 0.07, 0.24, 'triangle', 0.06);
    } else if (kind === 'wrong') {
      tone(220, 0, 0.1, 'sine', 0.045);
      tone(196, 0.08, 0.12, 'sine', 0.035);
    } else if (kind === 'reveal') {
      tone(midiFreq(67), 0, 0.16, 'sine', 0.045);
      tone(midiFreq(63), 0.12, 0.2, 'sine', 0.04);
    } else if (kind === 'next') {
      tone(520, 0, 0.06, 'sine', 0.03);
    } else if (kind === 'complete') {
      var notes = [62, 66, 69, 74];
      for (var i = 0; i < notes.length; i += 1) {
        tone(midiFreq(notes[i]), i * 0.13, 0.4, 'triangle', 0.07);
      }
    } else if (kind === 'toggle') {
      tone(660, 0, 0.08, 'sine', 0.04);
    }
  }

  // 贝多芬《月光奏鸣曲》第一乐章的三连音改编（公有领域作品）
  var BGM_BARS = [
    { bass: 37, tones: [44, 49, 52], melody: 68 },
    { bass: 37, tones: [44, 49, 52], melody: 68 },
    { bass: 33, tones: [45, 49, 52], melody: 69 },
    { bass: 33, tones: [45, 49, 52], melody: 69 },
    { bass: 40, tones: [44, 47, 52], melody: 71 },
    { bass: 40, tones: [44, 47, 52], melody: 71 },
    { bass: 35, tones: [42, 47, 51], melody: 66 },
    { bass: 35, tones: [42, 47, 51], melody: 66 }
  ];
  var BGM_PATTERN = [0, 1, 2, 0, 1, 2];
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
      tone(midiFreq(bar.tones[BGM_PATTERN[inBar]]), 0, 0.55, 'triangle', 0.016);
      if (inBar === 0) {
        tone(midiFreq(bar.bass), 0, 2.4, 'sine', 0.024);
        tone(midiFreq(bar.melody), 0.1, 2.2, 'sine', 0.025);
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

  function applySound(saved) {
    if (!saved || typeof saved !== 'object') return;
    sound.sfx = saved.sfx !== false;
    sound.bgm = !!saved.bgm;
    renderSoundUi();
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
      var settledFlag = false;
      function ok(result) {
        if (!settledFlag) {
          settledFlag = true;
          resolve(result);
        }
      }
      function bad(error) {
        if (!settledFlag) {
          settledFlag = true;
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

  function setShareStatus(message, isError) {
    shareStatus.textContent = message;
    shareStatus.className = isError ? 'share-status is-error' : 'share-status';
  }

  function formatDateCN(key) {
    var date = Engine.parseDateKey(key);
    var weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return (date.getMonth() + 1) + '月' + date.getDate() + '日 · ' + weekdays[date.getDay()];
  }

  function formatDateDot(key) {
    return key.replace(/-/g, '.');
  }

  function totalScore() {
    var total = 0;
    for (var i = 0; i < state.results.length; i += 1) {
      total += state.results[i].points;
    }
    return Math.round(total * 10) / 10;
  }

  function pruneHistory(history) {
    var keys = [];
    for (var key in history) {
      if (Object.prototype.hasOwnProperty.call(history, key)) {
        keys.push(key);
      }
    }
    keys.sort();
    while (keys.length > 60) {
      delete history[keys.shift()];
    }
  }

  function defaultState(history) {
    return {
      v: 1,
      date: todayKey,
      results: [],
      attempts: 0,
      history: history || {},
      completed: false
    };
  }

  function renderHeader() {
    dateLabel.textContent = formatDateCN(state.date);
    var streak = Engine.computeStreak(state.history, state.date);
    if (streak === 0 && !state.completed) {
      var previousDay = Engine.dateKeyOf(Engine.addDays(Engine.parseDateKey(state.date), -1));
      streak = Engine.computeStreak(state.history, previousDay);
    }
    streakEl.textContent = streak > 0 ? '连续 ' + streak + ' 天' : '从今天开始';
  }

  function renderProgress() {
    var index = state.results.length;
    progressText.textContent = state.completed ? '今日已完成' :
      '第 ' + Math.min(index + 1, QUESTION_COUNT) + ' / ' + QUESTION_COUNT + ' 题';
    var dots = progressDots.getElementsByTagName('span');
    for (var i = 0; i < dots.length; i += 1) {
      var cls = 'dot';
      if (i < index) {
        cls += ' is-done';
      } else if (i === index && !state.completed) {
        cls += ' is-current';
      }
      dots[i].className = cls;
    }
  }

  function updateSubmit() {
    submitBtn.disabled = selection.length < 4 || settled || loading;
  }

  function renderSlots() {
    var slots = slotsEl.getElementsByTagName('button');
    var current = questions[state.results.length];
    for (var i = 0; i < slots.length; i += 1) {
      var tileIndex = selection[i];
      var character = (tileIndex !== undefined && current) ? current.tiles[tileIndex] : '';
      slots[i].textContent = character;
      slots[i].className = character ? 'slot is-filled' : 'slot';
      slots[i].setAttribute('aria-label', '第 ' + (i + 1) + ' 个字' + (character ? '：' + character : '，空'));
    }
  }

  function renderTiles() {
    tilesEl.textContent = '';
    var current = questions[state.results.length];
    if (!current) {
      return;
    }
    var fragment = document.createDocumentFragment();
    for (var i = 0; i < current.tiles.length; i += 1) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'tile' + (selection.indexOf(i) !== -1 ? ' is-used' : '');
      button.setAttribute('data-tile', String(i));
      button.setAttribute('aria-label', '字块 ' + current.tiles[i] + (selection.indexOf(i) !== -1 ? '，已使用' : ''));
      button.textContent = current.tiles[i];
      fragment.appendChild(button);
    }
    tilesEl.appendChild(fragment);
  }

  function clearFeedback() {
    feedback.textContent = '';
    feedback.className = 'feedback';
  }

  function renderQuestion() {
    if (state.results.length >= QUESTION_COUNT) {
      showResult();
      return;
    }
    gameScreen.hidden = false;
    resultScreen.hidden = true;
    playArea.hidden = false;
    explain.hidden = true;
    selection = [];
    settled = false;

    var current = questions[state.results.length];
    clueEl.textContent = current.clue;
    renderHeader();
    renderProgress();
    renderSlots();
    renderTiles();
    updateSubmit();

    if (state.attempts === 1) {
      feedback.textContent = '还有一次机会，再试一次。';
      feedback.className = 'feedback is-error';
    } else {
      clearFeedback();
    }
  }

  function shakeSlots() {
    var slots = slotsEl.getElementsByTagName('button');
    for (var i = 0; i < slots.length; i += 1) {
      slots[i].className = 'slot is-wrong';
    }
    window.setTimeout(function () {
      renderSlots();
    }, 340);
  }

  function onTileClick(index) {
    if (settled || loading) {
      return;
    }
    var position = selection.indexOf(index);
    if (position !== -1) {
      selection.splice(position, 1);
      playSfx('deselect');
    } else if (selection.length < 4) {
      selection.push(index);
      playSfx('select');
    }
    clearFeedback();
    renderSlots();
    renderTiles();
    updateSubmit();
  }

  function onSlotClick(slotIndex) {
    if (settled || loading) {
      return;
    }
    if (selection[slotIndex] === undefined) {
      return;
    }
    selection.splice(slotIndex, 1);
    playSfx('deselect');
    renderSlots();
    renderTiles();
    updateSubmit();
  }

  function recordResult(points, correct) {
    var current = questions[state.results.length];
    var attempts = state.attempts;
    state.results.push({
      word: current.word,
      points: points,
      clue: current.clue,
      note: current.note,
      attempts: attempts
    });
    state.attempts = 0;
    settled = true;
    playSfx(correct ? 'correct' : 'reveal');
    renderProgress();
    showExplain(correct, points, attempts);
    saveNow();
  }

  function showExplain(correct, points, attempts) {
    var current = questions[state.results.length - 1];
    playArea.hidden = true;
    explain.hidden = false;

    explainKicker.textContent = correct ? '答对了' : '正确答案';
    explainWord.textContent = current.word;
    explainClue.textContent = '释义：' + current.clue;
    explainNote.textContent = current.note;
    if (points === 1) {
      explainPoints.textContent = '首次答对，+1 分';
    } else if (points === 0.5) {
      explainPoints.textContent = '第二次答对，+0.5 分';
    } else {
      explainPoints.textContent = '本题未得分，记住这个成语吧';
    }
    nextBtn.textContent = state.results.length >= QUESTION_COUNT ? '查看结果' : '下一题';
  }

  function submitAnswer() {
    if (loading || settled || selection.length < 4) {
      return;
    }
    var current = questions[state.results.length];
    var answer = '';
    for (var i = 0; i < selection.length; i += 1) {
      answer += current.tiles[selection[i]];
    }

    if (answer === current.word) {
      recordResult(Engine.scoreForAttempts(state.attempts), true);
      return;
    }

    state.attempts += 1;
    if (state.attempts >= 2) {
      recordResult(0, false);
      return;
    }

    playSfx('wrong');
    feedback.textContent = '还差一点，再试一次。';
    feedback.className = 'feedback is-error';
    selection = [];
    renderSlots();
    renderTiles();
    updateSubmit();
    shakeSlots();
    saveNow();
  }

  function nextQuestion() {
    if (state.results.length >= QUESTION_COUNT) {
      completeChallenge();
      return;
    }
    playSfx('next');
    explanationReset();
    renderQuestion();
    saveNow();
  }

  function explanationReset() {
    explain.hidden = true;
    playArea.hidden = false;
    settled = false;
    selection = [];
    clearFeedback();
  }

  function completeChallenge() {
    if (state.completed) {
      showResult();
      return;
    }
    state.completed = true;
    playSfx('complete');
    var score = totalScore();
    state.history[state.date] = score;
    pruneHistory(state.history);
    saveNow();
    showResult();
  }

  function showResult() {
    if (!state.completed && state.results.length >= QUESTION_COUNT) {
      state.completed = true;
      state.history[state.date] = totalScore();
      pruneHistory(state.history);
      saveNow();
    }
    gameScreen.hidden = true;
    resultScreen.hidden = false;
    renderHeader();
    renderProgress();

    var score = totalScore();
    resultScoreEl.textContent = Engine.formatScore(score);

    resultRows.textContent = '';
    var fragment = document.createDocumentFragment();
    for (var i = 0; i < state.results.length; i += 1) {
      var result = state.results[i];
      var row = document.createElement('div');
      row.className = 'result-row';
      var word = document.createElement('span');
      word.className = 'result-word';
      word.textContent = result.word;

      var points = document.createElement('span');
      points.className = 'result-points';
      if (result.points === 1) {
        points.className += ' is-full';
        points.textContent = '+1 分';
      } else if (result.points === 0.5) {
        points.className += ' is-half';
        points.textContent = '+0.5 分';
      } else {
        points.className += ' is-zero';
        points.textContent = '0 分';
      }

      row.appendChild(word);
      row.appendChild(points);
      fragment.appendChild(row);
    }
    resultRows.appendChild(fragment);

    var streak = Engine.computeStreak(state.history, state.date);
    resultStreak.textContent = streak > 0 ? '连续 ' + streak + ' 天完成挑战' : '今天开始记录';

    var canSave = !!getMiniTool() && typeof getMiniTool().saveImageToPhotosAlbum === 'function';
    var canShare = !!getMiniTool() && typeof getMiniTool().share === 'function';
    var canPost = !!getMiniTool() && typeof getMiniTool().postNote === 'function';
    saveCardBtn.hidden = !canSave;
    shareCardBtn.hidden = !canShare;
    postNoteBtn.hidden = !canPost;
    if (!canSave && !canShare && !canPost) {
      setShareStatus('当前版本不支持直接保存、分享或发布笔记，可截图结果页保存。', false);
    } else {
      setShareStatus('', false);
    }

    shareDataUrl = generateShareCard();
    if (shareDataUrl) {
      sharePreview.src = shareDataUrl;
      sharePreview.hidden = false;
    } else {
      sharePreview.hidden = true;
      setShareStatus('当前环境无法生成分享卡，可截图结果页保存。', true);
    }
  }

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

  function drawPointsBadge(ctx, x, y, points) {
    var color = points === 1 ? '#3f7a52' : (points === 0.5 ? '#b08a3e' : '#a53a2f');
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2, false);
    ctx.fill();
    ctx.fillStyle = '#fffaf0';
    ctx.font = '700 20px "Noto Sans CJK SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(points === 1 ? '✓' : (points === 0.5 ? '½' : '×'), x, y + 7);
    ctx.textAlign = 'left';
  }

  function generateShareCard() {
    var canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 1200;
    var ctx;
    try {
      ctx = canvas.getContext && canvas.getContext('2d');
    } catch (error) {
      ctx = null;
    }
    if (!ctx) {
      return '';
    }

    var background = ctx.createLinearGradient(0, 0, 900, 1200);
    background.addColorStop(0, '#fffaf0');
    background.addColorStop(1, '#f0e2c8');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, 900, 1200);

    ctx.fillStyle = 'rgba(216, 189, 150, 0.28)';
    ctx.beginPath();
    ctx.arc(820, 110, 260, 0, Math.PI * 2, false);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(60, 1130, 240, 0, Math.PI * 2, false);
    ctx.fill();

    ctx.fillStyle = '#a53a2f';
    roundedRect(ctx, 70, 70, 74, 74, 10);
    ctx.fill();
    ctx.fillStyle = '#f8ead2';
    ctx.font = '700 44px "Noto Serif CJK SC", "Songti SC", serif';
    ctx.textAlign = 'center';
    ctx.fillText('成', 107, 124);
    ctx.textAlign = 'left';

    ctx.fillStyle = '#2f2a24';
    ctx.font = '700 54px "Noto Serif CJK SC", "Songti SC", serif';
    ctx.fillText('成语挑战', 168, 128);

    ctx.fillStyle = '#8a7a63';
    ctx.font = '24px "Noto Sans CJK SC", sans-serif';
    ctx.fillText('每日一关 · 拼出成语', 170, 168);

    ctx.textAlign = 'right';
    ctx.font = '22px "Noto Sans CJK SC", sans-serif';
    ctx.fillText(formatDateDot(state.date), 830, 104);
    ctx.textAlign = 'left';

    var scoreText = Engine.formatScore(totalScore());
    ctx.fillStyle = '#a53a2f';
    ctx.font = '700 150px "Noto Serif CJK SC", "Songti SC", serif';
    ctx.fillText(scoreText, 68, 352);
    var scoreWidth = ctx.measureText(scoreText).width;
    ctx.fillStyle = '#8a7a63';
    ctx.font = '40px "Noto Sans CJK SC", sans-serif';
    ctx.fillText('/ 5', 68 + scoreWidth + 16, 350);

    ctx.fillStyle = '#8a7a63';
    ctx.font = '24px "Noto Sans CJK SC", sans-serif';
    ctx.fillText('今日得分', 72, 396);

    for (var i = 0; i < state.results.length; i += 1) {
      var result = state.results[i];
      var rowY = 450 + i * 110;
      ctx.fillStyle = '#fbf5e8';
      roundedRect(ctx, 70, rowY, 760, 86, 16);
      ctx.fill();
      ctx.strokeStyle = '#e6dac3';
      ctx.lineWidth = 2;
      ctx.stroke();

      drawPointsBadge(ctx, 112, rowY + 43, result.points);

      ctx.fillStyle = '#2f2a24';
      ctx.font = '700 36px "Noto Serif CJK SC", "Songti SC", serif';
      ctx.fillText(result.word, 152, rowY + 56);

      ctx.fillStyle = result.points === 1 ? '#3f7a52' : (result.points === 0.5 ? '#b08a3e' : '#a53a2f');
      ctx.font = '700 26px "Noto Sans CJK SC", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(result.points === 0.5 ? '+0.5 分' : ('+' + result.points + ' 分'), 796, rowY + 53);
      ctx.textAlign = 'left';
    }

    var streak = Engine.computeStreak(state.history, state.date);
    ctx.fillStyle = '#f1e4cd';
    roundedRect(ctx, 70, 1026, 300, 60, 30);
    ctx.fill();
    ctx.fillStyle = '#8a5a2b';
    ctx.font = '24px "Noto Sans CJK SC", sans-serif';
    ctx.fillText(streak > 0 ? '连续 ' + streak + ' 天完成' : '从今天开始', 100, 1064);

    ctx.fillStyle = '#a99a82';
    ctx.font = '22px "Noto Sans CJK SC", sans-serif';
    ctx.fillText('成语解谜 · 每日一关', 70, 1150);

    try {
      return canvas.toDataURL('image/jpeg', 0.92);
    } catch (error) {
      return '';
    }
  }

  function saveCard() {
    if (!shareDataUrl || shareBusy) {
      return;
    }
    if (!getMiniTool() || typeof getMiniTool().saveImageToPhotosAlbum !== 'function') {
      setShareStatus('当前版本不支持保存到相册，可截图结果页。', true);
      return;
    }
    shareBusy = true;
    saveCardBtn.disabled = true;
    setShareStatus('正在保存…', false);
    apiCall('saveImageToPhotosAlbum', { filePath: shareDataUrl }).then(function () {
      shareBusy = false;
      saveCardBtn.disabled = false;
      setShareStatus('已保存到相册。', false);
    }).catch(function (error) {
      shareBusy = false;
      saveCardBtn.disabled = false;
      setShareStatus('保存失败' + (error && error.errCode ? '（' + error.errCode + '）' : '') + '，可截图结果页。', true);
    });
  }

  function shareCard() {
    if (!shareDataUrl || shareBusy) {
      return;
    }
    if (!getMiniTool() || typeof getMiniTool().share !== 'function') {
      setShareStatus('当前版本不支持直接分享，请先保存图片。', true);
      return;
    }
    shareBusy = true;
    shareCardBtn.disabled = true;
    setShareStatus('正在打开分享…', false);
    apiCall('share', { type: 'image', image_resource: shareDataUrl }).then(function () {
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
    if (!shareDataUrl || shareBusy) {
      return;
    }
    var miniTool = getMiniTool();
    if (!miniTool || typeof miniTool.postNote !== 'function') {
      setShareStatus('当前版本不支持发布笔记，请先保存图片。', true);
      return;
    }

    var scoreText = Engine.formatScore(totalScore());
    var streak = Engine.computeStreak(state.history, state.date);
    var title = '今日成语挑战 ' + scoreText + '/5';
    var content = '我在「成语解谜」完成了今天的 5 道成语拼字题，得分 ' +
      scoreText + '/5' + (streak > 0 ? '，连续 ' + streak + ' 天' : '') +
      '。\n每天 5 题，根据释义把 6 个字块拼成四字成语。来挑战同款每日一关吧。';

    shareBusy = true;
    postNoteBtn.disabled = true;
    setShareStatus('正在打开笔记发布页…', false);
    apiCall('postNote', {
      title: title,
      content: content,
      pageType: 'photo_publish',
      mediaInfo: {
        image_resources: [{ url: shareDataUrl }]
      }
    }).then(function () {
      shareBusy = false;
      postNoteBtn.disabled = false;
      setShareStatus('已打开笔记发布页，发布结果以平台为准。', false);
    }).catch(function (error) {
      shareBusy = false;
      postNoteBtn.disabled = false;
      var code = error && error.errCode;
      setShareStatus('发布笔记失败' + (code ? '（' + code + '）' : '') + '，可先保存图片。', true);
    });
  }

  function buildState() {
    var results = [];
    for (var i = 0; i < state.results.length; i += 1) {
      results.push({ word: state.results[i].word, points: state.results[i].points });
    }
    return {
      v: 1,
      date: state.date,
      results: results,
      attempts: state.attempts,
      history: state.history,
      completed: state.completed,
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

  function parseSavedState(raw) {
    if (typeof raw !== 'string' || !raw) {
      return null;
    }
    var data;
    try {
      data = JSON.parse(raw);
    } catch (error) {
      return null;
    }
    if (!data || typeof data.date !== 'string') {
      return null;
    }
    if (!data.results || typeof data.results.length !== 'number' || data.results.length > QUESTION_COUNT) {
      return null;
    }
    var results = [];
    for (var i = 0; i < data.results.length; i += 1) {
      var item = data.results[i];
      if (!item || typeof item.word !== 'string' || item.word.length !== 4) {
        return null;
      }
      if (item.points !== 1 && item.points !== 0.5 && item.points !== 0) {
        return null;
      }
      results.push({ word: item.word, points: item.points });
    }
    var attempts = data.attempts;
    if (typeof attempts !== 'number' || !isFinite(attempts) || attempts < 0 || attempts > 2) {
      attempts = 0;
    }
    var history = {};
    if (data.history && typeof data.history === 'object') {
      for (var key in data.history) {
        if (Object.prototype.hasOwnProperty.call(data.history, key) &&
            /^\d{4}-\d{2}-\d{2}$/.test(key) &&
            typeof data.history[key] === 'number' &&
            isFinite(data.history[key])) {
          history[key] = data.history[key];
        }
      }
    }
    var soundState = null;
    if (data.sound && typeof data.sound === 'object') {
      soundState = {
        sfx: data.sound.sfx !== false,
        bgm: !!data.sound.bgm
      };
    }
    return {
      date: data.date,
      results: results,
      attempts: Math.floor(attempts),
      history: history,
      completed: results.length >= QUESTION_COUNT,
      sound: soundState
    };
  }

  function restoreToday(saved) {
    applySound(saved.sound);
    var daily = Engine.buildDaily(Data, todayKey, QUESTION_COUNT);
    var valid = true;
    for (var i = 0; i < saved.results.length; i += 1) {
      if (!daily[i] || daily[i].word !== saved.results[i].word) {
        valid = false;
        break;
      }
    }
    if (!valid) {
      saved.results = [];
      saved.attempts = 0;
      saved.completed = false;
    }
    if (!saved.completed) {
      delete saved.history[todayKey];
    }
    state = {
      v: 1,
      date: todayKey,
      results: saved.results,
      attempts: saved.attempts,
      history: saved.history,
      completed: saved.completed
    };
    questions = daily;
    if (state.completed) {
      var score = totalScore();
      if (state.history[state.date] === undefined) {
        state.history[state.date] = score;
        pruneHistory(state.history);
        saveNow();
      }
      showResult();
    } else {
      renderQuestion();
    }
  }

  function startFresh(history) {
    history = history || {};
    if (history[todayKey] !== undefined) {
      delete history[todayKey];
    }
    state = defaultState(history);
    questions = Engine.buildDaily(Data, todayKey, QUESTION_COUNT);
    renderQuestion();
  }

  function loadState() {
    if (!canStorage()) {
      loading = false;
      startFresh({});
      setSaveStatus('unsupported');
      return;
    }
    var token = loadToken + 1;
    loadToken = token;
    loading = true;
    updateSubmit();
    setSaveStatus('loading');

    var timeout = window.setTimeout(function () {
      if (token !== loadToken) {
        return;
      }
      loadToken = token + 1;
      loading = false;
      startFresh({});
      setSaveStatus('load-error');
    }, 3000);

    apiCall('getStorage', { key: STORAGE_KEY }).then(function (result) {
      if (token !== loadToken) {
        return;
      }
      window.clearTimeout(timeout);
      loading = false;
      var saved = parseSavedState(result && result.data);
      if (saved) applySound(saved.sound);
      if (saved && saved.date === todayKey) {
        restoreToday(saved);
        setSaveStatus('saved');
      } else {
        startFresh(saved ? saved.history : {});
        setSaveStatus('idle');
      }
      updateSubmit();
    }).catch(function () {
      if (token !== loadToken) {
        return;
      }
      window.clearTimeout(timeout);
      loading = false;
      startFresh({});
      setSaveStatus('idle');
      updateSubmit();
    });
  }

  function bindEvents() {
    tilesEl.addEventListener('click', function (event) {
      var node = event.target;
      while (node && node !== tilesEl) {
        if (node.nodeType === 1 && node.getAttribute && node.getAttribute('data-tile') !== null) {
          onTileClick(Number(node.getAttribute('data-tile')));
          return;
        }
        node = node.parentNode;
      }
    });

    slotsEl.addEventListener('click', function (event) {
      var node = event.target;
      while (node && node !== slotsEl) {
        if (node.nodeType === 1 && node.getAttribute && node.getAttribute('data-slot') !== null) {
          onSlotClick(Number(node.getAttribute('data-slot')));
          return;
        }
        node = node.parentNode;
      }
    });

    if (sfxBtn) {
      sfxBtn.addEventListener('click', function () {
        sound.sfx = !sound.sfx;
        renderSoundUi();
        if (sound.sfx) playSfx('toggle');
        if (state) saveNow();
      });
    }
    if (bgmBtn) {
      bgmBtn.addEventListener('click', function () {
        sound.bgm = !sound.bgm;
        renderSoundUi();
        if (sound.bgm) startBgm();
        else stopBgm();
        if (state) saveNow();
      });
    }
    document.addEventListener('pointerdown', warmAudio, true);
    document.addEventListener('keydown', warmAudio, true);

    submitBtn.addEventListener('click', submitAnswer);
    clearBtn.addEventListener('click', function () {
      if (settled || loading) {
        return;
      }
      selection = [];
      clearFeedback();
      renderSlots();
      renderTiles();
      updateSubmit();
    });
    nextBtn.addEventListener('click', nextQuestion);
    saveCardBtn.addEventListener('click', saveCard);
    shareCardBtn.addEventListener('click', shareCard);
    postNoteBtn.addEventListener('click', publishNote);

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
    if (!Data || !Engine || !Data.length) {
      clueEl.textContent = '题库加载失败，请退出后重新打开。';
      submitBtn.disabled = true;
      setSaveStatus('error');
      return;
    }
    bindEvents();
    renderSoundUi();
    updateSoundButtons();
    dateLabel.textContent = formatDateCN(todayKey);
    streakEl.textContent = '正在准备今日题目';
    loadState();
  }

  init();
}());
