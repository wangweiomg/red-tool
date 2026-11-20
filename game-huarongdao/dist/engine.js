(function (global) {
  'use strict';

  var ROWS = 5;
  var COLS = 4;

  var INITIAL = [
    { id: 'zhang', name: '张飞', kind: 'general', w: 1, h: 2, r: 0, c: 0 },
    { id: 'cao', name: '曹操', kind: 'cao', w: 2, h: 2, r: 0, c: 1 },
    { id: 'zhao', name: '赵云', kind: 'general', w: 1, h: 2, r: 0, c: 3 },
    { id: 'ma', name: '马超', kind: 'general', w: 1, h: 2, r: 2, c: 0 },
    { id: 'guan', name: '关羽', kind: 'guan', w: 2, h: 1, r: 2, c: 1 },
    { id: 'huang', name: '黄忠', kind: 'general', w: 1, h: 2, r: 2, c: 3 },
    { id: 's1', name: '卒', kind: 'soldier', w: 1, h: 1, r: 3, c: 1 },
    { id: 's2', name: '卒', kind: 'soldier', w: 1, h: 1, r: 3, c: 2 },
    { id: 's3', name: '卒', kind: 'soldier', w: 1, h: 1, r: 4, c: 0 },
    { id: 's4', name: '卒', kind: 'soldier', w: 1, h: 1, r: 4, c: 3 }
  ];

  function cloneBlock(block) {
    return {
      id: block.id,
      name: block.name,
      kind: block.kind,
      w: block.w,
      h: block.h,
      r: block.r,
      c: block.c
    };
  }

  function createInitial() {
    return INITIAL.map(cloneBlock);
  }

  function findBlock(blocks, id) {
    for (var i = 0; i < blocks.length; i += 1) {
      if (blocks[i].id === id) {
        return blocks[i];
      }
    }
    return null;
  }

  function occupancy(blocks) {
    var grid = [];
    var r;
    var c;
    for (r = 0; r < ROWS; r += 1) {
      var row = [];
      for (c = 0; c < COLS; c += 1) {
        row.push(null);
      }
      grid.push(row);
    }
    for (var i = 0; i < blocks.length; i += 1) {
      var block = blocks[i];
      for (var dr = 0; dr < block.h; dr += 1) {
        for (var dc = 0; dc < block.w; dc += 1) {
          var rr = block.r + dr;
          var cc = block.c + dc;
          if (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS) {
            grid[rr][cc] = block.id;
          }
        }
      }
    }
    return grid;
  }

  function canMove(blocks, id, dr, dc) {
    var block = findBlock(blocks, id);
    if (!block || (dr === 0 && dc === 0)) {
      return false;
    }
    if (Math.abs(dr) + Math.abs(dc) !== 1) {
      return false;
    }
    var targetRow = block.r + dr;
    var targetCol = block.c + dc;
    if (targetRow < 0 || targetCol < 0 ||
        targetRow + block.h > ROWS || targetCol + block.w > COLS) {
      return false;
    }
    var grid = occupancy(blocks);
    for (var r = 0; r < block.h; r += 1) {
      for (var c = 0; c < block.w; c += 1) {
        var owner = grid[targetRow + r][targetCol + c];
        if (owner && owner !== id) {
          return false;
        }
      }
    }
    return true;
  }

  function moveBlock(blocks, id, dr, dc) {
    if (!canMove(blocks, id, dr, dc)) {
      return { blocks: blocks, moved: false };
    }
    var next = [];
    for (var i = 0; i < blocks.length; i += 1) {
      if (blocks[i].id === id) {
        var movedBlock = cloneBlock(blocks[i]);
        movedBlock.r += dr;
        movedBlock.c += dc;
        next.push(movedBlock);
      } else {
        next.push(blocks[i]);
      }
    }
    return { blocks: next, moved: true };
  }

  function isSolved(blocks) {
    var cao = findBlock(blocks, 'cao');
    if (!cao) {
      return false;
    }
    return cao.r === ROWS - cao.h && cao.c === Math.floor((COLS - cao.w) / 2);
  }

  function serialize(blocks) {
    var positions = {};
    for (var i = 0; i < blocks.length; i += 1) {
      positions[blocks[i].id] = { r: blocks[i].r, c: blocks[i].c };
    }
    return positions;
  }

  function isValidLayout(blocks) {
    var grid = [];
    var r;
    var c;
    for (r = 0; r < ROWS; r += 1) {
      var row = [];
      for (c = 0; c < COLS; c += 1) {
        row.push(null);
      }
      grid.push(row);
    }
    for (var i = 0; i < blocks.length; i += 1) {
      var block = blocks[i];
      if (block.w < 1 || block.h < 1 ||
          block.r < 0 || block.c < 0 ||
          block.r + block.h > ROWS || block.c + block.w > COLS) {
        return false;
      }
      for (var dr = 0; dr < block.h; dr += 1) {
        for (var dc = 0; dc < block.w; dc += 1) {
          if (grid[block.r + dr][block.c + dc]) {
            return false;
          }
          grid[block.r + dr][block.c + dc] = block.id;
        }
      }
    }
    return true;
  }

  global.GameHuarongEngine = {
    ROWS: ROWS,
    COLS: COLS,
    createInitial: createInitial,
    findBlock: findBlock,
    occupancy: occupancy,
    canMove: canMove,
    moveBlock: moveBlock,
    isSolved: isSolved,
    serialize: serialize,
    isValidLayout: isValidLayout
  };
}(typeof window !== 'undefined' ? window : this));
