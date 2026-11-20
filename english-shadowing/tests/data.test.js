'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const sandbox = { window: {}, atob: (raw) => Buffer.from(raw, 'base64').toString('binary') };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'dist', 'data.js'), 'utf8'), sandbox);

const Data = sandbox.window.ShadowingData;

assert.ok(Data, 'data namespace exists');
assert.strictEqual(Data.words.length, 12, 'twelve vocabulary words');

const wordIds = new Set();
Data.words.forEach((item) => {
  assert.ok(item.id && item.text, 'word present: ' + item.id);
  assert.ok(!wordIds.has(item.id), 'unique word id: ' + item.id);
  wordIds.add(item.id);
  assert.ok(/^\/.+\/$/.test(item.ipa), 'word ipa: ' + item.id);
  assert.ok(item.tip && item.tip.length >= 6, 'word tip: ' + item.id);
  assert.ok(item.zh && item.zh.length >= 1, 'word translation: ' + item.id);
});

assert.strictEqual(Data.scenes.length, 2, 'two scenes for now');
const sceneIds = Data.scenes.map((scene) => scene.id);
assert.ok(sceneIds.indexOf('customs') !== -1, 'customs scene');
assert.ok(sceneIds.indexOf('hotel') !== -1, 'hotel scene');

Data.scenes.forEach((scene) => {
  assert.ok(scene.label && scene.label.length >= 2, 'scene label: ' + scene.id);
  assert.ok(scene.roles && scene.roles.a && scene.roles.b, 'scene roles: ' + scene.id);
  assert.strictEqual(scene.lines.length, 8, 'eight dialogue lines: ' + scene.id);
  const roles = new Set();
  const lineIds = new Set();
  scene.lines.forEach((line) => {
    assert.ok(line.id && !lineIds.has(line.id), 'unique line id: ' + line.id);
    lineIds.add(line.id);
    assert.ok(line.role === 'a' || line.role === 'b', 'line role: ' + line.id);
    roles.add(line.role);
    assert.ok(line.text && line.text.split(' ').length >= 3, 'line text: ' + line.id);
    assert.ok(/[.!?]$/.test(line.text), 'line punctuation: ' + line.id);
    assert.ok(/^\/.+\/$/.test(line.ipa), 'line ipa: ' + line.id);
    assert.ok(line.tip && line.tip.length >= 6, 'line tip: ' + line.id);
    assert.ok(line.zh && line.zh.length >= 3, 'line translation: ' + line.id);
  });
  assert.ok(roles.has('a') && roles.has('b'), 'both speakers present: ' + scene.id);
});

assert.strictEqual(typeof Data.placeholderAudio, 'undefined', 'production build ships no placeholder audio');

console.log('shadowing data tests passed');
