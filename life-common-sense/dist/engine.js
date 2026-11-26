/*
 * 生活常识小考 · 组卷与判分引擎
 * 纯逻辑，不依赖 DOM，可在 Node 中测试。
 */
(function (global) {
  'use strict';

  function createRng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function hashString(text) {
    var hash = 2166136261;
    for (var i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function createSeed() {
    return (Date.now() ^ Math.floor(Math.random() * 4294967296)) >>> 0;
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

  function byCategory(questions, category) {
    if (!category || category === 'all') return questions.slice();
    return questions.filter(function (q) {
      return q.category === category;
    });
  }

  function selectPractice(questions, category, count, seed) {
    var rng = createRng(hashString(String(seed) + '#practice#' + category));
    var pool = byCategory(questions, category);
    return shuffle(pool, rng).slice(0, Math.min(count, pool.length));
  }

  function selectChallenge(questions, categories, count, seed) {
    var rng = createRng(hashString(String(seed) + '#challenge'));
    var pools = [];
    var i;
    for (i = 0; i < categories.length; i += 1) {
      pools.push(shuffle(byCategory(questions, categories[i].id), rng));
    }
    var paper = [];
    var cursor = 0;
    var guard = 0;
    while (paper.length < count && guard < 400) {
      var pool = pools[cursor % pools.length];
      if (pool.length) paper.push(pool.shift());
      cursor += 1;
      guard += 1;
    }
    if (paper.length < count) {
      var used = {};
      for (i = 0; i < paper.length; i += 1) used[paper[i].id] = true;
      var rest = shuffle(questions, rng);
      for (i = 0; i < rest.length && paper.length < count; i += 1) {
        if (!used[rest[i].id]) paper.push(rest[i]);
      }
    }
    return paper;
  }

  function selectByIds(questions, ids, count, seed) {
    var rng = createRng(hashString(String(seed) + '#wrong'));
    var pool = questions.filter(function (q) {
      return ids.indexOf(q.id) !== -1;
    });
    return shuffle(pool, rng).slice(0, Math.min(count, pool.length));
  }

  function grade(paper, answers) {
    var correct = 0;
    var wrong = [];
    for (var i = 0; i < paper.length; i += 1) {
      if (answers[i] === paper[i].answer) {
        correct += 1;
      } else {
        wrong.push(paper[i]);
      }
    }
    return {
      correct: correct,
      total: paper.length,
      wrong: wrong,
      accuracy: paper.length ? Math.round(correct / paper.length * 100) : 0
    };
  }

  function updateWrongBook(book, paper, answers) {
    var next = {};
    var id;
    for (id in book) {
      if (Object.prototype.hasOwnProperty.call(book, id)) {
        next[id] = { count: book[id].count || 1 };
      }
    }
    for (var i = 0; i < paper.length; i += 1) {
      var qid = paper[i].id;
      if (answers[i] === paper[i].answer) {
        delete next[qid];
      } else {
        next[qid] = { count: (next[qid] && next[qid].count ? next[qid].count : 0) + 1 };
      }
    }
    return next;
  }

  function wrongBookList(book, questions) {
    var map = {};
    for (var i = 0; i < questions.length; i += 1) map[questions[i].id] = questions[i];
    var list = [];
    for (var id in book) {
      if (Object.prototype.hasOwnProperty.call(book, id) && map[id]) {
        list.push(map[id]);
      }
    }
    return list;
  }

  function countByCategory(questions, categories) {
    var counts = {};
    for (var i = 0; i < categories.length; i += 1) counts[categories[i].id] = 0;
    for (var j = 0; j < questions.length; j += 1) {
      if (counts[questions[j].category] != null) counts[questions[j].category] += 1;
    }
    return counts;
  }

  function accuracy(correct, total) {
    return total ? Math.round(correct / total * 100) : 0;
  }

  global.LifeQuizEngine = {
    createRng: createRng,
    hashString: hashString,
    createSeed: createSeed,
    shuffle: shuffle,
    selectPractice: selectPractice,
    selectChallenge: selectChallenge,
    selectByIds: selectByIds,
    grade: grade,
    updateWrongBook: updateWrongBook,
    wrongBookList: wrongBookList,
    countByCategory: countByCategory,
    accuracy: accuracy
  };
}(typeof window !== 'undefined' ? window : this));
