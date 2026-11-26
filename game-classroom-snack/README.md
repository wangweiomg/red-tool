# 课堂偷吃大作战（2.5D 原型）

老师在黑板上写字时偷吃零食，转身前必须咽下去。固定第一人称课桌视角，Canvas 2D 绘制，规则驱动。

## 玩法

- 点「开始上课」，老师背对黑板写字，按住「吃」积累进度。
- 进度满一个吃掉一个零食，吃完还有约 0.9 秒咀嚼时间。
- 老师会随机转身：写字时间随零食数缩短，盯人时间变长。
- 老师转身完成时，如果正在吃、在咀嚼，或刚吃了一半，就会被抓；面向期间继续吃也会立刻被抓。
- 被抓扣一条命，三条命用完下课；吃满 10 个获胜。
- 结束后生成 900×1200 成绩卡，可保存 / 分享 / 发布笔记。

## 实现

- `engine.js`：老师写字 / 转身 / 面向状态机、偷吃进度、咀嚼延迟、被抓与胜负，纯逻辑可测试。
- `app.js`：Canvas 2D 教室场景（黑板、讲台、课桌、老师背影/正面转身）、HUD、按住吃、音效、成绩卡。
- 音效：粉笔声、转身提示、被抓、吃到、胜负，全部 Web Audio 合成。
- 最佳成绩保存在 `classroomsnack.v1.best`。

## 目录

```text
game-classroom-snack/
├── dist/
│   ├── index.html
│   ├── engine.js      # 状态机与判定
│   ├── app.js         # 场景、输入、音效、成绩卡
│   └── style.css
├── tests/engine.test.js
├── game-classroom-snack.zip
└── README.md
```

## 校验

```bash
node game-classroom-snack/tests/engine.test.js
node --check game-classroom-snack/dist/engine.js
node --check game-classroom-snack/dist/app.js
python3 scripts/package.py game-classroom-snack/dist game-classroom-snack/game-classroom-snack.zip
```

## 已知限制

- 2.5D 固定视角，不是可自由移动的 3D 教室。
- 只有一个教室、一个老师，没有难度选择和道具。
- 老师转身用缩放翻转近似，不是逐帧动画。
- 没有背景音乐；音效为合成提示音。
- 未上传平台，尚未在创服模拟器和真机验证。
