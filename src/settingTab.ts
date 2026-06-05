import { App, PluginSettingTab, Setting } from "obsidian";
import type DouyinCapturePlugin from "./main";
import { MSG } from "./messages";

export class DouyinSettingTab extends PluginSettingTab {
  private statusText = MSG.settings.checking;

  constructor(app: App, private plugin: DouyinCapturePlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("p", {
      text: "需先启动本地后端 obsidian-content-capture-backend（python web/app.py）",
      cls: "douyin-settings-hint",
    });

    const statusEl = containerEl.createDiv({ cls: "douyin-settings-status" });
    statusEl.setText(this.statusText);
    void this.plugin.checkBackendStatus().then((s) => {
      statusEl.setText(s);
    });

    new Setting(containerEl)
      .setName("后端地址")
      .setDesc("默认 http://127.0.0.1:5050")
      .addText((text) =>
        text
          .setValue(this.plugin.settings.serverUrl)
          .onChange((value) => {
            this.plugin.settings.serverUrl = value.trim();
            void (async () => {
              await this.plugin.saveSettings();
              statusEl.setText(MSG.settings.checking);
              statusEl.setText(await this.plugin.checkBackendStatus());
            })();
          })
      );

    new Setting(containerEl)
      .setName("Whisper 模型")
      .setDesc("仅视频转写时使用")
      .addDropdown((drop) => {
        ["tiny", "base", "small", "medium", "large-v2", "large-v3"].forEach(
          (m) => drop.addOption(m, m)
        );
        drop.setValue(this.plugin.settings.whisperModel).onChange((v) => {
          this.plugin.settings.whisperModel = v;
          void this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("笔记文件夹")
      .addText((text) =>
        text
          .setValue(this.plugin.settings.noteFolder)
          .onChange((v) => {
            this.plugin.settings.noteFolder = v.trim() || "Douyin";
            void this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("附件文件夹")
      .addText((text) =>
        text
          .setValue(this.plugin.settings.attachmentFolder)
          .onChange((v) => {
            this.plugin.settings.attachmentFolder =
              v.trim() || "attachments/douyin";
            void this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("嵌入视频")
      .setDesc("关闭则笔记内仅显示下载链接")
      .addToggle((t) =>
        t
          .setValue(this.plugin.settings.embedVideo)
          .onChange((v) => {
            this.plugin.settings.embedVideo = v;
            void this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("创建后打开笔记")
      .addToggle((t) =>
        t
          .setValue(this.plugin.settings.openNoteAfterCreate)
          .onChange((v) => {
            this.plugin.settings.openNoteAfterCreate = v;
            void this.plugin.saveSettings();
          })
      );

    new Setting(containerEl).addButton((btn) =>
      btn.setButtonText("检查后端连接").onClick(() => {
        void (async () => {
          statusEl.setText(MSG.settings.checking);
          statusEl.setText(await this.plugin.checkBackendStatus());
        })();
      })
    );
  }
}
