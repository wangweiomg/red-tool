# 英语跟读实验室

旅行口语跟读练习：听一遍示范 → 自己读一遍 → 听自己的录音。

## 功能

- **场景对话**：当前有「海关」和「酒店入住」两个场景，每个场景 8 句、包含问与答；每句带角色标签（海关关员 / 旅客、前台 / 住客）、IPA、发音提示和中文意思。
- **背单词**：12 个旅行高频词（passport、luggage、reservation、breakfast、checkout、vacation、destination、boarding、receipt、terminal、declare、currency）。
- **示范朗读**：调用设备系统语音（`speechSynthesis`）朗读当前句子；设备没有英文音色时会提示并可只做录音对比。
- **录音与回放**：`getUserMedia` + `MediaRecorder` 录音，Web Audio `decodeAudioData` 在本机解码回放；支持「听我的」和「对比播放（示范 → 我的）」。
- **练习统计**：今日练习、累计练习次数，使用容器 Storage 保存在本地。
- **隐私**：录音只在内存中处理，不上传、不保存音频文件。

## 目录

```text
english-shadowing/
├── dist/
│   ├── index.html
│   ├── data.js        # 单词 + 场景对话数据
│   ├── app.js         # 模式切换、录音、回放、示范朗读、统计
│   └── style.css
├── publish/           # 图标、封面（SVG 源 + PNG）
├── tests/data.test.js
├── english-shadowing.zip
└── README.md
```

## 开发与校验

```bash
node english-shadowing/tests/data.test.js
node --check english-shadowing/dist/data.js
node --check english-shadowing/dist/app.js

node "$HOME/.claude/skills/minitool-zip-builder/scripts/audit_artifact.mjs" english-shadowing/dist
python3 "$HOME/.claude/skills/minitool-zip-builder/scripts/audit_artifact.py" english-shadowing/dist

python3 scripts/package.py english-shadowing/dist english-shadowing/english-shadowing.zip
node "$HOME/.claude/skills/minitool-zip-builder/scripts/audit_artifact.mjs" english-shadowing/english-shadowing.zip
python3 "$HOME/.claude/skills/minitool-zip-builder/scripts/audit_artifact.py" english-shadowing/english-shadowing.zip
```

## 平台能力

| 能力 | 用途 | 降级 |
| --- | --- | --- |
| `getUserMedia` + `MediaRecorder` | 录音 | 权限拒绝 / 不支持时给出中文提示 |
| Web Audio | 录音解码与回放、波形 | 上下文失效时重建并重试 |
| `speechSynthesis` | 示范朗读 | 无音色时提示「可直接录音对比」 |
| `setStorage` / `getStorage` | 练习次数 | 不支持时不落盘，仅本次有效 |

不使用 `localStorage`、`indexedDB`、Cookie、网络请求、外链资源与内联脚本。

## 已知限制

- 平台没有语音识别/发音评测能力，**不做准确度打分**；反馈来自回放对比、音量、时长和波形。
- 示范朗读依赖设备系统语音；没有英文音色的设备只能录音对比。
- 录音不保存、可回放但页面关闭后丢失；统计只记录练习次数。
- iOS 上播放音频后申请麦克风可能触发 `AudioSession` 类别问题，已用 `navigator.audioSession.type = 'play-and-record'` 与重建上下文重试处理；容器未暴露该接口时可能仍受宿主限制。

## 验证边界

- Node 单元测试与 Headless Chrome 冒烟测试只能发现逻辑和运行时错误，**不能替代平台验收**。
- 最终需在创服平台模拟器、Android 真机和 iOS 真机扫码验证：
  - 麦克风授权与连续多次录音（包含切换场景、切换模式、播放示范后录音）
  - 录音回放、对比播放
  - 系统示范朗读是否有英文音色
  - 练习统计的保存与恢复
- Chrome 61 / Android 兼容性以静态检查为准，真机未实测时需要注明。

## 发布信息（待上传）

- 名称：英语跟读实验室
- 简介：听一遍，读一遍，听自己
- 建议类目：`learning_education`
- 建议权限：`microphone`
- 版本：`1.0.0`
- 图标：`publish/icon-512.png`（512×512）
- 封面：`publish/cover-900x1200.png`（900×1200）
