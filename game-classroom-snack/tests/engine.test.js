'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'dist', 'engine.js'), 'utf8'), sandbox);
const Engine = sandbox.window.ClassroomSnackEngine;
const rng = () => 0.5;

assert.ok(Engine, 'engine exists');
assert.strictEqual(Engine.TARGET, 10);

// 难度曲线
assert.ok(Engine.writingDuration(0) > Engine.writingDuration(5), 'writing gets faster');
assert.ok(Engine.writingDuration(20) >= 1.9, 'writing floor');
assert.ok(Engine.facingDuration(0) < Engine.facingDuration(5), 'facing gets longer');
assert.ok(Engine.facingDuration(30) <= 2.6, 'facing ceiling');

// 初始状态
const game = Engine.create(rng);
assert.strictEqual(game.phase, 'writing');
assert.strictEqual(game.lives, 3);
assert.strictEqual(game.snacks, 0);

// 吃一个零食：按住 1.1 秒
Engine.setEating(game, true);
for (let i = 0; i < 12; i += 1) Engine.tick(game, 0.1, rng);
assert.strictEqual(game.snacks, 1, 'one snack eaten');
assert.ok(game.chewing > 0, 'chewing after eating');

// 松开后仍处于咀嚼期
Engine.setEating(game, false);
const before = game.chewing;
Engine.tick(game, 0.1, rng);
assert.ok(game.chewing < before, 'chewing decays');

// 转身瞬间吃东西会被抓
const turned = Engine.create(rng);
turned.phase = 'turning';
turned.phaseLeft = 0.01;
Engine.setEating(turned, true);
Engine.tick(turned, 0.05, rng);
assert.strictEqual(turned.phase, 'facing');
assert.strictEqual(turned.lives, 2, 'caught loses a life');
assert.ok(turned.events.some((e) => e.type === 'caught'), 'caught event');
assert.strictEqual(turned.eating, false, 'eating reset after caught');

// 没吃东西时不会被抓
const innocent = Engine.create(rng);
innocent.phase = 'turning';
innocent.phaseLeft = 0.01;
Engine.tick(innocent, 0.05, rng);
assert.strictEqual(innocent.lives, 3, 'no penalty when idle');
assert.ok(!innocent.events.some((e) => e.type === 'caught'));

// 面向期间继续偷吃，立刻被抓
const face = Engine.create(rng);
face.phase = 'facing';
face.phaseLeft = 2;
face.caughtThisFacing = false;
Engine.setEating(face, true);
Engine.tick(face, 0.05, rng);
assert.strictEqual(face.lives, 2, 'eating while facing is caught');
assert.ok(face.events.some((e) => e.type === 'caught'));

// 三次被抓后结束
const doomed = Engine.create(rng);
doomed.lives = 1;
doomed.phase = 'turning';
doomed.phaseLeft = 0.01;
Engine.setEating(doomed, true);
Engine.tick(doomed, 0.05, rng);
assert.strictEqual(doomed.phase, 'over', 'game over at zero lives');
assert.ok(doomed.events.some((e) => e.type === 'over'));

// 吃满目标获胜
const winning = Engine.create(rng);
winning.snacks = 9;
winning.progress = 0.95;
winning.phase = 'writing';
winning.phaseLeft = 5;
Engine.setEating(winning, true);
Engine.tick(winning, 0.1, rng);
assert.strictEqual(winning.phase, 'win', 'win at target');
assert.ok(winning.events.some((e) => e.type === 'win'));

// 未按住时进度缓慢回落
const decay = Engine.create(rng);
decay.progress = 0.5;
Engine.setEating(decay, false);
Engine.tick(decay, 0.1, rng);
assert.ok(decay.progress < 0.5, 'progress decays when idle');

console.log('classroom-snack engine tests passed');
