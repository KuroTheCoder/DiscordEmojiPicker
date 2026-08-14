import { requestUrl } from 'obsidian';

const DISCORD_API = 'https://discord.com/api/v10';
const DISCORD_UA =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

export type DiscordTokenType = 'user' | 'bot';

export interface DiscordGuild {
	id: string;
	name: string;
	icon: string | null;
}

export interface DiscordEmoji {
	id: string;
	name: string;
	animated?: boolean;
}

export interface DiscordSticker {
	id: string;
	name: string;
	format_type?: number;
}

export class DiscordClient {
	constructor(
		private token: string,
		private type: DiscordTokenType,
	) {}

	private headers(): Record<string, string> {
		return {
			Authorization: this.type === 'bot' ? `Bot ${this.token}` : this.token,
			'user-agent': DISCORD_UA,
		};
	}

	private async get<T>(path: string): Promise<T> {
		const res = await requestUrl({
			url: `${DISCORD_API}${path}`,
			headers: this.headers(),
		});
		if (res.status < 200 || res.status >= 300) {
			throw new Error(`Discord API error ${res.status} (${path})`);
		}
		return res.json as T;
	}

	async me(): Promise<{ username?: string; id?: string }> {
		return this.get('/users/@me');
	}

	async guilds(): Promise<DiscordGuild[]> {
		return this.get('/users/@me/guilds');
	}

	async emojis(guildId: string): Promise<DiscordEmoji[]> {
		return this.get(`/guilds/${guildId}/emojis`);
	}

	async stickers(guildId: string): Promise<DiscordSticker[]> {
		return this.get(`/guilds/${guildId}/stickers`);
	}
}

export function discordEmojiUrl(id: string, animated?: boolean): string {
	return `https://cdn.discordapp.com/emojis/${id}.${
		animated ? 'gif' : 'png'
	}?size=128&quality=lossless`;
}

export function discordStickerUrl(id: string, formatType?: number): string {
	if (formatType === 4) {
		return `https://media.discordapp.net/stickers/${id}.gif?size=128&quality=lossless`;
	}
	return `https://cdn.discordapp.com/stickers/${id}.png?size=128&quality=lossless`;
}