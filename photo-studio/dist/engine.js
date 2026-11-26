/*
 * 头像壁纸工坊 · 布局逻辑
 * 图片 cover 适配、偏移限制。可在 Node 中测试。
 */
(function (root) {
  'use strict';

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  // 把图片按 cover 方式放进 box，scale 为额外缩放（>=1），offset 为相对 box 的偏移
  function coverRect(imageWidth, imageHeight, boxWidth, boxHeight, scale, offsetX, offsetY) {
    if (!(imageWidth > 0) || !(imageHeight > 0) || !(boxWidth > 0) || !(boxHeight > 0)) {
      return null;
    }
    var base = Math.max(boxWidth / imageWidth, boxHeight / imageHeight);
    var factor = base * (scale || 1);
    var width = imageWidth * factor;
    var height = imageHeight * factor;
    var x = (boxWidth - width) / 2 + (offsetX || 0) * boxWidth;
    var y = (boxHeight - height) / 2 + (offsetY || 0) * boxHeight;
    return {
      x: x === 0 ? 0 : x,
      y: y === 0 ? 0 : y,
      width: width,
      height: height,
      scale: factor
    };
  }

  function clampOffset(imageWidth, imageHeight, boxWidth, boxHeight, scale, offsetX, offsetY) {
    var rect = coverRect(imageWidth, imageHeight, boxWidth, boxHeight, scale, 0, 0);
    if (!rect) return { offsetX: 0, offsetY: 0 };
    var maxX = Math.max(0, (rect.width - boxWidth) / 2) / boxWidth;
    var maxY = Math.max(0, (rect.height - boxHeight) / 2) / boxHeight;
    var nextX = clamp(offsetX || 0, -maxX, maxX);
    var nextY = clamp(offsetY || 0, -maxY, maxY);
    return {
      offsetX: nextX === 0 ? 0 : nextX,
      offsetY: nextY === 0 ? 0 : nextY
    };
  }

  root.PhotoStudioEngine = {
    clamp: clamp,
    coverRect: coverRect,
    clampOffset: clampOffset
  };
}(typeof window !== 'undefined' ? window : this));
