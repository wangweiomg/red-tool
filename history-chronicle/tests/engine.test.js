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

const Data = sandbox.window.CHRONICLE_DATA;
const Engine = sandbox.window.ChronicleEngine;

assert.ok(Data, 'data exists');
assert.ok(Engine, 'engine exists');
assert.strictEqual(Data.eras.length, 4, 'four eras');
assert.ok(Data.entries.length >= 20, 'at least 20 entries');
assert.ok(Data.stories.length >= 28, 'at least 28 stories');

const eraIds = {};
for (const era of Data.eras) {
  assert.ok(era.id && era.name && era.range && era.summary, 'era fields ' + era.id);
  assert.ok(!eraIds[era.id], 'unique era ' + era.id);
  eraIds[era.id] = true;
}

const entryIds = {};
for (const entry of Data.entries) {
  assert.ok(entry.id && entry.china && entry.west, 'entry fields ' + entry.id);
  assert.ok(eraIds[entry.era], 'entry era exists ' + entry.id);
  assert.ok(typeof entry.sortYear === 'number', 'entry sortYear ' + entry.id);
  assert.ok(entry.yearLabel, 'entry yearLabel ' + entry.id);
  assert.ok(entry.china.title && entry.china.text, 'china fields ' + entry.id);
  assert.ok(entry.west.title && entry.west.text, 'west fields ' + entry.id);
  assert.ok(!entryIds[entry.id], 'unique entry ' + entry.id);
  entryIds[entry.id] = true;
}

const storyIds = {};
for (const story of Data.stories) {
  assert.ok(story.id && story.title && story.summary, 'story fields ' + story.id);
  assert.ok(story.region === 'cn' || story.region === 'west', 'story region ' + story.id);
  assert.ok(story.kind && story.period, 'story kind/period ' + story.id);
  assert.ok(Array.isArray(story.paragraphs) && story.paragraphs.length >= 2,
    'story paragraphs ' + story.id);
  assert.ok(Array.isArray(story.keyPoints) && story.keyPoints.length >= 2,
    'story keyPoints ' + story.id);
  assert.ok(story.sources, 'story sources ' + story.id);
  assert.ok(!storyIds[story.id], 'unique story ' + story.id);
  storyIds[story.id] = true;
}

// 双向引用一致
for (const entry of Data.entries) {
  for (const id of entry.storyIds || []) {
    assert.ok(storyIds[id], 'entry story exists ' + entry.id + ' -> ' + id);
    const story = Engine.findStory(Data.stories, id);
    assert.ok(story.relatedEntries.indexOf(entry.id) !== -1,
      'story links back ' + entry.id + ' -> ' + id);
  }
}
for (const story of Data.stories) {
  assert.ok(story.relatedEntries.length > 0, 'story has related entry ' + story.id);
  for (const id of story.relatedEntries) {
    assert.ok(entryIds[id], 'story entry exists ' + story.id + ' -> ' + id);
    const entry = Data.entries.filter((item) => item.id === id)[0];
    assert.ok((entry.storyIds || []).indexOf(story.id) !== -1,
      'entry links back ' + story.id + ' -> ' + id);
  }
}

// 排序
const sorted = Engine.sortEntries(Data.entries);
for (let i = 1; i < sorted.length; i += 1) {
  assert.ok(sorted[i - 1].sortYear <= sorted[i].sortYear, 'entries sorted');
}
assert.strictEqual(sorted[0].id, 'e01', 'myth starts the timeline');
assert.strictEqual(sorted[sorted.length - 1].id, 'e21', 'late Han ends the timeline');

// 筛选
assert.strictEqual(Engine.filterEntries(Data.entries, { era: 'myth' }).length, 3);
assert.strictEqual(Engine.filterEntries(Data.entries, { includeLegend: false })
  .filter((entry) => entry.legend).length, 0, 'legend entries hidden');
assert.ok(Engine.filterEntries(Data.entries, { query: '孔子' })
  .some((entry) => entry.id === 'e10'), 'search Confucius');
assert.ok(Engine.filterEntries(Data.entries, { query: '摩西' })
  .some((entry) => entry.id === 'e06'), 'search Moses');
assert.ok(Engine.filterEntries(Data.entries, { query: '耶稣' })
  .some((entry) => entry.id === 'e19'), 'search Jesus');
assert.strictEqual(Engine.filterEntries(Data.entries, { query: '不存在的词条' }).length, 0);

assert.strictEqual(Engine.filterStories(Data.stories, { region: 'cn' })
  .every((story) => story.region === 'cn'), true, 'region filter cn');
assert.strictEqual(Engine.filterStories(Data.stories, { region: 'west' })
  .every((story) => story.region === 'west'), true, 'region filter west');
assert.ok(Engine.filterStories(Data.stories, { query: '出埃及' })
  .some((story) => story.id === 'west-moses'), 'search story');
assert.strictEqual(Engine.filterStories(Data.stories, { query: '不存在的故事' }).length, 0);

// 关联查询
const mosesEntries = Engine.entriesForStory(Data.entries, 'west-moses');
assert.strictEqual(mosesEntries.length, 1);
assert.strictEqual(mosesEntries[0].id, 'e06');

const counts = Engine.countByEra(Data.entries, Data.eras);
assert.strictEqual(counts.myth, 3);
assert.strictEqual(counts.bronze + counts.axial + counts.empire,
  Data.entries.length - 3, 'counts cover all entries');

assert.strictEqual(Engine.eraById(Data.eras, 'axial').name, '东周：春秋战国');
assert.strictEqual(Engine.findStory(Data.stories, 'missing'), null);

console.log('history chronicle tests passed, entries:', Data.entries.length,
  'stories:', Data.stories.length);
