import { App, Editor, Notice, setIcon, TFile } from 'obsidian';
import type DiscordEmojiPickerPlugin from '../main';
import {
	getMediaFiles,
	MediaFile,
	MediaKind,
	shortcodeFor,
	SUPPORTED_EXTENSIONS,
} from '../media';
import { fontSizePx, sizeInEm } from '../utils/helpers';
import { PickerOnboarding } from './onboarding';

const RECENT_KEY = 'recent';
const ALL_KEY = 'All';
const MAX_RECENT = 40;
const PANEL_WIDTH = 420;
const PANEL_HEIGHT = 520;
const MIN_WIDTH = 280;
const MIN_HEIGHT = 220;
const MARGIN = 8;

interface Rect {
	left: number;
	top: number;
	bottom: number;
}

interface CmView {
	coordsAtPos(pos: number): Rect | null;
}

type Mode = 'emoji' | 'sticker';

interface Section {
	key: string;
	label: string;
	type: 'emoji' | 'sticker' | 'recent';
	items: MediaFile[];
	categories: string[];
	icon: string;
}

export class EmojiPicker {
	private app: App;
	private plugin: DiscordEmojiPickerPlugin;
	private editor?: Editor;
	private containerEl!: HTMLElement;
	private searchInput!: HTMLInputElement;
	private tabEmojiBtn!: HTMLButtonElement;
	private tabStickerBtn!: HTMLButtonElement;
	private navEl!: HTMLElement;
	private catBarEl!: HTMLElement;
	private scrollEl!: HTMLElement;
	private tooltipEl!: HTMLElement;
	private tooltipRaf = 0;
	private onboarding?: PickerOnboarding;
	private footerEl!: HTMLElement;
	private countEl!: HTMLElement;
	private footerMenuBtn!: HTMLButtonElement;
	private resizeHandleEl?: HTMLElement;
	private menuEl?: HTMLElement;
	private menuOpen = false;
	private emojiSections: Section[] = [];
	private stickerSections: Section[] = [];
	private sectionEls = new Map<string, HTMLElement>();
	private gridEls = new Map<string, HTMLElement>();
	private activeKey = RECENT_KEY;
	private selectedCategory = ALL_KEY;
	private mode: Mode = 'emoji';
	private query = '';
	private initialQuery = '';
	private initialMode?: Mode;
	private cleanup: Array<() => void> = [];

	constructor(
		app: App,
		plugin: DiscordEmojiPickerPlugin,
		editor?: Editor,
		initialQuery?: string,
		initialMode?: Mode,
	) {
		this.app = app;
		this.plugin = plugin;
		this.editor = editor;
		this.initialQuery = initialQuery ?? '';
		this.query = this.initialQuery;
		this.initialMode = initialMode;
	}

	open() {
		this.build();
		if (this.initialMode && this.initialMode !== this.mode) {
			this.setMode(this.initialMode);
		}
		this.query = this.initialQuery;
		this.searchInput.value = this.initialQuery;
		this.render();
		this.attachListeners();
		this.positionNearCursor();
		this.searchInput.focus();
	}

	close() {
		if (this.tooltipRaf) window.cancelAnimationFrame(this.tooltipRaf);
		this.tooltipRaf = 0;
		document.body.toggleClass('gl-resizing', false);
		document.body.toggleClass('gl-moving', false);
		this.onboarding?.destroy();
		this.onboarding = undefined;
		for (const fn of this.cleanup) fn();
		this.cleanup = [];
		this.menuOpen = false;
		this.containerEl.remove();
		this.tooltipEl.remove();
	}

	refresh() {
		this.buildSections();
		this.applySizes();
		this.render();
	}

	private build() {
		this.containerEl = createDiv({
			cls: 'gl-picker',
			attr: { 'data-theme': this.plugin.settings.pickerTheme },
		});
		document.body.appendChild(this.containerEl);
		this.applyPanelSize();
		this.applySizes();

		this.tooltipEl = createDiv({ cls: 'gl-picker-tooltip' });
		document.body.appendChild(this.tooltipEl);

		this.buildSections();
		this.buildTabs(this.containerEl);
		this.buildSearch(this.containerEl);
		this.buildBody(this.containerEl);
		this.applyResizeHandle();
		this.render();

		if (
			this.plugin.settings.showOnboardingHint &&
			!this.plugin.settings.onboardingSeen
		) {
			this.runOnboarding();
		}
	}

