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
├── english-shadowing/
    ├── dist/
    ├── publish/
    ├── tests/
    ├── english-shadowing.zip
    └── README.md
├── home-decor/
    ├── dist/
    ├── publish/
    ├── tests/
    ├── home-decor.zip
    └── README.md
├── renovation-guide/
    ├── dist/
    ├── publish/
    ├── tests/
    ├── renovation-guide.zip
    ├── CONTENT-OUTLINE.md
    └── README.md
├── photo-studio/
    ├── dist/
    ├── publish/
    ├── tests/
    ├── photo-studio.zip
    └── README.md
├── game-classroom-snack/
    ├── dist/
    ├── publish/
    ├── tests/
    ├── game-classroom-snack.zip
    └── README.md
├── game-classroom-3d/
    ├── dist/
    │   └── vendor/three.min.js
    ├── publish/
    ├── tests/
    ├── game-classroom-3d.zip
    └── README.md
├── game-snake-break/
    ├── dist/
    ├── publish/
    ├── tests/
    ├── game-snake-break.zip
    └── README.md
├── game-junior-quiz/
    ├── dist/
    ├── publish/
    ├── tests/
    ├── game-junior-quiz.zip
    └── README.md
├── game-high-quiz/
│   ├── dist/
│   ├── publish/
│   ├── tests/
│   ├── game-high-quiz.zip
│   └── README.md
├── history-chronicle/
│   ├── dist/
│   ├── publish/
│   ├── tests/
│   ├── history-chronicle.zip
│   └── README.md
├── west-myth-history/
│   ├── dist/
│   ├── publish/
│   ├── tests/
│   ├── west-myth-history.zip
│   └── README.md
├── life-common-sense/
│   ├── dist/
│   ├── publish/
│   ├── tests/
│   ├── life-common-sense.zip
│   └── README.md
└── city-hiking-guide/
    ├── dist/
    ├── publish/
    ├── tests/
    ├── city-hiking-guide.zip
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
node history-chronicle/tests/engine.test.js
node west-myth-history/tests/engine.test.js
node life-common-sense/tests/engine.test.js
node city-hiking-guide/tests/engine.test.js

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
- 1.1.0 状态：已上传并生成预览，未送审（2026-11-20）
- 类目：`casual_game`
- 布局：经典「横刀立马」
- 操作记录：`~/.local/state/redapp-cli/game-huarongdao/2026-11-19-upload-preview/session.json`
- 已送审代码包 fileId（1.0.0）：`red_app/svRtBqjVCU4G5NeOstK_qQUxYyDSpRcxbid97K0ql5ZOJy0.zip`
- 声音：音效默认开（选中、移动、撞墙、通关），背景音乐默认关（帕赫贝尔《卡农》D 大调和弦进行改编，Web Audio 合成）；开关保存在 `huarongdao.v1.state` 的 `sound` 字段
- 1.1.0 已上传代码包 fileId：`red_app/oa5tjyyL_VhVyzkwxpuZuXGX0fFRRmvhJZ3cfne3i5iFh84.zip`
- 本地 ZIP SHA-256（1.1.0）：`5ebc2c3da16208477916ec8fc67e9342f9cd5b506315763c3e525610489aa8ad`（12,025 B）
- 1.1.0 操作记录：`~/.local/state/redapp-cli/game-huarongdao/2026-11-20-audio-preview/session.json`
- 更新时必须使用同一 appId + 新版本号，并重新预览、送审。

### 成语解谜

- 目录：`game-idiom/`
- 已发布版本：`1.0.0`（`status=2 已发布`，查询于 2026-11-20）
- 版本：`1.1.0`（已送审，审核中，截至 2026-11-20）
- 本地内容：120 个成语、24 天周期内不重复、结果卡保存/分享、`postNote` 发布笔记
- appId：`6afed7748c03b90015f9d33a`
- 声音：音效默认开（选字、撤回、答对、答错、通关），背景音乐默认关（贝多芬《月光》第一乐章三连音改编，Web Audio 合成）；开关保存在 `idiom.v1.state` 的 `sound` 字段
- 类目：`learning_education`
- 权限：`photos`、`apiCloudStore`
- 1.1.0 已上传代码包 fileId：`red_app/oXfn4Zen1gm8RXgQztmqWjGNTXF1kaQqAQBKMcvHh7yQJB4.zip`
- 本地 ZIP SHA-256（1.1.0）：`bac258f0c8c78eb7017a8374e32d7704c3c414e83637e96a3f5eb45b09d75a5f`（21,336 B）
- 1.1.0 操作记录：`~/.local/state/redapp-cli/game-idiom/2026-11-20-audio-preview/session.json`
- 操作记录：`~/.local/state/redapp-cli/game-idiom/2026-11-19-upload-preview-v2/session.json`
- 已送审代码包 fileId：`red_app/uIqfbEGEgQuzMqmP_lQHsDXQ3cuj4iTf318c2kSK-R9QlcQ.zip`
- 更新时必须使用同一 appId + 新版本号，并重新预览、送审
- 结果卡使用 `saveImageToPhotosAlbum`（9.42+）、`share`（9.53+，仅全屏）和 `postNote`
- `apiCloudStore` 当前未接入排行榜/头像昵称调用，若审核询问需说明为后续能力预留

### 小学回忆杀

