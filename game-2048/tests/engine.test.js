'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const enginePath = path.join(__dirname, '..', 'dist', 'engine.js');
const source = fs.readFileSync(enginePath, 'utf8');
const sandbox = { window: {} };
vm.runInNewContext(source, sandbox);
const Engine = sandbox.window.Game2048Engine;

function grid(rows) {
  return rows.map((row) => row.map((value) => (value ? { value } : null)));
}

function values(cells) {
  return cells.map((row) => row.map((tile) => (tile ? tile.value : 0)));
}

function expectMove(name, rows, direction, expected, gained, mergeCount) {
  const result = Engine.computeMove(grid(rows), direction, 4);
  assert.strictEqual(JSON.stringify(values(result.cells)), JSON.stringify(expected), name);
  assert.strictEqual(result.gained, gained, name + ' gained');
  assert.strictEqual(result.merges.length, mergeCount, name + ' merges');
}

const emptyRow = [0, 0, 0, 0];
const empty = [emptyRow, emptyRow, emptyRow, emptyRow];

expectMove('left merge 2,2,4,0', [[2, 2, 4, 0], emptyRow, emptyRow, emptyRow],
  'left', [[4, 4, 0, 0], emptyRow, emptyRow, emptyRow], 4, 1);
expectMove('left double pair', [[2, 2, 2, 2], emptyRow, emptyRow, emptyRow],
  'left', [[4, 4, 0, 0], emptyRow, emptyRow, emptyRow], 8, 2);
expectMove('left gap merge', [[2, 0, 2, 4], emptyRow, emptyRow, emptyRow],
  'left', [[4, 4, 0, 0], emptyRow, emptyRow, emptyRow], 4, 1);
expectMove('left no move', [[2, 4, 8, 16], emptyRow, emptyRow, emptyRow],
  'left', [[2, 4, 8, 16], emptyRow, emptyRow, emptyRow], 0, 0);
expectMove('right pair at edge', [[2, 2, 4, 4], emptyRow, emptyRow, emptyRow],
  'right', [[0, 0, 4, 8], emptyRow, emptyRow, emptyRow], 12, 2);
expectMove('up merge', [[2, 0, 0, 0], [2, 0, 0, 0], [4, 0, 0, 0], [4, 0, 0, 0]],
  'up', [[4, 0, 0, 0], [8, 0, 0, 0], emptyRow, emptyRow], 12, 2);
expectMove('down merge', [[2, 0, 0, 0], [2, 0, 0, 0], [4, 0, 0, 0], [4, 0, 0, 0]],
  'down', [emptyRow, emptyRow, [4, 0, 0, 0], [8, 0, 0, 0]], 12, 2);
expectMove('full row right no move', [[2, 4, 8, 16], emptyRow, emptyRow, emptyRow],
  'right', [[2, 4, 8, 16], emptyRow, emptyRow, emptyRow], 0, 0);

const noMove = Engine.computeMove(grid([[2, 4, 8, 16], emptyRow, emptyRow, emptyRow]), 'left', 4);
assert.strictEqual(noMove.moved, false, 'unchanged row should not be moved');

const merge = Engine.computeMove(grid([[2, 2, 0, 0], emptyRow, emptyRow, emptyRow]), 'left', 4);
assert.strictEqual(merge.merges[0].newValue, 4, 'merged value');

assert.strictEqual(Engine.hasMoves(grid([
  [2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]
]), 4), false, 'full board without pairs has no moves');
assert.strictEqual(Engine.hasMoves(grid([
  [2, 2, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]
]), 4), true, 'adjacent pair is a move');
assert.strictEqual(Engine.hasMoves(grid(empty), 4), true, 'empty board has moves');

console.log('engine tests passed');
