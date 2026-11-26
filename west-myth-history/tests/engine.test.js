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

const Data = sandbox.window.SACRED_HISTORY_DATA;
const Engine = sandbox.window.SacredHistoryEngine;

assert.ok(Data, 'data exists');
assert.ok(Engine, 'engine exists');
assert.strictEqual(Data.eras.length, 4, 'four eras');
assert.strictEqual(Data.events.length, 33, '33 events');

const eraIds = {};
for (const era of Data.eras) {
  assert.ok(era.id && era.name && era.range && era.summary, 'era fields ' + era.id);
  assert.ok(!eraIds[era.id], 'unique era ' + era.id);
  eraIds[era.id] = true;
}

const kinds = { '神话': 0, '圣经': 0, '历史': 0 };
const eventIds = {};
for (const event of Data.events) {
  assert.ok(event.id && event.title && event.subtitle && event.summary, 'event fields ' + event.id);
  assert.ok(eraIds[event.era], 'event era exists ' + event.id);
  assert.ok(kinds[event.kind] != null, 'event kind ' + event.id);
  kinds[event.kind] += 1;
  assert.ok(typeof event.sortYear === 'number', 'sortYear ' + event.id);
  assert.ok(event.dateLabel && event.tradition, 'date/tradition ' + event.id);
  assert.ok(Array.isArray(event.paragraphs) && event.paragraphs.length >= 2,
    'paragraphs ' + event.id);
  assert.ok(Array.isArray(event.keyPoints) && event.keyPoints.length >= 3,
    'keyPoints ' + event.id);
  assert.ok(event.sources, 'sources ' + event.id);
  assert.ok(event.caution, 'caution ' + event.id);
  assert.ok(!eventIds[event.id], 'unique event ' + event.id);
  eventIds[event.id] = true;
}
assert.strictEqual(kinds['神话'], 7, 'seven myth events');
assert.strictEqual(kinds['圣经'], 12, 'twelve scripture events');
assert.strictEqual(kinds['历史'], 14, 'fourteen history events');

// 排序：先按时代，再按年代
const eraOrder = { myth: 0, old: 1, new: 2, church: 3 };
const sorted = Engine.sortEvents(Data.events);
for (let i = 1; i < sorted.length; i += 1) {
  const prev = sorted[i - 1];
  const cur = sorted[i];
  assert.ok(eraOrder[prev.era] <= eraOrder[cur.era], 'events sorted by era');
  if (prev.era === cur.era) {
    assert.ok(prev.sortYear <= cur.sortYear, 'events sorted by year within era');
  }
}
assert.strictEqual(sorted[0].id, 'm03', 'Osiris opens the scroll');
assert.strictEqual(sorted[sorted.length - 1].id, 'c08', 'Vatican II closes the scroll');

// 筛选
assert.strictEqual(Engine.filterEvents(Data.events, { era: 'myth' }).length, 8);
assert.strictEqual(Engine.filterEvents(Data.events, { era: 'old' }).length, 9);
assert.strictEqual(Engine.filterEvents(Data.events, { era: 'new' }).length, 8);
assert.strictEqual(Engine.filterEvents(Data.events, { era: 'church' }).length, 8);
assert.strictEqual(Engine.filterEvents(Data.events, { kind: '神话' }).length, 7);
assert.strictEqual(Engine.filterEvents(Data.events, { kind: '圣经' }).length, 12);
assert.strictEqual(Engine.filterEvents(Data.events, { kind: '历史' }).length, 14);
assert.ok(Engine.filterEvents(Data.events, { query: '摩西' }).some((e) => e.id === 'o05'),
  'search Moses');
assert.ok(Engine.filterEvents(Data.events, { query: '路德' }).some((e) => e.id === 'c06'),
  'search Luther');
assert.ok(Engine.filterEvents(Data.events, { query: '诸神黄昏' }).some((e) => e.id === 'm08'),
  'search Ragnarok');
assert.ok(Engine.filterEvents(Data.events, { query: '尼西亚' }).some((e) => e.id === 'n08'),
  'search Nicaea');
assert.strictEqual(Engine.filterEvents(Data.events, { query: '不存在的词条' }).length, 0);

// 关系与分组
assert.strictEqual(Engine.findEvent(Data.events, 'missing'), null);
assert.strictEqual(Engine.findEvent(Data.events, 'o05').title, '摩西与出埃及');

const first = Engine.neighbors(Data.events, 'm03');
assert.strictEqual(first.prev, null);
assert.strictEqual(first.next.id, 'm04');
assert.strictEqual(first.index, 0);

const last = Engine.neighbors(Data.events, 'c08');
assert.strictEqual(last.prev.id, 'c07');
assert.strictEqual(last.next, null);

const groups = Engine.groupByEra(Data.events, Data.eras);
assert.strictEqual(groups.length, 4);
assert.strictEqual(groups[0].era.id, 'myth');
assert.strictEqual(groups[3].era.id, 'church');

const counts = Engine.countByEra(Data.events, Data.eras);
assert.strictEqual(counts.myth, 8);
assert.strictEqual(counts.old, 9);
assert.strictEqual(counts.new, 8);
assert.strictEqual(counts.church, 8);
assert.strictEqual(Engine.eraById(Data.eras, 'church').name, '中世纪与宗教改革');

console.log('west myth history tests passed, events:', Data.events.length);
