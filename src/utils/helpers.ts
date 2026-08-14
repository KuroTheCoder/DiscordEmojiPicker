export function fontSizePx(el: Element | null | undefined): number {
	const value = el ? parseFloat(getComputedStyle(el).fontSize) : NaN;
	return Number.isFinite(value) && value > 0 ? value : 16;
}

export function sizeInEm(sizePx: number, basePx: number): string {
	return `${sizePx / basePx}em`;
}

export function baseName(pathOrUrl: string): string {
	return (
		(pathOrUrl.split(/[?#]/)[0] ?? pathOrUrl)
			.split(/[\\/]/)
			.pop() ?? pathOrUrl
	);
}

export function sanitizeName(name: string): string {
	return name
		.replace(/[^\w\s.-]/g, '')
		.trim()
		.replace(/\s+/g, '_')
		.slice(0, 64);
}
