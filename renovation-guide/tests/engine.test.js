'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'dist', 'data.js'), 'utf8'), sandbox);
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'dist', 'engine.js'), 'utf8'), sandbox);

const Data = sandbox.window.RenovationData;
const Engine = sandbox.window.RenovationEngine;

assert.ok(Data, 'data exists');
assert.strictEqual(Data.stages.length, 10, 'ten stages');
assert.strictEqual(Data.materials.length, 30, 'thirty materials');
assert.strictEqual(Data.spaces.length, 5, 'five spaces');
assert.strictEqual(Data.quiz.length, 12, 'twelve quiz questions');
assert.strictEqual(Data.budgetTiers.length, 3, 'three budget tiers');

const stageIds = new Set();
Data.stages.forEach((stage) => {
  assert.ok(stage.id && !stageIds.has(stage.id), 'unique stage ' + stage.id);
  stageIds.add(stage.id);
  assert.ok(stage.name && stage.duration && stage.who, 'stage basics ' + stage.id);
  assert.ok(stage.goal, 'stage goal ' + stage.id);
  assert.ok(stage.actions.length >= 3, 'stage actions ' + stage.id);
  assert.ok(stage.acceptance.length >= 2, 'stage acceptance ' + stage.id);
  assert.ok(stage.pitfalls.length >= 2, 'stage pitfalls ' + stage.id);
  assert.ok(stage.oldHouse && stage.oldHouse.length >= 8, 'old house note ' + stage.id);
});

const catIds = new Set(Data.materialCategories.map((cat) => cat.id));
Data.materialCategories.forEach((cat) => {
  assert.ok(cat.id && cat.name, 'category ' + cat.id);
});
const materialIds = new Set();
Data.materials.forEach((item) => {
  assert.ok(item.id && !materialIds.has(item.id), 'unique material ' + item.id);
  materialIds.add(item.id);
  assert.ok(catIds.has(item.cat), 'material category ' + item.id);
  assert.ok(item.name && item.usage && item.metrics && item.grade, 'material fields ' + item.id);
  assert.ok(item.price && item.price.low > 0 && item.price.high >= item.price.low, 'price range ' + item.id);
  assert.ok(item.price.unit, 'price unit ' + item.id);
  assert.ok(item.tips.length >= 2, 'material tips ' + item.id);
  assert.ok(item.pitfalls.length >= 2, 'material pitfalls ' + item.id);
});
Data.materialCategories.forEach((cat) => {
  const count = Data.materials.filter((item) => item.cat === cat.id).length;
  assert.ok(count >= 3, 'enough materials for ' + cat.id);
});

Data.spaces.forEach((space) => {
  assert.ok(space.id && space.name, 'space ' + space.id);
  assert.ok(space.points.length >= 3, 'space points ' + space.id);
  assert.ok(space.overlooked.length >= 3, 'space overlooked ' + space.id);
});

Data.quiz.forEach((item) => {
  assert.ok(item.q && item.options.length === 4, 'quiz options ' + item.id);
  assert.ok(item.answer >= 0 && item.answer < 4, 'quiz answer ' + item.id);
  assert.ok(item.explain && item.explain.length >= 15, 'quiz explain ' + item.id);
});

// 预算：90㎡ 中档新房
const mid = Engine.calculateBudget(Data, 90, 'mid', false);
assert.ok(mid, 'budget result');
assert.strictEqual(mid.low, 162000, 'low estimate');
assert.strictEqual(mid.high, 225000, 'high estimate');
assert.strictEqual(mid.items.length, 6, 'six budget items');
const shareSum = Data.budgetBreakdown.reduce((sum, part) => sum + part.share, 0);
assert.ok(Math.abs(shareSum - 1) < 0.0001, 'shares sum to 1');

const old = Engine.calculateBudget(Data, 90, 'mid', true);
assert.ok(old.high > mid.high, 'old house costs more');
assert.strictEqual(old.high, Math.round(225000 * 1.15 / 100) * 100, 'old house factor applied');

assert.strictEqual(Engine.calculateBudget(Data, 5, 'mid', false), null, 'area too small');
assert.strictEqual(Engine.calculateBudget(Data, 90, 'unknown', false), null, 'unknown tier');

// 自测计分
const perfect = Data.quiz.map((item) => item.answer);
const perfectScore = Engine.scoreQuiz(Data.quiz, perfect);
assert.strictEqual(perfectScore.correct, 12);
assert.strictEqual(perfectScore.percent, 100);
assert.strictEqual(perfectScore.title, '专家级避坑');

const half = Data.quiz.map((item, index) => (index < 6 ? item.answer : (item.answer + 1) % 4));
const halfScore = Engine.scoreQuiz(Data.quiz, half);
assert.strictEqual(halfScore.correct, 6);
assert.strictEqual(halfScore.title, '入门选手');

const none = Engine.scoreQuiz(Data.quiz, Data.quiz.map(() => -1));
assert.strictEqual(none.correct, 0);
assert.strictEqual(none.title, '装修新手');

// 流程进度
const progress = Engine.stageProgress(10, ['prepare', 'demolish', 'mep']);
assert.strictEqual(progress.done, 3);
assert.strictEqual(progress.percent, 30);
assert.strictEqual(Engine.stageProgress(0, []).percent, 0);

assert.strictEqual(Engine.formatRange(162000, 225000), '¥162,000–225,000');

console.log('renovation-guide tests passed');
