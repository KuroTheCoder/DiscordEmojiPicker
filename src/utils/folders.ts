import { App, FileSystemAdapter, Modal, Notice, Platform, TFolder } from 'obsidian';

export function normalizeFolder(folder: string): string {
	return folder
		.trim()
		.replace(/\\/g, '/')
		.replace(/^\/+|\/+$/g, '');
}

export function setFolderPath(folder: string, setName: string): string {
	const root = normalizeFolder(folder);
	const set = normalizeFolder(setName);
	return set ? `${root}/${set}` : root;
}

export function listSets(app: App, folder: string): string[] {
	const root = normalizeFolder(folder);
	if (!root) return [];
	const rootFolder = app.vault.getAbstractFileByPath(root);
	if (!(rootFolder instanceof TFolder)) return [];
	return rootFolder.children
		.filter((child): child is TFolder => child instanceof TFolder)
		.map((child) => child.name)
		.sort((a, b) => a.localeCompare(b));
}

export async function ensureFolder(app: App, dir: string): Promise<boolean> {
	if (!dir) return false;
	if (app.vault.getAbstractFileByPath(dir)) return true;
	try {
		await app.vault.createFolder(dir);
		return true;
	} catch {
		return false;
	}
}

export async function deleteSet(
	app: App,
	folder: string,
	setName: string,
): Promise<boolean> {
	const root = normalizeFolder(folder);
	const set = normalizeFolder(setName);
	if (!root || !set) return false;
	const dir = `${root}/${set}`;
	for (const file of app.vault.getFiles().filter((f) => f.path.startsWith(`${dir}/`))) {
		try {
			await app.fileManager.trashFile(file);
		} catch {
			// Keep going; ignore individual failures.
		}
	}
	try {
		await app.vault.adapter.rmdir(dir, true);
		return true;
	} catch {
		return false;
	}
}

export function openFolder(app: App, dir: string): void {
	if (!Platform.isDesktopApp) {
		new Notice('Opening folders is only available on desktop.');
		return;
	}
	const shell = getElectronShell();
	if (!shell) {
		new Notice('Could not open the folder.');
		return;
	}
	const adapter = app.vault.adapter;
	if (!(adapter instanceof FileSystemAdapter)) {
		new Notice('Could not open the folder.');
		return;
	}
	void shell.openPath(adapter.getFullPath(dir));
}

interface ElectronShellLike {
	openPath(path: string): Promise<string>;
}

function getElectronShell(): ElectronShellLike | null {
	try {
		const w = window as unknown as {
			require?: (module: string) => unknown;
		};
		const electron = w.require?.('electron') as
			| {
					shell?: ElectronShellLike;
					remote?: { shell?: ElectronShellLike };
			  }
			| undefined;
		const remoteShell = electron?.remote?.shell;
		if (remoteShell?.openPath) return remoteShell;
		return electron?.shell?.openPath ? electron.shell : null;
	} catch {
		return null;
	}
}

export function confirmAction(
	app: App,
	title: string,
	message: string,
	confirmLabel = 'Delete',
): Promise<boolean> {
	return new Promise((resolve) => {
		const modal = new ConfirmModal(app, title, message, confirmLabel, resolve);
		modal.open();
	});
}

class ConfirmModal extends Modal {
	constructor(
		app: App,
		private title: string,
		private message: string,
		private confirmLabel: string,
		private onResult: (ok: boolean) => void,
	) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl('h3', { text: this.title });
		contentEl.createEl('p', { text: this.message });
		const row = contentEl.createDiv({ cls: 'gl-confirm-row' });
		row.createEl('button', {
			text: 'Cancel',
			attr: { type: 'button' },
		}).addEventListener('click', () => {
			this.onResult(false);
			this.close();
		});
		row.createEl('button', {
			cls: 'mod-warning',
			text: this.confirmLabel,
			attr: { type: 'button' },
		}).addEventListener('click', () => {
			this.onResult(true);
			this.close();
		});
	}
}