- 目录：`game-primary-quiz/`
- 已发布版本：`1.0.1`（`list` 显示已发布）
- 本地最新：`1.1.0`（舒缓背景纯音乐），已送审，审核中（截至 2026-11-21）
- 1.1.0 预览 appId：`6b00fb8453ca3e00150c0905`；预览二维码：`~/.local/state/redapp-cli/game-primary-quiz/2026-11-21-bgm-preview/preview-qr-20261121-1.png`（用户已回复“预览通过，送审”）
- 1.1.0 已送审代码包 fileId：`red_app/A7Ri7NB9rZEHrd4NhmTeBrPV44TDFEwXWyThR9kASdil2vo.zip`
- 1.1.0 图标 fileId：`red_skill_tool_image/lnR2mI2Cx8v2Z8zT_yEA5CCTX0TlCI9GRkFbUeb7Vl8mLI0.png`；封面 fileId：`red_skill_tool_image/9gB2q3fjufWPSMp7z7s38AskAMxnT28ee93bRIjl8ybQNBk.png`
- 1.1.0 操作记录：`~/.local/state/redapp-cli/game-primary-quiz/2026-11-21-bgm-preview/session.json`
- 1.1.0 改动：背景音乐替换为 F 大调五声音阶音乐盒旋律 + F–Dm–B♭–C 慢速和弦，32 步约 13.4 秒循环，全部 Web Audio 合成；默认开启（已有用户保存的开关状态保持不变）
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
- 本地 1.1.0 ZIP SHA-256：`6a753462625b6295b31c7e82b305bfbdb5c329124549a78f4078a118837f2781`（34,977 B，md5 `03eeb735819e67df4b84b69515af5fcc`）
- 1.0.1 已发布 ZIP SHA-256：`cf476f283def3b63d4b40a1b815303ee9f294728b4186e45aaf2ea920e730cab`
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

### 装修实验室（2.5D 原型）

- 目录：`home-decor/`
- 版本：`0.1.5`（已上传并生成预览，未送审）
- 0.1.2 修复：选中家具后可点地面放置；新增 canvas pointerup、选中文案、空位高亮和「放到空位」按钮
- 0.1.0 已上传并生成预览（2026-11-20）
- 0.1.5 已上传代码包 fileId：`red_app/Uesmwkv-x2tqTzieWVmVJqBam4e5OvvnlKI-6itAw3lvAws.zip`
- 0.1.4 已上传代码包 fileId：`red_app/EzLswZ8_SZ7ehtMTZntlQDm2MgGaxCKZcOrpuPVT9plecWo.zip`
- 0.1.2 已上传代码包 fileId：`red_app/WBkCxt1wtMdmW-TtF6x_tLhskJOpBCRZVOm8F4En0rIy8As.zip`
- 0.1.0 已上传代码包 fileId：`red_app/lepCgjuJv5noTekU2CDXnEE8pvF33PdUUa5DJ31YRMtD13Y.zip`
- 图标 fileId：`red_skill_tool_image/LtsXReOugaZveKrI_rF1Q-EJ-HYfSBU1o3QuzjK5ELJ_Wyk.png`
- 封面 fileId：`red_skill_tool_image/S0G8ipA8ipEUXUuOJn-fvBmfFqWZAsCfvxq4yZdlFKjpb9o.png`
- 操作记录：`~/.local/state/redapp-cli/home-decor/2026-11-20-prototype-preview/session.json`
- 玩法：选户型 → 硬装（地板/墙面/灯光）→ 软装（12 件家具/挂饰）→ 完成生成 900×1200 明信片
- 渲染：Canvas 2D 等距绘制，无外部图片；明信片复用同一套绘制逻辑
- 交互：点家具再点地面/墙面放置；选中后可旋转 90°、移除、撤销
- 存储：`homedecor.v1.state`，保存阶段、材质、家具与 UID
- 已知限制：仅一个 6×6 户型；一套程序化简化家具；无评分/预算/风格包；无音频；未做连续拖拽
- 声音：音效默认开（选家具、放置、旋转、移除、撤销、换材质、完工），背景音乐默认关（萨蒂《裸体歌舞》三拍子改编，Web Audio 合成，公有领域作品）；开关保存在 `homedecor.v1.state` 的 `sound` 字段
- 建材市场：6 分类、22 件材料；详情含材质、环保等级、适用空间、选购提示；虚拟预算 ¥30,000；人字拼/微水泥/暖光氛围灯购买后解锁硬装；`dist/assets/market/*.svg` 为统一风格示意图（非真实商品照片）
- 本地 ZIP SHA-256（0.1.5）：`cf492900899be08384a1b676946be3b60f5118abb03346daadc0041fb0d655f5`（37,244 B）
- 单元测试：`node home-decor/tests/engine.test.js`
- 待办：第二个户型、风格包、拖拽与贴墙、美术素材、真机验证

### 装修流程手册

