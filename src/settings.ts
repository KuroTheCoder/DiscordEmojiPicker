import {
	App,
	MarkdownView,
	Notice,
	PluginSettingTab,
	Setting,
	SettingDefinitionItem,
	SettingDefinitionRender,
	SettingGroupItem,
	SliderComponent,
} from 'obsidian';
import DiscordEmojiPickerPlugin from './main';
import { DiscordClient, DiscordTokenType } from './discord';
import {
	confirmAction,
	deleteSet,
	ensureFolder,
	listSets,
	openFolder,
	setFolderPath,
} from './utils/folders';

export type InsertStyle = 'shortcode' | 'embed' | 'html';

export type PickerTheme = 'default' | 'compact' | 'vibrant' | 'minimal';

export interface DiscordEmojiPickerSettings {
	emojiFolder: string;
	stickerFolder: string;
	recentlyUsed: string[];
	emojiSize: number;
	stickerSize: number;
	insertStyle: InsertStyle;
	renderShortcodesInEditor: boolean;
	pickerTheme: PickerTheme;
	discordToken: string;
	discordTokenType: DiscordTokenType;
}

export const DEFAULT_SETTINGS: DiscordEmojiPickerSettings = {
	emojiFolder: '.gl-emoji',
	stickerFolder: '.gl-stickers',
	recentlyUsed: [],
	emojiSize: 42,
	stickerSize: 96,
	insertStyle: 'shortcode',
	renderShortcodesInEditor: true,
	pickerTheme: 'default',
	discordToken: '',
	discordTokenType: 'user',
};

interface SizeOptions {
	min: number;
	max: number;
	step: number;
	def: number;
}

export class DiscordEmojiPickerSettingTab extends PluginSettingTab {
	plugin: DiscordEmojiPickerPlugin;
	private emojiNewSet = '';
	private stickerNewSet = '';

