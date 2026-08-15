import { cpSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const vaultPlugins =
	process.env.OBSIDIAN_TEST_VAULT ??
	'D:/Personal stuff/Studying thingy/Dummy vault/.obsidian/plugins';
const pluginDir = join(vaultPlugins, 'discord-emoji-picker');

export function syncToVault() {
	mkdirSync(pluginDir, { recursive: true });
	for (const file of ['main.js', 'manifest.json', 'styles.css']) {
		cpSync(join(root, file), join(pluginDir, file));
	}
	console.log(`Synced plugin to ${pluginDir}`);
}