- 目录：`renovation-guide/`
- appId：`6affd24c261c1b0015ec0da1`
- 版本：`1.0.0`（正式版）
- 状态：已送审，审核中（截至 2026-11-20）
- 类目：`learning_education`
- 权限：`photos`（保存自测成绩卡）
- 定位：首次装修 + 老房改造的决策工具，内容驱动，弱交互
- 内容：10 个装修阶段（含新房/老房切换）、30 条材料百科、5 个空间攻略、新一线预算评估器、12 道专业避坑自测
- 预算：简装 1000–1400、中档 1800–2500、品质 3000–4000 元/㎡（新一线）；老房系数 1.15；分项占比水电 16%、泥瓦 17%、木作 22%、油漆 9%、主材 30%、其他 6%
- 存储：`renovationguide.v1.state`，保存流程进度、房屋类型、预算输入与自测最好成绩
- 分享：自测成绩卡支持保存相册 / 分享 / 发布笔记，均做能力检测
- 内容边界：通用经验，不替代当地规范与专业人员；价格与环保等级为参考
- 已上传代码包 fileId：`red_app/1jaRVKA-MKLRavy6BzkxkqtPd-1JDRqY3Ablm2lYBzus2xs.zip`
- 图标 fileId：`red_skill_tool_image/i1l5Mfuup-skYATaZu7tt_dWN7aocY2Y_rqvt6KFIZn-Gxg.png`
- 封面 fileId：`red_skill_tool_image/56ZyukMSxdnJ-QGcxaRoJOkJE1iUJIjoLRiUNvtJist0yYs.png`
- 操作记录：`~/.local/state/redapp-cli/renovation-guide/2026-11-20-upload-preview/session.json`
- 本地 ZIP SHA-256：`b7efe15df8cd8a7bc48f569f82ef36f04a045242b9bb65be6f4e68f1f9955738`（26,646 B）
- 单元测试：`node renovation-guide/tests/engine.test.js`
- 待办：平台模拟器、Android 真机、iOS 真机验证

### 头像壁纸工坊（原型）

- 目录：`photo-studio/`
- appId：`6b002e1453ca3e00150c05f1`
- 版本：`0.1.1`
- 状态：已送审，审核中（截至 2026-11-20）
- 类目：`image_creation`
- 权限：`photos`（保存图片到相册）
- 功能：4 个头像框 + 4 个壁纸主题；选本地照片、拖动/缩放、保存相册/分享/发布笔记
- 渲染：Canvas 程序化绘制，无外部素材；头像 800×800，壁纸 1080×1920
- 隐私：照片只在本机 Canvas 处理，不上传
- 声音：音效默认开（切换模板/模式、载入照片、重置、保存/分享成功），背景音乐默认关（贝多芬《致爱丽丝》改编，Web Audio 合成，公有领域）；开关存 `photostudio.v1.sound`
- 已知限制：无双指缩放/旋转；老 WebView 可能不处理 EXIF 方向；无草稿保存
- 0.1.1 已上传代码包 fileId：`red_app/k8_MtMcVbH6UOqLmYvhInd5pAHfESDMK49GorTcGTnTggz4.zip`
- 0.1.0 已上传代码包 fileId：`red_app/wVweKjl_EBmYlGLkPcZ9NVjRCFT2eBB0Nah8d0oy1GKSwfM.zip`
- 图标 fileId：`red_skill_tool_image/ChOz3yqiOdKRFhvchqytkoxmi3kPpJRi4Su98L25uRHNreQ.png`
- 封面 fileId：`red_skill_tool_image/cFBvwmIczmY_PplC3ygSYGSOaya19Syso7l7gRQz9yJpRW4.png`
- 操作记录：`~/.local/state/redapp-cli/photo-studio/2026-11-20-prototype-preview/session.json`
- 本地 ZIP SHA-256（0.1.1）：`8386e1125ae6be3db5637dcabc8090a60817fd1e3798c01927e73c97a0c88251`（13,706 B）
- 单元测试：`node photo-studio/tests/engine.test.js`
- 待办：图标/封面、真机验证、模板扩充

### 课堂偷吃大作战（2.5D 原型）

- 目录：`game-classroom-snack/`
- appId：`6b005cd9261c1b0015ec11f4`
- 版本：`1.0.0`（正式版）
- 状态：已送审，审核中（截至 2026-11-20）
- 类目：`casual_game`
- 权限：`photos`（保存成绩卡）
- 玩法：老师背对黑板写字时按住偷吃，转身前要咽下去；被抓扣命，吃满 10 个获胜
- 规则：写字时间随零食数缩短、盯人时间变长；转身完成或面向期间吃东西都会被立刻抓
- 实现：`engine.js` 纯逻辑状态机；`app.js` Canvas 2D 教室、老师转身、HUD、音效、成绩卡
- 音效：粉笔、转身提示、被抓、吃到、胜负，Web Audio 合成；无背景音乐
- 存储：`classroomsnack.v1.best`，保存最佳零食数与局数
- 已知限制：固定视角、一个教室、无难度选择、无道具、老师转身为缩放翻转
- 已上传代码包 fileId：`red_app/i2mMCEqKZAY5120HOWkYjCl-_OQPlebVMliVCZ2b9hOlALc.zip`
- 图标 fileId：`red_skill_tool_image/w60vjd71DSDkwJXQXAimhOm5rKrWuG1s8AMJmkGWG1V3vXQ.png`
- 封面 fileId：`red_skill_tool_image/9wi-l89Bay3ZlkM0i-4CFCB42rxQz95DK9JJ9_fnFtpPca4.png`
- 操作记录：`~/.local/state/redapp-cli/game-classroom-snack/2026-11-20-prototype-preview/session.json`
- 本地 ZIP SHA-256：`6abc6e1834c6f472ebb24fc17266df8475ef3bec9d8859f8fa70bd08951c1154`（12,973 B）
- 单元测试：`node game-classroom-snack/tests/engine.test.js`
- 待办：图标/封面、真机验证、难度与道具

