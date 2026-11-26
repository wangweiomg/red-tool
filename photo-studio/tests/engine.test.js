'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'dist', 'data.js'), 'utf8'), sandbox);
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'dist', 'engine.js'), 'utf8'), sandbox);

const Data = sandbox.window.PhotoStudioData;
const Engine = sandbox.window.PhotoStudioEngine;

assert.ok(Data, 'data exists');
assert.strictEqual(Data.avatarFrames.length, 4, 'four avatar frames');
assert.strictEqual(Data.wallpaperThemes.length, 4, 'four wallpaper themes');
assert.strictEqual(Data.avatarSize, 800);
assert.strictEqual(Data.wallpaperWidth, 1080);
assert.strictEqual(Data.wallpaperHeight, 1920);

Data.avatarFrames.forEach((frame) => {
  assert.ok(frame.id && frame.name, 'frame id/name');
  assert.ok(/^#/.test(frame.ring), 'frame color');
});
Data.wallpaperThemes.forEach((theme) => {
  assert.ok(theme.id && theme.name && theme.tagline, 'theme fields');
  assert.ok(/^#/.test(theme.top) && /^#/.test(theme.bottom), 'theme colors');
});

// cover 适配：横图进正方形
const landscape = Engine.coverRect(1000, 500, 800, 800, 1, 0, 0);
assert.ok(landscape);
assert.strictEqual(landscape.width, 1600);
assert.strictEqual(landscape.height, 800);
assert.strictEqual(landscape.x, -400);
assert.strictEqual(landscape.y, 0);

// 额外缩放
const zoomed = Engine.coverRect(1000, 500, 800, 800, 2, 0, 0);
assert.strictEqual(zoomed.width, 3200);
assert.strictEqual(zoomed.height, 1600);
assert.strictEqual(zoomed.y, -400);

// 竖图进正方形
const portrait = Engine.coverRect(500, 1000, 800, 800, 1, 0, 0);
assert.strictEqual(portrait.width, 800);
assert.strictEqual(portrait.height, 1600);
assert.strictEqual(portrait.y, -400);

// 壁纸比例
const wallpaper = Engine.coverRect(1200, 800, 1080, 1920, 1, 0, 0);
assert.ok(wallpaper);
assert.ok(wallpaper.width >= 1080);
assert.ok(wallpaper.height >= 1920);

// 偏移限制
const clamped = Engine.clampOffset(1000, 500, 800, 800, 1, 0.9, -0.9);
assert.strictEqual(clamped.offsetX, 0.5);
assert.strictEqual(clamped.offsetY, 0);

const centered = Engine.clampOffset(1000, 500, 800, 800, 1, 0, 0);
assert.strictEqual(centered.offsetX, 0);
assert.strictEqual(centered.offsetY, 0);

const noPan = Engine.clampOffset(800, 800, 800, 800, 1, 0.4, 0.4);
assert.strictEqual(noPan.offsetX, 0);
assert.strictEqual(noPan.offsetY, 0);

// 非法输入
assert.strictEqual(Engine.coverRect(0, 500, 800, 800, 1, 0, 0), null);
assert.strictEqual(Engine.coverRect(1000, 500, 0, 800, 1, 0, 0), null);

assert.strictEqual(Data.findFrame('gold').id, 'gold');
assert.strictEqual(Data.findFrame('missing').id, 'wreath');
assert.strictEqual(Data.findTheme('night').id, 'night');

console.log('photo-studio engine tests passed');
