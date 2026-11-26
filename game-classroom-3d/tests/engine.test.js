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
assert.strictEqual(Engine.LEVELS.length, 6, 'six levels');
assert.strictEqual(Engine.LEVELS.map((lv) => lv.id).join(','), 'chinese,math,english,physics,chemistry,final');

const chinese = Engine.LEVELS[0];
const mathLevel = Engine.LEVELS[1];
const english = Engine.LEVELS[2];
const physics = Engine.LEVELS[3];
const chemistry = Engine.LEVELS[4];
const finalLevel = Engine.LEVELS[5];

// 关卡参数
assert.strictEqual(chinese.target, 6);
assert.strictEqual(chinese.tell, 0.9);
assert.strictEqual(english.fakeChance, 0.35);
assert.strictEqual(physics.pauseFakeChance, 0.3);
assert.strictEqual(chemistry.lives, 2);
assert.strictEqual(finalLevel.lives, 1);

// 难度曲线
assert.ok(Engine.writingDuration(chinese, 0) > Engine.writingDuration(chinese, 5), 'writing gets faster');
assert.ok(Engine.writingDuration(chinese, 20) >= chinese.writeTo - 1e-9, 'writing floor');
assert.ok(Engine.facingDuration(chinese, 0) < Engine.facingDuration(english, 0), 'levels differ');
assert.ok(Engine.writingDuration(english, 0) > Engine.writingDuration(chinese, 0), 'writing windows differ');
assert.ok(Engine.writingDuration(english, 0) > Engine.writingDuration(mathLevel, 0), 'english has long windows');
assert.ok(Engine.facingDuration(english, 20) <= english.faceTo + 1e-9, 'facing ceiling');

// 默认关卡（兼容旧调用）
assert.strictEqual(Engine.create(rng).target, 10);
assert.strictEqual(Engine.writingDuration(null, 20), 1.9);
assert.strictEqual(Engine.facingDuration(null, 30), 2.6);

// 关卡初始状态
const game = Engine.create(rng, chinese);
assert.strictEqual(game.phase, 'writing');
assert.strictEqual(game.lives, 3);
assert.strictEqual(game.snacks, 0);
assert.strictEqual(game.target, 6);
assert.strictEqual(game.levelId, 'chinese');

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

// 写字结束先进入停笔（tell），再转身
const pause = Engine.create(rng, chinese);
pause.phaseLeft = 0.01;
Engine.setEating(pause, true);
Engine.tick(pause, 0.05, rng);
assert.strictEqual(pause.phase, 'pausing', 'pause before turning');
assert.ok(pause.events.some((e) => e.type === 'pause'));
assert.strictEqual(pause.lives, 3, 'not caught during pause');

for (let i = 0; i < 10; i += 1) Engine.tick(pause, 0.1, rng);
assert.strictEqual(pause.phase, 'turning', 'turn after tell');
assert.ok(pause.events.some((e) => e.type === 'turn'));
assert.strictEqual(pause.lives, 3, 'still not caught while turning');

for (let i = 0; i < 6; i += 1) Engine.tick(pause, 0.1, rng);
assert.strictEqual(pause.phase, 'facing');
assert.strictEqual(pause.lives, 2, 'caught when turn completes while eating');

// 转身瞬间吃东西会被抓
const turned = Engine.create(rng, chinese);
turned.phase = 'turning';
turned.phaseLeft = 0.01;
Engine.setEating(turned, true);
Engine.tick(turned, 0.05, rng);
assert.strictEqual(turned.phase, 'facing');
assert.strictEqual(turned.lives, 2, 'caught loses a life');
assert.ok(turned.events.some((e) => e.type === 'caught'));
assert.strictEqual(turned.eating, false, 'eating reset after caught');

// 没吃东西时不会被抓
const innocent = Engine.create(rng, chinese);
innocent.phase = 'turning';
innocent.phaseLeft = 0.01;
Engine.tick(innocent, 0.05, rng);
assert.strictEqual(innocent.lives, 3, 'no penalty when idle');
assert.ok(!innocent.events.some((e) => e.type === 'caught'));

// 面向期间继续偷吃，立刻被抓
const face = Engine.create(rng, chinese);
face.phase = 'facing';
face.phaseLeft = 2;
face.caughtThisFacing = false;
Engine.setEating(face, true);
Engine.tick(face, 0.05, rng);
assert.strictEqual(face.lives, 2, 'eating while facing is caught');
assert.ok(face.events.some((e) => e.type === 'caught'));

