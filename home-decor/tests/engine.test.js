'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'dist', 'engine.js'), 'utf8'), sandbox);
const Engine = sandbox.window.HomeDecorEngine;

const sofa = { id: 'sofa', w: 2, d: 1, wall: false };
const rug = { id: 'rug', w: 2, d: 2, wall: false };
const art = { id: 'art', w: 2, wall: true };

assert.strictEqual(Engine.SIZE, 6);

// 尺寸与格子
assert.strictEqual(JSON.stringify(Engine.footprint(sofa, 0)), JSON.stringify({ w: 2, d: 1 }));
assert.strictEqual(JSON.stringify(Engine.footprint(sofa, 90)), JSON.stringify({ w: 1, d: 2 }));
assert.strictEqual(JSON.stringify(Engine.cells(0, 0, 2, 2)), JSON.stringify(['0,0', '1,0', '0,1', '1,1']));

// 地面放置
assert.strictEqual(Engine.canPlaceFloor([], sofa, 0, 0, 0), true);
assert.strictEqual(Engine.canPlaceFloor([], sofa, 5, 0, 0), false, 'out of bounds');
assert.strictEqual(Engine.canPlaceFloor([], rug, -1, 0, 0), false, 'negative');

const withSofa = Engine.placeFloor([], sofa, 0, 0, 0, 'u1');
assert.ok(withSofa && withSofa.length === 1);
assert.strictEqual(Engine.canPlaceFloor(withSofa, rug, 0, 0, 0), false, 'overlap');
assert.strictEqual(Engine.canPlaceFloor(withSofa, rug, 2, 0, 0), true, 'adjacent');
assert.strictEqual(Engine.findAt(withSofa, 0, 0).uid, 'u1');
assert.strictEqual(Engine.findAt(withSofa, 2, 0), null);

// 旋转后碰撞
const blocked = withSofa.slice();
blocked.push({ uid: 'u2', type: 'coffee', x: 0, y: 1, rot: 0, w: 1, d: 1 });
const rotated = Engine.rotate(blocked, [sofa], 'u1');
assert.strictEqual(rotated, null, 'rotation blocked by neighbour');

const rotatedFree = Engine.rotate(withSofa, [sofa], 'u1');
assert.ok(rotatedFree, 'rotation succeeds when free');
const rotatedSofa = rotatedFree.find((item) => item.uid === 'u1');
assert.strictEqual(rotatedSofa.rot, 90);
assert.strictEqual(rotatedSofa.w, 1);
assert.strictEqual(rotatedSofa.d, 2);

// 墙面放置
assert.strictEqual(Engine.canPlaceWall([], art, 'left', 0), true);
assert.strictEqual(Engine.canPlaceWall([], art, 'left', 5), false, 'out of wall');
const wall = Engine.placeWall([], art, 'left', 0, 'w1');
assert.ok(wall && wall.length === 1);
assert.strictEqual(Engine.canPlaceWall(wall, art, 'left', 1), false, 'wall overlap');
assert.strictEqual(Engine.canPlaceWall(wall, art, 'left', 2), true, 'adjacent wall');
assert.strictEqual(Engine.canPlaceWall(wall, art, 'right', 0), true, 'other wall free');
assert.strictEqual(Engine.rotate(wall, [sofa], 'w1'), null, 'wall items do not rotate');

// 移除与统计
assert.strictEqual(Engine.remove(wall, 'w1').length, 0);
const stats = Engine.stats(withSofa.concat([{ uid: 'w2', type: 'curtain', wall: 'left', pos: 2, w: 2 }]));
assert.strictEqual(JSON.stringify(stats), JSON.stringify({ floor: 1, wall: 1, total: 2, types: 2 }));

console.log('home-decor engine tests passed');
