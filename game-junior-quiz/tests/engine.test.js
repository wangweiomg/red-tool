'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'dist', 'engine.js'), 'utf8'), sandbox);
const Engine = sandbox.window.JuniorQuizEngine;

const dataSandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'dist', 'data.js'), 'utf8'), dataSandbox);
const Data = dataSandbox.window.JUNIOR_QUIZ_DATA;

assert.ok(Engine, 'engine exists');
assert.ok(Array.isArray(Data) && Data.length > 0, 'data exists');
assert.strictEqual(Engine.GRADES.join(','), '7,8,9');
assert.strictEqual(Engine.EXAM_COUNT, 10);
assert.strictEqual(Engine.PASS_CORRECT, 8);
assert.strictEqual(Engine.SUBJECT_PRACTICE_COUNT, 5);

// 数据结构
const ids = {};
for (const q of Data) {
  assert.ok([7, 8, 9].indexOf(q.grade) !== -1, 'valid grade ' + q.id);
  assert.ok(Engine.subjectsOf(q.grade).indexOf(q.subject) !== -1, 'subject in grade ' + q.id);
  assert.strictEqual(q.options.length, 4, 'four options ' + q.id);
  assert.ok(q.answer >= 0 && q.answer < 4, 'answer range ' + q.id);
  assert.ok(q.prompt && q.explanation, 'prompt and explanation ' + q.id);
  assert.ok(!ids[q.id], 'unique id ' + q.id);
  ids[q.id] = true;
}

// 每个年级每个科目至少 5 题
for (const grade of Engine.GRADES) {
  for (const subject of Engine.subjectsOf(grade)) {
    const pool = Engine.questionsOf(Data, grade, subject);
    assert.ok(pool.length >= Engine.SUBJECT_PRACTICE_COUNT, 'enough questions ' + grade + subject);
  }
}

// 练习组卷
const practice = Engine.buildPractice(Data, 7, '数学', 12345);
assert.strictEqual(practice.length, 5);
assert.ok(practice.every((q) => q.grade === 7 && q.subject === '数学'));

const mixed = Engine.buildPractice(Data, 8, '综合', 12345);
assert.strictEqual(mixed.length, 10);
assert.ok(mixed.every((q) => q.grade === 8));
assert.ok(new Set(mixed.map((q) => q.subject)).size > 1, 'mixed covers subjects');

// 考试组卷
const exam = Engine.buildExam(Data, 9, 999);
assert.strictEqual(exam.length, 10);
assert.ok(exam.every((q) => q.grade === 9));
assert.strictEqual(new Set(exam.map((q) => q.id)).size, 10, 'no duplicate questions');
assert.ok(new Set(exam.map((q) => q.subject)).size >= 4, 'exam covers multiple subjects');

// 确定性
const exam2 = Engine.buildExam(Data, 9, 999);
assert.deepStrictEqual(exam.map((q) => q.id), exam2.map((q) => q.id));

// 年级信息
assert.strictEqual(Engine.gradeName(8), '八年级');
assert.strictEqual(Engine.isGraduation(9), true);
assert.strictEqual(Engine.isGraduation(8), false);
assert.ok(Engine.subjectsOf(8).indexOf('物理') !== -1);
assert.ok(Engine.subjectsOf(9).indexOf('化学') !== -1);

console.log('junior-quiz engine tests passed, questions:', Data.length);
