/*
 * 装修流程手册 · 纯逻辑
 * 预算估算、自测计分、流程进度。可在 Node 中测试。
 */
(function (root) {
  'use strict';

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function roundToHundred(value) {
    return Math.round(value / 100) * 100;
  }

  function calculateBudget(data, area, tierId, oldHouse) {
    var square = Number(area);
    if (!isFinite(square) || square < 10 || square > 1000) return null;
    var tier = null;
    for (var i = 0; i < data.budgetTiers.length; i += 1) {
      if (data.budgetTiers[i].id === tierId) tier = data.budgetTiers[i];
    }
    if (!tier) return null;
    var factor = oldHouse ? data.oldHouseFactor : 1;
    var low = roundToHundred(square * tier.low * factor);
    var high = roundToHundred(square * tier.high * factor);
    var items = [];
    for (var j = 0; j < data.budgetBreakdown.length; j += 1) {
      var part = data.budgetBreakdown[j];
      items.push({
        name: part.name,
        low: roundToHundred(low * part.share),
        high: roundToHundred(high * part.share)
      });
    }
    return {
      area: square,
      tier: tier.name,
      oldHouse: !!oldHouse,
      low: low,
      high: high,
      items: items
    };
  }

  function gradeFor(percent) {
    if (percent >= 92) return '专家级避坑';
    if (percent >= 75) return '老练业主';
    if (percent >= 50) return '入门选手';
    return '装修新手';
  }

  function scoreQuiz(quiz, answers) {
    var correct = 0;
    for (var i = 0; i < quiz.length; i += 1) {
      if (answers[i] === quiz[i].answer) correct += 1;
    }
    var percent = quiz.length ? Math.round(correct / quiz.length * 100) : 0;
    return {
      correct: correct,
      total: quiz.length,
      percent: percent,
      title: gradeFor(percent)
    };
  }

  function stageProgress(total, doneIds) {
    var done = Array.isArray(doneIds) ? doneIds.length : 0;
    if (!total) return { done: 0, total: 0, percent: 0 };
    var capped = clamp(done, 0, total);
    return {
      done: capped,
      total: total,
      percent: Math.round(capped / total * 100)
    };
  }

  function formatRange(low, high) {
    function format(value) {
      return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
    return '¥' + format(low) + '–' + format(high);
  }

  root.RenovationEngine = {
    calculateBudget: calculateBudget,
    scoreQuiz: scoreQuiz,
    stageProgress: stageProgress,
    gradeFor: gradeFor,
    formatRange: formatRange
  };
}(typeof window !== 'undefined' ? window : this));
