# Obsidian 插件契约（草案 v0.1）

> **文档位置**：本仓库 `docs/obsidian-plugin-contract.md`（插件侧维护）  
> 对接：`obsidian-content-capture-backend`（本地 HTTP 服务）  
> 状态：**待评审**，实现前以本文为准对齐；标注 `[待议]` 的条目可改。

---

## 1. 目标

用户粘贴抖音分享链接后，插件调用本地后端完成提取，并在 **Vault 内** 生成一篇笔记：

| 类型 | Vault 中呈现 |
|------|----------------|
| **视频** | 嵌入本地视频文件 + 简体转写文案 |
| **图文** | 展示全部配图 + `desc` 配文（无 Whisper） |

后端负责解析/下载/转写；插件负责 HTTP 调用、文件拷贝、笔记渲染与设置。

---

## 2. 前置依赖

| 项 | 要求 |
|----|------|
| Obsidian | 桌面版（需本地文件与 `requestUrl`） |
| 后端 | 已安装并启动 `obsidian-content-capture-backend` |
| 默认服务 | `http://127.0.0.1:5050` |
| 系统 | FFmpeg（视频）、Python `.venv`（后端侧） |

插件启动时调用 `GET /api/health`；失败则提示用户先运行 `python web/app.py`。

---

## 3. 插件设置（Settings）

| 键 | 类型 | 默认 | 说明 |
|----|------|------|------|
| `serverUrl` | string | `http://127.0.0.1:5050` | 后端根地址 |
| `whisperModel` | string | `small` | 传给 extract 的 `model` |
| `noteFolder` | string | `Douyin` | 笔记相对 Vault 根目录 |
| `attachmentFolder` | string | `attachments/douyin` | 媒体相对 Vault 根目录 |
| `embedVideo` | boolean | `true` | 视频是否嵌入笔记（否则仅链接） |
| `openNoteAfterCreate` | boolean | `true` | 创建后是否打开笔记 |

`[待议]` 是否在 Vault 内保留 `out_dir` 绝对路径（便于调试）。

---

## 4. 后端 API 契约

### 4.1 健康检查

```
GET /api/health
```

**200 响应（节选）：**

```json
{
  "success": true,
  "engine": "local",
  "whisper": "faster-whisper",
  "models": ["tiny", "base", "small", "medium", "large-v2", "large-v3"]
}
```

### 4.2 仅预览（可选，不写入 Vault）

```
POST /api/video/info
Content-Type: application/json

{ "url": "分享链接或整段分享文案" }
```

**200 响应（节选）：**

```json
{
  "success": true,
  "video_id": "7643014253728912576",
  "aweme_id": "7643014253728912576",
  "title": "…",
  "author": "…",
  "content_type": "video",
  "download_url": "https://…",
  "image_count": 0,
  "source_url": "https://www.iesdouyin.com/share/…"
}
```

`content_type`: `"video"` | `"image"`。

### 4.3 完整提取（插件主路径）

```
POST /api/video/extract
Content-Type: application/json

{
  "url": "分享链接或整段分享文案",
  "model": "small"
}
```

**200 响应：**

```json
{
  "success": true,
  "video_id": "7643014253728912576",
  "title": "作品标题或 desc",
  "author": "作者昵称",
  "content_type": "video",
  "download_url": "https://aweme.snssdk.com/…",
  "text": "正文文案（已去掉 transcript.txt 头信息）",
  "out_dir": "/absolute/path/to/output/{id}_{title}",
  "images": []
}
```

**图文时 `images` 示例：**

```json
"images": [
  "http://127.0.0.1:5050/files/7640…/images/01.jpg",
  "http://127.0.0.1:5050/files/7640…/images/02.jpg"
]
```

**错误响应：**

```json
{ "success": false, "error": "人类可读错误信息" }
```

HTTP 状态：`400` 参数/解析错误，`500` 流水线失败。

### 4.4 插件使用的磁盘文件（来自 `out_dir`）

后端 extract 完成后，插件从 `out_dir` **拷贝**媒体进 Vault（不长期依赖 `output/` 路径）。

| 类型 | 后端路径 | 插件用途 |
|------|----------|----------|
| 视频 | `{out_dir}/video.mp4` | 拷贝到 Vault 附件并嵌入 |
| 图文 | `{out_dir}/images/01.jpg …` | 拷贝到 Vault 附件并嵌入 |
| 元数据 | `{out_dir}/meta.json` | 可选，写入 frontmatter 补充字段 |

`[待议]` 后端是否在 JSON 中增加 `video_file: "video.mp4"`、`rel_dir`，减少插件拼路径。

---

## 5. Vault 写入契约

### 5.1 笔记路径

```
{noteFolder}/{YYYY-MM-DD}-{作者}-{标题摘要}.md
```

