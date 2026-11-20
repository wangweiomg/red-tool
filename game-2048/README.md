# 2048

4×4 滑动合并小游戏：相同数字相撞合并，目标合成 2048，可继续挑战更高数字。纯离线 H5，无网络请求，进度保存在小工具本地 Storage。

## 状态

- 已发布版本：`1.0.0`（`status=2 已发布`，查询于 2026-11-20）
- 1.1.0：已送审，审核中（2026-11-20；`list` 显示 1.1.0 审核中，`status` 接口仍缓存 1.0.0）
- appId：`6afeb70053ca3e00159ba0a2`
- 送审时间：2026-11-19
- 操作记录：`~/.local/state/redapp-cli/game-2048/2026-11-19-upload-preview/session.json`
- 建议类目：休闲玩法（`casual_game`）
- 建议简介：滑动合成，挑战2048（11/14）
- 权限：无

## 功能

- 触摸滑动、鼠标拖动、方向键 / WASD
- 4×4 棋盘，滑动与合并动画
- 分数、最高分、撤销一步
- 达成 2048 后可继续挑战
- 棋盘填满且无法移动时结束，可撤销或重开
- 自动保存当前棋盘、分数、最高分、胜负状态和声音设置
- 音效：滑动轻响、按合并数值升调的合并音、达成 2048 的胜利音、结束时下行提示音（Web Audio 合成，默认开）
- 背景音乐：原创 8-bit 循环（Web Audio 合成，默认关，可随时开关；页面隐藏时自动暂停）

## 操作

- 手机：在棋盘上向上 / 下 / 左 / 右滑动
- 桌面 / 模拟器：拖动鼠标，或使用方向键 / WASD
- “新游戏”会重置当前进度并保留最高分
- “撤销一步”只保留最近一次有效移动

## 文件

```text
game-2048/
├── dist/
│   ├── index.html      # 入口
│   ├── engine.js       # 纯移动/合并逻辑，可单独测试
│   ├── app.js          # DOM 渲染、输入、动画、存储
│   └── style.css
├── publish/
│   ├── icon-512.png / icon-512.svg
│   └── cover-900x1200.png / cover-900x1200.svg
├── tests/
│   └── engine.test.js  # Node 单元测试，不进入 ZIP
├── game-2048.zip       # 构建产物
└── README.md
```

## 数据

- Storage key：`game2048.v1.state`
- 保存内容：4×4 数字矩阵、分数、最高分、是否已达成 2048、是否继续挑战、`sound: { sfx, bgm }`
- 声音设置默认：音效开、背景音乐关；不支持 Web Audio 时按钮置灰
- 1.1.0 已送审代码包 fileId：`red_app/yq3aCbR5srqrd7ZNpQdvFDsuXprzjKLIg11q9XshM39O1FU.zip`
- 1.1.0 ZIP SHA-256：`41de65c6fe14cf550855e2507b74915a32fcdf0865c52a5de3e1391064c3777b`
- 不支持平台 Storage 时降级为本次会话内存，并在页面底部提示

## 构建与校验

```bash
cd /home/wade/Workspace/red-tool

# 逻辑测试
node game-2048/tests/engine.test.js

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

## 实现说明

- `engine.js` 只处理网格与合并规则，不接触 DOM，便于 Node 单元测试。
- 方块位置使用 `transform: translate(...)` 过渡；缩放动画放在内层元素，避免与位移冲突。
- 动画结束使用定时器推进业务状态，不依赖 `transitionend`。
- 不使用网络、Worker、WASM、`localStorage` 或被禁 Web API。
- 兼容基线：Chrome 61 / Android 8.1，iOS 18.4+。

## 验证范围

已通过引擎单元测试、Headless Chrome 的合并 / 撤销 / 新游戏 / 胜负 / 滑动 / 存档冒烟测试。尚未在创服平台模拟器、Android 真机和 iOS 真机验证，也未上传发布。
