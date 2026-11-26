# 初中回忆杀

初中三年课程编成三册（七年级 / 八年级 / 九年级）：先练习，再考试，通过考试解锁下一册。题库覆盖语文、数学、英语、物理、化学、生物、历史、地理、道德与法治，共 110 题。

## 玩法

- **练习**：选择年级和科目，综合 10 题或单科 5 题；答完立即显示对错与解析。
- **考试**：当前年级综合卷 10 题，答对 8 题通过；通过后解锁下一册，九年级通过即完成初中挑战。
- 答错的题进入错题本，之后答对自动移除；统计、解锁进度和错题本保存在本机。
- 结算生成 900×1200 成绩卡，可保存 / 分享 / 发布笔记。

## 内容结构

| 年级 | 科目 | 题数 |
| --- | --- | --- |
| 七年级 | 语文、数学、英语、生物、历史、地理、道德与法治 | 35 |
| 八年级 | 语文、数学、英语、物理、生物、历史、地理、道德与法治 | 40 |
| 九年级 | 语文、数学、英语、物理、化学、历史、道德与法治 | 35 |

每科 5 题，每题 4 个选项，附一句解析。

## 实现

- `data.js`：题库（`window.JUNIOR_QUIZ_DATA`），字段 `id / grade / subject / prompt / options / answer / explanation`。
- `engine.js`：三册科目表、练习组卷（单科 5 题 / 综合 10 题）、考试组卷（按科目轮转抽 10 题）、判分与解锁常量，纯逻辑可测试。
- `app.js`：首页（练习/考试、年级/科目、三册目录）、答题、结算、个人中心（统计/错题本/声音）、成绩卡与分享、Web Audio 音效与背景音乐。
- 存储：`juniorquiz.v1.state`，保存解锁年级、毕业状态、统计、错题本和声音开关。

## 声音

- 音效：选答、答对、答错、考试通过、完成，Web Audio 合成。
- 背景音乐：D 大调音乐盒旋律 + D–Bm–G–A 和弦铺底，32 步约 12.8 秒循环，默认开启，切后台暂停。

## 目录

```text
game-junior-quiz/
├── dist/
│   ├── index.html
│   ├── data.js
│   ├── engine.js
│   ├── app.js
│   └── style.css
├── tests/engine.test.js
├── game-junior-quiz.zip
└── README.md
```

## 素材

- `publish/icon-512.png`：512×512 圆角透明图标（三册书 + 铅笔 + 对勾）。
- `publish/cover-900x1200.png`：900×1200 封面（三册书、110 题、练习+考试、成绩卡）。

## 版本

- 1.0.0：正式版。补齐图标与封面；语文古诗按册次归位（《望岳》七年级、《送杜少府》八年级）。
- 0.1.0：首个原型，已上传预览。

## 校验

```bash
node game-junior-quiz/tests/engine.test.js
node --check game-junior-quiz/dist/app.js
node --check game-junior-quiz/dist/engine.js
python3 scripts/package.py game-junior-quiz/dist game-junior-quiz/game-junior-quiz.zip
node "$HOME/.claude/skills/minitool-zip-builder/scripts/audit_artifact.mjs" game-junior-quiz/dist
python3 -I "$HOME/.claude/skills/minitool-zip-builder/scripts/audit_artifact.py" game-junior-quiz/game-junior-quiz.zip
```

## 已知限制

- 题库 110 题为人工整理，正式送审前建议逐题抽查答案与解析。
- 年级按主题分组，个别题目可能跨册，但不超出初中范围。
- 未做难度分层、每日一练、排行榜；未真实设备验证。
- 个人中心与错题本依赖 `window.xhs.miniTool` 存储，普通浏览器中不持久化。
