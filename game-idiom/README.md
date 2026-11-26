# 成语解谜

每日成语拼字挑战：根据释义，把 6 个字块拼成 4 字成语；每天 5 题，完成后生成可保存、分享或发布成笔记的结果卡。

## 状态

- 已发布版本：`1.0.0`（`status=2 已发布`，查询于 2026-11-20）
- 1.1.0：已送审，审核中（2026-11-20；新增音效与《月光》改编背景音乐）
- 本地内容：120 个成语 + 发布笔记功能 + 声音开关
- appId：`6afed7748c03b90015f9d33a`
- 送审时间：2026-11-19
- 操作记录：`~/.local/state/redapp-cli/game-idiom/2026-11-19-upload-preview-v2/session.json`
- 本地 1.1.0 ZIP SHA-256：`bac258f0c8c78eb7017a8374e32d7704c3c414e83637e96a3f5eb45b09d75a5f`
- 建议类目：学习知识（`learning_education`）
- 建议简介：每日一关，拼出成语（9/14）
- 建议权限：`photos`（保存结果卡到相册）、`apiCloudStore`（用户头像和昵称）
- 说明：`apiCloudStore` 按用户要求加入送审授权；当前版本尚未接入排行榜/头像昵称调用，如审核询问需说明为后续能力预留

## 玩法

- 每天 5 题，同一天所有用户看到相同题目
- 每题给出释义和 6 个字块，其中 4 个正确、2 个干扰
- 点击字块填入 4 个空格；再次点击可撤回
- 首次答对得 1 分，第二次答对得 0.5 分，两次未答对得 0 分
- 完成后显示得分、每题结果和连续挑战天数
- 自动生成 900×1200 结果卡，可保存到相册或调用平台分享
- 声音：选字、撤回、答对、答错、通关有音效；背景音乐是贝多芬《月光奏鸣曲》第一乐章三连音改编，Web Audio 合成；开关随进度保存

## 数据与规则

- Storage key：`idiom.v1.state`
- 保存：当天进度、每题结果、尝试次数、最近 60 天完成记录、`sound: { sfx, bgm }`
- 题库：`data.js`，当前 120 个常用成语；每天按日期确定性抽取 5 个
- 抽题按 24 天一个周期：周期开始整体洗牌，周期内每天取 5 个，**同一周期内不重复**
- 题目与字块顺序由日期 + 题号 + 成语哈希决定，可复现
- 不支持平台 Storage 时降级为本次会话内存

## 文件

```text
game-idiom/
├── dist/
│   ├── index.html
│   ├── data.js         # 题库
│   ├── engine.js       # 每日抽题、字块生成、计分、连续天数
│   ├── app.js          # 交互、存储、结果卡 Canvas、分享
│   └── style.css
├── publish/
│   ├── icon-512.png / icon-512.svg
│   └── cover-900x1200.png / cover-900x1200.svg
├── tests/
│   └── engine.test.js
├── game-idiom.zip
└── README.md
```

## 分享结果卡

- Canvas 2D 生成 900×1200 JPEG（quality 0.92）
- “保存分享卡”：`saveImageToPhotosAlbum({ filePath: dataUrl })`，客户端 9.42+
- “分享图片”：`share({ type: 'image', image_resource: dataUrl })`，客户端 9.53+，仅全屏容器
- “发布笔记”：`postNote({ title, content, pageType: 'photo_publish', mediaInfo: { image_resources: [{ url: dataUrl }] } })`
  - 标题“今日成语挑战 X/5”，正文包含得分、连续天数和玩法说明
  - 成功只表示发布页已打开并由用户操作，不代表笔记已发布或通过审核
- 分享成功只表示面板已启动或用户取消，不代表已送达
- 不支持或失败时降级提示保存图片 / 截图；不把图片上传到任何外部服务

## 构建与校验

```bash
cd /home/wade/Workspace/red-tool

# 逻辑测试
node game-idiom/tests/engine.test.js

# 语法
node --check game-idiom/dist/data.js
node --check game-idiom/dist/engine.js
node --check game-idiom/dist/app.js

# 打包
python3 scripts/package.py game-idiom/dist game-idiom/game-idiom.zip

# 审计
node "$HOME/.claude/skills/minitool-zip-builder/scripts/audit_artifact.mjs" game-idiom/dist
node "$HOME/.claude/skills/minitool-zip-builder/scripts/audit_artifact.mjs" game-idiom/game-idiom.zip
python3 "$HOME/.claude/skills/minitool-zip-builder/scripts/audit_artifact.py" game-idiom/game-idiom.zip
```

## 实现说明

- `engine.js` 不接触 DOM，负责确定性抽题、字块生成、计分和连续天数。
- 结果卡只用 Canvas 2D 和系统字体，不依赖图片素材。
- 代码为 ES2017 以内，CSS 为 Chrome 61 基线；无网络、Worker、WASM、`localStorage` 或被禁 Web API。
- 兼容基线：Chrome 61 / Android 8.1，iOS 18.4+。

## 验证范围

已通过引擎单元测试、Headless Chrome 的完整 5 题作答、错误重试、0 分路径、存档恢复、每日切换和分享卡保存/分享冒烟测试。尚未在创服平台模拟器、Android 真机和 iOS 真机验证，也未上传发布。
