(function (global) {
  'use strict';

  var GRADES = [1, 2, 3, 4, 5, 6];
  var SUBJECTS = ['语文', '数学', '英语', '科学'];
  var QUESTIONS_PER_GRADE = 4;
  var PASS_CORRECT = 3;
  var TOTAL_QUESTIONS = GRADES.length * QUESTIONS_PER_GRADE;

  var GRADE_NAMES = ['', '一年级', '二年级', '三年级', '四年级', '五年级', '六年级'];

  function hashString(text) {
    var hash = 2166136261;
    for (var i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function createRng(seed) {
    var state = seed >>> 0;
    return function () {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
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

  function isStandard(question) {
    return question.difficulty !== 'olympiad';
  }

  function filterPool(data, grade, subject) {
    var pool = [];
    for (var i = 0; i < data.length; i += 1) {
      if (data[i].grade === grade && data[i].subject === subject && isStandard(data[i])) {
        pool.push(data[i]);
      }
    }
    return pool;
  }

  function buildLadderPaper(data, seed) {
    var paper = [];
    var seedText = String(seed);
    for (var g = 0; g < GRADES.length; g += 1) {
      var grade = GRADES[g];
      for (var s = 0; s < SUBJECTS.length; s += 1) {
        var subject = SUBJECTS[s];
        var pool = filterPool(data, grade, subject);
        if (!pool.length) {
          throw new Error('missing questions for grade ' + grade + ' subject ' + subject);
        }
        var rng = createRng(hashString(seedText + '#ladder#' + grade + '#' + subject));
        paper.push(shuffle(pool, rng)[0]);
      }
    }
    return paper;
  }

  function buildGradePaper(data, grade, seed) {
    var paper = [];
    var seedText = String(seed);
    for (var s = 0; s < SUBJECTS.length; s += 1) {
      var subject = SUBJECTS[s];
      var pool = filterPool(data, grade, subject);
      if (!pool.length) {
        throw new Error('missing questions for grade ' + grade + ' subject ' + subject);
      }
      var rng = createRng(hashString(seedText + '#grade#' + grade + '#' + subject));
      paper.push(shuffle(pool, rng)[0]);
    }
    return paper;
  }

  function buildSubjectPaper(data, subject, grade, seed) {
    var pool = filterPool(data, grade, subject);
    if (!pool.length) {
      throw new Error('missing questions for grade ' + grade + ' subject ' + subject);
    }
    var rng = createRng(hashString(String(seed) + '#subject#' + grade + '#' + subject));
    return shuffle(pool, rng).slice(0, Math.min(pool.length, 5));
  }

  function buildPracticePaper(data, subject, grade, range, seed, count) {
    count = count || 10;
    range = range === 'same' || range === 'olympiad' ? range : 'lower';
    var pool = [];
    for (var i = 0; i < data.length; i += 1) {
      var question = data[i];
      var olympiad = question.difficulty === 'olympiad';
      if (range === 'olympiad') {
        if (!olympiad) {
          continue;
        }
      } else if (olympiad) {
        continue;
      }
      var gradeOk = range === 'same' ? question.grade === grade : question.grade <= grade;
      var subjectOk = subject === '综合' || question.subject === subject;
      if (gradeOk && subjectOk) {
        pool.push(question);
      }
    }
    if (!pool.length) {
      throw new Error('missing practice questions for grade ' + grade + ' subject ' + subject);
    }
    var rng = createRng(hashString(
      String(seed) + '#practice#' + subject + '#' + grade + '#' + range
    ));
    return shuffle(pool, rng).slice(0, Math.min(pool.length, count));
  }

  function buildExamPaper(data, grade, seed) {
    return buildGradePaper(data, grade, seed);
  }

  // 兼容旧调用：默认综合定级卷。
  function buildPaper(data, seed) {
    return buildLadderPaper(data, seed);
  }

  function isPass(correct, total) {
    total = total || QUESTIONS_PER_GRADE;
    return correct >= Math.ceil(total * 0.6);
  }

  function gradeName(grade) {
    return GRADE_NAMES[grade] || '';
  }

  function resultTitle(grade) {
    if (grade <= 0) {
      return '还没通关一年级';
    }
    if (grade >= 6) {
      return '小学毕业水准';
    }
    return '小学' + gradeName(grade) + '水准';
  }

  global.PrimaryQuizEngine = {
    GRADES: GRADES,
    SUBJECTS: SUBJECTS,
    QUESTIONS_PER_GRADE: QUESTIONS_PER_GRADE,
    PASS_CORRECT: PASS_CORRECT,
    TOTAL_QUESTIONS: TOTAL_QUESTIONS,
    createSeed: createSeed,
    buildLadderPaper: buildLadderPaper,
    buildGradePaper: buildGradePaper,
    buildSubjectPaper: buildSubjectPaper,
    buildPracticePaper: buildPracticePaper,
    buildExamPaper: buildExamPaper,
    buildPaper: buildPaper,
    isPass: isPass,
    gradeName: gradeName,
    resultTitle: resultTitle,
    hashString: hashString
  };
}(typeof window !== 'undefined' ? window : this));
