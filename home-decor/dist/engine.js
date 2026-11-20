/*
 * 装修实验室 · 布局引擎
 * 纯逻辑：占格、碰撞、旋转、移除、统计。可在 Node 中测试。
 */
(function (root) {
  'use strict';

  var SIZE = 6;

  function footprint(def, rot) {
    var horizontal = rot === 90;
    return {
      w: horizontal ? def.d : def.w,
      d: horizontal ? def.w : def.d
    };
  }

  function cells(x, y, w, d) {
    var list = [];
    for (var row = y; row < y + d; row += 1) {
      for (var col = x; col < x + w; col += 1) {
        list.push(col + ',' + row);
      }
    }
    return list;
  }

  function occupiedMap(placed) {
    var map = {};
    for (var i = 0; i < placed.length; i += 1) {
      var item = placed[i];
      if (item.wall) continue;
      var list = cells(item.x, item.y, item.w, item.d);
      for (var j = 0; j < list.length; j += 1) {
        map[list[j]] = item.uid;
      }
    }
    return map;
  }

  function withinRoom(x, y, w, d) {
    return x >= 0 && y >= 0 && x + w <= SIZE && y + d <= SIZE;
  }

  function canPlaceFloor(placed, def, x, y, rot) {
    if (def.wall) return false;
    var size = footprint(def, rot);
    if (!withinRoom(x, y, size.w, size.d)) return false;
    var used = occupiedMap(placed);
    var list = cells(x, y, size.w, size.d);
    for (var i = 0; i < list.length; i += 1) {
      if (used[list[i]]) return false;
    }
    return true;
  }

  function canPlaceWall(placed, def, wall, pos) {
    if (!def.wall) return false;
    if (wall !== 'left' && wall !== 'right') return false;
    if (pos < 0 || pos + def.w > SIZE) return false;
    for (var i = 0; i < placed.length; i += 1) {
      var item = placed[i];
      if (!item.wall || item.wall !== wall) continue;
      if (pos < item.pos + item.w && pos + def.w > item.pos) return false;
    }
    return true;
  }

  function findAt(placed, x, y) {
    var used = occupiedMap(placed);
    var uid = used[x + ',' + y];
    if (!uid) return null;
    for (var i = 0; i < placed.length; i += 1) {
      if (placed[i].uid === uid) return placed[i];
    }
    return null;
  }

  function placeFloor(placed, def, x, y, rot, uid) {
    if (!canPlaceFloor(placed, def, x, y, rot)) return null;
    var size = footprint(def, rot);
    var next = placed.slice();
    next.push({
      uid: uid,
      type: def.id,
      x: x,
      y: y,
      rot: rot || 0,
      w: size.w,
      d: size.d
    });
    return next;
  }

  function placeWall(placed, def, wall, pos, uid) {
    if (!canPlaceWall(placed, def, wall, pos)) return null;
    var next = placed.slice();
    next.push({
      uid: uid,
      type: def.id,
      wall: wall,
      pos: pos,
      w: def.w
    });
    return next;
  }

  function remove(placed, uid) {
    var next = [];
    for (var i = 0; i < placed.length; i += 1) {
      if (placed[i].uid !== uid) next.push(placed[i]);
    }
    return next;
  }

  function findItem(placed, uid) {
    for (var i = 0; i < placed.length; i += 1) {
      if (placed[i].uid === uid) return placed[i];
    }
    return null;
  }

  // 旋转 90°：只有地面家具需要，返回新数组；旋转后碰撞则返回 null
  function rotate(placed, defs, uid) {
    var item = findItem(placed, uid);
    if (!item || item.wall) return null;
    var def = null;
    for (var i = 0; i < defs.length; i += 1) {
      if (defs[i].id === item.type) def = defs[i];
    }
    if (!def) return null;
    var nextRot = item.rot === 90 ? 0 : 90;
    var size = footprint(def, nextRot);
    var others = remove(placed, uid);
    if (!withinRoom(item.x, item.y, size.w, size.d)) return null;
    var used = occupiedMap(others);
    var list = cells(item.x, item.y, size.w, size.d);
    for (var j = 0; j < list.length; j += 1) {
      if (used[list[j]]) return null;
    }
    var next = [];
    for (var k = 0; k < placed.length; k += 1) {
      if (placed[k].uid === uid) {
        next.push({
          uid: item.uid,
          type: item.type,
          x: item.x,
          y: item.y,
          rot: nextRot,
          w: size.w,
          d: size.d
        });
      } else {
        next.push(placed[k]);
      }
    }
    return next;
  }

  function stats(placed) {
    var floorCount = 0;
    var wallCount = 0;
    var types = {};
    for (var i = 0; i < placed.length; i += 1) {
      if (placed[i].wall) wallCount += 1;
      else floorCount += 1;
      types[placed[i].type] = true;
    }
    return {
      floor: floorCount,
      wall: wallCount,
      total: floorCount + wallCount,
      types: Object.keys(types).length
    };
  }

  root.HomeDecorEngine = {
    SIZE: SIZE,
    footprint: footprint,
    cells: cells,
    occupiedMap: occupiedMap,
    canPlaceFloor: canPlaceFloor,
    canPlaceWall: canPlaceWall,
    findAt: findAt,
    placeFloor: placeFloor,
    placeWall: placeWall,
    remove: remove,
    findItem: findItem,
    rotate: rotate,
    stats: stats
  };
}(typeof window !== 'undefined' ? window : this));