	private applyPanelSize() {
		const { pickerWidth, pickerHeight } = this.plugin.settings;
		if (pickerWidth && pickerHeight) {
			this.containerEl.style.width = `${pickerWidth}px`;
			this.containerEl.style.height = `${pickerHeight}px`;
			return;
		}
		if (this.plugin.settings.pickerTheme !== 'compact') {
			const width = clamp(Math.round(window.innerWidth * 0.38), 300, 440);
			const height = clamp(
				Math.round(window.innerHeight * 0.66),
				380,
				560,
			);
			this.containerEl.style.width = `${width}px`;
			this.containerEl.style.height = `${height}px`;
		}
	}

	private runOnboarding() {
		if (this.onboarding) return;
		this.onboarding = new PickerOnboarding(this.containerEl, {
			openMenu: () => this.openMenu(),
			closeMenu: () => this.closeMenu(),
		});
		this.onboarding.run(() => {
			this.onboarding = undefined;
			this.dismissOnboarding();
		});
	}

	private dismissOnboarding() {
		this.plugin.settings.onboardingSeen = true;
		void this.plugin.saveSettings();
	}

	private applyResizeHandle() {
		if (this.plugin.settings.pickerResizable && !this.resizeHandleEl) {
			const handle = this.containerEl.createDiv({
				cls: 'gl-picker-resize',
				attr: {
					'aria-label': 'Resize picker',
					title: 'Drag to resize. Double-click to reset.',
				},
			});
			this.resizeHandleEl = handle;

			handle.addEventListener('pointerdown', (ev) => {
				if (ev.button !== 0) return;
				ev.preventDefault();
				ev.stopPropagation();

				const startX = ev.clientX;
				const startY = ev.clientY;
				const startWidth = this.containerEl.offsetWidth;
				const startHeight = this.containerEl.offsetHeight;
				const maxWidth = window.innerWidth - MARGIN * 2;
				const maxHeight = window.innerHeight - MARGIN * 2;

				handle.setPointerCapture(ev.pointerId);
				document.body.toggleClass('gl-resizing', true);

				const onMove = (mev: PointerEvent) => {
					const width = clamp(
						startWidth + mev.clientX - startX,
						MIN_WIDTH,
						maxWidth,
					);
					const height = clamp(
						startHeight + mev.clientY - startY,
						MIN_HEIGHT,
						maxHeight,
					);
					this.containerEl.style.width = `${width}px`;
					this.containerEl.style.height = `${height}px`;
					this.onboarding?.reposition();
				};
				const onUp = () => {
					handle.removeEventListener('pointermove', onMove);
					handle.removeEventListener('pointerup', onUp);
					document.body.toggleClass('gl-resizing', false);
					if (!this.containerEl.isConnected) return;
					this.plugin.settings.pickerWidth =
						this.containerEl.offsetWidth;
					this.plugin.settings.pickerHeight =
						this.containerEl.offsetHeight;
					void this.plugin.saveSettings();
				};
				handle.addEventListener('pointermove', onMove);
				handle.addEventListener('pointerup', onUp);
				this.cleanup.push(() => {
					handle.removeEventListener('pointermove', onMove);
					handle.removeEventListener('pointerup', onUp);
					document.body.toggleClass('gl-resizing', false);
				});
			});

			handle.addEventListener('dblclick', () => {
				this.containerEl.style.removeProperty('width');
				this.containerEl.style.removeProperty('height');
				delete this.plugin.settings.pickerWidth;
				delete this.plugin.settings.pickerHeight;
				void this.plugin.saveSettings();
			});
		} else if (!this.plugin.settings.pickerResizable && this.resizeHandleEl) {
			this.resizeHandleEl.remove();
			this.resizeHandleEl = undefined;
		}
	}

	private toggleMenu() {
		if (this.menuOpen) this.closeMenu();
		else this.openMenu();
	}

