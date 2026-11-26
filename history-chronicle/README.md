# 双线编年史

把中国与西方的历史放在同一时间轴上对照阅读：编年体看“何时发生”，纪传体讲“为什么值得记住”。

## 功能

- **编年体**：中国 / 西方双栏时间轴，从神话创世、夏商西周、东周秦汉，到《旧约》族长、出埃及、希腊罗马与《新约》。
- **纪传体**：30 则人物与故事，含正文、关键节点、史料与边界说明，并可跳回对应时间节点。
- **筛选与搜索**：按时代筛选、按中国/西方筛选、搜索人物/事件/年代/关键词；可关闭“包含神话传说”，只看传说与信史节点。
- **阅读说明**：单独说明神话、传说、传统记载、考古信史与圣经叙事的边界，避免把不同性质的文本混为一谈。

## 内容结构

| 时代 | 时间范围 | 节点数 |
| --- | --- | --- |
| 神话与创世 | 无确切年代 | 3 |
| 夏商西周 | 约前2070—前771 | 5 |
| 东周：春秋战国 | 前770—前221 | 5 |
| 秦汉 | 前221—220 | 8 |

- 时间节点 21 个，左右两侧分别叙述中国与西方。
- 纪传故事 30 则：中国 16 则、西方 14 则。
- 所有节点与故事均为本地静态数据，无外部链接与网络请求。

## 实现

```text
history-chronicle/
├── dist/
│   ├── index.html
│   ├── data.js       # 时代、时间节点、纪传故事
│   ├── engine.js     # 排序、筛选、搜索、关联查询
│   ├── app.js        # 视图切换、时间轴、故事卡与详情
│   └── style.css
├── publish/
│   ├── icon-512.png / icon-512.svg
│   └── cover-900x1200.png / cover-900x1200.svg
├── tests/engine.test.js
├── history-chronicle.zip
└── README.md
```

- 入口为唯一 `index.html`；脚本全部外置为经典 `<script src>`，无内联脚本、无行内事件、无 `eval` / `new Function`。
- 不调用 `window.xhs.miniTool` 的任何能力，不依赖 Storage、相机、相册或分享接口。
- 样式按 Chrome 61 基线编写，未使用 `gap`、`clamp()`、`aspect-ratio` 等新特性。

## 校验

```bash
node history-chronicle/tests/engine.test.js
node --check history-chronicle/dist/data.js
node --check history-chronicle/dist/engine.js
node --check history-chronicle/dist/app.js

python3 scripts/package.py history-chronicle/dist history-chronicle/history-chronicle.zip

node "$HOME/.claude/skills/minitool-zip-builder/scripts/audit_artifact.mjs" history-chronicle/dist
node "$HOME/.claude/skills/minitool-zip-builder/scripts/audit_artifact.mjs" history-chronicle/history-chronicle.zip
python3 "$HOME/.claude/skills/minitool-zip-builder/scripts/audit_artifact.py" history-chronicle/history-chronicle.zip
```

## 内容边界

- 中国上古部分区分神话、传说、传统记载与考古信史；夏朝与二里头的关系、西方早期年代与出埃及的具体年代，学界均有争议。
- 《旧约》《新约》故事按宗教文本叙述呈现，同时标注历史背景与争议，不把宗教叙事直接等同于现代史学结论。
- 内容为通识性整理，不作为学术引用依据；正式送审前建议逐条人工复核年代、人物与出处。

## 已知限制

- 时间轴以世纪级对齐为主，左右事件可能相隔数十年。
- 未接入平台分享、收藏或成绩卡能力，纯阅读型工具。
- 已上传并生成预览，未送审；尚未做平台模拟器与真机验证。
