import { Prec, RangeSetBuilder } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, WidgetType } from '@codemirror/view';
import { editorInfoField } from 'obsidian';
import type DiscordEmojiPickerPlugin from './main';
import { buildShortcodeMap, MediaFile, shortcodeFor } from './media';
import { fontSizePx, sizeInEm } from './utils/helpers';

const SHORTCODE_RE = /:([A-Za-z0-9_-]+):/g;
const SKIP_SELECTOR =
	'pre, code, [class*="language-"], table, th, td, thead, tbody, tr, blockquote, a, img, picture';

export function registerShortcodeRenderer(plugin: DiscordEmojiPickerPlugin) {
	plugin.registerMarkdownPostProcessor((element) => {
		// Inside the editor (Live Preview) the editor extension handles
		// rendering; only run the DOM pass for reading mode.
		if (element.closest('.markdown-source-view')) return;
		renderShortcodes(element, plugin);
	});
	plugin.registerEditorExtension(Prec.highest(shortcodeExtension(plugin)));
}

function renderShortcodes(element: HTMLElement, plugin: DiscordEmojiPickerPlugin) {
	stripExcluded(element);
	const map = buildShortcodeMap(plugin.app, plugin.settings);
	if (map.size === 0) return;
	const base = fontSizePx(element);

	for (const node of collectTextNodes(element)) {
		const text = node.textContent;
		if (!text || !text.includes(':')) continue;
		const fragment = replaceShortcodes(node, text, map, plugin, base);
		if (fragment) node.replaceWith(fragment);
	}
}

function shortcodeExtension(plugin: DiscordEmojiPickerPlugin) {
	return ViewPlugin.fromClass(
		class {
			decorations: DecorationSet;

			constructor(view: EditorView) {
				this.decorations = buildEditorDecorations(view, plugin);
			}

			update(update: ViewUpdate) {
				if (
					update.docChanged ||
					update.viewportChanged ||
					update.selectionSet
				) {
					this.decorations = buildEditorDecorations(update.view, plugin);
				}
			}
		},
		{ decorations: (v) => v.decorations },
	);
}

function buildEditorDecorations(
	view: EditorView,
	plugin: DiscordEmojiPickerPlugin,
): DecorationSet {
	if (!plugin.settings.renderShortcodesInEditor) return Decoration.none;
	const map = buildShortcodeMap(plugin.app, plugin.settings);
	if (map.size === 0) return Decoration.none;

	const builder = new RangeSetBuilder<Decoration>();
	const selection = view.state.selection.ranges;

	for (const { from, to } of view.visibleRanges) {
		const text = view.state.doc.sliceString(from, to);
		const regex = /:([A-Za-z0-9_-]+):/g;
		let match: RegExpExecArray | null;
		while ((match = regex.exec(text)) !== null) {
			const code = match[1] ?? '';
			const media = map.get(code);
			if (!media) continue;
			const start = from + match.index;
			const end = start + match[0].length;
			if (overlapsSelection(selection, start, end)) continue;
			const size =
				media.kind === 'emoji'
					? plugin.settings.emojiSize
					: plugin.settings.stickerSize;
			builder.add(
				start,
				end,
				Decoration.replace({
					widget: new ShortcodeImageWidget(plugin, media, size, `:${code}:`),
				}),
			);
		}
	}

	return builder.finish();
}

function overlapsSelection(
	ranges: readonly { from: number; to: number }[],
	from: number,
	to: number,
): boolean {
	for (const range of ranges) {
		if (range.from === range.to) {
			// Cursor: only hide the widget when the cursor is strictly
			// inside the shortcode, so a cursor parked at the end of a
			// just-typed shortcode still lets it render.
			if (range.from > from && range.from < to) return true;
		} else if (range.from < to && range.to > from) {
			return true;
		}
	}
	return false;
}

class ShortcodeImageWidget extends WidgetType {
	constructor(
		private plugin: DiscordEmojiPickerPlugin,
		private media: MediaFile,
		private size: number,
		private code: string,
	) {
		super();
	}

