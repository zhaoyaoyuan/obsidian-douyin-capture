import { requestUrl } from "obsidian";
import { promises as fs } from "fs";
import { join } from "path";
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
    const data = JSON.parse(resp.text);
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
    data = JSON.parse(resp.text);
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
