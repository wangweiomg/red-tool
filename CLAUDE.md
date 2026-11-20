# CLAUDE.md

本仓库是小红书小工具工作区。每个小工具对应一个独立目录，产物是可上传到创服平台的离线 ZIP。所有小工具均为纯前端 H5，运行在受限容器中。

## 必须使用的 Skill

- 开发 / 修改 / 校验 / 打包任何小工具：先调用 `minitool-zip-builder`。
- 上传、预览、送审、编辑、查询小工具：先调用 `redapp-cli`。
- 每个任务开始时读取对应 `SKILL.md` 和引用文档；平台能力的最终契约以[小工具在线文档](https://miniapp-sandbox.xiaohongshu.com/minitool/doc)为准。

Skill 目录：

```text
~/.claude/skills/minitool-zip-builder/
~/.claude/skills/redapp-cli/
```

## 目录规则

```text
red-tool/
├── README.md
├── CLAUDE.md
├── scripts/package.py
├── time-health-index/
│   ├── dist/
│   ├── publish/
│   ├── time-health-index.zip
│   └── README.md
├── game-2048/
│   ├── dist/
│   ├── publish/
│   ├── tests/
│   ├── game-2048.zip
│   └── README.md
├── game-huarongdao/
│   ├── dist/
│   ├── publish/
│   ├── tests/
│   ├── game-huarongdao.zip
│   └── README.md
├── game-idiom/
│   ├── dist/
│   ├── publish/
│   ├── tests/
│   ├── game-idiom.zip
│   └── README.md
├── game-primary-quiz/
    ├── dist/
    ├── publish/
    ├── tests/
    ├── game-primary-quiz.zip
    └── README.md
├── game-christmas-tree/
    ├── dist/
    ├── publish/
    ├── tests/
    ├── game-christmas-tree.zip
    └── README.md
└── english-shadowing/
    ├── dist/
    ├── publish/
    ├── tests/
    ├── english-shadowing.zip
    └── README.md
```

- **一个小工具一个目录、一个 ZIP**；不要把两个工具的 `dist` 或 ZIP 混在一起。
- `dist/` 只放要上传的文件；README、`publish/`、`tests/`、构建脚本不得进入 ZIP。
- ZIP 根目录必须直接包含 `index.html`；打包的是 `dist` 的“内容”，不是 `dist` 目录本身。
- 新工具建议新建目录（如 `next-tool/dist`、`next-tool/publish`），不要复用已送审工具的 appId。

## 小工具开发约束

- 入口：唯一 `index.html`，位于 ZIP 根目录。
- 脚本：经典外置 `<script src>`，禁止内联脚本、行内事件、`type="module"`、`eval`、`new Function`。
- 兼容：JS 为 ES2017 / Chrome 61；CSS 为 Chrome 61 基线，现代 CSS 必须有回退。iOS 最低 18.4。
- 离线：禁止 `fetch` / XHR / WebSocket / 外域图片字体脚本；所有资源打进 ZIP。
- 禁止：iframe、object、WebAssembly、`window.open`、剪贴板、Web 地理定位、后台任务、支付。
- 存储：只用 `window.xhs.miniTool` 的 Storage / 文件系统 API；不要用 `localStorage`、`indexedDB`、Cookie。
- 手势：使用 pointer / touch 事件；不要依赖 `:hover` 完成关键操作。
- 性能：目标 30 FPS；动画优先 `transform` / `opacity`；ZIP 建议 ≤2 MiB，硬上限 10 MiB。
- 平台能力先做方法存在性检测；不支持时隐藏入口或降级，不伪造成功。

## 构建与校验

```bash
# 单元测试
node game-2048/tests/engine.test.js
node game-huarongdao/tests/engine.test.js
node game-idiom/tests/engine.test.js
node game-primary-quiz/tests/engine.test.js

# 语法
node --check game-2048/dist/engine.js
node --check game-2048/dist/app.js

# 打包
python3 scripts/package.py game-2048/dist game-2048/game-2048.zip

# 审计
node "$HOME/.claude/skills/minitool-zip-builder/scripts/audit_artifact.mjs" game-2048/dist
node "$HOME/.claude/skills/minitool-zip-builder/scripts/audit_artifact.mjs" game-2048/game-2048.zip
python3 "$HOME/.claude/skills/minitool-zip-builder/scripts/audit_artifact.py" game-2048/game-2048.zip
```

打包前必须：

1. 确认 `dist/index.html` 存在且没有多套一层目录。
2. 扫描 `fetch`、XHR、WebSocket、`eval`、`innerHTML` 拼接外部内容、内联脚本、外链资源。
3. 确认被禁 API 无调用 / 残留。
4. 运行审计脚本并修复全部 error；warning 需说明。
5. 检查 ZIP 内容清单与相对路径引用。

Headless Chrome 测试只用于发现运行时错误和布局问题，**不能作为平台验收依据**。最终必须提醒用户在创服平台模拟器、Android 真机和 iOS 真机验证。

## 平台 CLI

```bash
export npm_config_prefix="$HOME/.local/share/redapp-cli-npm"
export npm_config_cache="$HOME/.cache/redapp-cli-npm"
export PATH="$npm_config_prefix/bin:$PATH"
node "$HOME/.claude/skills/redapp-cli/scripts/ensure-cli.mjs"
```

- 环境：`prod`
- 三方来源：`thirdAgent`
- 每条业务命令都带 `--agent`
- 版本门禁状态必须为 `current` / `installed` / `updated`
- 查询、预览、送审、编辑需要 `--source thirdAgent`；`upload` 不接受 `--source`

## 发布授权与门禁

- 上传、预览、送审、编辑都是业务写操作，**必须获得用户当次明确授权**。安装 Skill、查询状态、开发打包不包含这些授权。
- 上传：先 `--dry-run`，核对 `plan`（账号、环境、网关、文件哈希）后用 `planHash --confirm`。
- 预览：先 `--dry-run`，再 `--confirm --qr-out <新文件名>`（不能覆盖已有文件）。展示二维码和 `previewUrl`。
- 送审：必须让用户扫码并明确回复“预览通过”；只回复“已扫码”不算。代码包、图标、名称、版本、账号、环境或来源变化后，原确认失效，需要重新预览。
- 送审成功只代表 `submitted`（审核中），不代表发布。
- 不虚构删除、下架、下载源码等能力，不绕过鉴权。

## 当前状态

### 时间健康指数

- 目录：`time-health-index/`
- appId：`6afe917a3894b300155e85e7`
- 版本：`1.0.0`
- 状态：已送审，审核中（截至 2026-11-19）
- 已送审 ZIP SHA-256：`d1f271e1c61f23df2e3e82eea13f4fb16f815c6a0231dcff2a1d7703950c89eb`
- 更新必须使用同一 appId + 新版本号，并重新预览、送审。

### 2048

- 目录：`game-2048/`
- appId：`6afeb70053ca3e00159ba0a2`
- 已发布版本：`1.0.0`（`status=2 已发布`，查询于 2026-11-20）
- 1.1.0 状态：已送审，审核中（截至 2026-11-20）
- 注意：`status` 接口仍返回 1.0.0 已发布（缓存滞后），版本以 `list` 为准
- 声音：音效默认开（滑动、合并升调、胜利、结束），背景音乐默认关；开关随游戏进度保存在 `game2048.v1.state` 的 `sound` 字段
- 1.1.0 已上传代码包 fileId：`red_app/yq3aCbR5srqrd7ZNpQdvFDsuXprzjKLIg11q9XshM39O1FU.zip`
- 本地 ZIP SHA-256（1.1.0）：`41de65c6fe14cf550855e2507b74915a32fcdf0865c52a5de3e1391064c3777b`（11,458 B）
- 1.1.0 操作记录：`~/.local/state/redapp-cli/game-2048/2026-11-20-audio-preview/session.json`
- 类目：`casual_game`
- 操作记录：`~/.local/state/redapp-cli/game-2048/2026-11-19-upload-preview/session.json`
- 已送审代码包 fileId：`red_app/2X-hPdnZhwIw7cZNdLYqLq07zXUq-0WH0uU-Wa7GdPjwrlI.zip`
- 更新时必须使用同一 appId + 新版本号，并重新预览、送审。

### 华容道

- 目录：`game-huarongdao/`
- appId：`6afeb9b33894b300155e8782`
- 已发布版本：`1.0.0`（`status=2 已发布`，查询于 2026-11-20）
- 本地版本：`1.1.0`（新增音效与《卡农》改编背景音乐，尚未上传预览）
- 类目：`casual_game`
- 布局：经典「横刀立马」
- 操作记录：`~/.local/state/redapp-cli/game-huarongdao/2026-11-19-upload-preview/session.json`
- 已送审代码包 fileId（1.0.0）：`red_app/svRtBqjVCU4G5NeOstK_qQUxYyDSpRcxbid97K0ql5ZOJy0.zip`
- 声音：音效默认开（选中、移动、撞墙、通关），背景音乐默认关（帕赫贝尔《卡农》D 大调和弦进行改编，Web Audio 合成）；开关保存在 `huarongdao.v1.state` 的 `sound` 字段
- 本地 ZIP SHA-256（1.1.0）：`5ebc2c3da16208477916ec8fc67e9342f9cd5b506315763c3e525610489aa8ad`（12,025 B）
- 更新时必须使用同一 appId + 新版本号，并重新预览、送审。

### 成语解谜

- 目录：`game-idiom/`
- 版本：`1.0.0`（待发布）
- 本地内容：120 个成语、24 天周期内不重复、结果卡保存/分享、`postNote` 发布笔记
- appId：`6afed7748c03b90015f9d33a`
- 版本：`1.0.0`
- 状态：已送审，审核中（截至 2026-11-19）
- 类目：`learning_education`
- 权限：`photos`、`apiCloudStore`
- 当前 ZIP SHA-256：`e208e906b0e525cd8c061e7cb46bd5dea161c96a683628afa5f48ec555296e89`
- 操作记录：`~/.local/state/redapp-cli/game-idiom/2026-11-19-upload-preview-v2/session.json`
- 已送审代码包 fileId：`red_app/uIqfbEGEgQuzMqmP_lQHsDXQ3cuj4iTf318c2kSK-R9QlcQ.zip`
- 更新时必须使用同一 appId + 新版本号，并重新预览、送审
- 结果卡使用 `saveImageToPhotosAlbum`（9.42+）、`share`（9.53+，仅全屏）和 `postNote`
- `apiCloudStore` 当前未接入排行榜/头像昵称调用，若审核询问需说明为后续能力预留

### 小学回忆杀

- 目录：`game-primary-quiz/`
- 已送审版本：`1.0.0`，审核中（截至 2026-11-19）
- 本地最新：`1.0.0 + Web Audio 音效/背景音乐`，尚未发布；发布时必须使用新版本号（建议 `1.0.1`）
- 1.0.1 已于 2026-11-19 送审：先在平台网页端撤回审核中的 1.0.0，再提交 1.0.1 成功（`status=1` 审核中）
- 1.0.1 已送审代码包 fileId `red_app/93I7BhxihdZUWVhSkg-s3Fy1iprzlisM-J63fEFQxiAvxbc.zip`（md5 `9dd9a796b1abe2e97b50010386f46afa`），ZIP SHA-256 `cf476f283def3b63d4b40a1b815303ee9f294728b4186e45aaf2ea920e730cab`
- 提交记录：`~/.local/state/redapp-cli/game-primary-quiz/2026-11-19-upload-preview-v6/session.json`
- 注意：`status` 接口在提交后仍返回 `1.0.0`（缓存滞后），以 `list` 的版本字段为准；`history` 对该 appId 报 `小工具不存在`
- 本地内容：明亮配色、默认练习模式、升级考试、年级解锁、醒目个人中心、错题本、120 标准题 + 48 奥赛题、Web Audio 音效
- appId：`6afef75c8eb436001501bdb1`
- 建议类目：`learning_education`
- 建议权限：`photos`（保存结果卡到相册）、`apiCloudStore`（用户头像和昵称）
- 玩法：初始解锁一年级；练习可选科目、已解锁年级和题库范围；考试为当前年级综合卷 4 题，答对 3 题解锁下一年级；六年级为毕业考试
- 练习每组最多 10 题，不能选择高于已解锁年级的题库
- 个人中心：首页横幅 + 右上角图标入口；累计答题、练习答题、正确率、练习组数、考试通过/次数、错题本；错题答对后自动移除
- 题库当前 168 题（120 标准 + 48 奥赛），正式送审前建议人工抽查答案、解析和年级标注
- 已送审 ZIP SHA-256：`f2961097b46aa5964dcff744b57e6c8e116b87f09ffa63843618172db619bce4`
- 本地音效版 ZIP SHA-256：`cf476f283def3b63d4b40a1b815303ee9f294728b4186e45aaf2ea920e730cab`
- 操作记录：`~/.local/state/redapp-cli/game-primary-quiz/2026-11-19-upload-preview-v5/session.json`
- CLI 当前 1.0.6
- 分享卡 / `share` / `postNote` 与成语解谜一致，必须做能力检测和失败降级
- `apiCloudStore` 当前未接入排行榜/头像昵称调用，若审核询问需说明为后续能力预留

### 圣诞装饰树

- 目录：`game-christmas-tree/`
- appId：`6aff0bb7261c1b0015ec094e`
- 版本：`1.0.0`
- 状态：已送审，审核中（截至 2026-11-19）
- 类目：`casual_game`
- 权限：`photos`（保存明信片到相册）
- 玩法：3 个主题订单（雪夜蓝调 / 姜饼暖棕 / 莓果红绿）+ 自由装饰；拖拽或点选放置挂饰，点树上挂饰取下；撤销 / 清空
- 评分：主题完成度 55%、左右平衡 15%、丰富度 18%、树顶星 12%；自由模式看平衡、丰富度、星星、种类
- 结果：900×1200 Canvas 明信片，支持保存相册 / 分享图片 / 发布笔记，均做能力检测
- 存储：`christmastree.v1`，保存战绩、音效开关与未完成草稿（返回首页或重开可继续）
- 音效：Web Audio 程序化合成，默认开启，可切换；无背景音乐
- 已送审 ZIP SHA-256：`7addc132bb924094dfae7271671043ffa94e989776275e496c7183f9c32bc1fb`（24,050 B）
- 已送审代码包 fileId：`red_app/DvqbSyLxmh8D57yAntkoJT562mXqqTHXEciIQlKvk13rCYU.zip`
- 图标 fileId：`red_skill_tool_image/KB_txyhpEMMbZfgcLDQgI1g0kOdPhqvBq0s-qUxYrevmWnI.png`
- 封面 fileId：`red_skill_tool_image/M53mMAVlZPzbhZvoVKEz7_VcQAthmbJMAfspbtULPr04-Kc.png`
- 操作记录：`~/.local/state/redapp-cli/game-christmas-tree/2026-11-19-upload-preview/session.json`
- 单元测试：`node game-christmas-tree/tests/engine.test.js`
- 更新时必须使用同一 appId + 新版本号，并重新预览、送审

### 英语跟读实验室

- 目录：`english-shadowing/`
- appId：`6aff19d6261c1b0015ec09ec`
- 版本：`1.0.0`
- 状态：已送审，审核中（截至 2026-11-19）
- 类目：`learning_education`
- 权限：`microphone`
- 模式：顶部「场景对话 / 背单词」两种；场景对话内可切换场景
- 内容：海关、酒店入住各 8 句（含问与答，角色标签 + IPA + 发音提示 + 中文）；12 个旅行高频词
- 示范朗读：设备系统语音 `speechSynthesis`；无英文音色时提示只做录音对比
- 录音：`getUserMedia` + `MediaRecorder`，Web Audio 解码回放；每次录音独立会话并先释放麦克风；`navigator.audioSession.type = 'play-and-record'` 修复 iOS 播放后录音失败；解码/回放失败重建 AudioContext 重试
- 统计：容器 Storage `shadowing.v1.stats`，记录今日/累计练习次数（仅次数，不存音频）
- 隐私：录音只在内存处理，不上传、不保存
- 建议类目：`learning_education`；权限：`microphone`
- 已知限制：无语音识别，不做发音准确度打分；示范朗读依赖设备系统音色
- 单元测试：`node english-shadowing/tests/data.test.js`
- 构建：`python3 scripts/package.py english-shadowing/dist english-shadowing/english-shadowing.zip`
- 图标：`publish/icon-512.png`；封面：`publish/cover-900x1200.png`
- 1.0.0 已上传代码包 fileId：`red_app/ztdJ_s_1Jr3fS_KHZBLSXnuYrz2Nu8b_L8nCq_tdtyiTFJ4.zip`
- 1.0.0 封面 fileId：`red_skill_tool_image/VpnR7rW_GT1ls4Z-6LSmNvR-2y69L5oTiYwA2VuRGu2q70c.png`
- 图标 fileId：`red_skill_tool_image/vtlKL-kpVcc47fausVtFbTMnL5OvRcLMOKKG7VY-Jhnyxtc.png`
- 已送审 ZIP SHA-256：`240afd395aedc14cb6ed4972aa1d152488ed0311d6198c93e316781c0bde9777`（15,879 B）
- 历史验证版 0.1.x 的 fileId 与修复记录保留在 `~/.local/state/redapp-cli/english-shadowing/2026-11-19-upload/session.json`
- 更新时必须使用同一 appId + 新版本号，并重新预览、送审

## 操作记录

多步上传 / 预览 / 送审记录保存于：

```text
~/.local/state/redapp-cli/<tool>/<task>/session.json
```

记录中不保存 token、Cookie、登录授权链接或完整凭证。

## 文档维护

- 新增工具：创建目录和 `README.md`，更新根 `README.md` 的工具列表与本文件的“当前状态”。
- 修改结构、脚本或发布状态后，同步更新对应 README。
- 不要将 `README.md`、`CLAUDE.md`、`publish/`、`tests/` 打进小工具 ZIP。