示例：`Douyin/2026-06-04-海龟老师-深度体验Claude-code+DeepSeekV4.md`

- 日期带连字符；作者、标题经 sanitize（空白→`-`，去非法字符）
- 标题摘要最长约 48 字；作者约 24 字
- 若文件已存在：追加后缀 `-2`、`-3` …

### 5.2 附件路径

```
{attachmentFolder}/{aweme_id}/
├── video.mp4          # 仅视频
├── 01.jpg …           # 仅图文
```

拷贝后笔记内使用 Obsidian Wiki 链接：`![[attachments/douyin/{id}/video.mp4]]`。

### 5.3 Frontmatter（YAML）

```yaml
---
type: douyin
content_type: video          # video | image
douyin_id: "7643014253728912576"
author: "作者"
source: "https://www.iesdouyin.com/share/…"
captured_at: 2026-06-04T12:00:00+08:00
whisper_model: small         # 仅视频；图文可省略
tags:
  - douyin
---
```

`[待议]` 是否增加 `download_url`、`out_dir` 字段。

### 5.4 笔记正文模板

#### 视频

```markdown
# {title}

![[{attachmentFolder}/{douyin_id}/video.mp4]]

## 文案

{text}
```

- `{text}` 来自 API 的 `text` 字段（纯正文，不含 `--- 文案 ---` 以上元数据）
- 若 `embedVideo: false`：正文改为 Markdown 链接 `[本地视频](attachments/…/video.mp4)` + 文案

#### 图文

```markdown
# {title}

## 配图

![[{attachmentFolder}/{douyin_id}/01.jpg]]
![[{attachmentFolder}/{douyin_id}/02.jpg]]
…

## 文案

{text}
```

- 图片按文件名排序；Reading 模式下竖排展示 `[待议]` 是否改为网格 HTML

---

## 6. 插件命令与流程

| 命令 | 行为 |
|------|------|
| **从抖音链接创建笔记** | 模态框输入 URL → `POST /api/video/extract` → 写 Vault |
| **从剪贴板创建笔记** | 读取剪贴板文本（含短链即可）→ 同上 |
| **检查后端连接** | `GET /api/health` → Notice 成功/失败 |

**同步流程（v0.1）：**

1. 模态框 / Notice 进入加载态（见 §7）
2. 调用 extract
3. 成功 → 拷贝媒体 → 写 `.md` → 可选打开笔记
4. 失败 → 按 §7 展示，**不写入 Vault**（部分成功策略见 §7.4）

`[待议]` v0.2 异步任务 + 进度轮询（需后端支持 `job_id`）。

---

## 7. 加载态与失败展示

所有面向用户的文案 **固定使用下表原文**（便于 i18n 时整表替换）。  
展示载体：

| 载体 | 用途 | 持续时间 |
|------|------|----------|
| **Modal** | 输入链接、阻塞式提取进度 | 用户关闭或流程结束 |
| **Notice** | 成功 / 轻量错误 | 成功 3s；错误 8s 或可点击关闭 |
| **Status Bar** | 插件加载 Obsidian 时的后端探测 | 常驻直至下次探测 |
| **笔记正文占位** | 媒体拷贝失败时的降级内容 | 写入 Vault，永久保留 |

### 7.1 加载中（Loading）

#### Modal 内（「从抖音链接创建笔记」）

| 阶段 | 主文案 | 副文案 |
|------|--------|--------|
| 检查后端 | 正在连接本地服务… | 请确认已运行 `python web/app.py` |
| 等待 extract（通用） | 正在提取内容… | 请勿关闭 Obsidian |
| 等待 extract（视频） | 正在提取视频文案… | 本地 Whisper 转写可能需要数分钟 |
| 等待 extract（图文） | 正在下载图文… | 通常几秒完成 |
| 拷贝媒体 | 正在写入 Vault… | 复制视频/图片到笔记附件 |

Modal 按钮：**取消**（v0.1 仅关闭 UI，无法中止后端 `[待议]`）。

#### Notice（非阻塞，可选）

| 场景 | 文案 |
|------|------|
| 后台健康检查 | 抖音后端：连接正常 |
| 长任务开始 | 已开始提取，完成后将自动打开笔记 |

### 7.2 失败展示（不写 Vault）

以下情况 **不创建笔记文件**。

