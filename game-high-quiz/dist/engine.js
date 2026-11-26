/*
 * 高中回忆杀 · 规则引擎
 * 三册（高一/高二/高三）题库、练习与考试组卷、高考卷、判分与解锁，纯逻辑可测试。
 */
(function (global) {
  'use strict';

  var GRADES = [10, 11, 12];
  var GRADE_NAMES = { 10: '高一', 11: '高二', 12: '高三' };
  var SUBJECTS = ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治'];
  var SUBJECTS_BY_GRADE = {
    10: SUBJECTS.slice(),
    11: SUBJECTS.slice(),
    12: SUBJECTS.slice()
  };
  var SUBJECT_PRACTICE_COUNT = 6;
  var MIXED_PRACTICE_COUNT = 12;
  var ADVANCED_PRACTICE_RATIO = 0.4;
  var ADVANCED_DIFFICULTY = 2;

  function hashString(text) {
    var hash = 2166136261;
    for (var i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function createRng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function shuffle(list, rng) {
    var result = list.slice();
    for (var i = result.length - 1; i > 0; i -= 1) {
      var j = Math.floor(rng() * (i + 1));
      var temp = result[i];
      result[i] = result[j];
      result[j] = temp;
    }
    return result;
  }

  function createSeed() {
    return (Date.now() ^ Math.floor(Math.random() * 4294967296)) >>> 0;
  }

  function gradeName(grade) {
    return GRADE_NAMES[grade] || '';
  }

  function subjectsOf(grade) {
    return (SUBJECTS_BY_GRADE[grade] || []).slice();
  }

  function allSubjects() {
    return SUBJECTS.slice();
  }

  function isGaokao(grade) {
    return grade === 12;
  }

  function examPlan(grade) {
    if (isGaokao(grade)) {
      return { count: 15, pass: 12, title: '高考' };
    }
    return { count: 12, pass: 10, title: gradeName(grade) + '考试' };
  }

  function difficultyOf(question) {
    return question && question.difficulty === ADVANCED_DIFFICULTY
      ? ADVANCED_DIFFICULTY
      : 1;
  }

  function splitByDifficulty(pool, rng) {
    var advanced = [];
    var basic = [];
    for (var i = 0; i < pool.length; i += 1) {
      if (difficultyOf(pool[i]) === ADVANCED_DIFFICULTY) {
        advanced.push(pool[i]);
      } else {
        basic.push(pool[i]);
      }
    }
    return {
      advanced: shuffle(advanced, rng),
      basic: shuffle(basic, rng)
    };
  }

  function pickPractice(pool, count, rng) {
    var groups = splitByDifficulty(pool, rng);
    var target = Math.min(
      groups.advanced.length,
      Math.min(count, Math.max(1, Math.round(count * ADVANCED_PRACTICE_RATIO)))
    );
    var picked = groups.advanced.slice(0, target).concat(groups.basic.slice(0, count - target));
    if (picked.length < count) {
      var used = {};
      for (var i = 0; i < picked.length; i += 1) {
        used[picked[i].id] = true;
      }
      var rest = shuffle(pool, rng);
      for (var j = 0; j < rest.length && picked.length < count; j += 1) {
        if (!used[rest[j].id]) {
          picked.push(rest[j]);
          used[rest[j].id] = true;
        }
      }
    }
    return shuffle(picked, rng);
  }

  function questionsOf(data, grade, subject) {
    var pool = [];
    for (var i = 0; i < data.length; i += 1) {
      if (data[i].grade === grade && (subject === '综合' || data[i].subject === subject)) {
        pool.push(data[i]);
      }
    }
    return pool;
  }

  function countFor(data, grade) {
    return questionsOf(data, grade, '综合').length;
  }

  function buildPractice(data, grade, subject, seed) {
    var rng = createRng(hashString(String(seed) + '#practice#' + grade + '#' + subject));
    var pool = questionsOf(data, grade, subject);
    var count = subject === '综合' ? MIXED_PRACTICE_COUNT : SUBJECT_PRACTICE_COUNT;
    return pickPractice(pool, Math.min(count, pool.length), rng);
  }

  function buildExam(data, grade, seed) {
    var subjects = subjectsOf(grade);
    var plan = examPlan(grade);
    var rng = createRng(hashString(String(seed) + '#exam#' + grade));
    var pools = {};
    for (var s = 0; s < subjects.length; s += 1) {
      var groups = splitByDifficulty(questionsOf(data, grade, subjects[s]), rng);
      pools[subjects[s]] = groups.advanced.concat(groups.basic);
    }
    var paper = [];
    var cursor = 0;
    var guard = 0;
    while (paper.length < plan.count && guard < 600) {
      var subject = subjects[cursor % subjects.length];
      var pool = pools[subject];
      if (pool.length) {
        paper.push(pool.shift());
      }
      cursor += 1;
      guard += 1;
    }
    return paper;
  }

  global.HighQuizEngine = {
    GRADES: GRADES,
    GRADE_NAMES: GRADE_NAMES,
    SUBJECTS: SUBJECTS,
    SUBJECTS_BY_GRADE: SUBJECTS_BY_GRADE,
    SUBJECT_PRACTICE_COUNT: SUBJECT_PRACTICE_COUNT,
    MIXED_PRACTICE_COUNT: MIXED_PRACTICE_COUNT,
    ADVANCED_PRACTICE_RATIO: ADVANCED_PRACTICE_RATIO,
    ADVANCED_DIFFICULTY: ADVANCED_DIFFICULTY,
    gradeName: gradeName,
    subjectsOf: subjectsOf,
    allSubjects: allSubjects,
    isGaokao: isGaokao,
    examPlan: examPlan,
    difficultyOf: difficultyOf,
    questionsOf: questionsOf,
    countFor: countFor,
    buildPractice: buildPractice,
    buildExam: buildExam,
    createSeed: createSeed,
    hashString: hashString,
    createRng: createRng,
    shuffle: shuffle
  };
}(typeof window !== 'undefined' ? window : this));
