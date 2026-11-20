# 华容道

经典 4×5 滑块解谜：移动方块，让 2×2 的曹操从棋盘底部中间出口出逃。当前实现为经典布局「横刀立马」。

## 状态

- 已发布版本：`1.0.0`（`status=2 已发布`，查询于 2026-11-20）
- 本地版本：`1.1.0`（新增音效与背景音乐，尚未上传预览）
- appId：`6afeb9b33894b300155e8782`
- 送审时间：2026-11-19
- 操作记录：`~/.local/state/redapp-cli/game-huarongdao/2026-11-19-upload-preview/session.json`
- 建议类目：休闲玩法（`casual_game`）
- 建议简介：移动滑块，帮曹操出逃（10/14）
- 权限：无

## 功能

- 经典横刀立马布局：曹操、关羽、张飞、赵云、马超、黄忠和 4 个卒
- 拖动方块移动，或点选方块后用方向键 / WASD
- 步数统计、最少步数记录
- 撤销一步、重新开始
- 曹操到达底部中间时通关
- 自动保存当前布局、步数、最少步数、通关状态和声音设置
- 音效：选中轻响、移动木质感短音、撞墙低音、通关四音上行（Web Audio 合成，默认开）
- 背景音乐：帕赫贝尔《卡农》D 大调和弦进行改编的舒缓循环（Web Audio 合成，默认关；页面隐藏时自动暂停）
- 本地 1.1.0 ZIP SHA-256：`5ebc2c3da16208477916ec8fc67e9342f9cd5b506315763c3e525610489aa8ad`

## 操作

- 手机：直接拖动方块
- 桌面 / 模拟器：拖动鼠标，或点选方块后使用方向键 / WASD
- 撤销只回退最近一次有效移动
- 重新开始会保留历史最少步数

## 文件

```text
game-huarongdao/
├── dist/
│   ├── index.html      # 入口
│   ├── engine.js       # 占位、移动规则、通关判定，可单独测试
│   ├── app.js          # DOM、拖拽、键盘、存储、胜负状态
│   └── style.css
├── publish/
│   ├── icon-512.png / icon-512.svg
│   └── cover-900x1200.png / cover-900x1200.svg
├── tests/
│   └── engine.test.js  # Node 单元测试，不进入 ZIP
├── game-huarongdao.zip # 构建产物
└── README.md
```

## 数据

- Storage key：`huarongdao.v1.state`
- 保存内容：10 个方块的坐标、步数、最少步数、是否通关
- 不支持平台 Storage 时降级为本次会话内存，并在页面底部提示

## 构建与校验

```bash
cd /home/wade/Workspace/red-tool

# 逻辑测试
node game-huarongdao/tests/engine.test.js

# 语法
node --check game-huarongdao/dist/engine.js
node --check game-huarongdao/dist/app.js

# 打包
python3 scripts/package.py game-huarongdao/dist game-huarongdao/game-huarongdao.zip

# 审计
node "$HOME/.claude/skills/minitool-zip-builder/scripts/audit_artifact.mjs" game-huarongdao/dist
node "$HOME/.claude/skills/minitool-zip-builder/scripts/audit_artifact.mjs" game-huarongdao/game-huarongdao.zip
python3 "$HOME/.claude/skills/minitool-zip-builder/scripts/audit_artifact.py" game-huarongdao/game-huarongdao.zip
```

## 实现说明

- `engine.js` 只负责占位、边界、碰撞和通关判定，不接触 DOM。
- 方块使用百分比定位，4×5 棋盘通过 `padding-bottom: 125%` 保持比例。
- 拖拽支持一次手势连续移动多格；键盘使用当前选中方块。
- 代码为 ES2017 以内，CSS 为 Chrome 61 基线；无网络、Worker、WASM、`localStorage` 或被禁 Web API。
- 兼容基线：Chrome 61 / Android 8.1，iOS 18.4+。

## 验证范围

已通过引擎单元测试与 Headless Chrome 的键盘移动、拖拽、撤销、重新开始、存档恢复和通关弹层冒烟测试。尚未在创服平台模拟器、Android 真机和 iOS 真机验证，也未上传发布。
