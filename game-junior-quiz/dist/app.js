/* 初中回忆杀 */
(function () {
  'use strict';

  var Data = window.JUNIOR_QUIZ_DATA;
  var Engine = window.JuniorQuizEngine;
  if (!Data || !Engine) return;

  var KEY = 'juniorquiz.v1.state';
  var QUIZ_COUNT = 5;

  var screenSetup = document.getElementById('setup-screen');
  var screenQuiz = document.getElementById('quiz-screen');
  var screenResult = document.getElementById('result-screen');
  var screenProfile = document.getElementById('profile-screen');

  var modePracticeBtn = document.getElementById('mode-practice');
  var modeExamBtn = document.getElementById('mode-exam');
  var gradeChips = document.getElementById('grade-chips');
  var subjectSection = document.getElementById('subject-section');
  var subjectChips = document.getElementById('subject-chips');
  var setupHint = document.getElementById('setup-hint');
  var startBtn = document.getElementById('start-btn');
  var levelBadge = document.getElementById('level-badge');
  var bookOutline = document.getElementById('book-outline');

  var quizProgress = document.getElementById('quiz-progress');
  var quizGrade = document.getElementById('quiz-grade');
  var quizSubject = document.getElementById('quiz-subject');
  var questionPrompt = document.getElementById('question-prompt');
  var optionsEl = document.getElementById('options');
  var feedbackEl = document.getElementById('feedback');
  var feedbackResult = document.getElementById('feedback-result');
  var feedbackExplain = document.getElementById('feedback-explain');
  var nextBtn = document.getElementById('next-btn');
  var quitQuizBtn = document.getElementById('quit-quiz');

  var resultKicker = document.getElementById('result-kicker');
  var resultScore = document.getElementById('result-score');
  var resultTotal = document.getElementById('result-total');
  var resultTitle = document.getElementById('result-title');
  var resultSummary = document.getElementById('result-summary');
  var againBtn = document.getElementById('again-btn');
  var homeBtn = document.getElementById('home-btn');
  var saveCardBtn = document.getElementById('save-card');
  var shareCardBtn = document.getElementById('share-card');
  var postNoteBtn = document.getElementById('post-note');
  var shareStatusEl = document.getElementById('share-status');

  var openProfileBtn = document.getElementById('open-profile');
  var profileBackBtn = document.getElementById('profile-back');
  var profileLevelEl = document.getElementById('profile-level');
  var profileLevelHint = document.getElementById('profile-level-hint');
  var statAnswersEl = document.getElementById('stat-answers');
  var statAccuracyEl = document.getElementById('stat-accuracy');
  var statPracticeEl = document.getElementById('stat-practice');
  var statExamEl = document.getElementById('stat-exam');
  var sfxBtn = document.getElementById('toggle-sfx');
  var bgmBtn = document.getElementById('toggle-bgm');
  var soundNoteEl = document.getElementById('sound-note');
  var wrongCountEl = document.getElementById('wrong-count');
  var wrongListEl = document.getElementById('wrong-list');

  function emptyProfile() {
    return {
      totalAnswers: 0, totalCorrect: 0,
      practiceAnswers: 0, practiceCorrect: 0, practiceSets: 0,
      examQuestions: 0, examCorrect: 0, examAttempts: 0, examPasses: 0,
      wrongBook: {}
    };
  }

  var state = {
    level: 7,
    graduated: false,
    profile: emptyProfile(),
    settings: { sfx: true, bgm: true },
    setup: { mode: 'practice', grade: 7, subject: '综合' },
    paper: [],
    index: 0,
    mode: 'practice',
    grade: 7,
    subject: '综合',
    selected: -1,
    answered: false,
    correctCount: 0,
    cardUrl: '',
    shareBusy: false,
    lastSetup: { mode: 'practice', grade: 7, subject: '综合' }
  };
  var audio = {
    ctx: null, master: null,
    bgmRunning: false, bgmTimer: null, bgmStep: 0, bgmToken: 0
  };

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

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function load() {
    if (!getMiniTool() || typeof getMiniTool().getStorage !== 'function') return;
    apiCall('getStorage', { key: KEY }).then(function (result) {
      var raw = result && result.data;
      if (typeof raw !== 'string' || !raw) return;
      try {
        var saved = JSON.parse(raw);
        if (saved && saved.v === 1) {
          state.level = clamp(Math.floor(saved.level || 7), 7, 9);
          state.graduated = !!saved.graduated;
          if (saved.profile && typeof saved.profile === 'object') {
            var p = state.profile;
            ['totalAnswers', 'totalCorrect', 'practiceAnswers', 'practiceCorrect',
              'practiceSets', 'examQuestions', 'examCorrect', 'examAttempts', 'examPasses'
            ].forEach(function (field) {
              if (typeof saved.profile[field] === 'number') {
                p[field] = Math.max(0, Math.floor(saved.profile[field]));
              }
            });
            if (saved.profile.wrongBook && typeof saved.profile.wrongBook === 'object') {
              p.wrongBook = saved.profile.wrongBook;
            }
          }
          if (saved.settings && typeof saved.settings === 'object') {
            state.settings.sfx = saved.settings.sfx !== false;
            state.settings.bgm = saved.settings.bgm !== false;
          }
          state.setup.grade = clamp(state.setup.grade, 7, state.level);
          renderSetup();
          renderProfile();
        }
      } catch (error) {
        /* 忽略 */
      }
    }).catch(function () {});
  }

  function save() {
    if (!getMiniTool() || typeof getMiniTool().setStorage !== 'function') return;
    apiCall('setStorage', {
      key: KEY,
      data: JSON.stringify({
        v: 1,
        level: state.level,
        graduated: state.graduated,
        profile: state.profile,
        settings: state.settings
      })
    }).catch(function () {});
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
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume || 0.05), t0 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + (duration || 0.12));
      osc.connect(gain);
      gain.connect(audio.master);
      osc.start(t0);
      osc.stop(t0 + (duration || 0.12) + 0.03);
    } catch (error) {
      /* 忽略 */
    }
  }

  function playSfx(kind) {
    if (!state.settings.sfx) return;
    if (kind === 'tap') {
      tone(660, 0, 0.06, 'sine', 0.04);
    } else if (kind === 'correct') {
      tone(523.25, 0, 0.1, 'triangle', 0.05);
      tone(659.25, 0.06, 0.12, 'triangle', 0.05);
      tone(783.99, 0.13, 0.16, 'triangle', 0.045);
    } else if (kind === 'wrong') {
      tone(220, 0, 0.14, 'triangle', 0.045);
      tone(174.61, 0.09, 0.18, 'triangle', 0.04);
    } else if (kind === 'pass') {
      tone(523.25, 0, 0.12, 'triangle', 0.06);
      tone(659.25, 0.1, 0.12, 'triangle', 0.06);
      tone(783.99, 0.2, 0.14, 'triangle', 0.055);
      tone(1046.5, 0.3, 0.22, 'triangle', 0.05);
    } else if (kind === 'complete') {
      tone(392, 0, 0.12, 'sine', 0.05);
      tone(523.25, 0.08, 0.14, 'sine', 0.045);
      tone(659.25, 0.17, 0.2, 'sine', 0.04);
    }
  }

  /* 舒缓背景音乐：D 大调音乐盒 + D–Bm–G–A 和弦铺底，约 12.8 秒循环。 */
  var BGM_STEP = 400;
  var BGM_MELODY = [
    293.66, 0, 369.99, 440, 0, 369.99, 0, 293.66,
    329.63, 0, 293.66, 246.94, 0, 246.94, 0, 0,
    369.99, 0, 440, 493.88, 0, 440, 0, 369.99,
    440, 0, 369.99, 329.63, 0, 293.66, 0, 0
  ];
  var BGM_CHORDS = [
    [146.83, 185, 220],
    [123.47, 146.83, 185],
    [98, 123.47, 146.83],
    [110, 138.59, 164.81]
  ];

  function startBgm() {
    if (!state.settings.bgm || audio.bgmRunning) return;
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
        tone(note, 0, 1.0, 'sine', 0.028);
      }
      if (index % 8 === 0) {
        var chord = BGM_CHORDS[(index / 8) % 4];
        for (var i = 0; i < chord.length; i += 1) {
          tone(chord[i], i * 0.04, 2.4, 'sine', i === 0 ? 0.018 : 0.011);
        }
      }
      audio.bgmStep += 1;
      audio.bgmTimer = window.setTimeout(step, BGM_STEP);
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
      sfxBtn.className = state.settings.sfx ? 'switch is-on' : 'switch';
      sfxBtn.setAttribute('aria-checked', state.settings.sfx ? 'true' : 'false');
    }
    if (bgmBtn) {
      bgmBtn.className = state.settings.bgm ? 'switch is-on' : 'switch';
      bgmBtn.setAttribute('aria-checked', state.settings.bgm ? 'true' : 'false');
    }
    if (soundNoteEl) {
      soundNoteEl.textContent = !(window.AudioContext || window.webkitAudioContext) ?
        '当前环境不支持声音播放。' :
        (state.settings.bgm ? '背景音乐已开启，离开页面会自动暂停。' : '背景音乐已关闭。');
    }
  }

  /* ---------- 页面切换 ---------- */

  function showScreen(name) {
    screenSetup.hidden = name !== 'setup';
    screenQuiz.hidden = name !== 'quiz';
    screenResult.hidden = name !== 'result';
    screenProfile.hidden = name !== 'profile';
    window.scrollTo(0, 0);
  }

  function isUnlocked(grade) {
    return grade <= state.level;
  }

  /* ---------- 首页 ---------- */

  function renderSetup() {
    modePracticeBtn.className = 'mode-tab' + (state.setup.mode === 'practice' ? ' is-active' : '');
    modeExamBtn.className = 'mode-tab' + (state.setup.mode === 'exam' ? ' is-active' : '');
    modePracticeBtn.setAttribute('aria-selected', state.setup.mode === 'practice' ? 'true' : 'false');
    modeExamBtn.setAttribute('aria-selected', state.setup.mode === 'exam' ? 'true' : 'false');

    state.setup.grade = clamp(state.setup.grade, 7, state.level);
    var subjects = Engine.subjectsOf(state.setup.grade);
    if (state.setup.subject !== '综合' && subjects.indexOf(state.setup.subject) === -1) {
      state.setup.subject = '综合';
    }

    // 年级
    gradeChips.innerHTML = '';
    Engine.GRADES.forEach(function (grade) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip' + (state.setup.grade === grade ? ' is-active' : '');
      btn.textContent = Engine.gradeName(grade);
      btn.disabled = !isUnlocked(grade);
      btn.title = isUnlocked(grade) ? '' : '通过上一册考试后解锁';
      btn.addEventListener('click', function () {
        if (btn.disabled) return;
        state.setup.grade = grade;
        playSfx('tap');
        renderSetup();
      });
      gradeChips.appendChild(btn);
    });

    // 科目
    subjectSection.hidden = state.setup.mode !== 'practice';
    if (state.setup.mode === 'practice') {
      subjectChips.innerHTML = '';
      var list = ['综合'].concat(subjects);
      list.forEach(function (subject) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'chip' + (state.setup.subject === subject ? ' is-active' : '');
        btn.textContent = subject;
        btn.addEventListener('click', function () {
          state.setup.subject = subject;
          playSfx('tap');
          renderSetup();
        });
        subjectChips.appendChild(btn);
      });
    }

    levelBadge.textContent = state.graduated ? '三册已通关' :
      (Engine.gradeName(state.level) + '已解锁');

    if (state.setup.mode === 'practice') {
      var count = state.setup.subject === '综合' ? Engine.MIXED_PRACTICE_COUNT : Engine.SUBJECT_PRACTICE_COUNT;
      setupHint.textContent = '练习模式：' + Engine.gradeName(state.setup.grade) + ' · ' +
        state.setup.subject + ' · ' + count + ' 题，答完立即看解析。';
      startBtn.textContent = '开始练习';
    } else {
      setupHint.textContent = state.setup.grade === 9 ?
        '九年级毕业考试：综合卷 10 题，答对 8 题完成初中挑战。' :
        (Engine.gradeName(state.setup.grade) + '综合卷 10 题，答对 8 题解锁' +
          Engine.gradeName(state.setup.grade + 1) + '。');
      startBtn.textContent = '开始考试';
    }

    renderBook();
  }

  function renderBook() {
    bookOutline.innerHTML = '';
    Engine.GRADES.forEach(function (grade) {
      var block = document.createElement('div');
      block.className = 'book-grade';
      var head = document.createElement('div');
      head.className = 'book-grade-head';
      var name = document.createElement('span');
      name.textContent = Engine.gradeName(grade) + ' · ' + Engine.countFor(Data, grade) + ' 题';
      var status = document.createElement('span');
      status.className = 'lock';
      status.textContent = state.graduated || isUnlocked(grade) ? '已解锁' : '未解锁';
      head.appendChild(name);
      head.appendChild(status);
      block.appendChild(head);
      var subjects = document.createElement('p');
      subjects.className = 'book-subjects';
      subjects.textContent = Engine.subjectsOf(grade).join(' · ');
      block.appendChild(subjects);
      bookOutline.appendChild(block);
    });
  }

  /* ---------- 答题 ---------- */

  function startQuiz() {
    var seed = Engine.createSeed();
    if (state.setup.mode === 'practice') {
      state.paper = Engine.buildPractice(Data, state.setup.grade, state.setup.subject, seed);
      state.mode = 'practice';
      state.grade = state.setup.grade;
      state.subject = state.setup.subject;
    } else {
      state.paper = Engine.buildExam(Data, state.setup.grade, seed);
      state.mode = 'exam';
      state.grade = state.setup.grade;
      state.subject = '综合';
    }
    if (!state.paper.length) {
      setupHint.textContent = '题库暂未加载，请退出后重新打开。';
      return;
    }
    state.lastSetup = { mode: state.setup.mode, grade: state.setup.grade, subject: state.setup.subject };
    state.index = 0;
    state.selected = -1;
    state.answered = false;
    state.correctCount = 0;
    state.cardUrl = '';
    showScreen('quiz');
    renderQuestion();
    playSfx('tap');
    if (state.settings.bgm) startBgm();
  }

  function renderQuestion() {
    var question = state.paper[state.index];
    quizProgress.textContent = '第 ' + (state.index + 1) + ' / ' + state.paper.length + ' 题';
    quizGrade.textContent = Engine.gradeName(question.grade);
    quizSubject.textContent = question.subject;
    questionPrompt.textContent = question.prompt;
    optionsEl.innerHTML = '';
    state.selected = -1;
    state.answered = false;
    feedbackEl.hidden = true;
    nextBtn.hidden = true;

    question.options.forEach(function (text, index) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'option';
      var key = document.createElement('span');
      key.className = 'option-key';
      key.textContent = ['A', 'B', 'C', 'D'][index];
      var label = document.createElement('span');
      label.textContent = text;
      btn.appendChild(key);
      btn.appendChild(label);
      btn.setAttribute('data-index', String(index));
      btn.addEventListener('click', function () {
        chooseOption(index);
      });
      optionsEl.appendChild(btn);
    });
  }

  function chooseOption(index) {
    if (state.answered) return;
    var question = state.paper[state.index];
    state.answered = true;
    state.selected = index;
    var correct = index === question.answer;
    if (correct) state.correctCount += 1;

    // 统计
    state.profile.totalAnswers += 1;
    if (correct) state.profile.totalCorrect += 1;
    if (state.mode === 'practice') {
      state.profile.practiceAnswers += 1;
      if (correct) state.profile.practiceCorrect += 1;
    } else {
      state.profile.examQuestions += 1;
      if (correct) state.profile.examCorrect += 1;
    }
    if (correct) {
      delete state.profile.wrongBook[question.id];
    } else {
      var entry = state.profile.wrongBook[question.id] || { count: 0 };
      entry.count += 1;
      entry.lastAt = Date.now();
      state.profile.wrongBook[question.id] = entry;
    }
    save();

    // 选项样式
    var buttons = optionsEl.getElementsByTagName('button');
    for (var i = 0; i < buttons.length; i += 1) {
      var btn = buttons[i];
      var idx = Number(btn.getAttribute('data-index'));
      btn.disabled = true;
      if (idx === question.answer) btn.className = 'option is-correct';
      else if (idx === index) btn.className = 'option is-wrong';
    }

    feedbackResult.textContent = correct ? '回答正确' :
      ('回答错误，正确答案是 ' + ['A', 'B', 'C', 'D'][question.answer] + '。');
    feedbackResult.className = 'feedback-result ' + (correct ? 'is-ok' : 'is-bad');
    feedbackExplain.textContent = question.explanation;
    feedbackEl.hidden = false;
    nextBtn.hidden = false;
    nextBtn.textContent = state.index + 1 >= state.paper.length ? '查看结果' : '下一题';
    playSfx(correct ? 'correct' : 'wrong');
  }

  function nextQuestion() {
    if (state.index + 1 >= state.paper.length) {
      finishQuiz();
      return;
    }
    state.index += 1;
    renderQuestion();
  }

  /* ---------- 结算 ---------- */

  function finishQuiz() {
    var total = state.paper.length;
    var correct = state.correctCount;
    var passed = false;
    var unlockedNext = false;

    if (state.mode === 'practice') {
      state.profile.practiceSets += 1;
      resultKicker.textContent = '练习完成';
      if (correct === total) {
        resultTitle.textContent = '全对，漂亮';
      } else if (correct >= Math.ceil(total * 0.6)) {
        resultTitle.textContent = '稳扎稳打';
      } else {
        resultTitle.textContent = '再复习一下';
      }
      resultSummary.textContent = Engine.gradeName(state.grade) + ' · ' + state.subject +
        ' · 本组 ' + total + ' 题';
      againBtn.textContent = '再来一组';
      playSfx('complete');
    } else {
      state.profile.examAttempts += 1;
      passed = correct >= Engine.PASS_CORRECT;
      resultKicker.textContent = '考试结果';
      if (passed) {
        state.profile.examPasses += 1;
        if (state.grade < 9) {
          if (state.level < state.grade + 1) {
            state.level = state.grade + 1;
            unlockedNext = true;
          }
          resultTitle.textContent = '通过，解锁' + Engine.gradeName(state.grade + 1);
        } else {
          state.graduated = true;
          resultTitle.textContent = '中考通关，初中毕业';
        }
        playSfx('pass');
      } else {
        resultTitle.textContent = '差一点，再考一次';
        playSfx('complete');
      }
      resultSummary.textContent = '答对 ' + correct + ' / ' + total + ' 题，通过线 ' +
        Engine.PASS_CORRECT + ' 题' + (unlockedNext ? ' · 已解锁' + Engine.gradeName(state.level) : '');
      againBtn.textContent = '再考一次';
      state.setup.grade = clamp(state.grade, 7, state.level);
    }

    save();
    resultScore.textContent = String(correct);
    resultTotal.textContent = ' / ' + total;
    state.cardUrl = generateCard(correct, total, passed);
    updateShareButtons();
    shareStatusEl.textContent = '';
    showScreen('result');
    renderSetup();
    renderProfile();
  }

  /* ---------- 成绩卡 ---------- */

  function roundRect(g, x, y, w, h, r) {
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

  function generateCard(correct, total, passed) {
    var c = document.createElement('canvas');
    c.width = 900;
    c.height = 1200;
    var g = c.getContext && c.getContext('2d');
    if (!g) return '';
    var bg = g.createLinearGradient(0, 0, 0, 1200);
    bg.addColorStop(0, '#fbf7ef');
    bg.addColorStop(0.6, '#f3ecdf');
    bg.addColorStop(1, '#e9e0cf');
    g.fillStyle = bg;
    g.fillRect(0, 0, 900, 1200);

    g.fillStyle = 'rgba(63, 110, 168, 0.10)';
    g.beginPath();
    g.arc(740, 160, 200, 0, Math.PI * 2, false);
    g.fill();
    g.fillStyle = 'rgba(217, 161, 63, 0.14)';
    g.beginPath();
    g.arc(130, 1050, 220, 0, Math.PI * 2, false);
    g.fill();

    g.textAlign = 'center';
    g.fillStyle = '#8a6a2f';
    g.font = '600 20px "Noto Sans CJK SC", sans-serif';
    g.fillText('JUNIOR HIGH MEMORY', 450, 92);
    g.fillStyle = '#2f3a4a';
    g.font = '800 50px "Noto Sans CJK SC", sans-serif';
    g.fillText('初中回忆杀', 450, 160);

    g.fillStyle = '#7d8798';
    g.font = '24px "Noto Sans CJK SC", sans-serif';
    g.fillText(Engine.gradeName(state.grade) + ' · ' + (state.mode === 'exam' ? '综合考试' : state.subject), 450, 206);

    if (state.mode === 'exam' && passed) {
      g.fillStyle = '#3f7d5f';
      roundRect(g, 670, 250, 150, 48, 24);
      g.fill();
      g.fillStyle = '#ffffff';
      g.font = '700 22px "Noto Sans CJK SC", sans-serif';
      g.fillText(passed ? '通过' : '', 745, 282);
    }

    // 书本插画
    g.fillStyle = '#dfe8f4';
    roundRect(g, 210, 280, 480, 300, 24);
    g.fill();
    g.strokeStyle = '#3f6ea8';
    g.lineWidth = 6;
    roundRect(g, 236, 306, 428, 248, 16);
    g.stroke();
    g.strokeStyle = 'rgba(63, 110, 168, 0.45)';
    g.lineWidth = 6;
    for (var i = 0; i < 4; i += 1) {
      g.beginPath();
      g.moveTo(280, 370 + i * 44);
      g.lineTo(620, 370 + i * 44);
      g.stroke();
    }
    g.fillStyle = '#d9a13f';
    roundRect(g, 690, 300, 18, 260, 9);
    g.fill();

    g.fillStyle = '#3f6ea8';
    g.font = '800 130px "Noto Sans CJK SC", sans-serif';
    g.fillText(String(correct), 450, 740);
    g.fillStyle = '#7d8798';
    g.font = '30px "Noto Sans CJK SC", sans-serif';
    g.fillText('/ ' + total + ' 题', 450, 790);

    g.fillStyle = '#2f3a4a';
    g.font = '800 36px "Noto Sans CJK SC", sans-serif';
    g.fillText(state.mode === 'exam' ? (passed ? '考试通过' : '再接再厉') : '练习完成', 450, 870);

    var accuracy = total ? Math.round(correct / total * 100) : 0;
    g.fillStyle = '#7d8798';
    g.font = '26px "Noto Sans CJK SC", sans-serif';
    g.fillText('正确率 ' + accuracy + '% · 累计答题 ' + state.profile.totalAnswers + ' 题', 450, 925);

    g.fillStyle = '#b08a5a';
    g.font = '22px "Noto Sans CJK SC", sans-serif';
    g.fillText('三册初中课程，一册一册通关', 450, 1060);
    g.fillText('初中回忆杀', 450, 1102);
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
      shareStatusEl.textContent = '当前版本不支持保存、分享或发布笔记，可截图结果页。';
      shareStatusEl.className = 'share-status is-error';
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
    state.shareBusy = true;
    postNoteBtn.disabled = true;
    setShareStatus('正在打开笔记发布页…', false);
    apiCall('postNote', {
      title: '初中回忆杀：答对 ' + state.correctCount + ' 题',
      content: '我在「初中回忆杀」的' + Engine.gradeName(state.grade) + '挑战里答对 ' +
        state.correctCount + ' / ' + state.paper.length + ' 题。三册初中课程，一册一册通关。',
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

  /* ---------- 个人中心 ---------- */

  function renderProfile() {
    var profile = state.profile;
    profileLevelEl.textContent = state.graduated ? '三册通关' : Engine.gradeName(state.level);
    if (state.graduated) {
      profileLevelHint.textContent = '已通过九年级毕业考试，可自由练习三册题库。';
    } else if (state.level < 9) {
      profileLevelHint.textContent = '通过' + Engine.gradeName(state.level) + '考试解锁' +
        Engine.gradeName(state.level + 1) + '。';
    } else {
      profileLevelHint.textContent = '通过九年级毕业考试完成初中挑战。';
    }
    statAnswersEl.textContent = String(profile.totalAnswers);
    statAccuracyEl.textContent = profile.totalAnswers ?
      Math.round(profile.totalCorrect / profile.totalAnswers * 100) + '%' : '0%';
    statPracticeEl.textContent = String(profile.practiceSets);
    statExamEl.textContent = profile.examPasses + ' / ' + profile.examAttempts;

    renderSound();

    var entries = [];
    for (var id in profile.wrongBook) {
      if (Object.prototype.hasOwnProperty.call(profile.wrongBook, id)) {
        var question = null;
        for (var i = 0; i < Data.length; i += 1) {
          if (Data[i].id === id) { question = Data[i]; break; }
        }
        if (question) {
          entries.push({ item: profile.wrongBook[id], question: question });
        }
      }
    }
    entries.sort(function (a, b) {
      return (b.item.lastAt || 0) - (a.item.lastAt || 0);
    });
    wrongCountEl.textContent = entries.length + ' 题';
    wrongListEl.innerHTML = '';
    if (!entries.length) {
      var empty = document.createElement('p');
      empty.className = 'wrong-empty';
      empty.textContent = '错题本还是空的，继续练习吧。';
      wrongListEl.appendChild(empty);
      return;
    }
    entries.forEach(function (entry) {
      var q = entry.question;
      var wrap = document.createElement('div');
      wrap.className = 'wrong-item';
      var prompt = document.createElement('p');
      prompt.className = 'wrong-prompt';
      prompt.textContent = q.prompt;
      var answer = document.createElement('p');
      answer.className = 'wrong-answer';
      answer.textContent = '正确答案：' + q.options[q.answer];
      var explain = document.createElement('p');
      explain.className = 'wrong-explain';
      explain.textContent = q.explanation;
      wrap.appendChild(prompt);
      wrap.appendChild(answer);
      wrap.appendChild(explain);
      wrongListEl.appendChild(wrap);
    });
  }

  /* ---------- 绑定 ---------- */

  function bind() {
    modePracticeBtn.addEventListener('click', function () {
      state.setup.mode = 'practice';
      playSfx('tap');
      renderSetup();
    });
    modeExamBtn.addEventListener('click', function () {
      state.setup.mode = 'exam';
      playSfx('tap');
      renderSetup();
    });
    startBtn.addEventListener('click', startQuiz);
    quitQuizBtn.addEventListener('click', function () {
      showScreen('setup');
      renderSetup();
    });
    nextBtn.addEventListener('click', nextQuestion);
    againBtn.addEventListener('click', function () {
      state.setup.mode = state.lastSetup.mode;
      state.setup.grade = state.lastSetup.grade;
      state.setup.subject = state.lastSetup.subject;
      startQuiz();
    });
    homeBtn.addEventListener('click', function () {
      showScreen('setup');
      renderSetup();
    });
    saveCardBtn.addEventListener('click', saveCard);
    shareCardBtn.addEventListener('click', shareCard);
    postNoteBtn.addEventListener('click', postNote);
    openProfileBtn.addEventListener('click', function () {
      renderProfile();
      showScreen('profile');
      playSfx('tap');
    });
    profileBackBtn.addEventListener('click', function () {
      showScreen('setup');
      renderSetup();
    });
    sfxBtn.addEventListener('click', function () {
      state.settings.sfx = !state.settings.sfx;
      renderSound();
      save();
      if (state.settings.sfx) playSfx('tap');
    });
    bgmBtn.addEventListener('click', function () {
      state.settings.bgm = !state.settings.bgm;
      renderSound();
      save();
      if (state.settings.bgm) {
        ensureAudio();
        startBgm();
      } else {
        stopBgm();
      }
    });

    function unlockAudioOnGesture() {
      ensureAudio();
      if (state.settings.bgm) startBgm();
    }
    document.addEventListener('pointerdown', unlockAudioOnGesture, { once: true });
    document.addEventListener('keydown', unlockAudioOnGesture, { once: true });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        stopBgm();
      } else if (state.settings.bgm) {
        startBgm();
      }
    });
  }

  function boot() {
    bind();
    renderSetup();
    renderProfile();
    updateShareButtons();
    load();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}());
