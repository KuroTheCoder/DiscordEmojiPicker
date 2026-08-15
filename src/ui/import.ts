import {
	App,
	DropdownComponent,
	Modal,
	Notice,
	requestUrl,
	Setting,
	setIcon,
	TextComponent,
	TFile,
} from 'obsidian';
import type DiscordEmojiPickerPlugin from '../main';
import {
	DiscordClient,
	DiscordEmoji,
	DiscordGuild,
	DiscordSticker,
	discordEmojiUrl,
	discordStickerUrl,
} from '../discord';
import { MediaKind, SUPPORTED_EXTENSIONS } from '../media';
import { baseName, sanitizeName } from '../utils/helpers';
import {
	confirmAction,
	deleteSet,
	listSets,
	openFolder,
	setFolderPath,
} from '../utils/folders';
import {
	PACK_PROVIDERS,
	PackProvider,
	packProviderById,
	packUrlForCode,
	POPULAR_CATEGORIES,
	normalizeCode,
} from '../packs';
import { renderSystemEmojiPng, SYSTEM_EMOJI_GROUPS } from '../system-emoji';
import { GuidedTour, TourStep } from './tour';

type ImportMode = 'url' | 'discord' | 'clipboard' | 'note' | 'pack';

const MODE_LABELS: Record<ImportMode, string> = {
	url: 'Link',
	discord: 'Discord',
	clipboard: 'Clipboard',
	note: 'Note',
	pack: 'Emoji pack',
};

const MODE_ICONS: Record<ImportMode, string> = {
	url: 'link',
	discord: 'message-square',
	clipboard: 'copy',
	note: 'file-text',
	pack: 'smile',
};

interface QueuedItem {
	id: number;
	name: string;
	kind: MediaKind;
	url?: string;
	vaultPath?: string;
	data?: ArrayBuffer;
	mime?: string;
	setName?: string;
	category?: string;
	status?: 'pending' | 'ok' | 'fail';
}

interface NoteImage {
	name?: string;
	url?: string;
	vaultPath?: string;
}

interface ClipboardImage {
	name: string;
	mime: string;
	data: ArrayBuffer;
}

export class ImportModal extends Modal {
	private plugin: DiscordEmojiPickerPlugin;
	private kind: MediaKind = 'emoji';
	private setName = '';
	private setCategory = '';
	private packOrg: 'per-pack' | 'combined' = 'per-pack';
	private combinedSetName = 'packs';
	private mode: ImportMode = 'url';
	private bodyEl!: HTMLElement;
	private dropZoneEl!: HTMLElement;
	private tabRowEl!: HTMLElement;
	private queueEl!: HTMLElement;
	private queueCountEl!: HTMLElement;
	private statusEl!: HTMLElement;
	private queue: QueuedItem[] = [];
	private nextId = 1;
	private objectUrls: string[] = [];
	private importing = false;
	private cancelImport = false;
	private importBtn!: HTMLButtonElement;
	private cancelBtn!: HTMLButtonElement;
	private clearBtn!: HTMLButtonElement;
	private setNameInput?: TextComponent;
	private setDropdown!: DropdownComponent;
	private guilds: DiscordGuild[] = [];
	private selectedGuildId = '';
	private discordEmojis: DiscordEmoji[] = [];
	private discordStickers: DiscordSticker[] = [];
	private onboarding?: GuidedTour;

