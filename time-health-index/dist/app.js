(function () {
  'use strict';

  var SLOT_COUNT = 48;
  var KEY_PREFIX = 'timehealth.v1.';
  var CIRC = 2 * Math.PI * 52;

  var CATEGORIES = [
    { id: 'sleep', name: '睡眠', color: '#5b7fe8' },
    { id: 'work', name: '工作/学习', color: '#e39a3b' },
    { id: 'exercise', name: '锻炼', color: '#3fae7a' },
    { id: 'leisure', name: '线下休闲', color: '#9b7be0' },
    { id: 'video', name: '看视频', color: '#e0658d' },
    { id: 'game', name: '打游戏', color: '#d4574e' },
    { id: 'other', name: '其他/通勤', color: '#93a0ae' }
  ];

  var COLORS = {};
  var CATEGORY_NAMES = {};
  (function () {
    for (var i = 0; i < CATEGORIES.length; i += 1) {
      COLORS[CATEGORIES[i].id] = CATEGORIES[i].color;
      CATEGORY_NAMES[CATEGORIES[i].id] = CATEGORIES[i].name;
    }
  }());

  var TEMPLATES = {
    office: {
      name: '上班族',
      ranges: [
        [0, 14, 'sleep'], [14, 18, 'other'], [18, 24, 'work'],
        [24, 27, 'other'], [27, 37, 'work'], [37, 38, 'leisure'],
        [38, 39, 'exercise'], [39, 40, 'other'], [40, 44, 'video'],
        [44, 46, 'leisure'], [46, 48, 'sleep']
      ]
    },
    student: {
      name: '学生',
      ranges: [
        [0, 14, 'sleep'], [14, 16, 'other'], [16, 24, 'work'],
        [24, 28, 'leisure'], [28, 34, 'work'], [34, 35, 'other'],
        [35, 37, 'exercise'], [37, 39, 'game'], [39, 43, 'work'],
        [43, 45, 'leisure'], [45, 47, 'video'], [47, 48, 'sleep']
      ]
    },
    freelance: {
      name: '自由职业',
      ranges: [
        [0, 1, 'game'], [1, 17, 'sleep'], [17, 19, 'exercise'],
        [19, 20, 'other'], [20, 24, 'work'], [24, 28, 'leisure'],
        [28, 36, 'work'], [36, 38, 'leisure'], [38, 42, 'video'],
        [42, 46, 'work'], [46, 48, 'game']
      ]
    }
  };

  var WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  var timeline = document.getElementById('timeline');
  var palette = document.getElementById('palette');
  var templateList = document.getElementById('template-list');
  var clearBtn = document.getElementById('clear-btn');
  var coverage = document.getElementById('coverage');
  var assignedTotal = document.getElementById('assigned-total');
  var statsList = document.getElementById('stats-list');
  var factorsList = document.getElementById('factors-list');
  var tipsList = document.getElementById('tips-list');
  var scoreNumber = document.getElementById('score-number');
  var scoreTitle = document.getElementById('score-title');
  var scoreDesc = document.getElementById('score-desc');
  var scoreNote = document.getElementById('score-note');
  var ringProgress = document.getElementById('ring-progress');
  var dateLabel = document.getElementById('date-label');
  var prevBtn = document.getElementById('prev-day');
  var nextBtn = document.getElementById('next-day');
  var todayBtn = document.getElementById('today-btn');
  var saveStatus = document.getElementById('save-status');

  var cellEls = [];
  var brush = 'sleep';
  var painting = false;
  var renderQueued = false;
  var loadToken = 0;
  var saveTimer = null;
  var pendingSave = null;
  var saving = false;
  var memoryDays = {};

  var today = startOfDay(new Date());
  var state = {
    dateKey: dateKeyOf(today),
    slots: emptySlots(),
    loading: false
  };

  function pad2(value) {
    return (value < 10 ? '0' : '') + value;
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function addDays(date, amount) {
    var next = startOfDay(date);
    next.setDate(next.getDate() + amount);
    return next;
  }

  function dateKeyOf(date) {
    return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
  }

  function parseDateKey(key) {
    var parts = String(key).split('-');
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }

  function sameDay(left, right) {
    return left.getFullYear() === right.getFullYear() &&
      left.getMonth() === right.getMonth() &&
      left.getDate() === right.getDate();
  }

  function emptySlots() {
    var slots = [];
    for (var i = 0; i < SLOT_COUNT; i += 1) {
      slots.push(null);
    }
    return slots;
  }

  function slotLabel(index) {
    var hour = Math.floor(index / 2);
    var minute = index % 2 === 0 ? 0 : 30;
    return pad2(hour) + ':' + pad2(minute);
  }

  function fmtHours(hours) {
    var rounded = Math.round(hours * 10) / 10;
    if (rounded % 1 === 0) {
      return String(rounded);
    }
    return rounded.toFixed(1);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
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
      idle: '记录会自动保存在当前小工具。',
      loading: '正在读取本地记录…',
      saving: '正在保存…',
      saved: '已保存到本机。',
      empty: '未读取到本地记录，可直接开始记录。',
      error: '保存失败，记录仅保留在当前页面。',
      unsupported: '当前客户端不支持本地保存，记录仅在本次打开有效。'
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

  function buildGrid() {
    var fragment = document.createDocumentFragment();
    cellEls = [];
    for (var i = 0; i < SLOT_COUNT; i += 1) {
      var cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'slot';
      cell.setAttribute('data-slot', String(i));
      var label = document.createElement('span');
      label.className = 'slot-time';
      label.textContent = slotLabel(i);
      cell.appendChild(label);
      fragment.appendChild(cell);
      cellEls.push(cell);
    }
    timeline.textContent = '';
    timeline.appendChild(fragment);
    timeline.setAttribute('aria-busy', 'false');
  }

  function updateSlot(index) {
    var cell = cellEls[index];
    if (!cell) {
      return;
    }
    var categoryId = state.slots[index];
    var className = 'slot';
    if (categoryId) {
      className += ' cat-' + categoryId;
    }
    cell.className = className;
    cell.setAttribute('aria-label',
      slotLabel(index) + ' ' + (categoryId ? CATEGORY_NAMES[categoryId] : '未记录') + '，点击涂色');
  }

  function setBrush(categoryId) {
    if (!CATEGORY_NAMES[categoryId]) {
      return;
    }
    brush = categoryId;
    var chips = palette.getElementsByTagName('button');
    for (var i = 0; i < chips.length; i += 1) {
      var active = chips[i].getAttribute('data-cat') === categoryId;
      chips[i].setAttribute('aria-pressed', active ? 'true' : 'false');
      if (active) {
        chips[i].className = chips[i].className.replace(/\s*is-active/g, '') + ' is-active';
      } else {
        chips[i].className = chips[i].className.replace(/\s*is-active/g, '');
      }
    }
  }

  function paintSlot(index, categoryId) {
    if (state.loading) {
      return;
    }
    if (index < 0 || index >= SLOT_COUNT || !CATEGORY_NAMES[categoryId]) {
      return;
    }
    if (state.slots[index] === categoryId) {
      return;
    }
    state.slots[index] = categoryId;
    updateSlot(index);
    scheduleRender();
    queueSave();
  }

  function scheduleRender() {
    if (renderQueued) {
      return;
    }
    renderQueued = true;
    window.setTimeout(function () {
      if (!renderQueued) {
        return;
      }
      renderQueued = false;
      renderAll();
    }, 20);
  }

  function closestWithAttr(node, attr, boundary) {
    while (node && node !== boundary) {
      if (node.nodeType === 1 && node.getAttribute && node.getAttribute(attr) !== null) {
        return node;
      }
      node = node.parentNode;
    }
    return null;
  }

  function slotFromPoint(x, y) {
    if (typeof document.elementFromPoint !== 'function') {
      return -1;
    }
    var node = document.elementFromPoint(x, y);
    var cell = closestWithAttr(node, 'data-slot', timeline.parentNode);
    return cell ? Number(cell.getAttribute('data-slot')) : -1;
  }

  function applyAt(x, y) {
    var index = slotFromPoint(x, y);
    if (index >= 0) {
      paintSlot(index, brush);
    }
  }

  function onPointerDown(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }
    painting = true;
    if (event.cancelable) {
      event.preventDefault();
    }
    if (timeline.setPointerCapture) {
      try {
        timeline.setPointerCapture(event.pointerId);
      } catch (error) {
        /* ignore */
      }
    }
    applyAt(event.clientX, event.clientY);
  }

  function onPointerMove(event) {
    if (!painting) {
      return;
    }
    if (event.cancelable) {
      event.preventDefault();
    }
    applyAt(event.clientX, event.clientY);
  }

  function stopPaint() {
    painting = false;
  }

  function onTouchStart(event) {
    if (!event.touches.length) {
      return;
    }
    if (event.cancelable) {
      event.preventDefault();
    }
    painting = true;
    applyAt(event.touches[0].clientX, event.touches[0].clientY);
  }

  function onTouchMove(event) {
    if (!painting || !event.touches.length) {
      return;
    }
    if (event.cancelable) {
      event.preventDefault();
    }
    applyAt(event.touches[0].clientX, event.touches[0].clientY);
  }

  function onMouseDown(event) {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    painting = true;
    applyAt(event.clientX, event.clientY);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  function onMouseMove(event) {
    if (!painting) {
      return;
    }
    applyAt(event.clientX, event.clientY);
  }

  function onMouseUp() {
    painting = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }

  function bindTimelineEvents() {
    if (window.PointerEvent) {
      timeline.addEventListener('pointerdown', onPointerDown);
      timeline.addEventListener('pointermove', onPointerMove);
      timeline.addEventListener('pointerup', stopPaint);
      timeline.addEventListener('pointercancel', stopPaint);
    } else {
      timeline.addEventListener('touchstart', onTouchStart, false);
      timeline.addEventListener('touchmove', onTouchMove, false);
      timeline.addEventListener('touchend', stopPaint, false);
      timeline.addEventListener('touchcancel', stopPaint, false);
      timeline.addEventListener('mousedown', onMouseDown);
    }
    timeline.addEventListener('click', function (event) {
      var cell = closestWithAttr(event.target, 'data-slot', timeline);
      if (cell) {
        paintSlot(Number(cell.getAttribute('data-slot')), brush);
      }
    });
  }

  function assignedCount() {
    var count = 0;
    for (var i = 0; i < SLOT_COUNT; i += 1) {
      if (state.slots[i]) {
        count += 1;
      }
    }
    return count;
  }

  function findSleepRuns() {
    var runs = [];
    var start = -1;
    for (var i = 0; i <= SLOT_COUNT; i += 1) {
      var isSleep = i < SLOT_COUNT && state.slots[i] === 'sleep';
      if (isSleep && start < 0) {
        start = i;
      } else if (!isSleep && start >= 0) {
        runs.push({ start: start, end: i });
        start = -1;
      }
    }
    if (runs.length > 1 && runs[0].start === 0 && runs[runs.length - 1].end === SLOT_COUNT) {
      var first = runs.shift();
      var last = runs.pop();
      runs.push({ start: last.start, end: first.end + SLOT_COUNT });
    }
    return runs;
  }

  function longestSleepRun() {
    var runs = findSleepRuns();
    var best = null;
    for (var i = 0; i < runs.length; i += 1) {
      if (!best || (runs[i].end - runs[i].start) > (best.end - best.start)) {
        best = runs[i];
      }
    }
    return best;
  }

  function sleepWindow() {
    var run = longestSleepRun();
    if (!run) {
      return null;
    }
    return {
      start: (run.start % SLOT_COUNT) * 30,
      end: run.end === SLOT_COUNT ? 1440 : (run.end % SLOT_COUNT) * 30
    };
  }

  function sleepStartMinutes() {
    var windowInfo = sleepWindow();
    return windowInfo ? windowInfo.start : -1;
  }

  function minutesLabel(minutes) {
    if (minutes < 0) {
      return '';
    }
    if (minutes === 1440) {
      return '24:00';
    }
    var normalized = minutes % 1440;
    return pad2(Math.floor(normalized / 60)) + ':' + pad2(normalized % 60);
  }

  function sleepScore(hours) {
    if (hours >= 7 && hours <= 9) {
      return 30;
    }
    if (hours > 9) {
      return Math.max(0, 30 - (hours - 9) * 4);
    }
    if (hours >= 6) {
      return 24 + (hours - 6) * 6;
    }
    if (hours >= 5) {
      return 16 + (hours - 5) * 8;
    }
    if (hours > 0) {
      return (hours / 5) * 16;
    }
    return 0;
  }

  function exerciseScore(hours) {
    if (hours >= 1) {
      return 20;
    }
    if (hours >= 0.5) {
      return 12 + (hours - 0.5) * 16;
    }
    if (hours > 0) {
      return hours * 24;
    }
    return 0;
  }

  function screenScore(hours) {
    if (hours <= 2) {
      return 25;
    }
    if (hours <= 4) {
      return 25 - (hours - 2) * 5;
    }
    if (hours <= 6) {
      return 15 - (hours - 4) * 5;
    }
    return Math.max(0, 5 - (hours - 6) * 2.5);
  }

  function workScore(hours) {
    if (hours >= 6 && hours <= 10) {
      return 15;
    }
    if (hours > 10) {
      if (hours <= 12) {
        return 15 - (hours - 10) * 3;
      }
      return Math.max(0, 9 - (hours - 12) * 3);
    }
    if (hours >= 4) {
      return 9 + (hours - 4) * 3;
    }
    if (hours > 0) {
      return (hours / 4) * 9;
    }
    return 0;
  }

  function rhythmScore(lateScreenSlots, startMinutes) {
    var score = Math.max(0, 5 - lateScreenSlots);
    if (startMinutes < 0) {
      return Math.round(score);
    }
    var relative = startMinutes >= 720 ? startMinutes - 1440 : startMinutes;
    if (relative >= -120 && relative <= 60) {
      score += 5;
    } else if ((relative >= -180 && relative < -120) || (relative > 60 && relative <= 120)) {
      score += 3;
    } else {
      score += 1;
    }
    return Math.round(Math.min(10, score));
  }

  function computeMetrics() {
    var counts = {};
    var i;
    for (i = 0; i < CATEGORIES.length; i += 1) {
      counts[CATEGORIES[i].id] = 0;
    }
    var assigned = 0;
    for (i = 0; i < SLOT_COUNT; i += 1) {
      var categoryId = state.slots[i];
      if (categoryId) {
        counts[categoryId] += 1;
        assigned += 1;
      }
    }

    var hours = {};
    for (i = 0; i < CATEGORIES.length; i += 1) {
      hours[CATEGORIES[i].id] = counts[CATEGORIES[i].id] * 0.5;
    }
    var screenHours = hours.video + hours.game;

    var lateScreenSlots = 0;
    var lateIndexes = [46, 47, 0, 1, 2, 3];
    for (i = 0; i < lateIndexes.length; i += 1) {
      var lateCat = state.slots[lateIndexes[i]];
      if (lateCat === 'video' || lateCat === 'game') {
        lateScreenSlots += 1;
      }
    }

    var startMinutes = sleepStartMinutes();
    var sleepWindowInfo = sleepWindow();

    var factors = [
      { key: 'sleep', name: '睡眠', score: clamp(Math.round(sleepScore(hours.sleep)), 0, 30), max: 30,
        hint: sleepWindowInfo ?
          minutesLabel(sleepWindowInfo.start) + '–' + minutesLabel(sleepWindowInfo.end) + ' · ' + fmtHours(hours.sleep) + ' 小时' :
          '未记录睡眠' },
      { key: 'exercise', name: '运动', score: clamp(Math.round(exerciseScore(hours.exercise)), 0, 20), max: 20,
        hint: fmtHours(hours.exercise) + ' 小时' },
      { key: 'screen', name: '屏幕娱乐', score: clamp(Math.round(screenScore(screenHours)), 0, 25), max: 25,
        hint: '看视频 ' + fmtHours(hours.video) + 'h · 游戏 ' + fmtHours(hours.game) + 'h' },
      { key: 'work', name: '工作负荷', score: clamp(Math.round(workScore(hours.work)), 0, 15), max: 15,
        hint: fmtHours(hours.work) + ' 小时' },
      { key: 'rhythm', name: '作息规律', score: clamp(rhythmScore(lateScreenSlots, startMinutes), 0, 10), max: 10,
        hint: startMinutes >= 0 ? '入睡 ' + minutesLabel(startMinutes) : '未记录睡眠' }
    ];

    var total = 0;
    for (i = 0; i < factors.length; i += 1) {
      total += factors[i].score;
    }

    return {
      counts: counts,
      hours: hours,
      assigned: assigned,
      screenHours: screenHours,
      lateScreenHours: lateScreenSlots * 0.5,
      sleepStart: startMinutes,
      factors: factors,
      score: assigned === SLOT_COUNT ? clamp(total, 0, 100) : null
    };
  }

  function scoreMeta(score) {
    if (score >= 85) {
      return {
        label: '状态优秀',
        desc: '睡眠、运动和屏幕时间比较平衡，继续保持这个节奏。',
        cls: 'score-good'
      };
    }
    if (score >= 70) {
      return {
        label: '整体良好',
        desc: '基础作息不错，按下面的建议微调会更稳。',
        cls: 'score-ok'
      };
    }
    if (score >= 55) {
      return {
        label: '有些失衡',
        desc: '部分时间段需要调整，先从最容易改的一项开始。',
        cls: 'score-warn'
      };
    }
    return {
      label: '需要关注',
      desc: '睡眠、运动或屏幕时间明显失衡，今天先做一个小改变。',
      cls: 'score-bad'
    };
  }

  function renderDateBar() {
    var date = parseDateKey(state.dateKey);
    var isToday = sameDay(date, today);
    var prefix = isToday ? '今天 · ' : '';
    dateLabel.textContent = prefix + (date.getMonth() + 1) + '月' + date.getDate() + '日 ' + WEEKDAYS[date.getDay()];
    nextBtn.disabled = isToday;
    todayBtn.hidden = isToday;
  }

  function renderCoverage(metrics) {
    coverage.textContent = fmtHours(metrics.assigned * 0.5) + ' / 24 小时';
    assignedTotal.textContent = '已记录 ' + fmtHours(metrics.assigned * 0.5) + 'h';
  }

  function renderScore(metrics) {
    if (metrics.score === null) {
      var remaining = (SLOT_COUNT - metrics.assigned) * 0.5;
      scoreNumber.textContent = '--';
      scoreTitle.textContent = metrics.assigned === 0 ? '等待记录' : '记录中';
      scoreDesc.textContent = metrics.assigned === 0 ?
        '把 24 小时涂满后生成健康指数。' :
        '还差 ' + fmtHours(remaining) + ' 小时，涂满后生成指数。';
      scoreNote.textContent = '当前已记录 ' + fmtHours(metrics.assigned * 0.5) + ' 小时';
      ringProgress.setAttribute('class', 'ring-progress');
      ringProgress.style.strokeDashoffset = String(CIRC);
      return;
    }

    var meta = scoreMeta(metrics.score);
    scoreNumber.textContent = String(metrics.score);
    scoreTitle.textContent = meta.label;
    scoreDesc.textContent = meta.desc;
    scoreNote.textContent = '睡眠 ' + fmtHours(metrics.hours.sleep) + 'h · 运动 ' +
      fmtHours(metrics.hours.exercise) + 'h · 屏幕 ' + fmtHours(metrics.screenHours) + 'h';
    ringProgress.setAttribute('class', 'ring-progress ' + meta.cls);
    ringProgress.style.strokeDashoffset = String(CIRC * (1 - metrics.score / 100));
  }

  function renderStats(metrics) {
    var fragment = document.createDocumentFragment();
    for (var i = 0; i < CATEGORIES.length; i += 1) {
      var category = CATEGORIES[i];
      var hours = metrics.hours[category.id];
      var row = document.createElement('div');
      row.className = 'stat-row';

      var dot = document.createElement('span');
      dot.className = 'stat-dot';
      dot.style.background = category.color;

      var name = document.createElement('span');
      name.className = 'stat-name';
      name.textContent = category.name;

      var barWrap = document.createElement('span');
      barWrap.className = 'stat-bar-wrap';
      var bar = document.createElement('span');
      bar.className = 'stat-bar';
      bar.style.background = category.color;
      bar.style.width = (hours / 24 * 100) + '%';
      barWrap.appendChild(bar);

      var value = document.createElement('span');
      value.className = 'stat-value';
      value.textContent = fmtHours(hours) + 'h · ' + Math.round(hours / 24 * 100) + '%';

      row.appendChild(dot);
      row.appendChild(name);
      row.appendChild(barWrap);
      row.appendChild(value);
      fragment.appendChild(row);
    }
    statsList.textContent = '';
    statsList.appendChild(fragment);
  }

  function renderFactors(metrics) {
    factorsList.textContent = '';
    if (metrics.score === null) {
      var note = document.createElement('p');
      note.className = 'empty-note';
      note.textContent = '记录满 24 小时后显示各项得分。';
      factorsList.appendChild(note);
      return;
    }

    var fragment = document.createDocumentFragment();
    for (var i = 0; i < metrics.factors.length; i += 1) {
      var factor = metrics.factors[i];
      var row = document.createElement('div');
      row.className = 'factor-row';

      var main = document.createElement('div');
      main.className = 'factor-main';

      var head = document.createElement('div');
      head.className = 'factor-head';
      var name = document.createElement('span');
      name.className = 'factor-name';
      name.textContent = factor.name;
      var value = document.createElement('span');
      value.className = 'factor-value';
      value.textContent = factor.score + ' / ' + factor.max;
      head.appendChild(name);
      head.appendChild(value);

      var barWrap = document.createElement('div');
      barWrap.className = 'factor-bar-wrap';
      var bar = document.createElement('div');
      bar.className = 'factor-bar';
      bar.style.background = COLORS[factor.key] || '#5b7fe8';
      bar.style.width = (factor.score / factor.max * 100) + '%';
      barWrap.appendChild(bar);

      var hint = document.createElement('span');
      hint.className = 'factor-hint';
      hint.textContent = factor.hint;

      main.appendChild(head);
      main.appendChild(barWrap);
      main.appendChild(hint);
      row.appendChild(main);
      fragment.appendChild(row);
    }
    factorsList.appendChild(fragment);
  }

  function pushTip(tips, level, title, body) {
    tips.push({ level: level, title: title, body: body });
  }

  function buildTips(metrics) {
    var tips = [];
    if (metrics.assigned < SLOT_COUNT) {
      if (metrics.assigned === 0) {
        pushTip(tips, 'info', '先涂满 24 小时',
          '选择一个分类作为画笔，在时间轴上点按或滑动；也可以先用快捷模板，再按自己的情况微调。');
      } else {
        pushTip(tips, 'info', '还差 ' + fmtHours((SLOT_COUNT - metrics.assigned) * 0.5) + ' 小时',
          '涂满后就能生成健康指数，并看到针对睡眠、运动和屏幕娱乐的具体建议。');
      }
      return tips;
    }

    var hours = metrics.hours;
    var screen = metrics.screenHours;

    if (hours.sleep < 6.5) {
      pushTip(tips, 'warn', '睡眠偏少',
        '今天睡眠约 ' + fmtHours(hours.sleep) + ' 小时。今晚试着提前 30–60 分钟上床，目标 7–9 小时。');
    } else if (hours.sleep > 10) {
      pushTip(tips, 'warn', '睡眠偏长',
        '今天睡眠约 ' + fmtHours(hours.sleep) + ' 小时。固定起床时间，白天多走动，避免越睡越困。');
    } else if (hours.sleep < 7) {
      pushTip(tips, 'info', '睡眠略少',
        '今天睡眠约 ' + fmtHours(hours.sleep) + ' 小时，再补 30 分钟会更接近健康区间。');
    }

    if (hours.exercise < 0.5) {
      pushTip(tips, 'warn', '今天缺少锻炼',
        '从 20 分钟快走或拉伸开始，逐步增加到每天 30–60 分钟；久坐时每小时起身活动 3–5 分钟。');
    } else if (hours.exercise < 1) {
      pushTip(tips, 'info', '运动还可以再加一点',
        '今天运动约 ' + fmtHours(hours.exercise) + ' 小时，再增加 15–30 分钟中等强度活动会更好。');
    }

    if (screen > 4) {
      pushTip(tips, 'warn', '屏幕娱乐偏多',
        '看视频和打游戏共 ' + fmtHours(screen) + ' 小时（看视频 ' + fmtHours(hours.video) +
        'h、游戏 ' + fmtHours(hours.game) + 'h）。先试着减少 1 小时，换成散步、运动或线下社交。');
    } else if (hours.video > 2) {
      pushTip(tips, 'info', '减少看剧时间',
        '今天看视频约 ' + fmtHours(hours.video) + ' 小时。可以设置单集上限或 1.5 倍速，睡前 1 小时停止刷剧。');
    } else if (hours.game > 2) {
      pushTip(tips, 'info', '给游戏设个终点',
        '今天打游戏约 ' + fmtHours(hours.game) + ' 小时。每局后起身活动 5 分钟，并提前约定结束时间。');
    }

    if (hours.work > 12) {
      pushTip(tips, 'warn', '工作负荷过高',
        '工作/学习约 ' + fmtHours(hours.work) + ' 小时，已经明显超载。今晚尽量留出完整的放松时间。');
    } else if (hours.work > 10) {
      pushTip(tips, 'info', '工作时间偏长',
        '工作/学习约 ' + fmtHours(hours.work) + ' 小时，注意每小时起身 3–5 分钟，避免连续久坐。');
    }

    if (metrics.lateScreenHours > 0) {
      pushTip(tips, 'info', '睡前屏幕偏多',
        '23 点后还有 ' + fmtHours(metrics.lateScreenHours) + ' 小时在看视频或打游戏。屏幕和兴奋感会推迟入睡，尽量睡前 1 小时停屏。');
    } else if (metrics.sleepStart >= 0) {
      var rel = metrics.sleepStart >= 720 ? metrics.sleepStart - 1440 : metrics.sleepStart;
      if (rel > 60) {
        pushTip(tips, 'info', '入睡时间偏晚',
          '今天的入睡时间约 ' + minutesLabel(metrics.sleepStart) + '。试着每天提前 15 分钟，逐步回到 23 点前后。');
      }
    }

    if (tips.length === 0) {
      pushTip(tips, 'good', '今天的状态很均衡',
        '睡眠、运动、工作负荷和屏幕娱乐都在健康区间。保持这个节奏，并留意久坐和补水。');
    }

    return tips.slice(0, 3);
  }

  function renderTips(metrics) {
    var tips = buildTips(metrics);
    var fragment = document.createDocumentFragment();
    for (var i = 0; i < tips.length; i += 1) {
      var tip = tips[i];
      var card = document.createElement('div');
      card.className = 'tip tip-' + tip.level;
      var title = document.createElement('p');
      title.className = 'tip-title';
      title.textContent = tip.title;
      var body = document.createElement('p');
      body.className = 'tip-body';
      body.textContent = tip.body;
      card.appendChild(title);
      card.appendChild(body);
      fragment.appendChild(card);
    }
    tipsList.textContent = '';
    tipsList.appendChild(fragment);
  }

  function renderAll() {
    renderDateBar();
    for (var i = 0; i < SLOT_COUNT; i += 1) {
      updateSlot(i);
    }
    var metrics = computeMetrics();
    renderCoverage(metrics);
    renderScore(metrics);
    renderStats(metrics);
    renderFactors(metrics);
    renderTips(metrics);
  }

  function saveStatusIdle() {
    setSaveStatus('idle');
  }

  function queueSave() {
    memoryDays[state.dateKey] = state.slots.slice();
    if (!canStorage()) {
      setSaveStatus('unsupported');
      return;
    }
    pendingSave = {
      key: KEY_PREFIX + state.dateKey,
      payload: {
        v: 1,
        date: state.dateKey,
        slots: state.slots.slice(),
        updatedAt: new Date().toISOString()
      }
    };
    if (saveTimer) {
      window.clearTimeout(saveTimer);
    }
    saveTimer = window.setTimeout(function () {
      saveTimer = null;
      flushSave();
    }, 400);
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
      key: job.key,
      data: JSON.stringify(job.payload)
    }).then(function (result) {
      saving = false;
      var isCurrent = job.payload.date === state.dateKey;
      if (result && result.errMsg && String(result.errMsg).indexOf(':ok') === -1) {
        if (isCurrent) {
          setSaveStatus('error');
        }
        return;
      }
      if (isCurrent) {
        setSaveStatus('saved');
      }
      flushSave();
    }).catch(function () {
      saving = false;
      if (job.payload.date === state.dateKey) {
        setSaveStatus('error');
      }
    });
  }

  function saveNow() {
    if (saveTimer) {
      window.clearTimeout(saveTimer);
      saveTimer = null;
    }
    if (!canStorage()) {
      setSaveStatus('unsupported');
      return;
    }
    queueSave();
    flushSave();
  }

  function normalizeSlots(raw) {
    var slots = emptySlots();
    if (!raw || typeof raw.length !== 'number') {
      return slots;
    }
    for (var i = 0; i < SLOT_COUNT && i < raw.length; i += 1) {
      if (raw[i] && CATEGORY_NAMES[raw[i]]) {
        slots[i] = raw[i];
      }
    }
    return slots;
  }

  function loadDate() {
    if (!canStorage()) {
      state.loading = false;
      setSaveStatus('unsupported');
      renderAll();
      return;
    }
    var token = loadToken + 1;
    loadToken = token;
    state.loading = true;
    setSaveStatus('loading');
    var timeout = window.setTimeout(function () {
      if (token !== loadToken) {
        return;
      }
      loadToken = token + 1;
      state.loading = false;
      setSaveStatus(memoryDays[state.dateKey] ? 'idle' : 'empty');
      renderAll();
    }, 3000);
    apiCall('getStorage', { key: KEY_PREFIX + state.dateKey }).then(function (result) {
      if (token !== loadToken) {
        return;
      }
      window.clearTimeout(timeout);
      var parsed = null;
      var raw = result && result.data;
      if (typeof raw === 'string' && raw) {
        try {
          parsed = JSON.parse(raw);
        } catch (error) {
          parsed = null;
        }
      }
      if (memoryDays[state.dateKey]) {
        state.slots = memoryDays[state.dateKey].slice();
        saveStatusIdle();
      } else if (parsed && parsed.date === state.dateKey && parsed.slots) {
        state.slots = normalizeSlots(parsed.slots);
        memoryDays[state.dateKey] = state.slots.slice();
        setSaveStatus('saved');
      } else {
        state.slots = emptySlots();
        setSaveStatus('empty');
      }
      state.loading = false;
      renderAll();
    }).catch(function () {
      if (token !== loadToken) {
        return;
      }
      window.clearTimeout(timeout);
      var memory = memoryDays[state.dateKey];
      state.slots = memory ? memory.slice() : emptySlots();
      state.loading = false;
      setSaveStatus(memory ? 'idle' : 'empty');
      renderAll();
    });
  }

  function goToDate(target) {
    if (target > today) {
      return;
    }
    var nextKey = dateKeyOf(target);
    if (nextKey === state.dateKey) {
      return;
    }
    saveNow();
    state.dateKey = nextKey;
    state.slots = memoryDays[nextKey] ? memoryDays[nextKey].slice() : emptySlots();
    renderAll();
    loadDate();
  }

  function applyTemplate(templateId) {
    var template = TEMPLATES[templateId];
    if (!template) {
      return;
    }
    if (assignedCount() > 0 && !window.confirm('用「' + template.name + '」模板覆盖当前记录？')) {
      return;
    }
    var slots = emptySlots();
    for (var i = 0; i < template.ranges.length; i += 1) {
      var range = template.ranges[i];
      for (var index = range[0]; index < range[1]; index += 1) {
        slots[index] = range[2];
      }
    }
    state.slots = slots;
    renderAll();
    saveNow();
    vibrate();
  }

  function clearDay() {
    if (assignedCount() > 0 && !window.confirm('清空这一天的记录？')) {
      return;
    }
    state.slots = emptySlots();
    renderAll();
    saveNow();
  }

  function vibrate() {
    var miniTool = getMiniTool();
    if (!miniTool || typeof miniTool.vibrateShort !== 'function') {
      return;
    }
    try {
      var result = miniTool.vibrateShort({ type: 'light' });
      if (result && typeof result.then === 'function') {
        result.then(function () {}, function () {});
      }
    } catch (error) {
      /* ignore */
    }
  }

  function bindEvents() {
    palette.addEventListener('click', function (event) {
      var chip = closestWithAttr(event.target, 'data-cat', palette);
      if (chip) {
        setBrush(chip.getAttribute('data-cat'));
      }
    });

    templateList.addEventListener('click', function (event) {
      var button = closestWithAttr(event.target, 'data-template', templateList);
      if (button) {
        applyTemplate(button.getAttribute('data-template'));
      }
    });

    clearBtn.addEventListener('click', clearDay);
    prevBtn.addEventListener('click', function () {
      goToDate(addDays(parseDateKey(state.dateKey), -1));
    });
    nextBtn.addEventListener('click', function () {
      goToDate(addDays(parseDateKey(state.dateKey), 1));
    });
    todayBtn.addEventListener('click', function () {
      goToDate(today);
    });

    window.addEventListener('pagehide', function () {
      if (saveTimer) {
        window.clearTimeout(saveTimer);
        saveTimer = null;
      }
      queueSave();
      flushSave();
    });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden' && pendingSave) {
        if (saveTimer) {
          window.clearTimeout(saveTimer);
          saveTimer = null;
        }
        flushSave();
      }
    });
  }

  function init() {
    ringProgress.style.strokeDasharray = CIRC + ' ' + CIRC;
    ringProgress.style.strokeDashoffset = String(CIRC);
    buildGrid();
    bindTimelineEvents();
    bindEvents();
    setBrush('sleep');
    renderAll();
    if (canStorage()) {
      loadDate();
    } else {
      state.loading = false;
      setSaveStatus('unsupported');
    }
  }

  init();
}());
