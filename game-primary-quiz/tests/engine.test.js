'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'dist', 'data.js'), 'utf8'), sandbox);
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'dist', 'engine.js'), 'utf8'), sandbox);

const data = sandbox.window.PRIMARY_QUIZ_DATA;
const Engine = sandbox.window.PrimaryQuizEngine;

assert.strictEqual(data.length, 168, '168 questions');

const ids = new Set();
const countByKey = {};
const olympiadByKey = {};
data.forEach((q) => {
  assert.ok(q.id && !ids.has(q.id), 'unique id: ' + q.id);
  ids.add(q.id);
  assert.ok(q.grade >= 1 && q.grade <= 6, 'grade range: ' + q.id);
  assert.ok(Engine.SUBJECTS.indexOf(q.subject) !== -1, 'subject: ' + q.id);
  assert.ok(q.prompt && q.prompt.length >= 4, 'prompt: ' + q.id);
  assert.strictEqual(q.options.length, 4, 'four options: ' + q.id);
  assert.strictEqual(new Set(q.options).size, 4, 'unique options: ' + q.id);
  assert.ok(q.answer >= 0 && q.answer < 4, 'answer index: ' + q.id);
  assert.ok(q.explanation && q.explanation.length >= 4, 'explanation: ' + q.id);
  const key = q.grade + '-' + q.subject;
  if (q.difficulty === 'olympiad') {
    olympiadByKey[key] = (olympiadByKey[key] || 0) + 1;
  } else {
    countByKey[key] = (countByKey[key] || 0) + 1;
  }
});
Object.keys(countByKey).forEach((key) => {
  assert.strictEqual(countByKey[key], 5, 'five standard questions for ' + key);
});
Object.keys(olympiadByKey).forEach((key) => {
  assert.strictEqual(olympiadByKey[key], 2, 'two olympiad questions for ' + key);
});
assert.strictEqual(Object.keys(countByKey).length, 24, '6 grades x 4 standard subjects');
assert.strictEqual(Object.keys(olympiadByKey).length, 24, '6 grades x 4 olympiad subjects');

const seed = 123456789;
const paper = Engine.buildPaper(data, seed);
assert.strictEqual(paper.length, 24, '24 questions per paper');
assert.strictEqual(new Set(paper.map((q) => q.id)).size, 24, 'paper has no duplicate questions');
assert.strictEqual(paper.every((q) => q.difficulty !== 'olympiad'), true, 'ladder excludes olympiad');
for (let grade = 1; grade <= 6; grade += 1) {
  const gradeQuestions = paper.filter((q) => q.grade === grade);
  assert.strictEqual(gradeQuestions.length, 4, 'four questions for grade ' + grade);
  const subjects = gradeQuestions.map((q) => q.subject).sort().join(',');
  assert.strictEqual(subjects, Engine.SUBJECTS.slice().sort().join(','), 'one question per subject for grade ' + grade);
}

const paperAgain = Engine.buildPaper(data, seed);
assert.strictEqual(JSON.stringify(paper), JSON.stringify(paperAgain), 'same seed is deterministic');

assert.strictEqual(Engine.isPass(3), true, '3 correct passes');
assert.strictEqual(Engine.isPass(2), false, '2 correct does not pass');
assert.strictEqual(Engine.isPass(3, 5), true, '3 of 5 passes');
assert.strictEqual(Engine.isPass(2, 5), false, '2 of 5 does not pass');

const gradePaper = Engine.buildGradePaper(data, 4, seed);
assert.strictEqual(gradePaper.length, 4, 'grade paper has 4 questions');
assert.strictEqual(gradePaper.every((q) => q.grade === 4 && q.difficulty !== 'olympiad'), true, 'grade paper standard');
assert.strictEqual(new Set(gradePaper.map((q) => q.subject)).size, 4, 'grade paper covers all subjects');
assert.strictEqual(JSON.stringify(gradePaper), JSON.stringify(Engine.buildGradePaper(data, 4, seed)), 'grade paper deterministic');

const subjectPaper = Engine.buildSubjectPaper(data, '语文', 5, seed);
assert.strictEqual(subjectPaper.length, 5, 'subject paper has 5 questions');
assert.strictEqual(subjectPaper.every((q) => q.grade === 5 && q.subject === '语文' && q.difficulty !== 'olympiad'), true, 'subject paper filters standard');

const practiceAll = Engine.buildPracticePaper(data, '综合', 4, 'lower', seed, 10);
assert.strictEqual(practiceAll.length, 10, 'practice paper has 10 questions');
assert.strictEqual(practiceAll.every((q) => q.grade <= 4 && q.difficulty !== 'olympiad'), true, 'standard practice includes current and lower grades');

const practiceOneSubject = Engine.buildPracticePaper(data, '语文', 4, 'lower', seed, 10);
assert.strictEqual(practiceOneSubject.length, 10, 'subject practice mixes lower grades');
assert.strictEqual(practiceOneSubject.every((q) => q.subject === '语文' && q.grade <= 4 && q.difficulty !== 'olympiad'), true, 'subject practice filters');

const practiceSameGrade = Engine.buildPracticePaper(data, '语文', 4, 'same', seed, 10);
assert.strictEqual(practiceSameGrade.length, 5, 'same-grade practice is limited by pool');

const olympiadAll = Engine.buildPracticePaper(data, '综合', 4, 'olympiad', seed, 10);
assert.strictEqual(olympiadAll.length, 10, 'olympiad practice has 10 questions');
assert.strictEqual(olympiadAll.every((q) => q.grade <= 4 && q.difficulty === 'olympiad'), true, 'olympiad practice filters');

const olympiadMath = Engine.buildPracticePaper(data, '数学', 4, 'olympiad', seed, 10);
assert.strictEqual(olympiadMath.length, 8, 'olympiad subject pool is limited');

const examPaper = Engine.buildExamPaper(data, 4, seed);
assert.strictEqual(examPaper.length, 4, 'exam has 4 questions');
assert.strictEqual(examPaper.every((q) => q.difficulty !== 'olympiad'), true, 'exam excludes olympiad');
assert.strictEqual(new Set(examPaper.map((q) => q.subject)).size, 4, 'exam covers all subjects');
assert.strictEqual(Engine.gradeName(4), '四年级', 'grade name');
assert.strictEqual(Engine.resultTitle(6), '小学毕业水准', 'grade six title');
assert.strictEqual(Engine.resultTitle(0), '还没通关一年级', 'grade zero title');
assert.strictEqual(typeof Engine.createSeed(), 'number', 'seed is a number');

console.log('primary quiz engine tests passed');
