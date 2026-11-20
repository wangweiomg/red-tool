(function (global) {
  'use strict';

  var SIZE = 4;
  var DIRECTIONS = { left: true, right: true, up: true, down: true };

  function emptyGrid(size) {
    var grid = [];
    for (var r = 0; r < size; r += 1) {
      var row = [];
      for (var c = 0; c < size; c += 1) {
        row.push(null);
      }
      grid.push(row);
    }
    return grid;
  }

  function lineCoord(direction, line, index, size) {
    if (direction === 'left') {
      return { r: line, c: index };
    }
    if (direction === 'right') {
      return { r: line, c: size - 1 - index };
    }
    if (direction === 'up') {
      return { r: index, c: line };
    }
    return { r: size - 1 - index, c: line };
  }

  function computeMove(cells, direction, size) {
    size = size || SIZE;
    if (!DIRECTIONS[direction]) {
      throw new Error('unknown direction: ' + direction);
    }
    var newCells = emptyGrid(size);
    var moves = [];
    var merges = [];
    var gained = 0;
    var moved = false;

    for (var line = 0; line < size; line += 1) {
      var entries = [];
      var i;
      for (i = 0; i < size; i += 1) {
        var pos = lineCoord(direction, line, i, size);
        var tile = cells[pos.r][pos.c];
        if (tile) {
          entries.push({ tile: tile, fromR: pos.r, fromC: pos.c });
        }
      }

      var target = 0;
      var last = null;
      for (i = 0; i < entries.length; i += 1) {
        var item = entries[i];
        if (last && last.tile.value === item.tile.value && !last.merged) {
          last.merged = true;
          var newValue = last.tile.value * 2;
          last.tile.value = newValue;
          merges.push({ tile: last.tile, newValue: newValue, sources: [last.tile, item.tile] });
          moves.push({
            tile: item.tile,
            fromR: item.fromR,
            fromC: item.fromC,
            toR: last.r,
            toC: last.c,
            merged: true
          });
          gained += newValue;
          moved = true;
        } else {
          var dest = lineCoord(direction, line, target, size);
          newCells[dest.r][dest.c] = item.tile;
          moves.push({
            tile: item.tile,
            fromR: item.fromR,
            fromC: item.fromC,
            toR: dest.r,
            toC: dest.c,
            merged: false
          });
          if (dest.r !== item.fromR || dest.c !== item.fromC) {
            moved = true;
          }
          last = { tile: item.tile, r: dest.r, c: dest.c, merged: false };
          target += 1;
        }
      }
    }

    return {
      cells: newCells,
      moves: moves,
      merges: merges,
      gained: gained,
      moved: moved
    };
  }

  function hasMoves(cells, size) {
    size = size || SIZE;
    var r;
    var c;
    for (r = 0; r < size; r += 1) {
      for (c = 0; c < size; c += 1) {
        if (!cells[r][c]) {
          return true;
        }
        if (c + 1 < size && cells[r][c + 1] && cells[r][c].value === cells[r][c + 1].value) {
          return true;
        }
        if (r + 1 < size && cells[r + 1][c] && cells[r][c].value === cells[r + 1][c].value) {
          return true;
        }
      }
    }
    return false;
  }

  global.Game2048Engine = {
    SIZE: SIZE,
    emptyGrid: emptyGrid,
    computeMove: computeMove,
    hasMoves: hasMoves
  };
}(typeof window !== 'undefined' ? window : this));