	constructor(app: App, plugin: DiscordEmojiPickerPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl('h2', { text: 'Import emojis & stickers' });

		const kindSetting = new Setting(contentEl)
			.setName('Import into')
			.addDropdown((dropdown) =>
				dropdown
					.addOption(
						'emoji',
						this.plugin.settings.emojiFolder || 'Emoji folder',
					)
					.addOption(
						'sticker',
						this.plugin.settings.stickerFolder || 'Sticker folder',
					)
					.setValue(this.kind)
					.onChange((value) => {
						this.kind = value as MediaKind;
						this.refreshSetDropdown();
					}),
			);
		kindSetting.settingEl.toggleClass('gl-import-kind', true);

		const setSetting = new Setting(contentEl)
			.setName('Set (subfolder)')
			.setDesc(
				'Groups images into a subfolder, shown as a set in the picker. Leave empty for the folder root.',
			);
		setSetting.settingEl.toggleClass('gl-import-set-setting', true);
		setSetting.addDropdown((dropdown) => {
			this.setDropdown = dropdown;
			this.refreshSetDropdown();
			dropdown.onChange((value) => {
				this.setName = value;
				this.setNameInput?.setValue(value);
			});
		});
		setSetting.addButton((btn) =>
			btn
				.setIcon('folder-open')
				.setTooltip('Open set folder')
				.onClick(() =>
					openFolder(this.app, setFolderPath(this.currentFolder(), this.setName)),
				),
		);
		setSetting.addButton((btn) =>
			btn
				.setIcon('trash')
				.setTooltip('Delete set')
				.onClick(async () => {
					const setName = this.setName;
					if (!setName) {
						this.setStatus('Select a set to delete.');
						return;
					}
					if (
						await confirmAction(
							this.app,
							'Delete set',
							`Delete the "${setName}" set and all its images?`,
							'Delete',
						)
					) {
						await deleteSet(this.app, this.currentFolder(), setName);
						this.setName = '';
						this.setNameInput?.setValue('');
						this.refreshSetDropdown();
					}
				}),
		);

		const newSetSetting = new Setting(contentEl).setName('New set');
		newSetSetting.settingEl.toggleClass('gl-import-new-set', true);
		newSetSetting.addText((text) => {
			this.setNameInput = text;
			text.setPlaceholder('Set name');
		});
		newSetSetting.addButton((btn) =>
			btn.setButtonText('Create').onClick(async () => {
				const name = this.setNameInput?.getValue().trim() ?? '';
				if (!name) return;
				if (
					await ensureFolder(
						this.app,
						setFolderPath(this.currentFolder(), name),
					)
				) {
					this.setName = name;
					this.refreshSetDropdown();
					this.setStatus(`Created set "${name}".`);
				} else {
					this.setStatus('Could not create that set.');
				}
			}),
		);

		const categorySetting = new Setting(contentEl)
			.setName('Category (sub-subfolder)')
			.setDesc(
				'Optional second level inside the set — shown as a horizontal category bar in the picker.',
			);
		categorySetting.settingEl.toggleClass('gl-import-category', true);
		categorySetting.addText((text) => {
			text.setPlaceholder('E.g. Faces, animals, ...');
			text.onChange((value) => {
				this.setCategory = value.trim();
			});
		});

		this.dropZoneEl = contentEl.createDiv({
			cls: 'gl-import-dropzone',
			text: 'Drop emojis or stickers here — drag them straight from Discord',
		});
		this.dropZoneEl.addEventListener('dragover', (ev) => {
			ev.preventDefault();
			this.dropZoneEl.toggleClass('gl-import-dropzone-active', true);
		});
		this.dropZoneEl.addEventListener('dragleave', () => {
			this.dropZoneEl.toggleClass('gl-import-dropzone-active', false);
		});
		this.dropZoneEl.addEventListener('drop', (ev) => {
			ev.preventDefault();
			this.dropZoneEl.toggleClass('gl-import-dropzone-active', false);
			this.handleDrop(ev);
		});

		this.tabRowEl = contentEl.createDiv({ cls: 'gl-import-tabs' });
		for (const mode of Object.keys(MODE_LABELS) as ImportMode[]) {
			const btn = this.tabRowEl.createEl('button', {
				cls: `gl-import-tab${mode === this.mode ? ' active' : ''}`,
				attr: { type: 'button', 'data-mode': mode },
			});
			setIcon(btn, MODE_ICONS[mode]);
			btn.createSpan({ text: MODE_LABELS[mode] });
			btn.addEventListener('click', () => this.setMode(mode));
		}

		this.bodyEl = contentEl.createDiv({ cls: 'gl-import-body' });
		this.statusEl = contentEl.createDiv({ cls: 'gl-import-status' });
		this.renderBody();

		const queueBox = contentEl.createDiv({ cls: 'gl-import-queue' });
		this.queueCountEl = queueBox.createDiv({
			cls: 'gl-import-queue-title',
			text: 'Ready to import (0)',
		});
		this.queueEl = queueBox.createDiv({ cls: 'gl-import-queue-list' });
		this.renderQueue();

		const footer = contentEl.createDiv({ cls: 'gl-import-footer' });
		this.importBtn = footer.createEl('button', {
			cls: 'mod-cta',
			text: 'Import',
			attr: { type: 'button' },
		});
		this.importBtn.addEventListener('click', () => {
			void this.runImport();
		});
		this.cancelBtn = footer.createEl('button', {
			cls: 'gl-import-hidden',
			text: 'Cancel',
			attr: { type: 'button' },
		});
		this.cancelBtn.addEventListener('click', () => {
			this.cancelImport = true;
		});
		this.clearBtn = footer.createEl('button', {
			text: 'Clear',
			attr: { type: 'button' },
		});
		this.clearBtn.addEventListener('click', () => {
			this.queue = [];
			this.nextId = 1;
			this.renderQueue();
			this.setStatus('');
		});
		const helpBtn = footer.createEl('button', {
			cls: 'gl-import-help',
			attr: { type: 'button', 'aria-label': 'How to import' },
		});
		setIcon(helpBtn, 'help');
		helpBtn.addEventListener('click', () => this.runOnboarding());

		this.maybeRunOnboarding();
	}

	onClose() {
		this.onboarding?.destroy();
		this.onboarding = undefined;
		for (const url of this.objectUrls) URL.revokeObjectURL(url);
		this.objectUrls = [];
	}

	private maybeRunOnboarding() {
		if (
			this.plugin.settings.showOnboardingHint &&
			!this.plugin.settings.importOnboardingSeen
		) {
			this.runOnboarding();
		}
	}

	private runOnboarding() {
		if (this.onboarding) return;
		this.onboarding = new GuidedTour(
			this.contentEl,
			importTourSteps(),
			{},
			true,
		);
		this.onboarding.run(() => {
			this.onboarding = undefined;
			this.dismissOnboarding();
		});
	}

