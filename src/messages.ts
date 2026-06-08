/** 契约 §7 固定文案 */
export const MSG = {
  loading: {
    health: { main: "正在连接本地服务…", sub: "请确认已运行 python web/app.py" },
    extract: { main: "正在提取内容…", sub: "请勿关闭 Obsidian" },
    extractVideo: {
      main: "正在提取视频文案…",
      sub: "本地 Whisper 转写可能需要2-3分钟",
    },
    extractImage: { main: "正在下载图文…", sub: "通常几秒完成" },
    videoOnly: { main: "正在下载视频…", sub: "跳过语音转写，通常较快" },
    vault: { main: "正在写入 Vault…", sub: "复制视频/图片到笔记附件" },
  },
  steps: {
    health: "检查本地服务",
    resolve: "解析分享链接",
    download: "下载无水印视频",
    audio: "提取音频轨道",
    whisper: "Whisper 转写文案",
    downloadImage: "下载图文与配图",
    vault: "写入 Obsidian 笔记",
    videoOnly: "仅下载视频（不转写）",
  },
  success: {
    video: (title: string) => `已创建笔记：${truncate(title, 30)}`,
    videoOnly: (title: string) =>
      `已保存视频笔记：${truncate(title, 30)}（未转写文案）`,
    image: (title: string, n: number) =>
      `已创建笔记：${truncate(title, 30)}（${n} 张配图）`,
    partialVideo: "笔记已创建，但视频未能导入",
    partialImages: (n: number) => `笔记已创建，${n} 张配图导入失败`,
  },
  error: {
    e01Title: "无法连接本地服务",
    e01BodyHttp:
      "未检测到抖音提取后端。请在终端运行：python web/app.py（默认 http://127.0.0.1:5050）",
    e01BodyCli:
      "未检测到抖音提取后端 CLI。请确认「后端项目路径」指向 obsidian-content-capture-backend 目录，且已创建 .venv 虚拟环境。",
    e03Title: "请输入链接",
    e03Body: "请粘贴抖音分享短链或整段分享文案。",
    e04Title: "剪贴板中无有效链接",
    e04Body: "未找到抖音链接。请先复制分享文案后再试。",
    e05Title: "提取失败",
    e11Title: "无法写入笔记库",
    healthFail: (status: number) =>
      `后端返回错误（${status}）。请查看运行 web/app.py 的终端日志。`,
    jsonInvalid: "后端返回了无法识别的数据，请升级插件与后端到匹配版本。",
    emptyText: "提取完成但没有文案内容。",
    cliNotConfigured: "后端项目路径未配置。请在设置中指定 obsidian-content-capture-backend 目录路径。",
    cliVenvMissing: (path: string) =>
      `未找到 Python 虚拟环境：${path}。请先运行：python3 -m venv .venv && pip install -r requirements.txt`,
    cliExecFailed: "CLI 执行失败",
    cliParseOutDir: "无法解析 CLI 输出目录",
  },
  settings: {
    checking: "检测中…",
    connected: (url: string) => `● 已连接（${url}）`,
    disconnected: "● 未连接 — 请运行 python web/app.py",
    cliAvailable: "● CLI 可用",
    cliUnavailable: (err: string) => `● CLI 不可用 — ${err}`,
  },
  statusBar: {
    disconnected: "抖音后端未连接",
  },
} as const;

export function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return t.slice(0, max) + "…";
}

export function appendErrorHint(error: string): string {
  const hints: [string, string][] = [
    ["未在输入中找到抖音链接", "请粘贴包含 v.douyin.com 的分享文案。"],
    ["无法从分享页解析", "尝试使用 note/video 链接，或稍后再试。"],
    ["FFmpeg", "视频需要 FFmpeg：brew install ffmpeg"],
    ["ffmpeg", "视频需要 FFmpeg：brew install ffmpeg"],
    ["No module named", "后端依赖未安装，请在项目目录激活 .venv 并 pip install。"],
  ];
  for (const [key, hint] of hints) {
    if (error.includes(key)) return `${error}\n\n${hint}`;
  }
  return error;
}

export function formatExtractError(error: string, douyinId?: string): string {
  let body = appendErrorHint(error);
  if (douyinId) body += `\n\n作品 ID：${douyinId}`;
  return body;
}