	private openMenu() {
		if (!this.menuEl) {
			this.menuEl = this.containerEl.createDiv({ cls: 'gl-picker-menu' });
		}
		this.menuEl.empty();

		const moveBtn = this.menuEl.createEl('button', {
			cls: 'gl-picker-menu-item gl-move',
			attr: { type: 'button' },
		});
		setIcon(moveBtn, 'move');
		moveBtn.createSpan({ cls: 'gl-picker-menu-label', text: 'Move' });
		this.bindTooltip(moveBtn, 'Hold and drag to move the picker.');

		moveBtn.addEventListener('pointerdown', (ev) => {
			if (ev.button !== 0) return;
			ev.preventDefault();
			ev.stopPropagation();

			const startX = ev.clientX;
			const startY = ev.clientY;
			const startLeft =
				parseFloat(this.containerEl.style.left) ||
				this.containerEl.offsetLeft;
			const startTop =
				parseFloat(this.containerEl.style.top) ||
				this.containerEl.offsetTop;

			moveBtn.setPointerCapture(ev.pointerId);
			moveBtn.toggleClass('is-dragging', true);
			document.body.toggleClass('gl-moving', true);
			if (!this.onboarding) this.closeMenu();

			const onMove = (mev: PointerEvent) => {
				const left = clamp(
					startLeft + mev.clientX - startX,
					MARGIN,
					window.innerWidth - this.containerEl.offsetWidth - MARGIN,
				);
				const top = clamp(
					startTop + mev.clientY - startY,
					MARGIN,
					window.innerHeight - this.containerEl.offsetHeight - MARGIN,
				);
				this.containerEl.style.left = `${left}px`;
				this.containerEl.style.top = `${top}px`;
			};
			const onUp = () => {
				moveBtn.removeEventListener('pointermove', onMove);
				moveBtn.removeEventListener('pointerup', onUp);
				moveBtn.toggleClass('is-dragging', false);
				document.body.toggleClass('gl-moving', false);
			};
			moveBtn.addEventListener('pointermove', onMove);
			moveBtn.addEventListener('pointerup', onUp);
			this.cleanup.push(() => {
				moveBtn.removeEventListener('pointermove', onMove);
				moveBtn.removeEventListener('pointerup', onUp);
				document.body.toggleClass('gl-moving', false);
			});
		});

		const resizeRow = this.menuEl.createEl('button', {
			cls: 'gl-picker-menu-item gl-resize-item',
			attr: { type: 'button' },
		});
		setIcon(resizeRow, 'maximize');
		resizeRow.createSpan({ cls: 'gl-picker-menu-label', text: 'Resize' });
		const switchEl = resizeRow.createSpan({
			cls: `gl-picker-switch${this.plugin.settings.pickerResizable ? ' is-on' : ''}`,
		});
		this.bindTooltip(resizeRow, 'Turn the resize handle on or off.');
		resizeRow.addEventListener('click', () => {
			this.plugin.settings.pickerResizable =
				!this.plugin.settings.pickerResizable;
			switchEl.toggleClass('is-on', this.plugin.settings.pickerResizable);
			this.applyResizeHandle();
			void this.plugin.saveSettings();
		});

		this.menuEl.toggleClass('is-open', true);
		this.menuOpen = true;

		const onDocMouseDown = (ev: MouseEvent) => {
			if (
				ev.target instanceof Node &&
				!this.menuEl?.contains(ev.target) &&
				!this.footerMenuBtn.contains(ev.target)
			) {
				this.closeMenu();
			}
		};
		document.addEventListener('mousedown', onDocMouseDown, true);
		this.cleanup.push(() =>
			document.removeEventListener('mousedown', onDocMouseDown, true),
		);
	}

	private closeMenu() {
		this.menuEl?.toggleClass('is-open', false);
		this.menuOpen = false;
	}

	private applySizes() {
		const s = this.plugin.settings;
		const base = fontSizePx(this.containerEl);
		this.containerEl.setCssProps({
			'--gl-emoji-size': sizeInEm(clamp(s.emojiSize, 24, 160), base),
			'--gl-sticker-size': sizeInEm(clamp(s.stickerSize, 48, 320), base),
		});
	}

	private attachListeners() {
		const onDocMouseDown = (ev: MouseEvent) => {
			if (!this.containerEl.contains(ev.target as Node)) this.close();
		};
		document.addEventListener('mousedown', onDocMouseDown, true);
		this.cleanup.push(() =>
			document.removeEventListener('mousedown', onDocMouseDown, true),
		);

		const onDocKeyDown = (ev: KeyboardEvent) => {
			if (ev.key === 'Escape') {
				ev.stopPropagation();
				if (this.menuOpen) this.closeMenu();
				else this.close();
			}
		};
		document.addEventListener('keydown', onDocKeyDown, true);
		this.cleanup.push(() =>
			document.removeEventListener('keydown', onDocKeyDown, true),
		);

		this.containerEl.addEventListener('keydown', this.onKeyDown);
		this.cleanup.push(() =>
			this.containerEl.removeEventListener('keydown', this.onKeyDown),
		);
	}