| 编号 | 场景 | 触发条件 | Notice 标题 | 正文（用户可见） | 建议操作 |
|------|------|----------|---------------|------------------|----------|
| E01 | 后端未启动 | `GET /api/health` 网络错误 / 连接拒绝 | 无法连接本地服务 | 未检测到抖音提取后端。请在终端运行：`python web/app.py`（默认 http://127.0.0.1:5050） | 打开设置检查 `serverUrl` |
| E02 | 健康检查 HTTP 非 200 | health 返回 4xx/5xx | 本地服务异常 | 后端返回错误（{status}）。请查看运行 `web/app.py` 的终端日志。 | 重试 / 检查端口 |
| E03 | 链接为空 | 用户未输入 | 请输入链接 | 请粘贴抖音分享短链或整段分享文案。 | — |
| E04 | 剪贴板无链接 | 剪贴板命令且无 `douyin.com` | 剪贴板中无有效链接 | 未找到抖音链接。请先复制分享文案后再试。 | — |
| E05 | extract 业务失败 | `{ success: false, error }` | 提取失败 | {error}（原样展示后端 `error` 字段） | 检查链接是否有效 |
| E06 | extract HTTP 400 | 解析/参数错误 | 链接无法解析 | {error} | 换链接或改用 note/video 完整链 |
| E07 | extract HTTP 500 | 流水线异常 | 处理出错 | {error}。详情见后端终端。 | 确认 FFmpeg 已安装（视频） |
| E08 | extract 超时 | 客户端超时 `[待议]` 时长 | 请求超时 | 提取时间过长已超时。视频可能仍在后端处理，请稍后在 output 目录查看。 | 增大超时或查 output |
| E09 | 响应 JSON 无效 | 解析失败 | 服务响应异常 | 后端返回了无法识别的数据，请升级插件与后端到匹配版本。 | — |
| E10 | 文案为空 | `success` 但 `text` 为空且非图文特例 | 未获取到文案 | 提取完成但没有文案内容。 | 查看 `out_dir` 日志 |
| E11 | Vault 不可写 | 创建目录/文件失败 | 无法写入笔记库 | 无法写入 {path}：{系统错误信息} | 检查 Vault 权限与路径设置 |

**E05–E07 正文模板：**

```
提取失败

{error}

作品 ID：{douyin_id 若有}
```

### 7.3 部分成功（仍写入 Vault，正文含警告块）

**策略（已确认）：** 只要后端 `extract` 返回 `success: true` 且能拿到文案（`text` 非空，或图文 P04 特例），即使视频/部分图片拷贝失败，**仍创建笔记**，用 §7.5 模板降级展示；**不**因媒体失败而整单作废。

| 编号 | 场景 | 是否建笔记 | 笔记内警告块（Markdown） | Notice |
|------|------|------------|--------------------------|--------|
| P01 | 视频文案成功，`video.mp4` 拷贝失败 | **是（已确认）** | 见 §7.5 模板 A | 笔记已创建，但视频未能导入 |
| P02 | 图文部分图片拷贝失败 | 是 | 见 §7.5 模板 B | 笔记已创建，{n} 张配图导入失败 |
| P03 | 视频 `embedVideo:false` 且拷贝失败 | 是 | 见 §7.5 模板 C | 笔记已创建，请使用下方下载链接 |
| P04 | 图文 0 张图（后端无图） | 是 | 见 §7.5 模板 D | 笔记已创建（仅配文，无配图） |
| P05 | 文案极短/仅 hashtag | 是 | 无警告 | 提取完成 |

### 7.4 笔记内媒体加载失败（阅读时）

Obsidian 打开笔记后，若附件路径无效或文件被删，阅读视图应仍可读。创建笔记时 **预埋占位**，不依赖 Obsidian 默认破图。

| 类型 | 正常嵌入 | 拷贝失败时正文片段 | 文件被删后（用户手动改笔记时的占位说明） |
|------|----------|-------------------|----------------------------------------|
| 视频 | `![[…/video.mp4]]` | §7.5 模板 A | `> ⚠️ 视频文件缺失：\`{相对路径}\`。可从 [原 CDN]({download_url}) 重新下载。` |
| 配图 | `![[…/01.jpg]]` | 该张改为 §7.5 单图失败行 | `> ⚠️ 配图缺失：\`{相对路径}\`` |

### 7.5 笔记内固定文案模板

#### 模板 A — 视频未导入（P01）

```markdown
> ⚠️ **视频未能导入到笔记库**
>
> 文案已成功提取。本地文件可能不存在或拷贝失败。
>
> - 后端目录：`{out_dir}`
> - 无水印链接：[点击下载]({download_url})

## 文案

{text}
```

（若 `embedVideo: true` 且拷贝成功，使用 §5.4 正常视频模板，不含此警告块。）

#### 模板 B — 图文部分图片失败（P02）

```markdown
## 配图

![[attachments/douyin/{id}/01.jpg]]
…

> ⚠️ **以下配图未能导入：** 03.jpg, 07.jpg  
> 已成功导入 {okCount}/{totalCount} 张。可在后端目录查看：`{out_dir}/images/`

## 文案

{text}
```

单张失败时，该张位置改为：

```markdown
> ⚠️ 配图 03.jpg 导入失败（后端：`{out_dir}/images/03.jpg`）
```

