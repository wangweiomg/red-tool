# 圣诞装饰树

圣诞限定小游戏：选一个主题订单，把挂饰拖到树上装饰，完成评分并生成圣诞明信片。

## 玩法

- 3 个主题订单 + 1 个自由装饰模式：
  - 雪夜蓝调：蓝球 ×3、银球 ×3、金球 ×1、树顶星
  - 姜饼暖棕：金球 ×3、铃铛 ×2、礼物盒 ×2、树顶星
  - 莓果红绿：红球 ×4、拐杖糖 ×2、粉球 ×2、树顶星
  - 自由装饰：无清单，挂 8 件以上更饱满
- 操作：拖动托盘挂饰到树上，或先点挂饰再点树上虚线位置；点树上的挂饰取下；支持撤销 / 清空。
- 评分：主题完成度、左右平衡、装饰丰富度、树顶星星；自由模式额外看种类多样。
- 结果：保存明信片到相册、分享图片、发布笔记（均做方法存在性检测与失败降级）。

## 目录

```text
game-christmas-tree/
├── dist/                       # 打包内容（ZIP 根目录）
│   ├── index.html
│   ├── data.js                 # 挂饰、主题订单、挂点坐标
│   ├── engine.js               # 评分与放置规则（纯逻辑）
│   ├── app.js                  # 渲染、拖拽、存储、明信片、平台能力
│   └── style.css
├── publish/                    # 图标与封面（SVG 源 + PNG）
├── tests/engine.test.js
├── game-christmas-tree.zip
└── README.md
```

## 开发与校验

```bash
node game-christmas-tree/tests/engine.test.js
node --check game-christmas-tree/dist/data.js
node --check game-christmas-tree/dist/engine.js
node --check game-christmas-tree/dist/app.js

node "$HOME/.claude/skills/minitool-zip-builder/scripts/audit_artifact.mjs" game-christmas-tree/dist
python3 "$HOME/.claude/skills/minitool-zip-builder/scripts/audit_artifact.py" game-christmas-tree/dist

python3 scripts/package.py game-christmas-tree/dist game-christmas-tree/game-christmas-tree.zip
node "$HOME/.claude/skills/minitool-zip-builder/scripts/audit_artifact.mjs" game-christmas-tree/game-christmas-tree.zip
python3 "$HOME/.claude/skills/minitool-zip-builder/scripts/audit_artifact.py" game-christmas-tree/game-christmas-tree.zip
```

## 平台能力

| 能力 | 用途 | 降级 |
| --- | --- | --- |
| `saveImageToPhotosAlbum` | 保存明信片 | 隐藏按钮，提示截图 |
| `share` | 分享明信片（仅全屏） | 隐藏按钮；15502/15503 有专门提示 |
| `postNote` | 发布笔记 | 隐藏按钮 |
| `setStorage` / `getStorage` | 保存战绩、音效开关与未完成草稿 | 不落盘，仅本次有效 |
| `vibrateShort` | 放置反馈（9.50+） | 静默跳过 |
| Web Audio | 放置 / 完成音效，程序化合成 | 不支持的容器静默降级 |

不使用 `localStorage`、`indexedDB`、Cookie、`fetch`、XHR、外链资源与内联脚本。

## 明信片

- Canvas 900×1200，JPEG 质量 0.9，单张约 80–120 KB。
- 画布按与页面相同的树形和挂点坐标绘制，颜色 / 位置与页面一致。

## 验证边界

- Node 单元测试与 Headless Chrome 冒烟测试只能发现逻辑和运行时错误，**不能替代平台验收**。
- 最终需在创服平台模拟器、Android 真机和 iOS 真机扫码验证：
  - 拖拽 / 点选两种放置方式
  - 真机相册保存权限与分享面板
  - Web Audio 首次手势解锁与静音开关
  - 存储恢复（返回首页 → 重新打开 → 继续上次装饰）
- Chrome 61 / Android 兼容性以静态检查为准，真机未实测时需要注明。

## 发布信息

- appId：`6aff0bb7261c1b0015ec094e`
- 版本：`1.0.0`
- 状态：已送审，审核中（2026-11-19）
- 名称：圣诞装饰树
- 简介：装饰你的圣诞树
- 类目：`casual_game`
- 权限：`photos`（保存明信片）
- 已送审 ZIP SHA-256：`7addc132bb924094dfae7271671043ffa94e989776275e496c7183f9c32bc1fb`
- 已送审代码包 fileId：`red_app/DvqbSyLxmh8D57yAntkoJT562mXqqTHXEciIQlKvk13rCYU.zip`
- 图标：`publish/icon-512.png`（512×512），fileId `red_skill_tool_image/KB_txyhpEMMbZfgcLDQgI1g0kOdPhqvBq0s-qUxYrevmWnI.png`
- 封面：`publish/cover-900x1200.png`（900×1200），fileId `red_skill_tool_image/M53mMAVlZPzbhZvoVKEz7_VcQAthmbJMAfspbtULPr04-Kc.png`
- 操作记录：`~/.local/state/redapp-cli/game-christmas-tree/2026-11-19-upload-preview/session.json`