	private positionNearCursor() {
		const width = this.containerEl.offsetWidth || PANEL_WIDTH;
		const height = this.containerEl.offsetHeight || PANEL_HEIGHT;
		const vw = window.innerWidth;
		const vh = window.innerHeight;

		let left = MARGIN;
		let top = MARGIN;

		const coords = this.cursorCoords();
		if (coords) {
			left = coords.left;
			top = coords.top - height - MARGIN;
			if (top < MARGIN) top = coords.bottom + MARGIN;
		}

		left = Math.max(MARGIN, Math.min(left, vw - width - MARGIN));
		top = Math.max(MARGIN, Math.min(top, vh - height - MARGIN));

		this.containerEl.style.left = `${left}px`;
		this.containerEl.style.top = `${top}px`;
	}

	private cursorCoords(): Rect | null {
		if (!this.editor) return null;
		try {
			const offset = this.editor.posToOffset(this.editor.getCursor());
			const cm = (this.editor as unknown as { cm?: CmView }).cm;
			return cm ? cm.coordsAtPos(offset) : null;
		} catch {
			return null;
		}
	}

	private buildSections() {
		this.emojiSections = [];
		this.stickerSections = [];

		const emojiFiles = getMediaFiles(
			this.app,
			this.plugin.settings.emojiFolder,
			'emoji',
		);
		const stickerFiles = getMediaFiles(
			this.app,
			this.plugin.settings.stickerFolder,
			'sticker',
		);

		for (const [setName, items] of groupBy(emojiFiles, (f) => f.set)) {
			this.emojiSections.push({
				key: `emoji-${setName}`,
				label: setName,
				type: 'emoji',
				items,
				categories: categoriesOf(items),
				icon: randomThumb(this.app, items),
			});
		}
		orderSections(this.emojiSections);

		for (const [setName, items] of groupBy(stickerFiles, (f) => f.set)) {
			this.stickerSections.push({
				key: `sticker-${setName}`,
				label: setName,
				type: 'sticker',
				items,
				categories: categoriesOf(items),
				icon: randomThumb(this.app, items),
			});
		}
		orderSections(this.stickerSections);
	}

	private buildTabs(container: HTMLElement) {
		const tabs = container.createDiv({ cls: 'gl-picker-tabs' });
		this.tabEmojiBtn = tabs.createEl('button', {
			cls: 'gl-picker-tab active',
			attr: { type: 'button' },
			text: 'Emoji',
		});
		this.tabStickerBtn = tabs.createEl('button', {
			cls: 'gl-picker-tab',
			attr: { type: 'button' },
			text: 'Sticker',
		});
		this.tabEmojiBtn.addEventListener('click', () => this.setMode('emoji'));
		this.tabStickerBtn.addEventListener('click', () => this.setMode('sticker'));
	}

	private setMode(mode: Mode) {
		if (this.mode === mode) return;
		this.mode = mode;
		this.activeKey = RECENT_KEY;
		this.selectedCategory = ALL_KEY;
		this.searchInput.value = '';
		this.query = '';
		this.tabEmojiBtn.toggleClass('active', mode === 'emoji');
		this.tabStickerBtn.toggleClass('active', mode === 'sticker');
		this.animateBrowse(() => this.render());
	}

	private buildSearch(container: HTMLElement) {
		const wrapper = container.createDiv({ cls: 'gl-picker-search' });
		const icon = wrapper.createSpan({ cls: 'gl-picker-search-icon' });
		setIcon(icon, 'search');
		this.searchInput = wrapper.createEl('input', {
			attr: { type: 'text', placeholder: 'Search...', spellcheck: 'false' },
		});
		this.searchInput.addEventListener('input', () => {
			this.query = this.searchInput.value;
			this.render();
		});

		const closeBtn = wrapper.createEl('button', {
			cls: 'gl-picker-close',
			attr: { type: 'button', 'aria-label': 'Close' },
		});
		setIcon(closeBtn, 'x');
		closeBtn.addEventListener('click', () => this.close());

		const importBtn = wrapper.createEl('button', {
			cls: 'gl-picker-import',
			attr: { type: 'button', 'aria-label': 'Import emojis & stickers' },
		});
		setIcon(importBtn, 'download');
		importBtn.addEventListener('click', () => {
			this.close();
			this.plugin.openImport();
		});
	}