	private dismissOnboarding() {
		this.plugin.settings.importOnboardingSeen = true;
		void this.plugin.saveSettings();
	}

	private setMode(mode: ImportMode) {
		if (this.mode === mode) return;
		this.mode = mode;
		for (const btn of Array.from(this.tabRowEl.querySelectorAll('button'))) {
			btn.toggleClass('active', btn.getAttribute('data-mode') === mode);
		}
		this.renderBody();
	}

	private currentFolder(): string {
		return this.kind === 'emoji'
			? this.plugin.settings.emojiFolder
			: this.plugin.settings.stickerFolder;
	}

	private refreshSetDropdown() {
		const options: Record<string, string> = { '': '(none — folder root)' };
		for (const setName of listSets(this.app, this.currentFolder())) {
			options[setName] = setName;
		}
		this.setDropdown.addOptions(options).setValue(this.setName);
	}

	private renderBody() {
		this.bodyEl.empty();
		this.setStatus('');
		switch (this.mode) {
			case 'url': {
				const box = this.bodyEl.createDiv({ cls: 'gl-import-section' });
				box.createDiv({ cls: 'gl-import-section-label', text: 'Image links' });
				const textarea = box.createEl('textarea', {
					cls: 'gl-import-textarea',
					attr: {
						placeholder: 'Paste image urls, one per line...',
						rows: '5',
						spellcheck: 'false',
					},
				});
				box.createEl('button', {
					cls: 'gl-import-action',
					text: 'Add to queue',
					attr: { type: 'button' },
				}).addEventListener('click', () => {
					const urls = textarea.value
						.split(/\r?\n/)
						.map((line) => line.trim())
						.filter(Boolean);
					if (urls.length === 0) return;
					for (const url of urls) {
						this.queueItem({ name: baseName(url), kind: this.kind, url });
					}
					this.setStatus(`Queued ${urls.length} link(s).`);
				});
				break;
			}
			case 'discord': {
				const box = this.bodyEl.createDiv({ cls: 'gl-import-section' });
				box.createDiv({
					cls: 'gl-import-section-label',
					text: 'From Discord',
				});
				box.createDiv({
					cls: 'gl-import-hint',
					text: 'Drag an emoji or sticker straight from Discord into the drop zone above, or copy an emoji in Discord and use the Clipboard tab. You can also right-click an emoji or sticker in Discord, choose Copy link, and paste the links below.',
				});
				const textarea = box.createEl('textarea', {
					cls: 'gl-import-textarea',
					attr: {
						placeholder: 'Discord emoji or sticker links, one per line...',
						rows: '4',
						spellcheck: 'false',
					},
				});
				box.createEl('button', {
					cls: 'gl-import-action',
					text: 'Add to queue',
					attr: { type: 'button' },
				}).addEventListener('click', () => {
					const urls = textarea.value
						.split(/\r?\n/)
						.map((line) => line.trim())
						.filter(Boolean);
					if (urls.length === 0) return;
					for (const url of urls) {
						const kind = discordKindFromUrl(url) ?? this.kind;
						this.queueItem({
							name: discordNameFromUrl(url) ?? baseName(url),
							kind,
							url,
						});
					}
					this.setStatus(`Queued ${urls.length} Discord link(s).`);
				});

				const serverBox = this.bodyEl.createDiv({ cls: 'gl-import-section' });
				this.renderDiscordServer(serverBox);
				break;
			}
			case 'clipboard': {
				const box = this.bodyEl.createDiv({ cls: 'gl-import-section' });
				box.createDiv({
					cls: 'gl-import-section-label',
					text: 'Clipboard image',
				});
				box.createEl('button', {
					cls: 'gl-import-action',
					text: 'Read clipboard image',
					attr: { type: 'button' },
				}).addEventListener('click', () => {
					void this.scanClipboard();
				});
				break;
			}
			case 'note': {
				const box = this.bodyEl.createDiv({ cls: 'gl-import-section' });
				box.createDiv({
					cls: 'gl-import-section-label',
					text: 'Current note',
				});
				box.createDiv({
					cls: 'gl-import-hint',
					text: 'Adds every image in the active note (embeds and markdown image links).',
				});
				box.createEl('button', {
					cls: 'gl-import-action',
					text: 'Scan note',
					attr: { type: 'button' },
				}).addEventListener('click', () => {
					void this.scanNote();
				});
				break;
			}
			case 'pack': {
				const box = this.bodyEl.createDiv({ cls: 'gl-import-section' });
				let provider = packProviderById('twemoji');
				box.createDiv({
					cls: 'gl-import-section-label',
					text: 'Emoji packs',
				});
				box.createDiv({
					cls: 'gl-import-hint',
					text: 'Download whole emoji sets from open-license packs and save them into the folder above. The popular set is split into sub-category folders like twemoji/faces — or combine packs into one set with shared categories.',
				});
				new Setting(box)
					.setName('Pack')
					.addDropdown((dropdown) => {
						for (const p of PACK_PROVIDERS) {
							dropdown.addOption(p.id, p.label);
						}
						dropdown.onChange((value) => {
							provider = packProviderById(value);
							hint.setText(provider.hint);
						});
					});
				const hint = box.createDiv({
					cls: 'gl-import-hint',
					text: provider.hint,
				});
				new Setting(box)
					.setName('Category folders')
					.setDesc(
						'Per pack keeps each pack in its own set with categories inside. Combined merges all packs into one set with shared categories.',
					)
					.addDropdown((dropdown) => {
						dropdown
							.addOption('per-pack', 'Per pack')
							.addOption('combined', 'Combined');
						dropdown.setValue(this.packOrg);
						dropdown.onChange((value) => {
							this.packOrg = value as 'per-pack' | 'combined';
							combinedSetting.settingEl.toggleClass(
								'gl-import-hidden',
								this.packOrg !== 'combined',
							);
						});
					});
				const combinedSetting = new Setting(box)
					.setName('Combined set name')
					.addText((text) => {
						text.setValue(this.combinedSetName);
						text.onChange((value) => {
							this.combinedSetName =
								value.trim() || 'packs';
						});
					});
				combinedSetting.settingEl.toggleClass(
					'gl-import-hidden',
					this.packOrg !== 'combined',
				);
				const textarea = box.createEl('textarea', {
					cls: 'gl-import-textarea',
					attr: {
						placeholder:
							'Emoji names, one per line: smile, joy, :heart:, wink, ...',
						rows: '5',
						spellcheck: 'false',
					},
				});
				box.createEl('button', {
					cls: 'gl-import-action',
					text: 'Add popular set',
					attr: { type: 'button' },
				}).addEventListener('click', () => {
					void this.addPopularSet(provider);
				});
				box.createEl('button', {
					cls: 'gl-import-action',
					text: 'Add to queue',
					attr: { type: 'button' },
				}).addEventListener('click', () => {
					void this.addPackCodes(textarea.value, provider);
				});
				box.createDiv({
					cls: 'gl-import-hint',
					text: 'No internet? Add the system emoji set — it is rendered locally from the emoji font on your device, with no download.',
				});
				box.createEl('button', {
					cls: 'gl-import-action',
					text: 'Add system emoji set (offline)',
					attr: { type: 'button' },
				}).addEventListener('click', () => {
					void this.addSystemEmojis();
				});
				break;
			}
		}
	}

