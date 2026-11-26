# 头像壁纸工坊（原型 0.1.1）

一张照片，换个头像和壁纸。选模板 → 选照片 → 拖动/缩放 → 保存、分享或发布笔记。所有模板由 Canvas 程序化绘制，离线可用。

## 功能

- **头像框**：奶油花环、金边、霓虹、冬日，4 个圆形头像框。
- **壁纸**：奶油晨光、夜航星、海盐、柑橘，4 个 1080×1920 壁纸主题，带插画装饰和文案。
- **选图**：`<input type="file">` 选择本地图片；照片只在本机 Canvas 处理，不上传。
- **调整**：在预览上拖动照片，滑杆缩放 1–2 倍，自动限制在画面范围内。
- **输出**：头像 800×800、壁纸 1080×1920，JPEG 质量 0.92；支持保存相册、分享图片、发布笔记，均做能力检测与失败提示。
- **声音**：切换模板/模式、载入照片、重置、保存/分享有音效；背景音乐是贝多芬《致爱丽丝》改编的舒缓循环（Web Audio 合成，默认关）；开关保存在本地。

## 目录

```text
photo-studio/
├── dist/
│   ├── index.html
│   ├── data.js        # 模板与配色
│   ├── engine.js      # cover 适配与偏移限制（纯逻辑）
│   ├── app.js         # Canvas 绘制、选图、拖动、保存/分享
│   └── style.css
├── tests/engine.test.js
├── photo-studio.zip
└── README.md
```

## 校验

```bash
node photo-studio/tests/engine.test.js
node --check photo-studio/dist/data.js
node --check photo-studio/dist/engine.js
node --check photo-studio/dist/app.js
python3 scripts/package.py photo-studio/dist photo-studio/photo-studio.zip
```

## 已知限制

- 原型没有双指缩放，用滑杆代替；没有旋转/翻转照片。
- 部分老 WebView 不自动处理 EXIF 方向，手机照片可能横竖不对；正式版需要读取 EXIF 或提示用户。
- 模板为程序化插画，不是可替换的美术素材；正式版建议补一套统一风格的模板。
- 没有保存草稿/历史记录；刷新后需重新选图。
- 未上传平台，尚未在创服模拟器和真机验证。