### 课堂偷吃大作战 3D（生产版）

- 目录：`game-classroom-3d/`
- 版本：`1.1.0`（已送审，审核中，截至 2026-11-21）；`1.0.0` 已由用户在网页端撤回（`list` 显示未发布）
- 1.1.0 预览 appId：`6b00f88c261c1b0015ec138e`；预览二维码：`~/.local/state/redapp-cli/game-classroom-3d/2026-11-20-webgl-preview/preview-qr-20261121-1210.png`（用户已回复“预览通过，送审”）
- 1.1.0 已送审代码包 fileId：`red_app/LiWSKqI_5bEIWagxaMn_YEqsCB__lfoUXLFvJ6QoM5eZvZk.zip`
- 1.0.0 appId：`6b006dd08eb436001501c79f`（`status=1 审核中`）
- 类目：`casual_game`；权限：`photos`（保存成绩卡）
- 1.0.0 已送审代码包 fileId：`red_app/9fwf8mD5w-u5NG2oDAoLXdStrRD4R8TpD1bR9jyMeFVltFA.zip`
- 1.0.0 图标 fileId：`red_skill_tool_image/dEpNC8H03w1x9HXpEEC7TAUqu818DCE8Zc_8Ni5g9cy_qZE.png`
- 1.0.0 封面 fileId：`red_skill_tool_image/NaprAv5U5iHKmo7TZg_M0XspvnftDxlRRjrQhAY5VVGIAD8.png`
- 送审前预览 appId：`6b006d4b8eb436001501c79e`；预览二维码：`~/.local/state/redapp-cli/game-classroom-3d/2026-11-20-webgl-preview/preview-qr-20261121-prod2.png`（用户已回复“预览通过，送审”）
- 定位：固定机位 3D 教室偷吃游戏（生产版），名称「课堂偷吃大作战 3D」
- 技术：Three.js r128（WebGL1，MIT，包内 `vendor/three.min.js`）；规则复用 `game-classroom-snack/dist/engine.js`
- 场景：低模教室（黑板 CanvasTexture、课桌、侧边讲台、挂钟、海报、玩家课桌）、部件式老师（头发/五官/眼镜与镜腿/领口/纽扣/腰带/四肢/鞋、转身插值、两段式写字手臂）、偷吃手部
- 性能：800×600、DPR 上限 1.5、无阴影；WebGL 不可用时禁用开始并在遮罩内说明
- 0.1.1 优化：老师补全头发、五官、眼镜、领口、四肢和鞋子；吃东西改为前臂/手掌/四指/拇指握饼干
- 0.1.2 优化：吃东西改为完整动作链——手从右下抬向嘴边、饼干随进度倾斜，72% 后替换为带缺口饼干；咀嚼时手停在嘴边、手指开合、碎屑从嘴边掉落。第一人称嘴部因遮挡画面未启用
- 0.1.3 优化：老师改为两段式手臂（肩、袖、袖口、前臂、手掌、四指、拇指），写字时肩部左右扫动、肘部起落、腕部轻摆，粉笔仅写字时显示；衬衫分色、补 V 领与镜腿；吃东西时手从画面下缘抬起，咀嚼时保留咬过的饼干
- 声音：音效与背景音乐默认开；音效含粉笔、转身、被抓、吃到、胜负，背景音乐为原创五声音阶摇篮曲（C–Am–F–G 慢速分解和弦，Web Audio 合成）；开关保存在 `classroomsnack3d.v1.best` 的 `sound` 字段
- 1.0.0 优化：去掉 FPS 诊断与验证文案，改为正式名称与说明；新增被抓/胜负震动反馈（vibrateShort 能力检测）、后墙海报、粉笔槽、课桌书本；背景音乐默认开启
- 1.1.0 改动：六节课表（语文 6 / 数学 10 / 英语 8 / 物理 8 / 化学 10 / 期末 12），每关窗口、盯人、预告、进食速度和老师形象都不同；停笔预告 0.3–0.9s；英语/化学/期末有 `faking` 假动作（转 0.5–0.8 圈再转回去，0.9s，安全）；物理/化学/期末有 `pauseFake` 假停笔（停笔后再写起来，`resume` 事件）；老师形象六套（语文长发赤陶 / 数学短发蓝 / 英语发髻绿开衫 / 物理短发石板灰 / 化学长发紫 / 期末深色西装），板书按课程区分；星级按剩余生命比例（三命 3/2/1，两命 3/2，一命通关 3 星），课表按星级解锁，关卡与星级写入结算卡和发布文案；`classroomsnack3d.v1.best` 增加 `levels` 字段
- 送审记录：2026-11-21 12:25 首次提交被拒（`API_REJECTED 已存在审核中的版本`）；用户网页端撤回 1.0.0 后，12:40 重新提交成功（`status=1`）
- 1.1.0 封面 fileId（六节课 · 拿满十八颗星）：`red_skill_tool_image/ebJ5GalUTSssiee_82HQ0WY01ntJ0JWsKtShv7vhifG-oFM.png`
- 注意：`status` 接口缓存仍返回 1.0.0，版本以 `list` 的 1.1.0 为准
- 包体（1.0.0）：168,454 B（Three.js 压缩后约 150KB）
- 图标：`publish/icon-512.png`；封面：`publish/cover-900x1200.png`（均由游戏内 3D 场景渲染，不进 ZIP）
- 已知限制：占位低模、无真机数据、成绩卡沿用 2.5D 风格
- 0.1.3 已上传代码包 fileId：`red_app/KNkcSrnowbFsj1gEk7CsAeYsPhZb9o3lYreuzIGwqxsJWN0.zip`
- 本地 ZIP SHA-256（1.1.0）：`b56c9046d3b98eb21885dfd958fa7d69ff85eec245d82986d0959b34afb30ac3`（172,979 B，md5 `d6ab1b399deba878605537a0322eb81b`）
- 本地 ZIP SHA-256（1.0.0）：`d56f0beea5cebc57c4b518050835a7dd56c3716c19ba84723e201c04c161dbdf`（168,454 B，md5 `20f27fa27b887ba9066e615120e7b64f`）
- 本地 ZIP SHA-256（0.1.3）：`63e7a10856eeb79de69effa274ddeef3fb0ec0ea597a60fb5d87003f17c574f3`（168,182 B，md5 `f13986c9734bc2e77813aa47f28c1897`）
- 本地 ZIP SHA-256（0.1.2）：`3f2514dc3e1822a801f51f0aeaf412e9309278c62d394787468f00758c12f095`
- 0.1.2 已上传代码包 fileId：`red_app/oK9tjrh-XU_hcIq_xYj5F-dafmkgMp7qCx_jn3zTgG-DlWE.zip`
- 0.1.1 已上传代码包 fileId：`red_app/P6-wA110XZ4dcPh8MB4ATqPjQWaCPl4-0FnwKBmUc0mq-PY.zip`
- 0.1.0 已上传代码包 fileId：`red_app/IbvZCoQFq5UUpKGCOVAsHInFVhnN7k-Wle7qq9EnKtujpgM.zip`
- 操作记录：`~/.local/state/redapp-cli/game-classroom-3d/2026-11-20-webgl-preview/session.json`