	toDOM(view: EditorView): HTMLElement {
		const wrapper = createSpan({ cls: 'gl-shortcode-wrap' });
		const img = wrapper.createEl('img', {
			cls: 'gl-shortcode-img',
			attr: {
				src: this.plugin.app.vault.getResourcePath(this.media.file),
				alt: this.code,
				title: this.media.label,
				draggable: 'false',
			},
		});
		const size = sizeInEm(this.size, fontSizePx(view.dom));
		img.style.width = size;
		img.style.height = size;
		wrapper.appendChild(img);

		const del = wrapper.createEl('button', {
			cls: 'gl-shortcode-del',
			attr: { type: 'button', 'aria-label': `Delete ${this.code}` },
		});
		del.createSpan({ text: '\u00d7' });

		img.addEventListener('click', (ev) => {
			ev.preventDefault();
			ev.stopPropagation();
			this.onReplace(view, wrapper);
		});
		del.addEventListener('click', (ev) => {
			ev.preventDefault();
			ev.stopPropagation();
			this.onDelete(view, wrapper);
		});

		return wrapper;
	}

	eq(other: ShortcodeImageWidget): boolean {
		return (
			other.media.path === this.media.path &&
			other.size === this.size &&
			other.code === this.code
		);
	}

	private onReplace(view: EditorView, el: HTMLElement) {
		const pos = shortcodePosAt(view, el, this.code);
		if (pos === undefined) return;
		view.dispatch({
			selection: { anchor: pos, head: pos + this.code.length },
			scrollIntoView: false,
		});
		const editor = view.state.field(editorInfoField, false)?.editor;
		if (editor) {
			this.plugin.openPicker(editor, this.code.slice(1, -1), this.media.kind);
		}
	}

	private onDelete(view: EditorView, el: HTMLElement) {
		const pos = shortcodePosAt(view, el, this.code);
		if (pos === undefined) return;
		let to = pos + this.code.length;
		if (view.state.doc.sliceString(to, to + 1) === ' ') to += 1;
		view.dispatch({
			changes: { from: pos, to },
			selection: { anchor: pos },
			scrollIntoView: false,
		});
	}
}

function shortcodePosAt(
	view: EditorView,
	el: HTMLElement,
	code: string,
): number | undefined {
	const doc = view.state.doc;
	let near: number;
	try {
		near = view.posAtDOM(el);
	} catch {
		return undefined;
	}
	if (Number.isNaN(near)) return undefined;
	const searchStart = Math.max(0, near - code.length - 16);
	const searchEnd = Math.min(doc.length, near + code.length + 16);
	const text = doc.sliceString(searchStart, searchEnd);
	const idx = text.indexOf(code);
	if (idx === -1) return undefined;
	return searchStart + idx;
}

function stripExcluded(root: HTMLElement) {
	for (const el of Array.from(root.querySelectorAll(SKIP_SELECTOR))) {
		el.remove();
	}
}

function collectTextNodes(root: HTMLElement): Text[] {
	const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
	const nodes: Text[] = [];
	let node: Node | null;
	while ((node = walker.nextNode())) nodes.push(node as Text);
	return nodes;
}

function replaceShortcodes(
	node: Text,
	text: string,
	map: Map<string, MediaFile>,
	plugin: DiscordEmojiPickerPlugin,
	base: number,
): DocumentFragment | null {
	const doc = node.ownerDocument;
	const fragment = createFragment();
	let last = 0;
	let found = false;

	for (const match of text.matchAll(SHORTCODE_RE)) {
		const code = match[1] ?? '';
		const media = map.get(code);
		if (!media) continue;
		found = true;
		if (match.index > last) {
			fragment.appendChild(doc.createTextNode(text.slice(last, match.index)));
		}
		fragment.appendChild(makeImage(doc, media, plugin, base));
		last = match.index + match[0].length;
	}

	if (!found) return null;
	if (last < text.length) {
		fragment.appendChild(doc.createTextNode(text.slice(last)));
	}
	return fragment;
}

function makeImage(
	doc: Document,
	media: MediaFile,
	plugin: DiscordEmojiPickerPlugin,
	base: number,
): HTMLImageElement {
	const size =
		media.kind === 'emoji'
			? plugin.settings.emojiSize
			: plugin.settings.stickerSize;
	const img = createEl('img', {
		attr: {
			src: plugin.app.vault.getResourcePath(media.file),
			alt: `:${shortcodeFor(media)}:`,
			title: media.label,
		},
		cls: 'gl-shortcode-img',
	});
	const em = sizeInEm(size, base);
	img.style.width = em;
	img.style.height = em;
	return img;
}