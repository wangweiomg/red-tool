(function () {
  'use strict';

  var Data = window.PRIMARY_QUIZ_DATA;
  var Engine = window.PrimaryQuizEngine;
  var STORAGE_KEY = 'primaryquiz.v3.state';
  var SUBJECTS_ALL = ['综合', '语文', '数学', '英语', '科学'];
  var SUBJECT_CLASS = {
    '语文': 'subject-cn',
    '数学': 'subject-math',
    '英语': 'subject-en',
    '科学': 'subject-sci'
  };
  var PRACTICE_COUNT = 10;

  var setupScreen = document.getElementById('setup-screen');
  var setupTitle = document.getElementById('setup-title');
  var modeTabs = document.getElementById('mode-tabs');
  var practiceOptions = document.getElementById('practice-options');
  var subjectChips = document.getElementById('subject-chips');
  var gradeChips = document.getElementById('grade-chips');
  var rangeChips = document.getElementById('range-chips');
  var examInfo = document.getElementById('exam-info');
  var examTitle = document.getElementById('exam-title');
  var examDesc = document.getElementById('exam-desc');
  var examLevel = document.getElementById('exam-level');
  var setupHint = document.getElementById('setup-hint');
  var startBtn = document.getElementById('start-btn');
  var levelGradeEl = document.getElementById('best-grade');
  var openProfileBtn = document.getElementById('open-profile');
  var openProfileBanner = document.getElementById('open-profile-banner');
  var profileScreen = document.getElementById('profile-screen');
  var profileBackBtn = document.getElementById('profile-back');
  var profileLevelEl = document.getElementById('profile-level');
  var levelProgressBar = document.getElementById('level-progress-bar');
  var levelHintEl = document.getElementById('level-hint');
  var statAnswersEl = document.getElementById('stat-answers');
  var statPracticeAnswersEl = document.getElementById('stat-practice-answers');
  var statAccuracyEl = document.getElementById('stat-accuracy');
  var statPracticeEl = document.getElementById('stat-practice');
  var statExamEl = document.getElementById('stat-exam');
  var toggleSfxBtn = document.getElementById('toggle-sfx');
  var toggleBgmBtn = document.getElementById('toggle-bgm');
  var soundNoteEl = document.getElementById('sound-note');
  var wrongCountEl = document.getElementById('wrong-count');
  var wrongListEl = document.getElementById('wrong-list');
  var quizScreen = document.getElementById('quiz-screen');
  var resultScreen = document.getElementById('result-screen');
  var gradeLabelEl = document.getElementById('grade-label');
  var questionProgressEl = document.getElementById('question-progress');
  var gradeDots = document.getElementById('grade-dots');
  var questionCard = document.getElementById('question-card');
  var summaryCard = document.getElementById('summary-card');
  var subjectTag = document.getElementById('subject-tag');
  var gradeTag = document.getElementById('grade-tag');
  var promptEl = document.getElementById('prompt');
  var optionsEl = document.getElementById('options');
  var feedbackEl = document.getElementById('feedback');
  var explainBox = document.getElementById('explain-box');
  var explanationEl = document.getElementById('explanation');
  var confirmBtn = document.getElementById('confirm');
  var nextBtn = document.getElementById('next');
  var summaryGrade = document.getElementById('summary-grade');
  var summaryResult = document.getElementById('summary-result');
  var summaryText = document.getElementById('summary-text');
  var summaryBtn = document.getElementById('summary-btn');
  var restartBtn = document.getElementById('restart');
  var resultKicker = document.getElementById('result-kicker');
  var resultGradeEl = document.getElementById('result-grade');
  var resultTitleEl = document.getElementById('result-title');
  var resultSubEl = document.getElementById('result-sub');
  var gradeLadderEl = document.getElementById('grade-ladder');
  var resultBreakdownEl = document.getElementById('result-breakdown');
  var reviewListEl = document.getElementById('review-list');
  var sharePreview = document.getElementById('share-preview');
  var saveCardBtn = document.getElementById('save-card');
  var shareCardBtn = document.getElementById('share-card');
  var postNoteBtn = document.getElementById('post-note');
  var retryBtn = document.getElementById('retry');
  var changeSetupBtn = document.getElementById('change-setup');
  var shareStatus = document.getElementById('share-status');
  var saveStatus = document.getElementById('save-status');

  var QUESTION_MAP = {};
  if (Data) {
    for (var qm = 0; qm < Data.length; qm += 1) {
      QUESTION_MAP[Data[qm].id] = Data[qm];
    }
  }

  var state = {
    v: 3,
    phase: 'setup',
    mode: 'practice',
    subject: '综合',
    grade: 1,
    range: 'lower',
    seed: 0,
    answers: [],
    selected: -1,
    level: 1,
    graduated: false,
    completed: false,
    profile: emptyProfile(),
    settings: defaultSettings()
  };
  var setup = {
    mode: 'practice',
    subject: '综合',
    grade: 1,
    range: 'lower'
  };
  var paper = [];
  var loading = false;
  var profileOpen = false;
  var shareDataUrl = '';
  var shareBusy = false;

  function emptyProfile() {
    return {
      totalAnswers: 0,
      totalCorrect: 0,
      practiceAnswers: 0,
      practiceCorrect: 0,
      practiceSets: 0,
      examQuestions: 0,
      examCorrect: 0,
      examAttempts: 0,
      examPasses: 0,
      wrongBook: {}
    };
  }

  function defaultSettings() {
    return { sfx: true, bgm: true };
  }

  function normalizeSettings(raw) {
    var settings = defaultSettings();
    if (!raw || typeof raw !== 'object') {
      return settings;
    }
    settings.sfx = raw.sfx !== false;
    settings.bgm = raw.bgm === true;
    return settings;
  }

  var audioState = {
    ctx: null,
    sfxGain: null,
    musicGain: null,
    timer: null,
    bgmRunning: false,
    step: 0,
    nextTime: 0,
    unlocked: false
  };

  /* 舒缓背景纯音乐：F 大调五声音阶的音乐盒旋律，F–Dm–B♭–C 慢速和弦铺底。
   * 32 步、每步 0.42 秒，约 13.4 秒一循环；全部 Web Audio 合成，不引入音频文件。 */
  var BGM_STEP = 0.42;
  var BGM_MELODY = [
    440, 0, 523.25, 587.33, 0, 523.25, 0, 440,
    440, 0, 392, 349.23, 0, 349.23, 0, 0,
    587.33, 0, 698.46, 587.33, 0, 523.25, 0, 440,
    523.25, 0, 440, 392, 0, 349.23, 0, 0
  ];
  var BGM_CHORDS = [
    [174.61, 220, 261.63],
    [146.83, 174.61, 220],
    [116.54, 146.83, 174.61],
    [130.81, 164.81, 196]
  ];

  function ensureAudio() {
    if (audioState.ctx) {
      return audioState.ctx;
    }
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) {
      return null;
    }
    try {
      var ctx = new Ctx();
      var sfxGain = ctx.createGain();
      sfxGain.gain.value = 0.8;
      sfxGain.connect(ctx.destination);
      var musicGain = ctx.createGain();
      musicGain.gain.value = 0.5;
      musicGain.connect(ctx.destination);
      audioState.ctx = ctx;
      audioState.sfxGain = sfxGain;
      audioState.musicGain = musicGain;
      return ctx;
    } catch (error) {
      return null;
    }
  }

  function unlockAudio() {
    var ctx = ensureAudio();
    if (!ctx) {
      return null;
    }
    audioState.unlocked = true;
    if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
      try {
        var resumed = ctx.resume();
        if (resumed && typeof resumed.catch === 'function') {
          resumed.catch(function () {});
        }
      } catch (error) {
        /* ignore */
      }
    }
    return ctx;
  }

  function playTone(frequency, start, duration, type, volume, destination) {
    var ctx = audioState.ctx;
    if (!ctx || !destination) {
      return;
    }
    try {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain);
      gain.connect(destination);
      osc.start(start);
      osc.stop(start + duration + 0.03);
    } catch (error) {
      /* audio is non-critical */
    }
  }

  function playSfx(kind) {
    var settings = state.settings || defaultSettings();
    if (!settings.sfx) {
      return;
    }
    var ctx = unlockAudio();
    if (!ctx) {
      return;
    }
    var now = ctx.currentTime + 0.02;
    var patterns = {
      tap: [
        [720, 0, 0.055, 'sine', 0.05]
      ],
      correct: [
        [523.25, 0, 0.11, 'triangle', 0.06],
        [659.25, 0.07, 0.12, 'triangle', 0.055],
        [783.99, 0.14, 0.18, 'triangle', 0.05]
      ],
      wrong: [
        [220, 0, 0.15, 'triangle', 0.05],
        [174.61, 0.1, 0.2, 'triangle', 0.04]
      ],
      levelUp: [
        [523.25, 0, 0.14, 'triangle', 0.06],
        [659.25, 0.09, 0.14, 'triangle', 0.06],
        [783.99, 0.18, 0.15, 'triangle', 0.055],
        [1046.5, 0.27, 0.22, 'triangle', 0.05]
      ],
      complete: [
        [392, 0, 0.14, 'sine', 0.05],
        [523.25, 0.1, 0.16, 'sine', 0.045],
        [659.25, 0.2, 0.2, 'sine', 0.04]
      ]
    };
    var notes = patterns[kind];
    if (!notes) {
      return;
    }
    for (var i = 0; i < notes.length; i += 1) {
      playTone(notes[i][0], now + notes[i][1], notes[i][2], notes[i][3], notes[i][4], audioState.sfxGain);
    }
  }

  function scheduleBgm() {
    if (!audioState.bgmRunning) {
      return;
    }
    var ctx = audioState.ctx;
    if (!ctx) {
      return;
    }
    if (audioState.nextTime < ctx.currentTime - 1) {
      audioState.nextTime = ctx.currentTime + 0.05;
    }
    var lookahead = ctx.currentTime + 0.5;
    while (audioState.nextTime < lookahead) {
      var index = audioState.step % 32;
      var note = BGM_MELODY[index];
      if (note) {
        playTone(note, audioState.nextTime, 0.95, 'sine', 0.045, audioState.musicGain);
      }
      if (index % 8 === 0) {
        var chord = BGM_CHORDS[(index / 8) % 4];
        for (var c = 0; c < chord.length; c += 1) {
          playTone(chord[c], audioState.nextTime + c * 0.04, 2.3, 'sine',
            c === 0 ? 0.026 : 0.016, audioState.musicGain);
        }
      }
      audioState.nextTime += BGM_STEP;
      audioState.step += 1;
    }
    audioState.timer = window.setTimeout(scheduleBgm, 120);
  }

  function startBgm() {
    if (!(state.settings || defaultSettings()).bgm) {
      return;
    }
    var ctx = unlockAudio();
    if (!ctx || audioState.bgmRunning) {
      return;
    }
    audioState.bgmRunning = true;
    audioState.nextTime = ctx.currentTime + 0.08;
    scheduleBgm();
  }

  function stopBgm() {
    audioState.bgmRunning = false;
    if (audioState.timer) {
      window.clearTimeout(audioState.timer);
      audioState.timer = null;
    }
  }

  function audioSupported() {
    return !!(window.AudioContext || window.webkitAudioContext);
  }

  function normalizeProfile(raw) {
    var profile = emptyProfile();
    if (!raw || typeof raw !== 'object') {
      return profile;
    }
    var numeric = [
      'totalAnswers', 'totalCorrect', 'practiceAnswers', 'practiceCorrect',
      'practiceSets', 'examQuestions', 'examCorrect', 'examAttempts', 'examPasses'
    ];
    for (var i = 0; i < numeric.length; i += 1) {
      var value = raw[numeric[i]];
      if (typeof value === 'number' && isFinite(value) && value >= 0) {
        profile[numeric[i]] = Math.floor(value);
      }
    }
    if (raw.wrongBook && typeof raw.wrongBook === 'object') {
      for (var key in raw.wrongBook) {
        if (!Object.prototype.hasOwnProperty.call(raw.wrongBook, key)) {
          continue;
        }
        var item = raw.wrongBook[key];
        if (!item || typeof item.id !== 'string' || !QUESTION_MAP[item.id]) {
          continue;
        }
        var wrongCount = Math.floor(item.wrongCount || 1);
        var lastSelected = Math.floor(item.lastSelected);
        if (!isFinite(wrongCount) || wrongCount < 1 ||
            !isFinite(lastSelected) || lastSelected < 0 || lastSelected > 3) {
          continue;
        }
        profile.wrongBook[item.id] = {
          id: item.id,
          wrongCount: wrongCount,
          lastSelected: lastSelected,
          lastAt: typeof item.lastAt === 'number' && isFinite(item.lastAt) ? item.lastAt : 0
        };
      }
    }
    return profile;
  }

  function capWrongBook(profile) {
    var ids = [];
    for (var id in profile.wrongBook) {
      if (Object.prototype.hasOwnProperty.call(profile.wrongBook, id)) {
        ids.push(id);
      }
    }
    if (ids.length <= 80) {
      return;
    }
    ids.sort(function (a, b) {
      return profile.wrongBook[a].lastAt - profile.wrongBook[b].lastAt;
    });
    while (ids.length > 80) {
      delete profile.wrongBook[ids.shift()];
    }
  }

  function recordProfileAnswer(question, selected, correct) {
    var profile = state.profile || emptyProfile();
    state.profile = profile;
    profile.totalAnswers += 1;
    if (correct) {
      profile.totalCorrect += 1;
    }
    if (state.mode === 'practice') {
      profile.practiceAnswers += 1;
      if (correct) {
        profile.practiceCorrect += 1;
      }
    } else {
      profile.examQuestions += 1;
      if (correct) {
        profile.examCorrect += 1;
      }
    }
    if (correct) {
      if (profile.wrongBook[question.id]) {
        delete profile.wrongBook[question.id];
      }
    } else {
      var previous = profile.wrongBook[question.id];
      profile.wrongBook[question.id] = {
        id: question.id,
        wrongCount: previous ? previous.wrongCount + 1 : 1,
        lastSelected: selected,
        lastAt: Date.now()
      };
      capWrongBook(profile);
    }
  }

  var loadToken = 0;
  var pendingSave = null;
  var saving = false;

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
      'load-error': '读取本地进度超时，可继续测试；保存会覆盖本地记录。'
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

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function levelName() {
    return Engine.gradeName(state.level);
  }

  function updateLevelChip() {
    levelGradeEl.textContent = levelName();
  }

  function currentIndex() {
    return state.phase === 'feedback' ? state.answers.length - 1 : state.answers.length;
  }

  function totalCorrect() {
    var count = 0;
    for (var i = 0; i < state.answers.length; i += 1) {
      if (state.answers[i].correct) {
        count += 1;
      }
    }
    return count;
  }

  function normalizeRange(value) {
    return value === 'same' || value === 'olympiad' ? value : 'lower';
  }

  function buildPaperFor(mode, subject, grade, range, seed) {
    if (mode === 'exam') {
      return Engine.buildExamPaper(Data, grade, seed);
    }
    return Engine.buildPracticePaper(Data, subject, grade, normalizeRange(range), seed, PRACTICE_COUNT);
  }

  function normalizeSetup() {
    if (SUBJECTS_ALL.indexOf(setup.subject) === -1) {
      setup.subject = '综合';
    }
    if (setup.mode !== 'exam') {
      setup.mode = 'practice';
    }
    setup.grade = clamp(Math.floor(setup.grade || 1), 1, state.level);
    setup.range = normalizeRange(setup.range);
  }

  function renderSetup() {
    normalizeSetup();
    setupScreen.hidden = false;
    quizScreen.hidden = true;
    resultScreen.hidden = true;

    var tabs = modeTabs.getElementsByTagName('button');
    for (var t = 0; t < tabs.length; t += 1) {
      var modeActive = tabs[t].getAttribute('data-mode') === setup.mode;
      tabs[t].className = tabs[t].className.replace(/\s*is-active/g, '') +
        (modeActive ? ' is-active' : '');
      tabs[t].setAttribute('aria-pressed', modeActive ? 'true' : 'false');
    }

    var practiceMode = setup.mode === 'practice';
    practiceOptions.hidden = !practiceMode;
    examInfo.hidden = practiceMode;
    setupTitle.textContent = practiceMode ? '今天想练哪一科？' : '准备升级考试';

    if (practiceMode) {
      var subjectButtons = subjectChips.getElementsByTagName('button');
      for (var i = 0; i < subjectButtons.length; i += 1) {
        var active = subjectButtons[i].getAttribute('data-subject') === setup.subject;
        subjectButtons[i].className = subjectButtons[i].className.replace(/\s*is-active/g, '') +
          (active ? ' is-active' : '');
        subjectButtons[i].setAttribute('aria-pressed', active ? 'true' : 'false');
      }

      var gradeButtons = gradeChips.getElementsByTagName('button');
      for (var j = 0; j < gradeButtons.length; j += 1) {
        var gradeValue = Number(gradeButtons[j].getAttribute('data-grade'));
        var unlocked = gradeValue <= state.level;
        var gradeActive = gradeValue === setup.grade;
        gradeButtons[j].className = gradeButtons[j].className.replace(/\s*is-active/g, '') +
          (gradeActive ? ' is-active' : '');
        gradeButtons[j].setAttribute('aria-pressed', gradeActive ? 'true' : 'false');
        gradeButtons[j].disabled = !unlocked;
        gradeButtons[j].title = unlocked ? '' : '通过升级考试后解锁';
      }

      var rangeButtons = rangeChips.getElementsByTagName('button');
      for (var r = 0; r < rangeButtons.length; r += 1) {
        var rangeValue = rangeButtons[r].getAttribute('data-range');
        var rangeActive = rangeValue === setup.range;
        rangeButtons[r].className = rangeButtons[r].className.replace(/\s*is-active/g, '') +
          (rangeActive ? ' is-active' : '');
        rangeButtons[r].setAttribute('aria-pressed', rangeActive ? 'true' : 'false');
      }

      if (setup.range === 'olympiad') {
        setupHint.textContent = '奥赛：' + Engine.gradeName(setup.grade) +
          '及以下高难题，题库不足时按实际题数。';
        startBtn.textContent = '开始奥赛练习';
      } else {
        setupHint.textContent = '练习模式：' + Engine.gradeName(setup.grade) +
          (setup.range === 'lower' ? '及以下' : '本年级') +
          '标准题库，每组最多 10 题，不改变年级。';
        startBtn.textContent = '开始练习';
      }
    } else {
      var isGraduation = state.level >= 6;
      examTitle.textContent = isGraduation ? '小学毕业考试' : Engine.gradeName(state.level) + '升级考试';
      examDesc.textContent = isGraduation ?
        '综合卷 4 题，答对 3 题通过毕业考试。' :
        '综合卷：语文、数学、英语、科学各 1 题，答对 3 题解锁' + Engine.gradeName(state.level + 1) + '。';
      examLevel.textContent = '当前已解锁：' + Engine.gradeName(state.level);
      setupHint.textContent = isGraduation ?
        '通过毕业考试，完成小学六年的挑战。' :
        '通过后解锁' + Engine.gradeName(state.level + 1) + '，之后可以练习新年级题库。';
      startBtn.textContent = isGraduation ? '开始毕业考试' : '开始升级考试';
    }

    startBtn.disabled = loading;
    updateLevelChip();
  }

  function renderProgress() {
    var index = currentIndex();
    var total = paper.length;
    if (state.mode === 'practice') {
      gradeLabelEl.textContent = Engine.gradeName(state.grade) +
        (state.range === 'olympiad' ? '奥赛' : (state.range === 'same' ? '本年级' : '及以下')) +
        (state.subject === '综合' ? '' : ' · ' + state.subject);
    } else {
      gradeLabelEl.textContent = state.level >= 6 ? '毕业考试' : Engine.gradeName(state.level) + '升级考试';
    }
    questionProgressEl.textContent = '第 ' + (index + 1) + ' / ' + total + ' 题';

    gradeDots.textContent = '';
    var answered = state.answers.length;
    var fragment = document.createDocumentFragment();
    for (var i = 0; i < total; i += 1) {
      var dot = document.createElement('span');
      var cls = 'dot';
      if (i < answered) {
        cls += state.answers[i].correct ? ' is-done' : ' is-wrong';
      } else if (i === answered && state.phase === 'question') {
        cls += ' is-current';
      }
      dot.className = cls;
      fragment.appendChild(dot);
    }
    gradeDots.appendChild(fragment);
  }

  function renderOptions(question, answered, lastAnswer) {
    optionsEl.textContent = '';
    var fragment = document.createDocumentFragment();
    for (var i = 0; i < question.options.length; i += 1) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'option';
      button.setAttribute('data-option', String(i));

      if (answered) {
        button.disabled = true;
        if (i === question.answer) {
          button.className += ' is-correct';
        } else if (lastAnswer && i === lastAnswer.selected && !lastAnswer.correct) {
          button.className += ' is-wrong';
        }
      } else if (i === state.selected) {
        button.className += ' is-selected';
      }

      var letter = document.createElement('span');
      letter.className = 'option-letter';
      letter.textContent = String.fromCharCode(65 + i);
      var text = document.createElement('span');
      text.className = 'option-text';
      text.textContent = question.options[i];
      button.appendChild(letter);
      button.appendChild(text);
      fragment.appendChild(button);
    }
    optionsEl.appendChild(fragment);
  }

  function renderQuestion() {
    var question = paper[currentIndex()];
    var answered = state.phase === 'feedback';
    var lastAnswer = answered ? state.answers[state.answers.length - 1] : null;

    questionCard.hidden = false;
    summaryCard.hidden = true;

    subjectTag.textContent = question.subject;
    subjectTag.className = 'subject-tag ' + (SUBJECT_CLASS[question.subject] || '');
    gradeTag.textContent = Engine.gradeName(question.grade);
    promptEl.textContent = question.prompt;
    renderOptions(question, answered, lastAnswer);

    explainBox.hidden = !answered;
    explanationEl.textContent = answered ? question.explanation : '';

    if (answered) {
      if (lastAnswer.correct) {
        feedbackEl.textContent = '答对了，+1 分';
        feedbackEl.className = 'feedback is-good';
      } else {
        feedbackEl.textContent = '答错了，正确答案是 ' + question.options[question.answer];
        feedbackEl.className = 'feedback is-error';
      }
      confirmBtn.hidden = true;
      nextBtn.hidden = false;
      nextBtn.textContent = state.answers.length >= paper.length ? '查看本组结果' : '下一题';
    } else {
      feedbackEl.textContent = '';
      feedbackEl.className = 'feedback';
      confirmBtn.hidden = false;
      confirmBtn.disabled = state.selected < 0 || loading;
      nextBtn.hidden = true;
    }
  }

  function renderSummary() {
    var correct = totalCorrect();
    var total = paper.length;
    var passed = Engine.isPass(correct, total);

    questionCard.hidden = true;
    summaryCard.hidden = false;

    if (state.mode === 'practice') {
      summaryGrade.textContent = Engine.gradeName(state.grade) +
        (state.subject === '综合' ? '' : ' · ' + state.subject);
      summaryText.textContent = passed ?
        '本组练习完成，正确率不错。' : '本组练习完成，可以再来一组。';
    } else {
      summaryGrade.textContent = state.level >= 6 ? '毕业考试' : Engine.gradeName(state.level) + '升级考试';
      summaryText.textContent = passed ?
        (state.level >= 6 ? '达到毕业标准，查看结果。' : '达到升级标准，查看结果后解锁下一年级。') :
        '未达到升级标准，先练习当前年级再考。';
    }
    summaryResult.textContent = correct + ' / ' + total + ' 答对';
    summaryBtn.textContent = '查看结果';

    gradeLabelEl.textContent = summaryGrade.textContent;
    questionProgressEl.textContent = '本组完成';
    gradeDots.textContent = '';
    var fragment = document.createDocumentFragment();
    for (var i = 0; i < state.answers.length; i += 1) {
      var dot = document.createElement('span');
      dot.className = 'dot ' + (state.answers[i].correct ? 'is-done' : 'is-wrong');
      fragment.appendChild(dot);
    }
    gradeDots.appendChild(fragment);
  }

  function renderProfile() {
    profileScreen.hidden = false;
    setupScreen.hidden = true;
    quizScreen.hidden = true;
    resultScreen.hidden = true;

    var profile = state.profile || emptyProfile();
    updateLevelChip();
    profileLevelEl.textContent = levelName();
    levelProgressBar.style.width = (state.graduated ? 100 : Math.round(state.level / 6 * 100)) + '%';
    if (state.graduated) {
      levelHintEl.textContent = '已完成小学毕业考试，可自由练习一至六年级。';
    } else if (state.level < 6) {
      levelHintEl.textContent = '通过' + Engine.gradeName(state.level) + '升级考试解锁' +
        Engine.gradeName(state.level + 1) + '。';
    } else {
      levelHintEl.textContent = '通过毕业考试完成小学挑战。';
    }

    statAnswersEl.textContent = String(profile.totalAnswers);
    statPracticeAnswersEl.textContent = String(profile.practiceAnswers);
    statAccuracyEl.textContent = profile.totalAnswers > 0 ?
      Math.round(profile.totalCorrect / profile.totalAnswers * 100) + '%' : '0%';
    statPracticeEl.textContent = String(profile.practiceSets);
    statExamEl.textContent = profile.examPasses + ' / ' + profile.examAttempts;

    var settings = state.settings || defaultSettings();
    toggleSfxBtn.className = settings.sfx ? 'switch is-on' : 'switch';
    toggleSfxBtn.setAttribute('aria-checked', settings.sfx ? 'true' : 'false');
    toggleBgmBtn.className = settings.bgm ? 'switch is-on' : 'switch';
    toggleBgmBtn.setAttribute('aria-checked', settings.bgm ? 'true' : 'false');
    soundNoteEl.textContent = !audioSupported() ?
      '当前环境不支持声音播放。' :
      (settings.bgm ? '背景音乐已开启，离开页面会自动暂停。' : '背景音乐默认关闭，打开后点击页面开始播放。');

    var entries = [];
    for (var id in profile.wrongBook) {
      if (Object.prototype.hasOwnProperty.call(profile.wrongBook, id)) {
        var question = QUESTION_MAP[id];
        if (question) {
          entries.push({ item: profile.wrongBook[id], question: question });
        }
      }
    }
    entries.sort(function (a, b) {
      if (b.item.lastAt !== a.item.lastAt) {
        return b.item.lastAt - a.item.lastAt;
      }
      return b.item.wrongCount - a.item.wrongCount;
    });

    wrongCountEl.textContent = entries.length + ' 题';
    wrongListEl.textContent = '';
    if (!entries.length) {
      var empty = document.createElement('p');
      empty.className = 'wrong-empty';
      empty.textContent = '错题本还是空的，继续练习吧。';
      wrongListEl.appendChild(empty);
      return;
    }

    var fragment = document.createDocumentFragment();
    for (var i = 0; i < entries.length; i += 1) {
      var entry = entries[i];
      var q = entry.question;
      var item = document.createElement('div');
      item.className = 'wrong-item';

      var tags = document.createElement('div');
      tags.className = 'wrong-tags';
      var gradeTagEl = document.createElement('span');
      gradeTagEl.className = 'wrong-tag';
      gradeTagEl.textContent = Engine.gradeName(q.grade);
      var subjectTagEl = document.createElement('span');
      subjectTagEl.className = 'wrong-tag';
      subjectTagEl.textContent = q.subject;
      var times = document.createElement('span');
      times.className = 'wrong-times';
      times.textContent = '错 ' + entry.item.wrongCount + ' 次';
      tags.appendChild(gradeTagEl);
      tags.appendChild(subjectTagEl);
      tags.appendChild(times);

      var prompt = document.createElement('p');
      prompt.className = 'wrong-prompt';
      prompt.textContent = q.prompt;

      var answerLine = document.createElement('p');
      answerLine.className = 'wrong-answer';
      var wrongSpan = document.createElement('span');
      wrongSpan.className = 'wrong';
      wrongSpan.textContent = '你的答案：' + q.options[entry.item.lastSelected];
      var rightSpan = document.createElement('span');
      rightSpan.className = 'right';
      rightSpan.textContent = '　正确答案：' + q.options[q.answer];
      answerLine.appendChild(wrongSpan);
      answerLine.appendChild(rightSpan);

      var explain = document.createElement('p');
      explain.className = 'wrong-explain';
      explain.textContent = q.explanation;

      item.appendChild(tags);
      item.appendChild(prompt);
      item.appendChild(answerLine);
      item.appendChild(explain);
      fragment.appendChild(item);
    }
    wrongListEl.appendChild(fragment);
  }

  function render() {
    updateLevelChip();
    if (profileOpen) {
      renderProfile();
      return;
    }
    profileScreen.hidden = true;
    if (state.phase === 'setup') {
      renderSetup();
      return;
    }
    setupScreen.hidden = true;
    if (state.phase === 'result') {
      quizScreen.hidden = true;
      resultScreen.hidden = false;
      renderResult();
      return;
    }
    quizScreen.hidden = false;
    resultScreen.hidden = true;
    if (state.phase === 'summary') {
      renderSummary();
    } else {
      renderProgress();
      renderQuestion();
    }
  }

  function selectOption(index) {
    if (loading || state.phase !== 'question') {
      return;
    }
    state.selected = index;
    playSfx('tap');
    renderOptions(paper[state.answers.length], false, null);
    confirmBtn.disabled = false;
  }

  function confirmAnswer() {
    if (loading || state.phase !== 'question' || state.selected < 0) {
      return;
    }
    var question = paper[state.answers.length];
    var correct = state.selected === question.answer;
    state.answers.push({
      questionIndex: state.answers.length,
      selected: state.selected,
      correct: correct
    });
    recordProfileAnswer(question, state.selected, correct);
    playSfx(correct ? 'correct' : 'wrong');
    state.phase = 'feedback';
    saveNow();
    render();
  }

  function nextQuestion() {
    if (loading || state.phase !== 'feedback') {
      return;
    }
    if (state.answers.length >= paper.length) {
      state.phase = 'summary';
      state.selected = -1;
      saveNow();
      render();
      return;
    }
    state.phase = 'question';
    state.selected = -1;
    saveNow();
    render();
  }

  function continueFromSummary() {
    if (loading || state.phase !== 'summary') {
      return;
    }
    completeResult();
  }

  function completeResult() {
    var examPassed = state.mode === 'exam' && Engine.isPass(totalCorrect(), paper.length);
    if (!state.completed) {
      var profile = state.profile || emptyProfile();
      state.profile = profile;
      if (state.mode === 'exam') {
        profile.examAttempts += 1;
        if (examPassed) {
          profile.examPasses += 1;
          if (state.level < 6) {
            state.level += 1;
          } else {
            state.graduated = true;
          }
        }
      } else {
        profile.practiceSets += 1;
      }
      state.completed = true;
    }
    state.phase = 'result';
    saveNow();
    render();
    window.setTimeout(function () {
      if (state.mode === 'exam') {
        if (examPassed) {
          playSfx('levelUp');
        }
      } else {
        playSfx('complete');
      }
    }, 180);
  }

  function startPractice() {
    playSfx('tap');
    normalizeSetup();
    var grade = clamp(setup.grade, 1, state.level);
    var seed = Engine.createSeed();
    var mode = 'practice';
    state = {
      v: 3,
      phase: 'question',
      mode: mode,
      subject: setup.subject,
      grade: grade,
      range: setup.range,
      seed: seed,
      answers: [],
      selected: -1,
      level: state.level,
      graduated: state.graduated,
      completed: false,
      profile: state.profile || emptyProfile(),
      settings: state.settings || defaultSettings()
    };
    paper = buildPaperFor(mode, state.subject, grade, state.range, seed);
    saveNow();
    render();
  }

  function startExam() {
    playSfx('tap');
    var seed = Engine.createSeed();
    var mode = 'exam';
    state = {
      v: 3,
      phase: 'question',
      mode: mode,
      subject: '综合',
      grade: state.level,
      range: 'same',
      seed: seed,
      answers: [],
      selected: -1,
      level: state.level,
      graduated: state.graduated,
      completed: false,
      profile: state.profile || emptyProfile(),
      settings: state.settings || defaultSettings()
    };
    paper = buildPaperFor(mode, state.subject, state.grade, 'same', seed);
    saveNow();
    render();
  }

  function goSetup(confirmNeeded) {
    if (confirmNeeded && state.answers && state.answers.length > 0 &&
        !window.confirm('返回选择页？当前进度会被清除。')) {
      return;
    }
    var targetGrade = state.mode === 'exam' ? state.level : (state.grade || state.level);
    var targetSubject = state.mode === 'exam' ? '综合' : (state.subject || '综合');
    setup = {
      mode: 'practice',
      subject: targetSubject,
      grade: clamp(targetGrade, 1, state.level),
      range: 'lower'
    };
    state.phase = 'setup';
    state.mode = 'practice';
    state.subject = setup.subject;
    state.grade = setup.grade;
    state.range = setup.range;
    state.answers = [];
    state.selected = -1;
    state.completed = false;
    paper = [];
    saveNow();
    render();
  }

  function buildState() {
    var answers = [];
    for (var i = 0; i < state.answers.length; i += 1) {
      answers.push({
        questionIndex: state.answers[i].questionIndex,
        selected: state.answers[i].selected
      });
    }
    return {
      v: 3,
      phase: state.phase,
      mode: state.mode,
      subject: state.subject,
      grade: state.grade,
      range: state.range,
      seed: state.seed,
      answers: answers,
      selected: state.phase === 'feedback' && state.answers.length ?
        state.answers[state.answers.length - 1].selected : -1,
      level: state.level,
      graduated: state.graduated,
      completed: state.completed,
      profile: state.profile || emptyProfile(),
      settings: state.settings || defaultSettings()
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
    if (!data || data.v !== 3) {
      return null;
    }
    var level = 1;
    if (typeof data.level === 'number' && isFinite(data.level) &&
        data.level >= 1 && data.level <= 6) {
      level = Math.floor(data.level);
    }
    var phase = data.phase;
    if (phase !== 'setup' && phase !== 'question' && phase !== 'feedback' &&
        phase !== 'summary' && phase !== 'result') {
      phase = 'question';
    }
    if (phase === 'setup') {
      var setupMode = data.mode === 'exam' ? 'exam' : 'practice';
      var setupSubject = SUBJECTS_ALL.indexOf(data.subject) === -1 ? '综合' : data.subject;
      var setupGrade = clamp(Math.floor(data.grade || level), 1, level);
      return {
        v: 3,
        phase: 'setup',
        mode: setupMode,
        subject: setupSubject,
        grade: setupGrade,
        range: normalizeRange(data.range !== undefined ? data.range : (data.includeLower === false ? 'same' : 'lower')),
        seed: 0,
        answers: [],
        level: level,
        graduated: !!data.graduated,
        completed: false,
        profile: normalizeProfile(data.profile),
        settings: normalizeSettings(data.settings)
      };
    }

    var mode = data.mode === 'exam' ? 'exam' : 'practice';
    var subject = SUBJECTS_ALL.indexOf(data.subject) === -1 ? '综合' : data.subject;
    var grade = Math.floor(data.grade || level);
    if (grade < 1 || grade > 6) {
      return null;
    }
    if (mode === 'practice' && grade > level) {
      grade = level;
    }
    if (mode === 'exam') {
      subject = '综合';
      if (grade < 1 || grade > 6) {
        grade = level;
      }
    }
    if (typeof data.seed !== 'number' || !isFinite(data.seed)) {
      return null;
    }
    if (!data.answers || typeof data.answers.length !== 'number') {
      return null;
    }
    var answers = [];
    for (var i = 0; i < data.answers.length; i += 1) {
      var item = data.answers[i];
      if (!item || item.questionIndex !== i ||
          typeof item.selected !== 'number' || item.selected < 0 || item.selected > 3) {
        return null;
      }
      answers.push({ questionIndex: i, selected: item.selected });
    }
    return {
      v: 3,
      phase: phase,
      mode: mode,
      subject: subject,
      grade: grade,
      range: normalizeRange(data.range !== undefined ? data.range : (data.includeLower === false ? 'same' : 'lower')),
      seed: Math.floor(data.seed),
      answers: answers,
      level: level,
      graduated: !!data.graduated,
      completed: !!data.completed,
      profile: normalizeProfile(data.profile),
      settings: normalizeSettings(data.settings)
    };
  }

  function restoreState(saved) {
    state = saved;
    if (saved.phase === 'setup') {
      setup = {
        mode: saved.mode,
        subject: saved.subject,
        grade: clamp(saved.grade, 1, saved.level),
        range: normalizeRange(saved.range)
      };
      state.phase = 'setup';
      render();
      return;
    }

    paper = buildPaperFor(saved.mode, saved.subject, saved.grade, saved.range, saved.seed);
    var answers = [];
    for (var i = 0; i < saved.answers.length && i < paper.length; i += 1) {
      answers.push({
        questionIndex: i,
        selected: saved.answers[i].selected,
        correct: saved.answers[i].selected === paper[i].answer
      });
    }
    state.answers = answers;

    if (answers.length >= paper.length || saved.completed || saved.phase === 'result') {
      state.phase = 'result';
      state.completed = true;
    } else if (saved.phase === 'summary' && answers.length > 0 &&
               answers.length === paper.length) {
      state.phase = 'summary';
    } else if (saved.phase === 'feedback' && answers.length > 0) {
      state.phase = 'feedback';
      state.selected = answers[answers.length - 1].selected;
    } else {
      state.phase = 'question';
      state.selected = -1;
    }
    render();
    setSaveStatus('saved');
  }

  function loadState() {
    if (!canStorage()) {
      state = {
        v: 3, phase: 'setup', mode: 'practice', subject: '综合', grade: 1,
        range: 'lower', seed: 0, answers: [], selected: -1, level: 1,
        graduated: false, completed: false, profile: emptyProfile(),
        settings: defaultSettings()
      };
      setup = { mode: 'practice', subject: '综合', grade: 1, range: 'lower' };
      render();
      setSaveStatus('unsupported');
      return;
    }
    var token = loadToken + 1;
    loadToken = token;
    loading = true;
    startBtn.disabled = true;
    setSaveStatus('loading');

    var timeout = window.setTimeout(function () {
      if (token !== loadToken) {
        return;
      }
      loadToken = token + 1;
      loading = false;
      state.phase = 'setup';
      render();
      setSaveStatus('load-error');
    }, 3000);

    apiCall('getStorage', { key: STORAGE_KEY }).then(function (result) {
      if (token !== loadToken) {
        return;
      }
      window.clearTimeout(timeout);
      loading = false;
      var saved = parseSavedState(result && result.data);
      if (saved) {
        restoreState(saved);
      } else {
        setup = { mode: 'practice', subject: '综合', grade: state.level, range: 'lower' };
        state.phase = 'setup';
        render();
        setSaveStatus('idle');
      }
    }).catch(function () {
      if (token !== loadToken) {
        return;
      }
      window.clearTimeout(timeout);
      loading = false;
      state.phase = 'setup';
      render();
      setSaveStatus('idle');
    });
  }

  function resultInfo() {
    var total = paper.length;
    var correct = totalCorrect();
    var passed = Engine.isPass(correct, total);
    if (state.mode === 'practice') {
      return {
        mode: 'practice',
        grade: state.grade,
        subject: state.subject,
        correct: correct,
        total: total,
        completed: state.answers.length,
        passed: passed,
        title: (state.range === 'olympiad' ?
          (state.subject === '综合' ? '奥赛' : state.subject + '奥赛') :
          (state.subject === '综合' ? '综合' : state.subject) + '练习') +
          ' · ' + correct + '/' + total
      };
    }
    var title;
    if (passed) {
      title = state.graduated ? '毕业考试通过' : '升级成功，解锁' + levelName();
    } else {
      title = '升级考试未通过';
    }
    return {
      mode: 'exam',
      grade: state.level,
      subject: '综合',
      correct: correct,
      total: total,
      completed: state.answers.length,
      passed: passed,
      title: title
    };
  }

  function renderBreakdown(info) {
    resultBreakdownEl.textContent = '';
    resultBreakdownEl.hidden = false;
    var fragment = document.createDocumentFragment();
    if (info.mode === 'exam') {
      for (var i = 0; i < state.answers.length; i += 1) {
        var question = paper[i];
        var item = document.createElement('span');
        item.className = 'break-item ' + (state.answers[i].correct ? 'is-pass' : 'is-fail');
        item.textContent = question.subject;
        fragment.appendChild(item);
      }
    } else {
      for (var j = 0; j < state.answers.length; j += 1) {
        var item2 = document.createElement('span');
        item2.className = 'break-item ' + (state.answers[j].correct ? 'is-pass' : 'is-fail');
        item2.textContent = String(j + 1);
        fragment.appendChild(item2);
      }
    }
    resultBreakdownEl.appendChild(fragment);
  }

  function renderReview() {
    var wrong = [];
    for (var i = 0; i < state.answers.length; i += 1) {
      if (!state.answers[i].correct) {
        wrong.push(state.answers[i]);
      }
    }
    reviewListEl.textContent = '';
    if (!wrong.length) {
      var empty = document.createElement('p');
      empty.className = 'review-empty';
      empty.textContent = '全部答对，太强了。';
      reviewListEl.appendChild(empty);
      return;
    }
    var fragment = document.createDocumentFragment();
    for (var j = 0; j < wrong.length; j += 1) {
      var answer = wrong[j];
      var question = paper[answer.questionIndex];
      var item = document.createElement('div');
      item.className = 'review-item';

      var prompt = document.createElement('p');
      prompt.className = 'review-prompt';
      prompt.textContent = question.prompt;

      var answerLine = document.createElement('p');
      answerLine.className = 'review-answer';
      var wrongSpan = document.createElement('span');
      wrongSpan.className = 'wrong';
      wrongSpan.textContent = '你的答案：' + question.options[answer.selected];
      var rightSpan = document.createElement('span');
      rightSpan.className = 'right';
      rightSpan.textContent = '　正确答案：' + question.options[question.answer];
      answerLine.appendChild(wrongSpan);
      answerLine.appendChild(rightSpan);

      var explain = document.createElement('p');
      explain.className = 'review-explain';
      explain.textContent = question.explanation;

      item.appendChild(prompt);
      item.appendChild(answerLine);
      item.appendChild(explain);
      fragment.appendChild(item);
    }
    reviewListEl.appendChild(fragment);
  }

  function renderResult() {
    var info = resultInfo();
    resultKicker.textContent = info.mode === 'exam' ? '升级考试' : '练习完成';
    resultGradeEl.textContent = Engine.gradeName(info.grade);
    resultGradeEl.className = 'result-grade';
    resultTitleEl.textContent = info.title;
    resultSubEl.textContent = '答对 ' + info.correct + ' / ' + info.total;

    gradeLadderEl.hidden = true;
    gradeLadderEl.textContent = '';
    renderBreakdown(info);
    renderReview();

    var canSave = !!getMiniTool() && typeof getMiniTool().saveImageToPhotosAlbum === 'function';
    var canShare = !!getMiniTool() && typeof getMiniTool().share === 'function';
    var canPost = !!getMiniTool() && typeof getMiniTool().postNote === 'function';
    saveCardBtn.hidden = !canSave;
    shareCardBtn.hidden = !canShare;
    postNoteBtn.hidden = !canPost;
    if (!canSave && !canShare && !canPost) {
      setShareStatus('当前版本不支持直接保存、分享或发布笔记，可截图结果页。', false);
    } else {
      setShareStatus('', false);
    }

    shareDataUrl = generateShareCard(info);
    if (shareDataUrl) {
      sharePreview.src = shareDataUrl;
      sharePreview.hidden = false;
    } else {
      sharePreview.hidden = true;
      setShareStatus('当前环境无法生成分享卡，可截图结果页。', true);
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

  function todayLabel() {
    var date = new Date();
    var month = date.getMonth() + 1;
    var day = date.getDate();
    return date.getFullYear() + '.' + (month < 10 ? '0' : '') + month + '.' +
      (day < 10 ? '0' : '') + day;
  }

  function generateShareCard(info) {
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
    background.addColorStop(0, '#f7fbff');
    background.addColorStop(0.55, '#ffffff');
    background.addColorStop(1, '#fff2df');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, 900, 1200);

    ctx.fillStyle = 'rgba(79, 142, 247, 0.10)';
    ctx.beginPath();
    ctx.arc(830, 100, 250, 0, Math.PI * 2, false);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 107, 107, 0.10)';
    ctx.beginPath();
    ctx.arc(50, 1150, 250, 0, Math.PI * 2, false);
    ctx.fill();

    ctx.fillStyle = '#4f8ef7';
    roundedRect(ctx, 70, 70, 74, 74, 18);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 42px "Noto Sans CJK SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('小', 107, 124);
    ctx.textAlign = 'left';

    ctx.fillStyle = '#1f2c44';
    ctx.font = '800 52px "Noto Sans CJK SC", sans-serif';
    ctx.fillText('小学回忆杀', 168, 126);

    ctx.fillStyle = '#7b88a1';
    ctx.font = '23px "Noto Sans CJK SC", sans-serif';
    ctx.fillText('先练习，再考试，一关一关往上解锁', 170, 166);

    ctx.textAlign = 'right';
    ctx.font = '22px "Noto Sans CJK SC", sans-serif';
    ctx.fillText(todayLabel(), 830, 104);
    ctx.textAlign = 'left';

    ctx.fillStyle = '#4f8ef7';
    ctx.font = '800 110px "Noto Sans CJK SC", sans-serif';
    ctx.fillText(Engine.gradeName(info.grade), 70, 350);

    ctx.fillStyle = '#1f2c44';
    ctx.font = '800 38px "Noto Sans CJK SC", sans-serif';
    ctx.fillText(info.title, 72, 420);

    ctx.fillStyle = '#7b88a1';
    ctx.font = '27px "Noto Sans CJK SC", sans-serif';
    ctx.fillText('答对 ' + info.correct + ' / ' + info.total, 72, 476);

    if (info.mode === 'exam') {
      var subjects = ['语文', '数学', '英语', '科学'];
      for (var s = 0; s < 4; s += 1) {
        var cx = 150 + s * 200;
        var answer = state.answers[s];
        ctx.fillStyle = answer && answer.correct ? '#22b573' : '#ff6b6b';
        ctx.beginPath();
        ctx.arc(cx, 620, 58, 0, Math.PI * 2, false);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = '800 30px "Noto Sans CJK SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(subjects[s], cx, 632);
        ctx.textAlign = 'left';
      }
    } else {
      var total = state.answers.length;
      var rowCount = Math.ceil(total / 5);
      for (var i = 0; i < total; i += 1) {
        var row = Math.floor(i / 5);
        var col = i % 5;
        var inRow = Math.min(5, total - row * 5);
        var x = 450 - (inRow - 1) * 42 + col * 84;
        var y = 600 + row * 88;
        ctx.fillStyle = state.answers[i].correct ? '#22b573' : '#ff6b6b';
        ctx.beginPath();
        ctx.arc(x, y, 25, 0, Math.PI * 2, false);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = '800 19px "Noto Sans CJK SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(i + 1), x, y + 7);
        ctx.textAlign = 'left';
      }
    }

    ctx.fillStyle = '#9aa9c2';
    ctx.font = '22px "Noto Sans CJK SC", sans-serif';
    ctx.fillText('小学回忆杀 · 综合题库', 70, 1148);

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
    if (!getMiniTool() || typeof getMiniTool().postNote !== 'function') {
      setShareStatus('当前版本不支持发布笔记，请先保存图片。', true);
      return;
    }
    var info = resultInfo();
    var examLabel = state.graduated ? '毕业考试' : Engine.gradeName(state.grade) + '升级考试';
    var practiceLabel = Engine.gradeName(info.grade) +
      (info.subject === '综合' ? '' : info.subject) +
      (state.range === 'olympiad' ? '奥赛练习' : '练习');
    var label = info.mode === 'exam' ? examLabel : practiceLabel;
    var scoreText = '答对 ' + info.correct + ' / ' + info.total;
    var title = info.mode === 'exam' ?
      (info.passed ? (state.graduated ? '我的小学回忆杀：毕业啦' : '我的小学回忆杀：升级到' + levelName()) :
        '我的小学回忆杀：升级未通过') :
      '我的小学回忆杀：' + Engine.gradeName(info.grade) +
        (state.range === 'olympiad' ? '奥赛' : '练习');
    var content = '我在「小学回忆杀」完成了' + label + '，' + scoreText +
      '。先练习再考试，看看你能解锁到几年级？';

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

  function bindEvents() {
    modeTabs.addEventListener('click', function (event) {
      var node = event.target;
      while (node && node !== modeTabs) {
        if (node.nodeType === 1 && node.getAttribute && node.getAttribute('data-mode')) {
          setup.mode = node.getAttribute('data-mode');
          renderSetup();
          return;
        }
        node = node.parentNode;
      }
    });

    subjectChips.addEventListener('click', function (event) {
      var node = event.target;
      while (node && node !== subjectChips) {
        if (node.nodeType === 1 && node.getAttribute && node.getAttribute('data-subject')) {
          setup.subject = node.getAttribute('data-subject');
          renderSetup();
          return;
        }
        node = node.parentNode;
      }
    });

    gradeChips.addEventListener('click', function (event) {
      var node = event.target;
      while (node && node !== gradeChips) {
        if (node.nodeType === 1 && node.getAttribute && node.getAttribute('data-grade')) {
          var grade = Number(node.getAttribute('data-grade'));
          if (grade > state.level) {
            return;
          }
          setup.grade = grade;
          renderSetup();
          return;
        }
        node = node.parentNode;
      }
    });

    rangeChips.addEventListener('click', function (event) {
      var node = event.target;
      while (node && node !== rangeChips) {
        if (node.nodeType === 1 && node.getAttribute && node.getAttribute('data-range')) {
          setup.range = normalizeRange(node.getAttribute('data-range'));
          renderSetup();
          return;
        }
        node = node.parentNode;
      }
    });

    startBtn.addEventListener('click', function () {
      if (setup.mode === 'exam') {
        startExam();
      } else {
        startPractice();
      }
    });

    optionsEl.addEventListener('click', function (event) {
      var node = event.target;
      while (node && node !== optionsEl) {
        if (node.nodeType === 1 && node.getAttribute && node.getAttribute('data-option') !== null) {
          selectOption(Number(node.getAttribute('data-option')));
          return;
        }
        node = node.parentNode;
      }
    });
    confirmBtn.addEventListener('click', confirmAnswer);
    nextBtn.addEventListener('click', nextQuestion);
    summaryBtn.addEventListener('click', continueFromSummary);
    saveCardBtn.addEventListener('click', saveCard);
    shareCardBtn.addEventListener('click', shareCard);
    postNoteBtn.addEventListener('click', publishNote);
    retryBtn.addEventListener('click', function () {
      if (state.mode === 'exam') {
        startExam();
      } else {
        setup = {
          mode: 'practice',
          subject: state.subject,
          grade: state.grade,
          range: state.range
        };
        startPractice();
      }
    });
    changeSetupBtn.addEventListener('click', function () {
      goSetup(false);
    });
    restartBtn.addEventListener('click', function () {
      goSetup(state.answers.length > 0);
    });
    openProfileBtn.addEventListener('click', function () {
      profileOpen = true;
      renderProfile();
    });
    openProfileBanner.addEventListener('click', function () {
      profileOpen = true;
      renderProfile();
    });
    toggleSfxBtn.addEventListener('click', function () {
      var settings = state.settings || defaultSettings();
      settings.sfx = !settings.sfx;
      state.settings = settings;
      if (settings.sfx) {
        playSfx('tap');
      }
      saveNow();
      renderProfile();
    });
    toggleBgmBtn.addEventListener('click', function () {
      var settings = state.settings || defaultSettings();
      settings.bgm = !settings.bgm;
      state.settings = settings;
      if (settings.bgm) {
        unlockAudio();
        startBgm();
      } else {
        stopBgm();
      }
      if (settings.sfx) {
        playSfx('tap');
      }
      saveNow();
      renderProfile();
    });

    function unlockOnGesture() {
      var settings = state.settings || defaultSettings();
      if (!settings.sfx && !settings.bgm) {
        return;
      }
      var ctx = unlockAudio();
      if (ctx && settings.bgm) {
        startBgm();
      }
    }
    document.addEventListener('pointerdown', unlockOnGesture, { once: true });
    document.addEventListener('keydown', unlockOnGesture, { once: true });
    profileBackBtn.addEventListener('click', function () {
      profileOpen = false;
      render();
    });

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
        if (canStorage() && !loading) {
          pendingSave = buildState();
          flushSave();
        }
      } else if ((state.settings || defaultSettings()).bgm && audioState.unlocked) {
        startBgm();
      }
    });
  }

  function init() {
    if (!Data || !Engine || !Data.length) {
      setupHint.textContent = '题库加载失败，请退出后重新打开。';
      startBtn.disabled = true;
      setSaveStatus('error');
      return;
    }
    bindEvents();
    updateLevelChip();
    loadState();
  }

  init();
}());
