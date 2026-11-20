/*
 * 装修实验室 · 静态数据
 * 材质、家具目录与户型。所有颜色由 Canvas 直接绘制，不依赖外部素材。
 */
(function (root) {
  'use strict';

  var floorStyles = [
    { id: 'oak', name: '原木', base: '#d9bf98', accent: '#c6a87f', line: '#b9976c' },
    { id: 'grey', name: '浅灰', base: '#cfd3d6', accent: '#bcc2c7', line: '#aab1b7' },
    { id: 'terrazzo', name: '水磨石', base: '#e7e1d3', accent: '#d3cbb9', line: '#c2b9a5' },
    { id: 'herringbone', name: '人字拼', base: '#d8bb92', accent: '#c6a57c', line: '#b08c60', marketId: 'style-floor-herringbone' }
  ];

  var wallStyles = [
    { id: 'cream', name: '奶油', base: '#f4ecdd', shade: '#e3d7c3', line: '#d6c8b0' },
    { id: 'sage', name: '鼠尾草', base: '#dfe8db', shade: '#cbdac8', line: '#b9cbb6' },
    { id: 'blue', name: '灰蓝', base: '#dde6ee', shade: '#c9d8e4', line: '#b6c8d7' },
    { id: 'microcement', name: '微水泥', base: '#e6e0d6', shade: '#d5cec2', line: '#c4bcae', marketId: 'style-wall-microcement' }
  ];

  var lightStyles = [
    { id: 'warm', name: '暖光', tint: 'rgba(255, 196, 120, 0.12)', glow: 'rgba(255, 214, 150, 0.35)' },
    { id: 'day', name: '自然光', tint: 'rgba(255, 255, 255, 0.05)', glow: 'rgba(255, 245, 220, 0.28)' },
    { id: 'cool', name: '冷光', tint: 'rgba(150, 190, 255, 0.09)', glow: 'rgba(190, 220, 255, 0.3)' },
    { id: 'amber', name: '暖黄', tint: 'rgba(255, 180, 90, 0.15)', glow: 'rgba(255, 200, 120, 0.4)', marketId: 'style-light-amber' }
  ];

  var items = [
    { id: 'rug', name: '地毯', w: 2, d: 2, h: 3, category: '地面', color: '#e7dccb', accent: '#cdbba2', flat: true },
    { id: 'sofa', name: '沙发', w: 2, d: 1, h: 34, category: '家具', color: '#eee2cf', accent: '#d4c1a5' },
    { id: 'bed', name: '床', w: 2, d: 2, h: 26, category: '家具', color: '#f1e8d9', accent: '#d8c3a6' },
    { id: 'coffee', name: '茶几', w: 1, d: 1, h: 16, category: '家具', color: '#c9a87c', accent: '#a9865d' },
    { id: 'shelf', name: '书架', w: 1, d: 1, h: 62, category: '家具', color: '#c8a67a', accent: '#a9865d' },
    { id: 'tv', name: '电视柜', w: 2, d: 1, h: 36, category: '家具', color: '#cdb08a', accent: '#a9865d' },
    { id: 'chair', name: '单椅', w: 1, d: 1, h: 28, category: '家具', color: '#e3d3ba', accent: '#c4ac8c' },
    { id: 'side', name: '边几', w: 1, d: 1, h: 18, category: '家具', color: '#d8b98c', accent: '#b6956a' },
    { id: 'plant', name: '绿植', w: 1, d: 1, h: 50, category: '装饰', color: '#5f8f63', accent: '#3f6a46' },
    { id: 'lamp', name: '落地灯', w: 1, d: 1, h: 70, category: '装饰', color: '#f0d9a8', accent: '#b99a6a' },
    { id: 'art', name: '挂画', w: 2, h: 46, category: '墙面', wall: true, color: '#e8d8bc', accent: '#b99a6a' },
    { id: 'curtain', name: '窗帘', w: 2, h: 78, category: '墙面', wall: true, color: '#efe3d0', accent: '#d3bfa4' }
  ];


  var marketCategories = [
    { id: 'paint', name: '油漆墙面' },
    { id: 'floor', name: '地面' },
    { id: 'door', name: '门窗窗帘' },
    { id: 'furniture', name: '家具' },
    { id: 'light', name: '灯具' },
    { id: 'tools', name: '工具辅料' }
  ];

  var marketItems = [
    { id: 'paint-latex', cat: 'paint', name: '净味乳胶漆', price: 480, unit: '5L/桶', material: '丙烯酸乳液、钛白粉', grade: '十环认证 / 法国 A+', usage: '客厅、卧室、书房墙面', tip: '重点看 VOC 和游离甲醛指标，浅色漆通常需要两遍面漆。' },
    { id: 'paint-art', cat: 'paint', name: '艺术漆', price: 1680, unit: '10kg/桶', material: '矿物粉、水性乳液', grade: '法国 A+', usage: '电视墙、玄关背景墙', tip: '效果高度依赖施工师傅手法，建议先做小样。' },
    { id: 'paint-wallpaper', cat: 'paint', name: '无纺布壁纸', price: 260, unit: '卷（5.3㎡）', material: '无纺布基材', grade: 'E1 级', usage: '卧室、儿童房', tip: '壁纸本身环保不代表胶水环保，优先选糯米胶。' },
    { id: 'paint-panel', cat: 'paint', name: '竹木纤维护墙板', price: 320, unit: '㎡', material: '竹木纤维、PVC', grade: 'E0 级', usage: '客厅、走廊墙面', tip: '关注基材密度和封边工艺，避免大面积拼接缝。' },

    { id: 'floor-wood', cat: 'floor', name: '实木地板', price: 380, unit: '㎡', material: '天然橡木', grade: 'E0 级', usage: '卧室、书房', tip: '关注含水率与安装方式，地暖环境要选专用款。' },
    { id: 'floor-laminate', cat: 'floor', name: '强化复合地板', price: 160, unit: '㎡', material: '高密度纤维板、耐磨层', grade: 'E0 / E1 级', usage: '客厅、出租房', tip: '耐磨转数越高越耐用，注意基材环保等级。' },
    { id: 'floor-tile', cat: 'floor', name: '大理石瓷砖', price: 220, unit: '㎡', material: '瓷质坯体、釉面', grade: 'A 类装饰装修材料', usage: '客餐厅、厨房', tip: '选防滑系数高的哑光面，铺贴留缝 1.5–2mm。' },
    { id: 'style-floor-herringbone', cat: 'floor', name: '人字拼橡木地板', price: 420, unit: '㎡', material: '橡木多层实木', grade: 'E0 级', usage: '全屋通铺，适合奶油风', tip: '人字拼损耗率约 8–10%，购买时多备 10%。', unlock: 'floor', unlockId: 'herringbone' },

    { id: 'door-wood', cat: 'door', name: '实木复合门', price: 1980, unit: '樘', material: '实木复合门芯、密度板', grade: 'E0 级', usage: '卧室、书房', tip: '看门套材质和合页数量，隔音看门芯填充。' },
    { id: 'door-curtain', cat: 'door', name: '遮光窗帘', price: 380, unit: '套（3m 窗宽）', material: '聚酯纤维、遮光涂层', grade: 'B1 阻燃', usage: '卧室', tip: '遮光率 85% 以上适合卧室，注意克重和垂感。' },
    { id: 'door-blind', cat: 'door', name: '铝合金百叶帘', price: 260, unit: '㎡', material: '铝合金叶片', grade: '—', usage: '书房、卫生间', tip: '叶片厚度 0.18mm 以上更不易变形。' },

    { id: 'furniture-sofa', cat: 'furniture', name: '布艺沙发', price: 3600, unit: '三人位', material: '实木框架、高密度海绵、棉麻布', grade: 'E0 级板材', usage: '客厅', tip: '坐深 55–60cm 更适合小户型，布套可拆洗优先。' },
    { id: 'furniture-bed', cat: 'furniture', name: '乳胶床垫', price: 4200, unit: '1.8×2m', material: '天然乳胶、独立袋装弹簧', grade: '环保纺织品认证', usage: '卧室', tip: '乳胶密度 75D 以上支撑更好，注意透气性。' },
    { id: 'furniture-wardrobe', cat: 'furniture', name: '实木衣柜', price: 5600, unit: '2.4m 宽', material: '橡木、环保饰面板', grade: 'E0 级', usage: '卧室', tip: '先量好开门半径，顶天立地更省空间。' },
    { id: 'furniture-table', cat: 'furniture', name: '岩板餐桌', price: 2800, unit: '1.6m', material: '岩板台面、碳钢桌腿', grade: '—', usage: '餐厅', tip: '岩板厚度 12mm 以上更稳，注意边角倒角。' },

    { id: 'light-ceiling', cat: 'light', name: '吸顶灯', price: 680, unit: '盏', material: 'ABS、亚克力灯罩', grade: '—', usage: '客厅、卧室', tip: '客厅选 4000K 中性光，卧室 3000K 更放松。' },
    { id: 'light-floor', cat: 'light', name: '落地灯', price: 420, unit: '盏', material: '铁艺灯架、布艺灯罩', grade: '—', usage: '沙发旁、阅读角', tip: '显色指数 Ra90 以上，看书更舒服。' },
    { id: 'style-light-amber', cat: 'light', name: '暖光氛围灯', price: 320, unit: '盏', material: '铝合金、亚克力', grade: '—', usage: '卧室、床头', tip: '2700K 暖黄光适合睡前，避免直射眼睛。', unlock: 'light', unlockId: 'amber' },

    { id: 'tools-drill', cat: 'tools', name: '充电电钻', price: 399, unit: '台', material: '锂电、工程塑料', grade: '—', usage: '安装家具、打孔', tip: '家用选 12V 即可，扭矩 30N·m 左右够用。' },
    { id: 'tools-level', cat: 'tools', name: '激光水平仪', price: 259, unit: '台', material: '铝合金外壳', grade: '—', usage: '挂画、装层板', tip: '家用选两线绿光，精度 ±2mm/5m 足够。' },
    { id: 'tools-tape', cat: 'tools', name: '钢卷尺', price: 29, unit: '把（5m）', material: '碳钢尺带', grade: '—', usage: '量房、验收', tip: '量房至少两人配合，注意尺头松动误差。' },
    { id: 'tools-glue', cat: 'tools', name: '中性防霉玻璃胶', price: 39, unit: '支（300ml）', material: '硅酮密封胶', grade: '环保型', usage: '台面、卫浴收边', tip: '厨卫选防霉款，施工后 24 小时不要沾水。' }
  ];

  var floorplans = [
    { id: 'studio', name: '奶油一居室', size: 6, tagline: '6×6 开间，一个人住刚刚好', available: true },
    { id: 'twobed', name: '两居室', size: 7, tagline: '下一版解锁', available: false }
  ];

  function findItem(id) {
    for (var i = 0; i < items.length; i += 1) {
      if (items[i].id === id) return items[i];
    }
    return null;
  }

  function findMaterial(kind, id) {
    var list = kind === 'floor' ? floorStyles : (kind === 'wall' ? wallStyles : lightStyles);
    for (var i = 0; i < list.length; i += 1) {
      if (list[i].id === id) return list[i];
    }
    return list[0];
  }

  root.HomeDecorData = {
    floorStyles: floorStyles,
    wallStyles: wallStyles,
    lightStyles: lightStyles,
    items: items,
    floorplans: floorplans,
    marketCategories: marketCategories,
    marketItems: marketItems,
    findItem: findItem,
    findMaterial: findMaterial
  };
}(window));
