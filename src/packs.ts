import { requestUrl } from 'obsidian';

export interface PackProvider {
	id: string;
	label: string;
	hint: string;
	urlFor(char: string): string;
}

const EMOJILIB_URL =
	'https://cdn.jsdelivr.net/npm/emojilib@3.0.12/dist/emoji-en-US.json';

const TWEMOJI_BASE =
	'https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/72x72';
const NOTO_BASE = 'https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@main/png/72';
const OPENMOJI_BASE =
	'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji@latest/color/72x72';

const TWEMOJI: PackProvider = {
	id: 'twemoji',
	label: 'Twemoji',
	hint: 'Twitter/X style, by Twemoji contributors (CC-BY 4.0).',
	urlFor: (char) => `${TWEMOJI_BASE}/${codepoints(char, '-')}.png`,
};
const NOTO: PackProvider = {
	id: 'noto',
	label: 'Noto Emoji',
	hint: 'Google\u2019s emoji set (Apache 2.0 / SIL OFL).',
	urlFor: (char) => `${NOTO_BASE}/emoji_u${codepoints(char, '_')}.png`,
};
const OPENMOJI: PackProvider = {
	id: 'openmoji',
	label: 'OpenMoji',
	hint: 'Open-source emoji set by the OpenMoji project (CC BY-SA 4.0).',
	urlFor: (char) =>
		`${OPENMOJI_BASE}/${codepoints(char, '').toUpperCase()}.png`,
};

export const PACK_PROVIDERS: PackProvider[] = [TWEMOJI, NOTO, OPENMOJI];

export function packProviderById(id: string): PackProvider {
	return PACK_PROVIDERS.find((p) => p.id === id) ?? TWEMOJI;
}

let emojiAliasMap: Map<string, string> | null = null;

const ALIAS_FALLBACK: Record<string, string> = {
	sweat_smile: '😅',
	heart_eyes: '😍',
	kissing_heart: '😘',
	kissing_smiling_eyes: '😙',
	stuck_out_tongue_winking_eye: '😜',
	stuck_out_tongue_closed_eyes: '😝',
	unamused: '😒',
	rolling_eyes: '🙄',
	expressionless: '😑',
	party_face: '🥳',
	cold_sweat: '😰',
	anguished: '😧',
	sob: '😭',
	weary: '😩',
	fearful: '😨',
	open_mouth: '😮',
	astonished: '😲',
	relieved: '😌',
	rage: '😡',
	pensive: '😔',
	no_mouth: '😶',
	grimacing: '😬',
	smiling_imp: '😈',
	imp: '👿',
	clap: '👏',
	muscle: '💪',
	point_up: '☝️',
	point_down: '👇',
	point_left: '👈',
	point_right: '👉',
	raised_hands: '🙌',
	metal: '🤘',
	fingers_crossed: '🤞',
	star2: '🌟',
	sweat_drops: '💦',
	clapper: '🎬',
	headphones: '🎧',
	medal: '🏅',
	fries: '🍟',
	hotdog: '🌭',
	icecream: '🍦',
	beer: '🍺',
	milk_glass: '🥛',
	cherry: '🍒',
	panda_face: '🐼',
	bee: '🐝',
	whale2: '🐳',
};

export async function packUrlForCode(
	code: string,
	provider: PackProvider,
): Promise<string | undefined> {
	const char = await emojiCharFor(code);
	if (!char) return undefined;
	return provider.urlFor(char);
}

async function emojiCharFor(code: string): Promise<string | undefined> {
	const clean = normalizeCode(code);
	if (clean) {
		if (!emojiAliasMap) {
			const res = await requestUrl({ url: EMOJILIB_URL });
			const json = res.json as Record<string, string[]>;
			emojiAliasMap = new Map();
			for (const [char, aliases] of Object.entries(json)) {
				for (const alias of aliases) {
					const key = normalizeCode(alias);
					if (key && !emojiAliasMap.has(key)) emojiAliasMap.set(key, char);
				}
			}
		}
		if (emojiAliasMap.has(clean)) return emojiAliasMap.get(clean);
		if (ALIAS_FALLBACK[clean]) return ALIAS_FALLBACK[clean];
	}
	const stripped = code.replace(/^:+|:+$/g, '');
	const chars = Array.from(stripped);
	if (chars.length > 0 && chars.every((c) => (c.codePointAt(0) ?? 0) > 0x7f)) {
		return stripped;
	}
	return undefined;
}

