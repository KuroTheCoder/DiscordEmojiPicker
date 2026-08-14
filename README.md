# Discord Emoji Picker

![GitHub License](https://img.shields.io/github/license/KuroTheCoder/DiscordEmojiPicker)
![GitHub release](https://img.shields.io/github/v/release/KuroTheCoder/DiscordEmojiPicker)

A Discord-style emoji and sticker picker for [Obsidian](https://obsidian.md). It reads images from folders in your vault and lets you insert them into notes — fully offline by default.

## Features

- **Emoji & sticker pills** with set navigation, live search, and a "recently used" row.
- **Multiple insert styles**: shortcode (`:name:`), native embed (`[[image|size]]`), or raw HTML. Shortcodes render as images in the editor and reading mode.
- **Import modal** with a queue: drag & drop or paste links from Discord, local files, clipboard, note embeds, and emoji packs.
- **Clone from Discord servers** using a token — grab emojis and stickers from servers you're in.
- **Set management**: create, delete, and open set folders from the picker, the import modal, and the settings tab.
- **Themable picker**: built-in Default / Compact / Vibrant / Minimal styles, all driven by `--gl-*` CSS variables you can override in a snippet.

## Installation

### Community plugin list

Once approved, install from **Settings → Community plugins → Browse** and search for "Discord Emoji Picker".

### Manual

Copy `main.js`, `manifest.json`, and `styles.css` to:

```
<Vault>/.obsidian/plugins/discord-emoji-picker/
```

Then reload Obsidian and enable the plugin in **Settings → Community plugins**.

## Usage

- Click the smile ribbon icon or run **Open emoji & sticker picker** to open the picker at the cursor.
- Run **Import emojis & stickers** to open the import modal.

## Settings

- **Emoji / sticker folder** — where images live; each subfolder becomes a set.
- **Insert style** — shortcode, embed, or HTML.
- **Render shortcodes in editor** — show images while editing.
- **Emoji / sticker size** — grid size in the picker and inserted size.
- **Picker theme** — visual style of the picker panel.
- **Discord** — token and token type for server cloning, plus a connection test.

## Security & privacy

- The plugin is **offline by default**: no telemetry, and no network requests except to the public Discord CDN when you import or clone from Discord.
- The **Discord token is stored locally** in this vault's plugin data and is only ever sent to Discord.
- **Using your personal user token violates Discord's Terms of Service** and may get your account flagged or banned — the same risk as tools like Vencord. A **bot token is safe**; add the bot to the servers you want to clone from.

## Building

```bash
npm install
npm run dev     # watch mode
npm run build   # production build -> main.js
npm run lint    # eslint
```

## License

[ISC](LICENSE) © KuroTheDev