	private handleDrop(ev: DragEvent) {
		const dt = ev.dataTransfer;
		if (!dt) return;
		const droppedSet = this.suggestSetFromDrop(dt);
		if (droppedSet && !this.setName) {
			this.setName = droppedSet;
			this.refreshSetDropdown();
			this.setNameInput?.setValue(droppedSet);
		}
		for (const file of Array.from(dt.files ?? [])) {
			if (!SUPPORTED_EXTENSIONS.has(extFromFileName(file.name))) continue;
			void file.arrayBuffer().then((data) => {
				this.queueItem({
					name: file.name,
					kind: this.kind,
					data,
					mime: file.type || undefined,
				});
			});
		}
		const uris = (dt.getData('text/uri-list') || dt.getData('text/plain') || '')
			.split(/\r?\n/);
		for (const line of uris) {
			const url = (line.trim().split(/\s+/)[0] ?? '').trim();
			if (!/^https?:\/\//i.test(url)) continue;
			const kind = discordKindFromUrl(url) ?? this.kind;
			this.queueItem({ name: discordNameFromUrl(url) ?? baseName(url), kind, url });
		}
	}

	private async scanClipboard() {
		this.setStatus('Reading clipboard...');
		try {
			const images = await readClipboardImages();
			let added = 0;
			for (const img of images) {
				this.queueItem({
					name: img.name,
					kind: this.kind,
					data: img.data,
					mime: img.mime,
				});
				added++;
			}
			this.setStatus(
				added > 0
					? `Queued ${added} image(s).`
					: 'No image found on the clipboard.',
			);
		} catch {
			this.setStatus(
				'Could not read the clipboard. Paste into a note and use “from note”.',
			);
		}
	}

	private async scanNote() {
		this.setStatus('Scanning note...');
		const sources = await collectNoteImages(this.app);
		if (sources.length === 0) {
			this.setStatus('No images found in the current note.');
			return;
		}
		for (const src of sources) {
			this.queueItem({
				name: src.name ?? 'image',
				kind: this.kind,
				url: src.url,
				vaultPath: src.vaultPath,
			});
		}
		this.setStatus(`Queued ${sources.length} image(s) from the note.`);
	}

		private packSetName(providerId: string): string {
		return this.packOrg === 'combined' ? this.combinedSetName : providerId;
	}

	private async addSystemEmojis() {
		this.setStatus('Rendering system emoji set...');
		const baseSet = this.packSetName('system');
		let added = 0;
		const failed: string[] = [];
		for (const group of SYSTEM_EMOJI_GROUPS) {
			for (const emoji of group.items) {
				try {
					const data = await renderSystemEmojiPng(emoji.char);
					this.queueItem({
						name: emoji.name,
						kind: this.kind,
						data,
						mime: 'image/png',
						setName: baseSet,
						category: group.category,
					});
					added++;
				} catch {
					failed.push(emoji.name);
				}
			}
		}
		this.setStatus(
			`Queued ${added} system emoji(s)` +
				(failed.length
					? `, ${failed.length} failed: ${failed.slice(0, 8).join(', ')}${failed.length > 8 ? '...' : ''}.`
					: '.'),
		);
	}

	private async addPopularSet(provider: PackProvider) {
		this.setStatus('Resolving emoji names...');
		const baseSet = this.packSetName(provider.id);
		let added = 0;
		let failed = 0;
		for (const category of POPULAR_CATEGORIES) {
			for (const code of category.codes) {
				const url = await packUrlForCode(code, provider);
				if (url) {
					const clean = normalizeCode(code).replace(/[^a-z0-9_-]/g, '');
					this.queueItem({
						name: clean || code,
						kind: 'emoji',
						url,
						setName: baseSet,
						category: category.name,
					});
					added++;
				} else {
					failed++;
				}
			}
		}
		this.setStatus(
			`Queued ${added} emoji(s) in ${POPULAR_CATEGORIES.length} categories` +
				(failed ? `, ${failed} not found.` : '.'),
		);
	}

	private async addPackCodes(text: string, provider: PackProvider) {
		this.setName = provider.id;
		this.refreshSetDropdown();
		this.setNameInput?.setValue(this.setName);
		const codes = text
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter(Boolean);
		if (codes.length === 0) return;
		this.setStatus('Resolving emoji names...');
		let added = 0;
		let failed = 0;
		for (const code of codes) {
			const url = await packUrlForCode(code, provider);
			if (url) {
				const clean = normalizeCode(code).replace(/[^a-z0-9_-]/g, '');
				this.queueItem({
					name: clean || code,
					kind: 'emoji',
					url,
					setName: this.packSetName(provider.id),
					category: 'custom',
				});
				added++;
			} else {
				failed++;
			}
		}
		this.setStatus(
			`Queued ${added} emoji(s)` + (failed ? `, ${failed} not found.` : '.'),
		);
	}

	private suggestSetFromDrop(dt: DataTransfer): string {
		for (const file of Array.from(dt.files ?? [])) {
			const rel = file.webkitRelativePath;
			if (!rel) continue;
			const parts = rel.split('/').filter(Boolean);
			if (parts.length < 2) continue;
			const first = parts[0];
			if (!first) continue;
			const name = sanitizeName(first);
			if (name) return name;
		}
		return '';
	}

	private renderDiscordServer(box: HTMLElement) {
		box.empty();
		box.createDiv({
			cls: 'gl-import-section-label',
			text: 'Clone a server',
		});
		box.createDiv({
			cls: 'gl-import-hint',
			text: 'Requires a Discord token in settings. Downloads every emoji and sticker from one of your servers.',
		});
		if (!this.plugin.settings.discordToken) {
			box.createDiv({
				cls: 'gl-import-hint',
				text: 'No Discord token set. Add one in Settings → Discord Emoji Picker → Discord.',
			});
			return;
		}

		box.createEl('button', {
			cls: 'gl-import-action',
			text: this.guilds.length ? 'Reload servers' : 'Load servers',
			attr: { type: 'button' },
		}).addEventListener('click', () => {
			void this.loadGuilds(box);
		});

		if (this.guilds.length === 0) return;

		const select = box.createEl('select', { cls: 'gl-import-select' });
		for (const guild of this.guilds) {
			const option = select.createEl('option', {
				text: guild.name,
				attr: { value: guild.id },
			});
			if (guild.id === this.selectedGuildId) option.setAttr('selected', '');
		}
		select.addEventListener('change', () => {
			this.selectedGuildId = select.value;
			this.discordEmojis = [];
			this.discordStickers = [];
			this.renderDiscordServer(box);
		});

		box.createEl('button', {
			cls: 'gl-import-action',
			text: 'Load emojis & stickers',
			attr: { type: 'button' },
		}).addEventListener('click', () => {
			void this.loadGuildExpressions(box);
		});

		if (this.discordEmojis.length === 0 && this.discordStickers.length === 0) {
			return;
		}

		const emojiLabel = box.createEl('label', { cls: 'gl-import-check' });
		const emojiCheck = emojiLabel.createEl('input', {
			attr: { type: 'checkbox' },
		});
		emojiCheck.setAttr('checked', '');
		emojiLabel.appendText(` ${this.discordEmojis.length} emojis`);

		const stickerLabel = box.createEl('label', { cls: 'gl-import-check' });
		const stickerCheck = stickerLabel.createEl('input', {
			attr: { type: 'checkbox' },
		});
		stickerCheck.setAttr('checked', '');
		stickerLabel.appendText(` ${this.discordStickers.length} stickers`);

		box.createEl('button', {
			cls: 'gl-import-action',
			text: 'Add selected to queue',
			attr: { type: 'button' },
		}).addEventListener('click', () => {
			let added = 0;
			if (emojiCheck.checked) {
				for (const emoji of this.discordEmojis) {
					this.queueItem({
						name: emoji.name,
						kind: 'emoji',
						url: discordEmojiUrl(emoji.id, emoji.animated),
					});
					added++;
				}
			}
			if (stickerCheck.checked) {
				for (const sticker of this.discordStickers) {
					if (sticker.format_type === 3) continue;
					this.queueItem({
						name: sticker.name,
						kind: 'sticker',
						url: discordStickerUrl(sticker.id, sticker.format_type),
					});
					added++;
				}
			}
			this.setStatus(`Queued ${added} from the server.`);
		});
	}

	private async loadGuilds(box: HTMLElement) {
		this.setStatus('Loading servers...');
		try {
			const client = this.discordClient();
			const guilds = await client.guilds();
			if (guilds.length === 0) {
				this.setStatus('No servers found for this token.');
				return;
			}
			this.guilds = guilds;
			this.selectedGuildId = guilds[0]?.id ?? '';
			this.renderDiscordServer(box);
			this.setStatus(`Loaded ${guilds.length} servers.`);
		} catch {
			this.setStatus('Could not load servers. Check your token in settings.');
		}
	}

	private async loadGuildExpressions(box: HTMLElement) {
		if (!this.selectedGuildId) return;
		this.setStatus('Loading emojis & stickers...');
		try {
			const client = this.discordClient();
			this.discordEmojis = await client.emojis(this.selectedGuildId);
			this.discordStickers = await client.stickers(this.selectedGuildId);
			this.renderDiscordServer(box);
			this.setStatus(
				`Loaded ${this.discordEmojis.length} emojis, ${this.discordStickers.length} stickers.`,
			);
		} catch {
			this.setStatus('Could not load emojis & stickers.');
		}
	}

	private discordClient(): DiscordClient {
		return new DiscordClient(
			this.plugin.settings.discordToken,
			this.plugin.settings.discordTokenType,
		);
	}

	private queueItem(item: Omit<QueuedItem, 'id' | 'status'>) {
		this.queue.push({ id: this.nextId++, status: 'pending', ...item });
		this.renderQueue();
	}

	private removeItem(id: number) {
		this.queue = this.queue.filter((item) => item.id !== id);
		this.renderQueue();
	}

	private renderQueue() {
		this.queueEl.empty();
		const pending = this.queue.filter(
			(item) => !item.status || item.status === 'pending',
		).length;
		this.queueCountEl.setText(`Ready to import (${pending})`);
		if (this.queue.length === 0) {
			this.queueEl.createDiv({
				cls: 'gl-import-empty',
				text: 'Nothing queued yet. Add images from a tab above or drop them in.',
			});
			return;
		}
		const groups = new Map<string, QueuedItem[]>();
		for (const item of this.queue) {
			const label = this.groupLabel(item);
			const group = groups.get(label);
			if (group) group.push(item);
			else groups.set(label, [item]);
		}
		for (const [label, items] of groups) {
			this.queueEl.createDiv({ cls: 'gl-import-group', text: label });
			for (const item of items) this.renderQueueItem(item);
		}
	}

	private groupLabel(item: QueuedItem): string {
		const set = (item.setName ?? this.setName).trim();
		const category = (item.category ?? this.setCategory).trim();
		if (!set) return 'Folder root';
		return category ? `${set} / ${category}` : set;
	}

	private renderQueueItem(item: QueuedItem) {
		const row = this.queueEl.createDiv({
			cls: 'gl-import-item',
			attr: { 'data-id': item.id },
		});
		row.createEl('img', {
			attr: {
				src: this.thumbUrl(item),
				alt: item.name,
				loading: 'lazy',
				draggable: 'false',
			},
		});
		const info = row.createDiv({ cls: 'gl-import-item-info' });
		info.createDiv({ cls: 'gl-import-item-name', text: item.name || 'image' });
		info.createDiv({ cls: 'gl-import-item-kind', text: item.kind });
		const status = row.createSpan({ cls: 'gl-import-item-status' });
		if (item.status === 'ok') {
			status.toggleClass('ok', true);
			status.setText('✓');
		} else if (item.status === 'fail') {
			status.toggleClass('fail', true);
			status.setText('✕');
		}
		const remove = row.createEl('button', {
			cls: 'gl-import-item-remove',
			attr: { type: 'button', 'aria-label': 'Remove' },
		});
		setIcon(remove, 'x');
		remove.addEventListener('click', () => this.removeItem(item.id));
	}

	private updateItemStatus(id: number) {
		const item = this.queue.find((candidate) => candidate.id === id);
		const row = this.queueEl.querySelector(`[data-id="${id}"]`);
		if (!item || !row) return;
		const badge = row.querySelector('.gl-import-item-status');
		if (badge) {
			badge.empty();
			badge.toggleClass('ok', item.status === 'ok');
			badge.toggleClass('fail', item.status === 'fail');
			badge.setText(
				item.status === 'ok' ? '✓' : item.status === 'fail' ? '✕' : '',
			);
		}
		const pending = this.queue.filter(
			(candidate) => !candidate.status || candidate.status === 'pending',
		).length;
		this.queueCountEl.setText(`Ready to import (${pending})`);
	}

	private thumbUrl(item: QueuedItem): string {
		if (item.data) {
			const url = URL.createObjectURL(
				new Blob([item.data], { type: item.mime || 'image/png' }),
			);
			this.objectUrls.push(url);
			return url;
		}
		if (item.vaultPath) {
			const file = this.app.vault.getAbstractFileByPath(item.vaultPath);
			return file instanceof TFile ? this.app.vault.getResourcePath(file) : '';
		}
		return item.url ?? '';
	}

private async runImport() {
		if (this.importing) return;
		const pending = this.queue.filter(
			(item) => !item.status || item.status === 'pending',
		);
		if (pending.length === 0) {
			this.setStatus('Nothing to import. Add items to the queue first.');
			return;
		}
		this.importing = true;
		this.cancelImport = false;
		this.importBtn.toggleClass('gl-import-hidden', true);
		this.clearBtn.toggleClass('gl-import-hidden', true);
		this.cancelBtn.toggleClass('gl-import-hidden', false);
		const total = pending.length;
		let done = 0;
		let success = 0;
		let failed = 0;
		this.setStatus(`Importing 0 of ${total}...`);
		for (const item of pending) {
			if (this.cancelImport) break;
			const ok = await importQueuedItem(
				this.app,
				this.plugin,
				item,
				this.setName,
				this.setCategory,
			);
			item.status = ok ? 'ok' : 'fail';
			if (ok) success++;
			else failed++;
			done++;
			this.updateItemStatus(item.id);
			this.setStatus(`Importing ${done} of ${total}...`);
			await delay(60);
		}
		this.importing = false;
		this.importBtn.toggleClass('gl-import-hidden', false);
		this.clearBtn.toggleClass('gl-import-hidden', false);
		this.cancelBtn.toggleClass('gl-import-hidden', true);
		this.setStatus(
			this.cancelImport
				? `Cancelled after ${done} — ${success} imported, ${failed} failed.`
				: `Done: ${success} imported, ${failed} failed.`,
		);
		if (success > 0) {
			new Notice(`Imported ${success} image${success === 1 ? '' : 's'}.`);
			this.plugin.refreshPicker();
		}
	}

	private setStatus(text: string) {
		if (!this.statusEl) return;
		this.statusEl.setText(text);
	}
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function importTourSteps(): TourStep[] {
	return [
		{
			selector: '.gl-import-kind',
			title: 'Import into',
			text: 'Choose whether new images land in the emoji folder or the sticker folder.',
			placement: 'bottom',
			hue: 190,
		},
		{
			selector: '.gl-import-set-setting',
			title: 'Set (subfolder)',
			text: 'Groups images into a set inside the folder — sets show up as sections in the picker. Leave it empty for the folder root.',
			placement: 'bottom',
			hue: 220,
		},
		{
			selector: '.gl-import-new-set',
			title: 'New set',
			text: 'Type a name and press Create to make a new set before adding images.',
			placement: 'bottom',
			hue: 245,
		},
		{
			selector: '.gl-import-category',
			title: 'Category',
			text: 'Optional second level inside a set — shown as a horizontal category bar in the picker.',
			placement: 'bottom',
			hue: 275,
		},
		{
			selector: '.gl-import-dropzone',
			title: 'Drop zone',
			text: 'Drag emojis or stickers straight from Discord — or from your computer — into this area.',
			placement: 'bottom',
			hue: 200,
		},
		{
			selector: '.gl-import-tabs',
			title: 'Sources',
			text: 'Pick a source: paste links, read your clipboard, scan the current note, or download a whole emoji pack.',
			placement: 'bottom',
			hue: 265,
		},
		{
			selector: '.gl-import-queue',
			title: 'Queue',
			text: 'Everything you add lands here. Review the list and remove anything you do not want.',
			placement: 'top',
			hue: 45,
		},
		{
			selector: '.gl-import-footer',
			title: 'Import',
			text: 'Saves the queued items into your emoji and sticker folders, ready for the picker.',
			placement: 'top',
			hue: 130,
		},
	];
}

async function importQueuedItem(
	app: App,
	plugin: DiscordEmojiPickerPlugin,
	item: QueuedItem,
	modalSetName: string,
	modalCategory: string,
): Promise<boolean> {
	const folder =
		item.kind === 'emoji'
			? plugin.settings.emojiFolder
			: plugin.settings.stickerFolder;
	if (!folder.trim()) return false;
	const setName = item.setName ?? modalSetName;
	const target = {
		folder,
		setName,
		category: item.category ?? modalCategory,
	};
	if (item.data) {
		return saveImage(app, item.data, item.mime ?? '', target, item.name);
	}
	if (item.vaultPath) {
		const file = app.vault.getAbstractFileByPath(item.vaultPath);
		if (!(file instanceof TFile) || !SUPPORTED_EXTENSIONS.has(file.extension)) {
			return false;
		}
		const data = await app.vault.readBinary(file);
		return saveImage(
			app,
			data,
			`image/${file.extension}`,
			target,
			item.name,
		);
	}
	if (item.url) {
		return importFromUrl(app, item.url, target, item.name);
	}
	return false;
}

async function importFromUrl(
	app: App,
	url: string,
	target: { folder: string; setName: string },
	name?: string,
): Promise<boolean> {
	try {
		const res = await requestUrl({ url });
		if (res.status < 200 || res.status >= 300) return false;
		const mime = res.headers['content-type'] ?? '';
		return saveImage(app, res.arrayBuffer, mime, target, name ?? baseName(url));
	} catch {
		return false;
	}
}

async function saveImage(
	app: App,
	data: ArrayBuffer,
	mime: string,
	target: { folder: string; setName: string },
	name: string,
): Promise<boolean> {
	try {
		const ext = extFromName(name) ?? extFromMime(mime) ?? 'png';
		const dot = name.lastIndexOf('.');
		const raw = extFromName(name) && dot > 0 ? name.slice(0, dot) : name;
		const stem = sanitizeName(raw);
		const fileName = stem ? `${stem}.${ext}` : `image-${Date.now()}.${ext}`;
		const dir = targetDir(target);
		await ensureFolder(app, dir);
		const path = await uniquePath(app, dir, fileName);
		await app.vault.createBinary(path, data);
		return true;
	} catch {
		return false;
	}
}

async function readClipboardImages(): Promise<ClipboardImage[]> {
	const items = await navigator.clipboard.read();
	const out: ClipboardImage[] = [];
	for (const item of items) {
		const type = item.types.find((t) => t.startsWith('image/'));
		if (!type) continue;
		const blob = await item.getType(type);
		out.push({
			name: `clipboard-${out.length + 1}`,
			mime: type,
			data: await blob.arrayBuffer(),
		});
	}
	return out;
}

async function collectNoteImages(app: App): Promise<NoteImage[]> {
	const file = app.workspace.getActiveFile();
	if (!file) return [];
	const content = await app.vault.cachedRead(file);
	const sources: NoteImage[] = [];

	const wiki = /!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g;
	let match: RegExpExecArray | null;
	while ((match = wiki.exec(content))) {
		const path = match[1]?.trim() ?? '';
		sources.push({ name: baseName(path), vaultPath: path });
	}

	const md = /!\[[^\]]*\]\(([^)]+)\)/g;
	while ((match = md.exec(content))) {
		const raw = match[1]?.trim() ?? '';
		if (/^https?:\/\//i.test(raw)) {
			sources.push({ name: baseName(raw), url: raw });
		} else if (/\.(png|jpe?g|gif|webp|svg|bmp|apng)$/i.test(raw)) {
			sources.push({ name: baseName(raw), vaultPath: raw });
		}
	}
	return sources;
}

