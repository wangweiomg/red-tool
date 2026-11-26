# 高中回忆杀

高中三年课程编成三册（高一 / 高二 / 高三）：先练习，再考试，通过考试解锁下一册；高三考试即高考。题库覆盖语文、数学、英语、物理、化学、生物、历史、地理、政治，共 162 题。

## 玩法

- **练习**：选择年级和科目，综合 12 题或单科 6 题；答完立即显示对错与解析。
- **考试**：高一、高二综合卷 12 题，答对 10 题通过；**高三为高考，综合卷 15 题，答对 12 题通关**。
- 通过高一考试解锁高二，通过高二解锁高三；高考通关即高中毕业。
- 答错的题进入错题本，之后答对自动移除；统计、解锁进度和错题本保存在本机。
- 结算生成 900×1200 成绩卡，可保存 / 分享 / 发布笔记。

## 内容结构

| 年级 | 科目 | 题数 |
| --- | --- | --- |
| 高一 | 语文、数学、英语、物理、化学、生物、历史、地理、政治 | 54 |
| 高二 | 同上九科 | 54 |
| 高三 | 同上九科 | 54 |

每科 6 题（4 道基础 + 2 道进阶），每题 4 个选项，附一句解析。进阶题标记 `difficulty: 2`，练习按约 40% 比例抽取进阶题，考试优先抽进阶题。

## 高考

- 高三「考试」标签写的是「高考」，按钮为「参加高考」。
- 高考卷 15 题，从高三九科中按科目轮转抽题；答对 12 题通关，结算显示「高考结果 / 高考通关，高中毕业」。
- 成绩卡在高考通过时显示「高考通过」角标。

## 实现

- `data.js`：题库（`window.HIGH_QUIZ_DATA`），字段 `id / grade / subject / difficulty / prompt / options / answer / explanation`；基础题省略 `difficulty`，进阶题为 `2`。
- `engine.js`：三册科目表、练习组卷（单科 6 题 / 综合 12 题，进阶题约占 40%）、考试与高考组卷（12 题 / 15 题，优先进阶题）、通过线与解锁常量，纯逻辑可测试。
- `app.js`：首页（练习/考试、年级/科目、三册目录）、答题、结算、个人中心（统计/错题本/声音）、成绩卡与分享、Web Audio 音效与背景音乐。
- 存储：`highquiz.v1.state`，保存解锁年级、毕业状态、统计、错题本和声音开关。

## 声音

- 音效：选答、答对、答错、考试通过、完成，Web Audio 合成。
- 背景音乐：A 大调音乐盒旋律 + A–F#m–D–E 和弦铺底，32 步约 12.8 秒循环，默认开启，切后台暂停。

## 目录

```text
game-high-quiz/
├── dist/
│   ├── index.html
│   ├── data.js
│   ├── engine.js
│   ├── app.js
│   └── style.css
├── publish/
│   ├── icon-512.png
│   ├── icon-512.svg
│   ├── cover-900x1200.png
│   └── cover-900x1200.svg
├── tests/engine.test.js
├── game-high-quiz.zip
└── README.md
```

## 素材

- 图标：`publish/icon-512.png`（512×512，PNG，约 28 KB）——三本书 + 学士帽 + 金色星标
- 封面：`publish/cover-900x1200.png`（900×1200，PNG，严格 3:4，约 197 KB）——三册课本（高一 / 高二 / 高三）、高三课本上的学士帽与铅笔
- SVG 源文件与 PNG 同目录，修改后用 `rsvg-convert` 重新渲染；`publish/` 不进入 ZIP

## 校验

```bash
node game-high-quiz/tests/engine.test.js
node --check game-high-quiz/dist/app.js
node --check game-high-quiz/dist/engine.js
python3 scripts/package.py game-high-quiz/dist game-high-quiz/game-high-quiz.zip
node "$HOME/.claude/skills/minitool-zip-builder/scripts/audit_artifact.mjs" game-high-quiz/dist
python3 -I "$HOME/.claude/skills/minitool-zip-builder/scripts/audit_artifact.py" game-high-quiz/game-high-quiz.zip
```

## 已知限制

- 题库 162 题为人工整理，新增 54 道进阶题；正式送审前建议逐题抽查答案与解析。
- 年级按主题分组，个别题目可能跨册，但不超出高中范围。
- 未做难度分层、每日一练、排行榜；尚未上传、未真机验证。
- 个人中心与错题本依赖 `window.xhs.miniTool` 存储，普通浏览器中不持久化。
