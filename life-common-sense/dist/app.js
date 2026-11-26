/* 生活常识小考 · 界面逻辑 */
(function () {
  'use strict';

  var Data = window.LIFE_QUIZ_DATA;
  var Engine = window.LifeQuizEngine;
  if (!Data || !Engine) return;

  var Meta = Data.meta;
  var Questions = Data.questions;
  var KEY = 'lifequiz.v1.state';
  var catMap = {};
  for (var c = 0; c < Meta.categories.length; c += 1) {
    catMap[Meta.categories[c].id] = Meta.categories[c];
  }

  var state = {
    screen: 'home',
    mode: 'practice',
    category: 'all',
    selectedCategory: 'all',
    paper: [],
    answers: [],
    index: 0,
    answered: false,
    correct: 0,
    result: null,
    storageReady: false,
    profile: {
      totalAnswers: 0,
      totalCorrect: 0,
      practiceSets: 0,
      challengeAttempts: 0,
      challengePasses: 0
    },
    wrongBook: {}
  };

  var els = {
    home: document.getElementById('home-screen'),
    quiz: document.getElementById('quiz-screen'),
    result: document.getElementById('result-screen'),
    wrong: document.getElementById('wrong-screen'),
    statAnswers: document.getElementById('stat-answers'),
    statAccuracy: document.getElementById('stat-accuracy'),
    statSets: document.getElementById('stat-sets'),
    statWrong: document.getElementById('stat-wrong'),
    categoryList: document.getElementById('category-list'),
    startPractice: document.getElementById('start-practice'),
    selectedCategoryInfo: document.getElementById('selected-category-info'),
    startChallenge: document.getElementById('start-challenge'),
    openWrong: document.getElementById('open-wrong'),
    wrongCountHome: document.getElementById('wrong-count-home'),
    storageNote: document.getElementById('storage-note'),
    quizBack: document.getElementById('quiz-back'),
    quizProgressText: document.getElementById('quiz-progress-text'),
    quizProgressBar: document.getElementById('quiz-progress-bar'),
    quizCategory: document.getElementById('quiz-category'),
    quizMode: document.getElementById('quiz-mode'),
    questionPrompt: document.getElementById('question-prompt'),
    options: document.getElementById('options'),
    feedback: document.getElementById('feedback'),
    feedbackTitle: document.getElementById('feedback-title'),
    feedbackExplain: document.getElementById('feedback-explain'),
    nextBtn: document.getElementById('next-btn'),
    resultKicker: document.getElementById('result-kicker'),
    resultScore: document.getElementById('result-score'),
    resultTotal: document.getElementById('result-total'),
    resultTitle: document.getElementById('result-title'),
    resultSummary: document.getElementById('result-summary'),
    resultWrongList: document.getElementById('result-wrong-list'),
    resultWrongWrap: document.getElementById('result-wrong-wrap'),
    againBtn: document.getElementById('again-btn'),
    retryWrongBtn: document.getElementById('retry-wrong'),
    homeBtn: document.getElementById('result-home'),
    wrongBack: document.getElementById('wrong-back'),
    wrongTitleCount: document.getElementById('wrong-title-count'),
    wrongList: document.getElementById('wrong-list'),
    wrongStart: document.getElementById('wrong-start'),
    wrongEmpty: document.getElementById('wrong-empty'),
    disclaimer: document.getElementById('disclaimer')
  };

  /* ---------- 平台存储 ---------- */

  function miniTool() {
    return window.xhs && window.xhs.miniTool;
  }

  function getStorage(key) {
    return new Promise(function (resolve) {
      var mt = miniTool();
      if (!mt || typeof mt.getStorage !== 'function') {
        resolve(null);
        return;
      }
      var settled = false;
      mt.getStorage({
        key: key,
        success: function (res) {
          if (!settled) { settled = true; resolve(res && res.data); }
        },
        fail: function () {
          if (!settled) { settled = true; resolve(null); }
        }
      });
    });
  }

  function setStorage(key, data) {
    var mt = miniTool();
    if (!mt || typeof mt.setStorage !== 'function') return;
    try {
      mt.setStorage({ key: key, data: data, fail: function () {} });
    } catch (error) {
      /* 忽略保存失败 */
    }
  }

  function save() {
    if (!state.storageReady) return;
    setStorage(KEY, JSON.stringify({
      v: 1,
      profile: state.profile,
      wrongBook: state.wrongBook
    }));
  }

  function load() {
    var mt = miniTool();
    if (!mt || typeof mt.getStorage !== 'function') {
      state.storageReady = false;
      els.storageNote.hidden = false;
      return;
    }
    getStorage(KEY).then(function (raw) {
      state.storageReady = true;
      els.storageNote.hidden = true;
      if (typeof raw !== 'string' || !raw) return;
      try {
        var saved = JSON.parse(raw);
        if (saved && saved.v === 1) {
          var p = saved.profile || {};
          ['totalAnswers', 'totalCorrect', 'practiceSets', 'challengeAttempts', 'challengePasses']
            .forEach(function (field) {
              if (typeof p[field] === 'number') {
                state.profile[field] = Math.max(0, Math.floor(p[field]));
              }
            });
          if (saved.wrongBook && typeof saved.wrongBook === 'object') {
            state.wrongBook = saved.wrongBook;
          }
        }
      } catch (error) {
        /* 忽略损坏数据 */
      }
      renderHome();
    });
  }

  /* ---------- 通用 ---------- */

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function make(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function show(screen) {
    state.screen = screen;
    els.home.hidden = screen !== 'home';
    els.quiz.hidden = screen !== 'quiz';
    els.result.hidden = screen !== 'result';
    els.wrong.hidden = screen !== 'wrong';
    window.scrollTo(0, 0);
  }

  function accuracy() {
    return Engine.accuracy(state.profile.totalCorrect, state.profile.totalAnswers);
  }

  function wrongCount() {
    return Engine.wrongBookList(state.wrongBook, Questions).length;
  }

  function categoryBadge(id) {
    var cat = catMap[id];
    return cat ? cat.badge : '题';
  }

  function categoryName(id) {
    var cat = catMap[id];
    return cat ? cat.name : '综合';
  }

  function categoryClass(id) {
    return 'cat-' + id;
  }

  function progress() {
    var pct = state.paper.length ? Math.round((state.index + 1) / state.paper.length * 100) : 0;
    els.quizProgressText.textContent = '第 ' + (state.index + 1) + ' / ' + state.paper.length + ' 题';
    els.quizProgressBar.style.width = pct + '%';
  }

  /* ---------- 首页 ---------- */

  function makeCategoryChip(id, name) {
    var active = state.selectedCategory === id;
    var chip = make('button', 'chip-category ' +
      (id === 'all' ? 'cat-all' : categoryClass(id)) + (active ? ' is-active' : ''));
    chip.type = 'button';
    chip.setAttribute('data-category', id);
    chip.setAttribute('aria-pressed', active ? 'true' : 'false');
    chip.appendChild(make('span', 'cat-dot'));
    chip.appendChild(make('span', 'chip-label', name));
    return chip;
  }

  function updateSelectedCategory() {
    var id = state.selectedCategory;
    var counts = Engine.countByCategory(Questions, Meta.categories);
    var text;
    var startText;
    if (id === 'all') {
      text = '综合练习 · ' + Meta.categories.length + ' 类混合 · 每组 ' + Meta.practiceCount + ' 题';
      startText = '开始综合练习（' + Meta.practiceCount + ' 题）';
    } else {
      var cat = catMap[id];
      text = cat.name + ' · ' + counts[id] + ' 题 · ' + cat.desc;
      startText = '开始' + cat.name + '练习（' + Meta.practiceCount + ' 题）';
    }
    els.selectedCategoryInfo.textContent = text;
    els.startPractice.textContent = startText;
  }

  function renderHome() {
    els.statAnswers.textContent = state.profile.totalAnswers;
    els.statAccuracy.textContent = accuracy() + '%';
    els.statSets.textContent = state.profile.practiceSets + state.profile.challengeAttempts;
    els.statWrong.textContent = wrongCount();
    els.wrongCountHome.textContent = wrongCount();

    clear(els.categoryList);
    els.categoryList.appendChild(makeCategoryChip('all', '综合'));
    for (var i = 0; i < Meta.categories.length; i += 1) {
      var cat = Meta.categories[i];
      els.categoryList.appendChild(makeCategoryChip(cat.id, cat.name));
    }

    updateSelectedCategory();
    els.disclaimer.textContent = Meta.disclaimer;
    show('home');
  }

  /* ---------- 答题 ---------- */

  function startPractice(category) {
    state.mode = 'practice';
    state.category = category || 'all';
    state.paper = Engine.selectPractice(Questions, state.category, Meta.practiceCount, Engine.createSeed());
    state.answers = [];
    state.index = 0;
    state.answered = false;
    state.correct = 0;
    state.result = null;
    els.quizCategory.textContent = categoryName(state.category);
    els.quizCategory.className = 'quiz-tag ' + (state.category === 'all' ? 'cat-all' : categoryClass(state.category));
    els.quizMode.textContent = '分类练习';
    renderQuestion();
    show('quiz');
  }

  function startChallenge() {
    state.mode = 'challenge';
    state.category = 'all';
    state.paper = Engine.selectChallenge(Questions, Meta.categories, Meta.challengeCount, Engine.createSeed());
    state.answers = [];
    state.index = 0;
    state.answered = false;
    state.correct = 0;
    state.result = null;
    els.quizCategory.textContent = '综合';
    els.quizCategory.className = 'quiz-tag cat-all';
    els.quizMode.textContent = '综合挑战';
    renderQuestion();
    show('quiz');
  }

  function startWrongPractice() {
    var ids = [];
    for (var id in state.wrongBook) {
      if (Object.prototype.hasOwnProperty.call(state.wrongBook, id)) ids.push(id);
    }
    if (!ids.length) return;
    state.mode = 'wrong';
    state.category = 'all';
    state.paper = Engine.selectByIds(Questions, ids, Meta.challengeCount, Engine.createSeed());
    state.answers = [];
    state.index = 0;
    state.answered = false;
    state.correct = 0;
    state.result = null;
    els.quizCategory.textContent = '错题重练';
    els.quizCategory.className = 'quiz-tag cat-all';
    els.quizMode.textContent = '错题本';
    renderQuestion();
    show('quiz');
  }

  function renderQuestion() {
    var q = state.paper[state.index];
    if (!q) return;
    state.answered = false;
    progress();
    els.questionPrompt.textContent = q.prompt;
    clear(els.options);
    for (var i = 0; i < q.options.length; i += 1) {
      var btn = make('button', 'option');
      btn.type = 'button';
      btn.setAttribute('data-option', String(i));
      btn.appendChild(make('span', 'option-letter', String.fromCharCode(65 + i)));
      btn.appendChild(make('span', 'option-text', q.options[i]));
      els.options.appendChild(btn);
    }
    els.feedback.hidden = true;
    els.nextBtn.hidden = true;
    els.nextBtn.textContent = state.index + 1 >= state.paper.length ? '查看结果' : '下一题';
  }

  function answer(optionIndex) {
    if (state.answered) return;
    var q = state.paper[state.index];
    if (!q) return;
    state.answered = true;
    var correct = optionIndex === q.answer;
    state.answers[state.index] = optionIndex;
    if (correct) state.correct += 1;

    var buttons = els.options.querySelectorAll('.option');
    for (var i = 0; i < buttons.length; i += 1) {
      var idx = Number(buttons[i].getAttribute('data-option'));
      buttons[i].disabled = true;
      if (idx === q.answer) buttons[i].classList.add('is-correct');
      if (idx === optionIndex && !correct) buttons[i].classList.add('is-wrong');
    }

    els.feedback.hidden = false;
    els.feedback.className = 'feedback ' + (correct ? 'is-correct' : 'is-wrong');
    els.feedbackTitle.textContent = correct ? '答对了' : '答错了';
    els.feedbackExplain.textContent = q.explanation;
    els.nextBtn.hidden = false;
  }

  function nextQuestion() {
    if (!state.answered) return;
    if (state.index + 1 >= state.paper.length) {
      finish();
      return;
    }
    state.index += 1;
    renderQuestion();
    window.scrollTo(0, 0);
  }

  /* ---------- 结果 ---------- */

  function finish() {
    var result = Engine.grade(state.paper, state.answers);
    state.result = result;
    state.wrongBook = Engine.updateWrongBook(state.wrongBook, state.paper, state.answers);
    state.profile.totalAnswers += result.total;
    state.profile.totalCorrect += result.correct;

    var passed = false;
    if (state.mode === 'challenge') {
      state.profile.challengeAttempts += 1;
      passed = result.correct >= Meta.challengePass;
      if (passed) state.profile.challengePasses += 1;
    } else {
      state.profile.practiceSets += 1;
    }
    save();
    renderResult(passed);
    show('result');
  }

  function renderResult(passed) {
    var result = state.result;
    var isChallenge = state.mode === 'challenge';
    els.resultKicker.textContent = isChallenge ? '综合挑战完成' : (state.mode === 'wrong' ? '错题重练完成' : '练习完成');
    els.resultScore.textContent = result.correct;
    els.resultTotal.textContent = ' / ' + result.total;
    els.resultTitle.textContent = isChallenge
      ? (passed ? '挑战通过' : '差一点通过')
      : (result.correct === result.total ? '全对，漂亮' : '继续积累');
    els.resultSummary.textContent = '正确率 ' + result.accuracy + '%' +
      (isChallenge ? ' · 通过线 ' + Meta.challengePass + ' / ' + result.total : '');

    clear(els.resultWrongList);
    if (!result.wrong.length) {
      els.resultWrongWrap.hidden = true;
    } else {
      els.resultWrongWrap.hidden = false;
      for (var i = 0; i < result.wrong.length; i += 1) {
        var q = result.wrong[i];
        var item = make('div', 'wrong-item');
        var head = make('div', 'wrong-head');
        head.appendChild(make('span', 'wrong-badge ' + categoryClass(q.category), categoryBadge(q.category)));
        head.appendChild(make('span', 'wrong-cat', categoryName(q.category)));
        item.appendChild(head);
        item.appendChild(make('p', 'wrong-prompt', q.prompt));
        var paperIndex = state.paper.indexOf(q);
        if (paperIndex !== -1 && state.answers[paperIndex] != null) {
          item.appendChild(make('p', 'wrong-yours', '你的答案：' + q.options[state.answers[paperIndex]]));
        }
        item.appendChild(make('p', 'wrong-answer', '正确答案：' + q.options[q.answer]));
        item.appendChild(make('p', 'wrong-explain', q.explanation));
        els.resultWrongList.appendChild(item);
      }
    }

    if (state.mode === 'challenge') {
      els.againBtn.textContent = '再来一次挑战';
    } else if (state.mode === 'wrong') {
      els.againBtn.textContent = '再练一遍错题';
    } else {
      els.againBtn.textContent = '再练一组';
    }
    els.retryWrongBtn.hidden = wrongCount() === 0;
  }

  function again() {
    if (state.mode === 'challenge') startChallenge();
    else if (state.mode === 'wrong') startWrongPractice();
    else startPractice(state.category);
  }

  /* ---------- 错题本 ---------- */

  function renderWrongBook() {
    var list = Engine.wrongBookList(state.wrongBook, Questions);
    clear(els.wrongList);
    els.wrongTitleCount.textContent = list.length + ' 题';
    els.wrongEmpty.hidden = list.length > 0;
    els.wrongStart.hidden = list.length === 0;

    for (var i = 0; i < list.length; i += 1) {
      var q = list[i];
      var item = make('div', 'wrong-item');
      var head = make('div', 'wrong-head');
      head.appendChild(make('span', 'wrong-badge ' + categoryClass(q.category), categoryBadge(q.category)));
      head.appendChild(make('span', 'wrong-cat', categoryName(q.category)));
      var remove = make('button', 'wrong-remove', '移除');
      remove.type = 'button';
      remove.setAttribute('data-remove-id', q.id);
      head.appendChild(remove);
      item.appendChild(head);
      item.appendChild(make('p', 'wrong-prompt', q.prompt));
      item.appendChild(make('p', 'wrong-answer', '正确答案：' + q.options[q.answer]));
      item.appendChild(make('p', 'wrong-explain', q.explanation));
      els.wrongList.appendChild(item);
    }
    show('wrong');
  }

  function removeWrong(id) {
    if (state.wrongBook[id]) {
      delete state.wrongBook[id];
      save();
      renderWrongBook();
      renderHome();
    }
  }

  /* ---------- 事件 ---------- */

  function bind() {
    els.categoryList.addEventListener('click', function (event) {
      var chip = event.target.closest('[data-category]');
      if (!chip) return;
      state.selectedCategory = chip.getAttribute('data-category');
      var chips = els.categoryList.querySelectorAll('[data-category]');
      for (var i = 0; i < chips.length; i += 1) {
        var active = chips[i].getAttribute('data-category') === state.selectedCategory;
        chips[i].classList.toggle('is-active', active);
        chips[i].setAttribute('aria-pressed', active ? 'true' : 'false');
      }
      updateSelectedCategory();
    });

    els.startPractice.addEventListener('click', function () {
      startPractice(state.selectedCategory);
    });

    els.startChallenge.addEventListener('click', startChallenge);
    els.openWrong.addEventListener('click', renderWrongBook);
    els.wrongBack.addEventListener('click', renderHome);
    els.wrongStart.addEventListener('click', startWrongPractice);

    els.quizBack.addEventListener('click', function () {
      renderHome();
    });

    els.options.addEventListener('click', function (event) {
      var btn = event.target.closest('[data-option]');
      if (!btn) return;
      answer(Number(btn.getAttribute('data-option')));
    });

    els.nextBtn.addEventListener('click', nextQuestion);
    els.againBtn.addEventListener('click', again);
    els.retryWrongBtn.addEventListener('click', startWrongPractice);
    els.homeBtn.addEventListener('click', renderHome);

    els.wrongList.addEventListener('click', function (event) {
      var btn = event.target.closest('[data-remove-id]');
      if (!btn) return;
      removeWrong(btn.getAttribute('data-remove-id'));
    });
  }

  function boot() {
    bind();
    renderHome();
    load();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}());
