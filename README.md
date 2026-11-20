# 小红书小工具工作区

本工作区用于开发和打包可离线运行的小红书小工具。每个小工具独立成目录，最终产物是一个 ZIP，ZIP 根目录必须直接包含 `index.html`。

## 工具列表

| 目录 | 名称 | 版本 | 状态 | 说明 |
| --- | --- | --- | --- | --- |
| `time-health-index/` | 时间健康指数 | 1.0.0 | 已送审，审核中 | 24 小时时间分配、健康分与改善建议 |
| `game-2048/` | 2048 | 1.1.0 | 1.0.0 已发布；1.1.0 已送审，审核中 | 4×4 滑动合并小游戏 + 音效 |
| `game-huarongdao/` | 华容道 | 1.0.0 已发布；本地 1.1.0 | 1.0.0 已发布，1.1.0 音效版已上传预览 | 经典横刀立马滑块解谜 |
| `game-idiom/` | 成语解谜 | 1.0.0 | 已送审，审核中 | 每日成语拼字 + 分享结果卡 |
| `game-primary-quiz/` | 小学回忆杀 | 1.0.1 | 已送审 1.0.1，审核中 | 小学练习/升级考试 + 个人中心 + 奥赛 + 音效 |
| `game-christmas-tree/` | 圣诞装饰树 | 1.0.0 | 已送审，审核中 | 主题装饰 + 评分 + 圣诞明信片 |
| `english-shadowing/` | 英语跟读实验室 | 1.0.0 | 已送审，审核中 | 场景对话 + 背单词 + 录音回放 |
| `home-decor/` | 装修实验室（2.5D 原型） | 0.1.5 | 已上传并生成预览 | 选户型 + 硬装/软装 + 建材市场 + 等距明信片 |
| `renovation-guide/` | 装修流程手册 | 0.1.0 | 已送审，审核中 | 流程 + 材料百科 + 空间 + 预算 + 自测 |

- 时间健康指数 appId：`6afe917a3894b300155e85e7`
- 平台环境：`prod`；三方来源：`thirdAgent`
- 送审不等于发布；审核状态以 `redapp status` 为准。

## 目录结构

```text
red-tool/
├── README.md
├── CLAUDE.md
├── scripts/
│   └── package.py                 # 跨项目 ZIP 打包脚本
├── time-health-index/
│   ├── README.md
│   ├── dist/                      # 仅打包内容：index.html / app.js / style.css
│   ├── publish/                   # 图标、封面及 SVG 源文件
│   └── time-health-index.zip
├── game-2048/
│   ├── README.md
│   ├── dist/                      # index.html / engine.js / app.js / style.css
│   ├── publish/                   # 图标、封面及 SVG 源文件
│   ├── tests/
│   └── game-2048.zip              # 构建产物
├── game-huarongdao/
│   ├── README.md
│   ├── dist/                      # index.html / engine.js / app.js / style.css
│   ├── publish/
│   ├── tests/
│   └── game-huarongdao.zip
├── game-idiom/
│   ├── README.md
│   ├── dist/                      # index.html / data.js / engine.js / app.js / style.css
│   ├── publish/
│   ├── tests/
│   └── game-idiom.zip
├── game-primary-quiz/
    ├── README.md
    ├── dist/                      # index.html / data.js / engine.js / app.js / style.css
    ├── publish/
    ├── tests/
    └── game-primary-quiz.zip
├── game-christmas-tree/
    ├── README.md
    ├── dist/                      # index.html / data.js / engine.js / app.js / style.css
    ├── publish/
    ├── tests/
    └── game-christmas-tree.zip
├── english-shadowing/
    ├── README.md
    ├── dist/                      # 技术验证：录音 + 回放 + 诊断
    ├── publish/
    ├── tests/
    └── english-shadowing.zip
├── home-decor/
    ├── README.md
    ├── dist/                      # data.js / engine.js / app.js / style.css
    ├── publish/
    ├── tests/
    └── home-decor.zip
└── renovation-guide/
    ├── README.md
    ├── CONTENT-OUTLINE.md
    ├── dist/                      # 流程、材料、空间、预算、自测
    ├── publish/
    ├── tests/
    └── renovation-guide.zip
```

### 目录约定

- **一个小工具一个目录**，不要把两个工具的 `dist` 或 ZIP 混在一起。
- `dist/` 只放要打包的文件；README、SVG 源文件、构建脚本不进入 ZIP。
- 打包的是 `dist` 目录内容，不是 `dist` 目录本身，确保 ZIP 根目录直接有 `index.html`。
- 平台侧按 appId 隔离；本地存储、排行榜和云存储也按小工具隔离。

## 环境要求

- Node.js 18+（审计脚本零依赖）
- Python 3（打包脚本仅用标准库）
- `redapp-cli` Skill 与 npm 包 `redskillhub-upload`
- `minitool-zip-builder` Skill（开发与打包规范）

本机已安装的技能目录：

```text
~/.claude/skills/redapp-cli/
~/.claude/skills/minitool-zip-builder/
```

`redapp` 使用进程级 npm prefix：

```bash
export npm_config_prefix="$HOME/.local/share/redapp-cli-npm"
export npm_config_cache="$HOME/.cache/redapp-cli-npm"
export PATH="$npm_config_prefix/bin:$PATH"
node "$HOME/.claude/skills/redapp-cli/scripts/ensure-cli.mjs"
```

## 打包

```bash
# 语法与结构
node --check game-2048/dist/engine.js
node --check game-2048/dist/app.js
node --check game-huarongdao/dist/app.js
node game-huarongdao/tests/engine.test.js
node --check game-idiom/dist/app.js
node game-idiom/tests/engine.test.js
node --check game-primary-quiz/dist/app.js
node game-primary-quiz/tests/engine.test.js
node game-christmas-tree/tests/engine.test.js
node home-decor/tests/engine.test.js
node renovation-guide/tests/engine.test.js

# 生成 ZIP（根目录直接是 index.html）
python3 scripts/package.py game-2048/dist game-2048/game-2048.zip

# 体积审计
node "$HOME/.claude/skills/minitool-zip-builder/scripts/audit_artifact.mjs" game-2048/dist
node "$HOME/.claude/skills/minitool-zip-builder/scripts/audit_artifact.mjs" game-2048/game-2048.zip
python3 "$HOME/.claude/skills/minitool-zip-builder/scripts/audit_artifact.py" game-2048/game-2048.zip
```

## 发布流程

1. `redapp upload --file <zip> --type pkg --dry-run --agent`
2. 核对计划后使用返回的 `planHash` 执行 `--confirm`
3. 上传图标 / 封面（如需发布新工具）
4. 创建 `preview.json`，先 `--dry-run` 再 `--confirm --qr-out <新文件名>`
5. 让用户扫码体验；收到明确的“预览通过”后再 `submit`
6. `submit` 成功后用 `status` / `history` 核对

所有上传、预览、送审、编辑都必须获得用户当次明确授权；安装 Skill 本身不包含这些业务操作。

## 验证边界

- Node 单元测试、Headless Chrome 冒烟测试只用于发现逻辑和运行时错误。
- 最终验收必须在创服平台模拟器完成，并分别在 **Android 真机**和 **iOS 真机**扫码验证相同 ZIP。
- Chrome 61 / Android 8.1 兼容性未在真机实测时，交付说明中必须明确标注。

## 操作记录

多步上传 / 预览 / 送审记录保存在：

```text
~/.local/state/redapp-cli/<tool>/<task>/session.json
```

当前时间健康指数的记录目录：

```text
~/.local/state/redapp-cli/time-health-index/2026-11-19-upload-preview/
```
