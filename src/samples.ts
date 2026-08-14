import { App, Notice } from 'obsidian';
import { SAMPLE_FILES } from './samples-data';

interface SeedableSettings {
	emojiFolder: string;
	stickerFolder: string;
	samplesSeeded: boolean;
}

interface SeedablePlugin {
	app: App;
	settings: SeedableSettings;
	saveSettings(): Promise<void>;
}

export async function seedSamples(plugin: SeedablePlugin): Promise<void> {
	if (plugin.settings.samplesSeeded) return;
	plugin.settings.samplesSeeded = true;

	const emojiRoot = cleanPath(plugin.settings.emojiFolder);
	const stickerRoot = cleanPath(plugin.settings.stickerFolder);
	const fresh =
		emojiRoot &&
		stickerRoot &&
		!plugin.app.vault.getAbstractFileByPath(emojiRoot) &&
		!plugin.app.vault.getAbstractFileByPath(stickerRoot);
	if (!fresh) {
		await plugin.saveSettings();
		return;
	}

	let created = 0;
	for (const file of SAMPLE_FILES) {
		const dir =
			file.kind === 'emoji' ? emojiRoot : stickerRoot;
		try {
			await ensureDir(plugin.app, dir);
			await ensureDir(plugin.app, `${dir}/${file.set}`);
			await plugin.app.vault.createBinary(
				`${dir}/${file.set}/${file.name}`,
				decodeBase64(file.data),
			);
			created++;
		} catch {
			// Skip files that fail to write; sample seeding is best-effort.
		}
	}
	await plugin.saveSettings();
	if (created > 0) {
		new Notice(
			`Added ${created} sample emoji & sticker(s) to ${emojiRoot} and ${stickerRoot}.`,
		);
	}
}

function cleanPath(path: string): string {
	return path.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
}

async function ensureDir(app: App, dir: string): Promise<void> {
	if (app.vault.getAbstractFileByPath(dir)) return;
	try {
		await app.vault.createFolder(dir);
	} catch {
		// Folder already exists; ignore.
	}
}

function decodeBase64(data: string): ArrayBuffer {
	const binary = atob(data);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes.buffer;
}