	constructor(app: App, plugin: DiscordEmojiPickerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Emoji folder')
			.setDesc(
				'Vault folder with emoji images (PNG/GIF/webp). Each subfolder becomes a set; images in the folder root form the general set.',
			)
			.setTooltip('Images inside this folder appear under the emoji pill.')
			.addText((text) =>
				text
					.setPlaceholder('Emoji')
					.setValue(this.plugin.settings.emojiFolder)
					.onChange(async (value) => {
						this.plugin.settings.emojiFolder = value.trim();
						await this.plugin.saveSettings();
					}),
			)
			.addExtraButton((btn) =>
				btn
					.setIcon('folder-open')
					.setTooltip('Open folder')
					.onClick(() =>
						openFolder(this.app, this.plugin.settings.emojiFolder),
					),
			);

		this.buildSetManager(containerEl, 'emoji');

		new Setting(containerEl)
			.setName('Sticker folder')
			.setDesc(
				'Vault folder with sticker images (PNG/GIF/webp). Each subfolder becomes a set; images in the folder root form the general set.',
			)
			.setTooltip('Images inside this folder appear under the sticker pill.')
			.addText((text) =>
				text
					.setPlaceholder('Stickers')
					.setValue(this.plugin.settings.stickerFolder)
					.onChange(async (value) => {
						this.plugin.settings.stickerFolder = value.trim();
						await this.plugin.saveSettings();
					}),
			)
			.addExtraButton((btn) =>
				btn
					.setIcon('folder-open')
					.setTooltip('Open folder')
					.onClick(() =>
						openFolder(this.app, this.plugin.settings.stickerFolder),
					),
			);

		this.buildSetManager(containerEl, 'sticker');

		new Setting(containerEl)
			.setName('Insert style')
			.setDesc('How emojis and stickers are inserted into notes.')
			.setTooltip(
				'Shortcode (:name:) renders as an image in the preview and is easy to edit or delete. Embed uses the native [[image|size]] embed. HTML inserts a raw <img> tag.',
			)
			.addDropdown((dropdown) =>
				dropdown
					.addOption('shortcode', 'Shortcode (:name:)')
					.addOption('embed', 'Embed ([[image|size]])')
					.addOption('html', 'HTML (<img>)')
					.setValue(this.plugin.settings.insertStyle)
					.onChange(async (value) => {
						this.plugin.settings.insertStyle = value as InsertStyle;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Render shortcodes in editor')
			.setDesc(
				'Show shortcode images while editing in live preview and source mode.',
			)
			.setTooltip(
				'When disabled, shortcodes only render in reading mode.',
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.renderShortcodesInEditor)
					.onChange(async (value) => {
						this.plugin.settings.renderShortcodesInEditor = value;
						await this.plugin.saveSettings();
						this.refreshEditors();
					}),
			);

		this.addSizeSetting(containerEl, 'emojiSize', {
			label: 'Emoji size',
			desc: 'Width of emoji images in the picker and when inserted.',
			tooltip: 'Controls the grid size in the picker and the size of shortcodes and embeds in the note.',
			opts: { min: 24, max: 160, step: 2, def: 42 },
		});

		this.addSizeSetting(containerEl, 'stickerSize', {
			label: 'Sticker size',
			desc: 'Width of sticker images in the picker and when inserted.',
			tooltip: 'Controls the grid size in the picker and the size of shortcodes and embeds in the note.',
			opts: { min: 48, max: 320, step: 4, def: 96 },
		});

		new Setting(containerEl)
			.setName('Picker theme')
			.setDesc('Visual style of the emoji picker panel.')
			.setTooltip(
				'Choose how the picker looks. The picker is styled with --gl-* CSS variables, so you can also restyle it with your own snippet.',
			)
			.addDropdown((dropdown) =>
				dropdown
					.addOption('default', 'Default')
					.addOption('compact', 'Compact')
					.addOption('vibrant', 'Vibrant')
					.addOption('minimal', 'Minimal')
					.setValue(this.plugin.settings.pickerTheme)
					.onChange(async (value) => {
						this.plugin.settings.pickerTheme = value as PickerTheme;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Clear recently used')
			.setDesc('Remove the emoji and sticker history shown in the picker.')
			.setTooltip('Empties the recently used row in both pills.')
			.addButton((btn) =>
				btn.setButtonText('Clear').onClick(async () => {
					this.plugin.settings.recentlyUsed = [];
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl).setName('Discord').setHeading();

		new Setting(containerEl)
			.setName('Discord token')
			.setDesc('Used to clone emojis and stickers from your servers.')
			.setTooltip(
				'The token is stored locally in this vault and only sent to Discord. Warning: using your personal user token violates Discord’s terms of service and can get your account flagged or banned — the same risk you already take with vencord. A bot token is safe; add the bot to the servers you want to clone from.',
			)
			.addText((text) => {
				text
					.setPlaceholder('Token')
					.setValue(this.plugin.settings.discordToken)
					.onChange(async (value) => {
						this.plugin.settings.discordToken = value.trim();
						await this.plugin.saveSettings();
					});
				text.inputEl.type = 'password';
			});

		new Setting(containerEl)
			.setName('Token type')
			.setDesc('Whether the token belongs to your account or to a bot.')
			.addDropdown((dropdown) =>
				dropdown
					.addOption('user', 'User account')
					.addOption('bot', 'Bot')
					.setValue(this.plugin.settings.discordTokenType)
					.onChange(async (value) => {
						this.plugin.settings.discordTokenType =
							value as DiscordTokenType;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Test connection')
			.setDesc('Checks the token and shows the account name.')
			.addButton((btn) =>
				btn.setButtonText('Test').onClick(async () => {
					const token = this.plugin.settings.discordToken;
					if (!token) {
						new Notice('Set a Discord token first.');
						return;
					}
					try {
						const client = new DiscordClient(
							token,
							this.plugin.settings.discordTokenType,
						);
						const me = await client.me();
						new Notice(
							`Connected as ${me.username ?? me.id ?? 'unknown'}.`,
						);
					} catch {
						new Notice('Could not connect. Check the token and type.');
					}
				}),
			);
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			this.folderDef(
				'Emoji folder',
				'Vault folder with emoji images (PNG/GIF/webp). Each subfolder becomes a set; images in the folder root form the general set.',
				'Images inside this folder appear under the emoji pill.',
				'emojiFolder',
				'Emoji',
			),
			{
				type: 'group',
				heading: 'Emoji sets',
				cls: 'gl-sets',
				items: this.setItems('emoji'),
			},
			this.folderDef(
				'Sticker folder',
				'Vault folder with sticker images (PNG/GIF/webp). Each subfolder becomes a set; images in the folder root form the general set.',
				'Images inside this folder appear under the sticker pill.',
				'stickerFolder',
				'Stickers',
			),
			{
				type: 'group',
				heading: 'Sticker sets',
				cls: 'gl-sets',
				items: this.setItems('sticker'),
			},
			this.dropdownDef(
				'Insert style',
				'How emojis and stickers are inserted into notes.',
				'Shortcode (:name:) renders as an image in the preview and is easy to edit or delete. Embed uses the native [[image|size]] embed. HTML inserts a raw <img> tag.',
				'insertStyle',
				[
					['shortcode', 'Shortcode (:name:)'],
					['embed', 'Embed ([[image|size]])'],
					['html', 'HTML (<img>)'],
				],
			),
			this.toggleDef(
				'Render shortcodes in editor',
				'Show shortcode images while editing in live preview and source mode.',
				'When disabled, shortcodes only render in reading mode.',
				'renderShortcodesInEditor',
			),
			this.sliderDef(
				'Emoji size',
				'Width of emoji images in the picker and when inserted.',
				'Controls the grid size in the picker and the size of shortcodes and embeds in the note.',
				'emojiSize',
				{ min: 24, max: 160, step: 2, def: 42 },
			),
			this.sliderDef(
				'Sticker size',
				'Width of sticker images in the picker and when inserted.',
				'Controls the grid size in the picker and the size of shortcodes and embeds in the note.',
				'stickerSize',
				{ min: 48, max: 320, step: 4, def: 96 },
			),
			this.dropdownDef(
				'Picker theme',
				'Visual style of the emoji picker panel.',
				'Choose how the picker looks. The picker is styled with --gl-* CSS variables, so you can also restyle it with your own snippet.',
				'pickerTheme',
				[
					['default', 'Default'],
					['compact', 'Compact'],
					['vibrant', 'Vibrant'],
					['minimal', 'Minimal'],
				],
			),
			this.actionDef(
				'Clear recently used',
				'Remove the emoji and sticker history shown in the picker.',
				'Empties the recently used row in both pills.',
				'Clear',
				async () => {
					this.plugin.settings.recentlyUsed = [];
					await this.plugin.saveSettings();
				},
			),
			{
				type: 'group',
				heading: 'Discord',
				items: [
					this.tokenDef(),
					this.dropdownDef(
						'Token type',
						'Whether the token belongs to your account or to a bot.',
						'',
						'discordTokenType',
						[
							['user', 'User account'],
							['bot', 'Bot'],
						],
					),
					this.actionDef(
						'Test connection',
						'Checks the token and shows the account name.',
						'',
						'Test',
						async () => {
							const token = this.plugin.settings.discordToken;
							if (!token) {
								new Notice('Set a Discord token first.');
								return;
							}
							try {
								const client = new DiscordClient(
									token,
									this.plugin.settings.discordTokenType,
								);
								const me = await client.me();
								new Notice(
									`Connected as ${me.username ?? me.id ?? 'unknown'}.`,
								);
							} catch {
								new Notice(
									'Could not connect. Check the token and type.',
								);
							}
						},
					),
				],
			},
		];
	}

	private settingDef(
		name: string,
		desc: string,
		tooltip: string,
		aliases: string[],
		render: (setting: Setting) => void,
	): SettingDefinitionRender {
		return {
			name,
			desc,
			aliases,
			render: (setting) => {
				if (tooltip) setting.setTooltip(tooltip);
				render(setting);
			},
		};
	}

	private folderDef(
		name: string,
		desc: string,
		tooltip: string,
		key: 'emojiFolder' | 'stickerFolder',
		placeholder: string,
	): SettingDefinitionRender {
		return this.settingDef(
			name,
			desc,
			tooltip,
			['folder', 'set'],
			(setting) => {
				setting.addText((text) =>
					text
						.setPlaceholder(placeholder)
						.setValue(this.plugin.settings[key])
						.onChange(async (value) => {
							this.plugin.settings[key] = value.trim();
							await this.plugin.saveSettings();
						}),
				);
				setting.addExtraButton((btn) =>
					btn
						.setIcon('folder-open')
						.setTooltip('Open folder')
						.onClick(() =>
							openFolder(this.app, this.plugin.settings[key]),
						),
				);
			},
		);
	}

	private dropdownDef<
		K extends 'insertStyle' | 'pickerTheme' | 'discordTokenType',
	>(
		name: string,
		desc: string,
		tooltip: string,
		key: K,
		options: [string, string][],
	): SettingDefinitionRender {
		return this.settingDef(name, desc, tooltip, [], (setting) => {
			setting.addDropdown((dropdown) => {
				for (const [value, label] of options) {
					dropdown.addOption(value, label);
				}
				dropdown
					.setValue(this.plugin.settings[key])
					.onChange(async (value) => {
						this.plugin.settings[key] =
							value as DiscordEmojiPickerSettings[K];
						await this.plugin.saveSettings();
					});
			});
		});
	}

	private toggleDef(
		name: string,
		desc: string,
		tooltip: string,
		key: 'renderShortcodesInEditor',
	): SettingDefinitionRender {
		return this.settingDef(
			name,
			desc,
			tooltip,
			['render', 'preview'],
			(setting) => {
				setting.addToggle((toggle) =>
					toggle
						.setValue(this.plugin.settings[key])
						.onChange(async (value) => {
							this.plugin.settings[key] = value;
							await this.plugin.saveSettings();
							this.refreshEditors();
						}),
				);
			},
		);
	}

	private sliderDef(
		name: string,
		desc: string,
		tooltip: string,
		key: 'emojiSize' | 'stickerSize',
		opts: SizeOptions,
	): SettingDefinitionRender {
		return this.settingDef(name, desc, tooltip, ['size'], (setting) => {
			let slider!: SliderComponent;
			setting.addSlider((s) => {
				slider = s;
				s.setLimits(opts.min, opts.max, opts.step)
					.setValue(this.plugin.settings[key])
					.onChange(async (value) => {
						this.plugin.settings[key] = value;
						valueEl.setText(`${value}px`);
						await this.plugin.saveSettings();
					});
			});
			setting.addExtraButton((btn) =>
				btn
					.setIcon('reset')
					.setTooltip(`Reset to default (${opts.def}px)`)
					.onClick(async () => {
						this.plugin.settings[key] = opts.def;
						slider.setValue(opts.def);
						valueEl.setText(`${opts.def}px`);
						await this.plugin.saveSettings();
					}),
			);
			const valueEl = setting.controlEl.createSpan({
				cls: 'gl-size-value',
				text: `${this.plugin.settings[key]}px`,
			});
		});
	}

	private actionDef(
		name: string,
		desc: string,
		tooltip: string,
		buttonText: string,
		action: () => void | Promise<void>,
	): SettingDefinitionRender {
		return this.settingDef(name, desc, tooltip, [], (setting) => {
			setting.addButton((btn) =>
				btn.setButtonText(buttonText).onClick(action),
			);
		});
	}

	private tokenDef(): SettingDefinitionRender {
		return this.settingDef(
			'Discord token',
			'Used to clone emojis and stickers from your servers.',
			'The token is stored locally in this vault and only sent to Discord. Warning: using your personal user token violates Discord\u2019s terms of service and can get your account flagged or banned \u2014 the same risk you already take with vencord. A bot token is safe; add the bot to the servers you want to clone from.',
			['clone', 'server', 'api'],
			(setting) => {
				setting.addText((text) => {
					text
						.setPlaceholder('Token')
						.setValue(this.plugin.settings.discordToken)
						.onChange(async (value) => {
							this.plugin.settings.discordToken = value.trim();
							await this.plugin.saveSettings();
						});
					text.inputEl.type = 'password';
				});
			},
		);
	}

	private setItems(kind: 'emoji' | 'sticker'): SettingGroupItem[] {
		const folder =
			kind === 'emoji'
				? this.plugin.settings.emojiFolder
				: this.plugin.settings.stickerFolder;
		const items: SettingGroupItem[] = [];
		const sets = listSets(this.app, folder);
		if (sets.length === 0) {
			items.push({
				name: 'No sets yet',
				desc: 'Images in the folder root form the general set.',
			});
		}
		for (const set of sets) {
			items.push(
				this.settingDef(set, '', 'Open or delete this set.', ['set'], (setting) => {
					setting.addExtraButton((btn) =>
						btn
							.setIcon('folder-open')
							.setTooltip('Open folder')
							.onClick(() =>
								openFolder(this.app, setFolderPath(folder, set)),
							),
					);
					setting.addExtraButton((btn) =>
						btn
							.setIcon('trash')
							.setTooltip('Delete set')
							.onClick(async () => {
								if (
									await confirmAction(
										this.app,
										'Delete set',
										`Delete the "${set}" set and all its images?`,
										'Delete',
									)
								) {
									await deleteSet(this.app, folder, set);
									this.refresh();
								}
							}),
					);
				}),
			);
		}
		items.push(
			this.settingDef('New set', '', '', ['create'], (setting) => {
				setting.addText((text) =>
					text
						.setPlaceholder('Set name')
						.setValue(
							kind === 'emoji' ? this.emojiNewSet : this.stickerNewSet,
						)
						.onChange((value) => {
							if (kind === 'emoji') this.emojiNewSet = value.trim();
							else this.stickerNewSet = value.trim();
						}),
				);
				setting.addButton((btn) =>
					btn.setButtonText('Create').onClick(async () => {
						const name =
							kind === 'emoji' ? this.emojiNewSet : this.stickerNewSet;
						if (!name) return;
						if (await ensureFolder(this.app, setFolderPath(folder, name))) {
							this.refresh();
						}
					}),
				);
			}),
		);
		return items;
	}

	private refresh(): void {
		const tab = this as unknown as {
			update?: () => void;
			display: () => void;
		};
		if (typeof tab.update === 'function') tab.update();
		else tab.display();
	}

	private buildSetManager(
		containerEl: HTMLElement,
		kind: 'emoji' | 'sticker',
	) {
		const folder =
			kind === 'emoji'
				? this.plugin.settings.emojiFolder
				: this.plugin.settings.stickerFolder;
		const holder = containerEl.createDiv({ cls: 'gl-sets' });
		new Setting(holder)
			.setName(kind === 'emoji' ? 'Emoji sets' : 'Sticker sets')
			.setHeading();

		const sets = listSets(this.app, folder);
		if (sets.length === 0) {
			holder.createDiv({
				cls: 'gl-sets-empty',
				text: 'No sets yet. Images in the folder root form the general set.',
			});
		}
		for (const set of sets) {
			new Setting(holder)
				.setName(set)
				.addExtraButton((btn) =>
					btn
						.setIcon('folder-open')
						.setTooltip('Open folder')
						.onClick(() =>
							openFolder(this.app, setFolderPath(folder, set)),
						),
				)
				.addExtraButton((btn) =>
					btn
						.setIcon('trash')
						.setTooltip('Delete set')
						.onClick(async () => {
							if (
								await confirmAction(
									this.app,
									'Delete set',
									`Delete the "${set}" set and all its images?`,
									'Delete',
								)
							) {
								await deleteSet(this.app, folder, set);
								this.refresh();
							}
						}),
				);
		}

		new Setting(holder)
			.setName('New set')
			.addText((text) =>
				text
					.setPlaceholder('Set name')
					.setValue(kind === 'emoji' ? this.emojiNewSet : this.stickerNewSet)
					.onChange((value) => {
						if (kind === 'emoji') this.emojiNewSet = value.trim();
						else this.stickerNewSet = value.trim();
					}),
			)
			.addButton((btn) =>
				btn.setButtonText('Create').onClick(async () => {
					const name =
						kind === 'emoji' ? this.emojiNewSet : this.stickerNewSet;
					if (!name) return;
					if (await ensureFolder(this.app, setFolderPath(folder, name))) {
						this.refresh();
					}
				}),
			);
	}

	private addSizeSetting(
		containerEl: HTMLElement,
		name: 'emojiSize' | 'stickerSize',
		cfg: { label: string; desc: string; tooltip: string; opts: SizeOptions },
	) {
		const setting = new Setting(containerEl)
			.setName(cfg.label)
			.setDesc(cfg.desc)
			.setTooltip(cfg.tooltip);

		let slider!: SliderComponent;
		setting.addSlider((s) => {
			slider = s;
			s.setLimits(cfg.opts.min, cfg.opts.max, cfg.opts.step)
				.setValue(this.plugin.settings[name])
				.onChange(async (value) => {
					this.plugin.settings[name] = value;
					valueEl.setText(`${value}px`);
					await this.plugin.saveSettings();
				});
		});

		setting.addExtraButton((btn) =>
			btn
				.setIcon('reset')
				.setTooltip(`Reset to default (${cfg.opts.def}px)`)
				.onClick(async () => {
					this.plugin.settings[name] = cfg.opts.def;
					slider.setValue(cfg.opts.def);
					valueEl.setText(`${cfg.opts.def}px`);
					await this.plugin.saveSettings();
				}),
		);

		const valueEl = setting.controlEl.createSpan({
			cls: 'gl-size-value',
			text: `${this.plugin.settings[name]}px`,
		});
	}

	private refreshEditors() {
		this.app.workspace.iterateAllLeaves((leaf) => {
			const view = leaf.view;
			if (view instanceof MarkdownView) view.editor.refresh();
		});
	}
}