### 课间十分钟 · 贪吃蛇

- 目录：`game-snake-break/`
- 版本：`1.0.0`（正式版）
- 状态：加入背景音乐后已重新打包，待重新上传预览
- 上一个预览 appId `6b0100858eb436001501c90a` 对应无背景音乐版本，已作废
- 形态：20×26 网格、60 秒课间、课桌场景；滑动 / 四向键 / 方向键 WASD 转向，转向队列最多缓存两次
- 零食：辣条 +1 分、饼干 +2 分、水果糖 +1 分并补 2 秒；速度 165ms/格起，吃到零食后逐渐加快到 95ms/格
- 结束：撞墙 / 撞自己立即结束；60 秒下课铃结束
- 开局：1.2 秒准备期，期间不移动、不扣时间（`startDelay`，结束时发 `go` 事件）
- 存储：`snakebreak.v1.best`，保存最高分、局数与音效开关
- 结算：900×1200 成绩卡（课桌面板 + 零食蛇 + 分数 + 新纪录角标），保存 / 分享 / 发布笔记均做能力检测与失败降级
- 音效：吃到、被抓、下课铃、开始，Web Audio 合成
- 背景音乐：G 大调五声音阶音乐盒旋律 + G–Em–C–D 慢速和弦，32 步约 12.2 秒循环，Web Audio 合成，默认开启；切后台暂停，开关保存在 `snakebreak.v1.best` 的 `sound.bgm`
- 素材：`publish/icon-512.png`（512×512 圆角透明图标）、`publish/cover-900x1200.png`
- 包体：14,405 B；本地 ZIP SHA-256 `06160ee8e2b4e355155e28be1d329ace66fe3dd37368caa694e5c7f52be18b60`（md5 `c02bd7e44699e2dc974a16deca2394d8`）
- 单元测试：`node game-snake-break/tests/engine.test.js`
- 已知限制：滑动阈值与速度曲线待真机手感反馈；送审需补类目与 `photos` 权限

### 初中回忆杀