	private buildBody(container: HTMLElement) {
		const body = container.createDiv({ cls: 'gl-picker-body' });

		this.navEl = body.createDiv({ cls: 'gl-picker-nav' });
		this.navEl.addEventListener('click', (ev) => {
			const target = (ev.target as HTMLElement).closest('button');
			if (!target) return;
			const key = target.getAttribute('data-key');
			if (key) this.selectSection(key);
		});

		const column = body.createDiv({ cls: 'gl-picker-column' });
		this.catBarEl = column.createDiv({ cls: 'gl-picker-cats' });
		this.scrollEl = column.createDiv({ cls: 'gl-picker-scroll' });
		this.scrollEl.addEventListener('scroll', () => this.onScroll(), { passive: true });

		const footer = container.createDiv({ cls: 'gl-picker-footer' });
		this.footerEl = footer.createSpan({ cls: 'gl-picker-footer-folder' });
		this.countEl = footer.createSpan({ cls: 'gl-picker-footer-count' });
		const helpBtn = footer.createEl('button', {
			cls: 'gl-picker-help-btn',
			attr: { type: 'button', 'aria-label': 'How to use the picker' },
		});
		setIcon(helpBtn, 'help');
		helpBtn.addEventListener('click', () => this.runOnboarding());
		this.footerMenuBtn = footer.createEl('button', {
			cls: 'gl-picker-menu-btn',
			attr: { type: 'button', 'aria-label': 'Picker options' },
		});
		setIcon(this.footerMenuBtn, 'more-horizontal');
		this.footerMenuBtn.addEventListener('click', () => this.toggleMenu());
		this.updateFooter();
	}

	private bindTooltip(el: HTMLElement, text: string) {
		el.addEventListener('mouseenter', (ev) =>
			this.showTextTooltip(ev.clientX, ev.clientY, text),
		);
		el.addEventListener('mousemove', (ev) =>
			this.moveTooltip(ev.clientX, ev.clientY),
		);
		el.addEventListener('mouseleave', () => this.hideTooltip());
	}

	private showTextTooltip(clientX: number, clientY: number, text: string) {
		this.tooltipEl.empty();
		this.tooltipEl.createDiv({ cls: 'gl-picker-tooltip-label', text });
		this.tooltipEl.toggleClass('gl-picker-tooltip-text', true);
		this.tooltipEl.toggleClass('is-visible', true);
		this.moveTooltip(clientX, clientY);
	}

	private currentSections(): Section[] {
		return this.mode === 'emoji' ? this.emojiSections : this.stickerSections;
	}

	private currentFolder(): string {
		return this.mode === 'emoji'
			? this.plugin.settings.emojiFolder
			: this.plugin.settings.stickerFolder;
	}

	private recentItems(): MediaFile[] {
		const folder = this.currentFolder();
		return resolveRecent(this.app, this.plugin.settings.recentlyUsed, this.mode)
			.filter((item) => isInFolder(item.path, folder));
	}

	private sectionsForRender(): Section[] {
		const recent = this.recentItems();
		const sections: Section[] = [];
		if (recent.length > 0) {
			sections.push({
				key: RECENT_KEY,
				label: 'Recently used',
				type: 'recent',
				items: recent,
				categories: [],
				icon: '',
			});
		}
		sections.push(...this.currentSections());
		return sections;
	}

	private render() {
		this.renderNav();
		if (this.query.trim()) {
			this.selectedCategory = ALL_KEY;
			this.renderCategories();
			this.renderStacked();
		} else {
			this.renderBrowse();
		}
		this.updateNavHighlight();
		this.updateFooter();
	}

	private updateFooter() {
		const folder = this.currentFolder();
		this.footerEl.setText(folder ? `Folder: ${folder}` : 'Folder: —');
		this.countEl.setText(`${this.visibleButtons().length} items`);
	}

	private renderNav() {
		this.navEl.empty();
		const sections = this.sectionsForRender();

		const recent = sections.find((s) => s.key === RECENT_KEY);
		if (recent) {
			const btn = this.navEl.createEl('button', {
				cls: 'gl-picker-nav-item',
				attr: { type: 'button', 'data-key': RECENT_KEY, 'aria-label': 'Recently used' },
			});
			setIcon(btn, 'history');
		}

		const q = this.query.trim().toLowerCase();
		for (const section of sections) {
			if (section.key === RECENT_KEY) continue;
			if (q && !sectionHasMatch(section, q)) continue;
			const btn = this.navEl.createEl('button', {
				cls: 'gl-picker-nav-item',
				attr: {
					type: 'button',
					'data-key': section.key,
					'aria-label': section.label,
				},
			});
			btn.createEl('img', {
				attr: {
					src: section.icon,
					alt: section.label,
					title: section.label,
					loading: 'lazy',
					draggable: 'false',
				},
			});
		}
	}

