'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const enginePath = path.join(__dirname, '..', 'dist', 'engine.js');
const source = fs.readFileSync(enginePath, 'utf8');
const sandbox = { window: {} };
vm.runInNewContext(source, sandbox);
const Engine = sandbox.window.GameHuarongEngine;

const initial = Engine.createInitial();

assert.strictEqual(initial.length, 10, 'block count');
assert.strictEqual(Engine.isValidLayout(initial), true, 'initial layout is valid');

const occupancy = Engine.occupancy(initial);
assert.strictEqual(occupancy[4][1], null, 'bottom middle is empty');
assert.strictEqual(occupancy[4][2], null, 'bottom middle is empty');
let emptyCount = 0;
occupancy.forEach((row) => row.forEach((cell) => { if (!cell) emptyCount += 1; }));
assert.strictEqual(emptyCount, 2, 'exactly two empty cells');

assert.strictEqual(Engine.canMove(initial, 's1', 1, 0), true, 'soldier can move down');
assert.strictEqual(Engine.canMove(initial, 's1', 0, 1), false, 'soldier right blocked');
assert.strictEqual(Engine.canMove(initial, 's1', -1, 0), false, 'soldier up blocked');
assert.strictEqual(Engine.canMove(initial, 's1', 0, -1), false, 'soldier left blocked');
assert.strictEqual(Engine.canMove(initial, 's3', 0, 1), true, 'bottom soldier can move right');
assert.strictEqual(Engine.canMove(initial, 's3', 1, 0), false, 'bottom soldier cannot leave board');
assert.strictEqual(Engine.canMove(initial, 'cao', 1, 0), false, 'Cao blocked by Guan Yu');
assert.strictEqual(Engine.canMove(initial, 'cao', 0, 1), false, 'Cao blocked by Zhao Yun');
assert.strictEqual(Engine.canMove(initial, 'zhang', 1, 0), false, 'Zhang Fei blocked by Ma Chao');
assert.strictEqual(Engine.canMove(initial, 'guan', 1, 0), false, 'Guan Yu blocked by soldiers');

const movedS1 = Engine.moveBlock(initial, 's1', 1, 0);
assert.strictEqual(movedS1.moved, true, 'move soldier');
const s1 = Engine.findBlock(movedS1.blocks, 's1');
assert.deepStrictEqual([s1.r, s1.c], [4, 1], 'soldier moved down');
assert.deepStrictEqual(
  [Engine.findBlock(initial, 's1').r, Engine.findBlock(initial, 's1').c],
  [3, 1],
  'original blocks are not mutated'
);

const movedBoth = Engine.moveBlock(movedS1.blocks, 's2', 1, 0);
assert.strictEqual(Engine.canMove(movedBoth.blocks, 'guan', 1, 0), true, 'Guan Yu can move after both soldiers');

assert.strictEqual(Engine.isSolved(initial), false, 'initial layout is not solved');

const solvedLayout = [
  { id: 'zhang', name: '张飞', kind: 'general', w: 1, h: 2, r: 0, c: 0 },
  { id: 'guan', name: '关羽', kind: 'guan', w: 2, h: 1, r: 0, c: 1 },
  { id: 'zhao', name: '赵云', kind: 'general', w: 1, h: 2, r: 0, c: 3 },
  { id: 's1', name: '卒', kind: 'soldier', w: 1, h: 1, r: 1, c: 1 },
  { id: 's2', name: '卒', kind: 'soldier', w: 1, h: 1, r: 1, c: 2 },
  { id: 'ma', name: '马超', kind: 'general', w: 1, h: 2, r: 2, c: 0 },
  { id: 'huang', name: '黄忠', kind: 'general', w: 1, h: 2, r: 2, c: 3 },
  { id: 'cao', name: '曹操', kind: 'cao', w: 2, h: 2, r: 3, c: 1 },
  { id: 's3', name: '卒', kind: 'soldier', w: 1, h: 1, r: 4, c: 0 },
  { id: 's4', name: '卒', kind: 'soldier', w: 1, h: 1, r: 4, c: 3 }
];
assert.strictEqual(Engine.isValidLayout(solvedLayout), true, 'solved layout is valid');
assert.strictEqual(Engine.isSolved(solvedLayout), true, 'Cao at bottom center solves');

const overlap = solvedLayout.map((block) => Object.assign({}, block));
overlap[0].r = 3;
overlap[0].c = 1;
assert.strictEqual(Engine.isValidLayout(overlap), false, 'overlap is invalid');

const serialized = Engine.serialize(initial);
assert.strictEqual(JSON.stringify(serialized.cao), JSON.stringify({ r: 0, c: 1 }), 'serialize Cao');

console.log('huarong engine tests passed');
