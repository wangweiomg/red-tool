# 西方神话与圣史

以西方神话、圣经叙事与宗教史为主题，按时间顺序讲述三十三件大事：从巴比伦创世史诗、埃及太阳神、希腊众神与北欧诸神黄昏，到亚当夏娃、出埃及、大卫与所罗门；从耶稣、保罗、尼西亚公会议，到十字军、路德与梵二会议。

## 功能

- **大事长卷**：按四个时代分组，逐则展开；每件大事含摘要、正文、关键节点、史料来源与阅读边界。
- **筛选与搜索**：按时代筛选、按“神话 / 圣经 / 宗教史”筛选，搜索神祇、人物、事件或年代。
- **逐则阅读**：详情页支持上一件 / 下一件连续阅读，并显示当前位置。
- **阅读说明**：单独解释神话、圣经叙事与历史研究的边界，避免把不同性质的材料混为一谈。

## 内容结构

| 时代 | 时间范围 | 大事数 |
| --- | --- | --- |
| 神话时代 | 无确切年代—约前8世纪 | 8 |
| 旧约时代 | 传统约前2000—前1世纪 | 9 |
| 新约与早期教会 | 1世纪—5世纪 | 8 |
| 中世纪与宗教改革 | 5世纪—20世纪 | 8 |

按文本类型：神话 7 件、圣经 12 件、宗教史 14 件。

代表性大事：

- 神话：奥西里斯与荷鲁斯、拉神与阿吞改革、《埃努玛·埃利什》、吉尔伽美什、特洛伊战争、罗马建城、赫西俄德《神谱》、北欧诸神黄昏。
- 旧约：创世与亚当夏娃、诺亚方舟、巴别塔、亚伯拉罕之约、出埃及、西奈山十诫、大卫与歌利亚、所罗门圣殿、巴比伦之囚。
- 新约与早期教会：耶稣降生、受洗与传道、钉十字架、复活与五旬节、保罗传教、尼禄迫害、圣殿被毁、尼西亚公会议。
- 中世纪与改革：奥古斯丁《上帝之城》、西罗马灭亡、东西教会大分裂、十字军、宗教裁判所、路德九十五条论纲、特伦托会议、梵二会议。

## 实现

```text
west-myth-history/
├── dist/
│   ├── index.html
│   ├── data.js       # 时代与 33 件大事
│   ├── engine.js     # 排序、筛选、搜索、前后导航
│   ├── app.js        # 长卷、详情与说明页
│   └── style.css
├── publish/
│   ├── icon-512.png / icon-512.svg
│   └── cover-900x1200.png / cover-900x1200.svg
├── tests/engine.test.js
├── west-myth-history.zip
└── README.md
```

- 入口为唯一 `index.html`；脚本全部外置为经典 `<script src>`，无内联脚本、无行内事件、无 `eval` / `new Function`。
- 不调用 `window.xhs.miniTool` 的任何能力，不依赖 Storage、相机、相册或分享接口。
- 样式按 Chrome 61 基线编写，未使用 `gap`、`clamp()`、`aspect-ratio` 等新特性。

## 校验

```bash
node west-myth-history/tests/engine.test.js
node --check west-myth-history/dist/data.js
node --check west-myth-history/dist/engine.js
node --check west-myth-history/dist/app.js

python3 scripts/package.py west-myth-history/dist west-myth-history/west-myth-history.zip

node "$HOME/.claude/skills/minitool-zip-builder/scripts/audit_artifact.mjs" west-myth-history/dist
node "$HOME/.claude/skills/minitool-zip-builder/scripts/audit_artifact.mjs" west-myth-history/west-myth-history.zip
python3 "$HOME/.claude/skills/minitool-zip-builder/scripts/audit_artifact.py" west-myth-history/west-myth-history.zip
```

## 内容边界

- 神话部分标注文献来源与成书年代，不把神话直接当作编年史。
- 《旧约》《新约》中的超自然内容属于信仰传统，历史研究无法直接验证；工具会标注经文出处、外部史料与学界争议。
- 宗教史部分（尼西亚公会议、十字军、宗教裁判所、宗教改革等）给出大致年代与制度背景，避免单一动机或漫画化解释。
- 内容为通识性整理，不作为学术引用依据；正式送审前建议逐条复核年代、人物与出处。

## 已知限制

- 古代年代多为约数，不同版本可能相差数十年至数百年。
- 北欧神话口传远早于13世纪成书，工具将其放在神话时代末段并单独注明。
- 未接入平台分享、收藏或成绩卡能力，纯阅读型工具。
- 已上传并生成预览，未送审；尚未做平台模拟器与真机验证。
