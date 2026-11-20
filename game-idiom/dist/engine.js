(function (global) {
  'use strict';

  var DISTRACTORS = '天地人山水火木金土日月星风雨云花草鸟鱼虫心手口目耳足大小多少上下左右春夏秋冬东南西北红黄蓝绿白黑江河湖海林泉石田禾米竹松梅兰菊';

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

  function pad2(value) {
    return (value < 10 ? '0' : '') + value;
  }

  function dateKeyOf(date) {
    return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
  }

  function parseDateKey(key) {
    var parts = String(key).split('-');
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }

  function addDays(date, amount) {
    var next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    next.setDate(next.getDate() + amount);
    return next;
  }

  function pickDistractors(word, rng) {
    var pool = [];
    for (var i = 0; i < DISTRACTORS.length; i += 1) {
      var character = DISTRACTORS.charAt(i);
      if (word.indexOf(character) === -1 && pool.indexOf(character) === -1) {
        pool.push(character);
      }
    }
    var shuffled = shuffle(pool, rng);
    return shuffled.slice(0, 2);
  }

  function buildQuestion(item, dateKey, index) {
    var chars = item.word.split('');
    if (chars.length !== 4) {
      throw new Error('idiom must have four characters: ' + item.word);
    }
    var rng = createRng(hashString(dateKey + '#' + index + '#' + item.word));
    var distractors = pickDistractors(item.word, rng);
    var tiles = shuffle(chars.concat(distractors), rng);
    return {
      word: item.word,
      clue: item.clue,
      note: item.note,
      chars: chars,
      tiles: tiles
    };
  }

  var CYCLE_EPOCH_DAY = Math.floor(Date.UTC(2026, 0, 1) / 86400000);

  function dayNumber(dateKey) {
    var parts = String(dateKey).split('-');
    return Math.floor(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])) / 86400000);
  }

  function buildDaily(data, dateKey, count) {
    count = count || 5;
    /*
     * 以题库长度和每日题数计算周期天数。每个周期重新洗牌，
     * 周期内每天取连续的一段，保证同一周期内不重复。
     */
    var cycleDays = Math.max(1, Math.floor(data.length / count));
    var offset = dayNumber(dateKey) - CYCLE_EPOCH_DAY;
    var cycleIndex = Math.floor(offset / cycleDays);
    var dayIndex = ((offset % cycleDays) + cycleDays) % cycleDays;
    var rng = createRng(hashString('cycle:' + cycleIndex));
    var ordered = shuffle(data, rng);
    var start = dayIndex * count;
    var picked = ordered.slice(start, start + count);
    return picked.map(function (item, index) {
      return buildQuestion(item, dateKey, index);
    });
  }

  function scoreForAttempts(attempts) {
    if (attempts <= 0) {
      return 1;
    }
    if (attempts === 1) {
      return 0.5;
    }
    return 0;
  }

  function computeStreak(history, todayKey) {
    var count = 0;
    var cursor = parseDateKey(todayKey);
    while (Object.prototype.hasOwnProperty.call(history, dateKeyOf(cursor))) {
      count += 1;
      cursor = addDays(cursor, -1);
    }
    return count;
  }

  function formatScore(score) {
    var rounded = Math.round(score * 10) / 10;
    return rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1);
  }

  global.IdiomEngine = {
    hashString: hashString,
    dateKeyOf: dateKeyOf,
    parseDateKey: parseDateKey,
    addDays: addDays,
    buildQuestion: buildQuestion,
    buildDaily: buildDaily,
    scoreForAttempts: scoreForAttempts,
    computeStreak: computeStreak,
    formatScore: formatScore
  };
}(typeof window !== 'undefined' ? window : this));