export function normalizeCode(code: string): string {
	return code.replace(/^:+|:+$/g, '').toLowerCase().replace(/\s+/g, '_');
}

function codepoints(char: string, separator: string): string {
	return Array.from(char)
		.map((c) => c.codePointAt(0)!.toString(16))
		.filter((cp) => cp !== 'fe0f')
		.join(separator);
}

export const POPULAR_SET: string[] = [
	'smile', 'grin', 'joy', 'laughing', 'sweat_smile', 'wink', 'blush',
	'heart_eyes', 'kissing_heart', 'kissing_smiling_eyes', 'stuck_out_tongue_winking_eye',
	'stuck_out_tongue_closed_eyes', 'sunglasses', 'nerd_face', 'smirk', 'unamused',
	'rolling_eyes', 'thinking', 'neutral_face', 'expressionless', 'slightly_smiling_face',
	'slightly_frowning_face', 'hugging_face', 'star_struck', 'zany_face', 'party_face',
	'cold_sweat', 'sleepy', 'tired_face', 'worried', 'frowning', 'anguished', 'cry',
	'sob', 'weary', 'confused', 'disappointed', 'fearful', 'scream', 'open_mouth',
	'astonished', 'flushed', 'relieved', 'dizzy_face', 'angry', 'rage', 'pensive',
	'no_mouth', 'grimacing', 'smiling_imp', 'imp', 'skull', 'ghost', 'alien', 'robot',
	'clap', 'thumbsup', 'thumbsdown', 'ok_hand', 'fist', 'muscle', 'pray', 'wave',
	'point_up', 'point_down', 'point_left', 'point_right', 'raised_hands', 'handshake',
	'vulcan_salute', 'victory', 'metal', 'fingers_crossed', 'heart', 'broken_heart',
	'two_hearts', 'sparkling_heart', 'growing_heart', 'fire', 'star', 'star2', 'sparkles',
	'boom', 'zap', 'rainbow', 'sunny', 'sun_with_face', 'moon', 'cloud', 'snowflake',
	'umbrella', 'tornado', 'volcano', 'ocean', 'droplet', 'sweat_drops', 'eyes', 'ear',
	'nose', 'mouth', 'tongue', 'baby', 'child', 'boy', 'girl', 'man', 'woman',
	'family', 'couple', 'love_letter', 'gift', 'birthday', 'cake', 'balloon', 'tada',
	'confetti_ball', 'fireworks', 'sparkler', 'party_popper', 'clapper', 'musical_note',
	'notes', 'headphones', 'guitar', 'drum', 'video_game', 'game_die', 'trophy',
	'medal', 'money_bag', 'dollar', 'credit_card', 'money_with_wings', 'rocket',
	'airplane', 'car', 'bus', 'train', 'bike', 'sailboat', 'phone', 'mobile_phone',
	'computer', 'laptop', 'camera', 'video_camera', 'movie_camera', 'popcorn', 'pizza',
	'hamburger', 'fries', 'hotdog', 'taco', 'burrito', 'icecream', 'doughnut', 'cookie',
	'chocolate_bar', 'candy', 'lollipop', 'beer', 'wine_glass', 'cocktail', 'coffee',
	'tea', 'milk_glass', 'apple', 'banana', 'watermelon', 'grapes', 'peach', 'cherry',
	'strawberry', 'panda_face', 'cat', 'dog', 'lion', 'tiger', 'monkey', 'koala',
	'poodle', 'rabbit', 'frog', 'unicorn', 'snail', 'bug', 'butterfly', 'turtle',
	'penguin', 'bird', 'chicken', 'hatching_chick', 'duck', 'eagle', 'owl', 'fox',
	'bee', 'ant', 'lady_beetle', 'fish', 'dolphin', 'whale', 'octopus', 'crab',
	'shrimp', 'squid', 'snake', 'dragon', 'dragon_face', 't_rex', 'whale2',
];