	private renderSections() {
		this.scrollEl.empty();
		this.sectionEls.clear();
		this.gridEls.clear();

		const q = this.query.trim().toLowerCase();
		let anyVisible = false;

		for (const section of this.sectionsForRender()) {
			const items = q
				? section.items.filter(
						(item) =>
							item.label.toLowerCase().includes(q) ||
							item.path.toLowerCase().includes(q),
					)
				: section.items;
			if (section.type === 'recent' && q && items.length === 0) continue;
			if (items.length === 0) continue;

			anyVisible = true;
			const sectionEl = this.scrollEl.createDiv({
				cls: 'gl-picker-section',
				attr: { 'data-key': section.key },
			});
			this.sectionEls.set(section.key, sectionEl);
			sectionEl.createEl('h3', {
				cls: 'gl-picker-section-title',
				text: section.label,
			});
			const grid = this.makeGrid(sectionEl, section);
			this.gridEls.set(section.key, grid);
			for (const item of items) {
				grid.appendChild(
					this.makeItemButton(item, section.type, grid.children.length),
				);
			}
		}

		if (!anyVisible) {
			this.scrollEl.createDiv({
				cls: 'gl-picker-empty',
				text: q
					? 'No matches found.'
					: 'No images yet. Put images in the folder set in Settings.',
			});
		}
	}

	private renderStacked() {
		this.renderSections();
	}

	private renderBrowse() {
		this.scrollEl.empty();
		this.sectionEls.clear();
		this.gridEls.clear();

		const sections = this.sectionsForRender();
		let section =
			sections.find((candidate) => candidate.key === this.activeKey) ??
			sections[0];
		if (!section) {
			this.renderCategories();
			this.scrollEl.createDiv({
				cls: 'gl-picker-empty',
				text: 'No images yet. Put images in the folder set in Settings.',
			});
			return;
		}
		this.activeKey = section.key;
		this.renderCategories(section);

		this.scrollEl.scrollTop = 0;
		const sectionEl = this.scrollEl.createDiv({
			cls: 'gl-picker-section',
			attr: { 'data-key': section.key },
		});
		this.sectionEls.set(section.key, sectionEl);
		sectionEl.createEl('h3', {
			cls: 'gl-picker-section-title',
			text: section.label,
		});
		const grid = this.makeGrid(sectionEl, section);
		this.gridEls.set(section.key, grid);
		const items =
			this.selectedCategory === ALL_KEY
				? section.items
				: section.items.filter(
						(item) => item.category === this.selectedCategory,
					);
		for (const item of items) {
			grid.appendChild(
				this.makeItemButton(item, section.type, grid.children.length),
			);
		}
		if (items.length === 0) {
			grid.createDiv({
				cls: 'gl-picker-empty',
				text: 'No images in this category.',
			});
		}
	}

	private makeGrid(sectionEl: HTMLElement, section: Section): HTMLElement {
		return sectionEl.createDiv({
			cls:
				section.type === 'sticker'
					? 'gl-picker-grid gl-picker-grid-stickers'
					: 'gl-picker-grid',
		});
	}

	private renderCategories(section?: Section) {
		this.catBarEl.empty();
		const cats = section?.categories.filter(
			(category) => category !== 'General',
		);
		if (!section || !cats || cats.length === 0) {
			this.catBarEl.toggleClass('is-visible', false);
			return;
		}
		const options = [
			ALL_KEY,
			...section.categories.filter((c) => c === 'General'),
			...cats.sort((a, b) => a.localeCompare(b)),
		];
		for (const option of options) {
			const pill = this.catBarEl.createEl('button', {
				cls: 'gl-picker-cat',
				attr: { type: 'button', 'data-cat': option },
				text: option,
			});
			pill.toggleClass('active', option === this.selectedCategory);
			pill.addEventListener('click', () => this.setCategory(option));
		}
		this.catBarEl.toggleClass('is-visible', true);
	}

	private setCategory(category: string) {
		if (this.selectedCategory === category) return;
		this.selectedCategory = category;
		this.animateBrowse(() => {
			this.renderBrowse();
			this.updateNavHighlight();
			this.updateFooter();
		});
	}

	private animateBrowse(done: () => void) {
		this.scrollEl.toggleClass('gl-picker-fading', true);
		window.setTimeout(() => {
			this.scrollEl.toggleClass('gl-picker-fading', false);
			done();
			this.scrollEl.toggleClass('gl-picker-animate', true);
			window.setTimeout(
				() => this.scrollEl.toggleClass('gl-picker-animate', false),
				600,
			);
		}, 120);
	}

