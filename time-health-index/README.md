# 时间健康指数

把一天 24 小时按 30 分钟涂色，统计睡眠、工作、锻炼、休闲、看视频、打游戏和其他时间，生成 100 分制健康指数与改善建议。

## 状态

- 版本：`1.0.0`
- 平台状态：已送审，**审核中**（`status=1`）
- appId：`6afe917a3894b300155e85e7`
- 环境 / 来源：`prod` / `thirdAgent`
- 送审时间：2026-11-19
- 操作记录：`~/.local/state/redapp-cli/time-health-index/2026-11-19-upload-preview/session.json`

## 功能

- 24 小时时间轴，48 个 30 分钟格子，点按或滑动涂色
- 7 类时间：睡眠、工作/学习、锻炼、线下休闲、看视频、打游戏、其他/通勤
- 快捷模板：上班族、学生、自由职业
- 前一天 / 后一天切换，按天保存
- 健康分：睡眠 30、运动 20、屏幕娱乐 25、工作负荷 15、作息规律 10
- 动态建议：睡眠不足/过长、增加锻炼、减少看剧、控制游戏、工作过载、睡前屏幕等

## 文件

```text
time-health-index/
├── dist/
│   ├── index.html
│   ├── app.js
│   └── style.css
├── publish/
│   ├── icon-512.png / icon-512.svg
│   └── cover-900x1200.png / cover-900x1200.svg
├── time-health-index.zip      # 已送审版本
└── README.md
```

已送审 ZIP 的 SHA-256：

```text
d1f271e1c61f23df2e3e82eea13f4fb16f815c6a0231dcff2a1d7703950c89eb
```

## 构建与校验

```bash
cd /home/wade/Workspace/red-tool

# 语法
node --check time-health-index/dist/app.js

# 重新打包（会生成新的 ZIP 文件）
python3 scripts/package.py time-health-index/dist time-health-index/time-health-index.zip

# 审计
node "$HOME/.claude/skills/minitool-zip-builder/scripts/audit_artifact.mjs" time-health-index/dist
node "$HOME/.claude/skills/minitool-zip-builder/scripts/audit_artifact.mjs" time-health-index/time-health-index.zip
python3 "$HOME/.claude/skills/minitool-zip-builder/scripts/audit_artifact.py" time-health-index/time-health-index.zip
```

注意：重新打包会改变 ZIP 哈希。如果要更新已送审的小工具，必须提升版本号、重新预览并送审同一 appId，不能把新 ZIP 当成 1.0.0 的补丁静默替换。

## 发布信息

- 名称：时间健康指数（6/14）
- 简介：涂出24小时健康分（9/14）
- 类目：生活方式（`efficiency_life`）
- 权限：无
- 图标：512×512 PNG，1:1
- 封面：900×1200 PNG，3:4

## 验证范围

已通过本地语法、打包结构、体积审计和 Headless Chrome 冒烟测试；平台模拟器、Android 真机和 iOS 真机验证以平台审核与用户实测为准。
