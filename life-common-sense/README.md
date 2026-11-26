# 生活常识小考

面向日常生活场景的答题小工具：覆盖职场、社交、医院、交通、生活、法律、厨房七类常识，支持分类练习、综合挑战和错题重练。

## 功能

- **分类练习**：首页用标签选择综合或七个分类，再点“开始练习”；每组 10 题，答完立即显示对错与解析。
- **综合挑战**：20 题混合卷，七类尽量均衡，答对 16 题通过。
- **错题本**：答错自动收录，答对自动移出；支持手动移除和错题重练。
- **进度保存**：累计答题、正确率、练习组数、错题本保存在小工具 Storage；不支持 Storage 时降级为页面内数据，并给出提示。
- **纯离线**：所有题目、解析、样式与脚本均在包内，无网络请求、无外部链接。

## 题库

| 分类 | 题数 | 覆盖内容 |
| --- | --- | --- |
| 职场 | 30 | 邮件与会议、协作沟通、办公礼仪、加班与交接 |
| 社交 | 30 | 见面、聚餐、聊天、探病、群聊与个人边界 |
| 医院 | 30 | 就医流程、用药、常见急救、烫伤/扭伤/中暑等 |
| 交通 | 30 | 道路规则、骑行与乘车安全、事故处理 |
| 生活 | 30 | 居家消防、食品、饮水、网络隐私、防骗 |
| 法律 | 30 | 劳动合同、消费维权、租房、借贷、继承与日常法律 |
| 厨房 | 30 | 生熟分开、冷藏冷冻、解冻、油火、刀具与燃气安全 |

共 210 题，每题 4 个选项，附一句解析。医疗、急救与法律内容仅作常识参考，不能替代医生诊断、专业救援或律师意见。

## 实现

```text
life-common-sense/
├── dist/
│   ├── index.html
│   ├── data.js       # 七类题库与元信息
│   ├── engine.js     # 组卷、判分、错题本逻辑
│   ├── app.js        # 首页、答题、结算、错题本
│   └── style.css
├── publish/
│   ├── icon-512.png / icon-512.svg
│   └── cover-900x1200.png / cover-900x1200.svg
├── tests/engine.test.js
├── life-common-sense.zip
└── README.md
```

- 入口为唯一 `index.html`；脚本全部外置为经典 `<script src>`，无内联脚本、无行内事件、无 `eval` / `new Function`。
- 仅使用 `window.xhs.miniTool` 的 `getStorage` / `setStorage`，并做方法存在性检测；不回退到 `localStorage`。
- 样式按 Chrome 61 基线编写，未使用 `gap`、`clamp()`、`aspect-ratio` 等新特性。

## 视觉主题

米黄纸张底、陶土橙主色；首页分类用一排可选标签，选中后再开始练习，不使用大选择卡。答题反馈用橄榄绿表示正确、砖红表示错误；图标与封面采用同一暖色系。

## 校验

```bash
node life-common-sense/tests/engine.test.js
node --check life-common-sense/dist/data.js
node --check life-common-sense/dist/engine.js
node --check life-common-sense/dist/app.js

python3 scripts/package.py life-common-sense/dist life-common-sense/life-common-sense.zip

node "$HOME/.claude/skills/minitool-zip-builder/scripts/audit_artifact.mjs" life-common-sense/dist
node "$HOME/.claude/skills/minitool-zip-builder/scripts/audit_artifact.mjs" life-common-sense/life-common-sense.zip
python3 "$HOME/.claude/skills/minitool-zip-builder/scripts/audit_artifact.py" life-common-sense/life-common-sense.zip
```

## 内容边界

- 题目为通识性整理，具体劳动法规、交通规则、医疗处置与法律问题以当地法律法规、单位制度和专业人士意见为准。
- 医疗与急救题用于建立常识和求助意识，不构成诊断、用药或治疗建议。
- 正式送审前建议逐题复核答案与解析，尤其是法规、剂量、急救步骤等细节。

## 已知限制

- 未接入平台分享、排行或成绩卡能力，答题记录仅保存在本小工具 Storage。
- 七类 210 题版本已送审，审核中；上一版五类预览已作废。
