import { Modal } from "obsidian";
import { MSG } from "./messages";
import type DouyinCapturePlugin from "./main";
import type { ExtractMode } from "./backend";

type StepState = "pending" | "active" | "done";

export class ExtractModal extends Modal {
  private url = "";
  private running = false;
  private progressEl: HTMLElement | null = null;
  private stepEls: HTMLElement[] = [];
  private inputEl: HTMLInputElement | null = null;
  private extractBtn: HTMLButtonElement | null = null;
  private videoOnlyBtn: HTMLButtonElement | null = null;
  private rotateTimer: number | null = null;

  constructor(private plugin: DouyinCapturePlugin) {
    super(plugin.app);
  }

  onOpen(): void {
    const { contentEl, modalEl } = this;
    contentEl.empty();
    modalEl.addClass("douyin-extract-modal-container");

    const wrap = contentEl.createDiv({ cls: "douyin-extract-modal" });

    wrap.createEl("h2", { text: "import douyin" });
    wrap.createEl("p", {
      cls: "douyin-modal-desc",
      text: "粘贴抖音分享链接（v.douyin.com 或 douyin.com）",
    });

    this.inputEl = wrap.createEl("input", {
      type: "text",
      cls: "douyin-modal-input",
      attr: { placeholder: "https://..." },
    });
    this.inputEl.addEventListener("input", () => {
      this.url = this.inputEl?.value ?? "";
    });

    this.progressEl = wrap.createDiv({ cls: "douyin-modal-progress is-hidden" });

    const footer = wrap.createDiv({ cls: "douyin-modal-footer" });
    footer
      .createEl("button", { text: "取消", cls: "douyin-btn-cancel" })
      .addEventListener("click", () => this.close());

    this.videoOnlyBtn = footer.createEl("button", {
      text: "提取视频",
      cls: "douyin-btn-secondary",
    });
    this.videoOnlyBtn.addEventListener("click", () =>
      void this.run("video_only")
    );

    this.extractBtn = footer.createEl("button", {
      text: "提取文案",
      cls: "mod-cta douyin-btn-primary",
    });
    this.extractBtn.addEventListener("click", () => void this.run("full"));
  }

  private setButtonsEnabled(enabled: boolean): void {
    this.extractBtn?.toggleAttribute("disabled", !enabled);
    this.videoOnlyBtn?.toggleAttribute("disabled", !enabled);
    this.inputEl?.toggleAttribute("disabled", !enabled);
  }

  private buildSteps(mode: ExtractMode): string[] {
    if (mode === "video_only") {
      return [
        MSG.steps.health,
        MSG.steps.resolve,
        MSG.steps.videoOnly,
        MSG.steps.vault,
      ];
    }
    return [
      MSG.steps.health,
      MSG.steps.resolve,
      MSG.steps.whisper,
      MSG.steps.vault,
    ];
  }

  private showProgress(labels: string[]): void {
    if (!this.progressEl) return;
    this.progressEl.removeClass("is-hidden");
    const stepsWrap = this.progressEl.querySelector(".douyin-modal-steps");
    if (!stepsWrap) {
      const ul = this.progressEl.createEl("ul", { cls: "douyin-modal-steps" });
      this.renderStepList(ul, labels);
      return;
    }
    stepsWrap.empty();
    this.stepEls = [];
    this.renderStepList(stepsWrap as HTMLElement, labels);
  }

  private renderStepList(container: HTMLElement, labels: string[]): void {
    for (const label of labels) {
      const li = container.createEl("li", { cls: "douyin-step is-pending" });
      li.createSpan({ cls: "douyin-step-dot" });
      li.createSpan({ cls: "douyin-step-label", text: label });
      this.stepEls.push(li);
    }
  }

  private setStep(index: number, state: StepState): void {
    const el = this.stepEls[index];
    if (!el) return;
    el.removeClass("is-pending", "is-active", "is-done");
    el.addClass(`is-${state}`);
  }

  private markStepsDone(until: number): void {
    for (let i = 0; i < until; i++) this.setStep(i, "done");
  }

  private startExtractSubsteps(mode: ExtractMode, stepIndex: number): void {
    this.stopRotateTimer();
    const subs =
      mode === "video_only"
        ? [MSG.steps.resolve, MSG.steps.download, MSG.steps.videoOnly]
        : [
            MSG.steps.resolve,
            MSG.steps.download,
            MSG.steps.audio,
            MSG.steps.whisper,
          ];
    let i = 0;
    const labelEl = this.stepEls[stepIndex]?.querySelector(".douyin-step-label");
    if (labelEl) labelEl.textContent = subs[0];

    this.rotateTimer = window.setInterval(() => {
      i = (i + 1) % subs.length;
      if (labelEl) labelEl.textContent = subs[i];
    }, 3500);
  }

  private stopRotateTimer(): void {
    if (this.rotateTimer != null) {
      window.clearInterval(this.rotateTimer);
      this.rotateTimer = null;
    }
  }

  private async run(mode: ExtractMode): Promise<void> {
    if (this.running) return;
    const trimmed = this.url.trim();
    if (!trimmed) {
      this.plugin.noticeError(MSG.error.e03Title, MSG.error.e03Body);
      return;
    }

    this.showProgress(this.buildSteps(mode));
    this.running = true;
    this.setButtonsEnabled(false);

    try {
      await this.plugin.runExtractFlow(trimmed, {
        mode,
        onStep: (index, state) => {
          if (state === "active") {
            this.markStepsDone(index);
            this.setStep(index, "active");
            if (index === 1) this.startExtractSubsteps(mode, 1);
          } else if (state === "done") {
            if (index === 1) this.stopRotateTimer();
            this.setStep(index, "done");
            const labels = this.buildSteps(mode);
            const labelEl = this.stepEls[index]?.querySelector(
              ".douyin-step-label"
            );
            if (labelEl && labels[index]) {
              labelEl.textContent = labels[index];
            }
          }
        },
      });
      this.markStepsDone(this.stepEls.length);
      this.close();
    } finally {
      this.stopRotateTimer();
      this.running = false;
      this.setButtonsEnabled(true);
    }
  }

  onClose(): void {
    this.stopRotateTimer();
    this.modalEl.removeClass("douyin-extract-modal-container");
    this.contentEl.empty();
  }
}
