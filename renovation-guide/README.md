# 装修流程手册

面向首次装修和旧房改造的决策工具：10 个装修阶段、30 条材料百科、5 个空间攻略、新一线预算评估器、12 道专业避坑自测。

## 内容

- **流程（10 个阶段）**：开工准备 → 拆改 → 水电 → 防水 → 泥瓦 → 木工/定制 → 油漆 → 安装 → 软装 → 入住前验收与通风。每阶段含要做什么、谁负责、参考工期、验收点、常见坑；可切换「新房 / 老房改造」，老房显示额外注意事项。
- **材料（30 条）**：墙面 5、地面 5、水电 4、厨卫 5、板材木作 4、门窗五金 3、灯具辅料 4。每条含适用空间、关键指标、环保等级、新一线参考价、选购要点、常见坑。
- **空间（5 个）**：厨房、卫生间、阳台、卧室、客厅，列出关键处理与容易忽略的细节。
- **预算评估**：输入面积、选择简装/中档/品质，可勾选老房翻新；输出总价区间与水电/泥瓦/木作/油漆/主材/其他分项区间。
- **避坑自测（12 题）**：防水、闭水、线径、打压、空鼓、板材等级、乳胶漆、等电位、烟道止逆阀、门窗、地漏、入住检测；答完给解析与成绩卡，可保存/分享/发布笔记。
- **进度**：勾选阶段完成，进度自动保存在容器 Storage。

## 目录

```text
renovation-guide/
├── dist/
│   ├── index.html
│   ├── data.js        # 阶段、材料、空间、预算、自测题
│   ├── engine.js      # 预算、计分、进度（纯逻辑）
│   ├── app.js         # 导航、渲染、存储、成绩卡
│   └── style.css
├── tests/engine.test.js
├── renovation-guide.zip
├── CONTENT-OUTLINE.md
└── README.md
```

## 校验

```bash
node renovation-guide/tests/engine.test.js
node --check renovation-guide/dist/data.js
node --check renovation-guide/dist/engine.js
node --check renovation-guide/dist/app.js
python3 scripts/package.py renovation-guide/dist renovation-guide/renovation-guide.zip
```

## 内容边界

- 价格为新一线城市参考区间，随品牌、规格、施工方式波动。
- 环保等级以产品检测报告为准；空气检测以专业机构结果为准。
- 涉及承重结构、燃气、水电、消防的改动，必须由物业和持证专业人员确认；本工具提供通用经验，不替代当地规范。
- 预算估算不含地区差异、拆改大项、中央空调、地暖、定制家具与家电。

## 平台能力

- `setStorage` / `getStorage`：保存流程进度、预算输入与自测成绩。
- `saveImageToPhotosAlbum` / `share` / `postNote`：成绩卡保存、分享与发布笔记，均做方法存在性检测和失败降级。
- 无网络请求、无外链资源、无内联脚本。
