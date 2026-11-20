/*
 * 圣诞装饰树 · 静态数据
 * 挂饰、主题订单、树形与挂点坐标。
 * 所有坐标使用 0~1 的归一化值，渲染时按棋盘尺寸换算。
 */
(function (root) {
  'use strict';

  var ornaments = [
    { id: 'ball-red', name: '红球', type: 'ball', color: '#d8354b' },
    { id: 'ball-gold', name: '金球', type: 'ball', color: '#e8b04b' },
    { id: 'ball-blue', name: '蓝球', type: 'ball', color: '#4f8ef7' },
    { id: 'ball-silver', name: '银球', type: 'ball', color: '#c2cede' },
    { id: 'ball-pink', name: '粉球', type: 'ball', color: '#f08bb0' },
    { id: 'bell', name: '铃铛', type: 'bell', color: '#f2c14e' },
    { id: 'candy', name: '拐杖糖', type: 'candy', color: '#e05252' },
    { id: 'gift', name: '礼物盒', type: 'gift', color: '#d8435c' },
    { id: 'snowman', name: '小雪人', type: 'snowman', color: '#ffffff' },
    { id: 'star', name: '树顶星', type: 'star', color: '#ffd166' }
  ];

  var themes = [
    {
      id: 'blue',
      name: '雪夜蓝调',
      tagline: '蓝银交错，像一场安静的雪',
      accent: '#6fb1ff',
      accentSoft: 'rgba(111, 177, 255, 0.18)',
      requirements: [
        { kind: 'color', value: '#4f8ef7', label: '蓝球', count: 3 },
        { kind: 'color', value: '#c2cede', label: '银球', count: 3 },
        { kind: 'color', value: '#e8b04b', label: '金球', count: 1 },
        { kind: 'type', value: 'star', label: '树顶星', count: 1 }
      ]
    },
    {
      id: 'ginger',
      name: '姜饼暖棕',
      tagline: '铃铛和礼物，烤箱味儿的圣诞',
      accent: '#f0b46a',
      accentSoft: 'rgba(240, 180, 106, 0.18)',
      requirements: [
        { kind: 'color', value: '#e8b04b', label: '金球', count: 3 },
        { kind: 'type', value: 'bell', label: '铃铛', count: 2 },
        { kind: 'type', value: 'gift', label: '礼物盒', count: 2 },
        { kind: 'type', value: 'star', label: '树顶星', count: 1 }
      ]
    },
    {
      id: 'berry',
      name: '莓果红绿',
      tagline: '红绿撞色，最经典的热闹',
      accent: '#ff7a8a',
      accentSoft: 'rgba(255, 122, 138, 0.18)',
      requirements: [
        { kind: 'color', value: '#d8354b', label: '红球', count: 4 },
        { kind: 'type', value: 'candy', label: '拐杖糖', count: 2 },
        { kind: 'color', value: '#f08bb0', label: '粉球', count: 2 },
        { kind: 'type', value: 'star', label: '树顶星', count: 1 }
      ]
    },
    {
      id: 'free',
      name: '自由装饰',
      tagline: '没有订单，按自己的审美来',
      accent: '#8fe3c0',
      accentSoft: 'rgba(143, 227, 192, 0.18)',
      requirements: []
    }
  ];

  // 树顶星专属位置
  var topSpot = { id: 'top', x: 0.5, y: 0.075, kind: 'top' };

  // 树上挂点（自上而下）
  var spots = [
    { id: 't1', x: 0.5, y: 0.22 },
    { id: 't2', x: 0.44, y: 0.3 },
    { id: 't3', x: 0.56, y: 0.3 },
    { id: 't4', x: 0.5, y: 0.37 },
    { id: 'm1', x: 0.4, y: 0.42 },
    { id: 'm2', x: 0.6, y: 0.42 },
    { id: 'm3', x: 0.35, y: 0.5 },
    { id: 'm4', x: 0.5, y: 0.47 },
    { id: 'm5', x: 0.65, y: 0.5 },
    { id: 'm6', x: 0.4, y: 0.56 },
    { id: 'm7', x: 0.6, y: 0.56 },
    { id: 'b1', x: 0.36, y: 0.62 },
    { id: 'b2', x: 0.64, y: 0.62 },
    { id: 'b3', x: 0.29, y: 0.69 },
    { id: 'b4', x: 0.44, y: 0.68 },
    { id: 'b5', x: 0.56, y: 0.68 },
    { id: 'b6', x: 0.71, y: 0.69 },
    { id: 'b7', x: 0.23, y: 0.75 },
    { id: 'b8', x: 0.38, y: 0.75 },
    { id: 'b9', x: 0.5, y: 0.75 },
    { id: 'b10', x: 0.62, y: 0.75 },
    { id: 'b11', x: 0.77, y: 0.75 },
    { id: 'b12', x: 0.18, y: 0.81 },
    { id: 'b13', x: 0.32, y: 0.82 },
    { id: 'b14', x: 0.5, y: 0.83 },
    { id: 'b15', x: 0.68, y: 0.82 },
    { id: 'b16', x: 0.82, y: 0.81 }
  ];

  // 树形：三层三角 + 树干，画布与 SVG 共用
  var tree = {
    layers: [
      { apexY: 0.1, baseY: 0.44, halfBase: 0.17, fill: '#175b3f', edge: '#1f7a52' },
      { apexY: 0.26, baseY: 0.65, halfBase: 0.29, fill: '#155237', edge: '#1c6d49' },
      { apexY: 0.44, baseY: 0.87, halfBase: 0.41, fill: '#12482f', edge: '#196142' }
    ],
    trunk: { x: 0.44, y: 0.865, width: 0.12, height: 0.095 },
    ground: { y: 0.95 }
  };

  function findTheme(id) {
    for (var i = 0; i < themes.length; i += 1) {
      if (themes[i].id === id) return themes[i];
    }
    return themes[0];
  }

  function findOrnament(id) {
    for (var i = 0; i < ornaments.length; i += 1) {
      if (ornaments[i].id === id) return ornaments[i];
    }
    return null;
  }

  root.ChristmasTreeData = {
    ornaments: ornaments,
    themes: themes,
    spots: spots,
    topSpot: topSpot,
    tree: tree,
    findTheme: findTheme,
    findOrnament: findOrnament,
    targetMin: 8,
    targetMax: 20
  };
}(window));
