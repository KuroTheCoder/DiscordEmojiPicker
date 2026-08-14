import { App, TFile } from 'obsidian';
import { listFilesInFolder, normalizeFolder } from './utils/folders';

export const SUPPORTED_EXTENSIONS = new Set([
	'png',
	'jpg',
	'jpeg',
	'gif',
	'webp',
	'bmp',
	'svg',
	'apng',
]);

export type MediaKind = 'emoji' | 'sticker';

export interface MediaFile {
	file: TFile;
	path: string;
	label: string;
	set: string;
	kind: MediaKind;
}

export interface MediaSettingsLike {
	emojiFolder: string;
	stickerFolder: string;
}

export function getMediaFiles(
	app: App,
	folder: string,
	kind: MediaKind,
): MediaFile[] {
	const root = normalizeFolder(folder);
	if (!root) return [];

	return listFilesInFolder(app, root)
		.filter((file) => SUPPORTED_EXTENSIONS.has(file.extension))
		.map((file) => ({
			file,
			path: file.path,
			label: file.basename,
			set: setOf(file.path, root),
			kind,
		}))
		.sort(
			(a, b) =>
				b.file.stat.mtime - a.file.stat.mtime ||
				a.path.localeCompare(b.path),
		);
}

export function getAllMedia(
	app: App,
	settings: MediaSettingsLike,
): MediaFile[] {
	return [
		...getMediaFiles(app, settings.emojiFolder, 'emoji'),
		...getMediaFiles(app, settings.stickerFolder, 'sticker'),
	];
}

export function shortcodeFor(item: Pick<MediaFile, 'label'>): string {
	return item.label
		.trim()
		.toLowerCase()
		.replace(/\s+/g, '_')
		.replace(/[^a-z0-9_-]/g, '');
}

export function buildShortcodeMap(
	app: App,
	settings: MediaSettingsLike,
): Map<string, MediaFile> {
	const map = new Map<string, MediaFile>();
	for (const item of getAllMedia(app, settings)) {
		const code = shortcodeFor(item);
		if (code && !map.has(code)) map.set(code, item);
	}
	return map;
}

function parentDir(path: string): string {
	const idx = path.lastIndexOf('/');
	return idx === -1 ? '' : path.slice(0, idx);
}

function setOf(path: string, root: string): string {
	const dir = parentDir(path);
	if (dir === root) return 'General';
	const rel = dir.slice(root.length + 1);
	const parts = rel.split('/');
	return parts[0] ?? 'General';
}