#### 模板 C — 仅外链视频（P03 / embedVideo false 且本地无文件）

```markdown
## 视频

[无水印视频（CDN）]({download_url})

> 未将视频保存到笔记库。可在设置中开启「嵌入视频」。

## 文案

{text}
```

#### 模板 D — 图文无配图（P04）

```markdown
> ℹ️ **未包含配图**  
> 该作品可能无图片，或下载失败。配文如下。

## 文案

{text}
```

#### 模板 E — 文案为空时的笔记（极少见）

```markdown
> ⚠️ **未提取到文案正文**  
> 作品 ID：`{douyin_id}` · 类型：{content_type}

（请在后端 output 目录查看 `transcript.txt`）
```

### 7.6 成功展示

| 场景 | Notice 文案 | 其他 |
|------|-------------|------|
| 视频完整成功 | 已创建笔记：{title 截断 30 字} | `openNoteAfterCreate` 时打开笔记 |
| 图文完整成功 | 已创建笔记：{title}（{n} 张配图） | 同上 |
| 部分成功 P01–P04 | 见 §7.3「Notice」列 | 仍打开笔记 |

### 7.7 设置页与启动探测

| 位置 | 状态 | 显示 |
|------|------|------|
| 设置 → 后端地址旁 | 检测中 | 检测中… |
| 设置 → 后端地址旁 | 正常 | ● 已连接（{serverUrl}） |
| 设置 → 后端地址旁 | 失败 E01/E02 | ● 未连接 — 请运行 `python web/app.py` |
| Obsidian 启动 5s 内 | 失败 | Status Bar：`抖音后端未连接`（点击打开设置） |
| Obsidian 启动 5s 内 | 正常 | 不打扰（或 Status Bar：`抖音后端已就绪`，3s 消失 `[待议]`） |

### 7.8 错误信息映射（后端 → 用户友好补充）

后端 `error` 原样展示；若匹配下列关键字，**在下方追加一行**提示（不替换原文）：

| 后端信息含 | 追加提示 |
|------------|----------|
| `未在输入中找到抖音链接` | 请粘贴包含 v.douyin.com 的分享文案。 |
| `无法从分享页解析` | 尝试使用 note/video 链接，或稍后再试。 |
| `FFmpeg` / `ffmpeg` | 视频需要 FFmpeg：`brew install ffmpeg` |
| `No module named` | 后端依赖未安装，请在项目目录激活 `.venv` 并 pip install。 |

---

## 8. 错误与边界（行为摘要）

| 场景 | 插件行为 |
|------|----------|
| 后端未启动 | E01，不写入 Vault |
| 解析失败 | E05/E06，不写入 Vault |
| 视频无 `video.mp4` | **P01**：仍建笔记，正文用 §7.5 模板 A（文案 + 下载链接） |
| 图文 0 张图 | P04，仍创建笔记 |
| 超大视频 | 仍拷贝；超限策略 `[待议]` |
| 重复 `douyin_id` | 新建 `-2` 后缀 `[待议]` |

详细文案见 **§7**。

---

## 9. 版本与兼容

| 契约版本 | 后端最低版本 | 说明 |
|----------|--------------|------|
| `0.1` | 当前 `main` | 使用现有 `/api/video/extract` 字段 |

插件 manifest 建议声明：

```json
"minBackendVersion": "0.1.0"
```

`[待议]` 后端与插件是否独立 semver、是否在 health 返回 `version`。

---

## 10. 待你确认的问题

1. 视频：**必须嵌入 mp4**，还是允许「文案 + 外链下载」两种模式并存？
2. 图文：图片要 **全部嵌入**，还是只嵌入前 N 张 + 其余折叠？
3. 笔记默认文件夹 `Douyin/` 和标签 `douyin` 是否 OK？
4. 同一作品重复导入：**新建**还是 **更新已有笔记**？
5. 是否在 frontmatter 保留后端 `out_dir`（方便手动找原文件）？
6. 是否需要 **预览命令**（只调 `/api/video/info`，不写 Vault）作为 v0.1 必做？

**已确认：**

- **部分失败（含 P01 视频未导入）→ 仍建笔记**，文案必保留，媒体用 §7.5 降级模板。

7. 加载失败文案是否需要 **英文副本**（插件 i18n）？

---

## 11. 变更记录

| 版本 | 日期 | 说明 |
|------|------|------|
| 0.1 草案 | 2026-06-04 | 初稿，供评审 |
| 0.1.1 | 2026-06-04 | 补充 §7 加载态与失败展示 |
| 0.1.2 | 2026-06-04 | 确认部分失败（P01 等）仍建笔记 |
| 0.1.3 | 2026-06-04 | 文档迁至插件仓库 `docs/` |
