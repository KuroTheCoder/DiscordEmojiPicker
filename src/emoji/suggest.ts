import {
	App,
	Editor,
	EditorPosition,
	EditorSuggest,
	EditorSuggestContext,
	EditorSuggestTriggerInfo,
	TFile,
} from 'obsidian';
import type DiscordEmojiPickerPlugin from '../main';
import { getAllMedia, MediaFile, shortcodeFor } from '../media';

export class MediaSuggest extends EditorSuggest<MediaFile> {
	private plugin: DiscordEmojiPickerPlugin;

	constructor(app: App, plugin: DiscordEmojiPickerPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onTrigger(
		cursor: EditorPosition,
		editor: Editor,
		_file: TFile,
	): EditorSuggestTriggerInfo | null {
		const upToCursor = editor.getLine(cursor.line).slice(0, cursor.ch);
		const colon = upToCursor.lastIndexOf(':');
		if (colon === -1) return null;
		const before = colon === 0 ? '' : (upToCursor[colon - 1] ?? '');
		if (before && /^[A-Za-z0-9_-]$/.test(before)) return null;
		const afterColon = upToCursor.slice(colon + 1);
		if (!/^[A-Za-z0-9_-]*$/.test(afterColon)) return null;

		return {
			start: { line: cursor.line, ch: colon },
			end: cursor,
			query: afterColon,
		};
	}

	getSuggestions(context: EditorSuggestContext): MediaFile[] {
		const q = context.query.toLowerCase();
		return getAllMedia(this.plugin.app, this.plugin.settings)
			.filter(
				(item) =>
					item.label.toLowerCase().includes(q) ||
					shortcodeFor(item).includes(q),
			)
			.slice(0, 24);
	}

	renderSuggestion(item: MediaFile, el: HTMLElement) {
		const row = el.createDiv({ cls: 'gl-suggest-item' });
		row.createEl('img', {
			attr: {
				src: this.plugin.app.vault.getResourcePath(item.file),
				alt: item.label,
				loading: 'lazy',
			},
		});
		const info = row.createDiv({ cls: 'gl-suggest-info' });
		info.createDiv({ cls: 'gl-suggest-label', text: item.label });
		info.createDiv({ cls: 'gl-suggest-code', text: `:${shortcodeFor(item)}:` });
	}

	selectSuggestion(item: MediaFile, _evt: MouseEvent | KeyboardEvent) {
		const context = this.context;
		if (!context) return;
		const code = `:${shortcodeFor(item)}: `;
		context.editor.replaceRange(code, context.start, context.end);
		context.editor.setCursor({
			line: context.start.line,
			ch: context.start.ch + code.length,
		});
	}
}