- 目录：`game-junior-quiz/`
- 版本：`1.0.0`（正式版）
- 状态：已送审，审核中（截至 2026-11-21）
- appId：`6b0152943894b3001504b088`（`status=1`）
- 类目：`learning_education`；权限：`photos`（保存成绩卡）
- 预览 appId：`6b01511b8eb436001501cade`；预览二维码：`~/.local/state/redapp-cli/game-junior-quiz/2026-11-21-prototype-preview/preview-qr-20261121-3.png`（用户已回复“预览通过，送审”）
- 已送审代码包 fileId：`red_app/RVERF2BHXvzXN51uRyFlTS2RW6-ZFXli6NWs_D__jq_jziE.zip`
- 图标 fileId：`red_skill_tool_image/8jwieFIi28HuW2ZBRDcEH5VvPbPNQpH2jNzva9zL37cHmH0.png`
- 封面 fileId：`red_skill_tool_image/9zgopCs2Ic5JOiGkUrO8KX8MYFDLk9Yk-Xd1SzTV90zl6hA.png`
- 操作记录：`~/.local/state/redapp-cli/game-junior-quiz/2026-11-21-prototype-preview/session.json`
- 形态：初中三年三册（七年级 / 八年级 / 九年级），练习 + 考试；考试通过解锁下一册，九年级通过即毕业
- 题库：110 题（七年级 35、八年级 40、九年级 35），覆盖语文 / 数学 / 英语 / 物理 / 化学 / 生物 / 历史 / 地理 / 道德与法治；每科 5 题、每题 4 选项 + 解析
- 练习：综合 10 题、单科 5 题；考试：10 题，答对 8 题通过
- 功能：个人中心（累计答题、正确率、练习组数、考试通过/次数）、错题本（答对自动移除）、900×1200 成绩卡、保存/分享/发布笔记、音效与背景音乐
- 存储：`juniorquiz.v1.state`（`level` / `graduated` / `profile` / `settings`）
- 声音：Web Audio 音效 + D 大调音乐盒背景音乐（D–Bm–G–A，约 12.8 秒循环），默认开启
- 素材：`publish/icon-512.png`（512×512 圆角透明）、`publish/cover-900x1200.png`
- 包体：24,967 B；本地 ZIP SHA-256 `552ac9213a8c3873c6eab09ac5c69e6d406232b9bd9a45c8fefbe8077f944a59`（md5 `8a7395154e111101a2041348df759c7c`）
- 单元测试：`node game-junior-quiz/tests/engine.test.js`
- 已知限制：题库人工整理，送审前需逐题抽查；年级按主题分组，个别题目可能跨册

### 高中回忆杀

- 目录：`game-high-quiz/`
- 版本：`0.2.0`（已送审，审核中）；`0.1.0` 已发布
- 状态：`0.1.0` 已发布；`0.2.0` 扩大题量、提高难度，已送审审核中（截至 2026-11-23）
- appId：`6b01be3a3894b3001504b45f`（`list` 显示 0.2.0 审核中；`status` 接口缓存仍返回 0.1.0 已发布，版本以 `list` 为准）
- 形态：高中三年三册（高一 / 高二 / 高三），练习 + 考试；高一、高二考试 12 题答对 10 题通过，**高三考试即高考，15 题答对 12 题通关**
- 题库：162 题（每册 54 题），九科（语文 / 数学 / 英语 / 物理 / 化学 / 生物 / 历史 / 地理 / 政治），每科 6 题（4 基础 + 2 进阶）、4 选项 + 解析；进阶题标记 `difficulty: 2`
- 练习：综合 12 题、单科 6 题；进阶题约占 40%，考试优先抽进阶题
- 功能：个人中心（统计、错题本）、900×1200 成绩卡（高考通过显示“高考通过”角标）、保存/分享/发布笔记、音效与背景音乐
- 存储：`highquiz.v1.state`（`level` / `graduated` / `profile` / `settings`）
- 声音：Web Audio 音效 + A 大调音乐盒背景音乐（A–F#m–D–E，约 12.8 秒循环），默认开启
- 包体（0.2.0）：30,334 B；本地 ZIP SHA-256 `2405dfafbc9952571ea6d829a965f5215b5ae63da52cbd840dde199fdfdc4437`（md5 `b4f9b86defc7b3859400fb72b2da1fd8`）
- 包体（0.1.0）：24,174 B；本地 ZIP SHA-256 `7ade40c59b47b2347d729557f4b663e7a7bce8ed058f449a81e101fd676acbbd`（md5 `49acecd930e4d99bf260143f9a4073be`）
- 0.1.0 已送审代码包 fileId：`red_app/MxzsQamc7Jbh9vmXNitDwxeQ73uadjIOt5nRhvUi1kKNIs8.zip`
- 0.2.0 已送审代码包 fileId：`red_app/GxP_WItoss3hIAKtmcCoJbtyGLugDETvgW3vL_LH3-pletg.zip`
- 图标 fileId：`red_skill_tool_image/7qUaa_VbRj_j2fmOcqeJvIRJBg0SJWOIzT_-xxqtP1uZ4YI.png`
- 封面 fileId：`red_skill_tool_image/2_iosardLYEVJOdbSOvGXVf0n-HtryQK2XSwE7fowvx2LFA.png`
- 0.2.0 预览 appId：`6b03e4ef53ca3e00150c1b73`；预览二维码：`~/.local/state/redapp-cli/game-high-quiz/2026-11-23-upload-preview/preview-qr-20261123-1.png`
- 操作记录（0.2.0）：`~/.local/state/redapp-cli/game-high-quiz/2026-11-23-upload-preview/session.json`
- 操作记录（0.1.0 送审）：`~/.local/state/redapp-cli/game-high-quiz/2026-11-21-upload-preview-v2/session.json`；首次上传预览记录（已作废）：`~/.local/state/redapp-cli/game-high-quiz/2026-11-21-upload-preview/session.json`
- 素材：`publish/icon-512.png`（512×512，PNG，约 28 KB）、`publish/cover-900x1200.png`（900×1200，PNG，3:4，约 197 KB）；SVG 源文件同目录，`publish/` 不进 ZIP
- 单元测试：`node game-high-quiz/tests/engine.test.js`
- 已知限制：题库人工整理（新增 54 道进阶题），送审前需逐题抽查；0.2.0 已送审、未真机验证

### 双线编年史

