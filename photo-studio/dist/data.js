/*
 * 头像壁纸工坊 · 数据
 * 模板与配色；所有画面由 Canvas 程序化绘制。
 */
(function (root) {
  'use strict';

  var avatarFrames = [
    {
      id: 'wreath', name: '奶油花环',
      ring: '#e8d7bd', ringDark: '#c9ae86', leaf: '#7fae84', leafDark: '#5f8f63',
      flower: '#fffaf0', flowerCore: '#e0a94b', sparkle: '#f6d79b'
    },
    {
      id: 'gold', name: '金边',
      ring: '#e3b160', ringDark: '#b98b4b', leaf: '#f6d79b', leafDark: '#d8ab5e',
      flower: '#fff4d6', flowerCore: '#c98f3c', sparkle: '#fff1c2'
    },
    {
      id: 'neon', name: '霓虹',
      ring: '#8f7cf6', ringDark: '#4f8ef7', leaf: '#6fe3c8', leafDark: '#3bb79c',
      flower: '#ffd166', flowerCore: '#ff8fb1', sparkle: '#ffffff'
    },
    {
      id: 'winter', name: '冬日',
      ring: '#cfe2ff', ringDark: '#8fb3d9', leaf: '#ffffff', leafDark: '#dbe9ff',
      flower: '#ffffff', flowerCore: '#8fb3d9', sparkle: '#ffffff'
    }
  ];

  var wallpaperThemes = [
    {
      id: 'morning', name: '奶油晨光', tagline: '今日份好心情',
      top: '#fdf3e0', bottom: '#f3dfc2', glow: 'rgba(255, 214, 150, 0.55)',
      text: '#7a5a33', accent: '#e0a94b', overlay: 'rgba(255, 245, 228, 0.42)'
    },
    {
      id: 'night', name: '夜航星', tagline: '晚安，明天见',
      top: '#16233f', bottom: '#0a1226', glow: 'rgba(120, 160, 255, 0.35)',
      text: '#eaf0ff', accent: '#ffd166', overlay: 'rgba(14, 22, 42, 0.5)'
    },
    {
      id: 'sea', name: '海盐', tagline: '去吹吹海风',
      top: '#e6f4fb', bottom: '#bcd9ea', glow: 'rgba(255, 255, 255, 0.4)',
      text: '#31586b', accent: '#5fa3c2', overlay: 'rgba(235, 248, 255, 0.38)'
    },
    {
      id: 'citrus', name: '柑橘', tagline: '把夏天装进口袋',
      top: '#fff2dd', bottom: '#ffd9a8', glow: 'rgba(255, 180, 80, 0.45)',
      text: '#8a4f1c', accent: '#e8890c', overlay: 'rgba(255, 244, 224, 0.34)'
    }
  ];

  function findFrame(id) {
    for (var i = 0; i < avatarFrames.length; i += 1) {
      if (avatarFrames[i].id === id) return avatarFrames[i];
    }
    return avatarFrames[0];
  }

  function findTheme(id) {
    for (var i = 0; i < wallpaperThemes.length; i += 1) {
      if (wallpaperThemes[i].id === id) return wallpaperThemes[i];
    }
    return wallpaperThemes[0];
  }

  root.PhotoStudioData = {
    avatarFrames: avatarFrames,
    wallpaperThemes: wallpaperThemes,
    findFrame: findFrame,
    findTheme: findTheme,
    avatarSize: 800,
    wallpaperWidth: 1080,
    wallpaperHeight: 1920
  };
}(window));
