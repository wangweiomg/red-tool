/* 装修流程手册 · 交互
 * 流程清单、材料百科、空间攻略、预算估算、避坑自测。
 * ES2017 / Chrome 61 基线；数据全部离线。
 */
(function () {
  'use strict';

  var Data = window.RenovationData;
  var Engine = window.RenovationEngine;
  if (!Data || !Engine) return;

  var STORAGE_KEY = 'renovationguide.v1.state';
  var MAX_QUIZ = Data.quiz.length;

  var state = {
    tab: 'flow',
    houseType: 'new',
    done: [],
    budget: { area: '', tier: 'mid', old: false },
    quiz: { best: 0, last: 0 }
  };

  var quizState = {
    active: false,
    index: 0,
    answers: [],
    selected: -1,
    answered: false,
    review: []
  };

  var screenEls = {};
  var tabButtons = [];
  var stageListEl = document.getElementById('stage-list');
  var flowProgressText = document.getElementById('flow-progress-text');
  var flowProgressFill = document.getElementById('flow-progress-fill');
  var houseToggle = document.getElementById('house-toggle');
  var materialCatsEl = document.getElementById('material-cats');
  var materialListEl = document.getElementById('material-list');
  var spaceListEl = document.getElementById('space-list');
  var budgetAreaEl = document.getElementById('budget-area');
  var budgetTiersEl = document.getElementById('budget-tiers');
  var budgetOldEl = document.getElementById('budget-old');
  var budgetResultEl = document.getElementById('budget-result');
  var budgetTotalEl = document.getElementById('budget-total');
  var budgetSubEl = document.getElementById('budget-sub');
  var budgetItemsEl = document.getElementById('budget-items');
  var quizStartEl = document.getElementById('quiz-start');
  var quizPlayEl = document.getElementById('quiz-play');
  var quizResultEl = document.getElementById('quiz-result');
  var quizBestEl = document.getElementById('quiz-best');
  var quizProgressEl = document.getElementById('quiz-progress');
  var quizScoreLiveEl = document.getElementById('quiz-score-live');
  var quizQuestionEl = document.getElementById('quiz-question');
  var quizOptionsEl = document.getElementById('quiz-options');
  var quizExplainEl = document.getElementById('quiz-explain');
  var quizConfirmBtn = document.getElementById('quiz-confirm');
  var quizNextBtn = document.getElementById('quiz-next');
  var quizResultScoreEl = document.getElementById('quiz-result-score');
  var quizResultTitleEl = document.getElementById('quiz-result-title');
  var quizResultBestEl = document.getElementById('quiz-result-best');
  var quizReviewEl = document.getElementById('quiz-review');
  var quizCardEl = document.getElementById('quiz-card');
  var quizShareStatusEl = document.getElementById('quiz-share-status');
  var materialModal = document.getElementById('material-modal');
  var materialMask = document.getElementById('material-mask');
  var materialClose = document.getElementById('material-close');
  var materialNameEl = document.getElementById('material-name');
  var materialCatEl = document.getElementById('material-cat');
  var materialPriceEl = document.getElementById('material-price');
  var materialSpecsEl = document.getElementById('material-specs');
  var materialTipsEl = document.getElementById('material-tips');
  var materialPitfallsEl = document.getElementById('material-pitfalls');

  var materialCat = 'wall';
  var cardDataUrl = '';
  var shareBusy = false;
  var saveTimer = 0;

  ['flow', 'materials', 'spaces', 'budget', 'quiz'].forEach(function (name) {
    screenEls[name] = document.getElementById(name + '-screen');
  });
  tabButtons = Array.prototype.slice.call(document.querySelectorAll('[data-tab]'));

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

  function buildSave() {
    return {
      v: 1,
      tab: state.tab,
      houseType: state.houseType,
      done: state.done,
      budget: state.budget,
      quiz: state.quiz
    };
  }

  function saveNow() {
    if (!canStorage()) return;
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = 0;
    }
    saveTimer = setTimeout(function () {
      saveTimer = 0;
      apiCall('setStorage', {
        key: STORAGE_KEY,
        data: JSON.stringify(buildSave())
      }).catch(function () {});
    }, 200);
  }

  function sanitizeSave(raw) {
    if (!raw || raw.v !== 1) return;
    if (raw.tab && screenEls[raw.tab]) state.tab = raw.tab;
    state.houseType = raw.houseType === 'old' ? 'old' : 'new';
    if (Array.isArray(raw.done)) {
      var done = [];
      for (var i = 0; i < raw.done.length; i += 1) {
        for (var j = 0; j < Data.stages.length; j += 1) {
          if (Data.stages[j].id === raw.done[i] && done.indexOf(raw.done[i]) === -1) {
            done.push(raw.done[i]);
          }
        }
      }
      state.done = done;
    }
    if (raw.budget && typeof raw.budget === 'object') {
      var area = raw.budget.area;
      if (typeof area === 'number' && isFinite(area) && area >= 10 && area <= 1000) {
        state.budget.area = String(area);
      } else if (typeof area === 'string' && area) {
        state.budget.area = area;
      }
      for (var k = 0; k < Data.budgetTiers.length; k += 1) {
        if (Data.budgetTiers[k].id === raw.budget.tier) state.budget.tier = raw.budget.tier;
      }
      state.budget.old = !!raw.budget.old;
    }
    if (raw.quiz && typeof raw.quiz === 'object') {
      if (typeof raw.quiz.best === 'number' && isFinite(raw.quiz.best)) {
        state.quiz.best = Math.max(0, Math.min(MAX_QUIZ, Math.floor(raw.quiz.best)));
      }
      if (typeof raw.quiz.last === 'number' && isFinite(raw.quiz.last)) {
        state.quiz.last = Math.max(0, Math.min(MAX_QUIZ, Math.floor(raw.quiz.last)));
      }
    }
  }

  function loadSaved() {
    if (!canStorage()) return;
    apiCall('getStorage', { key: STORAGE_KEY }).then(function (result) {
      var raw = result && result.data;
      if (typeof raw !== 'string' || !raw) return;
      try {
        sanitizeSave(JSON.parse(raw));
      } catch (error) {
        /* 忽略损坏数据 */
      }
      renderAll();
    }).catch(function () {});
  }

  /* ---------- 通用渲染 ---------- */

  function setTab(tab) {
    if (!screenEls[tab]) return;
    state.tab = tab;
    for (var i = 0; i < tabButtons.length; i += 1) {
      var active = tabButtons[i].getAttribute('data-tab') === tab;
      tabButtons[i].className = active ? 'tab is-active' : 'tab';
      tabButtons[i].setAttribute('aria-selected', active ? 'true' : 'false');
    }
    for (var name in screenEls) {
      if (Object.prototype.hasOwnProperty.call(screenEls, name)) {
        screenEls[name].hidden = name !== tab;
      }
    }
    if (tab === 'budget') renderBudgetForm();
    if (tab === 'quiz') renderQuizStart();
    window.scrollTo(0, 0);
    saveNow();
  }

  function renderAll() {
    renderFlow();
    renderMaterials();
    renderSpaces();
    renderBudgetForm();
    renderQuizStart();
    setTab(state.tab);
  }

  /* ---------- 流程 ---------- */

  function renderFlow() {
    for (var i = 0; i < houseToggle.children.length; i += 1) {
      var btn = houseToggle.children[i];
      var active = btn.getAttribute('data-house') === state.houseType;
      btn.className = active ? 'house-btn is-active' : 'house-btn';
    }

    var progress = Engine.stageProgress(Data.stages.length, state.done);
    flowProgressText.textContent = '已完成 ' + progress.done + ' / ' + progress.total;
    flowProgressFill.style.width = progress.percent + '%';

    stageListEl.textContent = '';
    for (var j = 0; j < Data.stages.length; j += 1) {
      (function (stage, index) {
        var done = state.done.indexOf(stage.id) !== -1;
        var card = document.createElement('article');
        card.className = done ? 'stage-card is-done' : 'stage-card';

        var head = document.createElement('div');
        head.className = 'stage-head';

        var num = document.createElement('span');
        num.className = 'stage-index';
        num.textContent = (index + 1 < 10 ? '0' : '') + (index + 1);

        var title = document.createElement('div');
        title.className = 'stage-title';
        var strong = document.createElement('strong');
        strong.textContent = stage.name;
        var meta = document.createElement('span');
        meta.textContent = stage.duration + ' · ' + stage.who;
        title.appendChild(strong);
        title.appendChild(meta);

        var check = document.createElement('button');
        check.type = 'button';
        check.className = 'stage-check';
        check.textContent = done ? '已完成' : '标记完成';
        check.addEventListener('click', function () {
          if (state.done.indexOf(stage.id) === -1) {
            state.done.push(stage.id);
          } else {
            state.done = state.done.filter(function (id) { return id !== stage.id; });
          }
          renderFlow();
          saveNow();
        });

        head.appendChild(num);
        head.appendChild(title);
        head.appendChild(check);

        var details = document.createElement('details');
        details.className = 'stage-details';
        var summary = document.createElement('summary');
        summary.textContent = '看要点';
        details.appendChild(summary);

        var goal = document.createElement('p');
        goal.className = 'stage-goal';
        goal.textContent = stage.goal;
        details.appendChild(goal);

        details.appendChild(makeListBlock('要做的事', stage.actions));
        details.appendChild(makeListBlock('验收点', stage.acceptance));
        details.appendChild(makeListBlock('常见坑', stage.pitfalls));
        if (state.houseType === 'old') {
          var oldNote = document.createElement('p');
          oldNote.className = 'old-note';
          oldNote.textContent = '老房注意：' + stage.oldHouse;
          details.appendChild(oldNote);
        }

        card.appendChild(head);
        card.appendChild(details);
        stageListEl.appendChild(card);
      }(Data.stages[j], j));
    }
  }

  function makeListBlock(title, items) {
    var wrap = document.createElement('div');
    var h = document.createElement('h4');
    h.textContent = title;
    var ul = document.createElement('ul');
    for (var i = 0; i < items.length; i += 1) {
      var li = document.createElement('li');
      li.textContent = items[i];
      ul.appendChild(li);
    }
    wrap.appendChild(h);
    wrap.appendChild(ul);
    return wrap;
  }

  /* ---------- 材料 ---------- */

  function formatPrice(price) {
    return '¥' + price.low + '–' + price.high + '/' + price.unit;
  }

  function renderMaterials() {
    materialCatsEl.textContent = '';
    for (var i = 0; i < Data.materialCategories.length; i += 1) {
      var cat = Data.materialCategories[i];
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip' + (materialCat === cat.id ? ' is-active' : '');
      chip.setAttribute('data-cat', cat.id);
      chip.textContent = cat.name;
      materialCatsEl.appendChild(chip);
    }

    materialListEl.textContent = '';
    for (var j = 0; j < Data.materials.length; j += 1) {
      var item = Data.materials[j];
      if (item.cat !== materialCat) continue;
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'material-card';
      card.setAttribute('data-material', item.id);

      var main = document.createElement('span');
      main.className = 'material-main';
      var name = document.createElement('span');
      name.className = 'material-name';
      name.textContent = item.name;
      var meta = document.createElement('span');
      meta.className = 'material-meta';
      meta.textContent = item.usage + ' · ' + item.grade;
      main.appendChild(name);
      main.appendChild(meta);

      var price = document.createElement('span');
      price.className = 'material-price';
      price.textContent = '¥' + item.price.low + '–' + item.price.high;
      var unit = document.createElement('small');
      unit.textContent = item.price.unit;
      price.appendChild(unit);

      card.appendChild(main);
      card.appendChild(price);
      materialListEl.appendChild(card);
    }
  }

  function openMaterial(id) {
    var item = null;
    for (var i = 0; i < Data.materials.length; i += 1) {
      if (Data.materials[i].id === id) item = Data.materials[i];
    }
    if (!item) return;
    var catName = '';
    for (var j = 0; j < Data.materialCategories.length; j += 1) {
      if (Data.materialCategories[j].id === item.cat) catName = Data.materialCategories[j].name;
    }
    materialCatEl.textContent = catName;
    materialNameEl.textContent = item.name;
    materialPriceEl.textContent = formatPrice(item.price);

    materialSpecsEl.textContent = '';
    var rows = [
      ['适用空间', item.usage],
      ['关键指标', item.metrics],
      ['环保等级', item.grade]
    ];
    for (var k = 0; k < rows.length; k += 1) {
      var dt = document.createElement('dt');
      dt.textContent = rows[k][0];
      var dd = document.createElement('dd');
      dd.textContent = rows[k][1];
      materialSpecsEl.appendChild(dt);
      materialSpecsEl.appendChild(dd);
    }

    materialTipsEl.textContent = '';
    for (var t = 0; t < item.tips.length; t += 1) {
      var tip = document.createElement('li');
      tip.textContent = item.tips[t];
      materialTipsEl.appendChild(tip);
    }
    materialPitfallsEl.textContent = '';
    for (var p = 0; p < item.pitfalls.length; p += 1) {
      var pit = document.createElement('li');
      pit.textContent = item.pitfalls[p];
      materialPitfallsEl.appendChild(pit);
    }
    materialModal.hidden = false;
  }

  function closeMaterial() {
    materialModal.hidden = true;
  }

  /* ---------- 空间 ---------- */

  function renderSpaces() {
    spaceListEl.textContent = '';
    for (var i = 0; i < Data.spaces.length; i += 1) {
      var space = Data.spaces[i];
      var card = document.createElement('details');
      card.className = 'space-card';
      var summary = document.createElement('summary');
      summary.textContent = space.name;
      card.appendChild(summary);

      var body = document.createElement('div');
      body.className = 'space-body';
      body.appendChild(makeListBlock('关键处理', space.points));
      body.appendChild(makeListBlock('容易忽略', space.overlooked));
      card.appendChild(body);
      spaceListEl.appendChild(card);
    }
  }

  /* ---------- 预算 ---------- */

  function renderBudgetForm() {
    budgetAreaEl.value = state.budget.area || '';
    budgetOldEl.checked = !!state.budget.old;
    budgetTiersEl.textContent = '';
    for (var i = 0; i < Data.budgetTiers.length; i += 1) {
      var tier = Data.budgetTiers[i];
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip' + (state.budget.tier === tier.id ? ' is-active' : '');
      chip.setAttribute('data-tier', tier.id);
      chip.textContent = tier.name + ' · ' + tier.low + '–' + tier.high + ' 元/㎡';
      budgetTiersEl.appendChild(chip);
    }
    if (state.budget.area) {
      calculateAndRender();
    } else {
      budgetResultEl.hidden = true;
    }
  }

  function calculateAndRender() {
    var result = Engine.calculateBudget(
      Data, state.budget.area, state.budget.tier, state.budget.old
    );
    if (!result) {
      budgetResultEl.hidden = true;
      return;
    }
    budgetResultEl.hidden = false;
    budgetTotalEl.textContent = Engine.formatRange(result.low, result.high);
    budgetSubEl.textContent = result.area + '㎡ · ' + result.tier +
      (result.oldHouse ? ' · 老房翻新' : ' · 新房');
    budgetItemsEl.textContent = '';
    for (var i = 0; i < result.items.length; i += 1) {
      var part = result.items[i];
      var row = document.createElement('div');
      row.className = 'budget-item';
      var name = document.createElement('span');
      name.textContent = part.name;
      var value = document.createElement('strong');
      value.textContent = Engine.formatRange(part.low, part.high);
      row.appendChild(name);
      row.appendChild(value);
      budgetItemsEl.appendChild(row);
    }
  }

  /* ---------- 自测 ---------- */

  function currentQuestion() {
    return Data.quiz[quizState.index];
  }

  function renderQuizStart() {
    if (quizState.active) return;
    quizStartEl.hidden = false;
    quizPlayEl.hidden = true;
    quizResultEl.hidden = true;
    quizBestEl.textContent = state.quiz.best ?
      '历史最好成绩：答对 ' + state.quiz.best + ' / ' + MAX_QUIZ + ' 题' :
      '还没有成绩，先来一轮。';
  }

  function beginQuiz() {
    quizState.active = true;
    quizState.index = 0;
    quizState.answers = [];
    quizState.selected = -1;
    quizState.answered = false;
    quizState.review = [];
    quizStartEl.hidden = true;
    quizResultEl.hidden = true;
    quizPlayEl.hidden = false;
    renderQuestion();
  }

  function renderQuestion() {
    var item = currentQuestion();
    quizProgressEl.textContent = '第 ' + (quizState.index + 1) + ' / ' + MAX_QUIZ + ' 题';
    var correctSoFar = 0;
    for (var i = 0; i < quizState.answers.length; i += 1) {
      if (quizState.answers[i] === Data.quiz[i].answer) correctSoFar += 1;
    }
    quizScoreLiveEl.textContent = '答对 ' + correctSoFar + ' 题';
    quizQuestionEl.textContent = item.q;
    quizOptionsEl.textContent = '';
    for (var j = 0; j < item.options.length; j += 1) {
      (function (index) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'quiz-option';
        btn.textContent = String.fromCharCode(65 + index) + '. ' + item.options[index];
        btn.addEventListener('click', function () {
          if (quizState.answered) return;
          quizState.selected = index;
          var options = quizOptionsEl.children;
          for (var k = 0; k < options.length; k += 1) {
            options[k].className = k === index ? 'quiz-option is-selected' : 'quiz-option';
          }
          quizConfirmBtn.disabled = false;
        });
        quizOptionsEl.appendChild(btn);
      }(j));
    }
    quizExplainEl.hidden = true;
    quizConfirmBtn.hidden = false;
    quizConfirmBtn.disabled = true;
    quizNextBtn.hidden = true;
    quizNextBtn.textContent = quizState.index === MAX_QUIZ - 1 ? '查看成绩' : '下一题';
  }

  function confirmAnswer() {
    if (quizState.answered || quizState.selected < 0) return;
    var item = currentQuestion();
    quizState.answered = true;
    quizState.answers[quizState.index] = quizState.selected;
    var options = quizOptionsEl.children;
    for (var i = 0; i < options.length; i += 1) {
      options[i].disabled = true;
      if (i === item.answer) options[i].className = 'quiz-option is-correct';
      else if (i === quizState.selected) options[i].className = 'quiz-option is-wrong';
    }
    quizExplainEl.textContent = '解析：' + item.explain;
    quizExplainEl.hidden = false;
    quizConfirmBtn.hidden = true;
    quizNextBtn.hidden = false;
    if (quizState.selected !== item.answer) {
      quizState.review.push({
        q: item.q,
        right: item.options[item.answer],
        wrong: item.options[quizState.selected],
        explain: item.explain
      });
    }
  }

  function nextQuestion() {
    if (!quizState.answered) return;
    if (quizState.index >= MAX_QUIZ - 1) {
      finishQuiz();
      return;
    }
    quizState.index += 1;
    quizState.selected = -1;
    quizState.answered = false;
    renderQuestion();
  }

  function finishQuiz() {
    var score = Engine.scoreQuiz(Data.quiz, quizState.answers);
    state.quiz.last = score.correct;
    if (score.correct > state.quiz.best) state.quiz.best = score.correct;
    quizState.active = false;
    saveNow();

    quizStartEl.hidden = true;
    quizPlayEl.hidden = true;
    quizResultEl.hidden = false;
    quizResultScoreEl.textContent = String(score.correct);
    quizResultTitleEl.textContent = score.title;
    quizResultBestEl.textContent = '正确率 ' + score.percent + '% · 历史最好 ' +
      state.quiz.best + ' / ' + MAX_QUIZ;

    quizReviewEl.textContent = '';
    if (!quizState.review.length) {
      var perfect = document.createElement('p');
      perfect.className = 'quiz-review-item';
      perfect.textContent = '全部答对，没有错题。';
      quizReviewEl.appendChild(perfect);
    } else {
      for (var i = 0; i < quizState.review.length; i += 1) {
        var entry = quizState.review[i];
        var block = document.createElement('div');
        block.className = 'quiz-review-item';
        var q = document.createElement('strong');
        q.textContent = entry.q;
        var right = document.createElement('span');
        right.textContent = '正确答案：' + entry.right + '。' + entry.explain;
        block.appendChild(q);
        block.appendChild(right);
        quizReviewEl.appendChild(block);
      }
    }

    cardDataUrl = generateQuizCard(score);
    if (cardDataUrl) {
      quizCardEl.src = cardDataUrl;
      quizCardEl.hidden = false;
    } else {
      quizCardEl.hidden = true;
    }
    updateShareButtons();
  }

  function updateShareButtons() {
    var miniTool = getMiniTool();
    var canSave = !!miniTool && typeof miniTool.saveImageToPhotosAlbum === 'function';
    var canShare = !!miniTool && typeof miniTool.share === 'function';
    var canPost = !!miniTool && typeof miniTool.postNote === 'function';
    document.getElementById('quiz-save').hidden = !canSave;
    document.getElementById('quiz-share').hidden = !canShare;
    document.getElementById('quiz-post').hidden = !canPost;
    if (!canSave && !canShare && !canPost) {
      setQuizStatus('当前版本不支持保存、分享或发布笔记，可截图成绩卡。', true);
    } else {
      setQuizStatus('', false);
    }
  }

  function setQuizStatus(text, isError) {
    quizShareStatusEl.textContent = text || '';
    quizShareStatusEl.className = isError ? 'share-status is-error' : 'share-status';
  }

  function generateQuizCard(score) {
    var c = document.createElement('canvas');
    c.width = 900;
    c.height = 1200;
    var g = c.getContext && c.getContext('2d');
    if (!g) return '';
    var bg = g.createLinearGradient(0, 0, 0, 1200);
    bg.addColorStop(0, '#fffdf8');
    bg.addColorStop(0.6, '#f9f2e4');
    bg.addColorStop(1, '#f0e6d5');
    g.fillStyle = bg;
    g.fillRect(0, 0, 900, 1200);

    g.fillStyle = 'rgba(216, 154, 60, 0.12)';
    g.beginPath();
    g.arc(760, 160, 220, 0, Math.PI * 2, false);
    g.fill();
    g.fillStyle = 'rgba(111, 154, 118, 0.12)';
    g.beginPath();
    g.arc(120, 1040, 230, 0, Math.PI * 2, false);
    g.fill();

    g.textAlign = 'center';
    g.fillStyle = '#a08055';
    g.font = '600 20px "Noto Sans CJK SC", sans-serif';
    g.fillText('RENOVATION GUIDE', 450, 96);
    g.fillStyle = '#3d352b';
    g.font = '800 50px "Noto Sans CJK SC", sans-serif';
    g.fillText('装修流程手册', 450, 164);
    g.fillStyle = '#8a7a68';
    g.font = '24px "Noto Sans CJK SC", sans-serif';
    g.fillText('我的装修避坑自测', 450, 208);

    g.fillStyle = '#c98f3c';
    g.font = '800 120px "Noto Sans CJK SC", sans-serif';
    g.fillText(String(score.correct), 450, 430);
    g.fillStyle = '#8a7a68';
    g.font = '26px "Noto Sans CJK SC", sans-serif';
    g.fillText('/ ' + score.total + ' 题', 450, 476);

    g.fillStyle = '#3d352b';
    g.font = '800 40px "Noto Sans CJK SC", sans-serif';
    g.fillText(score.title, 450, 560);

    g.fillStyle = '#8a7a68';
    g.font = '24px "Noto Sans CJK SC", sans-serif';
    g.fillText('正确率 ' + score.percent + '%', 450, 606);

    g.fillStyle = '#6f5d49';
    g.font = '24px "Noto Sans CJK SC", sans-serif';
    g.fillText('防水 · 水电 · 泥瓦 · 板材 · 门窗 · 入住检测', 450, 760);

    g.fillStyle = '#b08a5a';
    g.font = '22px "Noto Sans CJK SC", sans-serif';
    g.fillText('装修前先做一轮，少踩一个坑', 450, 980);

    g.fillStyle = '#b6a68f';
    g.font = '18px "Noto Sans CJK SC", sans-serif';
    g.fillText('通用经验，施工以当地规范和专业人员确认为准', 450, 1100);
    g.textAlign = 'left';

    try {
      return c.toDataURL('image/jpeg', 0.9);
    } catch (error) {
      return '';
    }
  }

  function saveQuizCard() {
    if (!cardDataUrl || shareBusy) return;
    var miniTool = getMiniTool();
    if (!miniTool || typeof miniTool.saveImageToPhotosAlbum !== 'function') {
      setQuizStatus('当前版本不支持保存到相册，可截图成绩卡。', true);
      return;
    }
    shareBusy = true;
    document.getElementById('quiz-save').disabled = true;
    setQuizStatus('正在保存…', false);
    apiCall('saveImageToPhotosAlbum', { filePath: cardDataUrl }).then(function () {
      shareBusy = false;
      document.getElementById('quiz-save').disabled = false;
      setQuizStatus('已保存到相册。', false);
    }).catch(function (error) {
      shareBusy = false;
      document.getElementById('quiz-save').disabled = false;
      setQuizStatus('保存失败' + (error && error.errCode ? '（' + error.errCode + '）' : '') +
        '，可截图成绩卡。', true);
    });
  }

  function shareQuizCard() {
    if (!cardDataUrl || shareBusy) return;
    var miniTool = getMiniTool();
    if (!miniTool || typeof miniTool.share !== 'function') {
      setQuizStatus('当前版本不支持直接分享，请先保存成绩卡。', true);
      return;
    }
    shareBusy = true;
    document.getElementById('quiz-share').disabled = true;
    setQuizStatus('正在打开分享…', false);
    apiCall('share', { type: 'image', image_resource: cardDataUrl }).then(function () {
      shareBusy = false;
      document.getElementById('quiz-share').disabled = false;
      setQuizStatus('已打开分享面板（成功仅表示流程已启动）。', false);
    }).catch(function (error) {
      shareBusy = false;
      document.getElementById('quiz-share').disabled = false;
      var code = error && error.errCode;
      if (code === 15503) {
        setQuizStatus('今天的分享次数已用完，可保存图片后手动分享。', true);
      } else if (code === 15502) {
        setQuizStatus('分享面板未打开，请在小工具全屏中重试，或保存图片。', true);
      } else {
        setQuizStatus('分享失败，可保存图片后手动分享。', true);
      }
    });
  }

  function postQuizNote() {
    if (!cardDataUrl || shareBusy) return;
    var miniTool = getMiniTool();
    if (!miniTool || typeof miniTool.postNote !== 'function') {
      setQuizStatus('当前版本不支持发布笔记，请先保存成绩卡。', true);
      return;
    }
    var score = state.quiz.last;
    shareBusy = true;
    document.getElementById('quiz-post').disabled = true;
    setQuizStatus('正在打开笔记发布页…', false);
    apiCall('postNote', {
      title: '我的装修避坑自测：答对 ' + score + '/' + MAX_QUIZ,
      content: '我在「装修流程手册」做了一轮装修避坑自测，答对 ' + score + ' / ' + MAX_QUIZ +
        ' 题。防水、水电、板材这些坑，装修前先过一遍。',
      pageType: 'photo_publish',
      mediaInfo: { image_resources: [{ url: cardDataUrl }] }
    }).then(function () {
      shareBusy = false;
      document.getElementById('quiz-post').disabled = false;
      setQuizStatus('已打开笔记发布页，发布结果以平台为准。', false);
    }).catch(function (error) {
      shareBusy = false;
      document.getElementById('quiz-post').disabled = false;
      setQuizStatus('打开笔记发布页失败' + (error && error.errCode ? '（' + error.errCode + '）' : '') +
        '，可先保存图片。', true);
    });
  }

  /* ---------- 事件 ---------- */

  function bind() {
    for (var i = 0; i < tabButtons.length; i += 1) {
      (function (btn) {
        btn.addEventListener('click', function () {
          setTab(btn.getAttribute('data-tab'));
        });
      }(tabButtons[i]));
    }

    houseToggle.addEventListener('click', function (event) {
      var target = event.target;
      while (target && target !== houseToggle && !(target.getAttribute && target.getAttribute('data-house'))) {
        target = target.parentNode;
      }
      if (!target || target === houseToggle) return;
      state.houseType = target.getAttribute('data-house') === 'old' ? 'old' : 'new';
      renderFlow();
      saveNow();
    });

    materialCatsEl.addEventListener('click', function (event) {
      var target = event.target;
      while (target && target !== materialCatsEl && !(target.getAttribute && target.getAttribute('data-cat'))) {
        target = target.parentNode;
      }
      if (!target || target === materialCatsEl) return;
      materialCat = target.getAttribute('data-cat');
      renderMaterials();
    });

    materialListEl.addEventListener('click', function (event) {
      var target = event.target;
      while (target && target !== materialListEl &&
             !(target.getAttribute && target.getAttribute('data-material'))) {
        target = target.parentNode;
      }
      if (!target || target === materialListEl) return;
      openMaterial(target.getAttribute('data-material'));
    });

    materialClose.addEventListener('click', closeMaterial);
    materialMask.addEventListener('click', closeMaterial);

    budgetTiersEl.addEventListener('click', function (event) {
      var target = event.target;
      while (target && target !== budgetTiersEl && !(target.getAttribute && target.getAttribute('data-tier'))) {
        target = target.parentNode;
      }
      if (!target || target === budgetTiersEl) return;
      state.budget.tier = target.getAttribute('data-tier');
      renderBudgetForm();
      saveNow();
    });

    budgetAreaEl.addEventListener('input', function () {
      state.budget.area = budgetAreaEl.value;
      if (!state.budget.area) budgetResultEl.hidden = true;
      saveNow();
    });

    budgetOldEl.addEventListener('change', function () {
      state.budget.old = budgetOldEl.checked;
      if (state.budget.area) calculateAndRender();
      saveNow();
    });

    document.getElementById('budget-calc').addEventListener('click', function () {
      state.budget.area = budgetAreaEl.value;
      if (!Engine.calculateBudget(Data, state.budget.area, state.budget.tier, state.budget.old)) {
        budgetResultEl.hidden = true;
        budgetAreaEl.focus();
        return;
      }
      calculateAndRender();
      saveNow();
    });

    document.getElementById('quiz-begin').addEventListener('click', beginQuiz);
    quizConfirmBtn.addEventListener('click', confirmAnswer);
    quizNextBtn.addEventListener('click', nextQuestion);
    document.getElementById('quiz-again').addEventListener('click', function () {
      quizState.active = false;
      renderQuizStart();
    });
    document.getElementById('quiz-save').addEventListener('click', saveQuizCard);
    document.getElementById('quiz-share').addEventListener('click', shareQuizCard);
    document.getElementById('quiz-post').addEventListener('click', postQuizNote);
  }

  function boot() {
    bind();
    renderAll();
    loadSaved();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}());
