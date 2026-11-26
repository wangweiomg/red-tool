/*
 * 初中回忆杀 · 规则引擎
 * 三册（七/八/九年级）题库、练习与考试组卷、判分与解锁，纯逻辑可测试。
 */
(function (global) {
  'use strict';

  var GRADES = [7, 8, 9];
  var GRADE_NAMES = { 7: '七年级', 8: '八年级', 9: '九年级' };
  var SUBJECTS_BY_GRADE = {
    7: ['语文', '数学', '英语', '生物', '历史', '地理', '道德与法治'],
    8: ['语文', '数学', '英语', '物理', '生物', '历史', '地理', '道德与法治'],
    9: ['语文', '数学', '英语', '物理', '化学', '历史', '道德与法治']
  };
  var EXAM_COUNT = 10;
  var PASS_CORRECT = 8;
  var SUBJECT_PRACTICE_COUNT = 5;
  var MIXED_PRACTICE_COUNT = 10;

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
    var seen = {};
    var list = [];
    for (var g = 0; g < GRADES.length; g += 1) {
      var subjects = SUBJECTS_BY_GRADE[GRADES[g]];
      for (var s = 0; s < subjects.length; s += 1) {
        if (!seen[subjects[s]]) {
          seen[subjects[s]] = true;
          list.push(subjects[s]);
        }
      }
    }
    return list;
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
    return shuffle(pool, rng).slice(0, Math.min(count, pool.length));
  }

  function buildExam(data, grade, seed) {
    var subjects = subjectsOf(grade);
    var rng = createRng(hashString(String(seed) + '#exam#' + grade));
    var pools = {};
    for (var s = 0; s < subjects.length; s += 1) {
      pools[subjects[s]] = shuffle(questionsOf(data, grade, subjects[s]), rng);
    }
    var paper = [];
    var cursor = 0;
    var guard = 0;
    while (paper.length < EXAM_COUNT && guard < 400) {
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

  function isGraduation(grade) {
    return grade === 9;
  }

  global.JuniorQuizEngine = {
    GRADES: GRADES,
    GRADE_NAMES: GRADE_NAMES,
    SUBJECTS_BY_GRADE: SUBJECTS_BY_GRADE,
    EXAM_COUNT: EXAM_COUNT,
    PASS_CORRECT: PASS_CORRECT,
    SUBJECT_PRACTICE_COUNT: SUBJECT_PRACTICE_COUNT,
    MIXED_PRACTICE_COUNT: MIXED_PRACTICE_COUNT,
    gradeName: gradeName,
    subjectsOf: subjectsOf,
    allSubjects: allSubjects,
    questionsOf: questionsOf,
    countFor: countFor,
    buildPractice: buildPractice,
    buildExam: buildExam,
    isGraduation: isGraduation,
    createSeed: createSeed,
    hashString: hashString,
    createRng: createRng,
    shuffle: shuffle
  };
}(typeof window !== 'undefined' ? window : this));
