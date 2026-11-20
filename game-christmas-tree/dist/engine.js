/*
 * 圣诞装饰树 · 纯逻辑引擎
 * 不接触 DOM / 平台 API，可在 Node 中直接测试。
 */
(function (root) {
  'use strict';

  var THEMED_WEIGHTS = { fulfillment: 0.55, balance: 0.15, richness: 0.18, star: 0.12 };
  var FREE_WEIGHTS = { balance: 0.3, richness: 0.3, star: 0.2, variety: 0.2 };
  var TARGET_MIN = 8;
  var TARGET_MAX = 20;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function countRequirement(placed, req) {
    var total = 0;
    for (var i = 0; i < placed.length; i += 1) {
      var item = placed[i];
      if (req.kind === 'color' ? item.color === req.value : item.type === req.value) {
        total += 1;
      }
    }
    return total;
  }

  function requirementProgress(theme, placed) {
    var reqs = (theme && theme.requirements) || [];
    var result = [];
    for (var i = 0; i < reqs.length; i += 1) {
      var req = reqs[i];
      var raw = countRequirement(placed, req);
      result.push({
        label: req.label,
        need: req.count,
        have: Math.min(raw, req.count),
        done: raw >= req.count
      });
    }
    return result;
  }

  function isThemed(theme) {
    return !!(theme && theme.requirements && theme.requirements.length);
  }

  function fulfillmentRatio(theme, placed) {
    var reqs = (theme && theme.requirements) || [];
    if (!reqs.length) return 1;
    var need = 0;
    var got = 0;
    for (var i = 0; i < reqs.length; i += 1) {
      need += reqs[i].count;
      got += Math.min(countRequirement(placed, reqs[i]), reqs[i].count);
    }
    return need ? got / need : 1;
  }

  // 左右分布均衡度；居中挂饰不参与左右计数
  function balanceRatio(placed) {
    var left = 0;
    var right = 0;
    for (var i = 0; i < placed.length; i += 1) {
      if (placed[i].x < 0.47) left += 1;
      else if (placed[i].x > 0.53) right += 1;
    }
    if (left + right < 2) return 0.5;
    return 1 - Math.abs(left - right) / (left + right);
  }

  // 挂在 8~20 件之间最饱满；太少显得空，太多显得挤
  function richnessRatio(placed) {
    var total = placed.length;
    if (total < TARGET_MIN) return total / TARGET_MIN;
    if (total > TARGET_MAX) return Math.max(0.5, 1 - (total - TARGET_MAX) / (TARGET_MAX * 2));
    return 1;
  }

  function hasTopStar(placed) {
    for (var i = 0; i < placed.length; i += 1) {
      if (placed[i].type === 'star') return true;
    }
    return false;
  }

  function starRatio(placed) {
    return hasTopStar(placed) ? 1 : 0;
  }

  function varietyRatio(placed) {
    var seen = {};
    var kinds = 0;
    for (var i = 0; i < placed.length; i += 1) {
      var type = placed[i].type;
      if (!seen[type]) {
        seen[type] = true;
        kinds += 1;
      }
    }
    return clamp(kinds / 5, 0, 1);
  }

  function gradeFor(score) {
    if (score >= 90) return { title: '圣诞大师', note: '这棵树可以直接挂到橱窗里。' };
    if (score >= 75) return { title: '装饰高手', note: '左右呼应，节日感很足。' };
    if (score >= 60) return { title: '氛围不错', note: '再加几件挂饰会更热闹。' };
    if (score >= 40) return { title: '初来乍到', note: '试试左右对称地挂几颗球。' };
    return { title: '还没点亮', note: '先把树顶的星星挂上吧。' };
  }

  function scoreBuild(theme, placed) {
    var themed = isThemed(theme);
    var weights = themed ? THEMED_WEIGHTS : FREE_WEIGHTS;
    var ratios = {
      fulfillment: themed ? fulfillmentRatio(theme, placed) : 1,
      balance: balanceRatio(placed),
      richness: richnessRatio(placed),
      star: starRatio(placed),
      variety: varietyRatio(placed)
    };
    var parts = [];
    var score = 0;
    if (themed) {
      parts.push({ key: 'fulfillment', label: '主题完成', ratio: ratios.fulfillment });
      parts.push({ key: 'balance', label: '左右平衡', ratio: ratios.balance });
      parts.push({ key: 'richness', label: '装饰丰富度', ratio: ratios.richness });
      parts.push({ key: 'star', label: '树顶星星', ratio: ratios.star });
    } else {
      parts.push({ key: 'balance', label: '左右平衡', ratio: ratios.balance });
      parts.push({ key: 'richness', label: '装饰丰富度', ratio: ratios.richness });
      parts.push({ key: 'star', label: '树顶星星', ratio: ratios.star });
      parts.push({ key: 'variety', label: '种类多样', ratio: ratios.variety });
    }
    for (var i = 0; i < parts.length; i += 1) {
      var part = parts[i];
      part.percent = Math.round(part.ratio * 100);
      score += part.ratio * weights[part.key];
    }
    var total = Math.round(clamp(score, 0, 1) * 100);
    var grade = gradeFor(total);
    return {
      score: total,
      title: grade.title,
      note: grade.note,
      parts: parts,
      themed: themed,
      counts: {
        total: placed.length,
        stars: hasTopStar(placed) ? 1 : 0
      }
    };
  }

  function usedSpotMap(placed) {
    var used = {};
    for (var i = 0; i < placed.length; i += 1) {
      if (placed[i].spotId) used[placed[i].spotId] = true;
    }
    return used;
  }

  function canPlace(def, spot) {
    if (!def || !spot) return false;
    if (def.type === 'star') return spot.kind === 'top';
    return spot.kind !== 'top';
  }

  // 找离按下点最近的空挂点；maxDistance 为归一化距离，未传则不限制
  function findSpot(spots, x, y, placed, maxDistance) {
    var used = usedSpotMap(placed);
    var limit = typeof maxDistance === 'number' ? maxDistance : Infinity;
    var best = null;
    var bestDistance = limit;
    for (var i = 0; i < spots.length; i += 1) {
      var spot = spots[i];
      if (used[spot.id]) continue;
      var dx = spot.x - x;
      var dy = (spot.y - y) * 1.15;
      var distance = Math.sqrt(dx * dx + dy * dy);
      if (distance <= bestDistance) {
        best = spot;
        bestDistance = distance;
      }
    }
    return best;
  }

  function placeAt(placed, def, spot) {
    if (!canPlace(def, spot)) return null;
    var next = placed.slice();
    next.push({
      ornamentId: def.id,
      type: def.type,
      color: def.color,
      spotId: spot.id,
      x: spot.x,
      y: spot.y
    });
    return next;
  }

  function nextSpotFor(spots, def, placed, preferX, preferY) {
    var pool = [];
    for (var i = 0; i < spots.length; i += 1) {
      if (canPlace(def, spots[i])) pool.push(spots[i]);
    }
    if (!pool.length) return null;
    if (typeof preferX === 'number' && typeof preferY === 'number') {
      var near = findSpot(pool, preferX, preferY, placed, 0.35);
      if (near) return near;
    }
    // 兜底：从下往上找空位，视觉上更自然
    var used = usedSpotMap(placed);
    var open = [];
    for (var j = 0; j < pool.length; j += 1) {
      if (!used[pool[j].id]) open.push(pool[j]);
    }
    if (!open.length) return null;
    open.sort(function (a, b) { return b.y - a.y; });
    return open[0];
  }

  root.ChristmasTreeEngine = {
    requirementProgress: requirementProgress,
    fulfillmentRatio: fulfillmentRatio,
    balanceRatio: balanceRatio,
    richnessRatio: richnessRatio,
    varietyRatio: varietyRatio,
    scoreBuild: scoreBuild,
    gradeFor: gradeFor,
    canPlace: canPlace,
    findSpot: findSpot,
    nextSpotFor: nextSpotFor,
    placeAt: placeAt,
    TARGET_MIN: TARGET_MIN,
    TARGET_MAX: TARGET_MAX
  };
}(typeof window !== 'undefined' ? window : this));
