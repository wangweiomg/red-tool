'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'dist', 'data.js'), 'utf8'), sandbox);
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'dist', 'engine.js'), 'utf8'), sandbox);

const data = sandbox.window.IDIOM_DATA;
const Engine = sandbox.window.IdiomEngine;

assert.strictEqual(data.length, 120, 'exactly 120 idioms');
const seen = {};
data.forEach((item) => {
  assert.strictEqual(item.word.length, 4, 'four-character idiom: ' + item.word);
  assert.strictEqual(seen[item.word], undefined, 'duplicate idiom: ' + item.word);
  assert.ok(item.clue && item.clue.length >= 6, 'clue for ' + item.word);
  assert.ok(item.note && item.note.length >= 6, 'note for ' + item.word);
  seen[item.word] = true;
});

const dateKey = '2026-11-19';
const daily = Engine.buildDaily(data, dateKey, 5);
assert.strictEqual(daily.length, 5, 'five questions');
assert.strictEqual(new Set(daily.map((q) => q.word)).size, 5, 'daily questions are unique');

const dailyAgain = Engine.buildDaily(data, dateKey, 5);
assert.strictEqual(JSON.stringify(daily), JSON.stringify(dailyAgain), 'same date is deterministic');

daily.forEach((question) => {
  assert.strictEqual(question.tiles.length, 6, 'six tiles for ' + question.word);
  question.chars.forEach((character) => {
    assert.ok(question.tiles.indexOf(character) !== -1, 'tile contains ' + character);
  });
  const extra = question.tiles.filter((character) => question.word.indexOf(character) === -1);
  assert.strictEqual(extra.length, 2, 'two distractors for ' + question.word);
});

assert.strictEqual(Engine.scoreForAttempts(0), 1, 'first try is 1 point');
assert.strictEqual(Engine.scoreForAttempts(1), 0.5, 'second try is 0.5');
assert.strictEqual(Engine.scoreForAttempts(2), 0, 'third try is 0');

const history = {
  '2026-11-19': 4.5,
  '2026-11-18': 5,
  '2026-11-17': 4
};
assert.strictEqual(Engine.computeStreak(history, '2026-11-19'), 3, 'three-day streak');
assert.strictEqual(Engine.computeStreak(history, '2026-11-16'), 0, 'no challenge on that day');

assert.strictEqual(Engine.formatScore(5), '5', 'integer score');
assert.strictEqual(Engine.formatScore(4.5), '4.5', 'half score');

// 120 个成语、每天 5 题：一个 24 天周期应恰好覆盖全部题库且不重复。
const cycleWords = [];
for (let i = 0; i < 24; i += 1) {
  const dayKey = Engine.dateKeyOf(Engine.addDays(new Date(2026, 0, 1), i));
  Engine.buildDaily(data, dayKey, 5).forEach((question) => cycleWords.push(question.word));
}
assert.strictEqual(cycleWords.length, 120, '24 days x 5 questions');
assert.strictEqual(new Set(cycleWords).size, 120, 'no repeats inside a cycle');

assert.strictEqual(Engine.dateKeyOf(new Date(2026, 0, 5)), '2026-01-05', 'date key padding');
assert.strictEqual(Engine.dateKeyOf(Engine.addDays(new Date(2026, 0, 1), -1)), '2025-12-31', 'date rollover');

console.log('idiom engine tests passed');