- 目录：`history-chronicle/`
- 版本：`0.1.0`
- 状态：已上传并生成预览，未送审（2026-11-23）
- 定位：中国 / 西方双栏编年时间轴 + 纪传体故事
- 内容：4 个时代、21 个时间节点、30 则纪传故事（中国 16、西方 14）
- 范围：神话创世—夏商西周—东周秦汉；创世/亚当夏娃—出埃及/摩西—希腊罗马—耶稣/新约
- 交互：时代筛选、地区筛选、关键词搜索、关闭神话传说、故事详情与时间轴互跳
- 实现：纯静态 H5；`data.js` + `engine.js` + `app.js` + `style.css`；经典外置脚本，不调用平台能力
- 素材：`publish/icon-512.png`（512×512，PNG，约 30 KB）、`publish/cover-900x1200.png`（900×1200，PNG，3:4，约 240 KB）；SVG 源文件同目录
- 包体：30,313 B；本地 ZIP SHA-256 `72de1db5326f57ac62edb01d079e317ce90e73c7590ed84406702f2e746274c3`（md5 `067e45e0b89825549f69fa37d429b1d9`）
- 已上传代码包 fileId：`red_app/bUVSmb6b0y73xkC9sGmZbVhr6h6HyAvS93Na1P8MXiU8LY0.zip`
- 图标 fileId：`red_skill_tool_image/La4Ov4Un1qQp4ReG5tq2xbQ3quJ6LyYUN_Sx4DlX67lZpIs.png`
- 封面 fileId：`red_skill_tool_image/o4e3neQoiltuxP_NNjQff0RdBuOo6IkmWULlvkX313K42j0.png`
- 预览 appId：`6b0430ad53ca3e00150c1db3`；预览二维码：`~/.local/state/redapp-cli/history-chronicle/2026-11-23-upload-preview/preview-qr-20261123-1.png`
- 操作记录：`~/.local/state/redapp-cli/history-chronicle/2026-11-23-upload-preview/session.json`
- 单元测试：`node history-chronicle/tests/engine.test.js`
- 已知限制：年代为世纪级对齐；内容为通识整理，送审前需逐条复核；未送审、未真机验证

### 西方神话与圣史

- 目录：`west-myth-history/`
- 版本：`0.1.0`
- 状态：已上传并生成预览，未送审（2026-11-23）
- 定位：西方神话、圣经叙事与宗教史大事长卷
- 内容：4 个时代、33 件大事（神话时代 8、旧约 9、新约与早期教会 8、中世纪与改革 8）；按类型神话 7、圣经 12、宗教史 14
- 交互：时代筛选、文本类型筛选、关键词搜索、逐则详情、上一件/下一件、说明页
- 实现：纯静态 H5；`data.js` + `engine.js` + `app.js` + `style.css`；经典外置脚本，不调用平台能力
- 素材：`publish/icon-512.png`（512×512，PNG，约 30 KB）、`publish/cover-900x1200.png`（900×1200，PNG，3:4，约 242 KB）；SVG 源文件同目录
- 包体：27,103 B；本地 ZIP SHA-256 `fd078c75ebd6bca6e3816917a8acf36108f0c5b8d888fc2d137341b1a0458841`（md5 `a4db3301f3e484a85a5665253475db4d`）
- 已上传代码包 fileId：`red_app/SvR7RDQoV1NLD6n4FQj8Ige58Kp5g-9LohIMg0am9n0sOOY.zip`
- 图标 fileId：`red_skill_tool_image/_rzbxP5RdYjJ8F63lHoXZq41-qaLt51l_TB1MUV6nl-TWEg.png`
- 封面 fileId：`red_skill_tool_image/RVZkXsK4P21RHhiVSh9634k71pQOtELXhnB2URs4qHoG9Ds.png`
- 预览 appId：`6b04e47a8eb436001501e0ba`；预览二维码：`~/.local/state/redapp-cli/west-myth-history/2026-11-24-upload-preview/preview-qr-20261124-1.png`
- 操作记录：`~/.local/state/redapp-cli/west-myth-history/2026-11-24-upload-preview/session.json`；首次上传预览记录（已作废）：`~/.local/state/redapp-cli/west-myth-history/2026-11-23-upload-preview/session.json`
- 单元测试：`node west-myth-history/tests/engine.test.js`
- 已知限制：年代多为约数；神话、圣经与历史材料已分栏标注，送审前仍需逐条复核；未送审、未真机验证

### 生活常识小考

