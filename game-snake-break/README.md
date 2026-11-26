# 课间十分钟 · 贪吃蛇

把贪吃蛇放进课间十分钟：下课铃响前，在课桌上吃零食。滑动或点方向键转向，撞墙或撞到自己会被老师发现；60 秒铃响按得分结算。

## 玩法

- 点「开始课间」，1.2 秒准备后蛇开始移动。
- 辣条 +1 分，饼干 +2 分，水果糖 +1 分并补 2 秒。
- 吃零食会变长，速度从 165ms/格逐渐加快到 95ms/格。
- 撞墙或撞到自己立即结束；60 秒下课铃响也会结束。
- 结算显示本局零食数、得分、最佳与已玩局数，并生成 900×1200 成绩卡，可保存 / 分享 / 发布笔记。

## 操作

- 画面上滑动转向（阈值 16px）。
- 下方四向键转向。
- 桌面端可用方向键 / WASD。
- 不能 180° 直接掉头；转向请求最多缓存两次，避免快速连按丢失。

## 实现

- `engine.js`：网格移动、转向队列、食物生成（避开蛇身）、零食效果、撞墙/撞自己/下课铃判定，纯逻辑可测试。
- `app.js`：Canvas 2D 课桌场景、零食绘制、输入、Web Audio 音效、最高分与音效开关存储。
- 存储：`snakebreak.v1.best`（`{ v, best, plays, sound }`）。
- 成绩卡：Canvas 900×1200，课桌面板 + 零食蛇 + 分数 + 新纪录角标；保存、分享、发布笔记均做能力检测和失败降级。
- 音效：吃到（按零食类型升调）、被抓、下课铃、开始，全部 Web Audio 合成，无音频文件；默认开启。
- 背景音乐：G 大调五声音阶的音乐盒旋律 + G–Em–C–D 慢速和弦铺底，32 步约 12.2 秒循环，全部 Web Audio 合成；默认开启，切后台自动暂停，开关与最高分一起保存。
- 画布：360×468（20×26 格，每格 18px），按设备 DPR 放大，30 FPS 目标。

## 目录

```text
game-snake-break/
├── dist/
│   ├── index.html
│   ├── engine.js
│   ├── app.js
│   └── style.css
├── tests/engine.test.js
├── game-snake-break.zip
└── README.md
```

## 素材

- `publish/icon-512.png`：512×512 圆角图标，透明四角。
- `publish/cover-900x1200.png`：900×1200 封面，标题 + 课桌零食蛇 + 玩法标签。

## 版本

- 1.0.0：正式版。加入成绩卡与保存 / 分享 / 发布笔记、"课间小游戏"标识，完善结算与音效/音乐开关。
- 0.1.0：可玩原型（含背景音乐）。

## 校验

```bash
node game-snake-break/tests/engine.test.js
node --check game-snake-break/dist/engine.js
node --check game-snake-break/dist/app.js
python3 scripts/package.py game-snake-break/dist game-snake-break/game-snake-break.zip
node "$HOME/.claude/skills/minitool-zip-builder/scripts/audit_artifact.mjs" game-snake-break/dist
python3 -I "$HOME/.claude/skills/minitool-zip-builder/scripts/audit_artifact.py" game-snake-break/game-snake-break.zip
```

## 已知限制

- 未在创服模拟器与真机验证，滑动阈值和速度曲线需要真机手感反馈。
- 送审前需补充类目、权限（`photos`）与版本号。
- 暂无难度选择、皮肤、每日挑战或排行榜。
