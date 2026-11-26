# 小学回忆杀

面向成年人的小学综合题回忆杀：先练习，再考试，通过升级考试一关一关解锁年级。界面采用明亮活泼的配色。

## 状态

- 已发布版本：`1.0.1`（`list` 显示已发布）
- 本地最新版本：`1.1.0`（舒缓背景纯音乐），尚未上传预览
- 本地内容：明亮配色、练习/升级考试、年级解锁、醒目个人中心、错题本、120 道标准题 + 48 道奥赛题、Web Audio 音效、F 大调音乐盒背景音乐
- appId：`6afef75c8eb436001501bdb1`
- 送审时间：2026-11-19
- 操作记录：`~/.local/state/redapp-cli/game-primary-quiz/2026-11-19-upload-preview-v5/session.json`
- 已送审 ZIP SHA-256：`f2961097b46aa5964dcff744b57e6c8e116b87f09ffa63843618172db619bce4`
- 本地 1.1.0 ZIP SHA-256：`6a753462625b6295b31c7e82b305bfbdb5c329124549a78f4078a118837f2781`（34,977 B，md5 `03eeb735819e67df4b84b69515af5fcc`）
- 1.0.1 已发布 ZIP SHA-256：`cf476f283def3b63d4b40a1b815303ee9f294728b4186e45aaf2ea920e730cab`
- 建议类目：学习知识（`learning_education`）
- 建议简介：看看你能达到几年级（9/14）
- 建议权限：`photos`（保存分享卡到相册）、`apiCloudStore`（用户头像和昵称）

## 玩法

### 默认：练习模式

- 科目：综合、语文、数学、英语、科学
- 年级：只能选择已解锁年级或更低年级
- 题库范围：`本级及以下`、`仅本年级`、`奥赛`
- 每组最多 10 题；题库不足时按实际题数
- 练习不改变年级，可反复换题练习
- 选择“本级及以下”时会混合低年级题目，练习量更大
- 选择“奥赛”时使用本级及以下的高难题，单科题库不足时按实际题数

### 升级考试

- 考试固定为当前已解锁年级
- 综合卷：语文、数学、英语、科学各 1 题，共 4 题
- 答对 3 题通过：解锁下一年级
- 未通过留在当前年级，先继续练习再考
- 六年级考试为“毕业考试”，通过后完成小学挑战

### 解锁规则

- 初始解锁：一年级
- 只有通过当前年级升级考试，才能解锁下一年级
- 练习不能选择高于已解锁年级的题库
- 新解锁的年级会立即出现在练习年级选择中

### 个人中心

首页顶部有带头像图标的“个人中心”横幅，右上角也有带图标的入口，可查看：

- 当前解锁年级和距离下一等级的进度
- 累计答题、练习答题、总正确率
- 练习组数
- 升级考试通过次数 / 总次数
- 错题本：年级、学科、答错次数、你的答案、正确答案、解析
- 答对同一题后会自动从错题本移除

### 声音

- 音效默认开启：选择、答对、答错、升级、完成
- 背景音乐默认开启：F 大调五声音阶的音乐盒旋律 + F–Dm–B♭–C 慢速和弦铺底，32 步约 13.4 秒循环，全部 Web Audio 合成，无音频文件、无歌词；离开页面自动暂停
- 背景音乐默认关闭，可在个人中心手动开启
- 全部使用 Web Audio 实时合成，不打包音频文件
- 首次播放需要用户点击页面；离开页面自动暂停背景音乐
- 音效和音乐开关保存在本地，跨会话保持
- 环境不支持 Web Audio 时静默降级，不影响答题

### 通用

- 每题四选一，答完显示正确答案和解析
- 完成后展示年级/得分、分题或分科结果、错题解析
- 生成 900×1200 分享卡，可保存、分享或发布成笔记
- 当前年级、答题进度、个人统计、错题本和完成结果自动保存

## 题库

