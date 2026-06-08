import { requestUrl } from "obsidian";
import { promises as fs } from "fs";
import { join, resolve } from "path";
import { spawn } from "child_process";
import type {
  DouyinPluginSettings,
  ExtractResponse,
  MetaJson,
} from "./settings";

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

export async function checkHealth(
  serverUrl: string
): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    const resp = await requestUrl({
      url: `${normalizeBaseUrl(serverUrl)}/api/health`,
      method: "GET",
    });
    if (resp.status !== 200) {
      return { ok: false, status: resp.status };
    }
    const data = JSON.parse(resp.text) as { success?: boolean };
    return { ok: data.success === true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export type ExtractMode = "full" | "video_only";

export async function extractContent(
  settings: DouyinPluginSettings,
  shareUrl: string,
  mode: ExtractMode = "full"
): Promise<ExtractResponse> {
  const base = normalizeBaseUrl(settings.serverUrl);
  const resp = await requestUrl({
    url: `${base}/api/video/extract`,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: shareUrl,
      model: settings.whisperModel,
      skip_transcribe: mode === "video_only",
    }),
  });

  let data: ExtractResponse;
  try {
    data = JSON.parse(resp.text) as ExtractResponse;
  } catch {
    throw new Error("INVALID_JSON");
  }

  if (resp.status >= 400 || !data.success) {
    const err = !data.success ? data.error : `HTTP ${resp.status}`;
    return { success: false, error: err };
  }

  const meta = await readMetaJson(data.out_dir);
  if (meta?.source_url) {
    data.source_url = meta.source_url;
  }
  return data;
}

async function readMetaJson(outDir: string): Promise<MetaJson | null> {
  try {
    const raw = await fs.readFile(join(outDir, "meta.json"), "utf-8");
    return JSON.parse(raw) as MetaJson;
  } catch {
    return null;
  }
}

function getPythonExecutable(backendPath: string): string {
  const isWin = process.platform === "win32";
  const venvPython = isWin
    ? join(backendPath, ".venv", "Scripts", "python.exe")
    : join(backendPath, ".venv", "bin", "python");
  return venvPython;
}

export async function checkCliAvailability(
  backendPath: string
): Promise<{ ok: boolean; error?: string }> {
  if (!backendPath.trim()) {
    return { ok: false, error: "后端路径未配置" };
  }
  const absPath = resolve(backendPath);
  const python = getPythonExecutable(absPath);
  try {
    await fs.access(python);
  } catch {
    return {
      ok: false,
      error: `未找到 Python 虚拟环境：${python}`,
    };
  }
  const scriptDir = join(absPath, "script");
  try {
    const entries = await fs.readdir(scriptDir);
    if (!entries.includes("main.py")) {
      return { ok: false, error: `后端目录缺少 script/main.py：${absPath}` };
    }
  } catch {
    return { ok: false, error: `无法读取后端 script 目录：${absPath}` };
  }
  return { ok: true };
}

function runCli(
  python: string,
  backendPath: string,
  url: string,
  model: string
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const args = ["-m", "script", url, "--model", model, "-o", join(backendPath, "output")];
    const child = spawn(python, args, {
      cwd: backendPath,
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (data: Buffer) => {
      stdout += data.toString("utf-8");
    });
    child.stderr.on("data", (data: Buffer) => {
      stderr += data.toString("utf-8");
    });
    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      resolve({ code: code ?? 0, stdout, stderr });
    });
  });
}

function parseCliOutDir(stdout: string): string | null {
  const marker = "完成。输出目录:";
  for (const line of stdout.split("\n")) {
    const idx = line.indexOf(marker);
    if (idx !== -1) {
      const dir = line.slice(idx + marker.length).trim();
      return dir || null;
    }
  }
  return null;
}

function listImages(outDir: string): string[] {
  const imagesDir = join(outDir, "images");
  try {
    const entries = require("fs").readdirSync(imagesDir);
    return entries
      .filter((f: string) => /\.(jpe?g|png|webp|gif)$/i.test(f))
      .sort()
      .map((f: string) => join(imagesDir, f));
  } catch {
    return [];
  }
}

export async function extractContentViaCli(
  settings: DouyinPluginSettings,
  shareUrl: string,
  mode: ExtractMode = "full"
): Promise<ExtractResponse> {
  const absPath = resolve(settings.backendPath);
  const python = getPythonExecutable(absPath);

  const check = await checkCliAvailability(settings.backendPath);
  if (!check.ok) {
    return { success: false, error: check.error || "CLI 不可用" };
  }

  const result = await runCli(python, absPath, shareUrl, settings.whisperModel);

  if (result.code !== 0) {
    const err = result.stderr.trim() || result.stdout.trim() || "CLI 执行失败";
    return { success: false, error: err };
  }

  const outDir = parseCliOutDir(result.stdout);
  if (!outDir) {
    return { success: false, error: "无法解析 CLI 输出目录" };
  }

  const meta = await readMetaJson(outDir);
  if (!meta) {
    return { success: false, error: `未找到 meta.json：${outDir}` };
  }

  const transcriptPath = join(outDir, "transcript.txt");
  let text = "";
  try {
    const raw = await fs.readFile(transcriptPath, "utf-8");
    const marker = "--- 文案 ---";
    const idx = raw.indexOf(marker);
    text = idx !== -1 ? raw.slice(idx + marker.length).trim() : raw.trim();
  } catch {
    text = "";
  }

  const images = listImages(outDir);

  let downloadUrl = "";
  try {
    const dlPath = join(outDir, "download_url.txt");
    downloadUrl = (await fs.readFile(dlPath, "utf-8")).trim();
  } catch {
    downloadUrl = meta.download_url || "";
  }

  return {
    success: true,
    video_id: meta.aweme_id || "",
    title: meta.title || "无标题",
    author: meta.author || "未知",
    content_type: meta.content_type === "image" ? "image" : "video",
    download_url: downloadUrl,
    text,
    out_dir: outDir,
    images,
    source_url: meta.source_url,
  };
}
