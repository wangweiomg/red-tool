'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const sandbox = { window: {} };
vm.runInNewContext(
  fs.readFileSync(path.join(__dirname, '..', 'dist', 'data.js'), 'utf8'),
  sandbox
);
vm.runInNewContext(
  fs.readFileSync(path.join(__dirname, '..', 'dist', 'engine.js'), 'utf8'),
  sandbox
);

const Data = sandbox.window.HIKING_DATA;
const Engine = sandbox.window.HikingEngine;

assert.ok(Data && Engine, 'data and engine exist');
assert.strictEqual(Data.cities.length, 1, 'one city in phase one');
assert.strictEqual(Engine.totalRoutes(Data.cities), 10, 'ten routes');

const cityIds = {};
const routeIds = {};
const levels = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

for (const city of Data.cities) {
  assert.ok(city.id && city.name && city.region, 'city fields ' + city.id);
  assert.ok(city.tagline && city.intro && city.best && city.note, 'city details ' + city.id);
  assert.ok(!cityIds[city.id], 'unique city ' + city.id);
  cityIds[city.id] = true;
  assert.strictEqual(city.routes.length, 10, 'ten routes for ' + city.id);

  for (const route of city.routes) {
    assert.ok(route.id && route.name && route.summary, 'route fields ' + route.id);
    assert.ok(route.level >= 1 && route.level <= 5, 'route level ' + route.id);
    levels[route.level] += 1;
    assert.ok(route.distance && route.ascent && route.time, 'route stats ' + route.id);
    assert.ok(route.highlight, 'route highlight ' + route.id);
    assert.strictEqual(typeof route.family, 'boolean', 'route family flag ' + route.id);
    assert.ok(Array.isArray(route.tags) && route.tags.length > 0, 'route tags ' + route.id);
    assert.ok(route.start && route.tips, 'route start/tips ' + route.id);
    assert.ok(Array.isArray(route.highlights) && route.highlights.length > 0,
      'route highlights ' + route.id);
    assert.ok(!routeIds[route.id], 'unique route ' + route.id);
    routeIds[route.id] = true;
  }
}

assert.ok(levels[1] > 0 && levels[2] > 0 && levels[3] > 0 && levels[4] > 0,
  'levels 1-4 represented');
assert.strictEqual(levels[5], 0, 'no level 5 in the Beijing shortlist');
assert.strictEqual(levels[1] + levels[2] + levels[3] + levels[4] + levels[5], 10);

assert.strictEqual(Engine.levelName(1), '轻松');
assert.strictEqual(Engine.levelName(5), '硬核');
assert.strictEqual(Engine.levelGroup(2), 'easy');
assert.strictEqual(Engine.levelGroup(3), 'moderate');
assert.strictEqual(Engine.levelGroup(5), 'hard');

const beijing = Engine.cityById(Data.cities, 'beijing');
assert.ok(beijing, 'find Beijing');
assert.strictEqual(Engine.cityById(Data.cities, 'missing'), null);

const sorted = Engine.sortRoutes(beijing.routes);
for (let i = 1; i < sorted.length; i += 1) {
  assert.ok(sorted[i - 1].level <= sorted[i].level, 'routes sorted by level');
}
assert.strictEqual(sorted[0].level, 1);
assert.strictEqual(sorted[sorted.length - 1].level, 4);

const easy = Engine.filterRoutes(beijing.routes, { group: 'easy' });
assert.ok(easy.length > 0 && easy.every((r) => r.level <= 2), 'easy filter');
const moderate = Engine.filterRoutes(beijing.routes, { group: 'moderate' });
assert.ok(moderate.every((r) => r.level === 3), 'moderate filter');
const hard = Engine.filterRoutes(beijing.routes, { group: 'hard' });
assert.ok(hard.every((r) => r.level >= 4), 'hard filter');
const family = Engine.filterRoutes(beijing.routes, { group: 'family' });
assert.strictEqual(family.length, 5, 'five family routes');
assert.ok(family.every((r) => r.family), 'family filter');

assert.ok(Engine.filterRoutes(beijing.routes, { query: '水长城' })
  .some((r) => r.id === 'bj-03'), 'search route');
assert.ok(Engine.filterRoutes(beijing.routes, { query: '木栈道' })
  .some((r) => r.id === 'bj-02'), 'search feature');
assert.strictEqual(Engine.filterRoutes(beijing.routes, { query: '不存在的路线' }).length, 0);

const counts = Engine.groupCounts(beijing.routes);
assert.strictEqual(counts.easy + counts.moderate + counts.hard, 10);
assert.strictEqual(Engine.findRoute(Data.cities, 'bj-01').name, '百望山森林公园');
assert.strictEqual(Engine.findRoute(Data.cities, 'missing'), null);

console.log('city hiking tests passed, cities:', Data.cities.length,
  'routes:', Engine.totalRoutes(Data.cities));
