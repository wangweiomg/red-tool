# 北京徒步指南

首期只做北京：10 条山野与水景路线，按难度排序。列表只显示名称、难度、里程/爬升/耗时和一句核心亮点；点开路线再看起点、亮点和提示，并可生成路线分享卡。

## 路线

| 难度 | 路线 | 里程 / 爬升 | 用时 | 核心亮点 | 亲子 |
| --- | --- | --- | --- | --- | --- |
| 轻松 | 百望山森林公园 | 3—5 km / 约 200 m | 1.5—2.5 h | 离城近，缓坡看城市天际线 | ✅ |
| 入门 | 玉渡山 | 4—6 km / 约 360 m | 2—4 h | 高山草甸与溪流，亲子轻松 | ✅ |
| 入门 | 神堂峪木栈道 | 7—8 km / 约 260 m | 3—4 h | 沿溪木栈道，亲子亲水 | ✅ |
| 入门 | 青龙峡 | 5—8 km / 300—500 m | 3—5 h | 水库峡谷，亲子戏水 | ✅ |
| 入门 | 黄花城水长城 | 5—9 km / 300—500 m | 3—5 h | 长城入水，山水同框 | ✅ |
| 进阶 | 凤凰岭 | 8—12 km / 500—700 m | 4—6 h | 奇石山脊，路线成熟 | — |
| 进阶 | 百花山 | 10—15 km / 700—1000 m | 5—7 h | 高山草甸，夏季花海 | — |
| 进阶 | 香八拉（香山—八大处） | 12—15 km / 约 750 m | 4—6 h | 经典拉练线，土路与防火道 | — |
| 挑战 | 云蒙山（桃源仙谷—云蒙峡） | 10—20 km / 500—1000 m | 5—8 h | 峡谷溪水，乱石路段 | — |
| 挑战 | 东灵山 | 9—16 km / 800—950 m | 5—7 h | 北京最高峰，高山草甸 | — |

## 功能

- **紧凑列表**：一屏可以看到多条路线，只保留必要信息。
- **难度 + 亲子筛选**：全部 / 亲子 / 轻松 / 进阶 / 挑战。
- **详情页**：点开路线后展示路线特点、起点、亮点和实用提示。
- **路线分享卡**：详情页可生成 900×1200 分享图，支持保存相册、分享图片、发布笔记；不支持时隐藏入口并提示。
- **纯离线**：所有内容内置，无外部链接、无网络请求、不调用平台能力（分享除外）。

## 分享图

- Canvas 2D 程序化绘制，无外部图片。
- 卡片包含：路线名、难度、里程/爬升/耗时、核心亮点、三条路线亮点、品牌落款。
- 保存：`saveImageToPhotosAlbum`（9.42+）。
- 分享：`share`（9.53+，仅全屏容器，约 10 次/人/工具/天）。
- 发布笔记：`postNote` + `photo_publish`，图片为本地 data URI。
- 所有入口先做方法存在性检测；失败时提示改用保存图片。

## 实现

```text
city-hiking-guide/
├── dist/
│   ├── index.html
│   ├── data.js       # 北京 10 条路线
│   ├── engine.js     # 排序、难度/亲子筛选
│   ├── app.js        # 紧凑列表、详情页与分享卡
│   └── style.css
├── publish/
│   ├── icon-512.png / icon-512.svg
│   └── cover-900x1200.png / cover-900x1200.svg
├── tests/engine.test.js
├── city-hiking-guide.zip
└── README.md
```

- 入口为唯一 `index.html`；脚本全部外置为经典 `<script src>`，无内联脚本、无行内事件、无 `eval` / `new Function`。
- 分享只使用 `window.xhs.miniTool` 的 `saveImageToPhotosAlbum` / `share` / `postNote`，并做方法存在性检测。
- 样式按 Chrome 61 基线编写，未使用 `gap`、`clamp()`、`aspect-ratio` 等新特性。

## 校验

```bash
node city-hiking-guide/tests/engine.test.js
node --check city-hiking-guide/dist/data.js
node --check city-hiking-guide/dist/engine.js
node --check city-hiking-guide/dist/app.js

python3 scripts/package.py city-hiking-guide/dist city-hiking-guide/city-hiking-guide.zip

node "$HOME/.claude/skills/minitool-zip-builder/scripts/audit_artifact.mjs" city-hiking-guide/dist
node "$HOME/.claude/skills/minitool-zip-builder/scripts/audit_artifact.mjs" city-hiking-guide/city-hiking-guide.zip
python3 "$HOME/.claude/skills/minitool-zip-builder/scripts/audit_artifact.py" city-hiking-guide/city-hiking-guide.zip
```

## 内容边界

- 里程、爬升和用时为常见走法的约数，不同起点、绕行和景区开放情况会有差异。
- 出发前确认当地防火封山、景区预约、天气和交通信息。
- 野山、野长城等路线需结伴并具备相应经验；不要擅自进入封闭区域。
- 内容为通识性整理，不替代当地向导、救援和官方公告。

## 已知限制

- 首期只做北京 10 条路线；其他城市后续再扩充。
- 未接入地图导航、轨迹下载或天气能力。
- 分享图入口依赖平台客户端版本；不支持时只保留截图/保存提示。
- 北京 10 条路线 + 亲子筛选 + 分享卡已送审，审核中；上一版 5 条预览已作废。
