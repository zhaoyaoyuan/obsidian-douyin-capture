export type ConnectionMode = "http" | "cli";

export interface DouyinPluginSettings {
  connectionMode: ConnectionMode;
  serverUrl: string;
  backendPath: string;
  whisperModel: string;
  noteFolder: string;
  attachmentFolder: string;
  embedVideo: boolean;
  openNoteAfterCreate: boolean;
}

export const DEFAULT_SETTINGS: DouyinPluginSettings = {
  connectionMode: "http",
  serverUrl: "http://127.0.0.1:5050",
  backendPath: "",
  whisperModel: "small",
  noteFolder: "Douyin",
  attachmentFolder: "attachments/douyin",
  embedVideo: true,
  openNoteAfterCreate: true,
};

export interface ExtractResult {
  success: true;
  video_id: string;
  title: string;
  author: string;
  content_type: "video" | "image";
  download_url: string;
  text: string;
  out_dir: string;
  images: string[];
  source_url?: string;
}

export interface ExtractError {
  success: false;
  error: string;
}

export type ExtractResponse = ExtractResult | ExtractError;

export interface MetaJson {
  aweme_id?: string;
  title?: string;
  author?: string;
  content_type?: string;
  source_url?: string;
  download_url?: string;
}