	private makeItemButton(
		item: MediaFile,
		type: Section['type'],
		index: number,
	): HTMLButtonElement {
		const btn = createEl('button', {
			cls: type === 'sticker' ? 'gl-sticker' : 'gl-emoji',
			attr: { type: 'button' },
		});
		btn.style.setProperty('--gl-i', String(Math.min(index, 24)));
		btn.createEl('img', {
			attr: {
				src: resourcePath(this.app, item.file),
				alt: item.label,
				loading: 'lazy',
				draggable: 'false',
			},
		});
		btn.addEventListener('mouseenter', (ev) =>
			this.showTooltip(ev.clientX, ev.clientY, item),
		);
		btn.addEventListener('mousemove', (ev) =>
			this.moveTooltip(ev.clientX, ev.clientY),
		);
		btn.addEventListener('mouseleave', () => this.hideTooltip());
		btn.addEventListener('click', () => this.insertItem(item));
		return btn;
	}

	private insertItem(item: MediaFile) {
		if (!this.editor) {
			new Notice('Open a note to insert emojis or stickers.');
			return;
		}
		const style = this.plugin.settings.insertStyle;
		let text: string;
		if (style === 'shortcode') {
			text = `:${shortcodeFor(item)}: `;
		} else if (style === 'embed') {
			text = `![[${item.path}|${this.sizeForMode()}]] `;
		} else {
			const size = this.sizeForMode();
			const src = resourcePath(this.app, item.file);
			text = `<img src="${src}" alt="${escapeAttr(item.label)}" style="width:${size}px;height:${size}px;object-fit:contain;vertical-align:middle;display:inline-block" /> `;
		}
		this.editor.replaceSelection(text);
		void this.recordRecent(item);
	}

	private sizeForMode(): number {
		return this.mode === 'emoji'
			? this.plugin.settings.emojiSize
			: this.plugin.settings.stickerSize;
	}

	private async recordRecent(item: MediaFile) {
		const recent = this.plugin.settings.recentlyUsed.filter(
			(path) => path !== item.path,
		);
		recent.unshift(item.path);
		this.plugin.settings.recentlyUsed = recent.slice(0, MAX_RECENT);
		await this.plugin.saveSettings();
		this.refreshRecent();
	}

	private refreshRecent() {
		const grid = this.gridEls.get(RECENT_KEY);
		if (grid) {
			grid.empty();
			for (const item of this.recentItems()) {
				grid.appendChild(
					this.makeItemButton(item, 'recent', grid.children.length),
				);
			}
		} else {
			this.render();
		}
	}

	private selectSection(key: string) {
		if (this.query.trim()) {
			this.scrollToSection(key);
			return;
		}
		if (this.activeKey === key) return;
		this.activeKey = key;
		this.selectedCategory = ALL_KEY;
		this.animateBrowse(() => {
			this.renderBrowse();
			this.updateNavHighlight();
			this.updateFooter();
		});
	}

	private scrollToSection(key: string) {
		const el = this.sectionEls.get(key);
		if (!el) return;
		this.activeKey = key;
		this.updateNavHighlight();
		el.scrollIntoView();
	}

	private onScroll() {
		if (this.query.trim()) {
			let current = RECENT_KEY;
			for (const [key, el] of this.sectionEls) {
				if (el.offsetTop - this.scrollEl.scrollTop <= 60) {
					current = key;
				}
			}
			if (current !== this.activeKey) {
				this.activeKey = current;
				this.updateNavHighlight();
			}
		}
	}

	private updateNavHighlight() {
		for (const el of Array.from(
			this.navEl.querySelectorAll('.gl-picker-nav-item'),
		)) {
			el.toggleClass(
				'active',
				el.getAttribute('data-key') === this.activeKey,
			);
		}
	}

	private showTooltip(clientX: number, clientY: number, item: MediaFile) {
		this.tooltipEl.empty();
		this.tooltipEl.toggleClass('gl-picker-tooltip-text', false);
		this.tooltipEl.createEl('img', {
			attr: {
				src: resourcePath(this.app, item.file),
				alt: item.label,
				draggable: 'false',
			},
		});
		this.tooltipEl.createDiv({
			cls: 'gl-picker-tooltip-label',
			text: item.label,
		});
		this.tooltipEl.toggleClass('is-visible', true);
		this.moveTooltip(clientX, clientY);
	}