- `data.js` 当前 168 题：120 道标准题 + 48 道奥赛题
- 标准题：6 个年级 × 4 个学科 × 5 题
- 奥赛题：6 个年级 × 4 个学科 × 2 题
- 练习模式：按科目、年级和范围抽题，每组最多 10 题
- 奥赛范围：使用本级及以下的奥赛题
- 升级考试：当前年级 4 科各 1 题，共 4 题，只使用标准题
- 每道题包含：题干、4 个选项、正确答案下标、解析、年级、学科
- 抽题由 seed 决定，可复现；点“再测一次”会换一套题

**内容说明：** 题库由 AI 起草并做结构校验，正式送审前建议人工抽查语文、英语和年级标注，避免歧义或超纲。

## 文件

```text
game-primary-quiz/
├── dist/
│   ├── index.html
│   ├── data.js         # 120 道题
│   ├── engine.js       # 抽题、晋级判定、年级文案
│   ├── app.js          # 答题、进度、结果卡、分享/笔记
│   └── style.css
├── publish/
│   ├── icon-512.png / icon-512.svg
│   └── cover-900x1200.png / cover-900x1200.svg
├── tests/
│   └── engine.test.js
├── game-primary-quiz.zip
└── README.md
```

## 数据

- Storage key：`primaryquiz.v1.state`
- 保存：seed、答题记录、当前阶段、最高年级、是否完成
- 不支持平台 Storage 时降级为本次会话内存

## 分享结果卡

- Canvas 2D 生成 900×1200 JPEG（quality 0.92）
- 内容：年级、模式结果、答对题数、年级阶梯或分科/分题结果、日期
- “保存分享卡”：`saveImageToPhotosAlbum`，客户端 9.42+
- “分享图片”：`share({ type: 'image', image_resource })`，客户端 9.53+，仅全屏容器
- “发布笔记”：`postNote`，使用结果卡和成绩文案打开笔记发布页
- 所有成功只表示流程已启动，不代表已保存、已分享或已发布
- `apiCloudStore` 已按用户要求加入送审权限；当前版本尚未接入排行榜/头像昵称调用，如审核询问需说明为后续能力预留

## 构建与校验

```bash
cd /home/wade/Workspace/red-tool

# 逻辑测试
node game-primary-quiz/tests/engine.test.js

# 语法
node --check game-primary-quiz/dist/data.js
node --check game-primary-quiz/dist/engine.js
node --check game-primary-quiz/dist/app.js

# 打包
python3 scripts/package.py game-primary-quiz/dist game-primary-quiz/game-primary-quiz.zip

# 审计
node "$HOME/.claude/skills/minitool-zip-builder/scripts/audit_artifact.mjs" game-primary-quiz/dist
node "$HOME/.claude/skills/minitool-zip-builder/scripts/audit_artifact.mjs" game-primary-quiz/game-primary-quiz.zip
python3 "$HOME/.claude/skills/minitool-zip-builder/scripts/audit_artifact.py" game-primary-quiz/game-primary-quiz.zip
```

## 验证范围

已通过题库结构测试、标准题/奥赛题分离、奥赛抽题、练习 6/10、一年级考试 3/4 升级、二年级考试 2/4 未通过、年级锁定、错题回顾、分享卡生成、已完成考试恢复、中途练习恢复、个人中心统计/错题本持久化、醒目入口，以及 Web Audio 音效和背景音乐开关测试。新版明亮配色、练习页、考试页、结果页、个人中心、首页横幅和奥赛范围已完成本地视觉检查。Headless 只能验证音频逻辑，实际声音需在创服平台模拟器、Android 真机和 iOS 真机试听；本次音效版也尚未发布。

## 实现说明

- `engine.js` 只负责题库抽取、每科 1 题、晋级阈值和年级文案，不接触 DOM。
- 题目选项和正确答案下标由构建脚本生成，正确答案分布在 A–D。
- 代码为 ES2017 以内，CSS 为 Chrome 61 基线；无网络、Worker、WASM、`localStorage` 或被禁 Web API。
- 兼容基线：Chrome 61 / Android 8.1，iOS 18.4+。
