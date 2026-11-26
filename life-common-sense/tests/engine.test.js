'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const sandbox = { window: {} };
vm.runInNewContext(
  fs.readFileSync(path.join(__dirname, '..', 'dist', 'data.js'), 'utf8'),
  sandbox
);
vm.runInNewContext(
  fs.readFileSync(path.join(__dirname, '..', 'dist', 'engine.js'), 'utf8'),
  sandbox
);

const Data = sandbox.window.LIFE_QUIZ_DATA;
const Engine = sandbox.window.LifeQuizEngine;
const Meta = Data.meta;
const Qs = Data.questions;

assert.ok(Data && Engine, 'data and engine exist');
assert.strictEqual(Meta.categories.length, 7, 'seven categories');
assert.strictEqual(Qs.length, 210, '210 questions');
assert.strictEqual(Meta.practiceCount, 10, 'practice count');
assert.strictEqual(Meta.challengeCount, 20, 'challenge count');
assert.strictEqual(Meta.challengePass, 16, 'challenge pass line');

const catIds = {};
for (const cat of Meta.categories) {
  assert.ok(cat.id && cat.name && cat.badge && cat.desc, 'category fields ' + cat.id);
  assert.ok(!catIds[cat.id], 'unique category ' + cat.id);
  catIds[cat.id] = true;
}

const ids = {};
for (const q of Qs) {
  assert.ok(q.id && q.prompt && q.explanation, 'question fields ' + q.id);
  assert.ok(catIds[q.category], 'valid category ' + q.id);
  assert.strictEqual(q.options.length, 4, 'four options ' + q.id);
  assert.ok(q.answer >= 0 && q.answer < 4, 'answer range ' + q.id);
  assert.ok(!ids[q.id], 'unique question ' + q.id);
  ids[q.id] = true;
}

const counts = Engine.countByCategory(Qs, Meta.categories);
for (const cat of Meta.categories) {
  assert.strictEqual(counts[cat.id], 30, '30 questions for ' + cat.id);
}

// 分类练习
const work = Engine.selectPractice(Qs, 'work', Meta.practiceCount, 12345);
assert.strictEqual(work.length, 10);
assert.ok(work.every((q) => q.category === 'work'));

const allPractice = Engine.selectPractice(Qs, 'all', Meta.practiceCount, 12345);
assert.strictEqual(allPractice.length, 10);

const work2 = Engine.selectPractice(Qs, 'work', Meta.practiceCount, 12345);
assert.deepStrictEqual(work.map((q) => q.id), work2.map((q) => q.id), 'deterministic practice');

// 综合挑战：20 题，七类尽量均衡
const challenge = Engine.selectChallenge(Qs, Meta.categories, Meta.challengeCount, 777);
assert.strictEqual(challenge.length, 20);
assert.strictEqual(new Set(challenge.map((q) => q.id)).size, 20, 'no duplicate challenge questions');
const challengeCounts = Engine.countByCategory(challenge, Meta.categories);
let challengeSum = 0;
for (const cat of Meta.categories) {
  assert.ok(challengeCounts[cat.id] === 2 || challengeCounts[cat.id] === 3,
    'balanced challenge ' + cat.id + ': ' + challengeCounts[cat.id]);
  challengeSum += challengeCounts[cat.id];
}
assert.strictEqual(challengeSum, 20);

// 判分
const paper = [Qs[0], Qs[1], Qs[2]];
const answers = [Qs[0].answer, Qs[1].answer === 0 ? 1 : 0, Qs[2].answer];
const result = Engine.grade(paper, answers);
assert.strictEqual(result.correct, 2);
assert.strictEqual(result.total, 3);
assert.strictEqual(result.wrong.length, 1);
assert.strictEqual(result.wrong[0].id, Qs[1].id);
assert.strictEqual(result.accuracy, 67);

// 错题本
let book = {};
book = Engine.updateWrongBook(book, paper, answers);
assert.ok(book[Qs[1].id], 'wrong question added');
assert.strictEqual(book[Qs[1].id].count, 1);
book = Engine.updateWrongBook(book, [Qs[1]], [Qs[1].answer]);
assert.ok(!book[Qs[1].id], 'correct answer removes wrong question');

// 错题重练
const wrongList = Engine.wrongBookList({ [Qs[3].id]: { count: 1 }, [Qs[4].id]: { count: 2 } }, Qs);
assert.strictEqual(wrongList.length, 2);
const retry = Engine.selectByIds(Qs, [Qs[3].id, Qs[4].id], 10, 99);
assert.strictEqual(retry.length, 2);
assert.ok(retry.every((q) => q.id === Qs[3].id || q.id === Qs[4].id));

assert.strictEqual(Engine.accuracy(16, 20), 80);
assert.strictEqual(Engine.accuracy(0, 0), 0);

console.log('life common sense tests passed, questions:', Qs.length);