	private moveTooltip(clientX: number, clientY: number) {
		if (this.tooltipRaf) return;
		this.tooltipRaf = window.requestAnimationFrame(() => {
			this.tooltipRaf = 0;
			this.tooltipEl.style.left = `${clientX}px`;
			this.tooltipEl.style.top = `${clientY}px`;
		});
	}

	private hideTooltip() {
		this.tooltipEl.toggleClass('is-visible', false);
	}

	private onKeyDown = (ev: KeyboardEvent) => {
		const isArrow = ev.key.startsWith('Arrow');
		const isEnter = ev.key === 'Enter';
		if (!isArrow && !isEnter) return;

		const buttons = this.visibleButtons();
		const catButtons = this.visibleCats();
		const active = activeDocument.activeElement as HTMLElement | null;

		if (catButtons.includes(active as HTMLButtonElement)) {
			const idx = catButtons.indexOf(active as HTMLButtonElement);
			if (isEnter) {
				ev.preventDefault();
				catButtons[idx]?.click();
			} else if (isArrow) {
				ev.preventDefault();
				const next =
					ev.key === 'ArrowRight' || ev.key === 'ArrowDown'
						? (idx + 1) % catButtons.length
						: (idx - 1 + catButtons.length) % catButtons.length;
				catButtons[next]?.focus();
			}
			return;
		}

		if (active === this.searchInput) {
			if (ev.key === 'ArrowDown' || ev.key === 'ArrowRight') {
				ev.preventDefault();
				buttons[0]?.focus();
			}
			return;
		}

		const idx = buttons.indexOf(active as HTMLButtonElement);
		if (idx === -1) {
			if (isArrow) {
				ev.preventDefault();
				buttons[0]?.focus();
			}
			return;
		}

		if (isEnter) {
			ev.preventDefault();
			buttons[idx]?.click();
			return;
		}

		ev.preventDefault();
		let next = idx;
		if (ev.key === 'ArrowDown' || ev.key === 'ArrowRight') {
			next = (idx + 1) % buttons.length;
		} else {
			next = (idx - 1 + buttons.length) % buttons.length;
		}
		buttons[next]?.focus();
	};

	private visibleButtons(): HTMLButtonElement[] {
		return Array.from(
			this.scrollEl.querySelectorAll('.gl-emoji, .gl-sticker'),
			(el) => el as HTMLButtonElement,
		);
	}

	private visibleCats(): HTMLButtonElement[] {
		return Array.from(
			this.catBarEl.querySelectorAll('.gl-picker-cat'),
			(el) => el as HTMLButtonElement,
		);
	}
}

function resolveRecent(
	app: App,
	paths: string[],
	kind: MediaKind,
): MediaFile[] {
	const items: MediaFile[] = [];
	for (const path of paths) {
		const file = app.vault.getAbstractFileByPath(path);
		if (file instanceof TFile && SUPPORTED_EXTENSIONS.has(file.extension)) {
			items.push({
				file,
				path: file.path,
				label: file.basename,
				set: 'Recently used',
				category: 'General',
				kind,
			});
		}
	}
	return items;
}

function groupBy<T>(items: T[], keyOf: (item: T) => string): Map<string, T[]> {
	const map = new Map<string, T[]>();
	for (const item of items) {
		const key = keyOf(item);
		const group = map.get(key);
		if (group) group.push(item);
		else map.set(key, [item]);
	}
	return map;
}

function categoriesOf(items: MediaFile[]): string[] {
	return [...new Set(items.map((item) => item.category))];
}

function orderSections(sections: Section[]): Section[] {
	return sections.sort((a, b) => {
		const aGeneral = a.label === 'General' ? 0 : 1;
		const bGeneral = b.label === 'General' ? 0 : 1;
		if (aGeneral !== bGeneral) return aGeneral - bGeneral;
		return a.label.localeCompare(b.label);
	});
}

function resourcePath(app: App, file?: TFile): string {
	return file ? app.vault.getResourcePath(file) : '';
}

function randomThumb(app: App, items: MediaFile[]): string {
	const file = items[Math.floor(Math.random() * items.length)]?.file;
	return resourcePath(app, file);
}

function sectionHasMatch(section: Section, query: string): boolean {
	return section.items.some(
		(item) =>
			item.label.toLowerCase().includes(query) ||
			item.path.toLowerCase().includes(query),
	);
}

function isInFolder(path: string, folder: string): boolean {
	const root = folder.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
	if (!root) return false;
	const idx = path.lastIndexOf('/');
	const dir = idx === -1 ? '' : path.slice(0, idx);
	return dir === root || dir.startsWith(`${root}/`);
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

function escapeAttr(value: string): string {
	return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}