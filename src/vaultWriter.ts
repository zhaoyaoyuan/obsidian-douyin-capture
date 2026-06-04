import { App, TFile, normalizePath } from "obsidian";
import { promises as fs } from "fs";
import { join } from "path";
import type { DouyinPluginSettings, ExtractResult } from "./settings";
import { MSG } from "./messages";

const DOUYIN_LINK_RE =
  /https?:\/\/(?:v\.douyin\.com|www\.douyin\.com|www\.iesdouyin\.com|m\.douyin\.com)[^\s\]]*/i;

export function extractDouyinLink(text: string): string | null {
  const m = text.match(DOUYIN_LINK_RE);
  return m ? m[0].replace(/[.,;)\]]+$/, "") : null;
}

/** 从抖音标题/desc 拆出展示标题与 #话题 列表 */
export function splitTitleAndHashtags(raw: string): {
  displayTitle: string;
  hashtags: string[];
} {
  const hashtags: string[] = [];
  const seen = new Set<string>();
  for (const m of raw.matchAll(/#([^\s#]+)/g)) {
    const tag = m[1].trim();
    if (tag && !seen.has(tag)) {
      seen.add(tag);
      hashtags.push(tag);
    }
  }
  let displayTitle = raw
    .replace(/#[^\s#]+/g, "")
    .replace(/[_\-–—\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!displayTitle) {
    displayTitle = raw.replace(/#/g, "").trim() || "无标题";
  }
  return { displayTitle, hashtags };
}

/** 正文标签块：单独一行引用，阅读模式显示为左侧竖线 + 标签胶囊 */
export function formatBodyTagLine(hashtags: string[]): string {
  if (hashtags.length === 0) return "";
  const tags = hashtags.map((t) => `#${t}`).join(" ");
  return `> ${tags}\n`;
}

export function sanitizeFilenameSegment(text: string, maxLen = 40): string {
  const cleaned = text
    .replace(/[\\/:*?"<>|\n\r\t#|]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .trim();
  if (!cleaned) return "untitled";
  if (cleaned.length <= maxLen) return cleaned;
  return cleaned.slice(0, maxLen).replace(/-+$/, "");
}

export function sanitizeTitle(title: string, maxLen = 40): string {
  return sanitizeFilenameSegment(title, maxLen);
}

function formatDateDashed(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 2026-06-04-作者-标题摘要 */
export function buildNoteBaseName(author: string, title: string): string {
  const date = formatDateDashed();
  const authorSeg = sanitizeFilenameSegment(author || "未知", 24);
  const slug = sanitizeFilenameSegment(title, 48);
  return `${date}-${authorSeg}-${slug}`;
}

function escapeYaml(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function ensureFolder(app: App, folderPath: string): Promise<void> {
  const norm = normalizePath(folderPath);
  if (app.vault.getAbstractFileByPath(norm)) return;
  await app.vault.createFolder(norm);
}

async function uniqueNotePath(app: App, basePath: string): Promise<string> {
  let candidate = normalizePath(basePath + ".md");
  if (!app.vault.getAbstractFileByPath(candidate)) return candidate;
  for (let i = 2; i < 100; i++) {
    candidate = normalizePath(`${basePath}-${i}.md`);
    if (!app.vault.getAbstractFileByPath(candidate)) return candidate;
  }
  return normalizePath(`${basePath}-${Date.now()}.md`);
}

async function copyToVaultBinary(
  app: App,
  vaultRelPath: string,
  srcAbs: string
): Promise<boolean> {
  try {
    const norm = normalizePath(vaultRelPath);
    const dir = norm.split("/").slice(0, -1).join("/");
    if (dir) await ensureFolder(app, dir);
    const buf = await fs.readFile(srcAbs);
    const existing = app.vault.getAbstractFileByPath(norm);
    if (existing instanceof TFile) {
      await app.vault.modifyBinary(existing, buf);
    } else {
      await app.vault.createBinary(norm, buf);
    }
    return true;
  } catch {
    return false;
  }
}

export interface WriteNoteResult {
  file: TFile;
  partial: boolean;
  partialNotice?: string;
  imageOk?: number;
  imageFail?: number;
}

export interface WriteNoteOptions {
  videoOnly?: boolean;
}

export async function writeNoteFromExtract(
  app: App,
  settings: DouyinPluginSettings,
  data: ExtractResult,
  options: WriteNoteOptions = {}
): Promise<WriteNoteResult> {
  const videoOnly = options.videoOnly === true;
  const douyinId = data.video_id;
  const attachBase = normalizePath(
    `${settings.attachmentFolder}/${douyinId}`
  );
  const text = data.text?.trim() ?? "";
  const rawTitle = data.title?.trim() || "无标题";
  const { displayTitle, hashtags } = splitTitleAndHashtags(rawTitle);
  const author = data.author?.trim() || "未知";
  const source = data.source_url || "";
  const isVideo = data.content_type === "video";

  let partial = false;
  let partialNotice: string | undefined;
  let bodyParts: string[] = [];

  bodyParts.push(`# ${displayTitle}\n`);
  const tagLine = formatBodyTagLine(hashtags);
  if (tagLine) {
    bodyParts.push(`\n${tagLine}\n`);
  } else {
    bodyParts.push("\n");
  }

  if (isVideo) {
    const videoSrc = join(data.out_dir, "video.mp4");
    const videoRel = normalizePath(`${attachBase}/video.mp4`);
    let copied = false;
    try {
      await fs.access(videoSrc);
      copied = await copyToVaultBinary(app, videoRel, videoSrc);
    } catch {
      copied = false;
    }

    if (copied && settings.embedVideo) {
      bodyParts.push(`![[${videoRel}]]\n`);
    } else if (copied && !settings.embedVideo) {
      bodyParts.push(`## 视频\n\n[本地视频](${videoRel})\n`);
    } else if (data.download_url) {
      partial = true;
      partialNotice = MSG.success.partialVideo;
      bodyParts.push(
        `> ⚠️ **视频未能导入到笔记库**\n>\n> 文案已成功提取。本地文件可能不存在或拷贝失败。\n>\n> - 后端目录：\`${data.out_dir}\`\n> - 无水印链接：[点击下载](${data.download_url})\n`
      );
    }
  } else {
    bodyParts.push(`## 配图\n`);
    const imagesDir = join(data.out_dir, "images");
    let files: string[] = [];
    try {
      const entries = await fs.readdir(imagesDir);
      files = entries
        .filter((f) => /\.(jpe?g|png|webp|gif)$/i.test(f))
        .sort();
    } catch {
      files = [];
    }

    let okCount = 0;
    const failNames: string[] = [];

    for (const name of files) {
      const src = join(imagesDir, name);
      const rel = normalizePath(`${attachBase}/${name}`);
      const ok = await copyToVaultBinary(app, rel, src);
      if (ok) {
        okCount++;
        bodyParts.push(`![[${rel}]]\n`);
      } else {
        failNames.push(name);
        bodyParts.push(
          `> ⚠️ 配图 ${name} 导入失败（后端：\`${src}\`）\n`
        );
      }
    }

    if (files.length === 0) {
      bodyParts.push(
        `> ℹ️ **未包含配图**\n> 该作品可能无图片，或下载失败。配文如下。\n`
      );
    } else if (failNames.length > 0) {
      partial = true;
      partialNotice = MSG.success.partialImages(failNames.length);
      bodyParts.push(
        `\n> ⚠️ **以下配图未能导入：** ${failNames.join(", ")}  \n> 已成功导入 ${okCount}/${files.length} 张。可在后端目录查看：\`${imagesDir}\`\n`
      );
    }
  }

  if (!text) {
    if (videoOnly && isVideo) {
      bodyParts.push(
        `> ℹ️ **仅保存视频**（未进行 Whisper 转写）\n> 需要文案时可再次使用「提取文案」。\n`
      );
    } else {
      bodyParts.push(
        `> ⚠️ **未提取到文案正文**\n> 作品 ID：\`${douyinId}\` · 类型：${data.content_type}\n\n（请在后端 output 目录查看 transcript.txt）\n`
      );
    }
  } else {
    bodyParts.push(`## 文案\n\n${text}\n`);
  }

  const fmLines = [
    "---",
    "cssclasses:",
    "  - douyin-capture",
    "type: douyin",
    `content_type: ${data.content_type}`,
    `douyin_id: "${douyinId}"`,
    `author: "${escapeYaml(author)}"`,
    `source: "${escapeYaml(source)}"`,
    `captured_at: ${new Date().toISOString()}`,
  ];
  if (isVideo && !videoOnly) {
    fmLines.push(`whisper_model: ${settings.whisperModel}`);
  }
  if (videoOnly) {
    fmLines.push("capture_mode: video_only");
  }
  fmLines.push("tags:", "  - douyin");
  for (const tag of hashtags) {
    fmLines.push(`  - ${escapeYaml(tag)}`);
  }
  fmLines.push("---", "");

  const content = fmLines.join("\n") + bodyParts.join("\n");

  await ensureFolder(app, settings.noteFolder);
  const baseName = buildNoteBaseName(author, displayTitle);
  const notePath = await uniqueNotePath(
    app,
    normalizePath(`${settings.noteFolder}/${baseName}`)
  );

  try {
    const file = await app.vault.create(notePath, content);
    return { file, partial, partialNotice };
  } catch (e) {
    throw new Error(`VAULT_WRITE:${(e as Error).message}:${notePath}`);
  }
}