// 假动作：英语课停笔后有一定概率转一半再转回去
const fakeRng = () => 0;
const fake = Engine.create(fakeRng, english);
fake.phase = 'pausing';
fake.phaseLeft = 0.01;
Engine.tick(fake, 0.05, fakeRng);
assert.strictEqual(fake.phase, 'faking', 'fake half turn');
assert.ok(fake.fakeSpan >= 0.5 && fake.fakeSpan <= 0.8, 'fake span randomized');
assert.ok(fake.events.some((e) => e.type === 'fake'), 'fake turn event');
assert.strictEqual(fake.lives, 3, 'fake is safe');
for (let i = 0; i < 10; i += 1) Engine.tick(fake, 0.1, fakeRng);
assert.strictEqual(fake.phase, 'writing', 'fake returns to writing');

// 物理课：停笔可能是假的，会重新写起来
const fakePause = Engine.create(fakeRng, physics);
fakePause.phase = 'writing';
fakePause.phaseLeft = 0.01;
Engine.tick(fakePause, 0.05, fakeRng);
assert.strictEqual(fakePause.phase, 'pausing', 'physics pauses');
assert.strictEqual(fakePause.pauseFake, true, 'false pause flagged');
for (let i = 0; i < 5; i += 1) Engine.tick(fakePause, 0.1, fakeRng);
assert.strictEqual(fakePause.phase, 'writing', 'false pause resumes writing');
assert.ok(fakePause.events.some((e) => e.type === 'resume'), 'resume event');

// 物理课也会真转身（rng 0.5 > pauseFakeChance 0.3）
const realPause = Engine.create(rng, physics);
realPause.phase = 'writing';
realPause.phaseLeft = 0.01;
Engine.tick(realPause, 0.05, rng);
assert.strictEqual(realPause.pauseFake, false, 'real pause');
for (let i = 0; i < 5; i += 1) Engine.tick(realPause, 0.1, rng);
assert.strictEqual(realPause.phase, 'turning', 'physics turns after real pause');

// 语文课没有假动作，真实转身的 fakeSpan 为 0
const noFake = Engine.create(fakeRng, chinese);
noFake.phase = 'pausing';
noFake.phaseLeft = 0.01;
Engine.tick(noFake, 0.05, fakeRng);
assert.strictEqual(noFake.phase, 'turning', 'no fake in chinese');
assert.strictEqual(noFake.fakeSpan, 0, 'real turn has no fake span');

// 英语课也会真的完全转身（rng 0.5 > fakeChance 0.35）
const realTurn = Engine.create(rng, english);
realTurn.phase = 'pausing';
realTurn.phaseLeft = 0.01;
Engine.tick(realTurn, 0.05, rng);
assert.strictEqual(realTurn.phase, 'turning', 'english can fully turn');
assert.strictEqual(realTurn.fakeSpan, 0);

// 三次被抓后结束
const doomed = Engine.create(rng, chinese);
doomed.lives = 1;
doomed.phase = 'turning';
doomed.phaseLeft = 0.01;
Engine.setEating(doomed, true);
Engine.tick(doomed, 0.05, rng);
assert.strictEqual(doomed.phase, 'over', 'game over at zero lives');
assert.ok(doomed.events.some((e) => e.type === 'over'));

// 吃满目标获胜
const winning = Engine.create(rng, chinese);
winning.snacks = 5;
winning.progress = 0.95;
winning.phase = 'writing';
winning.phaseLeft = 5;
Engine.setEating(winning, true);
Engine.tick(winning, 0.1, rng);
assert.strictEqual(winning.phase, 'win', 'win at target');
assert.ok(winning.events.some((e) => e.type === 'win'));

// 星级：按剩余生命比例
assert.strictEqual(Engine.starsFor(winning), 3);
winning.lives = 2;
assert.strictEqual(Engine.starsFor(winning), 2);
winning.lives = 1;
assert.strictEqual(Engine.starsFor(winning), 1);
winning.phase = 'over';
assert.strictEqual(Engine.starsFor(winning), 0, 'no stars when failed');

// 两命关卡：满血 3 星、剩 1 命 2 星
const chemWin = Engine.create(rng, chemistry);
chemWin.phase = 'win';
chemWin.lives = 2;
assert.strictEqual(Engine.starsFor(chemWin), 3);
chemWin.lives = 1;
assert.strictEqual(Engine.starsFor(chemWin), 2);

// 一命关卡：通关即 3 星
const finalWin = Engine.create(rng, finalLevel);
finalWin.phase = 'win';
assert.strictEqual(Engine.starsFor(finalWin), 3);

// 未按住时进度缓慢回落
const decay = Engine.create(rng, chinese);
decay.progress = 0.5;
Engine.setEating(decay, false);
Engine.tick(decay, 0.1, rng);
assert.ok(decay.progress < 0.5, 'progress decays when idle');

console.log('classroom-3d engine tests passed');
