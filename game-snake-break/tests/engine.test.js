'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'dist', 'engine.js'), 'utf8'), sandbox);
const Engine = sandbox.window.BreakSnakeEngine;
const rng = () => 0.5;

assert.ok(Engine, 'engine exists');
assert.strictEqual(Engine.COLS, 20);
assert.strictEqual(Engine.ROWS, 26);
assert.strictEqual(Engine.DURATION, 60);

// 初始状态
const game = Engine.create(rng);
assert.strictEqual(game.snake.length, 4);
assert.strictEqual(game.dir.x, 1);
assert.strictEqual(game.phase, 'playing');
assert.strictEqual(game.timeLeft, 60);
assert.ok(game.food && game.food.x >= 0 && game.food.y >= 0);
assert.ok(!game.snake.some((s) => s.x === game.food.x && s.y === game.food.y), 'food not on snake');

// 不能 180 度掉头
assert.strictEqual(Engine.turn(game, -1, 0), false);
assert.strictEqual(Engine.turn(game, 0, 1), true);
assert.strictEqual(Engine.turn(game, 0, -1), false, 'reverse of queued dir rejected');

// 移动：头前进、尾收缩
const head = { x: game.snake[0].x, y: game.snake[0].y };
game.queue = [];
game.dir = { x: 1, y: 0 };
game.food = { x: 0, y: 0, type: 'spicy' };
Engine.step(game, rng);
assert.deepStrictEqual({ x: game.snake[0].x, y: game.snake[0].y }, { x: head.x + 1, y: head.y });
assert.strictEqual(game.snake.length, 4);

// 吃辣条：长度 +1、分数 +1
const eat = Engine.create(rng);
eat.food = { x: eat.snake[0].x + 1, y: eat.snake[0].y, type: 'spicy' };
eat.dir = { x: 1, y: 0 };
eat.queue = [];
Engine.step(eat, rng);
assert.strictEqual(eat.snake.length, 5);
assert.strictEqual(eat.score, 1);
assert.strictEqual(eat.eaten, 1);
assert.ok(eat.events.some((e) => e.type === 'eat'));
assert.ok(eat.stepInterval < 165, 'speed increases');

// 饼干 +2 分，糖 +2 秒
const cookie = Engine.create(rng);
cookie.food = { x: cookie.snake[0].x + 1, y: cookie.snake[0].y, type: 'cookie' };
cookie.dir = { x: 1, y: 0 };
cookie.queue = [];
Engine.step(cookie, rng);
assert.strictEqual(cookie.score, 2);

const candy = Engine.create(rng);
candy.timeLeft = 40;
candy.food = { x: candy.snake[0].x + 1, y: candy.snake[0].y, type: 'candy' };
candy.dir = { x: 1, y: 0 };
candy.queue = [];
Engine.step(candy, rng);
assert.strictEqual(candy.timeLeft, 42);
candy.timeLeft = 59.5;
candy.food = { x: candy.snake[0].x + 1, y: candy.snake[0].y, type: 'candy' };
candy.dir = { x: 1, y: 0 };
candy.queue = [];
Engine.step(candy, rng);
assert.ok(candy.timeLeft <= 60, 'candy time capped at duration');

// 撞墙：结束并给出墙原因
const wall = Engine.create(rng);
wall.snake = [{ x: wall.cols - 1, y: 10 }, { x: wall.cols - 2, y: 10 }];
wall.dir = { x: 1, y: 0 };
wall.queue = [];
wall.food = { x: 0, y: 0, type: 'spicy' };
Engine.step(wall, rng);
assert.strictEqual(wall.phase, 'over');
assert.ok(wall.events.some((e) => e.type === 'caught' && e.reason === 'wall'));

// 撞自己：结束并给出 self 原因
const self = Engine.create(rng);
self.snake = [{ x: 2, y: 2 }, { x: 2, y: 3 }, { x: 1, y: 3 }, { x: 1, y: 2 }];
self.dir = { x: 0, y: 1 };
self.queue = [];
self.food = { x: 0, y: 0, type: 'spicy' };
Engine.step(self, rng);
assert.strictEqual(self.phase, 'over');
assert.ok(self.events.some((e) => e.type === 'caught' && e.reason === 'self'));

// 走到尾巴原来的格子不算撞自己
const tailMove = Engine.create(rng);
tailMove.snake = [{ x: 2, y: 2 }, { x: 2, y: 3 }, { x: 1, y: 3 }, { x: 1, y: 2 }];
tailMove.dir = { x: -1, y: 0 };
tailMove.queue = [];
tailMove.food = { x: 0, y: 0, type: 'spicy' };
Engine.step(tailMove, rng);
assert.strictEqual(tailMove.phase, 'playing', 'moving into tail cell is allowed');
assert.strictEqual(tailMove.snake[0].x, 1);

// 开局准备：1.2 秒内不走也不扣时间
const ready = Engine.create(rng);
Engine.update(ready, 1, rng);
assert.strictEqual(ready.timeLeft, 60);
assert.ok(ready.startDelay > 0);
Engine.update(ready, 0.5, rng);
assert.strictEqual(ready.startDelay, 0);
assert.ok(ready.events.some((e) => e.type === 'go'));
Engine.update(ready, 0.5, rng);
assert.ok(ready.timeLeft < 60, 'timer starts after delay');

// 下课铃
const bell = Engine.create(rng);
bell.startDelay = 0;
Engine.update(bell, 1, rng);
assert.ok(bell.timeLeft < 60);
Engine.update(bell, 61, rng);
assert.strictEqual(bell.phase, 'over');
assert.ok(bell.events.some((e) => e.type === 'timeup'));

// 食物不会落在蛇身上（第一次随机到蛇头，第二次换位置）
const place = Engine.create(rng);
place.snake = [{ x: 0, y: 0 }];
let calls = 0;
const seq = () => (calls < 2 ? 0 : 0.5);
const food = Engine.placeFood(place, seq);
assert.ok(!(food.x === 0 && food.y === 0), 'food avoids snake');
assert.ok(place.food, 'food placed');

console.log('snake-break engine tests passed');
