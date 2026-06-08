# Douyin Capture Pro

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> **Fork 声明**：本项目基于 [lyxdream/obsidian-douyin-capture](https://github.com/lyxdream/obsidian-douyin-capture) 修改，原代码地址：https://github.com/lyxdream/obsidian-douyin-capture

**Language / 语言:** [English](#english) · [中文](#chinese)

---

<h2 id="english">English</h2>

> **Fork Note**: This project is forked from [lyxdream/obsidian-douyin-capture](https://github.com/lyxdream/obsidian-douyin-capture). Original repository: https://github.com/lyxdream/obsidian-douyin-capture

Import Douyin (TikTok China) share links or pasted share text into your Obsidian vault. Download no-watermark videos, carousel images, and captions, then create structured notes with titles, hashtags, tags, and frontmatter. Video posts can be transcribed to Simplified Chinese with a local Whisper backend. All media stays on your machine.

> **Required:** This plugin depends on the local Python service [obsidian-content-capture-backend](https://github.com/lyxdream/obsidian-content-capture-backend). Install and run it before using the plugin. Nothing is sent to a cloud service.

### Features

| Capability | Description |
|------------|-------------|
| Video posts | No-watermark video download, local Whisper transcription, embedded `video.mp4` in notes |
| Image posts | Download all images plus caption text from `desc` (no Whisper needed) |
| Two import modes | **Extract caption** (full pipeline) / **Extract video only** (download video, skip transcription) |
| Note structure | Title separated from `#hashtags`, tag callout block, frontmatter metadata |
| Privacy | No Douyin cookie required, no paid speech API, data stays local |
| Resilience | Notes are still created when captions succeed but video or some images fail to import |

Supported link formats: `v.douyin.com` short links, `www.douyin.com/note|video`, `iesdouyin.com/share/...`, or pasted share text containing a link.

### Requirements

| Component | Requirement |
|-----------|-------------|
| Obsidian | **Desktop** 1.4.0+ (mobile not supported) |
| Local backend | [obsidian-content-capture-backend](https://github.com/lyxdream/obsidian-content-capture-backend) |
| Python | 3.10+ (backend) |
| FFmpeg | Required for **video transcription** only (`brew install ffmpeg`, etc.) |
| Network | Internet needed to download Douyin assets and the first Whisper model |

Default backend URL: `http://127.0.0.1:5050`

### Quick start

#### 1. Start the local backend

```bash
git clone https://github.com/lyxdream/obsidian-content-capture-backend.git
cd obsidian-content-capture-backend

python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# macOS — video transcription
brew install ffmpeg

python web/app.py
# Optional: open http://127.0.0.1:5050 in a browser for testing
```

Keep the terminal running. The plugin cannot extract content after the backend stops.

#### 2. Install this plugin

**From Releases (recommended)**

1. Open [Releases](https://github.com/lyxdream/obsidian-douyin-capture/releases) and download the build for your version (`main.js`, `manifest.json`, `styles.css`).
2. Extract into your vault:

   ```
   <Your Vault>/.obsidian/plugins/douyin-capture/
   ├── main.js
   ├── manifest.json
   ├── styles.css
   └── versions.json   # if included
   ```

3. Obsidian → **Settings → Community plugins** → turn off Restricted mode → enable **Douyin Capture**.

**From the community catalog**

Settings → Community plugins → Browse → search **Douyin Capture** → Install → Enable.

**Build from source**

```bash
git clone https://github.com/lyxdream/obsidian-douyin-capture.git
cd obsidian-douyin-capture
npm install
npm run build
```

Copy the plugin folder (including generated `main.js`) into `.obsidian/plugins/douyin-capture/`, or symlink it during development.

#### 3. Configure the plugin

**Settings → Douyin Capture**

| Option | Default | Description |
|--------|---------|-------------|
| Backend URL | `http://127.0.0.1:5050` | Must match `web/app.py` |
| Whisper model | `small` | Affects video transcription in **Extract caption** only |
| Note folder | `Douyin` | Relative to vault root |
| Attachment folder | `attachments/douyin` | Where videos and images are stored |
| Embed video | On | When off, notes keep a link instead of `![[video]]` |
| Open note after create | On | Open the new note when import finishes |

The settings page shows backend status (connected / disconnected).

### Usage

**Ribbon icon** — Click the camera icon in the left ribbon to open the **import douyin** modal.

**Modal actions**

1. Paste a Douyin share link or full share text.
2. Choose:
   - **Extract caption** — full pipeline (Whisper for videos; images + caption for image posts)
   - **Extract video** — download no-watermark video only, **no transcription**
   - **Cancel** — close the modal

Progress steps are shown during extraction (health check → parse/download → write to vault).

**Command palette**

| Command | Description |
|---------|-------------|
| Douyin Capture: Create note from URL | Open the import modal |
| Douyin Capture: Create note from clipboard | Read link from clipboard (full caption extract) |
| Douyin Capture: Check backend connection | Test `GET /api/health` |

**Generated notes**

- **Path:** `Douyin/2026-06-04-author-title-slug.md`
- **Body:** level-1 title, hashtag callout, video/images, `## Caption`
- **Frontmatter:** `type`, `content_type`, `douyin_id`, `author`, `source`, `tags`, etc.

See [`docs/obsidian-plugin-contract.md`](docs/obsidian-plugin-contract.md) for field details and fallback templates.

### Architecture

```
┌─────────────────┐     HTTP (localhost)     ┌──────────────────────────────┐
│  Obsidian       │  POST /api/video/extract │  obsidian-content-capture-   │
│  Douyin Capture │ ───────────────────────► │  backend (Python + Flask)    │
│  plugin         │ ◄─────────────────────── │  parse / download / Whisper  │
└────────┬────────┘                          └──────────────────────────────┘
         │ copy media + write .md
         ▼
┌─────────────────┐
│  Vault          │
│  Douyin/*.md    │
│  attachments/…  │
└─────────────────┘
```

The plugin calls the API, copies media from `output/` into the vault, and renders Markdown. Core extraction runs in the backend.

### FAQ

| Issue | What to do |
|-------|------------|
| Cannot connect to local service | Ensure `python web/app.py` is running; check backend URL and port in settings |
| UI unchanged after reload | `Cmd+P` → **Reload app without saving**, or disable and re-enable the plugin |
| Video extract is slow | Local Whisper transcription is expected; try a smaller model (`tiny` / `base`) or **Extract video** first |
| Old note format | Existing notes are not updated; re-import the link |
| Text only in images | No OCR yet — only images and `desc` caption are saved |
| `main.js` missing | Run `npm run build`, or download a Release build |

### Development

```bash
npm install
npm run dev      # watch build
npm run build    # production → main.js
```

| Path | Role |
|------|------|
| `src/main.ts` | Plugin entry, commands, extract flow |
| `src/modal.ts` | Import modal UI |
| `src/vaultWriter.ts` | Note and attachment writes |
| `src/backend.ts` | Backend HTTP client |
| `docs/obsidian-plugin-contract.md` | Plugin behavior and API contract |

Backend development: [obsidian-content-capture-backend](https://github.com/lyxdream/obsidian-content-capture-backend).

### License and disclaimer

This project is licensed under [MIT](LICENSE).

Douyin content and platform rules belong to the platform. Use this tool for **personal learning and research** only. Do not use it for copyright infringement or terms-of-service violations. The author is not responsible for consequences of using this tool.

---

<h2 id="chinese">中文</h2>

> **Fork 声明**：本项目基于 [lyxdream/obsidian-douyin-capture](https://github.com/lyxdream/obsidian-douyin-capture) 修改，原代码地址：https://github.com/lyxdream/obsidian-douyin-capture

将抖音分享链接一键导入 Obsidian：在本地提取**视频 / 配图 / 文案**，自动生成结构化笔记。

> **重要**：本插件依赖本地 Python 后端 [obsidian-content-capture-backend](https://github.com/lyxdream/obsidian-content-capture-backend)，不会在云端处理你的链接或媒体。请先安装并启动后端，再使用插件。

### 功能亮点

| 能力 | 说明 |
|------|------|
| 视频作品 | 无水印视频下载、本地 Whisper 转写简体文案、笔记内嵌入 `video.mp4` |
| 图文作品 | 下载全部配图 + `desc` 配文（无需 Whisper） |
| 两种导入方式 | **提取文案**（完整流水线） / **提取视频**（仅下载视频，不转写） |
| 笔记结构 | 标题与 `#话题` 分离、标签引用块、frontmatter 元数据 |
| 隐私 | 无需抖音 Cookie、无需付费语音 API，数据留在本机 |
| 容错 | 文案成功但视频/部分配图导入失败时，仍会创建笔记并给出降级说明 |

支持的链接形式：`v.douyin.com` 短链、`www.douyin.com/note|video`、`iesdouyin.com/share/...`，或直接粘贴整段分享文案。

### 环境要求

| 组件 | 要求 |
|------|------|
| Obsidian | **桌面版** 1.4.0+（不支持移动端） |
| 本地后端 | [obsidian-content-capture-backend](https://github.com/lyxdream/obsidian-content-capture-backend) |
| Python | 3.10+（后端） |
| FFmpeg | 仅**视频转写**需要（`brew install ffmpeg` 等） |
| 网络 | 首次 Whisper 需下载模型；解析/下载抖音资源需联网 |

默认后端地址：`http://127.0.0.1:5050`

### 快速开始

#### 1. 启动本地后端

```bash
git clone https://github.com/lyxdream/obsidian-content-capture-backend.git
cd obsidian-content-capture-backend

python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# macOS 视频转写需要
brew install ffmpeg

python web/app.py
# 浏览器可打开 http://127.0.0.1:5050 做联调
```

终端保持运行；关闭后插件将无法提取。

#### 2. 安装本插件

**方式 A：从 Release 安装（推荐）**

1. 打开 [Releases](https://github.com/lyxdream/obsidian-douyin-capture/releases)，下载对应版本（需包含 `main.js`、`manifest.json`、`styles.css`）。
2. 解压到库目录：

   ```
   <你的 Vault>/.obsidian/plugins/douyin-capture/
   ├── main.js
   ├── manifest.json
   ├── styles.css
   └── versions.json   # 若有
   ```

3. Obsidian → **设置 → 第三方插件 → 关闭安全模式 → 启用「Douyin Capture」**。

**方式 B：社区插件市场**

设置 → 第三方插件 → 浏览 → 搜索 **Douyin Capture** → 安装 → 启用。

**方式 C：手动构建**

```bash
git clone https://github.com/lyxdream/obsidian-douyin-capture.git
cd obsidian-douyin-capture
npm install
npm run build
```

将**整个插件目录**（含生成的 `main.js`）放入 `.obsidian/plugins/douyin-capture/`，或在开发时用符号链接指向该目录。

#### 3. 配置插件

**设置 → Douyin Capture**：

| 选项 | 默认 | 说明 |
|------|------|------|
| 后端地址 | `http://127.0.0.1:5050` | 与 `web/app.py` 一致 |
| Whisper 模型 | `small` | 仅影响「提取文案」中的视频转写；越大越慢越准 |
| 笔记文件夹 | `Douyin` | 相对 Vault 根目录 |
| 附件文件夹 | `attachments/douyin` | 视频/图片存放位置 |
| 嵌入视频 | 开启 | 关闭则笔记内仅保留链接 |
| 创建后打开笔记 | 开启 | 完成后自动打开新笔记 |

页面顶部会显示后端连接状态（● 已连接 / ● 未连接）。

### 使用说明

**侧边栏** — 点击左侧 Ribbon 的**摄像机图标**，打开 **import douyin** 弹窗。

**弹窗操作**

1. 粘贴抖音分享链接或整段分享文案
2. 选择：
   - **提取文案**：完整流程（视频含 Whisper 转写，图文含配图与配文）
   - **提取视频**：仅下载无水印视频并写入笔记，**不进行转写**（适合先存视频、稍后再转写）
   - **取消**：关闭弹窗

提取过程中会显示步骤进度（检查服务 → 解析/下载 → 写入 Vault）。

**命令面板**

| 命令 | 说明 |
|------|------|
| Douyin Capture：从抖音链接创建笔记 | 打开导入弹窗 |
| Douyin Capture：从剪贴板创建笔记 | 读取剪贴板中的链接（完整提取文案） |
| Douyin Capture：检查后端连接 | 测试 `GET /api/health` |

**生成的笔记示例**

- **路径**：`Douyin/2026-06-04-作者-标题摘要.md`
- **正文**：一级标题 + 话题标签引用块 + 视频/配图 + `## 文案`
- **Frontmatter**：`type`、`content_type`、`douyin_id`、`author`、`source`、`tags` 等

详细字段与失败降级模板见 [`docs/obsidian-plugin-contract.md`](docs/obsidian-plugin-contract.md)。

### 架构说明

```
┌─────────────────┐     HTTP (localhost)     ┌──────────────────────────────┐
│  Obsidian       │  POST /api/video/extract │  obsidian-content-capture-   │
│  Douyin Capture │ ───────────────────────► │  backend (Python + Flask)    │
│  插件           │ ◄─────────────────────── │  解析 / 下载 / Whisper       │
└────────┬────────┘                          └──────────────────────────────┘
         │ 拷贝 media + 写 .md
         ▼
┌─────────────────┐
│  Vault          │
│  Douyin/*.md    │
│  attachments/…  │
└─────────────────┘
```

插件只负责调用 API、把 `output/` 中的媒体复制进 Vault、渲染 Markdown；核心能力由后端提供。

### 常见问题

| 现象 | 处理 |
|------|------|
| 提示「无法连接本地服务」 | 确认 `python web/app.py` 在运行；检查设置中的后端地址与端口 |
| 重载插件后界面没变 | `Cmd+P` → **Reload app without saving**；或关闭再启用插件 |
| 视频提取很慢 | 本地 Whisper 转写属正常，可改用更小模型（`tiny` / `base`）或先用「提取视频」 |
| 笔记格式是旧的 | 旧笔记不会自动更新，需重新导入一条链接 |
| 图文题本在图片里 | 当前不做 OCR，仅保存图片与 `desc` 配文 |
| `main.js` 不存在 | 执行 `npm run build`，或从 Release 下载已构建包 |

### 开发

```bash
npm install
npm run dev      # 监听编译
npm run build    # 生产构建 → main.js
```

| 路径 | 说明 |
|------|------|
| `src/main.ts` | 插件入口、命令、提取流程 |
| `src/modal.ts` | 导入弹窗 UI |
| `src/vaultWriter.ts` | 笔记与附件写入 |
| `src/backend.ts` | 后端 HTTP 客户端 |
| `docs/obsidian-plugin-contract.md` | 插件行为与 API 约定 |

后端开发见 [obsidian-content-capture-backend](https://github.com/lyxdream/obsidian-content-capture-backend)。

### 发布检查清单

向 [Obsidian 社区插件目录](https://community.obsidian.md) 提交前建议确认：

- [ ] `manifest.json`：`id` = `douyin-capture`，`version` 与 Release tag 一致，`minAppVersion` 正确
- [ ] `versions.json` 含对应版本键，与 manifest 一致
- [ ] 已执行 `npm run build`，**Release 附件包含 `main.js`**
- [ ] README 含英文说明，并注明**必须安装本地后端**
- [ ] `LICENSE` 与仓库一致（MIT）
- [ ] 在全新 Vault 中手动安装测试一遍完整流程

### 许可与声明

本项目采用 [MIT](LICENSE) 许可。

抖音内容与平台规则归原平台所有。请仅将本工具用于**个人学习与研究**，勿用于侵权或违反平台条款的用途。作者不对使用本工具产生的后果承担责任。
