import { Editor, MarkdownView, Notice, Plugin } from 'obsidian';
import {
	DEFAULT_SETTINGS,
	DiscordEmojiPickerSettings,
	DiscordEmojiPickerSettingTab,
} from './settings';
import { EmojiPicker } from './emoji/picker';
import { MediaSuggest } from './emoji/suggest';
import { ImportModal } from './ui/import';
import { registerShortcodeRenderer } from './shortcode';
import { seedSamples } from './samples';

export default class DiscordEmojiPickerPlugin extends Plugin {
	settings!: DiscordEmojiPickerSettings;
	private picker?: EmojiPicker;

	async onload() {
		await this.loadSettings();

		await seedSamples(this);
		await this.ensureFolder(this.settings.emojiFolder);
		await this.ensureFolder(this.settings.stickerFolder);

		registerShortcodeRenderer(this);
		this.registerEditorSuggest(new MediaSuggest(this.app, this));

		this.addRibbonIcon('smile', 'Open emoji & sticker picker', () => {
			this.openPicker();
		});

		this.addCommand({
			id: 'open-emoji-sticker-picker',
			name: 'Open emoji & sticker picker',
			checkCallback: (checking: boolean) => {
				const view = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (!view || !view.editor) return false;
				if (!checking) this.openPicker();
				return true;
			},
		});

		this.addCommand({
			id: 'import-emojis-stickers',
			name: 'Import emojis & stickers',
			callback: () => this.openImport(),
		});

		this.addSettingTab(new DiscordEmojiPickerSettingTab(this.app, this));
	}

	openPicker(editor?: Editor, query?: string, kind?: 'emoji' | 'sticker') {
		const targetEditor =
			editor ??
			this.app.workspace.getActiveViewOfType(MarkdownView)?.editor;
		if (!targetEditor) {
			new Notice('Open a note to insert emojis or stickers.');
			return;
		}
		if (this.picker) this.picker.close();
		this.picker = new EmojiPicker(this.app, this, targetEditor, query, kind);
		this.picker.open();
	}

	openImport() {
		new ImportModal(this.app, this).open();
	}

	refreshPicker() {
		this.picker?.refresh();
	}

	onunload() {
		this.picker?.close();
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<DiscordEmojiPickerSettings>,
		);
	}

	private async ensureFolder(path: string) {
		const trimmed = path.trim().replace(/^\/+|\/+$/g, '');
		if (!trimmed) return;
		if (this.app.vault.getAbstractFileByPath(trimmed)) return;
		try {
			await this.app.vault.createFolder(trimmed);
		} catch {
			// Folder already exists or the path is invalid; ignore.
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}