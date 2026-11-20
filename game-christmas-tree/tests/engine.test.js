'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'dist', 'data.js'), 'utf8'), sandbox);
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'dist', 'engine.js'), 'utf8'), sandbox);

const Data = sandbox.window.ChristmasTreeData;
const Engine = sandbox.window.ChristmasTreeEngine;
const byId = {};
Data.ornaments.forEach((item) => { byId[item.id] = item; });

// ---------- 数据完整性 ----------

assert.strictEqual(Data.themes.length, 4, 'three orders plus free mode');
assert.ok(Data.ornaments.length >= 8, 'ornament catalog is large enough');

const ids = new Set();
Data.ornaments.forEach((item) => {
  assert.ok(item.id && !ids.has(item.id), 'unique ornament id ' + item.id);
  ids.add(item.id);
  assert.ok(item.name && item.name.length >= 2, 'ornament name ' + item.id);
  assert.ok(/^#[0-9a-fA-F]{6}$/.test(item.color), 'ornament color ' + item.id);
});

const spotIds = new Set();
const allSpots = Data.spots.concat([Data.topSpot]);
allSpots.forEach((spot) => {
  assert.ok(spot.id && !spotIds.has(spot.id), 'unique spot ' + spot.id);
  spotIds.add(spot.id);
  assert.ok(spot.x > 0 && spot.x < 1, 'spot x in range ' + spot.id);
  assert.ok(spot.y > 0 && spot.y < 1, 'spot y in range ' + spot.id);
});
assert.strictEqual(Data.topSpot.kind, 'top', 'top spot is typed');
assert.strictEqual(Data.spots.length, 27, 'tree has 27 branch spots');

// 每层三角在基准 y 处的可用半宽足够放下挂点
Data.tree.layers.forEach((layer, index) => {
  assert.ok(layer.baseY > layer.apexY, 'layer ' + index + ' is a triangle');
  assert.ok(layer.halfBase > 0, 'layer ' + index + ' has width');
});
Data.spots.forEach((spot) => {
  let inside = false;
  Data.tree.layers.forEach((layer) => {
    if (spot.y < layer.apexY || spot.y > layer.baseY) return;
    const progress = (spot.y - layer.apexY) / (layer.baseY - layer.apexY);
    const half = layer.halfBase * progress;
    if (Math.abs(spot.x - 0.5) <= half + 0.001) inside = true;
  });
  assert.ok(inside, 'spot inside tree silhouette ' + spot.id);
});

// 每个订单的需求都能被现有挂饰满足，且总量在推荐区间内
Data.themes.forEach((theme) => {
  if (!theme.requirements.length) return;
  let need = 0;
  theme.requirements.forEach((req) => {
    assert.ok(req.count >= 1, 'requirement count ' + theme.id);
    need += req.count;
    const matched = Data.ornaments.filter((item) => (
      req.kind === 'color' ? item.color === req.value : item.type === req.value
    ));
    assert.ok(matched.length >= 1, 'requirement matches catalog: ' + theme.id + ' ' + req.label);
  });
  assert.ok(need >= 6 && need <= Data.spots.length + 1, 'order size reachable ' + theme.id);
  assert.ok(need >= Engine.TARGET_MIN, 'order reaches richness target ' + theme.id);
});

// ---------- 评分 ----------

function place(spec) {
  return spec.map((entry) => {
    const def = byId[entry[0]];
    const spot = entry[1] === 'top' ? Data.topSpot : Data.spots.find((s) => s.id === entry[1]);
    const placed = Engine.placeAt([], def, spot);
    assert.ok(placed, 'placement valid ' + entry[0] + ' @ ' + entry[1]);
    return placed[0];
  });
}

const blue = Data.findTheme('blue');
// 8 件，左右各 2 件、居中 3 件、树顶星 1 件
const perfect = place([
  ['star', 'top'],
  ['ball-blue', 't2'],
  ['ball-blue', 't3'],
  ['ball-blue', 'm4'],
  ['ball-silver', 'b1'],
  ['ball-silver', 'b2'],
  ['ball-silver', 'b9'],
  ['ball-gold', 't1']
]);

const perfectScore = Engine.scoreBuild(blue, perfect);
assert.strictEqual(perfectScore.score, 100, 'perfect themed tree scores 100');
assert.strictEqual(perfectScore.title, '圣诞大师', 'perfect grade');
assert.strictEqual(perfectScore.counts.total, 8, 'counts total');
perfectScore.parts.forEach((part) => {
  assert.strictEqual(part.percent, 100, 'perfect part ' + part.key);
});

// 缺树顶星会明显掉分
const noStar = perfect.filter((item) => item.type !== 'star');
const noStarScore = Engine.scoreBuild(blue, noStar);
assert.ok(noStarScore.score < 90, 'missing star lowers score');
assert.ok(noStarScore.score > 50, 'missing star still keeps most of the score');

// 全部堆在左侧时平衡度下降
const lopsided = place([
  ['star', 'top'],
  ['ball-blue', 't2'],
  ['ball-blue', 'm3'],
  ['ball-blue', 'm6'],
  ['ball-silver', 'b1'],
  ['ball-silver', 'b3'],
  ['ball-silver', 'b7'],
  ['ball-gold', 'b8']
]);
const lopsidedScore = Engine.scoreBuild(blue, lopsided);
const lopsidedBalance = lopsidedScore.parts.find((p) => p.key === 'balance');
assert.strictEqual(lopsidedBalance.percent, 0, 'one-sided tree has zero balance');
assert.ok(lopsidedScore.score < perfectScore.score, 'lopsided scores lower');

// 需求进度
const progress = Engine.requirementProgress(blue, perfect);
assert.strictEqual(progress.length, 4, 'four order requirements');
progress.forEach((item) => {
  assert.strictEqual(item.have, item.need, 'requirement complete ' + item.label);
  assert.strictEqual(item.done, true, 'requirement done ' + item.label);
});

const partial = Engine.requirementProgress(blue, perfect.slice(0, 3));
assert.ok(partial.some((item) => !item.done), 'partial build has unfinished requirement');

// 自由模式：无需求、看平衡与丰富度
const free = Data.findTheme('free');
assert.strictEqual(free.requirements.length, 0, 'free mode has no order');
assert.strictEqual(Engine.fulfillmentRatio(free, []), 1, 'free mode fulfillment neutral');
const freeScore = Engine.scoreBuild(free, perfect);
assert.ok(freeScore.score >= 80, 'balanced free tree scores well');
assert.ok(freeScore.parts.some((p) => p.key === 'variety'), 'free mode shows variety');

// 空树分数很低
const emptyScore = Engine.scoreBuild(blue, []);
assert.ok(emptyScore.score < 30, 'empty tree scores low');

// ---------- 放置规则 ----------

assert.strictEqual(Engine.canPlace(byId['star'], Data.topSpot), true, 'star fits top');
assert.strictEqual(Engine.canPlace(byId['star'], Data.spots[0]), false, 'star only on top');
assert.strictEqual(Engine.canPlace(byId['ball-red'], Data.topSpot), false, 'balls not on top');

const near = Engine.findSpot(Data.spots, Data.spots[0].x, Data.spots[0].y, [], 0.2);
assert.strictEqual(near.id, Data.spots[0].id, 'findSpot picks nearest');
const none = Engine.findSpot(Data.spots, 0.5, 0.99, [], 0.05);
assert.strictEqual(none, null, 'findSpot respects max distance');
const skipped = Engine.findSpot(Data.spots, Data.spots[0].x, Data.spots[0].y, perfect, 0.2);
assert.ok(skipped && skipped.id !== 't2', 'findSpot skips occupied spots');
assert.ok(skipped && skipped.id !== 'top', 'branch spots exclude top');

const auto = Engine.nextSpotFor(Data.spots, byId['bell'], [], 0.5, 0.5);
assert.ok(auto && auto.id, 'nextSpotFor finds a free spot');
const autoStar = Engine.nextSpotFor(Data.spots, byId['star'], [], 0.5, 0.5);
assert.strictEqual(autoStar, null, 'star needs explicit top spot');

// ---------- 等级阈值 ----------

assert.strictEqual(Engine.gradeFor(100).title, '圣诞大师');
assert.strictEqual(Engine.gradeFor(90).title, '圣诞大师');
assert.strictEqual(Engine.gradeFor(89).title, '装饰高手');
assert.strictEqual(Engine.gradeFor(75).title, '装饰高手');
assert.strictEqual(Engine.gradeFor(60).title, '氛围不错');
assert.strictEqual(Engine.gradeFor(40).title, '初来乍到');
assert.strictEqual(Engine.gradeFor(39).title, '还没点亮');

console.log('christmas-tree engine tests passed');