- 目录：`life-common-sense/`
- 版本：`0.1.0`
- 状态：七类 210 题已送审，审核中（截至 2026-11-26）
- appId：`6b07e65bfae1a50015241526`（`status=1 审核中`）
- 定位：职场 / 社交 / 医院 / 交通 / 生活 / 法律 / 厨房七类常识答题
- 题库：210 题（每类 30 题），每题 4 选项 + 解析
- 模式：首页用标签选择分类后开始练习（每组 10 题）、综合挑战（20 题，七类尽量均衡，答对 16 题通过）、错题重练
- 功能：累计答题、正确率、练习组数、错题本；答对自动移出错题本，可手动移除
- 存储：`lifequiz.v1.state`（`profile` / `wrongBook`）；仅用 `window.xhs.miniTool` Storage，缺失时降级为页面内数据并提示
- 实现：纯静态 H5；`data.js` + `engine.js` + `app.js` + `style.css`；经典外置脚本
- 素材：`publish/icon-512.png`（512×512，PNG，约 27 KB）、`publish/cover-900x1200.png`（900×1200，PNG，3:4，约 275 KB）；SVG 源文件同目录
- 包体（七类 210 题）：35,239 B；本地 ZIP SHA-256 `72ac326b15df0339b07da1c537b7135a6d5980160504bbd25c5e9613307a73bf`（md5 `0be7220dc451b68a353bceb35d96940d`）
- 主题：米黄底、陶土橙主色；分类用一排可选标签，不再使用大选择卡；答题对错用橄榄绿 / 砖红区分
- 已送审代码包 fileId：`red_app/Bg-zNvJ0RxNVHKnrAWzV7DlJFzDmCjdScgmMnt5XomX8WEs.zip`
- 上一版（五类 100 题，已作废）代码包 fileId：`red_app/YlVzadBtWV9W4zbE0y91Y5NCjUnpdo6YreNC1z7E-gSF1Xo.zip`
- 图标 fileId：`red_skill_tool_image/qUKvWSCqr8zhz-3GWliJpemlfG_gPQ8YrOL2svJzeQh3Qc4.png`
- 封面 fileId：`red_skill_tool_image/FDhbzZib2Dj0EAbbHGIKbpwzxzbRjjetYLl3WCScDvndt6E.png`
- 预览 appId：`6b07da0153ca3e00150c34f1`；预览二维码：`~/.local/state/redapp-cli/life-common-sense/2026-11-26-7cat-preview/preview-qr-20261126-7cat-1.png`
- 操作记录（七类 210 题）：`~/.local/state/redapp-cli/life-common-sense/2026-11-26-7cat-preview/session.json`
- 上一版预览 appId（已作废）：`6b07d14c3894b3001504da66`；操作记录：`~/.local/state/redapp-cli/life-common-sense/2026-11-26-warm-preview/session.json`
- 上一版（青色主题，已作废）代码包 fileId：`red_app/LTE1topwij0rlwKLTFuasL462qWfxbip7WlKIXDi0UBm0Aw.zip`；预览 appId：`6b07cf4c261c1b0015ec3ed9`；操作记录：`~/.local/state/redapp-cli/life-common-sense/2026-11-26-upload-preview/session.json`
- 单元测试：`node life-common-sense/tests/engine.test.js`
- 已知限制：题库人工整理，医疗/法规内容送审前需逐题复核；未真机验证

### 城市徒步指南（北京单城版）

- 目录：`city-hiking-guide/`
- 版本：`0.1.0`
- 状态：北京 10 条路线 + 亲子筛选 + 分享卡已送审，审核中（截至 2026-11-28）
- appId：`6b0a4016261c1b0015ec5013`（`status=1 审核中`）
- 定位：城市周边徒步路线推荐，首期只做北京
- 城市：1 个（北京）；10 条代表路线
- 内容：每条含名称、难度、里程、爬升、用时、一句核心亮点、亲子标记；详情含起点、亮点和提示
- 交互：紧凑列表（一屏多条）、难度/亲子筛选（全部 / 亲子 / 轻松 / 进阶 / 挑战）、点击路线进入详情页、返回保留列表位置
- 分享：详情页生成 900×1200 路线卡，支持保存相册 / 分享图片 / 发布笔记；使用 `saveImageToPhotosAlbum`、`share`、`postNote`，均做能力检测
- 实现：纯静态 H5；`data.js` + `engine.js` + `app.js` + `style.css`；经典外置脚本
- 素材：`publish/icon-512.png`（512×512，PNG，约 32 KB）、`publish/cover-900x1200.png`（900×1200，PNG，3:4，约 212 KB）；SVG 源文件同目录
- 包体（北京 10 条 + 分享卡）：12,626 B；本地 ZIP SHA-256 `13240b80e18a757491d7894a94587da6c169cc5b70b7f9adf65ba6e28dce9af2`（md5 `5867d988fca8ffb6ef7966bd8011e17a`）
- 已送审代码包 fileId：`red_app/Ra0n3flYvBPjTGvh1pegvjzhlWooV_FVkyvDW5WQ_qCN_q0.zip`
- 图标 fileId：`red_skill_tool_image/w6iyqWTwV_mXooTiYxedVce-Ht7LLQ0jgegvaY1P1Q3Ye9M.png`
- 封面 fileId：`red_skill_tool_image/ccZ8ruduGj6_AsMyvlReIumSHMNWQmwrkjTtKsJ8brKUb8Q.png`
- 预览 appId：`6b0a3fb6261c1b0015ec500e`；预览二维码：`~/.local/state/redapp-cli/city-hiking-guide/2026-11-28-share-preview/preview-qr-20261128-share-1.png`
- 操作记录（10 条 + 分享卡）：`~/.local/state/redapp-cli/city-hiking-guide/2026-11-28-share-preview/session.json`
- 上一版（北京 5 条，已作废）代码包 fileId：`red_app/v0m-cpCN_OLO91LYbrjeTyf-nNVzmRvfASOdQCem2fdA2ZQ.zip`；预览 appId：`6b0a37defae1a500152425b9`；操作记录：`~/.local/state/redapp-cli/city-hiking-guide/2026-11-28-beijing-preview/session.json`
- 单元测试：`node city-hiking-guide/tests/engine.test.js`
- 已知限制：路线数据为常见走法约数，未接入地图/轨迹/天气；分享入口依赖平台版本；未真机验证

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
