'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'dist', 'engine.js'), 'utf8'), sandbox);
const Engine = sandbox.window.HighQuizEngine;

const dataSandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'dist', 'data.js'), 'utf8'), dataSandbox);
const Data = dataSandbox.window.HIGH_QUIZ_DATA;

assert.ok(Engine, 'engine exists');
assert.ok(Array.isArray(Data) && Data.length > 0, 'data exists');
assert.strictEqual(Engine.GRADES.join(','), '10,11,12');
assert.strictEqual(Engine.SUBJECTS.length, 9);
assert.strictEqual(Engine.SUBJECT_PRACTICE_COUNT, 6);
assert.strictEqual(Engine.MIXED_PRACTICE_COUNT, 12);
assert.strictEqual(Engine.ADVANCED_DIFFICULTY, 2);
assert.strictEqual(Data.length, 162);

// 数据结构
const ids = {};
for (const q of Data) {
  assert.ok([10, 11, 12].indexOf(q.grade) !== -1, 'valid grade ' + q.id);
  assert.ok(Engine.subjectsOf(q.grade).indexOf(q.subject) !== -1, 'subject in grade ' + q.id);
  assert.strictEqual(q.options.length, 4, 'four options ' + q.id);
  assert.ok(q.answer >= 0 && q.answer < 4, 'answer range ' + q.id);
  assert.ok(q.prompt && q.explanation, 'prompt and explanation ' + q.id);
  assert.ok(!ids[q.id], 'unique id ' + q.id);
  ids[q.id] = true;
}

// 每科 6 题，其中 2 道进阶题
for (const grade of Engine.GRADES) {
  const gradePool = Engine.questionsOf(Data, grade, '综合');
  assert.strictEqual(gradePool.length, 54, '54 questions per grade ' + grade);
  assert.strictEqual(gradePool.filter((q) => Engine.difficultyOf(q) === 2).length, 18,
    '18 advanced questions per grade ' + grade);
  for (const subject of Engine.subjectsOf(grade)) {
    const pool = Engine.questionsOf(Data, grade, subject);
    assert.strictEqual(pool.length, 6, 'six questions ' + grade + subject);
    assert.strictEqual(pool.filter((q) => Engine.difficultyOf(q) === 2).length, 2,
      'two advanced questions ' + grade + subject);
  }
}

// 练习组卷
const practice = Engine.buildPractice(Data, 10, '物理', 12345);
assert.strictEqual(practice.length, 6);
assert.ok(practice.every((q) => q.grade === 10 && q.subject === '物理'));
assert.strictEqual(practice.filter((q) => Engine.difficultyOf(q) === 2).length, 2,
  'single-subject practice includes both advanced questions');

const mixed = Engine.buildPractice(Data, 11, '综合', 12345);
assert.strictEqual(mixed.length, 12);
assert.ok(mixed.every((q) => q.grade === 11));
assert.ok(mixed.filter((q) => Engine.difficultyOf(q) === 2).length >= 4,
  'mixed practice includes advanced questions');

// 考试与高考
const exam10 = Engine.buildExam(Data, 10, 777);
assert.strictEqual(exam10.length, 12);
assert.strictEqual(Engine.examPlan(10).pass, 10);
assert.ok(exam10.filter((q) => Engine.difficultyOf(q) === 2).length >= 9,
  'exam prioritizes advanced questions');

const gaokao = Engine.buildExam(Data, 12, 777);
assert.strictEqual(gaokao.length, 15);
assert.strictEqual(new Set(gaokao.map((q) => q.id)).size, 15, 'no duplicates');
assert.ok(new Set(gaokao.map((q) => q.subject)).size >= 6, 'gaokao covers subjects');
assert.ok(gaokao.filter((q) => Engine.difficultyOf(q) === 2).length >= 9,
  'gaokao prioritizes advanced questions');
assert.strictEqual(Engine.examPlan(12).title, '高考');
assert.strictEqual(Engine.examPlan(12).pass, 12);
assert.strictEqual(Engine.isGaokao(12), true);
assert.strictEqual(Engine.isGaokao(11), false);

// 确定性
const gaokao2 = Engine.buildExam(Data, 12, 777);
assert.deepStrictEqual(gaokao.map((q) => q.id), gaokao2.map((q) => q.id));

assert.strictEqual(Engine.gradeName(11), '高二');

console.log('high-quiz engine tests passed, questions:', Data.length);