function targetDir(target: {
	folder: string;
	setName: string;
	category?: string;
}): string {
	const root = target.folder
		.trim()
		.replace(/\\/g, '/')
		.replace(/^\/+|\/+$/g, '');
	const set = target.setName
		.trim()
		.replace(/\\/g, '/')
		.replace(/^\/+|\/+$/g, '');
	const category = (target.category ?? '')
		.trim()
		.replace(/\\/g, '/')
		.replace(/^\/+|\/+$/g, '');
	if (set && category) return `${root}/${set}/${category}`;
	if (set) return `${root}/${set}`;
	return root;
}

async function ensureFolder(app: App, dir: string): Promise<boolean> {
	if (!dir) return false;
	if (app.vault.getAbstractFileByPath(dir)) return true;
	try {
		await app.vault.createFolder(dir);
		return true;
	} catch {
		return false;
	}
}

async function uniquePath(
	app: App,
	dir: string,
	fileName: string,
): Promise<string> {
	const dot = fileName.lastIndexOf('.');
	const stem = dot > 0 ? fileName.slice(0, dot) : fileName;
	const ext = dot > 0 ? fileName.slice(dot) : '';
	let candidate = fileName;
	let i = 1;
	while (
		app.vault.getAbstractFileByPath(dir ? `${dir}/${candidate}` : candidate)
	) {
		candidate = `${stem}-${i}${ext}`;
		i++;
	}
	return dir ? `${dir}/${candidate}` : candidate;
}

function extFromName(name: string): string | undefined {
	const base = name.split(/[?#]/)[0] ?? name;
	const last = base.split(/[\\/]/).pop() ?? '';
	const dot = last.lastIndexOf('.');
	if (dot <= 0) return undefined;
	const ext = last.slice(dot + 1).toLowerCase();
	return SUPPORTED_EXTENSIONS.has(ext) ? ext : undefined;
}

function extFromFileName(name: string): string {
	const dot = name.lastIndexOf('.');
	return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}

function extFromMime(mime: string): string | undefined {
	const m = (mime.toLowerCase().split(';')[0] ?? '').trim();
	const map: Record<string, string> = {
		'image/png': 'png',
		'image/jpeg': 'jpg',
		'image/jpg': 'jpg',
		'image/gif': 'gif',
		'image/webp': 'webp',
		'image/svg+xml': 'svg',
		'image/bmp': 'bmp',
		'image/apng': 'apng',
	};
	return map[m];
}

function discordKindFromUrl(url: string): MediaKind | undefined {
	if (/\/stickers\//.test(url)) return 'sticker';
	if (/\/emojis\//.test(url)) return 'emoji';
	return undefined;
}

function discordNameFromUrl(url: string): string | undefined {
	try {
		const name = new URL(url).searchParams.get('name');
		return name && name.length > 0 ? name : undefined;
	} catch {
		return undefined;
	}
}